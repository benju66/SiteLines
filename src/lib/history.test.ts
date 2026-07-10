import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, History, initHistory, pushEdit, redo, undo } from './history'

const set = (v: number) => () => v // an edit fn that replaces the present with `v`

describe('history', () => {
  it('starts empty — nothing to undo or redo', () => {
    const h = initHistory(0)
    expect(h).toEqual({ past: [], present: 0, future: [], tag: null })
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)
  })

  it('records an edit and lets you undo/redo it', () => {
    const h = pushEdit(initHistory(0), set(1))
    expect(h.present).toBe(1)
    expect(canUndo(h)).toBe(true)
    const back = undo(h)
    expect(back.present).toBe(0)
    expect(canRedo(back)).toBe(true)
    const forward = redo(back)
    expect(forward.present).toBe(1)
  })

  it('does NOT record an edit that returns the same reference (a no-op op)', () => {
    const same: number[] = [1, 2]
    const h0 = initHistory(same)
    const h1 = pushEdit(h0, (p) => p) // op no-oped → same ref
    expect(h1).toBe(h0)
    expect(canUndo(h1)).toBe(false)
  })

  it('coalesces consecutive same-tag edits into ONE undo step (typing burst)', () => {
    let h: History<string> = initHistory('')
    h = pushEdit(h, () => 'c', 'note:0')
    h = pushEdit(h, () => 'co', 'note:0')
    h = pushEdit(h, () => 'con', 'note:0')
    expect(h.present).toBe('con')
    expect(h.past).toEqual(['']) // only the pre-burst state, not one per key
    const back = undo(h)
    expect(back.present).toBe('') // one undo reverts the whole burst
  })

  it('starts a new step when the tag changes (or is null)', () => {
    let h: History<string> = initHistory('')
    h = pushEdit(h, () => 'a', 'note:0')
    h = pushEdit(h, () => 'ab', 'note:0') // coalesces
    h = pushEdit(h, () => 'ab!', null) // a different (structural) edit — its own step
    h = pushEdit(h, () => 'x', 'note:1') // a different note — its own step
    expect(h.past).toEqual(['', 'ab', 'ab!'])
    expect(undo(h).present).toBe('ab!')
  })

  it('a new edit after undo clears the redo stack (branching)', () => {
    let h = pushEdit(pushEdit(initHistory(0), set(1)), set(2))
    h = undo(h) // present 1, future [2]
    expect(canRedo(h)).toBe(true)
    h = pushEdit(h, set(9)) // branch off
    expect(canRedo(h)).toBe(false)
    expect(h.present).toBe(9)
    expect(h.past).toEqual([0, 1])
  })

  it('undo/redo are no-ops at the ends', () => {
    const h = initHistory(0)
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })

  it('walks a multi-step stack back and forth deterministically', () => {
    let h = initHistory(0)
    for (const v of [1, 2, 3]) h = pushEdit(h, set(v))
    expect(h.present).toBe(3)
    h = undo(undo(h))
    expect(h.present).toBe(1)
    h = redo(h)
    expect(h.present).toBe(2)
    // undoing after a redo still reaches the original
    expect(undo(undo(h)).present).toBe(0)
  })
})
