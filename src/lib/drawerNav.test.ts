import { describe, expect, it } from 'vitest'
import type { ChangeEvent, Commitment, DrawerTarget, Invoice, Item } from '@/types'
import {
  backPatch,
  clampDrawerWidth,
  closePatch,
  currentTarget,
  DRAWER_EDGE_GAP,
  DRAWER_MIN_WIDTH,
  navigatePatch,
  openPatch,
  slotFor,
  type DrawerSlots,
} from './drawerNav'

// Minimal fixtures — only the id/shape the transitions touch (they move whole
// objects between slots, never inspect their fields).
const rec = { id: 'rfis:1', tool: 'rfis' } as unknown as Item
const detailTarget: DrawerTarget = { kind: 'detail', value: { tool: 'rfis', record: rec } }
const commitment = { id: 'commitments:9' } as unknown as Commitment
const commitmentTarget: DrawerTarget = { kind: 'commitment', value: commitment }
const changeEvent = { id: 'changeEvents:3' } as unknown as ChangeEvent
const changeEventTarget: DrawerTarget = { kind: 'changeEvent', value: changeEvent }
const invoice = { id: 'invoicing:7' } as unknown as Invoice
const invoiceTarget: DrawerTarget = { kind: 'invoice', value: invoice }

const EMPTY: DrawerSlots = { detail: null, commitment: null, changeEvent: null, invoice: null }

describe('slotFor', () => {
  it('shows exactly the target and clears the other three slots', () => {
    expect(slotFor(commitmentTarget)).toEqual({ ...EMPTY, commitment })
    expect(slotFor(detailTarget)).toEqual({ ...EMPTY, detail: { tool: 'rfis', record: rec } })
  })
})

describe('currentTarget', () => {
  it('reads the single open slot back out as a target', () => {
    expect(currentTarget({ ...EMPTY, invoice })).toEqual(invoiceTarget)
  })
  it('is null when nothing is open', () => {
    expect(currentTarget(EMPTY)).toBeNull()
  })
})

describe('openPatch (fresh open from a list / palette)', () => {
  it('shows the target and resets the back-stack', () => {
    expect(openPatch(commitmentTarget)).toEqual({ ...EMPTY, commitment, drawerHistory: [] })
  })
})

describe('navigatePatch (following a cross-link)', () => {
  it('pushes the current target then shows the new one', () => {
    // A change event is open; navigate to the commitment it hits.
    const from = { ...EMPTY, changeEvent, drawerHistory: [] }
    const next = navigatePatch(from, commitmentTarget)
    expect(next).toEqual({ ...EMPTY, commitment, drawerHistory: [changeEventTarget] })
  })

  it('stacks across drawer types so Back can unwind each hop', () => {
    let s: DrawerSlots & { drawerHistory: DrawerTarget[] } = { ...EMPTY, invoice, drawerHistory: [] }
    s = { ...s, ...navigatePatch(s, commitmentTarget) } // invoice → commitment
    s = { ...s, ...navigatePatch(s, detailTarget) } // commitment → linked record
    expect(s.drawerHistory).toEqual([invoiceTarget, commitmentTarget])
    expect(currentTarget(s)).toEqual(detailTarget)
  })
})

describe('backPatch', () => {
  it('pops the stack and restores the previous target', () => {
    const s = { ...EMPTY, commitment, drawerHistory: [invoiceTarget] }
    const back = backPatch(s)
    expect(back).toEqual({ ...EMPTY, invoice, drawerHistory: [] })
  })

  it('unwinds a multi-hop trail one step at a time', () => {
    let s: DrawerSlots & { drawerHistory: DrawerTarget[] } = { ...EMPTY, detail: { tool: 'rfis', record: rec }, drawerHistory: [invoiceTarget, commitmentTarget] }
    s = { ...s, ...backPatch(s) }
    expect(currentTarget(s)).toEqual(commitmentTarget)
    s = { ...s, ...backPatch(s) }
    expect(currentTarget(s)).toEqual(invoiceTarget)
    expect(s.drawerHistory).toEqual([])
  })

  it('is a no-op patch when the stack is empty', () => {
    expect(backPatch({ drawerHistory: [] })).toEqual({})
  })
})

describe('closePatch', () => {
  it('clears every slot and the back-stack', () => {
    expect(closePatch()).toEqual({ ...EMPTY, drawerHistory: [] })
  })
})

describe('clampDrawerWidth', () => {
  const vw = 1440
  it('holds a normal width unchanged', () => {
    expect(clampDrawerWidth(700, vw)).toBe(700)
  })
  it('floors at the minimum', () => {
    expect(clampDrawerWidth(100, vw)).toBe(DRAWER_MIN_WIDTH)
  })
  it('ceils at viewport minus the edge gap', () => {
    expect(clampDrawerWidth(99999, vw)).toBe(vw - DRAWER_EDGE_GAP)
  })
  it('never returns below the minimum even on a tiny viewport', () => {
    expect(clampDrawerWidth(9999, 200)).toBe(DRAWER_MIN_WIDTH)
  })
})
