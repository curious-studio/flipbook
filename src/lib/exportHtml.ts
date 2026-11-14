import type { BookPage } from '../types'

export function buildStandaloneHtml(title: string, pages: BookPage[]): string {
  const pageImgs = pages.map((p) => p.dataUrl)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: radial-gradient(circle at 40% 40%, #1a1a2e, #0b0b14);
    color: #eee; font-family: system-ui, sans-serif; overflow: hidden;
  }
  .book-wrap { display: grid; place-items: center; gap: 16px; }
  .book {
    position: relative; width: min(90vw, 900px); aspect-ratio: 2 / 1.35;
    perspective: 2000px;
  }
  .page {
    position: absolute; top: 0; width: 50%; height: 100%; transform-style: preserve-3d;
    transform-origin: left center; transition: transform 0.7s cubic-bezier(.645,.045,.355,1);
  }
  .page.right { left: 50%; transform-origin: right center; }
  .page .face {
    position: absolute; inset: 0; backface-visibility: hidden;
    background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.4);
  }
  .page .face.back { transform: rotateY(180deg); }
  .page .face img { width: 100%; height: 100%; object-fit: contain; display: block; background: #fff; }
  .page.flipped { transform: rotateY(-180deg); }
  .page.right.flipped { transform: rotateY(180deg); }
  .spine-shadow {
    position: absolute; top: 0; bottom: 0; width: 40px; pointer-events: none; z-index: 5;
  }
  .spine-shadow.left { left: 50%; background: linear-gradient(to right, rgba(0,0,0,0.35), transparent); }
  .spine-shadow.right { right: 50%; background: linear-gradient(to left, rgba(0,0,0,0.35), transparent); }
  .controls { display: flex; gap: 12px; align-items: center; }
  button { padding: 8px 16px; border: 1px solid #444; background: #2b2b2b; color: #eee; border-radius: 6px; cursor: pointer; }
  button:hover { background: #3a3a3a; }
  .counter { font-variant-numeric: tabular-nums; color: #aaa; }
  .hint { font-size: 12px; color: #666; }
</style>
</head>
<body>
<div class="book-wrap">
  <div class="book" id="book"></div>
  <div class="controls">
    <button id="prev">◀ Prev</button>
    <span class="counter" id="counter"></span>
    <button id="next">Next ▶</button>
  </div>
  <div class="hint">Click left/right half or use arrow keys to turn pages</div>
</div>
<script>
const pages = ${JSON.stringify(pageImgs)};
const book = document.getElementById('book');
let current = 0; // index of first visible right page (0-based spread)
// Build page elements: each "page" is a single sheet containing front+back
const sheets = [];
for (let i = 0; i < pages.length; i += 2) {
  const sheet = document.createElement('div');
  sheet.className = 'page' + (i === 0 ? '' : ' right');
  // front = pages[i], back = pages[i+1] (or blank)
  const front = document.createElement('div'); front.className='face';
  const fi = document.createElement('img'); fi.src = pages[i] || ''; front.appendChild(fi);
  const back = document.createElement('div'); back.className='face back';
  const bi = document.createElement('img'); bi.src = pages[i+1] || ''; back.appendChild(bi);
  sheet.appendChild(front); sheet.appendChild(back);
  book.appendChild(sheet);
  sheets.push(sheet);
}
// spine shadows
const sl = document.createElement('div'); sl.className='spine-shadow left'; book.appendChild(sl);
const sr = document.createElement('div'); sr.className='spine-shadow right'; book.appendChild(sr);

function render() {
  sheets.forEach((s, idx) => {
    // a sheet is flipped if its index < current sheet index
    const sheetIndex = idx;
    const currentSheet = Math.floor(current / 2);
    if (sheetIndex < currentSheet) s.classList.add('flipped');
    else s.classList.remove('flipped');
    s.style.zIndex = sheets.length - sheetIndex;
  });
  const total = pages.length;
  const shown = Math.min(current + 1, total);
  document.getElementById('counter').textContent = shown + ' / ' + total;
}
function next() {
  if (current + 2 < pages.length) { current += 2; render(); }
  else if (current + 1 < pages.length) { current = pages.length; render(); }
}
function prev() {
  if (current > 0) { current -= 2; if (current < 0) current = 0; render(); }
}
document.getElementById('next').addEventListener('click', next);
document.getElementById('prev').addEventListener('click', prev);
book.addEventListener('click', (e) => {
  const rect = book.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (x > rect.width / 2) next(); else prev();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ') next();
  if (e.key === 'ArrowLeft') prev();
});
render();
</script>
</body>
</html>`
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}