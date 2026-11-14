import test from 'node:test'
import assert from 'node:assert/strict'
import { thumbnailWidth, revealOffset, isEditingTarget } from '../src/lib/responsive.ts'

test('extreme page proportions keep thumbnails usable without dominating the strip', () => {
  assert.equal(thumbnailWidth(10, 1000), 44)
  assert.equal(thumbnailWidth(1000, 10), 132)
  assert.equal(thumbnailWidth(600, 600), 88)
})

test('current spread is revealed with only the necessary horizontal scroll', () => {
  assert.equal(revealOffset(20, 200, 300), 0)
  assert.equal(revealOffset(-80, 100, 300), -80)
  assert.equal(revealOffset(240, 420, 300), 120)
})

test('editable ancestors opt out of global navigation while other targets do not', () => {
  const previous=globalThis.HTMLElement
  globalThis.HTMLElement=class { constructor(editing){this.editing=editing} closest(){return this.editing ? this : null} }
  try {
    assert.equal(isEditingTarget(new HTMLElement(true)), true)
    assert.equal(isEditingTarget(new HTMLElement(false)), false)
    assert.equal(isEditingTarget(null), false)
  } finally { globalThis.HTMLElement=previous }
})
