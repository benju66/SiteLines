// Pure mapper: a `sitelines_submittal_detail` view row → the `ItemDetail` shape
// the drawer renders. A submittal's "thread" is its approver workflow — each
// reviewer's decision (`status`, e.g. "Approved as Noted"), optional comment,
// and return date. Unlike RFI answers, an approver row is meaningful even with
// no comment (the decision itself is the content), so those are kept.

import type { ItemDetail, ItemResponse } from '@/types'
import {
  cleanAssignees,
  formatResponseDate,
  htmlToText,
  mapAttachments,
  safeUrl,
  type RawAttachmentRow,
} from './detailText'

/** Raw approver row as the view emits it (jsonb_build_object). */
export interface SubmittalResponseRow {
  author: string | null
  date: string | null // ISO-ish
  text: string | null // comment (often empty)
  status: string | null // approver decision, e.g. "Approved as Noted"
  official: boolean | null
}

/** One row of the sitelines_submittal_detail view. */
export interface SubmittalDetailRow {
  id: string
  request: string | null
  responses: SubmittalResponseRow[] | null
  assignees: string | null // reviewer names
  closed_date: string | null // ISO timestamp
  procore_url: string | null
  final_submittal: RawAttachmentRow[] | null // the reviewed/stamped final doc
  attachments: RawAttachmentRow[] | null // originally-submitted documents
}

/** Map a submittal view row to the ItemDetail contract shape. */
export function mapSubmittalDetail(row: SubmittalDetailRow): ItemDetail {
  const responses: ItemResponse[] = (row.responses ?? [])
    .map((r) => {
      const status = (r.status ?? '').trim()
      return {
        author: (r.author ?? '').trim() || 'Unknown',
        date: formatResponseDate(r.date),
        text: htmlToText(r.text),
        official: !!r.official,
        status: status.length > 0 ? status : undefined,
      }
    })
    // Keep a reviewer row if it carries a comment OR a decision status.
    .filter((r) => r.text.length > 0 || r.status !== undefined)

  return {
    request: htmlToText(row.request),
    responses,
    assignees: cleanAssignees(row.assignees),
    closedDate: formatResponseDate(row.closed_date),
    procoreUrl: safeUrl(row.procore_url),
    attachments: mapAttachments(row.attachments),
    finalSubmittal: mapAttachments(row.final_submittal),
  }
}
