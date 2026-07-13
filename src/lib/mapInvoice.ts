// Pure mapper: a `sitelines_invoices` view row → the `Invoice` shape the Invoicing
// view renders. One row per requisition (subcontractor pay app). Deterministic —
// no clock. Postgres `numeric` arrives over the wire as a string (to preserve
// precision), so amounts are coerced with a guarded `num()`, mirroring
// mapCommitment. The view emits Procore's 0–100 percent_complete; the contract
// shape carries 0..1. `is_latest` (computed in SQL, one per commitment) gates the
// rollup's cumulative sums so the app never double-counts cumulative G702 fields.

import type { Invoice, Project } from '@/types'

/** One row of the sitelines_invoices view (numerics arrive as strings). */
export interface InvoiceRow {
  project: string | null
  id: string
  number: string | null
  vendor: string | null
  contract: string | null
  commitment_id: string | null
  period: string | null
  billing_date: string | null
  status: string | null
  final: boolean | null
  is_latest: boolean | null
  this_period: number | string | null
  billed_to_date: number | string | null
  retainage: number | string | null
  pct_complete: number | string | null
  original: number | string | null
  revised: number | string | null
  net_change_by_cos: number | string | null
  earned_less_retainage: number | string | null
  balance_to_finish: number | string | null
}

const num = (v: number | string | null): number => (v == null ? 0 : Number(v))

/** Map an invoices view row to the Invoice contract shape. */
export function mapInvoice(row: InvoiceRow): Invoice {
  return {
    project: (row.project ?? 'opiii') as Project,
    id: row.id,
    number: (row.number ?? '').trim(),
    vendor: (row.vendor ?? '').trim(),
    contract: (row.contract ?? '').trim(),
    commitmentId: row.commitment_id,
    period: (row.period ?? '').trim(),
    // Kept as raw ISO (the view formats it) so the register sorts chronologically.
    billingDate: row.billing_date && row.billing_date.trim() ? row.billing_date.trim() : null,
    status: (row.status ?? '').trim(),
    final: !!row.final,
    isLatest: !!row.is_latest,
    thisPeriod: num(row.this_period),
    billedToDate: num(row.billed_to_date),
    retainage: num(row.retainage),
    pctComplete: num(row.pct_complete) / 100,
    original: num(row.original),
    revised: num(row.revised),
    netChangeByCOs: num(row.net_change_by_cos),
    earnedLessRetainage: num(row.earned_less_retainage),
    balanceToFinish: num(row.balance_to_finish),
  }
}
