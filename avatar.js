(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Style presets: short descriptive fragments appended to the user prompt
  // so the generated avatar leans into the site's aesthetic.
  // ---------------------------------------------------------------------
  const STYLE_PRESETS = {
    "axpure-water-light": {
      label: "Axpure Water-Light",
      promptSuffix:
        "rendered with the Axpure water-light glow: soft radiant blue-gold " +
        "luminous waves, gentle rippling highlights, serene and ethereal.",
    },
    "gold-ornamental-frame": {
      label: "Gold Ornamental Frame",
      promptSuffix:
        "framed by an ornate gilded border motif, warm gold filigree " +
        "accents, classical and regal lighting.",
    },
    "cosmic-gradient": {
      label: "Cosmic Gradient",
      promptSuffix:
        "set against a deep cosmic gradient background, starlit indigo-to-" +
        "black sky, subtle nebula color washes.",
    },
    "eternal-instant": {
      label: "Eternal Instant",
      promptSuffix:
        "captured as a single luminous eternal instant, timeless, painterly, " +
        "reverent stillness, soft glow at the edges.",
    },
  };

  const RECENT_STORAGE_KEY = "urartuhiRecentAvatars";
  const RECENT_LIMIT = 24;

  const form = document.getElementById("avatarForm");
  const referenceInput = document.getElementById("referenceImage");
  const referencePreview = document.getElementById("referencePreview");
  const referencePreviewImg = document.getElementById("referencePreviewImg");
  const clearReferenceBtn = document.getElementById("clearReference");
  const promptField = document.getElementById("prompt");
  const stylePresetField = document.getElementById("stylePreset");
  const generateBtn = document.getElementById("generateBtn");
  const statusEl = document.getElementById("avatarStatus");
  const previewImg = document.getElementById("avatarPreviewImg");
  const placeholderEl = document.getElementById("goldFramePlaceholder");
  const saveBtn = document.getElementById("saveBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const recentGrid = document.getElementById("recentGrid");
  const recentEmptyNote = document.getElementById("recentEmptyNote");
  const yearSpan = document.getElementById("year");

  let referenceImageDataUrl = null;
  let currentAvatarDataUrl = null;

  function setStatus(message, kind) {
    statusEl.textContent = message || "";
    statusEl.classList.toggle("is-error", kind === "error");
    statusEl.classList.toggle("is-success", kind === "success");
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  referenceInput.addEventListener("change", async () => {
    const file = referenceInput.files && referenceInput.files[0];
    if (!file) {
      return;
    }
    try {
      referenceImageDataUrl = await readFileAsDataUrl(file);
      referencePreviewImg.src = referenceImageDataUrl;
      referencePreview.hidden = false;
    } catch (error) {
      setStatus("Could not read that image file.", "error");
    }
  });

  clearReferenceBtn.addEventListener("click", () => {
    referenceImageDataUrl = null;
    referenceInput.value = "";
    referencePreview.hidden = true;
    referencePreviewImg.src = "";
  });

  // ---------------------------------------------------------------------
  // Pluggable generation call. Swap this out (or point
  // window.URARTUHI_AVATAR_BACKEND at a different service) to change the
  // underlying image-generation provider without touching the rest of the
  // page. Currently expects a backend that wraps OpenAI's Images API (see
  // services/urartuhi-docent/index.js, POST /api/generate-avatar).
  // ---------------------------------------------------------------------
  async function generateAvatar({ prompt, style, referenceImage }) {
    const backendUrl = window.URARTUHI_AVATAR_BACKEND;
    if (!backendUrl) {
      throw new Error(
        "No avatar backend configured (window.URARTUHI_AVATAR_BACKEND is unset)."
      );
    }

    // TODO: this endpoint must be deployed with an OPENAI_API_KEY secret
    // configured (see services/urartuhi-docent). Until that service is
    // redeployed with the /api/generate-avatar route, this call will fail
    // with a network/404 error, which is surfaced to the user below rather
    // than silently swallowed.
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style, referenceImage: referenceImage || null }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || `Generation failed (HTTP ${response.status}).`);
    }

    const data = await response.json();
    if (!data || !data.image) {
      throw new Error("Generation backend returned no image.");
    }

    // Backend may return either a data URL/base64 string or a hosted URL.
    return data.image.startsWith("data:") || data.image.startsWith("http")
      ? data.image
      : `data:image/png;base64,${data.image}`;
  }

  function buildFullPrompt(rawPrompt, styleKey) {
    const preset = STYLE_PRESETS[styleKey];
    const suffix = preset ? preset.promptSuffix : "";
    return suffix ? `${rawPrompt.trim()} -- ${suffix}` : rawPrompt.trim();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const rawPrompt = promptField.value.trim();
    if (!rawPrompt) {
      setStatus("Please enter a prompt first.", "error");
      promptField.focus();
      return;
    }

    const styleKey = stylePresetField.value;
    const fullPrompt = buildFullPrompt(rawPrompt, styleKey);

    generateBtn.disabled = true;
    saveBtn.disabled = true;
    downloadBtn.disabled = true;
    setStatus("Generating your avatar...");

    try {
      const imageDataUrl = await generateAvatar({
        prompt: fullPrompt,
        style: styleKey,
        referenceImage: referenceImageDataUrl,
      });

      currentAvatarDataUrl = imageDataUrl;
      previewImg.src = imageDataUrl;
      previewImg.hidden = false;
      previewImg.alt = rawPrompt;
      placeholderEl.hidden = true;

      saveBtn.disabled = false;
      downloadBtn.disabled = false;
      setStatus("Avatar generated.", "success");
    } catch (error) {
      setStatus(
        `Could not generate an avatar: ${error.message || "unknown error"}. ` +
          "The generator backend may not be deployed yet -- see README.",
        "error"
      );
    } finally {
      generateBtn.disabled = false;
    }
  });

  // ---------------------------------------------------------------------
  // Recently generated avatars: persisted to localStorage only. This is a
  // static site with no server-side write access from the browser, so this
  // does NOT touch images/manifest.json -- see README for the manual step
  // to promote a saved avatar into the permanent public gallery.
  // ---------------------------------------------------------------------
  function loadRecentAvatars() {
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveRecentAvatars(entries) {
    try {
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      // localStorage may be unavailable (private browsing / quota) -- fail
      // quietly, the grid simply won't persist across reloads.
    }
  }

  function renderRecentGrid() {
    const entries = loadRecentAvatars();
    recentGrid.innerHTML = "";
    recentEmptyNote.hidden = entries.length > 0;

    entries.forEach((entry) => {
      const thumb = document.createElement("div");
      thumb.className = "thumb";

      const img = document.createElement("img");
      img.src = entry.dataUrl;
      img.alt = entry.alt || entry.title || "Saved avatar";
      img.loading = "lazy";
      thumb.appendChild(img);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "thumb-remove";
      removeBtn.textContent = "\u00d7";
      removeBtn.setAttribute("aria-label", "Remove this saved avatar");
      removeBtn.addEventListener("click", () => removeRecentAvatar(entry.id));
      thumb.appendChild(removeBtn);

      recentGrid.appendChild(thumb);
    });
  }

  function removeRecentAvatar(id) {
    const entries = loadRecentAvatars().filter((entry) => entry.id !== id);
    saveRecentAvatars(entries);
    renderRecentGrid();
  }

  saveBtn.addEventListener("click", () => {
    if (!currentAvatarDataUrl) {
      return;
    }
    const entries = loadRecentAvatars();
    const styleKey = stylePresetField.value;
    const preset = STYLE_PRESETS[styleKey];
    entries.unshift({
      id: `avatar-${Date.now()}`,
      dataUrl: currentAvatarDataUrl,
      title: promptField.value.trim().slice(0, 80) || "Untitled avatar",
      meta: preset ? preset.label : "",
      alt: promptField.value.trim(),
      tags: ["avatar", styleKey],
      createdAt: new Date().toISOString(),
    });
    saveRecentAvatars(entries.slice(0, RECENT_LIMIT));
    renderRecentGrid();
    setStatus("Saved to your recent avatars below.", "success");
  });

  downloadBtn.addEventListener("click", () => {
    if (!currentAvatarDataUrl) {
      return;
    }
    const link = document.createElement("a");
    link.href = currentAvatarDataUrl;
    link.download = `urartuhi-avatar-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  renderRecentGrid();

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
})();
