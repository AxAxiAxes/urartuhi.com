(function () {
  "use strict";
  const form = document.getElementById("liveAvatarForm");
  const prompt = document.getElementById("characterPrompt");
  const accessCode = document.getElementById("liveAccessCode");
  const consent = document.getElementById("liveConsent");
  const startBtn = document.getElementById("startLiveBtn");
  const endBtn = document.getElementById("endLiveBtn");
  const checkBtn = document.getElementById("checkLiveSetup");
  const setupStatus = document.getElementById("liveSetupStatus");
  const status = document.getElementById("liveAvatarStatus");
  const frame = document.getElementById("liveAvatarFrame");
  const placeholder = document.getElementById("liveGoldFramePlaceholder");
  let ready = false;
  let busy = false;
  let session = null;
  let timer = null;

  function endpoint(path) {
    const backend = window.URARTUHI_LIVE_AVATAR_BACKEND;
    if (!backend) throw new Error("Live-avatar backend is not configured.");
    return new URL(path, backend).href;
  }

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("is-error", error);
  }

  function updateControls() {
    startBtn.disabled = !ready || busy || !!session;
    checkBtn.disabled = busy;
    endBtn.hidden = !session;
    endBtn.disabled = busy;
  }

  async function request(path, options = {}) {
    const response = await fetch(endpoint(path), {
      ...options, cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    const data = await response.json().catch(() => {
      throw new Error(`Backend returned an unexpected response (HTTP ${response.status}). Redeploy the updated service.`);
    });
    if (data.conversationId && data.endToken) {
      session = { conversationId: data.conversationId, endToken: data.endToken };
    }
    if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
    return data;
  }

  async function checkSetup() {
    busy = true;
    updateControls();
    try {
      const data = await request("/api/live-avatar-status");
      ready = data.ready === true;
      setupStatus.textContent = ready
        ? "Server variables are configured. Account/key validity and credits are not yet verified. Only Start creates a conversation."
        : `Server setup required: ${(data.missing || []).join(", ")}. Set these in Railway using your existing account, then redeploy and check again.`;
    } catch (error) {
      ready = false;
      setupStatus.textContent = `Setup check failed: ${error.message} Deploy the updated Railway service and check its allowed origins, then try again. No conversation was started.`;
    } finally {
      busy = false;
      updateControls();
    }
  }

  function detachFrame() {
    frame.removeAttribute("src");
    frame.hidden = true;
    placeholder.hidden = false;
  }

  async function endConversation() {
    if (!session || busy) return;
    busy = true;
    updateControls();
    detachFrame();
    clearTimeout(timer);
    try {
      await request("/api/end-live-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      });
      session = null;
      setStatus("Tavus confirmed the conversation ended.");
    } catch (error) {
      setStatus(`${error.message} Retry End or check the Tavus dashboard. Do not start another session until resolved.`, true);
    } finally {
      busy = false;
      updateControls();
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || session || !ready) return;
    if (!prompt.value.trim() || prompt.value.length > 2000 || !accessCode.value || !consent.checked) {
      setStatus("Enter a description, your private owner access code, and confirm consent before starting.", true);
      return;
    }
    busy = true;
    updateControls();
    setStatus("Requesting a Tavus conversation. This may use plan credits...");
    try {
      const data = await request("/api/start-live-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Urartuhi-Access-Code": accessCode.value },
        body: JSON.stringify({ characterPrompt: prompt.value.trim(), consent: true }),
      });
      accessCode.value = "";
      if (!session) throw new Error("Backend returned no cleanup capability. Check Tavus before retrying.");
      const url = new URL(data.conversationUrl);
      if (url.protocol !== "https:" || url.username || url.password ||
          !(url.hostname === "tavus.daily.co" || url.hostname.endsWith(".daily.co"))) {
        throw new Error("Backend returned an unsupported conversation URL. Use End to clean up.");
      }
      frame.src = url.href;
      frame.hidden = false;
      placeholder.hidden = true;
      timer = setTimeout(endConversation, 300000);
      setStatus("Room created. Join using the embedded camera/microphone controls. This is not yet confirmation of a connected call; five-minute maximum.");
    } catch (error) {
      setStatus(`${error.message} ${session ? "Use End to clean up this session." : "If creation was uncertain, check Tavus before retrying."}`, true);
    } finally {
      busy = false;
      updateControls();
    }
  });
  endBtn.addEventListener("click", endConversation);
  checkBtn.addEventListener("click", checkSetup);
  window.addEventListener("pagehide", () => {
    if (!session) return;
    detachFrame();
    fetch(endpoint("/api/end-live-avatar"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session), keepalive: true,
    }).catch(() => {
      // Navigation cleanup is best-effort; provider timeouts bound abandoned calls.
      console.warn("Tavus cleanup was not confirmed. Check the dashboard; calls are capped at five minutes.");
    });
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && session) endConversation();
  });
  document.getElementById("year").textContent = new Date().getFullYear();
  checkSetup();
})();
