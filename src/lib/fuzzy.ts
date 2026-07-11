// Search matcher for the in-table filters (Budget · Commitments · Drawings · the
// tool registers). Hand-rolled + dependency-free (the app takes no UI/search
// libraries — see the guardrails).
//
// A forgiving "contains" filter: case-insensitive, multi-term (whitespace-split),
// and order-independent — every term must appear as a SUBSTRING of the text, in
// any order. So "gyp board" and "board gyp" both match "Gypsum Board", and
// "casework 12" matches "12-123530.000 - Residential Casework" (one field holds
// both terms). Deliberately a substring match, NOT a loose character-subsequence:
// a subsequence lets a short/common query like "A2" match almost anything ("a"…"2"
// scattered across a title), which reads as broken. Substring keeps short queries
// precise ("A2" → "A2.9", not "A0.1A").
//
// Returns the matched character indices in `text` (for highlighting), or null when
// any term is absent. Deterministic, pure — no clock, inputs never mutated.

/**
 * Matched character indices of `query` within `text`, or null when a term is
 * missing. Case-insensitive; the query is split on whitespace into terms, each of
 * which must be a substring of `text` (order-independent). An empty/whitespace
 * query returns `[]` (a trivial match — the caller treats "no query" as "no
 * filter"). Only the first occurrence of each term is marked (enough for the
 * highlight).
 */
export function fuzzyMatch(query: string, text: string): number[] | null {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const t = text.toLowerCase()
  const hit = new Set<number>()
  for (const term of q.split(/\s+/)) {
    const at = t.indexOf(term)
    if (at === -1) return null
    for (let i = at; i < at + term.length; i++) hit.add(i)
  }
  return [...hit].sort((a, b) => a - b)
}

/**
 * True when `query` matches ANY of the given fields (a row is shown if the query
 * hits any of its searchable columns). An empty query matches everything;
 * null/undefined fields are skipped.
 */
export function fuzzyMatchesAny(query: string, fields: (string | null | undefined)[]): boolean {
  if (!query.trim()) return true
  return fields.some((f) => f != null && fuzzyMatch(query, f) !== null)
}
