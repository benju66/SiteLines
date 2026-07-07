import { describe, expect, it } from 'vitest'
import type { BudgetLine } from '@/types'
import { boughtOut, budgetByDivision, budgetTotals, buyoutGaps, costTypeMix, overBudget, sortedBudgetGroups, uncommitted } from './index'

/** Minimal BudgetLine builder — only the fields the selectors read. */
function bl(
  division: string,
  costCode: string,
  budget: number,
  committed: number,
  projectedOverUnder = 0,
  costType = 'Subcontract',
): BudgetLine {
  return {
    project: 'opiii',
    division,
    costCode,
    costType,
    budget,
    committed,
    jtdCosts: null,
    eac: budget - projectedOverUnder,
    pendingCos: 0,
    projectedOverUnder,
  }
}

describe('boughtOut / uncommitted', () => {
  it('boughtOut = committed / budget', () => {
    expect(boughtOut(200, 150)).toBeCloseTo(0.75)
  })

  it('boughtOut is 0 when budget is 0 or negative (no meaningful ratio)', () => {
    expect(boughtOut(0, 5000)).toBe(0)
    expect(boughtOut(-2054, 0)).toBe(0)
  })

  it('uncommitted = budget − committed, and goes negative when over-committed', () => {
    expect(uncommitted(200, 150)).toBe(50)
    expect(uncommitted(178364, 203593)).toBe(-25229)
  })
})

describe('budgetByDivision', () => {
  // Divisions deliberately out of natural order in the input (9 before 10, 3 mid-list);
  // a split cost code (two cost types) under division 7; over-budget lines.
  const lines = [
    bl('9 - Division 09 - Finishes', '9-99000.000 - Painting and Coating', 234627, 275934, -41307),
    bl('9 - Division 09 - Finishes', '9-92116.000 - Gypsum Board Assemblies', 1002072, 1005303, -3231),
    bl('10 - Division 10 - Specialties', '10-102819.000 - Tub and Shower Doors', 101331, 98175, 3156),
    bl('3 - Division 03 - Concrete', '3-34100.000 - Precast Structural Concrete', 849377, 849366, 0),
    bl('3 - Division 03 - Concrete', '3-33000.000 - Cast in Place Concrete', 972411, 980894, -8483),
    bl('7 - Division 07 - Thermal and Mois', '7-72100.000 - Thermal Insulation', 301685, 223242, 0, 'Subcontract'),
    bl('7 - Division 07 - Thermal and Mois', '7-72100.000 - Thermal Insulation', 0, 0, -82953, 'Material'),
  ]

  it('orders divisions by natural leading-number sort (3, 7, 9, 10 — not lexicographic 10 < 3)', () => {
    const groups = budgetByDivision(lines)
    expect(groups.map((g) => g.division)).toEqual([
      '3 - Division 03 - Concrete',
      '7 - Division 07 - Thermal and Mois',
      '9 - Division 09 - Finishes',
      '10 - Division 10 - Specialties',
    ])
  })

  it('orders cost codes within a division by natural sort (33000 before 34100)', () => {
    const concrete = budgetByDivision(lines).find((g) => g.division.startsWith('3 -'))!
    expect(concrete.lines.map((l) => l.costCode)).toEqual([
      '3-33000.000 - Cast in Place Concrete',
      '3-34100.000 - Precast Structural Concrete',
    ])
  })

  it('keeps a split cost code as two lines, Material before Subcontract', () => {
    const thermal = budgetByDivision(lines).find((g) => g.division.startsWith('7 -'))!
    expect(thermal.lines).toHaveLength(2)
    expect(thermal.lines.map((l) => l.costType)).toEqual(['Material', 'Subcontract'])
  })

  it('subtotals budget / committed / uncommitted / eac / over-under per division', () => {
    const concrete = budgetByDivision(lines).find((g) => g.division.startsWith('3 -'))!
    expect(concrete.budget).toBe(849377 + 972411)
    expect(concrete.committed).toBe(849366 + 980894)
    expect(concrete.uncommitted).toBe(concrete.budget - concrete.committed)
    expect(concrete.eac).toBe(849377 - 0 + (972411 - -8483)) // eac = budget − over/under, summed
    expect(concrete.projectedOverUnder).toBe(-8483)
  })

  it('is deterministic and does not mutate the input', () => {
    const input = [...lines]
    const a = budgetByDivision(input).map((g) => [g.division, g.lines.map((l) => l.costCode + l.costType)])
    const b = budgetByDivision(input).map((g) => [g.division, g.lines.map((l) => l.costCode + l.costType)])
    expect(a).toEqual(b)
    expect(input.map((l) => l.costCode)).toEqual(lines.map((l) => l.costCode)) // unmutated
  })
})

describe('budgetTotals', () => {
  it('sums budget / committed / eac and derives uncommitted + over-under across all lines', () => {
    const lines = [
      bl('1 - Division 01', '1-1', 100, 60, -10), // eac 110
      bl('1 - Division 01', '1-2', 200, 150, 25), // eac 175
      bl('2 - Division 02', '2-1', 50, 50, 0), // eac 50
    ]
    expect(budgetTotals(lines)).toEqual({ budget: 350, committed: 260, uncommitted: 90, eac: 335, projectedOverUnder: 15 })
  })

  it('is empty-safe (all zeros)', () => {
    expect(budgetTotals([])).toEqual({ budget: 0, committed: 0, uncommitted: 0, eac: 0, projectedOverUnder: 0 })
  })
})

