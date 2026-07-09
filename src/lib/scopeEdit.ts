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

// A fragment that is nothing but a list marker — "1.", "2.5.", "3" — left stranded
// when the sentence splitter cuts right after its trailing dot. These get re-joined
// to the clause that follows so a numbered scope doesn't shatter into tiny pieces.
const BARE_MARKER = /^\d+(?:\.\d+)*\.?$/

/**
 * Segment source text into a starting block list — roughly one `para` per sentence,
 * so the editor opens on something already broken up rather than one wall. Splits
 * after a sentence terminator followed by whitespace (a decimal like "8.125%" has no
 * space after its dot, so it never splits there), then re-attaches any bare list
 * marker ("2.5.") to the clause after it. Always a partition of the normalized words.
 */
export function segmentSource(source: string): ScopeBlockOverride[] {
  const norm = normalizeScope(source)
  if (!norm) return []
  const parts = norm
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const merged: string[] = []
  for (const part of parts) {
    const prev = merged[merged.length - 1]
    if (prev !== undefined && BARE_MARKER.test(prev)) merged[merged.length - 1] = `${prev} ${part}`
    else merged.push(part)
  }
  return merged.map((text) => ({ kind: 'para' as const, indent: 0, text }))
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
