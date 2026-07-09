// Pure block-editing operations for the scope-structure editor (Commitments,
// Phase 5c). The editor's safety invariant is that the WORDS ARE LOCKED — every
// operation only restructures, never edits text — so the block list is always a
// partition of the normalized source. That means for every op below:
//
//   normalizeScope(blocks.map(b => b.text).join(' ')) is invariant.
//
// The four editing powers (owner-locked): split a block at a word boundary · mark
// a block heading/para · indent/outdent · merge into the previous block. Plus the
// initial seed (a structured start when there's no override) and the on-save
// partition check. All pure + deterministic (no clock); the provider does the I/O.

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
 * Split block `index` so a new block starts at word `wordIndex` (1-based count of
 * words that stay in the first block). Both halves keep the original kind + indent;
 * out-of-range cuts (0 or ≥ word count) are no-ops. Concatenation is preserved
 * because the words are only regrouped, never changed.
 */
export function splitBlock(blocks: ScopeBlockOverride[], index: number, wordIndex: number): ScopeBlockOverride[] {
  const b = blocks[index]
  if (!b) return blocks
  const words = b.text.split(' ')
  if (wordIndex <= 0 || wordIndex >= words.length) return blocks
  const first: ScopeBlockOverride = { ...b, text: words.slice(0, wordIndex).join(' ') }
  const second: ScopeBlockOverride = { ...b, text: words.slice(wordIndex).join(' ') }
  return [...blocks.slice(0, index), first, second, ...blocks.slice(index + 1)]
}

/**
 * Merge block `index` into the previous block (text joined with a single space).
 * The result keeps the PREVIOUS block's kind + indent. No-op on the first block or
 * an out-of-range index. Concatenation is preserved.
 */
export function mergeUp(blocks: ScopeBlockOverride[], index: number): ScopeBlockOverride[] {
  if (index <= 0 || index >= blocks.length) return blocks
  const prev = blocks[index - 1]
  const cur = blocks[index]
  const merged: ScopeBlockOverride = { ...prev, text: `${prev.text} ${cur.text}` }
  return [...blocks.slice(0, index - 1), merged, ...blocks.slice(index + 1)]
}

/** Set block `index`'s kind (heading ⇄ para). */
export function setKind(blocks: ScopeBlockOverride[], index: number, kind: ScopeBlockOverride['kind']): ScopeBlockOverride[] {
  if (!blocks[index]) return blocks
  return blocks.map((b, i) => (i === index ? { ...b, kind } : b))
}

/** Change block `index`'s nesting by `delta`, clamped to [0, MAX_INDENT]. */
export function reindent(blocks: ScopeBlockOverride[], index: number, delta: number): ScopeBlockOverride[] {
  const b = blocks[index]
  if (!b) return blocks
  const indent = Math.min(MAX_INDENT, Math.max(0, b.indent + delta))
  return blocks.map((x, i) => (i === index ? { ...x, indent } : x))
}

/**
 * The load-bearing safety check, asserted on save: do these blocks still spell out
 * exactly the source text (ignoring whitespace)? True for anything the ops above
 * produce; a false here means a bug leaked typed text in, so the caller refuses the
 * save rather than let the rendered scope diverge from the executed contract.
 */
export function partitionsSource(blocks: ScopeBlockOverride[], source: string): boolean {
  return normalizeScope(blocks.map((b) => b.text).join(' ')) === normalizeScope(source)
}
