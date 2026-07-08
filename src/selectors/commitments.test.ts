import { describe, expect, it } from 'vitest'
import type { Commitment, CommitmentBilling, CommitmentChangeOrder } from '@/types'
import { commitmentBillingsSorted, commitmentChangeOrdersSorted, commitmentRollup, commitmentsSorted } from './index'

/** Minimal Commitment builder — only the fields the selectors read. */
function cm(
  number: string,
  vendor: string,
  revised: number,
  billed: number,
  retainage = 0,
  overrides: Partial<Commitment> = {},
): Commitment {
  return {
    project: 'opiii',
    id: `commitments:${number}`,
    number,
    title: vendor,
    vendor,
    type: number.startsWith('PO') ? 'PO' : 'SC',
    status: 'Approved',
    executed: true,
    hasRequisition: true,
    original: revised,
    revised,
    billed,
    retainage,
    pctComplete: revised > 0 ? billed / revised : 0,
    coCount: 0,
    coTotal: 0,
    description: '',
    deliveryDate: null,
    private: true,
    ...overrides,
  }
}

/** A just-issued commitment: no requisition, so every financial is 0. */
const notStarted = (number: string, vendor: string, overrides: Partial<Commitment> = {}) =>
  cm(number, vendor, 0, 0, 0, { hasRequisition: false, executed: false, ...overrides })

const commitments = [
  cm('SC-25-117-092', 'Summit Interiors', 1_248_111, 1_197_286, 59_864.3),
  cm('SC-25-117-220', 'Northline Mechanical', 1_988_469, 1_974_850, 98_742.5),
  cm('PO-25-117-061', 'Lakeside Supply Co.', 412_500, 268_125, 13_406.25),
  notStarted('SC-25-117-101', 'BrightWorks Services'),
  cm('SC-25-117-260', 'granite state electric', 1_165_775, 1_150_900, 57_545),
]

describe('commitmentRollup', () => {
  it('sums the financials and counts billing vs. total commitments', () => {
    const r = commitmentRollup(commitments)
    expect(r.count).toBe(5)
    expect(r.billing).toBe(4) // the not-started one has no pay app
    expect(r.revised).toBeCloseTo(4_814_855)
    expect(r.billed).toBeCloseTo(4_591_161)
    expect(r.retainage).toBeCloseTo(229_558.05)
  })

  it('overall % complete = billed / revised (0..1)', () => {
    const r = commitmentRollup(commitments)
    expect(r.pctComplete).toBeCloseTo(4_591_161 / 4_814_855)
  })

  it('is 0% (not NaN) when there is nothing billed against', () => {
    expect(commitmentRollup([]).pctComplete).toBe(0)
    expect(commitmentRollup([notStarted('SC-1', 'A')]).pctComplete).toBe(0)
  })
})

describe('commitmentsSorted', () => {
  it('default (null sort): revised desc, no-pay-app rows last', () => {
    const order = commitmentsSorted(commitments, null).map((c) => c.number)
    expect(order).toEqual(['SC-25-117-220', 'SC-25-117-092', 'SC-25-117-260', 'PO-25-117-061', 'SC-25-117-101'])
  })

  it('a real $0 revised value still sorts above a missing one by default', () => {
    const rows = [notStarted('SC-2', 'B'), cm('SC-1', 'A', 0, 0)]
    expect(commitmentsSorted(rows, null).map((c) => c.number)).toEqual(['SC-1', 'SC-2'])
  })

  it('sorts by a money column both directions', () => {
    const desc = commitmentsSorted(commitments, { col: 'billed', dir: 'desc' }).map((c) => c.billed)
    expect(desc).toEqual([...desc].sort((a, b) => b - a))
    const asc = commitmentsSorted(commitments, { col: 'billed', dir: 'asc' }).map((c) => c.billed)
    expect(asc).toEqual([...asc].sort((a, b) => a - b))
  })

  it('sorts vendor case-insensitively', () => {
    const vendors = commitmentsSorted(commitments, { col: 'vendor', dir: 'asc' }).map((c) => c.vendor)
    expect(vendors).toEqual([
      'BrightWorks Services',
      'granite state electric',
      'Lakeside Supply Co.',
      'Northline Mechanical',
      'Summit Interiors',
    ])
  })

  it('breaks ties by natural number order (deterministic), and does not mutate its input', () => {
    const tied = [cm('SC-11', 'Z', 100, 0), cm('SC-2', 'Y', 100, 0), cm('SC-101', 'X', 100, 0)]
    const before = tied.map((c) => c.number)
    // natural: 2 < 11 < 101 (lexicographic would put 101 before 11)
    expect(commitmentsSorted(tied, { col: 'revised', dir: 'desc' }).map((c) => c.number)).toEqual(['SC-2', 'SC-11', 'SC-101'])
    expect(tied.map((c) => c.number)).toEqual(before)
  })

  it('sorts by % complete', () => {
    const pcts = commitmentsSorted(commitments, { col: 'pct', dir: 'desc' }).map((c) => c.pctComplete)
    expect(pcts).toEqual([...pcts].sort((a, b) => b - a))
  })
})

const co = (number: string, amount: number): CommitmentChangeOrder => ({
  id: `commitments:1:co:${number}`,
  number,
  title: `Change order ${number}`,
  amount,
  status: 'Approved',
  executed: true,
  date: null,
})

const bill = (number: string, billedToDate: number): CommitmentBilling => ({
  id: `commitments:1:req:${number}`,
  number,
  invoiceNumber: `R-${number}`,
  period: '',
  billingDate: null,
  status: 'Approved',
  pctComplete: 0.5,
  billedToDate,
  thisPeriod: 0,
})

describe('commitmentChangeOrdersSorted', () => {
  it('orders by CO number ascending (chronological), numerically not lexically', () => {
    const out = commitmentChangeOrdersSorted([co('010', 5), co('002', 4), co('001', 1)])
    expect(out.map((c) => c.number)).toEqual(['001', '002', '010'])
  })

  it('does not mutate its input', () => {
    const input = [co('002', 4), co('001', 1)]
    const before = input.map((c) => c.number)
    commitmentChangeOrdersSorted(input)
    expect(input.map((c) => c.number)).toEqual(before)
  })
})

describe('commitmentBillingsSorted', () => {
  it('orders by pay-app number descending (latest first), numerically', () => {
    const out = commitmentBillingsSorted([bill('2', 20), bill('10', 100), bill('1', 10)])
    expect(out.map((b) => b.number)).toEqual(['10', '2', '1'])
  })

  it('does not mutate its input', () => {
    const input = [bill('1', 10), bill('2', 20)]
    const before = input.map((b) => b.number)
    commitmentBillingsSorted(input)
    expect(input.map((b) => b.number)).toEqual(before)
  })
})
