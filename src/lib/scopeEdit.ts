// Pure block-editing operations for the scope-structure editor (Commitments,
// Phase 5c). The editor's safety invariant is that the CONTRACT WORDS ARE LOCKED —
// every operation on a contract block only restructures, never edits text — so the
// contract blocks are always a partition of the normalized source. That means for
// every op below, over the contract blocks (`source !== 'user'`):
//
//   normalizeScope(contractBlocks.map(b => b.text).join(' ')) is invariant.
//
// The restructuring powers (owner-locked): split a block at a word boundary · mark
// a block heading/para · indent/outdent · merge into the previous block · list style
// (6a) · word-level bold (6c). Phase 6b adds the ONE typing path — user-authored
// NOTES (`source:'user'` free text): they are excluded from the partition, so `addNote`
// / `setNoteText` / `removeNote` never touch the contract words. Plus the initial seed
// (a structured start when there's no override) and the on-save partition check. All
// pure + deterministic (no clock); the provider does the I/O.

import { hashText, normalizeScope } from '@/lib/hashText'
import type { ScopeBlockOverride, ScopeOverride } from '@/types'

/** Max nesting depth the editor allows (matches ScopeOutline's indent clamp). */
export const MAX_INDENT = 6

// Word classifiers for the seed heuristic. A bare integer section marker ("1.",
// "12."), a decimal clause marker ("1.1.", "2.13.", "1.1.1."), an ALL-CAPS word
// (heading candidate — trailing punctuation stripped, ≥2 caps so "OSHA"/"A.M."
// don't count as a run on their own), and a sentence terminator.
const SECTION_MARKER = /^\d{1,3}\.$/
const CLAUSE_MARKER = /^\d{1,3}(?:\.\d{1,3})+\.$/
const isCapsWord = (w: string): boolean => {
  const s = w.replace(/[.,:;]+$/, '')
  return /^[A-Z][A-Z&/]*$/.test(s) && (s.match(/[A-Z]/g)?.length ?? 0) >= 2
}
const endsSentence = (w: string) => /[.!?:]$/.test(w)
const clauseDepth = (w: string) => Math.min(MAX_INDENT, (w.match(/\./g)?.length ?? 2) - 1)

interface Seg {
  kind: ScopeBlockOverride['kind']
  indent: number
  marker: boolean // true = led by a numbered marker (kept whole, not sentence-split)
  words: string[]
}

/**
 * Segment source text into a starting block list. Rather than blindly break after
 * every period (which strands clause numbers at the end of the wrong line), this
 * breaks BEFORE structure: a run of ≥2 ALL-CAPS words becomes a `heading`; a numbered
 * section ("1. …") or decimal clause ("1.1. …") starts its own block LED by its
 * number (indented by depth); and any free prose in between is sentence-split so a
 * wall reads as lines. Numbered clauses are kept whole (not sentence-split). Every
 * word lands in exactly one block, so the result is always a partition of the
 * normalized source — the save-time invariant holds regardless.
 */
export function segmentSource(source: string): ScopeBlockOverride[] {
  const norm = normalizeScope(source)
  if (!norm) return []
  const words = norm.split(' ')
  const caps = words.map(isCapsWord)
  // A heading word = caps AND adjacent to another caps word (a run of ≥2).
  const inHeadingRun = words.map((_, i) => caps[i] && (!!caps[i - 1] || !!caps[i + 1]))

  const segs: Seg[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const next = words[i + 1]
    const last = segs[segs.length - 1] ?? null
    let open: Seg | null = null
    if (CLAUSE_MARKER.test(w)) open = { kind: 'para', indent: clauseDepth(w), marker: true, words: [] }
    else if (SECTION_MARKER.test(w) && next !== undefined && /^[A-Z]/.test(next)) open = { kind: 'para', indent: 0, marker: true, words: [] }
    // A heading run only starts a heading at a sentence boundary, so a mid-clause
    // caps phrase ("Provide OSHA SAFETY training") doesn't split the clause.
    else if (inHeadingRun[i] && !inHeadingRun[i - 1] && (i === 0 || endsSentence(words[i - 1]))) open = { kind: 'heading', indent: 0, marker: false, words: [] }
    else if (last === null || (last.kind === 'heading' && !inHeadingRun[i])) open = { kind: 'para', indent: 0, marker: false, words: [] }
    if (open) segs.push(open)
    const target = segs[segs.length - 1]
    if (target) target.words.push(w)
  }

  // Sentence-split only free-prose blocks (not marker-led, not headings) so a wall
  // of prose reads as lines while numbered clauses + headings stay intact.
  const blocks: ScopeBlockOverride[] = []
  for (const seg of segs) {
    const text = seg.words.join(' ')
    if (seg.kind === 'para' && !seg.marker) {
      for (const s of text.split(/(?<=[.!?])\s+/)) {
        const t = s.trim()
        if (t) blocks.push({ kind: 'para', indent: seg.indent, text: t })
      }
    } else {
      blocks.push({ kind: seg.kind, indent: seg.indent, text })
    }
  }
  return blocks
}