describe('sortedBudgetGroups', () => {
  const groups = budgetByDivision([
    bl('9 - Division 09 - Finishes', '9-99000.000 - Painting', 234627, 275934, -41307),
    bl('3 - Division 03 - Concrete', '3-33000.000 - Cast in Place', 972411, 980894, -8483),
    bl('3 - Division 03 - Concrete', '3-34100.000 - Precast', 849377, 849366, 100),
    bl('10 - Division 10 - Specialties', '10-102819.000 - Doors', 101331, 98175, 3156),
  ])

  it('null sort keeps the natural cost-code order untouched', () => {
    expect(sortedBudgetGroups(groups, null)).toBe(groups)
  })

  it('sorts divisions by Over/Under ascending — worst exposure first', () => {
    const out = sortedBudgetGroups(groups, { col: 'over', dir: 'asc' })
    expect(out.map((g) => g.division)).toEqual([
      '9 - Division 09 - Finishes', // -41,307
      '3 - Division 03 - Concrete', // -8,383
      '10 - Division 10 - Specialties', // +3,156
    ])
  })

  it('sorts lines within a division by the same column', () => {
    const concrete = sortedBudgetGroups(groups, { col: 'over', dir: 'asc' }).find((g) => g.division.startsWith('3 -'))!
    expect(concrete.lines.map((l) => l.costCode)).toEqual([
      '3-33000.000 - Cast in Place', // -8,483
      '3-34100.000 - Precast', // +100
    ])
  })

  it('sorts divisions by budget descending — largest first', () => {
    const out = sortedBudgetGroups(groups, { col: 'budget', dir: 'desc' })
    expect(out.map((g) => g.division)).toEqual([
      '3 - Division 03 - Concrete', // 1,821,788
      '9 - Division 09 - Finishes', // 234,627
      '10 - Division 10 - Specialties', // 101,331
    ])
  })

  it('does not mutate the input groups or their line arrays', () => {
    const before = groups.map((g) => [g.division, g.lines.map((l) => l.costCode)])
    sortedBudgetGroups(groups, { col: 'over', dir: 'asc' })
    const after = groups.map((g) => [g.division, g.lines.map((l) => l.costCode)])
    expect(after).toEqual(before)
  })
})

describe('overBudget', () => {
  const lines = [
    bl('9 - Division 09 - Finishes', '9-99000.000 - Painting', 234627, 275934, -41307),
    bl('7 - Division 07 - Thermal', '7-72100.000 - Insulation', 0, 0, -82953, 'Material'),
    bl('3 - Division 03 - Concrete', '3-34100.000 - Precast', 849377, 849366, 100), // under budget
    bl('6 - Division 06 - Wood', '6-62200.000 - Millwork', 178364, 203593, -25229, 'Material'),
  ]

  it('keeps only over-budget lines, worst (most negative) first', () => {
    const { lines: ranked } = overBudget(lines)
    expect(ranked.map((l) => l.costCode)).toEqual([
      '7-72100.000 - Insulation', // -82,953
      '9-99000.000 - Painting', // -41,307
      '6-62200.000 - Millwork', // -25,229
    ])
  })

  it('sums total exposure as negative dollars', () => {
    expect(overBudget(lines).totalExposure).toBe(-82953 - 41307 - 25229)
  })

  it('is empty-safe (no over-budget lines → empty list, 0 exposure)', () => {
    const under = [bl('1 - Division 01', '1-1', 100, 50, 25)]
    expect(overBudget(under)).toEqual({ lines: [], totalExposure: 0 })
  })
})

describe('buyoutGaps', () => {
  const lines = [
    bl('1 - Division 01', '1-10320.000 - PM', 303966, 0, 0, 'Labor'), // Labor — excluded
    bl('5 - Division 05', '5-51200.000 - Steel', 147010, 122550, 0, 'Subcontract'), // gap 24,460
    bl('7 - Division 07', '7-72100.000 - Insulation', 301685, 223242, 0, 'Subcontract'), // gap 78,443
    bl('9 - Division 09', '9-92116.000 - Gypsum', 1002072, 1005303, 0, 'Subcontract'), // over-committed → no gap
  ]

  it('ranks the largest uncommitted bought-out scope, excluding Labor and fully-committed lines', () => {
    const gaps = buyoutGaps(lines)
    expect(gaps.map((l) => l.costCode)).toEqual([
      '7-72100.000 - Insulation', // 78,443
      '5-51200.000 - Steel', // 24,460
    ])
  })

  it('respects the limit', () => {
    expect(buyoutGaps(lines, 1).map((l) => l.costCode)).toEqual(['7-72100.000 - Insulation'])
  })
})

describe('costTypeMix', () => {
  const lines = [
    bl('x', 'x-1', 100, 80, 0, 'Subcontract'),
    bl('x', 'x-2', 200, 150, 0, 'Labor'),
    bl('x', 'x-3', 50, 40, 0, 'Material'),
    bl('x', 'x-4', 30, 20, 0, 'Subcontract'),
  ]

  it('sums budget & committed per cost type', () => {
    const mix = costTypeMix(lines)
    const sub = mix.find((s) => s.costType === 'Subcontract')!
    expect(sub).toEqual({ costType: 'Subcontract', budget: 130, committed: 100 })
  })

  it('orders Labor, Material, Subcontract canonically', () => {
    expect(costTypeMix(lines).map((s) => s.costType)).toEqual(['Labor', 'Material', 'Subcontract'])
  })

  it('is empty-safe', () => {
    expect(costTypeMix([])).toEqual([])
  })
})
