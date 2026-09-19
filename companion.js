(function () {
  "use strict";

  // Shares the same localStorage key as avatar.js's "recent avatars" grid,
  // so a saved avatar can be picked as this companion's face.
  const RECENT_STORAGE_KEY = "urartuhiRecentAvatars";
  const CHAT_HISTORY_LIMIT = 20; // messages kept in memory per session

  const avatarPicker = document.getElementById("avatarPicker");
  const companionAvatarFrame = document.getElementById("companionAvatarFrame");
  const companionAvatarImg = document.getElementById("companionAvatarImg");
  const personaNameField = document.getElementById("personaName");
  const personaDescriptionField = document.getElementById("personaDescription");
  const voiceSelect = document.getElementById("voiceSelect");
  const startChatBtn = document.getElementById("startChatBtn");
  const chatPanel = document.getElementById("chatPanel");
  const chatAvatarFrame = document.getElementById("chatAvatarFrame");
  const chatAvatarImg = document.getElementById("chatAvatarImg");
  const mouthFlap = document.getElementById("mouthFlap");
  const speakToggle = document.getElementById("speakToggle");
  const micBtn = document.getElementById("micBtn");
  const chatWindow = document.getElementById("chatWindow");
  const chatForm = document.getElementById("chatForm");
  const chatMessageField = document.getElementById("chatMessage");
  const sendBtn = document.getElementById("sendBtn");
  const chatStatus = document.getElementById("chatStatus");
  const endChatBtn = document.getElementById("endChatBtn");
  const yearSpan = document.getElementById("year");

  let history = []; // [{ role: "user" | "companion", content: "" }]
  let persona = null;
  let selectedAvatarDataUrl = null;
  let mouthFlapTimer = null;
  let currentAudio = null;

  function startMouthFlap() {
    if (chatAvatarFrame.hidden) {
      return;
    }
    chatAvatarFrame.classList.add("is-speaking");
    mouthFlap.hidden = false;
    stopMouthFlap(); // clear any previous timer first
    mouthFlapTimer = window.setInterval(() => {
      mouthFlap.classList.toggle("flap-open");
    }, 130 + Math.random() * 90);
  }

  function stopMouthFlap() {
    if (mouthFlapTimer) {
      window.clearInterval(mouthFlapTimer);
      mouthFlapTimer = null;
    }
    mouthFlap.classList.remove("flap-open");
    mouthFlap.hidden = true;
    chatAvatarFrame.classList.remove("is-speaking");
  }

  // ---------------------------------------------------------------------
  // Voice output. Prefers higher-quality OpenAI TTS (window.URARTUHI_TTS_
  // BACKEND, POST /api/tts) with a user-selectable voice (defaults to
  // "nova", a warm natural female voice) so it isn't stuck with a random
  // robotic system default. Falls back to the browser's built-in
  // SpeechSynthesis (preferring a female-sounding voice if one is
  // available) if the backend is unreachable/not configured, so voice
  // output always works. Animates a simple mouth-flap on the avatar while
  // audio is actually playing.
  // ---------------------------------------------------------------------
  const speechSupported = "speechSynthesis" in window;
  let cachedBrowserVoices = [];

  function refreshBrowserVoices() {
    if (speechSupported) {
      cachedBrowserVoices = window.speechSynthesis.getVoices();
    }
  }
  refreshBrowserVoices();
  if (speechSupported) {
    window.speechSynthesis.addEventListener("voiceschanged", refreshBrowserVoices);
  }

  function pickFemaleBrowserVoice() {
    // Voice metadata is inconsistent across browsers/OSes -- there's no
    // reliable "gender" field, so this matches on common naming patterns
    // for widely-shipped female English voices as a best-effort default.
    const femaleNamePattern = /female|zira|susan|samantha|victoria|karen|moira|tessa|fiona|serena|allison|ava|joanna|salli|kendra|kimberly|ivy|google uk english female|google us english/i;
    return (
      cachedBrowserVoices.find(
        (voice) => femaleNamePattern.test(voice.name) && voice.lang.startsWith("en")
      ) || cachedBrowserVoices.find((voice) => femaleNamePattern.test(voice.name)) || null
    );
  }

  function speakWithBrowserVoice(text) {
    if (!speechSupported) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    const femaleVoice = pickFemaleBrowserVoice();
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    utterance.onstart = startMouthFlap;
    utterance.onend = stopMouthFlap;
    utterance.onerror = stopMouthFlap;
    window.speechSynthesis.speak(utterance);
  }

  async function speak(text) {
    if (!speakToggle.checked) {
      return;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const ttsBackendUrl = window.URARTUHI_TTS_BACKEND;
    if (ttsBackendUrl) {
      try {
        const response = await fetch(ttsBackendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: voiceSelect.value }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.audio) {
            const audio = new Audio(`data:audio/${data.format || "mp3"};base64,${data.audio}`);
            currentAudio = audio;
            audio.addEventListener("play", startMouthFlap);
            audio.addEventListener("ended", stopMouthFlap);
            audio.addEventListener("pause", stopMouthFlap);
            audio.addEventListener("error", () => {
              stopMouthFlap();
              speakWithBrowserVoice(text); // fall back if playback fails
            });
            await audio.play();
            return;
          }
        }
      } catch (error) {
        // Backend unreachable/unconfigured -- fall through to the browser
        // voice below rather than silently producing no sound at all.
      }
    }

    speakWithBrowserVoice(text);
  }

  // ---------------------------------------------------------------------
  // Voice input: browser-native SpeechRecognition (Chrome/Edge only --
  // feature-detected, mic button stays hidden elsewhere). Transcribes
  // speech into the message field; the user still presses Send, so
  // nothing is auto-submitted from a misheard phrase.
  // ---------------------------------------------------------------------
  const SpeechRecognitionCtor =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;
  let listening = false;

  if (SpeechRecognitionCtor) {
    micBtn.hidden = false;
    recognizer = new SpeechRecognitionCtor();
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.lang = "en-US";

    recognizer.addEventListener("result", (event) => {
      const transcript = event.results[0][0].transcript;
      chatMessageField.value = transcript;
      chatMessageField.focus();
    });
    recognizer.addEventListener("end", () => {
      listening = false;
      micBtn.classList.remove("is-listening");
    });
    recognizer.addEventListener("error", () => {
      listening = false;
      micBtn.classList.remove("is-listening");
      setChatStatus("Could not hear that -- try typing instead.", "error");
    });

    micBtn.addEventListener("click", () => {
      if (listening) {
        recognizer.stop();
        return;
      }
      listening = true;
      micBtn.classList.add("is-listening");
      setChatStatus("Listening...");
      recognizer.start();
    });
  }

  function loadRecentAvatars() {
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function populateAvatarPicker() {
    const entries = loadRecentAvatars();
    entries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.title || "Saved avatar";
      avatarPicker.appendChild(option);
    });
    return entries;
  }

  function applySelectedAvatar(entry) {
    if (entry) {
      selectedAvatarDataUrl = entry.dataUrl;
      companionAvatarImg.src = entry.dataUrl;
      companionAvatarFrame.hidden = false;
    } else {
      selectedAvatarDataUrl = null;
      companionAvatarFrame.hidden = true;
      companionAvatarImg.src = "";
    }
  }

  avatarPicker.addEventListener("change", () => {
    const entries = loadRecentAvatars();
    applySelectedAvatar(entries.find((entry) => entry.id === avatarPicker.value));
  });

  // Arriving from the avatar generator's "Chat with this avatar" button
  // (avatar.html sets ?avatar=<id> after auto-saving it) -- preselect that
  // avatar, prefill a persona name from its prompt, and jump straight into
  // the chat so generating and interacting feel like one continuous flow.
  function applyIncomingAvatarFromUrl(entries) {
    const params = new URLSearchParams(window.location.search);
    const incomingId = params.get("avatar");
    if (!incomingId) {
      return;
    }
    const entry = entries.find((candidate) => candidate.id === incomingId);
    if (!entry) {
      return;
    }
    avatarPicker.value = entry.id;
    applySelectedAvatar(entry);
    if (!personaNameField.value.trim()) {
      personaNameField.value = (entry.title || "Your avatar").slice(0, 40);
    }
    if (!personaDescriptionField.value.trim() && entry.alt) {
      personaDescriptionField.value = entry.alt.slice(0, 200);
    }
    startChatBtn.click();
  }

  function setChatStatus(message, kind) {
    chatStatus.textContent = message || "";
    chatStatus.classList.toggle("is-error", kind === "error");
  }

  function appendBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role === "user" ? "user" : "companion"}`;
    bubble.textContent = text;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  startChatBtn.addEventListener("click", () => {
    const name = personaNameField.value.trim() || "Your companion";
    const description =
      personaDescriptionField.value.trim() ||
      "warm, curious, and easy to talk to.";
    persona = { name, description };
    history = [];
    chatWindow.innerHTML = "";
    chatPanel.hidden = false;

    if (selectedAvatarDataUrl) {
      chatAvatarImg.src = selectedAvatarDataUrl;
      chatAvatarFrame.hidden = false;
    } else {
      chatAvatarFrame.hidden = true;
    }

    setChatStatus("");
    const greeting = `Hi, I'm ${name}. ${description
      .charAt(0)
      .toUpperCase()}${description.slice(1)} What would you like to chat about?`;
    appendBubble("companion", greeting);
    speak(greeting);
    chatMessageField.focus();
  });

  endChatBtn.addEventListener("click", () => {
    persona = null;
    history = [];
    chatWindow.innerHTML = "";
    chatPanel.hidden = true;
    setChatStatus("");
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    if (recognizer && listening) {
      recognizer.stop();
    }
  });

  // ---------------------------------------------------------------------
  // Pluggable companion-reply call, mirroring avatar.js's generateAvatar()
  // pattern. Calls window.URARTUHI_COMPANION_BACKEND (see
  // services/urartuhi-docent/index.js, POST /api/companion-chat). The
  // backend enforces family-friendly content -- this is intentionally NOT
  // an adult/romantic companion; it declines and redirects such requests.
  // ---------------------------------------------------------------------
  async function getCompanionReply({ personaInfo, conversation, message }) {
    const backendUrl = window.URARTUHI_COMPANION_BACKEND;
    if (!backendUrl) {
      throw new Error(
        "No companion chat backend configured (window.URARTUHI_COMPANION_BACKEND is unset)."
      );
    }

    // TODO: requires the urartuhi-docent Railway service to be redeployed
    // with the /api/companion-chat route and OPENAI_API_KEY configured.
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: personaInfo, history: conversation, message }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || `Chat request failed (HTTP ${response.status}).`);
    }

    const data = await response.json();
    if (!data || typeof data.reply !== "string") {
      throw new Error("Companion backend returned no reply.");
    }
    return data.reply;
  }

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = chatMessageField.value.trim();
    if (!message || !persona) {
      return;
    }

    appendBubble("user", message);
    history.push({ role: "user", content: message });
    history = history.slice(-CHAT_HISTORY_LIMIT);
    chatMessageField.value = "";

    sendBtn.disabled = true;
    setChatStatus("Thinking...");

    try {
      const reply = await getCompanionReply({
        personaInfo: persona,
        conversation: history,
        message,
      });
      appendBubble("companion", reply);
      speak(reply);
      history.push({ role: "companion", content: reply });
      history = history.slice(-CHAT_HISTORY_LIMIT);
      setChatStatus("");
    } catch (error) {
      setChatStatus(
        `Could not get a reply: ${error.message || "unknown error"}. ` +
          "The companion backend may not be deployed yet -- see README.",
        "error"
      );
    } finally {
      sendBtn.disabled = false;
      chatMessageField.focus();
    }
  });

  const initialAvatarEntries = populateAvatarPicker();
  applyIncomingAvatarFromUrl(initialAvatarEntries);

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
})();
