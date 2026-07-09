import { describe, expect, it } from 'vitest'
import { hashText } from './hashText'
import { mergeUp, partitionsSource, reindent, seedEditorBlocks, segmentSource, setKind, splitBlock, MAX_INDENT } from './scopeEdit'
import type { ScopeBlockOverride, ScopeOverride } from '@/types'

const SOURCE = 'GENERAL REQUIREMENTS. Furnish all labor and material. Comply with 8.125% retainage.'

const para = (text: string, indent = 0): ScopeBlockOverride => ({ kind: 'para', indent, text })

describe('segmentSource', () => {
  it('splits into one para per sentence, preserving the words', () => {
    const blocks = segmentSource(SOURCE)
    expect(blocks.map((b) => b.text)).toEqual([
      'GENERAL REQUIREMENTS.',
      'Furnish all labor and material.',
      'Comply with 8.125% retainage.',
    ])
    expect(blocks.every((b) => b.kind === 'para' && b.indent === 0)).toBe(true)
    expect(partitionsSource(blocks, SOURCE)).toBe(true)
  })

  it('does not split on a decimal (no space after the dot)', () => {
    expect(segmentSource('Hold 8.125% of each pay app.').length).toBe(1)
  })

  it('re-attaches bare list markers to the clause that follows (no tiny fragments)', () => {
    const src = 'Scope of work. 2.5. Manage all mobilization. 2.6. Provide submittals.'
    const blocks = segmentSource(src)
    expect(blocks.map((b) => b.text)).toEqual([
      'Scope of work.',
      '2.5. Manage all mobilization.',
      '2.6. Provide submittals.',
    ])
    expect(partitionsSource(blocks, src)).toBe(true)
  })

  it('returns [] for empty/whitespace source', () => {
    expect(segmentSource('   ')).toEqual([])
  })
})

describe('splitBlock', () => {
  it('splits at a word boundary, both halves keeping kind + indent, words preserved', () => {
    const blocks = [{ kind: 'heading' as const, indent: 2, text: 'Furnish all labor and material.' }]
    const out = splitBlock(blocks, 0, 2)
    expect(out).toEqual([
      { kind: 'heading', indent: 2, text: 'Furnish all' },
      { kind: 'heading', indent: 2, text: 'labor and material.' },
    ])
    expect(partitionsSource(out, 'Furnish all labor and material.')).toBe(true)
  })

  it('is a no-op at the block boundaries (0 or >= word count)', () => {
    const blocks = [para('one two three')]
    expect(splitBlock(blocks, 0, 0)).toBe(blocks)
    expect(splitBlock(blocks, 0, 3)).toBe(blocks)
  })
})

describe('mergeUp', () => {
  it('merges into the previous block, keeping the previous block’s kind + indent', () => {
    const blocks = [{ kind: 'heading' as const, indent: 1, text: 'Scope' }, para('of work', 3)]
    expect(mergeUp(blocks, 1)).toEqual([{ kind: 'heading', indent: 1, text: 'Scope of work' }])
  })

  it('is a no-op on the first block', () => {
    const blocks = [para('a'), para('b')]
    expect(mergeUp(blocks, 0)).toBe(blocks)
  })

  it('a split immediately merged back is identity in text', () => {
    const blocks = [para('one two three four')]
    const round = mergeUp(splitBlock(blocks, 0, 2), 1)
    expect(round.map((b) => b.text).join(' ')).toBe('one two three four')
  })
})

describe('setKind + reindent', () => {
  it('sets kind on the target block only', () => {
    const blocks = [para('a'), para('b')]
    expect(setKind(blocks, 1, 'heading')).toEqual([para('a'), { kind: 'heading', indent: 0, text: 'b' }])
  })

  it('clamps indent to [0, MAX_INDENT]', () => {
    const blocks = [para('a', 0)]
    expect(reindent(blocks, 0, -1)[0].indent).toBe(0)
    expect(reindent(blocks, 0, 999)[0].indent).toBe(MAX_INDENT)
    expect(reindent(blocks, 0, 2)[0].indent).toBe(2)
  })
})

describe('partitionsSource', () => {
  it('is whitespace-insensitive and true for a valid partition', () => {
    expect(partitionsSource([para('a b'), para('c')], '  a   b  c ')).toBe(true)
  })
  it('is false when the words differ from the source', () => {
    expect(partitionsSource([para('a b typed-in-word')], 'a b')).toBe(false)
  })
})

describe('seedEditorBlocks', () => {
  const override = (source: string, blocks: ScopeBlockOverride[]): ScopeOverride => ({
    commitmentId: 'commitments:1',
    field: 'description',
    blocks,
    sourceHash: hashText(source),
    updatedAt: '2026-07-09T00:00:00Z',
  })

  it('uses a fresh override’s own blocks', () => {
    const blocks = [{ kind: 'heading' as const, indent: 0, text: 'GENERAL REQUIREMENTS.' }, para('rest')]
    expect(seedEditorBlocks(SOURCE, override(SOURCE, blocks))).toBe(blocks)
  })

  it('segments the source when there is no override', () => {
    expect(seedEditorBlocks(SOURCE, undefined)).toEqual(segmentSource(SOURCE))
  })

  it('ignores a STALE override (hash built on different source) and segments instead', () => {
    const stale = override('some other text entirely', [para('some other text entirely')])
    expect(seedEditorBlocks(SOURCE, stale)).toEqual(segmentSource(SOURCE))
  })
})
