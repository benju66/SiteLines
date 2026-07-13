// Pure mapper: a `sitelines_invoices` view row → the `Invoice` shape the Invoicing
// view renders. One row per requisition (subcontractor pay app). Deterministic —
// no clock. Postgres `numeric` arrives over the wire as a string (to preserve
// precision), so amounts are coerced with a guarded `num()`, mirroring
// mapCommitment. The view emits Procore's 0–100 percent_complete; the contract
// shape carries 0..1. `is_latest` (computed in SQL, one per commitment) gates the
// rollup's cumulative sums so the app never double-counts cumulative G702 fields.

import type { Invoice, InvoiceLineItem, Project } from '@/types'

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

/** One row of the sitelines_invoice_line_items view (numerics arrive as strings). */
export interface InvoiceLineItemRow {
  project: string | null
  id: string
  invoice_id: string
  item_number: string | null
  description: string | null
  scheduled_value: number | string | null
  from_previous: number | string | null
  this_period: number | string | null
  stored: number | string | null
  billed_to_date: number | string | null
  pct_complete: number | string | null
  retainage: number | string | null
  balance_to_finish: number | string | null
}

/** Map an invoice-line-item view row to the InvoiceLineItem contract shape. */
export function mapInvoiceLineItem(row: InvoiceLineItemRow): InvoiceLineItem {
  return {
    project: (row.project ?? 'opiii') as Project,
    id: row.id,
    invoiceId: row.invoice_id,
    itemNumber: (row.item_number ?? '').trim(),
    description: (row.description ?? '').trim(),
    scheduledValue: num(row.scheduled_value),
    fromPrevious: num(row.from_previous),
    thisPeriod: num(row.this_period),
    stored: num(row.stored),
    billedToDate: num(row.billed_to_date),
    pctComplete: num(row.pct_complete) / 100,
    retainage: num(row.retainage),
    balanceToFinish: num(row.balance_to_finish),
  }
}
