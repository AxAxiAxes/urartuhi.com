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

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function showEmptyState() {
    slideshowSection.hidden = true;
    gridSection.hidden = true;
    const note = document.createElement("p");
    note.className = "gallery-empty-note";
    note.textContent =
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
    img.src = `images/${entry.file}`;
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
      img.src = `images/${entry.file}`;
      img.alt = "";
      thumb.appendChild(img);
      thumb.addEventListener("click", () => goTo(index, true));
      grid.appendChild(thumb);
    });
  }

  function goTo(index, userInitiated) {
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
    if (!entries || entries.length === 0) {
      showEmptyState();
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

    prevBtn.addEventListener("click", prev);
    nextBtn.addEventListener("click", () => goTo(current + 1, true));
    playPauseBtn.addEventListener("click", togglePlayPause);

    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") goTo(current + 1, true);
    });

    startTimer();

    if (yearSpan) {
      yearSpan.textContent = new Date().getFullYear();
    }
  }

  fetch(MANIFEST_URL, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : []))
    .catch(() => [])
    .then((entries) => init(Array.isArray(entries) ? entries : []));
})();

