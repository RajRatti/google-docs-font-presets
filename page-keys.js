// Runs in the page's own JS world. Keyboard events built in the content script's
// isolated world can't carry keyCode to Docs' handlers, so the content script asks
// this script to dispatch them instead.
document.addEventListener("dfp-press-key", e => {
  const { key, keyCode } = JSON.parse(e.detail);
  const el = document.querySelector("[data-dfp-key-target]") || document.activeElement || document.body;
  el.removeAttribute("data-dfp-key-target");
  for (const type of ["keydown", "keypress", "keyup"]) {
    const ev = new KeyboardEvent(type, { key, code: key, bubbles: true, cancelable: true });
    Object.defineProperty(ev, "keyCode", { get: () => keyCode });
    Object.defineProperty(ev, "which", { get: () => keyCode });
    el.dispatchEvent(ev);
  }
});
