// Shared, pure text/shape helpers for the record-detail mappers (RFIs,
// submittals, …). Deterministic — no clock, no timezone math. Kept in one place
// so every per-tool mapper cleans display text and dates identically.

import type { ItemAttachment } from '@/types'

/** Raw attachment object as the detail views emit it (jsonb_build_object). */
export interface RawAttachmentRow {
  name: string | null
  url: string | null
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

/** htmlToText, but empty → undefined (for optional narrative fields). */
export function cleanOrUndef(v: string | null | undefined): string | undefined {
  const t = htmlToText(v)
  return t.length > 0 ? t : undefined
}

/** Only surface http(s) links — guards a stray non-URL value becoming an href. */
export function safeUrl(v: string | null | undefined): string | undefined {
  const t = (v ?? '').trim()
  return /^https?:\/\//i.test(t) ? t : undefined
}

/** Clean a comma-joined party list; empty → undefined. */
export function cleanAssignees(v: string | null | undefined): string | undefined {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : undefined
}

/** Map raw attachment rows to ItemAttachments, dropping any without an http(s) url. */
export function mapAttachments(rows: RawAttachmentRow[] | null | undefined): ItemAttachment[] {
  return (rows ?? [])
    .map((a) => ({ name: htmlToText(a.name) || 'Attachment', url: safeUrl(a.url) }))
    .filter((a): a is ItemAttachment => a.url !== undefined)
}
