import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { fitPage, getSpreads, getSpreadIndex } from '../src/lib/layout.ts'
import { buildStandaloneHtml } from '../src/lib/exportHtml.ts'
import { exportSpreadPdf } from '../src/lib/exportPdf.ts'

const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC'
const makePages = (dimensions) => dimensions.map(([width, height], i) => ({ id: String(i), width, height, dataUrl: pixel }))

test('portrait, landscape, square and narrow pages retain their ratio and fit the available spread', () => {
  for (const [width, height] of [[595,842],[842,595],[600,600],[200,1000]]) {
    for (const [availableWidth, availableHeight] of [[1000,600],[320,500],[700,240]]) {
      for (const slots of [1,2]) {
        const result = fitPage(width,height,availableWidth,availableHeight,slots)
        assert.ok(Math.abs(result.width/result.height-width/height)<1e-10)
        assert.ok(result.width*slots <= availableWidth+1e-8)
        assert.ok(result.height <= availableHeight+1e-8)
      }
    }
  }
})

test('cover-first pagination includes each page once for odd, even, single and empty books', () => {
  for (let count=0; count<10; count++) {
    const spreads=getSpreads(count)
    assert.deepEqual(spreads.flat(),Array.from({length:count},(_,i)=>i))
    if(count) assert.deepEqual(spreads[0],[0])
  }
  assert.deepEqual(getSpreads(4),[[0],[1,2],[3]])
  assert.deepEqual(getSpreads(5),[[0],[1,2],[3,4]])
  assert.equal(getSpreadIndex(1,5),1)
  assert.equal(getSpreadIndex(2,5),1)
  assert.equal(getSpreadIndex(3,5),2)
})

function offlineReader(pages) {
  const html=buildStandaloneHtml('Test book',pages)
  const elements = new Map()
  const element = () => ({ style:{},children:[],className:'',value:'spread',clientWidth:1000,clientHeight:600,appendChild(child){this.children.push(child)},replaceChildren(){this.children=[]} })
  for(const id of ['stage','canvas','mode','counter','prev','next','fit','minus','plus']) elements.set(id,element())
  const context={document:{getElementById:id=>elements.get(id),createElement:element},window:{addEventListener(){}},ResizeObserver:class {observe(){}}}
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context)
  return elements
}

test('offline HTML displays cover, interior pairs and final page, and can navigate backward', () => {
  const reader=offlineReader(makePages(Array.from({length:4},()=>[595,842])))
  assert.equal(reader.get('counter').textContent,'Page 1 of 4')
  assert.equal(reader.get('prev').disabled,true)
  reader.get('next').onclick()
  assert.equal(reader.get('counter').textContent,'Pages 2–3 of 4')
  reader.get('next').onclick()
  assert.equal(reader.get('counter').textContent,'Page 4 of 4')
  assert.equal(reader.get('next').disabled,true)
  reader.get('prev').onclick()
  assert.equal(reader.get('counter').textContent,'Pages 2–3 of 4')
})

test('mixed-size HTML defaults to single pages and changes page proportions on navigation', () => {
  const reader=offlineReader(makePages([[595,842],[842,595],[600,600]]))
  assert.equal(reader.get('mode').value,'single')
  for(const ratio of [595/842,842/595,1]) {
    const page=reader.get('canvas').children[0]
    assert.ok(Math.abs(parseFloat(page.style.width)/parseFloat(page.style.height)-ratio)<1e-8)
    reader.get('next').onclick()
  }
})

test('HTML switches to a single-page layout in narrow containers', () => {
  const reader=offlineReader(makePages([[595,842],[595,842]]))
  reader.get('stage').clientWidth=360
  reader.get('fit').onclick()
  assert.equal(reader.get('canvas').children.length,1)
  assert.ok(parseFloat(reader.get('canvas').children[0].style.width)<=320)
})

test('exported titles and script data cannot terminate their HTML contexts', () => {
  const html=buildStandaloneHtml('</title><script>alert(1)</script>',makePages([[600,600]]))
  assert.ok(html.includes('&lt;/title&gt;'))
  assert.equal((html.match(/<script>/g)||[]).length,1)
  assert.throws(()=>buildStandaloneHtml('Empty',[]),/No pages/)
})

test('PDF export has cover-first page count and contains mixed images without stretching', async () => {
  const draws=[]
  const oldDocument=globalThis.document, oldImage=globalThis.Image
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},createLinearGradient:()=>({addColorStop(){}}),drawImage(img,x,y,w,h){draws.push({ratio:img.naturalWidth/img.naturalHeight,w,h,x,y})}}),toDataURL:()=>pixel})}
  let index=0
  const sizes=[[595,842],[842,595],[600,600],[595,842]]
  globalThis.Image=class {constructor(){[this.naturalWidth,this.naturalHeight]=sizes[index++]} set src(_value){queueMicrotask(()=>this.onload())}}
  try {
    const blob=await exportSpreadPdf('Test',makePages(sizes))
    const pdf=await blob.text()
    assert.equal((pdf.match(/\/Type \/Page\b/g)||[]).length,3)
    assert.equal(draws.length,4)
    draws.forEach(draw=>assert.ok(Math.abs(draw.w/draw.h-draw.ratio)<1e-8))
    await assert.rejects(()=>exportSpreadPdf('Empty',[]),/No pages/)
  } finally {globalThis.document=oldDocument;globalThis.Image=oldImage}
})