/**
 * The block list the editor opens with: a fresh override's own blocks (hash
 * matches the current source), else a fresh segmentation of the source. A STALE
 * override is not reused — its blocks were built on words that no longer match, so
 * seeding from them could violate the partition; segment the current source instead.
 */
export function seedEditorBlocks(source: string, override?: ScopeOverride): ScopeBlockOverride[] {
  if (override && override.blocks.length > 0 && override.sourceHash === hashText(source)) {
    return override.blocks
  }
  return segmentSource(source)
}

/**
 * Set a block's presentation-only `bold` word indices (Phase 6c), dropping the key
 * entirely when the set is empty (rather than storing `[]`) so "absent = no manual
 * bold" stays canonical. Used by the ops below to re-attach re-mapped bold sets.
 */
function withBold(b: ScopeBlockOverride, bold: number[]): ScopeBlockOverride {
  if (bold.length === 0) {
    const next = { ...b }
    delete next.bold
    return next
  }
  return { ...b, bold }
}

/**
 * Split block `index` so a new block starts at word `wordIndex` (1-based count of
 * words that stay in the first block). Both halves keep the original kind + indent;
 * out-of-range cuts (0 or ≥ word count) are no-ops. Concatenation is preserved
 * because the words are only regrouped, never changed. Bold indices (Phase 6c) are
 * re-mapped so emphasis follows the words: the first half keeps indices `< wordIndex`,
 * the second keeps indices `≥ wordIndex` offset by `− wordIndex`.
 */
export function splitBlock(blocks: ScopeBlockOverride[], index: number, wordIndex: number): ScopeBlockOverride[] {
  const b = blocks[index]
  if (!b) return blocks
  const words = b.text.split(' ')
  if (wordIndex <= 0 || wordIndex >= words.length) return blocks
  const bold = b.bold ?? []
  const first = withBold({ ...b, text: words.slice(0, wordIndex).join(' ') }, bold.filter((i) => i < wordIndex))
  const second = withBold({ ...b, text: words.slice(wordIndex).join(' ') }, bold.filter((i) => i >= wordIndex).map((i) => i - wordIndex))
  return [...blocks.slice(0, index), first, second, ...blocks.slice(index + 1)]
}

/**
 * Merge block `index` into the previous block (text joined with a single space).
 * The result keeps the PREVIOUS block's kind + indent. No-op on the first block or
 * an out-of-range index. Concatenation is preserved. Bold indices (Phase 6c) follow
 * their words: `prev`'s indices are kept, then `cur`'s are appended offset by `prev`'s
 * word count. Phase 6b — a cross-`source` merge is refused (a no-op): merging a note
 * into contract words would splice free text into the contract partition, and merging
 * contract words into a note would drop them out of it — either way the partition would
 * break. A merge only joins two contract blocks, or two notes.
 */
export function mergeUp(blocks: ScopeBlockOverride[], index: number): ScopeBlockOverride[] {
  if (index <= 0 || index >= blocks.length) return blocks
  const prev = blocks[index - 1]
  const cur = blocks[index]
  if (prev.source !== cur.source) return blocks
  const offset = prev.text.split(' ').length
  const bold = [...(prev.bold ?? []), ...(cur.bold ?? []).map((i) => i + offset)]
  const merged = withBold({ ...prev, text: `${prev.text} ${cur.text}` }, bold)
  return [...blocks.slice(0, index - 1), merged, ...blocks.slice(index + 1)]
}

/**
 * Toggle word `wordIndex`'s bold on block `index` (Phase 6c). Presentation only: it
 * only records WHICH existing words render bold (never changes `text`), so
 * `partitionsSource` is invariant across this op. The index set is kept sorted + in
 * range; toggling off the last bold word drops the `bold` key. No-op for an
 * out-of-range block or word index.
 */
export function toggleBold(blocks: ScopeBlockOverride[], index: number, wordIndex: number): ScopeBlockOverride[] {
  const b = blocks[index]
  if (!b) return blocks
  if (wordIndex < 0 || wordIndex >= b.text.split(' ').length) return blocks
  const current = b.bold ?? []
  const next = current.includes(wordIndex)
    ? current.filter((i) => i !== wordIndex)
    : [...current, wordIndex].sort((x, y) => x - y)
  return blocks.map((x, i) => (i === index ? withBold(x, next) : x))
}

