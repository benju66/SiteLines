// Pure mapper: a `sitelines_commitments` view row → the `Commitment` shape the
// Commitments view renders. One row per real commitment (templates excluded in
// SQL). Deterministic — no clock. Postgres `numeric` arrives over the wire as a
// string (to preserve precision), so amounts are coerced with a guarded `num()`,
// mirroring mapBudgetLine. The view emits Procore's 0–100 percent_complete;
// the contract shape carries 0..1. Financial columns are NULL when the
// commitment has no requisition yet — `has_requisition` keeps that fact so the
// register can show "—" instead of a misleading $0.

import { formatShortDate } from '@/lib/derive'
import type { Commitment, CommitmentBilling, CommitmentChangeOrder, CommitmentLineItem, Project } from '@/types'

/** One row of the sitelines_commitments view (numerics arrive as strings). */
export interface CommitmentRow {
  project: string | null
  id: string
  number: string | null
  title: string | null
  vendor: string | null
  type: string | null
  status: string | null
  executed: boolean | null
  has_requisition: boolean | null
  original: number | string | null
  revised: number | string | null
  billed: number | string | null
  retainage: number | string | null
  pct_complete: number | string | null
  co_count: number | string | null
  co_total: number | string | null
  description: string | null
  delivery_date: string | null
  private: boolean | null
  inclusions: string | null
  exclusions: string | null
  grand_total: number | string | null
}

const num = (v: number | string | null): number => (v == null ? 0 : Number(v))

// Procore's inclusions/exclusions/description arrive HTML-stripped, but a few
// named entities survive the strip (verified in the master: `&amp;`, `&gt;`).
// Decode the common set so the drawer shows "R&D" not "R&amp;D". Pure — display
// derivation at the seam (DATA_CONTRACT §6), never mutating the stored raw.
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}
const decodeEntities = (s: string): string => s.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)

/** Map a commitments view row to the Commitment contract shape. */
export function mapCommitment(row: CommitmentRow): Commitment {
  return {
    project: (row.project ?? 'opiii') as Project,
    id: row.id,
    number: (row.number ?? '').trim(),
    title: (row.title ?? '').trim(),
    vendor: (row.vendor ?? '').trim(),
    type: row.type === 'PO' || row.type === 'SC' ? row.type : 'Other',
    status: (row.status ?? '').trim(),
    executed: !!row.executed,
    hasRequisition: !!row.has_requisition,
    original: num(row.original),
    revised: num(row.revised),
    billed: num(row.billed),
    retainage: num(row.retainage),
    pctComplete: num(row.pct_complete) / 100,
    coCount: num(row.co_count),
    coTotal: num(row.co_total),
    description: decodeEntities(row.description ?? ''),
    deliveryDate: row.delivery_date,
    private: !!row.private,
    inclusions: decodeEntities(row.inclusions ?? ''),
    exclusions: decodeEntities(row.exclusions ?? ''),
    grandTotal: num(row.grand_total),
  }
}

/** One row of the sitelines_commitment_line_items view (numerics arrive as strings). */
export interface CommitmentLineItemRow {
  project: string | null
  id: string
  commitment_id: string
  cost_code: string | null
  cost_code_name: string | null
  amount: number | string | null
  description: string | null
}

/** Map a commitment-line-item view row to the CommitmentLineItem contract shape. */
export function mapCommitmentLineItem(row: CommitmentLineItemRow): CommitmentLineItem {
  return {
    project: (row.project ?? 'opiii') as Project,
    id: row.id,
    commitmentId: row.commitment_id,
    costCode: (row.cost_code ?? '').trim(),
    costCodeName: (row.cost_code_name ?? '').trim(),
    amount: num(row.amount),
    description: decodeEntities((row.description ?? '').trim()),
  }
}

/** One row of the sitelines_commitment_change_orders view. */
export interface CommitmentChangeOrderRow {
  commitment: string
  number: string | null
  title: string | null
  amount: number | string | null
  status: string | null
  executed: boolean | null
  created_at: string | null
}

/** Map a CO-log view row to the CommitmentChangeOrder contract shape. */
export function mapCommitmentChangeOrder(row: CommitmentChangeOrderRow): CommitmentChangeOrder {
  const number = (row.number ?? '').trim()
  return {
    id: `${row.commitment}:co:${number}`,
    number,
    title: (row.title ?? '').trim(),
    amount: num(row.amount),
    status: (row.status ?? '').trim(),
    executed: !!row.executed,
    date: formatShortDate(row.created_at),
  }
}

/** One row of the sitelines_commitment_billings view. */
export interface CommitmentBillingRow {
  commitment: string
  number: string | null
  invoice_number: string | null
  period: string | null
  billing_date: string | null
  status: string | null
  pct_complete: number | string | null
  billed_to_date: number | string | null
  this_period: number | string | null
}

/** Map a billing-history view row to the CommitmentBilling contract shape. */
export function mapCommitmentBilling(row: CommitmentBillingRow): CommitmentBilling {
  const number = (row.number ?? '').trim()
  return {
    id: `${row.commitment}:req:${number}`,
    number,
    invoiceNumber: (row.invoice_number ?? '').trim(),
    period: (row.period ?? '').trim(),
    billingDate: formatShortDate(row.billing_date),
    status: (row.status ?? '').trim(),
    pctComplete: num(row.pct_complete) / 100,
    billedToDate: num(row.billed_to_date),
    thisPeriod: num(row.this_period),
  }
}
