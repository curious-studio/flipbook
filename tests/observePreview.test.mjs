import test from 'node:test'
import assert from 'node:assert/strict'
import { observePreview } from '../src/lib/observePreview.ts'

test('preview immediately measures replacement containers and disconnects old observers', () => {
  const previous=globalThis.ResizeObserver
  const observers=[]
  globalThis.ResizeObserver=class {
    constructor(callback){this.callback=callback;observers.push(this)}
    observe(node){this.node=node}
    disconnect(){this.disconnected=true}
  }
  try {
    const sizes=[]
    const cleanup=observePreview({clientWidth:1000,clientHeight:600},size=>sizes.push(size))
    assert.deepEqual(sizes,[{width:1000,height:600}])
    cleanup()
    assert.equal(observers[0].disconnected,true)
    const cleanupNew=observePreview({clientWidth:800,clientHeight:500},size=>sizes.push(size))
    assert.deepEqual(sizes.at(-1),{width:800,height:500})
    observers[1].callback([{contentRect:{width:700,height:450}}])
    assert.deepEqual(sizes.at(-1),{width:700,height:450})
    observers[1].callback([{contentRect:{width:0,height:0}}])
    assert.deepEqual(sizes.at(-1),{width:700,height:450})
    cleanupNew()
    assert.equal(observers[1].disconnected,true)
  } finally {globalThis.ResizeObserver=previous}
})
