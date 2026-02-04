# COCAD - AI CAD Assistant for Onshape

A Chrome extension that generates parametric CAD models in Onshape using natural language. Describe what you want, and the AI creates it by automating Onshape's UI.

## Features

- **Natural Language Input**: Describe parts like "Create a 100mm x 50mm x 30mm box"
- **Parametric Models**: All dimensions stored in Variable Studio for easy editing
- **Visual Automation**: Watch as the extension clicks buttons and fills inputs
- **Full Feature Tree**: Proper sketch → extrude workflow with edit history

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Content Script │ Background      │ Sidebar UI (React)      │
│  (DOM Auto)     │ Worker          │ - Chat input            │
│  - Click        │ - API calls     │ - Plan review           │
│  - Fill inputs  │ - Messaging     │ - Progress view         │
└────────┬────────┴────────┬────────┴────────────┬────────────┘
         │                 │                      │
         │    ┌────────────▼────────────┐        │
         │    │      Backend Server      │        │
         │    │  - Express + TypeScript  │        │
         │    │  - Groq (Llama)  │        │
         │    │  - Plan generation       │        │
         │    │  - Action sequences      │        │
         │    └──────────────────────────┘        │
         │                                        │
         ▼                                        │
┌─────────────────────────────────────────────────▼───────────┐
│                     Onshape Web App                          │
│  - Variable Studio    - Sketch tools    - Feature dialogs   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Commands to run (copy-paste)

**Terminal 1 – backend:**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env and add GROQ_API_KEY
npm run dev
```

**Terminal 2 – extension (build once):**
```bash
cd extension
npm install
npm run build
```

**Chrome:** `chrome://extensions/` → Developer mode → Load unpacked → select `extension/dist`.

**Use:** Open https://cad.onshape.com (a document), open the COCAD sidebar, describe your part, and run the flow.

---

### Prerequisites

- Node.js 18+
- Chrome browser
- Groq API key ([get one here](https://console.groq.com/))

### 1. Setup Backend

```bash
cd backend
npm install

# Create .env file with your API key
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Start development server
npm run dev
```

Backend runs at `http://localhost:3001`

### 2. Build Extension

```bash
cd extension
npm install
npm run build
```

### 3. Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/dist` folder

### 4. Use It

1. Open an Onshape document: https://cad.onshape.com
2. The COCAD sidebar appears on the right
3. Type what you want: "Create a 100mm cube"
4. Review the plan and click "Generate"
5. Watch the magic happen!

## Project Structure

```
COCAD/
├── extension/              # Chrome Extension (Manifest V3)
│   ├── src/
│   │   ├── automation/     # DOM automation (click, wait, execute)
│   │   ├── background/     # Service worker
│   │   ├── content/        # Injected into Onshape
│   │   ├── sidebar/        # React UI components
│   │   └── types/          # TypeScript types
│   └── manifest.json
│
├── backend/                # AI Backend Server
│   └── src/
│       ├── routes/         # API endpoints
│       ├── services/       # Claude AI integration
│       └── server.ts       # Express server
│
└── README.md
```

## API Endpoints

### POST /api/plan
Generate a planning document from natural language.

```json
// Request
{ "description": "Create a 100mm x 50mm x 30mm box" }

// Response
{
  "success": true,
  "plan": {
    "designIntent": "A simple rectangular box",
    "keyDimensions": [
      { "name": "box_length", "value": 100, "unit": "mm", "purpose": "..." }
    ],
    ...
  }
}
```

### POST /api/actions
Generate UI action sequence from a plan.

```json
// Request
{ "plan": { ... } }

// Response
{
  "success": true,
  "actions": [
    { "type": "CLICK_TAB", "tab": "Variable Studio" },
    { "type": "CREATE_VARIABLE", "name": "box_length", "value": "100", "unit": "mm" },
    ...
  ]
}
```

## Supported Parts (MVP)

- **Box**: Any rectangular prism with length, width, height
- **Cylinder**: Circle extruded to a height

More shapes coming soon: brackets, plates, parts with holes, fillets, etc.

## Development

### Extension (hot reload)
```bash
cd extension
npm run dev
```
Then reload the extension in Chrome after changes.

### Backend
```bash
cd backend
npm run dev
```
Auto-restarts on file changes.

### Testing Selectors

Open Onshape, then in browser console:
```javascript
// Find all buttons
document.querySelectorAll('button').forEach(b => 
  console.log(b.getAttribute('aria-label'), b.textContent)
);
```

## Troubleshooting

### "Failed to generate plan"
- Check that backend is running on port 3001
- Verify GROQ_API_KEY is set in `.env`

### Extension not appearing in Onshape
- Make sure you're on a document page (URL contains `/documents/`)
- Check Chrome extension errors in `chrome://extensions/`
- Look for errors in browser console (F12)

### Automation clicking wrong elements
- Onshape's UI may have changed - update selectors in `selectors.ts`
- Run `debugLogButtons()` in console to find correct selectors

## License

MIT

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Test with Onshape
5. Submit a PR
