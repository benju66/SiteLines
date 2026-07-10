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

  it('keeps a valid list style and drops an invalid one to undefined (Phase 6a)', () => {
    expect(coerceBlocks([{ kind: 'para', indent: 0, text: 'a', list: 'bullet' }])).toEqual([{ kind: 'para', indent: 0, text: 'a', list: 'bullet' }])
    expect(coerceBlocks([{ kind: 'para', indent: 0, text: 'b', list: 'number' }])).toEqual([{ kind: 'para', indent: 0, text: 'b', list: 'number' }])
    const dropped = coerceBlocks([{ kind: 'para', indent: 0, text: 'c', list: 'squiggle' }])
    expect(dropped).toEqual([{ kind: 'para', indent: 0, text: 'c' }])
    expect('list' in dropped[0]).toBe(false)
  })

  it('keeps valid bold word indices, cleaned to a sorted unique set (Phase 6c)', () => {
    expect(coerceBlocks([{ kind: 'para', indent: 0, text: 'one two three', bold: [2, 0] }])).toEqual([
      { kind: 'para', indent: 0, text: 'one two three', bold: [0, 2] },
    ])
  })

  it('drops out-of-range, negative, non-integer, and duplicate bold indices (Phase 6c)', () => {
    // text has 3 words (valid indices 0–2): 5 is out of range, -1 negative, 1.5 non-integer, dup 0.
    expect(coerceBlocks([{ kind: 'para', indent: 0, text: 'one two three', bold: [0, 0, 1, 5, -1, 1.5] }])).toEqual([
      { kind: 'para', indent: 0, text: 'one two three', bold: [0, 1] },
    ])
  })

  it('drops the bold field when nothing valid survives or it is not an array (Phase 6c)', () => {
    const outOfRange = coerceBlocks([{ kind: 'para', indent: 0, text: 'one two', bold: [9, -2] }])
    expect(outOfRange).toEqual([{ kind: 'para', indent: 0, text: 'one two' }])
    expect('bold' in outOfRange[0]).toBe(false)
    const notArray = coerceBlocks([{ kind: 'para', indent: 0, text: 'one two', bold: 'nope' }])
    expect('bold' in notArray[0]).toBe(false)
  })

  it("keeps a note's source:'user' and allows empty note text (Phase 6b)", () => {
    expect(coerceBlocks([{ kind: 'para', indent: 0, text: 'my note', source: 'user' }])).toEqual([{ kind: 'para', indent: 0, text: 'my note', source: 'user' }])
    // An empty note (a just-added, not-yet-typed note) is a valid block, not dropped.
    expect(coerceBlocks([{ kind: 'para', indent: 0, text: '', source: 'user' }])).toEqual([{ kind: 'para', indent: 0, text: '', source: 'user' }])
  })

  it('drops an invalid source value to undefined (only literal user) (Phase 6b)', () => {
    const dropped = coerceBlocks([{ kind: 'para', indent: 0, text: 'x', source: 'admin' }])
    expect(dropped).toEqual([{ kind: 'para', indent: 0, text: 'x' }])
    expect('source' in dropped[0]).toBe(false)
    const bool = coerceBlocks([{ kind: 'para', indent: 0, text: 'y', source: true }])
    expect('source' in bool[0]).toBe(false)
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
