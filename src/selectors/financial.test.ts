import { describe, expect, it } from 'vitest'
import { FINANCIALS } from '@/data/financials'
import { financialView } from './index'

// Hand-computed from src/data/financials.ts:
//   mckenna: budget 25.44, committed 21.20, invoiced 9.80
//   opiii:   budget 18.51, committed 12.60, invoiced 4.10
//   all:     budget 43.95, committed 33.80, invoiced 13.90
//   changes: 0.84 + 0.31 = 1.15 · over/under: 0.12 − 0.08 = +0.04

describe('financialView · budget', () => {
  it('aggregates both projects under "all" scope', () => {
    const v = financialView(FINANCIALS, 'budget', 'all')
    const kpi = Object.fromEntries(v.kpis.map((k) => [k.label, k.value]))
    expect(kpi['Original Budget']).toBe('$42.80M') // 43.95 − 1.15
    expect(kpi['Approved Changes']).toBe('+$1.15M')
    expect(kpi['Revised Budget']).toBe('$43.95M')
    expect(kpi['Committed']).toBe('$33.80M')
    expect(kpi['Invoiced to Date']).toBe('$13.90M')
    expect(kpi['Projected Over / Under']).toBe('+$0.04M')
  })

  it('sums division rows across projects (Concrete = 3.10 + 2.30)', () => {
    const v = financialView(FINANCIALS, 'budget', 'all')
    const concrete = v.rows.find((r) => r.name === 'Concrete')!
    expect(concrete.c1).toBe('$5.40M')
    expect(concrete.c2).toBe('$5.00M')
    expect(concrete.c3).toBe('$0.40M') // uncommitted = budget − committed
    expect(concrete.c3Negative).toBe(false)
    expect(v.total).toEqual({ c1: '$43.95M', c2: '$33.80M', c3: '$10.15M' })
    expect(v.rows).toHaveLength(6)
  })

  it('single-project scope uses only that project', () => {
    const v = financialView(FINANCIALS, 'budget', 'mckenna')
    const kpi = Object.fromEntries(v.kpis.map((k) => [k.label, k.value]))
    expect(kpi['Revised Budget']).toBe('$25.44M')
    expect(kpi['Committed']).toBe('$21.20M')
    expect(kpi['Projected Over / Under']).toBe('+$0.12M')
  })

  it('formats a projected under-run with a minus sign, colored ok', () => {
    const v = financialView(FINANCIALS, 'budget', 'opiii')
    const ou = v.kpis.find((k) => k.label === 'Projected Over / Under')!
    expect(ou.value).toBe('-$0.08M') // not "$-0.08M"
    expect(ou.color).toBe('#2c7a4f')
  })
})

describe('financialView · primeContract', () => {
  it('derives contract KPIs from the same source', () => {
    const v = financialView(FINANCIALS, 'primeContract', 'all')
    const kpi = Object.fromEntries(v.kpis.map((k) => [k.label, k.value]))
    expect(kpi['Contract Sum']).toBe('$42.80M')
    expect(kpi['Revised Contract']).toBe('$43.95M')
    expect(kpi['Balance to Finish']).toBe('$30.05M') // 43.95 − 13.90
    expect(kpi['Retainage Held']).toBe('$0.70M') // 5% of 13.90
  })

  it('computes % billed per division and in the total row', () => {
    const v = financialView(FINANCIALS, 'primeContract', 'all')
    const concrete = v.rows.find((r) => r.name === 'Concrete')!
    expect(concrete.c2).toBe('$3.50M')
    expect(concrete.c3).toBe('65%') // 3.50 / 5.40
    expect(v.total.c3).toBe('32%') // 13.90 / 43.95
  })
})
