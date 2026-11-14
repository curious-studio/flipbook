# Flipbook

A browser-only PDF and image reader with animated spreads, a native-proportions
single-page view, a local book library, and offline exports.

## Reading and organizing

- Import one or more PDFs and images in selection order.
- Portrait, landscape, and square documents retain their aspect ratios.
- Mixed-size documents open in single-page mode; spread mode fits each image
  inside the first page's proportions without cropping or stretching.
- A front cover is shown alone, followed by pages 2–3, 4–5, and so on.
- Use arrow keys, page jump, thumbnails, zoom, fit, and fullscreen controls.
- Narrow windows automatically use single-page mode.
- Drag thumbnails to reorder, or focus a thumbnail and use Alt + arrow keys.
- Save books in this browser's IndexedDB. Unsaved changes are marked and
  protected by discard prompts; the latest library deletion can be undone
  until another deletion or page reload.

## Export

- **Offline HTML viewer:** embeds all images; supports single/spread layouts,
  keyboard navigation, fit, and zoom, with no network dependency.
- **PDF spreads:** rasterized spreads with a separate front cover and page
  pairing matching the preview. Mixed-size images fit the common page frame.
- **ZIP:** individual page images in reading order.

PDFs are rasterized during import, so text selection, original vector quality,
PDF links, and searchable text are not preserved in these exports. Large books
still use memory proportional to their rendered image data. Local saves are
specific to the browser/device and are not cloud backups.

## Development

Requires Node.js 22.18+ (or Node.js 24+) for the TypeScript regression tests.

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

Open http://localhost:5173/flipbook/. Tests cover sizing, cover-first pagination,
offline-reader navigation and responsive layout logic, and PDF export geometry.
Browser-level visual checks should also cover document switching, resizing,
local-save recovery, and thumbnail navigation.

## Deploy to GitHub Pages

1. Use a GitHub repo named `flipbook`, or update `base` in `vite.config.ts`.
2. Push `main`.
3. Set repository Pages → Source to GitHub Actions.
4. `.github/workflows/deploy.yml` builds and deploys the app.

The root `design/` folder contains local-only references and is ignored by Git.

## Fonts

Fira Sans is self-hosted from `public/fonts/` with the SIL Open Font License
in `public/fonts/OFL.txt`. The WOFF2 files come from Google Fonts (Fira Sans v18),
with weights 300, 400, 500, 600, and 700 and all provided language subsets.
Source: https://fonts.google.com/specimen/Fira+Sans

The app makes no Google Fonts requests at runtime. Offline HTML exports embed
the font files and license so they do not need a network connection.
