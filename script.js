(function () {
  "use strict";

  const slidesContainer = document.getElementById("slides");
  const dotsContainer = document.getElementById("dots");
  const slideCounter = document.getElementById("slideCounter");
  const grid = document.getElementById("grid");
  const tagFilter = document.getElementById("tagFilter");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const yearSpan = document.getElementById("year");
  const slideshowSection = document.querySelector(".slideshow");
  const gridSection = document.querySelector(".gallery-grid");
  const localImageFiles = document.getElementById("localImageFiles");
  const clearLocalImages = document.getElementById("clearLocalImages");
  const localImagesStatus = document.getElementById("localImagesStatus");

  const AUTO_ADVANCE_MS = 5000;
  const MANIFEST_URL = "images/manifest.json";
  // Above this many pieces, per-image nav dots stop being usable, so we
  // switch to a plain "N / total" counter instead. Tag filtering and the
  // masonry grid have no such limit -- they scale to any collection size.
  const DOT_UI_LIMIT = 12;

  let slides = [];
  let current = 0;
  let timer = null;
  let playing = true;
  let originalEntries = [];
  let localEntries = [];
  let galleryError = "";
  let selectionVersion = 0;
  const localUrls = new Set();
  const MAX_LOCAL_IMAGES = 50;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
  const LOCAL_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function showEmptyState(message) {
    slideshowSection.hidden = true;
    gridSection.hidden = true;
    const note = document.createElement("p");
    note.className = "gallery-empty-note";
    note.setAttribute("role", "status");
    note.textContent = message ||
      "No additional slideshow pieces yet. Add image files to images/ and " +
      "list them in images/manifest.json to populate this gallery -- see " +
      "the README for the exact format. Any number of entries is " +
      "supported; there is no fixed limit built into this page.";
    slideshowSection.parentNode.insertBefore(note, slideshowSection);
  }

  function buildSlide(entry, index) {
    const figure = document.createElement("figure");
    figure.className = "slide" + (index === 0 ? " active" : "");
    figure.dataset.index = String(index);

    const img = document.createElement("img");
    img.className = "artwork-image";
    img.loading = "lazy";
    img.src = entry.localUrl || `images/${entry.file}`;
    img.alt = entry.alt || entry.title || `Artwork ${index + 1}`;
    figure.appendChild(img);

    const caption = document.createElement("figcaption");
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = entry.title || `Untitled ${index + 1}`;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = entry.meta || "";
    caption.appendChild(title);
    caption.appendChild(meta);
    figure.appendChild(caption);

    return figure;
  }

  function buildDots() {
    if (slides.length > DOT_UI_LIMIT) {
      // Too many pieces for one dot per slide to stay usable -- show a
      // simple position counter instead (still fully navigable via the
      // prev/next arrows, keyboard arrows, and grid thumbnails below).
      dotsContainer.hidden = true;
      slideCounter.hidden = false;
      updateSlideCounter();
      return;
    }
    slides.forEach((_slide, index) => {
      const dot = document.createElement("button");
      dot.className = "dot" + (index === 0 ? " active" : "");
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", `Go to slide ${index + 1}`);
      dot.addEventListener("click", () => goTo(index, true));
      dotsContainer.appendChild(dot);
    });
  }

  function updateSlideCounter() {
    if (!slideCounter.hidden) {
      slideCounter.textContent = `${current + 1} / ${slides.length}`;
    }
  }

  function buildTagFilter(entries) {
    const tagSet = new Set();
    entries.forEach((entry) => {
      (entry.tags || []).forEach((tag) => tagSet.add(String(tag)));
    });
    if (tagSet.size === 0) {
      return;
    }

    tagFilter.hidden = false;

    function makeButton(label, tag) {
      const button = document.createElement("button");
      button.className = "tag-btn" + (tag === null ? " active" : "");
      button.textContent = label;
      button.dataset.tag = tag === null ? "" : tag;
      button.addEventListener("click", () => {
        tagFilter
          .querySelectorAll(".tag-btn")
          .forEach((b) => b.classList.toggle("active", b === button));
        applyTagFilter(tag);
      });
      tagFilter.appendChild(button);
    }

    makeButton("All", null);
    Array.from(tagSet)
      .sort((a, b) => a.localeCompare(b))
      .forEach((tag) => makeButton(tag, tag));
  }

  function applyTagFilter(tag) {
    const thumbs = grid.querySelectorAll(".thumb");
    thumbs.forEach((thumb) => {
      const matches = !tag || (thumb.dataset.tags || "").split("|").includes(tag);
      thumb.hidden = !matches;
    });
  }

  function buildGrid(entries) {
    // Masonry layout: each thumbnail keeps the image's natural aspect
    // ratio (no forced square crop), so the grid scales visually the same
    // way regardless of whether it holds a handful of pieces or hundreds.
    entries.forEach((entry, index) => {
      const thumb = document.createElement("button");
      thumb.className = "thumb";
      thumb.dataset.tags = (entry.tags || []).join("|");
      thumb.setAttribute("aria-label", `View ${escapeHtml(entry.title || "artwork")} in slideshow`);
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = entry.localUrl || `images/${entry.file}`;
      img.alt = "";
      thumb.appendChild(img);
      thumb.addEventListener("click", () => goTo(index, true));
      grid.appendChild(thumb);
    });
  }

  function goTo(index, userInitiated) {
    if (!slides.length) return;
    slides[current].classList.remove("active");
    if (dotsContainer.children[current]) {
      dotsContainer.children[current].classList.remove("active");
    }

    current = (index + slides.length) % slides.length;

    slides[current].classList.add("active");
    if (dotsContainer.children[current]) {
      dotsContainer.children[current].classList.add("active");
    }
    updateSlideCounter();

    if (userInitiated) {
      restartTimer();
    }
  }

  function next() {
    goTo(current + 1, false);
  }

  function prev() {
    goTo(current - 1, true);
  }

  function startTimer() {
    stopTimer();
    if (playing && slides.length > 1) {
      timer = setInterval(next, AUTO_ADVANCE_MS);
    }
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function restartTimer() {
    stopTimer();
    startTimer();
  }

  function togglePlayPause() {
    playing = !playing;
    playPauseBtn.textContent = playing ? "Pause" : "Play";
    playPauseBtn.setAttribute(
      "aria-label",
      playing ? "Pause slideshow" : "Play slideshow"
    );
    restartTimer();
  }

  function init(entries) {
    stopTimer();
    slidesContainer.replaceChildren();
    dotsContainer.replaceChildren();
    grid.replaceChildren();
    tagFilter.replaceChildren();
    dotsContainer.hidden = false;
    slideCounter.hidden = true;
    tagFilter.hidden = true;
    slideshowSection.hidden = false;
    gridSection.hidden = false;
    slideshowSection.parentNode.querySelector(".gallery-empty-note")?.remove();
    slides = [];
    current = 0;
    if (!entries || entries.length === 0) {
      showEmptyState(galleryError);
      if (yearSpan) yearSpan.textContent = new Date().getFullYear();
      return;
    }

    entries.forEach((entry, index) => {
      slidesContainer.appendChild(buildSlide(entry, index));
    });
    slides = Array.from(document.querySelectorAll(".slide"));

    buildDots();
    buildTagFilter(entries);
    buildGrid(entries);

    startTimer();

    if (yearSpan) {
      yearSpan.textContent = new Date().getFullYear();
    }
  }

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", () => goTo(current + 1, true));
  playPauseBtn.addEventListener("click", togglePlayPause);
  document.addEventListener("keydown", (event) => {
    if (event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]")) return;
    if (event.key === "ArrowLeft") prev();
    if (event.key === "ArrowRight") goTo(current + 1, true);
  });

  function releaseLocalUrl(url) {
    URL.revokeObjectURL(url);
    localUrls.delete(url);
  }

  function validateImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const timeout = setTimeout(() => finish(new Error("image decode timed out")), 10000);
      function finish(error) {
        clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        image.src = "";
        if (error) reject(error);
        else resolve();
      }
      image.onload = () => {
        const pixels = image.naturalWidth * image.naturalHeight;
        finish(pixels > 0 && pixels <= 20000000
          ? null : new Error("image must be no larger than 20 megapixels"));
      };
      image.onerror = () => finish(new Error("not a readable image"));
      image.src = url;
    });
  }

  localImageFiles.addEventListener("change", async () => {
    const files = Array.from(localImageFiles.files || []);
    localImageFiles.value = "";
    if (!files.length) return;
    const version = ++selectionVersion;
    localImageFiles.disabled = true;
    clearLocalImages.disabled = false;
    localImagesStatus.textContent = "Checking local images. Nothing is being uploaded.";
    const rejected = [];
    let accepted = 0;
    let bytes = localEntries.reduce((sum, entry) => sum + entry.bytes, 0);
    try {
      for (let index = 0; index < files.length; index++) {
        if (version !== selectionVersion) return;
        const file = files[index];
        if (localEntries.length >= MAX_LOCAL_IMAGES) {
          rejected.push(`${files.length - index} remaining file(s): 50-image limit reached`);
          break;
        }
        let url;
        try {
          if (!LOCAL_IMAGE_TYPES.has(file.type)) throw new Error("use JPEG, PNG, WebP or GIF");
          if (!file.size || file.size > MAX_FILE_BYTES) throw new Error("file must be between 1 byte and 10 MiB");
          if (bytes + file.size > MAX_TOTAL_BYTES) throw new Error("100 MiB total limit exceeded");
          url = URL.createObjectURL(file);
          localUrls.add(url);
          await validateImage(url);
          if (version !== selectionVersion) {
            releaseLocalUrl(url);
            return;
          }
          localEntries.push({
            localUrl: url, bytes: file.size, title: file.name,
            alt: file.name, meta: "Local preview only", tags: ["local"],
          });
          bytes += file.size;
          accepted++;
        } catch (error) {
          if (url) releaseLocalUrl(url);
          rejected.push(`${file.name}: ${error.message}`);
        }
      }
      if (version !== selectionVersion) return;
      if (accepted) {
        init([...originalEntries, ...localEntries]);
        goTo(originalEntries.length + localEntries.length - accepted, true);
      }
      const details = rejected.slice(0, 10).join("; ");
      localImagesStatus.textContent =
        `Added ${accepted} image(s); ${localEntries.length} local image(s) in this slideshow. Nothing was uploaded.` +
        (rejected.length ? ` Rejected: ${details}${rejected.length > 10 ? `; ${rejected.length - 10} more rejected files` : ""}.` : "");
    } finally {
      if (version === selectionVersion) {
        localImageFiles.disabled = false;
        clearLocalImages.disabled = localEntries.length === 0;
      }
    }
  });

  clearLocalImages.addEventListener("click", () => {
    selectionVersion++;
    localEntries = [];
    init(originalEntries);
    localUrls.forEach(releaseLocalUrl);
    localImageFiles.disabled = false;
    localImageFiles.value = "";
    clearLocalImages.disabled = true;
    localImagesStatus.textContent = "Local images cleared. Original gallery restored; nothing was uploaded.";
  });
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) localUrls.forEach(releaseLocalUrl);
  });

  const fitImageBtn = document.getElementById("fitImageBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const viewerStatus = document.getElementById("viewerStatus");
  if (fitImageBtn) {
    fitImageBtn.addEventListener("click", () => {
      const fill = slideshowSection.classList.toggle("is-fill");
      fitImageBtn.setAttribute("aria-pressed", String(fill));
      fitImageBtn.textContent = fill ? "Fit whole image" : "Fill frame (crop)";
      viewerStatus.textContent = fill
        ? "Fill mode crops image edges to fill the frame."
        : "Fit mode shows the entire image without cropping.";
    });
  }
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", async () => {
      if (!document.fullscreenEnabled) {
        viewerStatus.textContent = "Fullscreen is unavailable in this browser or embedded preview. Open the viewer in a browser tab.";
        return;
      }
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await slideshowSection.requestFullscreen();
      } catch (error) {
        viewerStatus.textContent = `Could not enter fullscreen: ${error.message}`;
      }
    });
    document.addEventListener("fullscreenchange", () => {
      fullscreenBtn.textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
    });
  }

  fetch(MANIFEST_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Gallery manifest request failed (HTTP ${response.status}).`);
      }
      return response.json();
    })
    .then((entries) => {
      if (!Array.isArray(entries)) {
        throw new Error("Gallery manifest must contain an array.");
      }
      originalEntries = entries;
      init([...originalEntries, ...localEntries]);
    })
    .catch((error) => {
      console.error("Could not load the gallery:", error);
      galleryError =
        "Could not load the additional artwork. Reload the page to try again. " +
        "For a local preview, serve this folder over HTTP rather than opening " +
        "index.html directly. If the problem persists, check images/manifest.json.";
      init(localEntries);
    });
})();
