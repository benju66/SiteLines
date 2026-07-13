// Pure mapper: a `sitelines_change_events` view row → the `ChangeEvent` shape the
// Change Events view renders. One row per change event (OP III). Deterministic —
// no clock. Postgres `numeric` arrives over the wire as a string (to preserve
// precision), so amounts are coerced with a guarded `num()`, mirroring
// mapCommitment. The view emits raw DOLLARS; the selector layer formats $/% and
// computes the rollup + breakdowns (never stored — DATA_CONTRACT §6).

import { formatShortDate } from '@/lib/derive'
import type { ChangeEvent, ChangeEventLineItem, Project } from '@/types'

/** One row of the sitelines_change_events view (numerics arrive as strings). */
export interface ChangeEventRow {
  project: string | null
  id: string
  number: string | null
  title: string | null
  status: string | null
  scope: string | null
  type: string | null
  reason: string | null
  est_cost: number | string | null
  line_items: number | string | null
  commitments: number | string | null
  origin_rfi: boolean | null
  description: string | null
  created_at: string | null
}

const num = (v: number | string | null): number => (v == null ? 0 : Number(v))

// Procore's description/reason arrive HTML-stripped, but a few named entities
// survive the strip (verified in the commitments master: `&amp;`, `&gt;`). Decode
// the common set so the view shows "R&D" not "R&amp;D". Pure display derivation at
// the seam (DATA_CONTRACT §6), never mutating the stored raw. (Same set as
// mapCommitment — kept local so each mapper stays self-contained.)
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

/** Map a change-events view row to the ChangeEvent contract shape. */
export function mapChangeEvent(row: ChangeEventRow): ChangeEvent {
  return {
    project: (row.project ?? 'opiii') as Project,
    id: row.id,
    number: (row.number ?? '').trim(),
    title: decodeEntities((row.title ?? '').trim()),
    status: (row.status ?? '').trim(),
    scope: (row.scope ?? '').trim(),
    type: (row.type ?? '').trim(),
    reason: decodeEntities((row.reason ?? '').trim()),
    estCost: num(row.est_cost),
    lineItems: num(row.line_items),
    commitments: num(row.commitments),
    originRfi: !!row.origin_rfi,
    description: decodeEntities((row.description ?? '').trim()),
    createdAt: formatShortDate(row.created_at),
  }
}

/** One row of the sitelines_change_event_line_items view (numerics arrive as strings). */
export interface ChangeEventLineItemRow {
  project: string | null
  id: string
  change_event_id: string
  cost_code: string | null
  cost_code_name: string | null
  amount: number | string | null
  description: string | null
  commitment_number: string | null
  commitment_id: string | null
}

/** Map a change-event-line-item view row to the ChangeEventLineItem contract shape. */
export function mapChangeEventLineItem(row: ChangeEventLineItemRow): ChangeEventLineItem {
  return {
    project: (row.project ?? 'opiii') as Project,
    id: row.id,
    changeEventId: row.change_event_id,
    costCode: (row.cost_code ?? '').trim(),
    costCodeName: (row.cost_code_name ?? '').trim(),
    amount: num(row.amount),
    description: decodeEntities((row.description ?? '').trim()),
    commitmentNumber: (row.commitment_number ?? '').trim(),
    commitmentId: row.commitment_id,
  }
}
