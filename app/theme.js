// Light and dark mode. Dark is the default. Printing always uses the light version.

const root = document.documentElement;
const KEY = "econlens-mode";
let printMode = null;

export function initMode() {
  window.addEventListener("beforeprint", () => {
    printMode = root.getAttribute("data-mode");
    root.setAttribute("data-mode", "light");
  });
  window.addEventListener("afterprint", () => {
    if (printMode) root.setAttribute("data-mode", printMode);
    printMode = null;
  });
}

export function toggleMode() {
  const next = root.getAttribute("data-mode") === "dark" ? "light" : "dark";
  root.setAttribute("data-mode", next);
  try { localStorage.setItem(KEY, next); } catch (e) { /* not saved, still switches for this visit */ }
}
