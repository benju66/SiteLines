import { describe, it, expect } from 'vitest'
import { invoiceRollup, invoicesSorted } from '@/selectors'
import type { Invoice } from '@/types'

function inv(p: Partial<Invoice> & Pick<Invoice, 'id' | 'billedToDate' | 'retainage' | 'isLatest'>): Invoice {
  return {
    project: 'opiii',
    number: p.id,
    vendor: p.vendor ?? 'V',
    contract: 'C',
    commitmentId: p.commitmentId ?? 'commitments:1',
    period: 'P',
    billingDate: p.billingDate ?? '2026-01-01',
    status: p.status ?? 'Approved',
    final: false,
    thisPeriod: p.thisPeriod ?? 0,
    pctComplete: 0.5,
    original: 0,
    revised: 0,
    netChangeByCOs: 0,
    earnedLessRetainage: 0,
    balanceToFinish: 0,
    ...p,
  }
}

// Two commitments, each with an earlier + a latest pay app. Summing ALL rows would
// double-count the cumulative fields — the rollup must sum isLatest rows only.
const INVOICES: Invoice[] = [
  inv({ id: 'a1', commitmentId: 'commitments:1', billedToDate: 700_000, retainage: 35_000, thisPeriod: 700_000, isLatest: false, billingDate: '2026-04-30' }),
  inv({ id: 'a2', commitmentId: 'commitments:1', billedToDate: 1_197_286, retainage: 59_864.3, thisPeriod: 470_000, isLatest: true, billingDate: '2026-05-31', status: 'Under Review' }),
  inv({ id: 'b1', commitmentId: 'commitments:2', billedToDate: 1_150_900, retainage: 57_545, thisPeriod: 1_090_000, isLatest: true, billingDate: '2026-05-31' }),
]

describe('invoiceRollup', () => {
  const r = invoiceRollup(INVOICES)

  it('counts all pay apps and flags Under Review', () => {
    expect(r.count).toBe(3)
    expect(r.underReview).toBe(1)
  })

  it('sums cumulative fields over isLatest rows only (never double-counting)', () => {
    // billed = 1,197,286 (a2) + 1,150,900 (b1); NOT + 700,000 (a1, superseded)
    expect(r.billedToDate).toBe(1_197_286 + 1_150_900)
    expect(r.retainageHeld).toBe(59_864.3 + 57_545)
    expect(r.subs).toBe(2)
  })

  it('this-period sums over isLatest rows', () => {
    expect(r.thisPeriod).toBe(470_000 + 1_090_000)
  })

  it('is empty-safe', () => {
    expect(invoiceRollup([])).toEqual({ count: 0, underReview: 0, subs: 0, billedToDate: 0, retainageHeld: 0, thisPeriod: 0 })
  })
})

describe('invoicesSorted', () => {
  it('default order is most-recent pay app first (billing date desc)', () => {
    const ids = invoicesSorted(INVOICES, null).map((i) => i.id)
    expect(ids[ids.length - 1]).toBe('a1') // oldest (2026-04-30) last
    expect(ids.slice(0, 2).sort()).toEqual(['a2', 'b1']) // the two 2026-05-31 rows lead
  })

  it('sorts by a numeric column descending', () => {
    const ids = invoicesSorted(INVOICES, { col: 'billed', dir: 'desc' }).map((i) => i.id)
    expect(ids[0]).toBe('a2') // 1,197,286 highest
  })

  it('sorts by period chronologically, not by formatted string', () => {
    const asc = invoicesSorted(INVOICES, { col: 'period', dir: 'asc' }).map((i) => i.id)
    expect(asc[0]).toBe('a1') // 2026-04-30 earliest first
  })

  it('does not mutate the input array', () => {
    const input = [...INVOICES]
    invoicesSorted(input, { col: 'retainage', dir: 'asc' })
    expect(input.map((i) => i.id)).toEqual(INVOICES.map((i) => i.id))
  })
})
