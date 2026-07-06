import { describe, expect, it } from 'vitest'
import type { Drawing, DrawingRevision } from '@/types'
import { compareDrawingNumber, groupByDiscipline, sortRevisionsDesc } from './index'

/** Minimal Drawing builder — only the fields the grouping selector reads. */
function dwg(number: string, discipline: string, id = `drawings:${discipline}:${number}`): Drawing {
  return {
    id,
    drawingId: 'd',
    number,
    title: 't',
    discipline,
    revision: '1',
    drawingDate: null,
    receivedDate: null,
    set: null,
    status: 'published',
    thumbnailUrl: null,
    pngUrl: null,
    pdfUrl: null,
  }
}

const sorted = (nums: string[]) => [...nums].sort(compareDrawingNumber)

describe('compareDrawingNumber (natural / human sort)', () => {
  it('orders A2.9 before A2.10 (the canonical case a lexicographic sort gets wrong)', () => {
    expect(sorted(['A2.10', 'A2.9'])).toEqual(['A2.9', 'A2.10'])
  })

  it('orders S-11 before S-101', () => {
    expect(sorted(['S-101', 'S-11'])).toEqual(['S-11', 'S-101'])
  })

  it('sorts a full mixed run the way a person reads sheet numbers', () => {
    const input = ['A10.2', 'A2.0.1', 'A2.10', 'A2.9', 'A1.1', 'A0.1A', 'A10.10', 'A10.2.1', 'A2.1']
    expect(sorted(input)).toEqual(['A0.1A', 'A1.1', 'A2.0.1', 'A2.1', 'A2.9', 'A2.10', 'A10.2', 'A10.2.1', 'A10.10'])
  })

  it('is a total order (antisymmetric): swapping args negates the sign', () => {
    expect(compareDrawingNumber('A2.9', 'A2.10')).toBeLessThan(0)
    expect(compareDrawingNumber('A2.10', 'A2.9')).toBeGreaterThan(0)
    expect(compareDrawingNumber('A2.9', 'A2.9')).toBe(0)
  })
})

describe('groupByDiscipline', () => {
  const drawings = [
    dwg('A2.9', 'Architectural'),
    dwg('A2.10', 'Architectural'),
    dwg('A1.1', 'Architectural'),
    dwg('S-101', 'Structural'),
    dwg('S-11', 'Structural'),
    dwg('M2.1', 'Mechanical'),
    dwg('M2.2', 'Mechanical'),
  ]

  it('orders disciplines by sheet count (desc)', () => {
    const groups = groupByDiscipline(drawings)
    expect(groups.map((g) => g.discipline)).toEqual(['Architectural', 'Mechanical', 'Structural'])
    expect(groups.map((g) => g.sheets.length)).toEqual([3, 2, 2])
  })

  it('breaks equal-count ties alphabetically (Mechanical before Structural)', () => {
    const groups = groupByDiscipline(drawings)
    const mech = groups.findIndex((g) => g.discipline === 'Mechanical')
    const struct = groups.findIndex((g) => g.discipline === 'Structural')
    expect(mech).toBeLessThan(struct)
  })

  it('sorts sheets within a group by natural number order', () => {
    const groups = groupByDiscipline(drawings)
    const arch = groups.find((g) => g.discipline === 'Architectural')!
    expect(arch.sheets.map((s) => s.number)).toEqual(['A1.1', 'A2.9', 'A2.10'])
    const struct = groups.find((g) => g.discipline === 'Structural')!
    expect(struct.sheets.map((s) => s.number)).toEqual(['S-11', 'S-101'])
  })

  it('buckets a missing discipline under "Uncategorized"', () => {
    const groups = groupByDiscipline([dwg('X1', ''), dwg('X2', '')])
    expect(groups).toHaveLength(1)
    expect(groups[0].discipline).toBe('Uncategorized')
    expect(groups[0].sheets).toHaveLength(2)
  })

  it('is deterministic (same order across calls) and does not mutate the input', () => {
    const input = [...drawings]
    const a = groupByDiscipline(input).map((g) => [g.discipline, g.sheets.map((s) => s.number)])
    const b = groupByDiscipline(input).map((g) => [g.discipline, g.sheets.map((s) => s.number)])
    expect(a).toEqual(b)
    expect(input.map((d) => d.number)).toEqual(drawings.map((d) => d.number)) // unmutated
  })
})

describe('sortRevisionsDesc', () => {
  const rev = (revision: string, current = false): DrawingRevision => ({
    id: `drawings:${revision}`,
    revision,
    drawingDate: null,
    current,
    pngUrl: null,
    pdfUrl: null,
    procoreUrl: null,
  })

  it('orders revisions newest-first by numeric value (10 before 9, current leads)', () => {
    const out = sortRevisionsDesc([rev('9'), rev('10'), rev('0'), rev('12', true), rev('2')])
    expect(out.map((r) => r.revision)).toEqual(['12', '10', '9', '2', '0'])
    expect(out[0].current).toBe(true)
  })

  it('does not mutate the input', () => {
    const input = [rev('1'), rev('3'), rev('2')]
    sortRevisionsDesc(input)
    expect(input.map((r) => r.revision)).toEqual(['1', '3', '2'])
  })
})
