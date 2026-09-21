(function () {
  "use strict";

  const form = document.getElementById("liveAvatarForm");
  const characterPromptField = document.getElementById("characterPrompt");
  const startBtn = document.getElementById("startLiveBtn");
  const endBtn = document.getElementById("endLiveBtn");
  const statusEl = document.getElementById("liveAvatarStatus");
  const frame = document.getElementById("liveAvatarFrame");
  const placeholderEl = document.getElementById("liveGoldFramePlaceholder");
  const yearSpan = document.getElementById("year");

  let currentConversationUrl = null;

  function setStatus(message, kind) {
    statusEl.textContent = message || "";
    statusEl.classList.toggle("is-error", kind === "error");
    statusEl.classList.toggle("is-success", kind === "success");
  }

  // ---------------------------------------------------------------------
  // Pluggable live-avatar start call. Currently wraps a backend route that
  // wraps Tavus's Conversational Video Interface (POST /v2/conversations),
  // see services/urartuhi-docent/index.js, POST /api/start-live-avatar.
  // Requires TAVUS_API_KEY + TAVUS_PAL_ID (or TAVUS_FACE_ID) to be
  // configured on the backend -- until then this call returns a clear
  // "not configured yet" error instead of a broken/blank iframe.
  // ---------------------------------------------------------------------
  async function startLiveAvatar(characterPrompt) {
    const backendUrl = window.URARTUHI_LIVE_AVATAR_BACKEND;
    if (!backendUrl) {
      throw new Error(
        "No live-avatar backend configured (window.URARTUHI_LIVE_AVATAR_BACKEND is unset)."
      );
    }

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterPrompt }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || `Could not start conversation (HTTP ${response.status}).`);
    }

    const data = await response.json();
    if (!data || !data.conversationUrl) {
      throw new Error("Live-avatar backend returned no conversation URL.");
    }
    return data.conversationUrl;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const characterPrompt = characterPromptField.value.trim();
    if (!characterPrompt) {
      setStatus("Please describe your character first.", "error");
      characterPromptField.focus();
      return;
    }

    startBtn.disabled = true;
    setStatus("Starting your live conversation...");

    try {
      currentConversationUrl = await startLiveAvatar(characterPrompt);
      frame.src = currentConversationUrl;
      frame.hidden = false;
      placeholderEl.hidden = true;
      endBtn.hidden = false;
      setStatus("Connected -- say hello.", "success");
    } catch (error) {
      setStatus(
        `Could not start a live avatar: ${error.message || "unknown error"}. ` +
          "The live-avatar backend may not be configured with a provider API key yet -- see README.",
        "error"
      );
    } finally {
      startBtn.disabled = false;
    }
  });

  endBtn.addEventListener("click", () => {
    frame.src = "";
    frame.hidden = true;
    placeholderEl.hidden = false;
    endBtn.hidden = true;
    currentConversationUrl = null;
    setStatus("Conversation ended.");
  });

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
})();