/** Set block `index`'s kind (heading ⇄ para). */
export function setKind(blocks: ScopeBlockOverride[], index: number, kind: ScopeBlockOverride['kind']): ScopeBlockOverride[] {
  if (!blocks[index]) return blocks
  return blocks.map((b, i) => (i === index ? { ...b, kind } : b))
}

/**
 * Set block `index`'s list style — 'bullet' | 'number' | undefined to clear
 * (Phase 6a). Presentation only: the `•`/ordinal is drawn at render and the words
 * are untouched, so `partitionsSource` is invariant across this op. Clearing drops
 * the `list` key entirely rather than storing `undefined`.
 */
export function setList(blocks: ScopeBlockOverride[], index: number, list: ScopeBlockOverride['list']): ScopeBlockOverride[] {
  if (!blocks[index]) return blocks
  return blocks.map((b, i) => {
    if (i !== index) return b
    if (list) return { ...b, list }
    const next = { ...b }
    delete next.list
    return next
  })
}

/** Change block `index`'s nesting by `delta`, clamped to [0, MAX_INDENT]. */
export function reindent(blocks: ScopeBlockOverride[], index: number, delta: number): ScopeBlockOverride[] {
  const b = blocks[index]
  if (!b) return blocks
  const indent = Math.min(MAX_INDENT, Math.max(0, b.indent + delta))
  return blocks.map((x, i) => (i === index ? { ...x, indent } : x))
}

// ── Your-own-notes (Phase 6b) — the one typing path. Notes are `source:'user'` free
// text, excluded from the partition (see partitionsSource) and shown clearly marked.

/** True for a user-authored note block (Phase 6b). */
export const isNote = (b: ScopeBlockOverride): boolean => b.source === 'user'

/**
 * Insert a fresh, empty note (`source:'user'`) after block `index` (Phase 6b). Pass
 * `-1` to prepend. Notes are freestanding — addable anywhere, at indent 0 — so this
 * just splices a blank note in; the words-locked partition is unaffected because a note
 * carries no contract words. The caller types into it via `setNoteText`.
 */
export function addNote(blocks: ScopeBlockOverride[], index: number): ScopeBlockOverride[] {
  const note: ScopeBlockOverride = { kind: 'para', indent: 0, text: '', source: 'user' }
  const at = Math.min(Math.max(index + 1, 0), blocks.length)
  return [...blocks.slice(0, at), note, ...blocks.slice(at)]
}

/**
 * Set a note's text (Phase 6b) — the ONLY op that writes `text`, and ONLY on a
 * `source:'user'` block. A no-op on a contract block (or an out-of-range index), so
 * typing can never reach the contract words. Text is stored verbatim as typed.
 */
export function setNoteText(blocks: ScopeBlockOverride[], index: number, text: string): ScopeBlockOverride[] {
  const b = blocks[index]
  if (!b || !isNote(b)) return blocks
  return blocks.map((x, i) => (i === index ? { ...x, text } : x))
}

/**
 * Remove note `index` (Phase 6b) — ONLY a `source:'user'` block. A no-op on a contract
 * block, so the words-locked partition can never lose contract words this way (deleting
 * contract words is not an editor power; only restructuring is).
 */
export function removeNote(blocks: ScopeBlockOverride[], index: number): ScopeBlockOverride[] {
  const b = blocks[index]
  if (!b || !isNote(b)) return blocks
  return blocks.filter((_, i) => i !== index)
}

/**
 * Drop notes whose text is empty/whitespace-only (Phase 6b), applied before save so a
 * stray "Add note" click can't persist a blank row. Contract blocks are never touched.
 */
export function dropEmptyNotes(blocks: ScopeBlockOverride[]): ScopeBlockOverride[] {
  return blocks.filter((b) => !isNote(b) || b.text.trim() !== '')
}

/**
 * The load-bearing safety check, asserted on save: do the CONTRACT blocks still spell
 * out exactly the source text (ignoring whitespace)? True for anything the ops above
 * produce; a false here means a bug leaked typed text into the contract, so the caller
 * refuses the save rather than let the rendered contract scope diverge from what was
 * executed.
 *
 * Phase 6b — the one safety-model change: user-authored notes (`source: 'user'`) are
 * free text, so they are EXCLUDED from the partition before the check. Only the
 * contract blocks must reconstruct the source; the assertion's spirit — the drawer can
 * never show altered *contract* language — is unchanged. `setNoteText` is the only op
 * that writes `text`, and only on a note, so a note can never be an escape hatch for
 * editing the contract words.
 */
export function partitionsSource(blocks: ScopeBlockOverride[], source: string): boolean {
  const contract = blocks.filter((b) => b.source !== 'user')
  return normalizeScope(contract.map((b) => b.text).join(' ')) === normalizeScope(source)
}
