import type { BookPage } from '../types'
import { getSpreads } from './layout.ts'

export function buildStandaloneHtml(title: string, pages: BookPage[]): string {
  if (!pages.length) throw new Error('No pages to export.')
  const data = JSON.stringify(pages.map(({ dataUrl, width, height }) => ({ dataUrl, width, height }))).replace(/</g, '\\u003c')
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
:root{--accent:#e6bc32;--accent-soft:#f8efcd}*{box-sizing:border-box}body{margin:0;background:#eeeeee;color:#333333;font:14px system-ui,sans-serif;min-height:100svh}header{padding:18px 24px;background:#f7f7f7;border-bottom:1px solid #d2d2d2}h1{font:24px Georgia,serif;margin:0}main{padding:20px}#stage{height:calc(100svh - 190px);min-height:220px;overflow:auto;display:grid;background:#bcbcbc;border-radius:10px}#canvas{position:relative;display:flex;align-items:center;justify-content:center;margin:auto;padding:20px}.page{position:relative;background:white;flex-shrink:0;box-shadow:0 4px 20px #30303015}.page img{display:block;width:100%;height:100%;object-fit:contain}.blank{visibility:hidden}.controls{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:16px 0}button,select{font:inherit;color:inherit;background:#f7f7f7;border:1px solid #bcbcbc;border-radius:0;padding:8px 12px}button{cursor:pointer}button:disabled{opacity:.4;cursor:default}:focus-visible{outline:3px solid var(--accent);outline-offset:3px}#counter{min-width:130px;text-align:center;font-variant-numeric:tabular-nums}.hint{text-align:center;font-size:11px;color:#666666;margin:0} @media(max-width:600px){main{padding:10px}#stage{height:calc(100svh - 230px)}}
.gutter-left::after,.gutter-right::after{content:'';position:absolute;top:0;bottom:0;z-index:2;pointer-events:none}.gutter-left::after{right:0;width:12%;max-width:64px;background:linear-gradient(to right,transparent,rgb(0 0 0 / 2%) 25%,rgb(0 0 0 / 8%) 65%,rgb(0 0 0 / 16%) 96%,rgb(0 0 0 / 22%))}.gutter-right::after{left:0;width:4.5%;max-width:24px;background:linear-gradient(to right,rgb(0 0 0 / 28%),rgb(0 0 0 / 18%) 5%,rgb(0 0 0 / 8%) 30%,rgb(0 0 0 / 2%) 65%,transparent)}
#canvas.has-fold-seam::after{content:'';position:absolute;top:20px;bottom:20px;left:50%;width:3px;transform:translateX(-50%);background:linear-gradient(to right,transparent,rgb(0 0 0 / 9%) 35%,rgb(0 0 0 / 16%) 50%,rgb(0 0 0 / 9%) 65%,transparent);z-index:3;pointer-events:none}
#edit-title{font:inherit;color:inherit;background:transparent;border:0;border-bottom:1px dotted transparent;padding:0;text-align:left;cursor:text;max-width:100%;overflow-wrap:anywhere}#edit-title:hover{border-bottom-color:var(--accent)}#title-editor{font:inherit;color:inherit;background:#f7f7f7;border:1px solid #aaa;border-radius:0;padding:3px 6px;width:min(100%,600px)}
button:hover:not(:disabled),select:hover,input:hover{border-color:var(--accent)}input:focus,select:focus{border-color:var(--accent)}select:focus{background:var(--accent-soft)}::selection{background:var(--accent-soft);color:#333}
button,input,select{transition:border-color .25s ease,background-color .25s ease,box-shadow .25s ease,color .25s ease}@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}
</style></head><body><header><h1 class="preview-title"><button id="edit-title" title="Click to edit title" aria-label="Edit book title">${escapeHtml(title)}</button><input id="title-editor" aria-label="Edit book title" maxlength="200" hidden /></h1></header><main><div id="stage" tabindex="0" aria-label="Document preview"><div id="canvas"></div></div><div class="controls"><button id="prev" aria-label="Previous page or spread">← Previous</button><span id="counter" aria-live="polite"></span><button id="next" aria-label="Next page or spread">Next →</button><select id="mode" aria-label="Reading mode"><option value="spread">Spread view</option><option value="single">Single page</option></select><button id="fit">Fit</button><button id="minus" aria-label="Zoom out">−</button><button id="plus" aria-label="Zoom in">+</button></div><p class="hint">Use arrow keys to navigate. Single-page view preserves each page’s proportions.</p></main><script>
const pages=${data};
const spreads=${JSON.stringify(getSpreads(pages.length))};
const stage=document.getElementById('stage'), canvas=document.getElementById('canvas'), mode=document.getElementById('mode');
const titleButton=document.getElementById('edit-title'), titleEditor=document.getElementById('title-editor');
let editingTitle=false;
titleButton.onclick=()=>{editingTitle=true;titleEditor.value=titleButton.textContent;titleButton.hidden=true;titleEditor.hidden=false;titleEditor.focus();titleEditor.select()};
function finishTitle(cancel=false){if(!editingTitle)return;editingTitle=false;if(!cancel){const next=titleEditor.value.trim()||titleButton.textContent;titleButton.textContent=next;document.title=next}titleEditor.hidden=true;titleButton.hidden=false}
titleEditor.onblur=()=>finishTitle();
titleEditor.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();e.stopPropagation();finishTitle(e.key==='Escape');titleButton.focus()}};
let current=0,zoom=1;
if(pages.some(p=>Math.abs(p.width/p.height-pages[0].width/pages[0].height)>.01)) mode.value='single';
function isSingle(){return mode.value==='single'||stage.clientWidth<620}
function spreadIndex(){return Math.max(0,spreads.findIndex(s=>s.includes(current)))}
function render(){
 const single=isSingle(), indices=single?[current]:spreads[spreadIndex()], source=pages[single?current:0];
 const scale=Math.min(Math.max(1,stage.clientWidth-40)/((single?1:2)*source.width),Math.max(1,stage.clientHeight-40)/source.height)*zoom;
 canvas.replaceChildren();
 canvas.className=!single&&indices.length===2?'has-fold-seam':'';
 function add(index){const frame=document.createElement('div');frame.className='page'+(index==null?' blank':!single&&indices.length===2?(index===indices[0]?' gutter-left':' gutter-right'):'');frame.style.width=source.width*scale+'px';frame.style.height=source.height*scale+'px';if(index!=null){const img=document.createElement('img');img.src=pages[index].dataUrl;img.alt='Page '+(index+1);frame.appendChild(img)}canvas.appendChild(frame)}
 if(!single&&indices[0]===0)add(null);
 indices.forEach(add);
 if(!single&&indices.length===1&&indices[0]!==0)add(null);
 document.getElementById('counter').textContent=(indices.length===1?'Page '+(indices[0]+1):'Pages '+(indices[0]+1)+'–'+(indices[1]+1))+' of '+pages.length;
 document.getElementById('prev').disabled=single?current===0:spreadIndex()===0;
 document.getElementById('next').disabled=single?current===pages.length-1:spreadIndex()===spreads.length-1;
 document.getElementById('minus').disabled=zoom<=.5;document.getElementById('plus').disabled=zoom>=3;
 document.getElementById('fit').textContent=zoom===1?'Fit':Math.round(zoom*100)+'%';
}
function move(direction){if(isSingle())current=Math.min(pages.length-1,Math.max(0,current+direction));else current=spreads[Math.min(spreads.length-1,Math.max(0,spreadIndex()+direction))][0];render()}
document.getElementById('prev').onclick=()=>move(-1);document.getElementById('next').onclick=()=>move(1);
mode.onchange=()=>{zoom=1;render()};document.getElementById('fit').onclick=()=>{zoom=1;render()};document.getElementById('minus').onclick=()=>{zoom=Math.max(.5,zoom-.25);render()};document.getElementById('plus').onclick=()=>{zoom=Math.min(3,zoom+.25);render()};
window.addEventListener('keydown',e=>{if(e.altKey||e.metaKey||e.ctrlKey)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();move(e.key==='ArrowRight'?1:-1)}},true);
new ResizeObserver(render).observe(stage);render();
</script></body></html>`
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
