// Pure mappers between the sitelines_scope_overrides table and the ScopeOverride
// contract shape (Commitments, Phase 5a). Unlike the read-seam mappers, this table
// is WRITABLE, so there are two directions: a row → ScopeOverride (read) and a
// ScopeOverride → row (write/upsert). Deterministic — no clock; the provider stamps
// `updatedAt` before calling the source, so it rides through as data here.
//
// `blocks` is jsonb — supabase-js returns it already parsed, and localStorage is
// JSON.parsed — so both sources hand us a value of `unknown` shape. Coerce it
// defensively into ScopeBlockOverride[] (drop anything malformed) so a hand-edited
// row or a future shape change can never crash the render.

import type { ScopeBlockOverride, ScopeField, ScopeOverride } from '@/types'

const FIELDS: ReadonlySet<string> = new Set(['description', 'inclusions', 'exclusions'])

/** One row of the sitelines_scope_overrides table (jsonb `blocks` arrives parsed). */
export interface ScopeOverrideRow {
  commitment_id: string
  field: string
  blocks: unknown // jsonb → parsed; validated by coerceBlocks
  source_hash: string | null
  updated_at: string | null
  updated_by?: string | null // audit column; not surfaced in the app
}

/** Coerce an untrusted jsonb value into a clean ScopeBlockOverride[]. */
export function coerceBlocks(value: unknown): ScopeBlockOverride[] {
  if (!Array.isArray(value)) return []
  const out: ScopeBlockOverride[] = []
  for (const b of value) {
    if (!b || typeof b !== 'object') continue
    const { kind, indent, text, list, bold } = b as Record<string, unknown>
    if (kind !== 'para' && kind !== 'heading') continue
    if (typeof text !== 'string') continue
    const depth = typeof indent === 'number' && Number.isFinite(indent) ? Math.max(0, Math.trunc(indent)) : 0
    const block: ScopeBlockOverride = { kind, indent: depth, text }
    // Presentation-only list style (Phase 6a); drop any other value to undefined.
    if (list === 'bullet' || list === 'number') block.list = list
    // Presentation-only bold word indices (Phase 6c): clean to a sorted set of
    // unique, in-range, non-negative integers; drop the field if nothing survives.
    if (Array.isArray(bold)) {
      const wordCount = text.split(' ').length
      const clean = Array.from(new Set(bold.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < wordCount))).sort(
        (x, y) => x - y,
      )
      if (clean.length > 0) block.bold = clean
    }
    out.push(block)
  }
  return out
}

/** Map a table row → the ScopeOverride contract shape. */
export function mapScopeOverride(row: ScopeOverrideRow): ScopeOverride {
  const field = (FIELDS.has(row.field) ? row.field : 'description') as ScopeField
  return {
    commitmentId: row.commitment_id,
    field,
    blocks: coerceBlocks(row.blocks),
    sourceHash: row.source_hash ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

/**
 * Map a ScopeOverride → the row an upsert writes. `updated_by` is left to the DB
 * default (`auth.uid()`) — the browser never authors the writer. `updated_at` is
 * carried from the override (the provider stamps it) so read-back matches the DB
 * default fallback shape.
 */
export function toScopeOverrideRow(o: ScopeOverride): ScopeOverrideRow {
  return {
    commitment_id: o.commitmentId,
    field: o.field,
    blocks: o.blocks,
    source_hash: o.sourceHash,
    updated_at: o.updatedAt,
  }
}
