import { describe, expect, it } from 'vitest'
import type { Commitment, CommitmentBilling, CommitmentChangeOrder, CommitmentLineItem } from '@/types'
import {
  commitmentBillingsSorted,
  commitmentChangeOrdersSorted,
  commitmentRollup,
  commitmentsByCostCode,
  commitmentSovByCostCode,
  commitmentsSorted,
  costCodeKey,
} from './index'

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
    inclusions: '',
    exclusions: '',
    grandTotal: revised,
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

// ---- Budget↔Commitment cross-link (Phase 4) ----

/** A SOV line-item builder — only the fields the cross-link selectors read. */
const lineItem = (
  commitment: string,
  n: number,
  costCode: string,
  amount: number,
  costCodeName = 'Cost Code',
): CommitmentLineItem => ({
  project: 'opiii',
  id: `commitments:${commitment}:li:${n}`,
  commitmentId: `commitments:${commitment}`,
  costCode,
  costCodeName,
  amount,
  description: `Line ${n}`,
})

describe('costCodeKey', () => {
  it('strips the " - <title>" suffix off a budget cost code', () => {
    expect(costCodeKey('12-123530.000 - Residential Casework')).toBe('12-123530.000')
    expect(costCodeKey('9-99000.000 - Painting and Coating')).toBe('9-99000.000')
  })

  it('returns a bare code (no title) whole, and trims', () => {
    expect(costCodeKey('12-123530.000')).toBe('12-123530.000')
    expect(costCodeKey('  6-64100.000  ')).toBe('6-64100.000')
  })

  it('only splits on the first spaced dash (the code keeps its own hyphen)', () => {
    // "12-123530.000" has an internal hyphen but no spaced dash, so it survives.
    expect(costCodeKey('12-123530.000 - A - B')).toBe('12-123530.000')
  })
})

describe('commitmentsByCostCode', () => {
  const casework = cm('PO-25-117-123', 'Casework Co.', 539_086, 0)
  const cleaning = cm('SC-25-117-101', 'BrightWorks', 8_000, 0)
  const commitments = [casework, cleaning]

  it('groups line items by cost code and sums amounts per commitment', () => {
    const lineItems = [
      lineItem('PO-25-117-123', 1, '12-123530.000', 500_000),
      lineItem('PO-25-117-123', 2, '12-123530.000', 0),
      lineItem('PO-25-117-123', 3, '6-64100.000', 39_086),
    ]
    const map = commitmentsByCostCode(lineItems, [casework])
    expect([...map.keys()].sort()).toEqual(['12-123530.000', '6-64100.000'])
    const casebehind = map.get('12-123530.000')!
    expect(casebehind).toHaveLength(1)
    expect(casebehind[0].commitment.number).toBe('PO-25-117-123')
    expect(casebehind[0].amount).toBe(500_000) // two lines (500k + 0) summed
    expect(casebehind[0].lineItemCount).toBe(2)
  })

  it('orders multiple subcontracts behind one code by amount desc', () => {
    const lineItems = [
      lineItem('PO-25-117-123', 1, '9-99000.000', 32_000),
      lineItem('SC-25-117-101', 1, '9-99000.000', 8_000),
    ]
    const behind = commitmentsByCostCode(lineItems, commitments).get('9-99000.000')!
    expect(behind.map((b) => b.commitment.number)).toEqual(['PO-25-117-123', 'SC-25-117-101'])
    expect(behind.map((b) => b.amount)).toEqual([32_000, 8_000])
  })

  it('ties on amount break by natural commitment number', () => {
    const a = cm('SC-11', 'Z', 0, 0)
    const b = cm('SC-2', 'Y', 0, 0)
    const lineItems = [lineItem('SC-11', 1, '3-33000.000', 100), lineItem('SC-2', 1, '3-33000.000', 100)]
    const behind = commitmentsByCostCode(lineItems, [a, b]).get('3-33000.000')!
    expect(behind.map((x) => x.commitment.number)).toEqual(['SC-2', 'SC-11'])
  })

  it('skips line items whose commitment is not in the list, and omits an emptied code', () => {
    const lineItems = [
      lineItem('PO-25-117-123', 1, '12-123530.000', 500_000),
      lineItem('SC-99-UNKNOWN', 1, '12-123530.000', 5_000), // no matching commitment
      lineItem('SC-99-UNKNOWN', 1, '5-55000.000', 5_000), // whole code has no resolvable commitment
    ]
    const map = commitmentsByCostCode(lineItems, [casework])
    expect(map.get('12-123530.000')).toHaveLength(1) // only the casework line survives
    expect(map.get('12-123530.000')![0].amount).toBe(500_000)
    expect(map.has('5-55000.000')).toBe(false) // dropped entirely
  })

  it('does not mutate its inputs', () => {
    const lineItems = [lineItem('PO-25-117-123', 1, '12-123530.000', 500_000)]
    const before = lineItems.map((l) => l.id)
    commitmentsByCostCode(lineItems, [casework])
    expect(lineItems.map((l) => l.id)).toEqual(before)
  })
})

describe('commitmentSovByCostCode', () => {
  it('groups a commitment’s SOV by cost code, subtotals, ordered by subtotal desc', () => {
    const lineItems = [
      lineItem('9002', 1, '9-92116.000', 760_000, 'Gypsum Board Assemblies'),
      lineItem('9002', 2, '9-92116.000', 248_000, 'Gypsum Board Assemblies'),
      lineItem('9002', 3, '9-99000.000', 150_000, 'Painting and Coating'),
      lineItem('9002', 4, '9-99000.000', 32_000, 'Painting and Coating'),
    ]
    const groups = commitmentSovByCostCode(lineItems)
    expect(groups.map((g) => g.costCode)).toEqual(['9-92116.000', '9-99000.000'])
    expect(groups[0].amount).toBe(1_008_000)
    expect(groups[0].costCodeName).toBe('Gypsum Board Assemblies')
    expect(groups[0].lineItems.map((l) => l.amount)).toEqual([760_000, 248_000]) // amount desc within a group
    expect(groups[1].amount).toBe(182_000)
  })

  it('does not mutate its input', () => {
    const lineItems = [lineItem('9002', 2, '9-92116.000', 1), lineItem('9002', 1, '9-92116.000', 2)]
    const before = lineItems.map((l) => l.id)
    commitmentSovByCostCode(lineItems)
    expect(lineItems.map((l) => l.id)).toEqual(before)
  })
})
