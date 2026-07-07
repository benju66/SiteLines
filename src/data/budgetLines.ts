// Seed budget lines (Budget Insights, Phase 1). A small OP III fixture so seed
// mode (VITE_DATA_SOURCE=seed) renders the cost-control drill-down offline. In
// live mode these come from the `sitelines_budget_lines` view via mapBudgetLine().
//
// Chosen to exercise the selector: divisions out of natural order (9 before 10,
// leading-number sort), a natural cost-code sort within a division, a cost code
// that splits across two cost types (Thermal Insulation: Material + Subcontract),
// over-budget lines (negative projectedOverUnder → red), and an over-committed
// line (committed > budget). Amounts are real OP III figures, rounded.

import type { BudgetLine } from '@/types'

export const BUDGET_LINES: BudgetLine[] = [
  bl('1 - Division 01 - General Conditions', '1-10320.000 - Sr Project Manager', 'Labor', 303966, 0, -5994),
  bl('1 - Division 01 - General Conditions', '1-10420.000 - Superintendent', 'Labor', 281450, 0, 65990),
  bl('3 - Division 03 - Concrete', '3-33000.000 - Cast in Place Concrete', 'Subcontract', 972411, 980894, -8483),
  bl('3 - Division 03 - Concrete', '3-34100.000 - Precast Structural Concrete', 'Subcontract', 849377, 849366, 0),
  bl('7 - Division 07 - Thermal and Mois', '7-72100.000 - Thermal Insulation', 'Material', 0, 0, -82953),
  bl('7 - Division 07 - Thermal and Mois', '7-72100.000 - Thermal Insulation', 'Subcontract', 301685, 223242, 0),
  bl('9 - Division 09 - Finishes', '9-92116.000 - Gypsum Board Assemblies', 'Subcontract', 1002072, 1005303, -3231),
  bl('9 - Division 09 - Finishes', '9-99000.000 - Painting and Coating', 'Subcontract', 234627, 275934, -41307),
  bl('10 - Division 10 - Specialties', '10-102819.000 - Tub and Shower Doors', 'Subcontract', 101331, 98175, 3156),
]

/** Compact fixture builder — EAC derived so it's consistent with over/under
 *  (Projected over Under = Revised Budget − EAC); erpJtd (actual spent) defaults
 *  to ~85% of EAC so the Job-to-Date / Forecast-to-Complete columns render. No
 *  pending COs / cost changes in seed. */
function bl(
  division: string,
  costCode: string,
  costType: string,
  budget: number,
  committed: number,
  projectedOverUnder: number,
  erpJtd?: number,
): BudgetLine {
  const eac = budget - projectedOverUnder
  return {
    project: 'opiii',
    division,
    costCode,
    costType,
    budget,
    committed,
    jtdCosts: null,
    erpJtd: erpJtd ?? Math.round(eac * 0.85),
    directCosts: 0,
    eac,
    pendingCos: 0,
    pendingCostChanges: 0,
    projectedOverUnder,
  }
}
