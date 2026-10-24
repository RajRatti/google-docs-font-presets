const listEl = document.getElementById("list");
const form = document.getElementById("editor");
const statusEl = document.getElementById("status");
let presets = [];
let editingId = null;
let shortcutByIndex = {};

function showStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.className = isError ? "error" : "";
  statusEl.hidden = !text;
}

async function loadShortcuts() {
  const cmds = await chrome.commands.getAll();
  shortcutByIndex = {};
  for (const c of cmds) {
    const m = c.name.match(/^preset-(\d)$/);
    if (m && c.shortcut) shortcutByIndex[+m[1] - 1] = c.shortcut;
  }
}

async function render() {
  const activeId = await getActiveId();
  listEl.textContent = "";
  presets.forEach((p, i) => {
    const li = document.createElement("li");
    if (p.id === activeId) li.classList.add("active");

    const key = document.createElement("span");
    key.className = "key";
    key.textContent = shortcutByIndex[i] || "";
    key.title = shortcutByIndex[i] || "No shortcut assigned";

    const prev = document.createElement("div");
    prev.className = "preview";
    prev.title = "Apply to the current Google Doc";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = p.name;
    name.style.fontFamily = `"${p.font}", sans-serif`;
    name.style.color = p.color;
    name.style.fontWeight = p.bold ? "700" : "400";
    name.style.fontStyle = p.italic ? "italic" : "normal";
    name.style.textDecoration = p.underline ? "underline" : "none";
    const meta = document.createElement("span");
    meta.className = "meta";
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = p.color;
    meta.append(sw, ` ${p.font || "(any font)"} · ${p.size || "–"}pt`);
    prev.append(name, meta);
    prev.addEventListener("click", () => apply(p));

    const up = button("↑", "Move up", () => move(i, -1));
    up.disabled = i === 0;
    const edit = button("✎", "Edit", () => openEditor(p));
    const del = button("✕", "Delete", () => remove(p));

    li.append(key, prev, up, edit, del);
    listEl.appendChild(li);
  });
  if (!presets.length) {
    const li = document.createElement("li");
    li.textContent = "No presets yet. Click + New.";
    listEl.appendChild(li);
  }
}

function button(text, title, onClick) {
  const b = document.createElement("button");
  b.className = "icon";
  b.textContent = text;
  b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

async function apply(p) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith("https://docs.google.com/document/")) {
    showStatus("Open a Google Doc in this tab first.", true);
    return;
  }
  showStatus(`Applying "${p.name}"…`);
  const res = await sendPresetToTab(tab.id, p);
  if (res.ok === false) showStatus(res.error, true);
  else { showStatus(""); window.close(); }
}

async function move(i, dir) {
  const j = i + dir;
  [presets[i], presets[j]] = [presets[j], presets[i]];
  await savePresets(presets);
  render();
}

async function remove(p) {
  if (!confirm(`Delete preset "${p.name}"?`)) return;
  presets = presets.filter(x => x.id !== p.id);
  await savePresets(presets);
  render();
}

function openEditor(p) {
  editingId = p ? p.id : null;
  document.getElementById("editor-title").textContent = p ? "Edit preset" : "New preset";
  form.name.value = p ? p.name : "";
  form.font.value = p ? p.font : "Arial";
  form.size.value = p ? p.size : 11;
  form.color.value = p ? p.color : "#000000";
  form.bold.checked = !!(p && p.bold);
  form.italic.checked = !!(p && p.italic);
  form.underline.checked = !!(p && p.underline);
  form.hidden = false;
  form.name.focus();
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const data = {
    id: editingId || "p" + Date.now(),
    name: form.name.value.trim(),
    font: form.font.value.trim(),
    size: form.size.value ? parseFloat(form.size.value) : null,
    color: form.color.value,
    bold: form.bold.checked,
    italic: form.italic.checked,
    underline: form.underline.checked
  };
  const idx = presets.findIndex(p => p.id === data.id);
  if (idx >= 0) presets[idx] = data; else presets.push(data);
  await savePresets(presets);
  form.hidden = true;
  render();
});

document.getElementById("cancel").addEventListener("click", () => { form.hidden = true; });
document.getElementById("add").addEventListener("click", () => openEditor(null));
document.getElementById("shortcuts").addEventListener("click", e => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

(async () => {
  presets = await getPresets();
  await loadShortcuts();
  render();
})();
