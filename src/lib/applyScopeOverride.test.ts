import { describe, expect, it } from 'vitest'
import { applyScopeOverride } from './applyScopeOverride'
import { hashText } from './hashText'
import { parseScope } from './parseScope'
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
})
