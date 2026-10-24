// Content script for Google Docs. Docs draws text on a canvas, so formatting is
// applied by driving the toolbar controls (font menu, size box, B/I/U buttons,
// text color palette) with simulated mouse and keyboard events.

(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }

  async function waitFor(fn, timeout = 1500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(40);
    }
    return null;
  }

  function simulateClick(el) {
    const r = el.getBoundingClientRect();
    const opts = {
      bubbles: true, cancelable: true, view: window, button: 0,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
    };
    for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(type, opts));
    }
  }

  // Dispatched from page-keys.js in the page's world so Docs sees keyCode.
  function pressKey(el, key, keyCode) {
    if (el && el.setAttribute) el.setAttribute("data-dfp-key-target", "");
    document.dispatchEvent(new CustomEvent("dfp-press-key", { detail: JSON.stringify({ key, keyCode }) }));
  }

  function closeMenus() {
    pressKey(document.activeElement || document.body, "Escape", 27);
  }

  function focusEditor() {
    const iframe = document.querySelector(".docs-texteventtarget-iframe");
    try {
      const doc = iframe && iframe.contentDocument;
      const target = doc && (doc.querySelector("[contenteditable=true]") || doc.body);
      if (target) { target.focus(); return; }
    } catch (_) { /* cross-origin; fall through */ }
    const editor = document.querySelector(".kix-appview-editor");
    if (editor) editor.focus();
  }

  function toHex(color) {
    if (!color) return null;
    color = color.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(color)) return color;
    if (/^#[0-9a-f]{3}$/.test(color)) return "#" + [...color.slice(1)].map(c => c + c).join("");
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return "#" + m.slice(1, 4).map(n => (+n).toString(16).padStart(2, "0")).join("");
  }

  // ---------- individual formatting steps ----------

  async function setFontFamily(name) {
    const btn = document.querySelector("#docs-font-family");
    if (!btn) throw new Error("font menu not found");
    const current = (btn.querySelector(".goog-toolbar-menu-button-caption") || btn).textContent.trim();
    if (norm(current) === norm(name)) return;

    simulateClick(btn);
    const want = norm(name);
    const items = () => [...document.querySelectorAll(".goog-menuitem, .goog-submenu, [role=menuitem]")].filter(isVisible);
    const isSubmenu = el => el.classList.contains("goog-submenu") || el.getAttribute("aria-haspopup") === "true";

    // Fonts with several weights (most fonts added via More fonts) are submenus in
    // Docs. Pick an exact top-level match, or "Family Weight" (e.g. "Oswald Light").
    await waitFor(() => items().length > 0);
    let item = await waitFor(() => items().find(el => norm(menuLabel(el)) === want), 600);
    let weight = null;
    if (!item) {
      item = items()
        .filter(el => { const l = norm(menuLabel(el)); return l && want.startsWith(l + " "); })
        .sort((a, b) => menuLabel(b).length - menuLabel(a).length)[0];
      if (item) weight = compact(want.slice(norm(menuLabel(item)).length));
    }
    if (!item) {
      console.log("[Docs Font Presets] visible menu labels:", items().map(menuLabel));
      closeMenus();
      throw new Error(`font "${name}" isn't in your Docs font list (add it via Font menu > More fonts)`);
    }

    if (!isSubmenu(item) && !weight) {
      simulateClick(item);
      await sleep(80);
      return;
    }

    // Open the weight submenu by hovering the family.
    const parentMenu = item.closest(".goog-menu, [role=menu]") || item.parentElement;
    const r = item.getBoundingClientRect();
    const hover = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    for (const type of ["mouseover", "mouseenter", "mousemove"]) item.dispatchEvent(new MouseEvent(type, hover));
    const subItems = () => items().filter(el => !parentMenu.contains(el));
    const wanted = weight ? [weight] : ["normal", "regular", "400"];
    const weightItem = await waitFor(() => subItems().find(el => wanted.includes(compact(menuLabel(el)))))
      || (!weight && subItems()[0]);
    if (weightItem) {
      simulateClick(weightItem);
      await sleep(80);
      return;
    }
    simulateClick(item); // fall back to clicking the family itself
    await sleep(80);
    if (weight) throw new Error(`applied ${menuLabel(item)}, but couldn't find the "${name.slice(menuLabel(item).length).trim()}" weight`);
  }

  // Menu label text without Closure's submenu arrow ("►") or other decorations.
  function menuLabel(el) {
    const content = (el.querySelector(".goog-menuitem-content") || el).cloneNode(true);
    content.querySelectorAll(".goog-submenu-arrow, [class*='arrow'], [class*='icon'], .goog-menuitem-accel").forEach(n => n.remove());
    return content.textContent.replace(/[\u25b6\u25ba\u25c0\u25c4\u203a\u276f]/g, "").replace(/\s+/g, " ").trim();
  }
  const norm = s => s.replace(/\s+/g, " ").trim().toLowerCase();
  const compact = s => s.toLowerCase().replace(/[\s_-]+/g, "");

  async function setFontSize(size) {
    const input = document.querySelector("#fontSizeSelector input, .docs-font-size-inc-dec-combobox input");
    if (!input) throw new Error("font size box not found");
    if (String(parseFloat(input.value)) === String(size)) return;
    input.focus();
    input.value = String(size);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    pressKey(input, "Enter", 13);
    await sleep(80);
  }

  async function setToggle(buttonId, want, label) {
    const btn = document.querySelector("#" + buttonId);
    if (!btn) throw new Error(label + " button not found");
    const pressed = btn.getAttribute("aria-pressed") === "true" ||
      btn.classList.contains("goog-toolbar-button-checked");
    if (pressed !== !!want) {
      simulateClick(btn);
      await sleep(60);
    }
  }

  function visiblePalette() {
    return [...document.querySelectorAll(".docs-material-colorpalette")].find(isVisible);
  }

  async function setTextColor(hex) {
    hex = toHex(hex);
    if (!hex) throw new Error("invalid color");
    const btn = document.querySelector("#textColorButton");
    if (!btn) throw new Error("text color button not found");
    simulateClick(btn);
    const palette = await waitFor(visiblePalette);
    if (!palette) throw new Error("color palette didn't open");

    // 1) Try a matching swatch in the standard palette.
    const swatches = palette.querySelectorAll(".docs-material-colorpalette-colorswatch");
    for (const sw of swatches) {
      const inner = sw.querySelector(".docs-material-colorpalette-colorswatch-color") || sw;
      const c = toHex(inner.style.backgroundColor) || toHex(getComputedStyle(inner).backgroundColor);
      if (c === hex && isVisible(sw)) {
        simulateClick(sw);
        await sleep(60);
        return;
      }
    }

    // 2) Fall back to the "Custom" color dialog.
    const menu = palette.closest(".goog-menu") || palette.parentElement || document;
    const customBtn = [...menu.querySelectorAll("*")].find(el =>
      isVisible(el) && el.children.length === 0 && /^\s*custom\s*$/i.test(el.textContent)
    ) || [...menu.querySelectorAll("[class*='custom'], [class*='add-button']")].find(isVisible);
    if (!customBtn) {
      closeMenus();
      throw new Error(`color ${hex} isn't in the palette and the Custom button wasn't found`);
    }
    simulateClick(customBtn.closest("[role=button], .goog-flat-button, .goog-inline-block") || customBtn);

    const dialog = await waitFor(() =>
      [...document.querySelectorAll(".modal-dialog, [role=dialog]")].find(d => isVisible(d) && d.querySelector("input"))
    );
    if (!dialog) throw new Error("custom color dialog didn't open");
    const input = [...dialog.querySelectorAll("input")].find(i => /^#?[0-9a-f]{3,6}$/i.test(i.value) || /hex/i.test(i.className))
      || dialog.querySelector("input");
    input.focus();
    input.value = hex;
    for (const t of ["input", "change", "keyup"]) input.dispatchEvent(new Event(t, { bubbles: true }));
    await sleep(80);
    const ok = [...dialog.querySelectorAll("button, [role=button]")].find(b => /^\s*ok\s*$/i.test(b.textContent));
    if (!ok) throw new Error("couldn't find OK in the custom color dialog");
    simulateClick(ok);
    await sleep(80);
  }

  // ---------- toast ----------

  let toastTimer;
  function toast(text, isError) {
    let el = document.getElementById("dfp-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "dfp-toast";
      Object.assign(el.style, {
        position: "fixed", top: "12px", left: "50%", transform: "translateX(-50%)",
        zIndex: 2147483647, padding: "8px 14px", borderRadius: "8px",
        font: "13px/1.4 system-ui, sans-serif", color: "#fff", maxWidth: "70vw",
        boxShadow: "0 4px 14px rgba(0,0,0,.25)", pointerEvents: "none", transition: "opacity .2s"
      });
      document.body.appendChild(el);
    }
    el.style.background = isError ? "#b3261e" : "#202124";
    el.textContent = text;
    el.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = "0"; }, isError ? 5000 : 1500);
  }

  // ---------- apply a whole preset ----------

  let queue = Promise.resolve();

  async function applyPreset(p) {
    const errors = [];
    const step = async (fn, ...args) => {
      try { await fn(...args); } catch (e) { errors.push(e.message); }
    };
    if (p.font) await step(setFontFamily, p.font);
    if (p.size) await step(setFontSize, p.size);
    await step(setToggle, "boldButton", p.bold, "bold");
    await step(setToggle, "italicButton", p.italic, "italic");
    await step(setToggle, "underlineButton", p.underline, "underline");
    if (p.color) await step(setTextColor, p.color);
    focusEditor();

    if (errors.length) toast(`Preset "${p.name}": ${errors.join("; ")}`, true);
    else toast(`Preset: ${p.name}`);
    return { ok: errors.length === 0, error: errors.join("; ") };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "applyPreset") {
      queue = queue.then(() => applyPreset(msg.preset)).then(sendResponse, e => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });
})();
