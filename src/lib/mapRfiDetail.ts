// Pure mapper: a `sitelines_rfi_detail` view row → the `ItemDetail` contract
// shape the drawer renders. Kept out of the component (and out of the Supabase
// source's plumbing) so it can be unit-tested against fixture JSON. Deterministic
// — no clock, no timezone math (response dates format from their ISO string parts).

import type { ItemDetail, ItemResponse } from '@/types'
import {
  cleanAssignees,
  cleanOrUndef,
  formatResponseDate,
  htmlToText,
  mapAttachments,
  safeUrl,
  type RawAttachmentRow,
} from './detailText'

// Re-exported so existing callers/tests keep importing these from here.
export { formatResponseDate, htmlToText }

/** Raw response object as the view emits it (jsonb_build_object). */
export interface RfiResponseRow {
  author: string | null
  date: string | null // ISO-ish, e.g. "2024-06-24" or "2024-06-24T15:04:05Z"
  text: string | null
  official: boolean | null
}

/** One row of the sitelines_rfi_detail view. */
export interface RfiDetailRow {
  id: string
  request: string | null
  proposed_solution: string | null
  instructions: string | null
  responses: RfiResponseRow[] | null
  assignees: string | null
  closed_date: string | null // ISO timestamp
  procore_url: string | null
  attachments: RawAttachmentRow[] | null
}

/** Map a view row to the ItemDetail contract shape (drops empty responses). */
export function mapRfiDetail(row: RfiDetailRow): ItemDetail {
  const responses: ItemResponse[] = (row.responses ?? [])
    .map((r) => ({
      author: (r.author ?? '').trim() || 'Unknown',
      date: formatResponseDate(r.date),
      text: htmlToText(r.text),
      official: !!r.official,
    }))
    .filter((r) => r.text.length > 0)

  return {
    request: htmlToText(row.request),
    proposedSolution: cleanOrUndef(row.proposed_solution),
    instructions: cleanOrUndef(row.instructions),
    responses,
    assignees: cleanAssignees(row.assignees),
    closedDate: formatResponseDate(row.closed_date),
    procoreUrl: safeUrl(row.procore_url),
    attachments: mapAttachments(row.attachments),
  }
}
