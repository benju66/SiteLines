// Parse a commitment's scope description into a structured outline (Commitments,
// Phase 2 fast-follow). Procore syncs the subcontract scope as ONE flat run of
// text — no HTML, no line breaks, no bullet glyphs — but the numbering survives:
// multi-word ALL-CAPS headings ("GENERAL REQUIREMENTS"), integer sections
// ("1. Use of Project Premises"), and decimal clauses ("1.1.", "2.13."), with
// occasional "Label: a; b" sub-lists. This recovers that structure so the drawer
// can render an indented outline instead of a wall of text.
//
// It's a HEURISTIC over prose, not a guaranteed 1:1 of the source PDF — kept
// deliberately conservative: a heading must be a run of 2+ all-caps words (so
// "OSHA", "COVID-19", "A.M.", a lone "WORK" don't trip it), a clause is matched
// before a bare section, and money/measurements like "8.125%" carry no trailing
// dot so they're never mistaken for a marker. Numbering that restarts under a new
// heading needs no special handling — blocks nest by marker shape, not a counter.
// When a description carries no markers at all, the whole thing comes back as one
// 'para' block, so the drawer degrades to the plain paragraph it showed before.
// Pure + deterministic (no clock); the raw description is never mutated/stored
// (DATA_CONTRACT §6 — derive at render).

export type ScopeKind = 'para' | 'heading' | 'lineitem' | 'section' | 'clause'

export interface ScopeBlock {
  kind: ScopeKind
  marker: string | null // "1" / "2.13" (sections/clauses), a cost code (lineitems), or null
  text: string // the block's lead text (marker + glyphs stripped)
  bullets: string[] // best-effort "Label: a; b; c" sub-items (empty when none)
  indent?: number // explicit nesting depth for override blocks (Phase 5b); parser
  // blocks derive indent from their kind and leave this unset
  list?: 'bullet' | 'number' // presentation-only list style on an override para block
  // (Phase 6a); drawn at render, never in `text`. Parser blocks leave this unset.
  ordinal?: number // the computed display number for a list:'number' block (Phase 6a),
  // assigned by annotateOrdinals; unset for bullets / plain / parser blocks
  bold?: number[] // presentation-only word-level emphasis on an override para block
  // (Phase 6c): indices into `text.split(' ')` to render bold. Drawn at render, never
  // in `text`. Parser blocks leave this unset.
  source?: 'user' // Phase 6b — present = a user-authored note (free text), rendered
  // with the tinted "Your note" treatment. Parser/contract blocks leave this unset.
}

// A run of 2+ ALL-CAPS words (letters, plus & or /), each 2+ chars — "SCOPE OF
// WORK", "ESTIMATED WORKFORCE REQUIRED TO ACHIEVE MILESTONE". Requiring a second
// word rejects lone acronyms ("OSHA") and caps fragments ("COVID", "WORK").
const HEADING = String.raw`[A-Z][A-Z&/]+(?:\s+[A-Z&/]{2,}){1,6}`
// A Schedule-of-Values line-item / spec-section cost code: "12-3530", "06 4023",
// "12-123530.000" — 1–2 digits, a dash or space, then 4–6 digits (optional
// ".000"). Only when a Capitalized title follows (after an optional " - "), so
// measurements ("12\" deep") and dates never match. Surfaces the cost codes the
// Budget↔Commitment cross-link (Phase 4) will join on.
const LINEITEM = String.raw`\d{1,2}[-\s]\d{4,6}(?:\.\d{1,3})?`
// A decimal clause: "1.1.", "2.13." (matched before a bare section so "1." inside
// "1.1." is never taken as a section).
const CLAUSE = String.raw`\d{1,3}\.\d{1,3}\.`
// A bare integer section, but only when a Capitalized title follows ("3. Vendor
// Responsibilities") — so "8.125%" and "$1,988,469.00" are never markers.
const SECTION = String.raw`\d{1,3}\.(?=\s+[A-Z])`
// The line-item code (group 2) is followed by a consumed " - " / space separator
// and a Capitalized title (lookahead), so the title lands in the block body, not
// the marker.
const MARKER = new RegExp(`(${HEADING})|(${LINEITEM})(?:\\s*-\\s*|\\s+)(?=[A-Z])|(${CLAUSE})|(${SECTION})`, 'g')

// A Title-case label ending in a colon ("Kitchen Cabinets:", "Hardware:",
// "General Scope:") — the sub-headers Procore's ordered lists become once the
// sync flattens away their numbering. NOT used to split structure (that would
// fragment GENERAL REQUIREMENTS clauses that carry colons like "Contract
// Documents:"); the drawer bolds these inline within prose blocks only. Requires
// each word capitalized, so lowercase connectors ("Basis of Design:", "Corner
// base cabinets:") don't match.
export const SUBHEADER_LABEL = /(?:^|[.\s])([A-Z][A-Za-z]+(?:\s+[A-Z&][A-Za-z]*){0,4}:)/g

/** Trailing dot off a marker for display: "2.13." → "2.13". */
const trimDot = (s: string) => s.replace(/\.$/, '')

/**
 * Best-effort split of a "Label: item; item; item" clause into a lead + bullets.
 * Anchors on the last ": " (colon-SPACE, so a time like "8:00" is ignored) that
 * precedes the first "; "; requires 2+ resulting items so ordinary prose with a
 * single semicolon isn't chopped up.
 */
function splitBullets(text: string): { lead: string; bullets: string[] } {
  const semi = text.indexOf('; ')
  if (semi === -1) return { lead: text, bullets: [] }
  let colon = -1
  for (let i = text.indexOf(': '); i !== -1 && i < semi; i = text.indexOf(': ', i + 1)) colon = i
  if (colon === -1) return { lead: text, bullets: [] }
  const parts = text
    .slice(colon + 1)
    .split(/;\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 2) return { lead: text, bullets: [] }
  return { lead: text.slice(0, colon + 1).trim(), bullets: parts }
}

export function parseScope(description: string | null | undefined): ScopeBlock[] {
  const text = (description ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return []

  const blocks: ScopeBlock[] = []
  let lastEnd = 0
  // The marker whose body text hasn't been captured yet (headings are
  // self-contained, so they never become pending). Only clauses/sections take
  // best-effort sub-bullets; a line-item's body is just its title.
  let pending: { kind: 'section' | 'clause' | 'lineitem'; marker: string } | null = null

  const flush = (end: number) => {
    const body = text.slice(lastEnd, end).trim()
    if (pending) {
      const { lead, bullets } = pending.kind === 'lineitem' ? { lead: body, bullets: [] as string[] } : splitBullets(body)
      blocks.push({ kind: pending.kind, marker: pending.marker, text: lead, bullets })
      pending = null
    } else if (body) {
      blocks.push({ kind: 'para', marker: null, text: body, bullets: [] })
    }
  }

  MARKER.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MARKER.exec(text)) !== null) {
    // Text between the previous marker and this one belongs to the previous marker
    // (or is preamble prose before the first marker).
    flush(m.index)
    if (m[1]) {
      // Heading — its own text, no trailing body of its own.
      blocks.push({ kind: 'heading', marker: null, text: m[1].trim(), bullets: [] })
    } else if (m[2]) {
      pending = { kind: 'lineitem', marker: m[2].trim() }
    } else if (m[3]) {
      pending = { kind: 'clause', marker: trimDot(m[3]) }
    } else {
      pending = { kind: 'section', marker: trimDot(m[4]) }
    }
    lastEnd = m.index + m[0].length
  }
  flush(text.length)
  return blocks
}
