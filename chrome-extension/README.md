# Arcon Aturian Assist

Chrome extension starter for moving data from The Arc into Aturian without submitting records automatically.

## Install locally

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this folder: `chrome-extension`.

## First workflow

1. Open a customer or supplier detail page in The Arc.
2. Click Aturian Assist.
3. Open the matching create/edit page in Aturian.
4. Click the extension icon.
5. Click Fill current Aturian page.
6. Review the highlighted fields in Aturian, then save manually if everything is correct.

## Calibrating Aturian fields

The starter field selectors live in `scripts/aturian-fill.js`.

Once you know the real Aturian field names, ids, or labels, update the `FIELD_MAPS` selectors. The extension intentionally uses `activeTab` + `scripting` so it only injects the autofill script after the user clicks the extension on the current Aturian page.

## Safety boundaries

- The extension does not click Save, Create, Submit, or Update.
- The extension stores only the last exported payload in local Chrome extension storage.
- The Arc also copies the payload JSON to the clipboard as a debugging fallback.
