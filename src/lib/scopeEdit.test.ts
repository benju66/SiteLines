import { describe, expect, it } from 'vitest'
import { hashText } from './hashText'
import { mergeUp, partitionsSource, reindent, seedEditorBlocks, segmentSource, setKind, setList, splitBlock, MAX_INDENT } from './scopeEdit'
import type { ScopeBlockOverride, ScopeOverride } from '@/types'

const SOURCE = 'GENERAL REQUIREMENTS. Furnish all labor and material. Comply with 8.125% retainage.'

const para = (text: string, indent = 0): ScopeBlockOverride => ({ kind: 'para', indent, text })

describe('segmentSource', () => {
  it('detects an ALL-CAPS heading and sentence-splits the prose after it', () => {
    const blocks = segmentSource(SOURCE)
    expect(blocks).toEqual([
      { kind: 'heading', indent: 0, text: 'GENERAL REQUIREMENTS.' },
      { kind: 'para', indent: 0, text: 'Furnish all labor and material.' },
      { kind: 'para', indent: 0, text: 'Comply with 8.125% retainage.' },
    ])
    expect(partitionsSource(blocks, SOURCE)).toBe(true)
  })

  it('breaks BEFORE numbered markers so the number leads its clause (not trailing)', () => {
    const src = 'GENERAL REQUIREMENTS 1. Use of Project Premises 1.1. Standard work hours apply.'
    const blocks = segmentSource(src)
    expect(blocks).toEqual([
      { kind: 'heading', indent: 0, text: 'GENERAL REQUIREMENTS' },
      { kind: 'para', indent: 0, text: '1. Use of Project Premises' },
      { kind: 'para', indent: 1, text: '1.1. Standard work hours apply.' },
    ])
    expect(partitionsSource(blocks, src)).toBe(true)
  })

  it('keeps a numbered clause whole (does not sentence-split its body)', () => {
    const src = '1.1. Standard work hours are 8:00 A.M. to 5:00 P.M. Monday through Friday.'
    const blocks = segmentSource(src)
    expect(blocks).toEqual([{ kind: 'para', indent: 1, text: src }])
    expect(partitionsSource(blocks, src)).toBe(true)
  })

  it('does not split on a decimal (no space after the dot)', () => {
    expect(segmentSource('Hold 8.125% of each pay app.').length).toBe(1)
  })

  it('does not treat a lone caps acronym mid-sentence as a heading', () => {
    const src = 'Provide OSHA training for all workers.'
    const blocks = segmentSource(src)
    expect(blocks).toEqual([{ kind: 'para', indent: 0, text: src }])
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

describe('setList', () => {
  it('sets a list style on the target block only', () => {
    const blocks = [para('a'), para('b')]
    expect(setList(blocks, 1, 'bullet')).toEqual([para('a'), { kind: 'para', indent: 0, text: 'b', list: 'bullet' }])
  })

  it('clears the list style by dropping the key (not storing undefined)', () => {
    const blocks: ScopeBlockOverride[] = [{ kind: 'para', indent: 0, text: 'a', list: 'number' }]
    const out = setList(blocks, 0, undefined)
    expect(out).toEqual([para('a')])
    expect('list' in out[0]).toBe(false)
  })

  it('is a no-op for an out-of-range index', () => {
    const blocks = [para('a')]
    expect(setList(blocks, 5, 'bullet')).toBe(blocks)
  })

  it('does NOT change the partition — list is pure decoration, never stored words', () => {
    const source = 'Furnish all labor and material.'
    const blocks = segmentSource(source)
    expect(partitionsSource(blocks, source)).toBe(true)
    const styled = setList(setList(blocks, 0, 'number'), 0, 'bullet')
    expect(partitionsSource(styled, source)).toBe(true)
    expect(styled.map((b) => b.text)).toEqual(blocks.map((b) => b.text))
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
