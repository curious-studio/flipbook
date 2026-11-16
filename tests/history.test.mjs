import test from 'node:test'
import assert from 'node:assert/strict'
import { historyShortcut, recordEdit, stepHistory } from '../src/lib/history.ts'

test('Command and Control shortcuts support undo and Shift redo', () => {
  const event = { key: 'z', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, isComposing: false }
  for (const modifier of ['metaKey', 'ctrlKey']) {
    assert.equal(historyShortcut({ ...event, [modifier]: true }), 'undo')
    assert.equal(historyShortcut({ ...event, [modifier]: true, shiftKey: true, key: 'Z' }), 'redo')
    assert.equal(historyShortcut({ ...event, [modifier]: true, altKey: true }), null)
    assert.equal(historyShortcut({ ...event, [modifier]: true, isComposing: true }), null)
    assert.equal(historyShortcut({ ...event, [modifier]: true, key: 'x' }), null)
  }
  assert.equal(historyShortcut(event), null)
})

test('history retains the latest 20 edits and supports a full undo/redo round trip', () => {
  let history = { past: [], future: [] }
  let current = 0
  for (let i = 1; i <= 25; i++) {
    history = recordEdit(history, current)
    current = i
  }
  assert.equal(history.past.length, 20)
  for (let i = 24; i >= 5; i--) {
    const step = stepHistory(history, current, 'undo')
    history = step.history; current = step.value
    assert.equal(current, i)
  }
  assert.equal(stepHistory(history, current, 'undo'), null)
  for (let i = 6; i <= 25; i++) {
    const step = stepHistory(history, current, 'redo')
    history = step.history; current = step.value
    assert.equal(current, i)
  }
  assert.equal(stepHistory(history, current, 'redo'), null)
})

test('a new edit after undo discards redo and preserves the current document snapshot', () => {
  const before = { pages: ['a', 'b'], title: 'Book', currentPage: 1 }
  const cleared = { pages: [], title: 'Book', currentPage: 0 }
  const undo = stepHistory(recordEdit({ past: [], future: [] }, before), cleared, 'undo')
  assert.deepEqual(undo.value, before)
  assert.deepEqual(stepHistory(undo.history, before, 'redo').value, cleared)
  const branched = recordEdit(undo.history, before)
  assert.equal(stepHistory(branched, before, 'redo'), null)
  assert.deepEqual(branched.past, [before])
})
