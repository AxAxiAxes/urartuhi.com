(function () {
  "use strict";

  const panel = document.getElementById("urartuhi-whisper");
  const open = document.getElementById("openUrartuhi");
  if (!panel || !open) return;
  const output = document.getElementById("urartuhi-response");
  const input = document.getElementById("urartuhi-input");
  const send = document.getElementById("urartuhi-send");
  const narrate = document.getElementById("urartuhi-narrate");
  let controller = null;

  function close() {
    if (controller) controller.abort();
    panel.hidden = true;
    open.setAttribute("aria-expanded", "false");
    open.focus();
  }

  open.addEventListener("click", () => {
    panel.hidden = false;
    open.setAttribute("aria-expanded", "true");
    input.focus();
  });
  document.getElementById("closeUrartuhi").addEventListener("click", close);
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  async function ask(question) {
    if (controller) return;
    const image = document.querySelector(".slide.active img") ||
      document.querySelector(".featured-image");
    if (!image || !image.src.startsWith(new URL("images/", location.href).href)) {
      output.textContent = "Local images stay private and cannot be sent to the AI docent. Clear local images or select an original gallery artwork first.";
      return;
    }
    const backend = window.URARTUHI_BACKEND;
    if (!backend) {
      output.textContent = "The AI docent backend is not configured.";
      return;
    }
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 60000);
    send.disabled = true;
    narrate.disabled = true;
    output.textContent = "Urartuhi is observing this artwork...";
    try {
      const response = await fetch(backend, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          imageUrl: image.src,
          pieceId: image.closest("figure").querySelector(".title, .featured-title")?.textContent || document.title,
          question: question || null,
        }),
      });
      if (!response.ok) throw new Error(`AI docent unavailable (HTTP ${response.status}). Try again later.`);
      if (!response.body) throw new Error("The AI docent returned no response stream.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      function readLine(line) {
        if (!line.startsWith("data:")) return;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") return;
        const chunk = JSON.parse(data);
        if (chunk.error) throw new Error("The AI provider could not complete this response.");
        full += chunk.choices?.[0]?.delta?.content || "";
        output.textContent = full || "Urartuhi is observing this artwork...";
      }
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.forEach(readLine);
        if (done) break;
      }
      if (buffer) readLine(buffer);
      if (!full) throw new Error("The AI docent returned no narration. Try again later.");
      if (question) input.value = "";
    } catch (error) {
      output.textContent = error.name === "AbortError"
        ? "Narration stopped or timed out. You can try again."
        : `Could not reach Urartuhi: ${error.message}`;
    } finally {
      clearTimeout(timeout);
      controller = null;
      send.disabled = false;
      narrate.disabled = false;
    }
  }

  narrate.addEventListener("click", () => ask());
  document.getElementById("urartuhi-chat").addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value.trim()) ask(input.value.trim());
  });
})();
