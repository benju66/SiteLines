// Seed budget-pending exposure (Budget Insights, Phase 3). A small OP III fixture
// so seed mode renders the "Pending changes" forecast offline. In live mode these
// come from the `sitelines_budget_pending` view via mapBudgetPending().
//
// Mirrors the live shape: open change-event cost impact per cost code, including a
// de-scope credit (negative) and an "Unassigned" bucket (a change event with no
// cost code yet). Divisions/cost codes line up with the budgetLines fixture.

import type { BudgetPending } from '@/types'

export const BUDGET_PENDING: BudgetPending[] = [
  { project: 'opiii', division: '3 - Division 03 - Concrete', costCode: '3-33000.000 - Cast in Place Concrete', pendingAmount: 11000, openEvents: 1 },
  { project: 'opiii', division: '9 - Division 09 - Finishes', costCode: '9-99000.000 - Painting and Coating', pendingAmount: 6540, openEvents: 1 },
  { project: 'opiii', division: '10 - Division 10 - Specialties', costCode: '10-102819.000 - Tub and Shower Doors', pendingAmount: 727, openEvents: 1 },
  { project: 'opiii', division: '7 - Division 07 - Thermal and Mois', costCode: '7-72100.000 - Thermal Insulation', pendingAmount: -11000, openEvents: 1 },
  { project: 'opiii', division: 'Unassigned', costCode: 'Unassigned', pendingAmount: 5000, openEvents: 4 },
]
