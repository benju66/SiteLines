import { describe, it, expect } from 'vitest'
import { invoiceHistoryFor, invoicePeriods, invoiceRollup, invoicesSorted } from '@/selectors'
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

describe('invoicePeriods', () => {
  // Periods spanning a 2025→2026 boundary — the lexical order ("01/.." < "06/..")
  // is the OPPOSITE of chronological, so this proves the date-parsed sort.
  const P: Invoice[] = [
    inv({ id: 'p1', billedToDate: 0, retainage: 0, isLatest: true, period: '06/01/25 - 06/30/25' }),
    inv({ id: 'p2', billedToDate: 0, retainage: 0, isLatest: true, period: '01/01/26 - 01/31/26' }),
    inv({ id: 'p3', billedToDate: 0, retainage: 0, isLatest: true, period: '05/01/26 - 05/31/26' }),
    inv({ id: 'p4', billedToDate: 0, retainage: 0, isLatest: false, period: '05/01/26 - 05/31/26' }), // dup period
    inv({ id: 'p5', billedToDate: 0, retainage: 0, isLatest: true, period: '' }), // empty → dropped
  ]

  it('returns distinct non-empty periods, newest first (chronological, not lexical)', () => {
    expect(invoicePeriods(P)).toEqual(['05/01/26 - 05/31/26', '01/01/26 - 01/31/26', '06/01/25 - 06/30/25'])
  })

  it('is empty-safe', () => {
    expect(invoicePeriods([])).toEqual([])
  })
})

describe('invoiceHistoryFor', () => {
  const A1 = inv({ id: 'a1', commitmentId: 'commitments:1', billedToDate: 700_000, retainage: 0, isLatest: false, billingDate: '2026-04-30' })
  const A2 = inv({ id: 'a2', commitmentId: 'commitments:1', billedToDate: 1_197_286, retainage: 0, isLatest: true, billingDate: '2026-05-31' })
  const B1 = inv({ id: 'b1', commitmentId: 'commitments:2', billedToDate: 1_150_900, retainage: 0, isLatest: true, billingDate: '2026-05-31' })
  const ALL = [A1, A2, B1]

  it('returns the same commitment’s pay apps, newest first, including the clicked one', () => {
    expect(invoiceHistoryFor(ALL, A1).map((i) => i.id)).toEqual(['a2', 'a1'])
  })

  it('excludes other commitments’ pay apps', () => {
    expect(invoiceHistoryFor(ALL, B1).map((i) => i.id)).toEqual(['b1'])
  })

  it('returns just itself when the pay app has no commitment', () => {
    const solo = inv({ id: 's', commitmentId: null, billedToDate: 0, retainage: 0, isLatest: true })
    expect(invoiceHistoryFor([...ALL, solo], solo)).toEqual([solo])
  })
})
