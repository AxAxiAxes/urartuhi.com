(function () {
  "use strict";

  const slidesContainer = document.getElementById("slides");
  const dotsContainer = document.getElementById("dots");
  const grid = document.getElementById("grid");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const yearSpan = document.getElementById("year");
  const slideshowSection = document.querySelector(".slideshow");
  const gridSection = document.querySelector(".gallery-grid");

  const AUTO_ADVANCE_MS = 5000;
  const MANIFEST_URL = "images/manifest.json";

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
    slides.forEach((_slide, index) => {
      const dot = document.createElement("button");
      dot.className = "dot" + (index === 0 ? " active" : "");
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", `Go to slide ${index + 1}`);
      dot.addEventListener("click", () => goTo(index, true));
      dotsContainer.appendChild(dot);
    });
  }

  function buildGrid(entries) {
    entries.forEach((entry, index) => {
      const thumb = document.createElement("button");
      thumb.className = "thumb";
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
    dotsContainer.children[current].classList.remove("active");

    current = (index + slides.length) % slides.length;

    slides[current].classList.add("active");
    dotsContainer.children[current].classList.add("active");

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

