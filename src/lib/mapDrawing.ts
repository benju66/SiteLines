// Pure mapper: a `sitelines_drawings` view row → the `Drawing` shape the log
// renders. One row per current sheet. Deterministic — no clock; dates are
// formatted from their ISO parts (formatResponseDate) and urls are guarded to
// http(s) only (safeUrl), reusing the shared detail-text helpers so drawings
// clean display text identically to the record mappers.

import type { Drawing } from '@/types'
import { formatResponseDate, htmlToText, safeUrl } from './detailText'

/** One row of the sitelines_drawings view (raw jsonb fields, still nullable). */
export interface DrawingRow {
  id: string
  drawing_id: string | null
  number: string | null
  title: string | null
  discipline: string | null
  revision: string | null
  drawing_date: string | null // ISO date "YYYY-MM-DD"
  received_date: string | null // ISO date "YYYY-MM-DD"
  set: string | null // drawing_set.name
  status: string | null
  thumbnail_url: string | null
  png_url: string | null
  pdf_url: string | null
}

/** Map a drawings view row to the Drawing contract shape. */
export function mapDrawing(row: DrawingRow): Drawing {
  return {
    id: row.id,
    drawingId: (row.drawing_id ?? '').trim(),
    number: (row.number ?? '').trim(),
    title: htmlToText(row.title),
    discipline: (row.discipline ?? '').trim() || 'Uncategorized',
    revision: (row.revision ?? '').trim(),
    drawingDate: formatResponseDate(row.drawing_date),
    receivedDate: formatResponseDate(row.received_date),
    set: (row.set ?? '').trim() || null,
    status: (row.status ?? '').trim(),
    thumbnailUrl: safeUrl(row.thumbnail_url) ?? null,
    pngUrl: safeUrl(row.png_url) ?? null,
    pdfUrl: safeUrl(row.pdf_url) ?? null,
  }
}
