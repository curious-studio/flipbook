import test from 'node:test'
import assert from 'node:assert/strict'
import { styleTurnShadow } from '../src/lib/turnShadow.ts'

test('cast shadow darkens slightly, fades with turn progress, and preserves engine geometry', () => {
  const calls=[], opacity=[]
  const renderer={setShadowData(...args){calls.push(args)},getSettings(){return {maxShadowOpacity:.2}}}
  const surface={style:{setProperty(name,value){assert.equal(name,'--turn-shadow-opacity');opacity.push(Number(value))}}}
  styleTurnShadow(renderer,surface)
  styleTurnShadow(renderer,surface)
  const position={x:10,y:20}
  for(const progress of [0,50,100,120]) renderer.setShadowData(position,.5,progress,1)
  assert.deepEqual(opacity,[.25,.125,0,0])
  assert.deepEqual(calls[0],[position,.5,0,1])
  assert.equal(calls.length,4)
})
