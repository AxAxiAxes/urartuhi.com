// Keep the historical public entrypoint using the canonical browser widget.
const docentScript = document.createElement("script");
docentScript.src = new URL("../../js/urartuhi-docent.js", document.currentScript.src).href;
docentScript.onerror = () => console.error("Could not load the Urartuhi browser widget.");
document.head.appendChild(docentScript);
