import { describe, it, expect } from 'vitest'
import { changeEventLineGroups, changeEventRollup, changeEventsByScope, changeEventsByType, changeEventsSorted } from '@/selectors'
import type { ChangeEvent, ChangeEventLineItem } from '@/types'

// Minimal deterministic fixture — one of each status, mixed scopes/types, a credit,
// an unscoped/untyped event, and a Void that must be excluded from every exposure.
function ce(partial: Partial<ChangeEvent> & Pick<ChangeEvent, 'id' | 'number' | 'status' | 'estCost'>): ChangeEvent {
  return {
    project: 'opiii',
    title: partial.title ?? 't',
    scope: partial.scope ?? '',
    type: partial.type ?? '',
    reason: partial.reason ?? '',
    lineItems: partial.lineItems ?? 0,
    commitments: partial.commitments ?? 0,
    originRfi: partial.originRfi ?? false,
    description: partial.description ?? '',
    createdAt: partial.createdAt ?? null,
    ...partial,
  }
}

const EVENTS: ChangeEvent[] = [
  ce({ id: 'changeEvents:1', number: 'CE #14', status: 'Open', scope: 'Out of Scope', type: 'Owner Contingency', estCost: 42_500 }),
  ce({ id: 'changeEvents:2', number: 'CE #15', status: 'Open', scope: 'In Scope', type: 'FP Contingency/Buyout', estCost: 8_750 }),
  ce({ id: 'changeEvents:3', number: 'CE #11', status: 'Closed', scope: 'Out of Scope', type: 'Owner Contingency', estCost: 63_200 }),
  ce({ id: 'changeEvents:4', number: 'CE #07', status: 'Closed', scope: 'In Scope', type: 'FP Contingency/Buyout', estCost: -18_400 }),
  ce({ id: 'changeEvents:5', number: 'CE #16', status: 'Open', scope: 'TBD', type: '', estCost: 0 }),
  ce({ id: 'changeEvents:6', number: 'CE #05', status: 'Void', scope: 'Out of Scope', type: 'Owner Contingency', estCost: 999_999 }),
]

describe('changeEventRollup', () => {
  const r = changeEventRollup(EVENTS)

  it('counts events by status', () => {
    expect(r.count).toBe(6)
    expect(r.open).toBe(3)
    expect(r.closed).toBe(2)
    expect(r.voided).toBe(1)
  })

  it('open exposure sums only OPEN events (the figure that ties to Budget pending)', () => {
    expect(r.openExposure).toBe(42_500 + 8_750 + 0)
  })

  it('active exposure sums open + closed and EXCLUDES Void (even a huge one)', () => {
    expect(r.activeExposure).toBe(42_500 + 8_750 + 63_200 - 18_400 + 0)
  })

  it('out-of-scope exposure sums non-Void Out of Scope events only', () => {
    expect(r.outOfScopeExposure).toBe(42_500 + 63_200) // the Void 999,999 is excluded
  })

  it('is empty-safe', () => {
    expect(changeEventRollup([])).toEqual({ count: 0, open: 0, closed: 0, voided: 0, openExposure: 0, activeExposure: 0, outOfScopeExposure: 0 })
  })
})

describe('changeEventsByScope', () => {
  const buckets = changeEventsByScope(EVENTS)

  it('uses canonical scope order and excludes Void', () => {
    expect(buckets.map((b) => b.key)).toEqual(['In Scope', 'Out of Scope', 'TBD'])
  })

  it('sums exposure per scope without the Void event', () => {
    const out = buckets.find((b) => b.key === 'Out of Scope')
    expect(out).toMatchObject({ count: 2, exposure: 42_500 + 63_200 }) // Void's Out-of-Scope row not counted
  })

  it("places '' scope under 'Unspecified', last", () => {
    const b = changeEventsByScope([ce({ id: 'changeEvents:9', number: 'CE #20', status: 'Open', scope: '', type: '', estCost: 100 })])
    expect(b).toEqual([{ key: 'Unspecified', count: 1, exposure: 100 }])
  })
})

describe('changeEventsByType', () => {
  it('orders funding buckets by absolute exposure desc, Void excluded', () => {
    const buckets = changeEventsByType(EVENTS)
    // Owner Contingency = 42,500 (closed 63,200 too) => 105,700 ; Buyout = 8,750 - 18,400 = -9,650 ; '' => Unspecified last
    expect(buckets.map((b) => b.key)).toEqual(['Owner Contingency', 'FP Contingency/Buyout', 'Unspecified'])
    expect(buckets[0].exposure).toBe(42_500 + 63_200)
  })
})

describe('changeEventsSorted', () => {
  it('default order is estimated cost desc (adds first, credits last)', () => {
    const ids = changeEventsSorted(EVENTS, null).map((e) => e.id)
    // 999,999 (Void) is still the biggest number — default sort does NOT drop Void, it just orders
    expect(ids[0]).toBe('changeEvents:6') // 999,999
    expect(ids[1]).toBe('changeEvents:3') // 63,200
    expect(ids[ids.length - 1]).toBe('changeEvents:4') // -18,400 credit last
  })

  it('sorts by a string column case-insensitively with a stable number tiebreak', () => {
    const asc = changeEventsSorted(EVENTS, { col: 'status', dir: 'asc' })
    // Closed < Open < Void; within Closed, CE #07 before CE #11 (natural number tiebreak)
    expect(asc.slice(0, 2).map((e) => e.id)).toEqual(['changeEvents:4', 'changeEvents:3'])
  })

  it('does not mutate the input array', () => {
    const input = [...EVENTS]
    changeEventsSorted(input, { col: 'estCost', dir: 'asc' })
    expect(input.map((e) => e.id)).toEqual(EVENTS.map((e) => e.id))
  })
})

describe('changeEventLineGroups', () => {
  const li = (id: string, costCode: string, amount: number, commitmentId: string | null = null): ChangeEventLineItem => ({
    project: 'opiii',
    id,
    changeEventId: 'changeEvents:1',
    costCode,
    costCodeName: costCode ? `${costCode} name` : '',
    amount,
    description: 'd',
    commitmentNumber: commitmentId ? 'SC-1' : '',
    commitmentId,
  })

  const LINES = [
    li('a', '2-22000.000', 30_000, 'commitments:9001'),
    li('b', '8-84000.000', 12_000, 'commitments:9001'),
    li('c', '8-84000.000', 40_000, 'commitments:9001'),
    li('d', '', 4_500), // no cost code → Unassigned
  ]

  it('groups by cost code with subtotals that sum to the event total', () => {
    const groups = changeEventLineGroups(LINES)
    const total = groups.reduce((s, g) => s + g.amount, 0)
    expect(total).toBe(30_000 + 12_000 + 40_000 + 4_500)
    const glaze = groups.find((g) => g.costCode === '8-84000.000')
    expect(glaze?.amount).toBe(52_000)
    // within a group, lines order by |amount| desc → c (40k) before b (12k)
    expect(glaze?.lineItems.map((l) => l.id)).toEqual(['c', 'b'])
  })

  it("orders groups by |subtotal| desc but always sinks 'Unassigned' last", () => {
    const groups = changeEventLineGroups(LINES)
    expect(groups.map((g) => g.costCode)).toEqual(['8-84000.000', '2-22000.000', ''])
  })

  it('is empty-safe', () => {
    expect(changeEventLineGroups([])).toEqual([])
  })
})
