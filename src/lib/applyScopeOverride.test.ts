import { describe, expect, it } from 'vitest'
import { annotateOrdinals, applyScopeOverride } from './applyScopeOverride'
import { hashText } from './hashText'
import { parseScope, type ScopeBlock } from './parseScope'
import type { ScopeOverride } from '@/types'

const SOURCE = 'GENERAL REQUIREMENTS Furnish all labor and material. 1. Use of premises per contract.'

function overrideFor(source: string, blocks: ScopeOverride['blocks']): ScopeOverride {
  return { commitmentId: 'commitments:1', field: 'description', blocks, sourceHash: hashText(source), updatedAt: '2026-07-09T00:00:00Z' }
}

describe('applyScopeOverride', () => {
  it('falls back to the parser when there is no override', () => {
    const r = applyScopeOverride(SOURCE, undefined)
    expect(r.source).toBe('parser')
    expect(r.stale).toBe(false)
    expect(r.blocks).toEqual(parseScope(SOURCE))
  })

  it('returns the override blocks when the hash matches', () => {
    const override = overrideFor(SOURCE, [
      { kind: 'heading', indent: 0, text: 'GENERAL REQUIREMENTS' },
      { kind: 'para', indent: 1, text: 'Furnish all labor and material.' },
    ])
    const r = applyScopeOverride(SOURCE, override)
    expect(r.source).toBe('override')
    expect(r.stale).toBe(false)
    expect(r.blocks).toEqual([
      { kind: 'heading', marker: null, text: 'GENERAL REQUIREMENTS', bullets: [], indent: 0 },
      { kind: 'para', marker: null, text: 'Furnish all labor and material.', bullets: [], indent: 1 },
    ])
  })

  it('is insensitive to source whitespace (hash is over normalized text)', () => {
    const override = overrideFor(SOURCE, [{ kind: 'para', indent: 0, text: SOURCE }])
    // Re-synced source with different whitespace normalizes to the same hash.
    const r = applyScopeOverride(`  ${SOURCE.replace(/ /g, '  ')}  `, override)
    expect(r.source).toBe('override')
    expect(r.stale).toBe(false)
  })

  it('falls back to the parser AND flags stale when the source changed', () => {
    const override = overrideFor(SOURCE, [{ kind: 'heading', indent: 0, text: 'GENERAL REQUIREMENTS' }])
    const changed = SOURCE + ' 2. Added a new clause after execution.'
    const r = applyScopeOverride(changed, override)
    expect(r.source).toBe('parser')
    expect(r.stale).toBe(true)
    expect(r.blocks).toEqual(parseScope(changed))
  })

  it('treats an empty override as absent (parser, not stale)', () => {
    const r = applyScopeOverride(SOURCE, overrideFor(SOURCE, []))
    expect(r.source).toBe('parser')
    expect(r.stale).toBe(false)
    expect(r.blocks).toEqual(parseScope(SOURCE))
  })

  it('carries a block’s list style through to the rendered blocks (with ordinals)', () => {
    const override = overrideFor(SOURCE, [
      { kind: 'para', indent: 0, text: 'GENERAL REQUIREMENTS', list: 'bullet' },
      { kind: 'para', indent: 0, text: 'Furnish all labor and material.', list: 'number' },
      { kind: 'para', indent: 0, text: '1. Use of premises per contract.', list: 'number' },
    ])
    const r = applyScopeOverride(SOURCE, override)
    expect(r.source).toBe('override')
    expect(r.blocks).toEqual([
      { kind: 'para', marker: null, text: 'GENERAL REQUIREMENTS', bullets: [], indent: 0, list: 'bullet' },
      { kind: 'para', marker: null, text: 'Furnish all labor and material.', bullets: [], indent: 0, list: 'number', ordinal: 1 },
      { kind: 'para', marker: null, text: '1. Use of premises per contract.', bullets: [], indent: 0, list: 'number', ordinal: 2 },
    ])
  })
})

describe('annotateOrdinals', () => {
  // Minimal render-shape block builder for the pure ordinal pass.
  const b = (text: string, indent: number, list?: 'bullet' | 'number'): ScopeBlock => ({ kind: 'para', marker: null, text, bullets: [], indent, list })
  const ordinals = (blocks: ScopeBlock[]) => annotateOrdinals(blocks).map((x) => x.ordinal)

  it('numbers a consecutive run at the same indent 1·2·3', () => {
    expect(ordinals([b('a', 0, 'number'), b('b', 0, 'number'), b('c', 0, 'number')])).toEqual([1, 2, 3])
  })

  it('restarts a nested run under each parent (nested lists restart)', () => {
    const blocks = [
      b('1', 0, 'number'),
      b('1.1', 1, 'number'),
      b('1.2', 1, 'number'),
      b('2', 0, 'number'),
      b('2.1', 1, 'number'),
    ]
    expect(ordinals(blocks)).toEqual([1, 1, 2, 2, 1])
  })

  it('resets the run when a non-number block breaks it', () => {
    const blocks = [b('a', 0, 'number'), b('b', 0, 'number'), b('gap', 0), b('c', 0, 'number')]
    expect(ordinals(blocks)).toEqual([1, 2, undefined, 1])
  })

  it('leaves bullet and plain blocks untouched (no ordinal), and a bullet breaks a number run', () => {
    const blocks = [b('a', 0, 'number'), b('•', 0, 'bullet'), b('b', 0, 'number')]
    const out = annotateOrdinals(blocks)
    expect(out.map((x) => x.ordinal)).toEqual([1, undefined, 1])
    expect(out[1]).toBe(blocks[1]) // pass-through, same reference
  })

  it('is a no-op on parser output (no list blocks)', () => {
    const parsed = parseScope(SOURCE)
    expect(annotateOrdinals(parsed)).toEqual(parsed)
  })
})
