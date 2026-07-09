import { describe, expect, it } from 'vitest'
import { coerceBlocks, mapScopeOverride, toScopeOverrideRow, type ScopeOverrideRow } from './mapScopeOverride'
import type { ScopeOverride } from '@/types'

describe('coerceBlocks', () => {
  it('keeps well-formed para/heading blocks', () => {
    expect(
      coerceBlocks([
        { kind: 'heading', indent: 0, text: 'SCOPE OF WORK' },
        { kind: 'para', indent: 1, text: 'Furnish all labor.' },
      ]),
    ).toEqual([
      { kind: 'heading', indent: 0, text: 'SCOPE OF WORK' },
      { kind: 'para', indent: 1, text: 'Furnish all labor.' },
    ])
  })

  it('drops malformed entries (bad kind, missing text, non-object)', () => {
    expect(
      coerceBlocks([
        { kind: 'lineitem', indent: 0, text: 'x' }, // not para/heading
        { kind: 'para', indent: 0 }, // no text
        'nope',
        null,
        { kind: 'para', indent: 0, text: 'keep me' },
      ]),
    ).toEqual([{ kind: 'para', indent: 0, text: 'keep me' }])
  })

  it('normalizes indent to a non-negative integer, defaulting to 0', () => {
    expect(coerceBlocks([{ kind: 'para', indent: -3, text: 'a' }])).toEqual([{ kind: 'para', indent: 0, text: 'a' }])
    expect(coerceBlocks([{ kind: 'para', indent: 2.9, text: 'b' }])).toEqual([{ kind: 'para', indent: 2, text: 'b' }])
    expect(coerceBlocks([{ kind: 'para', text: 'c' }])).toEqual([{ kind: 'para', indent: 0, text: 'c' }])
  })

  it('returns [] for a non-array (defensive against a bad jsonb value)', () => {
    expect(coerceBlocks(null)).toEqual([])
    expect(coerceBlocks({} as unknown)).toEqual([])
    expect(coerceBlocks('[]' as unknown)).toEqual([])
  })
})

describe('mapScopeOverride', () => {
  const row: ScopeOverrideRow = {
    commitment_id: 'commitments:9001',
    field: 'inclusions',
    blocks: [{ kind: 'para', indent: 0, text: 'Complete HVAC systems.' }],
    source_hash: 'deadbeef',
    updated_at: '2026-07-09T12:00:00.000Z',
    updated_by: 'some-uuid',
  }

  it('maps a row to the contract shape (dropping the audit column)', () => {
    expect(mapScopeOverride(row)).toEqual<ScopeOverride>({
      commitmentId: 'commitments:9001',
      field: 'inclusions',
      blocks: [{ kind: 'para', indent: 0, text: 'Complete HVAC systems.' }],
      sourceHash: 'deadbeef',
      updatedAt: '2026-07-09T12:00:00.000Z',
    })
  })

  it('falls back to a safe field + empty strings when columns are null/unknown', () => {
    const mapped = mapScopeOverride({ ...row, field: 'bogus', source_hash: null, updated_at: null })
    expect(mapped.field).toBe('description')
    expect(mapped.sourceHash).toBe('')
    expect(mapped.updatedAt).toBe('')
  })

  it('round-trips through toScopeOverrideRow (minus the DB-owned audit column)', () => {
    const override: ScopeOverride = {
      commitmentId: 'commitments:9001',
      field: 'exclusions',
      blocks: [{ kind: 'heading', indent: 0, text: 'EXCLUSIONS' }],
      sourceHash: 'abc12345',
      updatedAt: '2026-07-09T12:00:00.000Z',
    }
    expect(mapScopeOverride(toScopeOverrideRow(override))).toEqual(override)
  })
})
