import { describe, expect, it } from 'vitest'
import type { Spec } from '@/types'
import { groupByDivision } from './index'

function spec(id: string, number: string, title = 'x'): Spec {
  return { id, number, title, division: number.trim().split(/\s+/)[0] ?? '', procoreUrl: null, issuedDate: null, pdfUrl: null }
}

describe('groupByDivision', () => {
  it('groups sections by CSI division in ascending book order (not count-desc)', () => {
    const groups = groupByDivision([
      spec('specs:1', '26 0519'),
      spec('specs:2', '03 3000'),
      spec('specs:3', '01 1100'),
      spec('specs:4', '26 0500'), // division 26 has 2 sections…
    ])
    // …but book order is by code, so 01 → 03 → 26 regardless of counts.
    expect(groups.map((g) => g.code)).toEqual(['01', '03', '26'])
    expect(groups.map((g) => g.name)).toEqual(['General Requirements', 'Concrete', 'Electrical'])
  })

  it('orders sections within a division by natural number sort, id-tiebroken', () => {
    const [g] = groupByDivision([
      spec('specs:b', '09 9123'),
      spec('specs:a', '09 9100'),
      spec('specs:c', '09 9110'),
    ])
    expect(g.sections.map((sec) => sec.number)).toEqual(['09 9100', '09 9110', '09 9123'])
  })

  it('buckets a blank/malformed division code as Uncategorized, sorted last', () => {
    const groups = groupByDivision([spec('specs:x', ''), spec('specs:y', '03 3000')])
    expect(groups.map((g) => g.name)).toEqual(['Concrete', 'Uncategorized'])
  })

  it('is a pure total order — same input, same output', () => {
    const input = [spec('specs:2', '05 4000'), spec('specs:1', '05 4000')]
    expect(groupByDivision(input)[0].sections.map((s) => s.id)).toEqual(['specs:1', 'specs:2'])
  })
})
