# Flipbook Generator

Upload a PDF or a series of images and generate an interactive book preview
with realistic page-turning. Everything runs in the browser — no server needed,
so it deploys cleanly to GitHub Pages.

## Features

- Upload PDF (rendered via pdf.js) or multiple images
- 3D page-flip viewer with shadows, drag/swipe, keyboard nav
- Save books locally (IndexedDB) — survives refresh
- Export as standalone HTML (offline viewer with embedded images)
- Export as multipage PDF (two-page spreads with spine & edge shadows)
- Export pages as a ZIP of images
- GitHub Pages deploy workflow included

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173/flipbook/

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Create a GitHub repo named `flipbook` (or update `base` in `vite.config.ts` to match).
2. Push `main`.
3. In repo settings → Pages → Source: GitHub Actions.
4. The workflow in `.github/workflows/deploy.yml` builds and deploys automatically.

## Notes

- Large PDFs are rasterized client-side; memory use scales with page count and DPI.
- Standalone HTML export inlines images as base64 (file size ~1.33× the images).