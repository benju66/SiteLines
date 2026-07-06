import { describe, expect, it } from 'vitest'
import { formatResponseDate, htmlToText, mapRfiDetail, type RfiDetailRow } from './mapRfiDetail'

describe('htmlToText', () => {
  it('strips tags and collapses whitespace', () => {
    expect(htmlToText('<p>Hello   <b>world</b></p>')).toBe('Hello world')
  })
  it('decodes common entities (named + numeric)', () => {
    expect(htmlToText('Steel &amp; glass &lt;A-201&gt; &#39;spec&#39;')).toBe("Steel & glass <A-201> 'spec'")
  })
  it('drops Procore _x000D_ artifact and literal null tokens', () => {
    expect(htmlToText('Line one_x000D_ null Line two')).toBe('Line one Line two')
  })
  it('empty/nullish → empty string', () => {
    expect(htmlToText(null)).toBe('')
    expect(htmlToText(undefined)).toBe('')
    expect(htmlToText('')).toBe('')
  })
})

describe('formatResponseDate', () => {
  it('formats a bare ISO date without timezone drift', () => {
    expect(formatResponseDate('2024-06-24')).toBe('Jun 24, 2024')
  })
  it('formats a full timestamp from its date parts', () => {
    expect(formatResponseDate('2024-01-02T23:59:59Z')).toBe('Jan 2, 2024')
  })
  it('null/malformed → null', () => {
    expect(formatResponseDate(null)).toBeNull()
    expect(formatResponseDate('not-a-date')).toBeNull()
    expect(formatResponseDate('2024-13-40')).toBeNull() // month 13 → no such month
  })
})

describe('mapRfiDetail', () => {
  const row: RfiDetailRow = {
    id: 'rfis:12345',
    request: '<p>Please confirm the <b>slab edge</b> detail at grid A-201.</p>',
    proposed_solution: '  ',
    instructions: 'Respond by EOD.',
    responses: [
      {
        author: 'Jane Architect',
        date: '2024-06-20',
        text: 'Use detail 5/A-501.',
        official: true,
      },
      {
        author: null,
        date: null,
        text: '<div>Coordinating with structural._x000D_</div>',
        official: false,
      },
      { author: 'Empty McBlank', date: '2024-06-22', text: '   ', official: false }, // dropped
    ],
    assignees: 'Jane Architect (AOR), Sam Structural (SEOR)',
    closed_date: '2024-06-25T14:15:17Z',
    procore_url: 'https://app.procore.com/3051002/project/rfi/show/12345',
    attachments: [
      { name: 'RFI 42 overlay.pdf', url: 'https://storage.procore.com/api/v5/files/abc?sig=xyz' },
      { name: null, url: 'https://storage.procore.com/api/v5/files/def?sig=uvw' }, // name falls back
      { name: 'no-link.pdf', url: null }, // dropped (no url)
      { name: 'javascript-scheme', url: 'javascript:alert(1)' }, // dropped (not http)
    ],
  }

  it('maps request + narrative fields, cleaning HTML', () => {
    const d = mapRfiDetail(row)
    expect(d.request).toBe('Please confirm the slab edge detail at grid A-201.')
    expect(d.instructions).toBe('Respond by EOD.')
    expect(d.proposedSolution).toBeUndefined() // whitespace-only → undefined
  })

  it('keeps responses in order, defaults author, drops empty-text answers', () => {
    const d = mapRfiDetail(row)
    expect(d.responses).toHaveLength(2)
    expect(d.responses[0]).toEqual({
      author: 'Jane Architect',
      date: 'Jun 20, 2024',
      text: 'Use detail 5/A-501.',
      official: true,
    })
    expect(d.responses[1]).toEqual({
      author: 'Unknown',
      date: null,
      text: 'Coordinating with structural.',
      official: false,
    })
  })

  it('maps metadata: assignees, closed date, Procore url', () => {
    const d = mapRfiDetail(row)
    expect(d.assignees).toBe('Jane Architect (AOR), Sam Structural (SEOR)')
    expect(d.closedDate).toBe('Jun 25, 2024')
    expect(d.procoreUrl).toBe('https://app.procore.com/3051002/project/rfi/show/12345')
  })

  it('keeps only http(s) attachments with a url, falling back on missing names', () => {
    const d = mapRfiDetail(row)
    expect(d.attachments).toEqual([
      { name: 'RFI 42 overlay.pdf', url: 'https://storage.procore.com/api/v5/files/abc?sig=xyz' },
      { name: 'Attachment', url: 'https://storage.procore.com/api/v5/files/def?sig=uvw' },
    ])
  })

  it('handles a thread with no responses or metadata', () => {
    const d = mapRfiDetail({
      id: 'rfis:1',
      request: 'Q?',
      proposed_solution: null,
      instructions: null,
      responses: null,
      assignees: null,
      closed_date: null,
      procore_url: null,
      attachments: null,
    })
    expect(d.request).toBe('Q?')
    expect(d.responses).toEqual([])
    expect(d.attachments).toEqual([])
    expect(d.assignees).toBeUndefined()
    expect(d.closedDate).toBeNull()
    expect(d.procoreUrl).toBeUndefined()
  })
})
