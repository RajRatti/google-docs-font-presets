# Docs Font Presets (Chrome extension)

Save formatting presets (font, size, color, bold, italic, underline) and switch
between them while typing in Google Docs.

## Install (unpacked)
1. Unzip `docs-font-presets.zip` somewhere you'll keep it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped `docs-font-presets` folder.
4. Pin the extension (puzzle icon > pin), then **reload any open Google Docs tabs**.

## Use
- Put your cursor in a doc, then click a preset in the popup, or press a shortcut:
  - `Alt+Shift+1/2/3` apply presets 1 to 3 (list order; use the arrow to reorder)
  - `Alt+Shift+N` cycles to the next preset
  - Presets 4 to 9 have no default key; set them at `chrome://extensions/shortcuts`
- `+ New`, the pencil and the X create, edit and delete presets. Presets sync via your Chrome profile.
- A small banner at the top of the doc confirms the preset, or says which part failed.

## Limitations
- Google Docs has no public API for this, so the extension clicks Docs' own toolbar.
  If Google changes the toolbar, parts can stop working until the selectors are updated.
- The font must already be in your Docs font menu. Add others once via Font > More fonts.
  For a specific weight, write it after the family, e.g. `Oswald Light` or `Roboto Medium`.
- Colors that aren't palette swatches go through Docs' Custom color dialog, which is
  the most fragile step.
- The toolbar must be visible (not hidden with Ctrl+Shift+F / compact mode).
- It sets formatting at the cursor (for what you type next) or on the current selection.
- Docs reserves some keys (e.g. Ctrl+Alt+digits for headings); pick shortcuts that don't clash.
