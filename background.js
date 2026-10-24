importScripts("storage.js");

chrome.runtime.onInstalled.addListener(() => { getPresets(); });

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab || !tab.url || !tab.url.startsWith("https://docs.google.com/document/")) return;
  const presets = await getPresets();
  if (!presets.length) return;

  let preset;
  if (command === "next-preset") {
    const activeId = await getActiveId();
    const idx = presets.findIndex(p => p.id === activeId);
    preset = presets[(idx + 1) % presets.length];
  } else {
    const n = parseInt(command.replace("preset-", ""), 10);
    preset = presets[n - 1];
  }
  if (preset) await sendPresetToTab(tab.id, preset);
});
