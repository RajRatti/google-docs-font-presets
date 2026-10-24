// Shared preset storage helpers (used by popup and background).
const DEFAULT_PRESETS = [
  { id: "p1", name: "Body", font: "Arial", size: 11, color: "#000000", bold: false, italic: false, underline: false },
  { id: "p2", name: "Emphasis", font: "Georgia", size: 12, color: "#1155cc", bold: false, italic: true, underline: false },
  { id: "p3", name: "Heading-ish", font: "Roboto", size: 16, color: "#cc0000", bold: true, italic: false, underline: false }
];

async function getPresets() {
  const { presets } = await chrome.storage.sync.get("presets");
  if (!Array.isArray(presets)) {
    await chrome.storage.sync.set({ presets: DEFAULT_PRESETS });
    return DEFAULT_PRESETS.slice();
  }
  return presets;
}

async function savePresets(presets) {
  await chrome.storage.sync.set({ presets });
}

async function getActiveId() {
  const { activeId } = await chrome.storage.local.get("activeId");
  return activeId || null;
}

async function setActiveId(activeId) {
  await chrome.storage.local.set({ activeId });
}

// Sends a preset to the content script in the given tab. Returns {ok, error}.
async function sendPresetToTab(tabId, preset) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "applyPreset", preset });
    if (res && res.ok !== false) await setActiveId(preset.id);
    return res || { ok: true };
  } catch (e) {
    return { ok: false, error: "Open a Google Doc (and reload it once after installing the extension)." };
  }
}
