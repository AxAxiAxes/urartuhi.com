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
  const startChatBtn = document.getElementById("startChatBtn");
  const chatPanel = document.getElementById("chatPanel");
  const chatAvatarFrame = document.getElementById("chatAvatarFrame");
  const chatAvatarImg = document.getElementById("chatAvatarImg");
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

  // ---------------------------------------------------------------------
  // Voice output: browser-native SpeechSynthesis (no backend/API key
  // needed). Pulses the gold-frame avatar while speaking as a lightweight
  // stand-in for real lip-sync, which isn't feasible for a static image.
  // ---------------------------------------------------------------------
  const speechSupported = "speechSynthesis" in window;

  function speak(text) {
    if (!speechSupported || !speakToggle.checked) {
      return;
    }
    window.speechSynthesis.cancel(); // don't overlap with a prior reply
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.onstart = () => chatAvatarFrame.classList.add("is-speaking");
    utterance.onend = () => chatAvatarFrame.classList.remove("is-speaking");
    utterance.onerror = () => chatAvatarFrame.classList.remove("is-speaking");
    window.speechSynthesis.speak(utterance);
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
  }

  avatarPicker.addEventListener("change", () => {
    const entries = loadRecentAvatars();
    const selected = entries.find((entry) => entry.id === avatarPicker.value);
    if (selected) {
      selectedAvatarDataUrl = selected.dataUrl;
      companionAvatarImg.src = selected.dataUrl;
      companionAvatarFrame.hidden = false;
    } else {
      selectedAvatarDataUrl = null;
      companionAvatarFrame.hidden = true;
      companionAvatarImg.src = "";
    }
  });

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

  populateAvatarPicker();

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
})();
