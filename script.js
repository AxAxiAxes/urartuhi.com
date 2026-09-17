(function () {
  "use strict";

  const slides = Array.from(document.querySelectorAll(".slide"));
  const dotsContainer = document.getElementById("dots");
  const grid = document.getElementById("grid");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const yearSpan = document.getElementById("year");

  const AUTO_ADVANCE_MS = 5000;
  let current = 0;
  let timer = null;
  let playing = true;

  function buildDots() {
    slides.forEach((slide, index) => {
      const dot = document.createElement("button");
      dot.className = "dot" + (index === 0 ? " active" : "");
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", `Go to slide ${index + 1}`);
      dot.addEventListener("click", () => goTo(index, true));
      dotsContainer.appendChild(dot);
    });
  }

  function buildGrid() {
    slides.forEach((slide, index) => {
      const artwork = slide.querySelector(".artwork");
      const title = slide.querySelector(".title").textContent;
      const thumb = document.createElement("button");
      thumb.className = "thumb " + artwork.className.replace("artwork", "").trim();
      thumb.classList.add(...Array.from(artwork.classList));
      thumb.setAttribute("aria-label", `View ${title} in slideshow`);
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
    if (playing) {
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

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", () => goTo(current + 1, true));
  playPauseBtn.addEventListener("click", togglePlayPause);

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") prev();
    if (event.key === "ArrowRight") goTo(current + 1, true);
  });

  buildDots();
  buildGrid();
  startTimer();

  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
})();
