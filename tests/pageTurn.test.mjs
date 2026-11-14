import test from 'node:test'
import assert from 'node:assert/strict'
import { easePageTurns } from '../src/lib/pageTurn.ts'

test('page turns ease in and out while preserving frame order, endpoints and completion', () => {
  let animation
  const renderer = { startAnimation(frames,duration,onEnd) { animation={frames,duration,onEnd} } }
  const visited=[]
  const frames=Array.from({length:101},(_,i)=>()=>visited.push(i))
  const complete=()=>{}
  easePageTurns(renderer)
  easePageTurns(renderer) // Repeated initialization must not stack easing.
  renderer.startAnimation(frames,700,complete)
  animation.frames.forEach(frame=>frame())
  assert.equal(animation.duration,700)
  assert.equal(animation.onEnd,complete)
  assert.equal(visited[0],0)
  assert.equal(visited[100],100)
  assert.equal(visited[50],50)
  assert.equal(visited[25],16)
  assert.equal(visited[75],84)
  assert.ok(visited.every((value,i)=>i===0||value>=visited[i-1]))
})

test('reduced-motion preference is checked for every turn', () => {
  const durations=[]
  const renderer={startAnimation(_frames,duration){durations.push(duration)}}
  let reduced=false
  easePageTurns(renderer,()=>reduced)
  renderer.startAnimation([()=>{}],700,()=>{})
  reduced=true
  renderer.startAnimation([()=>{}],700,()=>{})
  assert.deepEqual(durations,[700,1])
})

test('corner hover and release ease over 250ms without slowing drag or full turns', () => {
  const durations=[]
  const renderer={startAnimation(_frames,duration){durations.push(duration)}}
  let state='fold_corner'
  let reduced=false
  easePageTurns(renderer,()=>reduced,()=>state)
  const frames=[()=>{},()=>{},()=>{}]
  renderer.startAnimation(frames,35,()=>{})
  state='read'
  renderer.startAnimation(frames,35,()=>{})
  state='user_fold'
  renderer.startAnimation(frames,300,()=>{})
  state='flipping'
  renderer.startAnimation(frames,700,()=>{})
  state='fold_corner'; reduced=true
  renderer.startAnimation(frames,35,()=>{})
  assert.deepEqual(durations,[250,250,300,700,1])
})
