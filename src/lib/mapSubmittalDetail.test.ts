import { describe, expect, it } from 'vitest'
import { mapSubmittalDetail, type SubmittalDetailRow } from './mapSubmittalDetail'

describe('mapSubmittalDetail', () => {
  const row: SubmittalDetailRow = {
    id: 'submittals:63344127',
    request: '<p>Shop Drawings: precast structural concrete.</p>',
    responses: [
      { author: 'Ben Urness', date: '2025-05-23', text: 'See comments and corrections needed.', status: 'Approved as Noted', official: true },
      { author: 'Cory Casperson (IMEG)', date: null, text: '   ', status: 'Pending', official: false }, // kept: has status
      { author: '', date: '2025-05-20', text: '', status: '', official: false }, // dropped: no text, no status
    ],
    assignees: 'Ben Urness, Cory Casperson (IMEG)',
    closed_date: '2025-05-24T14:15:17Z',
    procore_url: 'https://app.procore.com/3051002/project/submittal_logs/63344127',
    final_submittal: [{ name: 'Precast Shops-IMEG_AY.pdf', url: 'https://storage.procore.com/api/v5/files/final?sig=fff' }],
    attachments: [{ name: 'Precast shop dwgs.pdf', url: 'https://storage.procore.com/api/v5/files/abc?sig=xyz' }],
  }

  it('maps the request and reviewer names', () => {
    const d = mapSubmittalDetail(row)
    expect(d.request).toBe('Shop Drawings: precast structural concrete.')
    expect(d.assignees).toBe('Ben Urness, Cory Casperson (IMEG)')
    expect(d.closedDate).toBe('May 24, 2025')
    expect(d.procoreUrl).toBe('https://app.procore.com/3051002/project/submittal_logs/63344127')
    expect(d.attachments).toEqual([{ name: 'Precast shop dwgs.pdf', url: 'https://storage.procore.com/api/v5/files/abc?sig=xyz' }])
  })

  it('surfaces the final reviewed submittal separately from attachments', () => {
    const d = mapSubmittalDetail(row)
    expect(d.finalSubmittal).toEqual([{ name: 'Precast Shops-IMEG_AY.pdf', url: 'https://storage.procore.com/api/v5/files/final?sig=fff' }])
    // and it is NOT mixed into the submitted attachments
    expect(d.attachments.some((a) => a.url.includes('final'))).toBe(false)
  })

  it('carries the approver decision as status, keeps comment-less decisions, drops empty rows', () => {
    const d = mapSubmittalDetail(row)
    expect(d.responses).toHaveLength(2)
    expect(d.responses[0]).toEqual({
      author: 'Ben Urness',
      date: 'May 23, 2025',
      text: 'See comments and corrections needed.',
      official: true,
      status: 'Approved as Noted',
    })
    // Comment-less "Pending" review is kept (the decision is the content).
    expect(d.responses[1]).toEqual({
      author: 'Cory Casperson (IMEG)',
      date: null,
      text: '',
      official: false,
      status: 'Pending',
    })
  })

  it('handles a submittal with no reviewers or metadata', () => {
    const d = mapSubmittalDetail({
      id: 'submittals:1',
      request: 'Product data.',
      responses: null,
      assignees: null,
      closed_date: null,
      procore_url: null,
      final_submittal: null,
      attachments: null,
    })
    expect(d.responses).toEqual([])
    expect(d.attachments).toEqual([])
    expect(d.finalSubmittal).toEqual([])
    expect(d.assignees).toBeUndefined()
    expect(d.closedDate).toBeNull()
  })
})
