// Pure mapper: a `sitelines_budget_lines` view row → the `BudgetLine` shape the
// Budget cost-control view renders. One row per budget line (cost code × cost
// type) in the primary cost budget. Deterministic — no clock. Postgres `numeric`
// arrives over the wire as a string (to preserve precision), so amounts are
// coerced with a guarded `num()`, mirroring supabaseSource. `jtd_costs` is kept
// nullable (it's null in the budget view — actuals live in direct costs).

import type { BudgetLine, Project } from '@/types'

/** One row of the sitelines_budget_lines view (numerics arrive as strings). */
export interface BudgetLineRow {
  project: string | null
  division: string | null
  cost_code: string | null
  category: string | null
  budget: number | string | null
  committed: number | string | null
  jtd_costs: number | string | null
  eac: number | string | null
  pending_cos: number | string | null
  projected_over_under: number | string | null
}

const num = (v: number | string | null): number => (v == null ? 0 : Number(v))

/** Map a budget-lines view row to the BudgetLine contract shape. */
export function mapBudgetLine(row: BudgetLineRow): BudgetLine {
  return {
    project: (row.project ?? 'opiii') as Project,
    division: (row.division ?? '').trim() || 'Uncategorized',
    costCode: (row.cost_code ?? '').trim(),
    costType: (row.category ?? '').trim(),
    budget: num(row.budget),
    committed: num(row.committed),
    jtdCosts: row.jtd_costs == null ? null : Number(row.jtd_costs),
    eac: num(row.eac),
    pendingCos: num(row.pending_cos),
    projectedOverUnder: num(row.projected_over_under),
  }
}
