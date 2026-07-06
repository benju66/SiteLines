// Pure mapper: a `sitelines_rfi_detail` view row → the `ItemDetail` contract
// shape the drawer renders. Kept out of the component (and out of the Supabase
// source's plumbing) so it can be unit-tested against fixture JSON. Deterministic
// — no clock, no timezone math (response dates format from their ISO string parts).

import type { ItemAttachment, ItemDetail, ItemResponse } from '@/types'

/** Raw response object as the view emits it (jsonb_build_object). */
export interface RfiResponseRow {
  author: string | null
  date: string | null // ISO-ish, e.g. "2024-06-24" or "2024-06-24T15:04:05Z"
  text: string | null
  official: boolean | null
}

/** Raw attachment object as the view emits it. */
export interface RfiAttachmentRow {
  name: string | null
  url: string | null
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
  attachments: RfiAttachmentRow[] | null
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

/**
 * Best-effort HTML → plain text: strip tags, decode the common entities, drop
 * Procore's `_x000D_` carriage-return artifact and literal "null" tokens, and
 * collapse whitespace. Mirrors the pipeline's clean_procore_text so display text
 * is consistent whether it came pre-cleaned or as rich HTML.
 */
export function htmlToText(input: string | null | undefined): string {
  if (!input) return ''
  let s = String(input)
  s = s.replace(/<[^>]+>/g, ' ') // strip tags
  s = s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  s = s.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? ' ')
  s = s.replace(/_x000D_/g, ' ')
  s = s.replace(/\bnull\b/g, '')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Format an ISO date string to "Jun 24, 2024" from its parts — no `Date` parsing,
 * so no timezone drift and no clock dependency. Returns null for empty/malformed.
 */
export function formatResponseDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const [, y, mo, d] = m
  const month = MONTHS[Number(mo) - 1]
  if (!month) return null
  return `${month} ${Number(d)}, ${y}`
}

function cleanOrUndef(v: string | null | undefined): string | undefined {
  const t = htmlToText(v)
  return t.length > 0 ? t : undefined
}

// Only surface http(s) links — guards against a stray non-URL value becoming an href.
function safeUrl(v: string | null | undefined): string | undefined {
  const t = (v ?? '').trim()
  return /^https?:\/\//i.test(t) ? t : undefined
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

  const attachments: ItemAttachment[] = (row.attachments ?? [])
    .map((a) => ({ name: htmlToText(a.name) || 'Attachment', url: safeUrl(a.url) }))
    .filter((a): a is ItemAttachment => a.url !== undefined)

  const assignees = (row.assignees ?? '').trim()

  return {
    request: htmlToText(row.request),
    proposedSolution: cleanOrUndef(row.proposed_solution),
    instructions: cleanOrUndef(row.instructions),
    responses,
    assignees: assignees.length > 0 ? assignees : undefined,
    closedDate: formatResponseDate(row.closed_date),
    procoreUrl: safeUrl(row.procore_url),
    attachments,
  }
}
