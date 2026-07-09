// Deterministic, non-crypto hash of scope source text (Commitments, Phase 5).
// A scope-structure override is built against a specific run of source text; the
// sync rewrites that row byte-identical on every nightly run, so the override
// stays valid. The rare exception (a still-draft or re-executed commitment whose
// scope actually changed) is caught by comparing a stored `sourceHash` against the
// current source's hash — on a mismatch, the drawer falls back to the parser
// output instead of showing stale structure (Phase 5b).
//
// Pure + deterministic: same input → same output, no clock, no randomness. The
// hash is over the NORMALIZED text (whitespace collapsed + trimmed), so cosmetic
// whitespace changes from re-sync (or the parser's own normalization) don't read
// as a real change. Not for security — collision-resistance isn't required, only
// stable change-detection — so a fast FNV-1a is plenty.

/** Collapse internal whitespace to single spaces and trim. The one normalization
 *  the scope layer shares — `parseScope`, `hashText`, and (5c) the save-time
 *  concatenation invariant all compare against this shape. */
export function normalizeScope(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * FNV-1a (32-bit) hash of the normalized text, as an 8-char hex string. `Math.imul`
 * keeps the multiply in 32-bit space; `>>> 0` coerces to unsigned before hex.
 */
export function hashText(text: string | null | undefined): string {
  const norm = normalizeScope(text)
  let h = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i)
    h = Math.imul(h, 0x01000193) // FNV prime
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
