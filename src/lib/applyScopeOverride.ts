// Resolve what a commitment's scope field should render (Commitments, Phase 5b).
// The read path for the user-authored override layer: given the flat source text
// and the stored override (if any), decide between the user's structure and the
// parser's best-effort outline, and flag staleness.
//
// Rules (pure + deterministic, no clock):
//   • no override (or an empty one) → the parser output (parseScope). Unchanged
//     behavior from before Phase 5.
//   • override whose sourceHash matches the current source → the override's blocks
//     (the user's hand-imposed structure wins).
//   • override whose sourceHash does NOT match → the source text changed in Procore
//     since the structure was saved, so fall back to the parser AND set `stale` so
//     the drawer can warn ("re-check your structure") instead of silently showing a
//     structure built on words that no longer match.
//
// Override blocks (ScopeBlockOverride: para/heading + explicit indent) map onto the
// ScopeBlock shape ScopeOutline already renders — marker/bullets are empty (the
// editor only produces prose/headings), and `indent` carries the nesting.

import { hashText } from '@/lib/hashText'
import { parseScope, type ScopeBlock } from '@/lib/parseScope'
import type { ScopeBlockOverride, ScopeOverride } from '@/types'

export interface ScopeRender {
  /** The blocks to hand to ScopeOutline. */
  blocks: ScopeBlock[]
  /** Which structure won — the user's override or the parser's outline. */
  source: 'override' | 'parser'
  /** True only when an override exists but was built on different source text. */
  stale: boolean
}

/**
 * Assign each `list:'number'` block its display ordinal (Phase 6a). Presentation
 * only — the number is computed here at render, never stored in `text`. A counter
 * runs per `indent` level: consecutive numbered blocks at the same level count
 * 1·2·3; a numbered block restarts any deeper runs beneath it (nested lists restart
 * under each parent); and any non-number block (prose, heading, bullet) breaks — and
 * so resets — the run at its own level and deeper. Pure + deterministic. Blocks that
 * aren't `list:'number'` pass through untouched.
 */
export function annotateOrdinals(blocks: ScopeBlock[]): ScopeBlock[] {
  const counters: number[] = [] // counters[d] = running count at indent depth d
  return blocks.map((b) => {
    const depth = Math.max(0, b.indent ?? 0)
    if (b.list === 'number') {
      counters.length = depth + 1 // a shallower number restarts any deeper runs
      counters[depth] = (counters[depth] ?? 0) + 1
      return { ...b, ordinal: counters[depth] }
    }
    counters.length = depth // a non-number block breaks the run at its level (and below)
    return b
  })
}

/** Map the flat override block list onto the parser's ScopeBlock render shape,
 *  carrying the presentation-only `list` style through and computing ordinals. */
function overrideToBlocks(blocks: ScopeBlockOverride[]): ScopeBlock[] {
  return annotateOrdinals(blocks.map((b) => ({ kind: b.kind, marker: null, text: b.text, bullets: [], indent: b.indent, list: b.list })))
}

export function applyScopeOverride(source: string, override?: ScopeOverride): ScopeRender {
  // An empty override is degenerate (the editor's invariant guarantees non-empty
  // blocks for non-empty source) — treat it as absent rather than render nothing.
  if (!override || override.blocks.length === 0) {
    return { blocks: parseScope(source), source: 'parser', stale: false }
  }
  if (override.sourceHash === hashText(source)) {
    return { blocks: overrideToBlocks(override.blocks), source: 'override', stale: false }
  }
  return { blocks: parseScope(source), source: 'parser', stale: true }
}
