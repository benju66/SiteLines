// Pure emphasis segmentation for a scope prose block (Commitments, Phase 6c). Decides
// which runs of a block's text render bold and returns plain {text, strong} segments,
// so the view (CommitmentDrawer's renderProse) stays dumb and the rule is unit-tested.
//
// Precedence — *your bold wins per block*: when a block carries manual word-level bold
// (Phase 6c), ONLY those words render bold and the automatic Title-case sub-label
// bolding (Phase 2) is SUPPRESSED for that block; a block with no manual bold keeps
// auto-bolding exactly as before. Both are pure emphasis, never a text change, so the
// segments always concatenate back to the exact input text (`text` is untouched — the
// words-locked partition invariant is unaffected). Pure + deterministic (no clock).

import { SUBHEADER_LABEL } from '@/lib/parseScope'

export interface EmphasisSegment {
  text: string
  strong: boolean
}

/** Manual word-level bold: the space-split words at `bold` indices render strong; the
 *  single-space separators stay plain. Segments concatenate back to `text`. */
function manualBold(text: string, bold: number[]): EmphasisSegment[] {
  const set = new Set(bold)
  const segs: EmphasisSegment[] = []
  text.split(' ').forEach((w, i) => {
    if (i > 0) segs.push({ text: ' ', strong: false })
    segs.push({ text: w, strong: set.has(i) })
  })
  return segs
}

/** Auto-bold: inline Title-case sub-labels ("Kitchen Cabinets:", "Hardware:") — the
 *  sub-headers Procore's ordered lists collapse to once the sync strips their numbering. */
function autoBold(text: string): EmphasisSegment[] {
  const re = new RegExp(SUBHEADER_LABEL.source, 'g')
  const segs: EmphasisSegment[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const label = m[1]
    const start = m.index + m[0].length - label.length // skip the leading separator char
    if (start > last) segs.push({ text: text.slice(last, start), strong: false })
    segs.push({ text: label, strong: true })
    last = start + label.length
  }
  if (last < text.length) segs.push({ text: text.slice(last), strong: false })
  return segs
}

/**
 * The emphasis runs for a prose block: manual word-level bold when present (which
 * suppresses auto-bold for that block), else the automatic sub-label bolding.
 */
export function proseEmphasis(text: string, bold?: number[]): EmphasisSegment[] {
  if (bold && bold.length > 0) return manualBold(text, bold)
  return autoBold(text)
}
