# Sidebar test checklist

Use this to confirm the COCAD sidebar works on Onshape.

## Build

```bash
cd extension
npm run build
```

## Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the **`extension/dist`** folder

## Test on Onshape

1. Go to **https://cad.onshape.com**
2. Sign in and **open or create a document** (URL must contain `/documents/`)
3. Within a few seconds you should see:
   - **COCAD sidebar** on the right (dark panel, Onshape-style)
   - **Onshape viewport** shifted left (not covered by the sidebar)
4. In the sidebar:
   - Type or click an example (e.g. "Create a 100mm x 50mm x 30mm box")
   - If the backend is running: plan appears, then you can click "Generate in Onshape"
   - If not: you should see an error (e.g. "Failed to fetch") — expected without backend
5. **Collapse**: click the **»** button in the sidebar header, or click the COCAD extension icon — sidebar hides and Onshape gets full width
6. **Expand**: click the COCAD extension icon again — sidebar reappears

## What to check

- [ ] Sidebar appears on document pages only (not on onshape.com marketing pages)
- [ ] Sidebar uses Onshape-like dark theme (#252526, #3c3c3c, #0066cc)
- [ ] Body has right margin when sidebar is visible; margin goes away when collapsed
- [ ] Toggle (» or extension icon) shows/hides the sidebar
- [ ] Chat input and example buttons work
- [ ] No console errors on the Onshape page (F12 → Console)

## If the sidebar doesn’t appear

- Confirm the URL is `cad.onshape.com` and path includes `/documents/`
- Reload the Onshape tab (F5)
- In `chrome://extensions/`, click **Reload** on COCAD
- Check the Console (F12) for `[COCAD]` messages
