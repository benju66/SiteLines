// Pure mapper: the `punch-detail` edge function's payload → the `ItemDetail` the record
// drawer renders. The punch "thread" is the assignment WORKFLOW (each sub's assignment +
// its status/dates), which maps onto ItemResponse; photos map onto ItemDetail.photos.
// Deterministic — no clock; dates via formatResponseDate, urls guarded via safeUrl.

import type { ItemDetail, ItemPhoto, ItemResponse } from '@/types'
import { formatResponseDate, htmlToText, safeUrl } from './detailText'

interface RawAssignment {
  login_information?: { name?: string | null } | null
  vendor?: { name?: string | null } | null
  comment?: string | null
  notified_at?: string | null
  responded_at?: string | null
  formatted_status?: string | null
  approved?: boolean | null
}
interface RawWebImage {
  thumbnail_url?: string | null
  url?: string | null
  name?: string | null
  filename?: string | null
}
/** The trimmed detail the `punch-detail` edge fn returns (a subset of Procore's
 *  /punch_items/{id}). */
export interface PunchDetailRow {
  description?: string | null
  rich_text_description?: string | null
  closed_at?: string | null
  assignments?: RawAssignment[] | null
  web_images?: RawWebImage[] | null
}

/** Map the punch-detail payload to the ItemDetail contract shape. */
export function mapPunchDetail(raw: PunchDetailRow): ItemDetail {
  const responses: ItemResponse[] = (raw.assignments ?? [])
    .filter((a): a is RawAssignment => !!a && typeof a === 'object')
    .map((a) => {
      const who = htmlToText(a.login_information?.name)
      const vendor = htmlToText(a.vendor?.name)
      const author = [who, vendor && vendor !== who ? vendor : ''].filter(Boolean).join(' · ') || 'Assignee'
      return {
        author,
        date: formatResponseDate(a.responded_at) ?? formatResponseDate(a.notified_at),
        text: htmlToText(a.comment),
        official: a.approved === true,
        status: htmlToText(a.formatted_status) || undefined,
      }
    })

  const photos: ItemPhoto[] = (raw.web_images ?? [])
    .filter((w): w is RawWebImage => !!w && typeof w === 'object')
    .map((w) => ({
      thumbnailUrl: safeUrl(w.thumbnail_url) ?? '',
      url: safeUrl(w.url) ?? safeUrl(w.thumbnail_url) ?? '',
      name: htmlToText(w.name) || htmlToText(w.filename) || 'Photo',
    }))
    .filter((p) => p.thumbnailUrl !== '')

  return {
    request: htmlToText(raw.rich_text_description) || htmlToText(raw.description),
    responses,
    attachments: [],
    closedDate: formatResponseDate(raw.closed_at),
    photos,
  }
}
