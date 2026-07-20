import { describe, expect, it } from 'vitest'
import { mapPunchDetail, type PunchDetailRow } from './mapPunchDetail'

const raw: PunchDetailRow = {
  description: null,
  rich_text_description: null,
  closed_at: '2025-12-01T10:00:00Z',
  assignments: [
    {
      login_information: { name: 'Justin Olsoe' },
      vendor: { name: 'MCI Paint & Drywall, Inc.' },
      comment: 'Done, ready for review',
      notified_at: '2025-11-18T19:41:02Z',
      responded_at: '2025-11-25T13:17:17Z',
      formatted_status: 'Ready for Review',
      approved: false,
    },
  ],
  web_images: [
    { thumbnail_url: 'https://storage.procore.com/t1?sig=a', url: 'https://storage.procore.com/f1?sig=b', filename: '1.jpeg', name: null },
    { thumbnail_url: null, url: 'https://storage.procore.com/f2', name: 'no-thumb' }, // dropped (no thumbnail)
  ],
}

describe('mapPunchDetail', () => {
  it('maps the assignment workflow onto responses (sub · vendor, dates, status)', () => {
    const d = mapPunchDetail(raw)
    expect(d.responses).toHaveLength(1)
    const r = d.responses[0]
    expect(r.author).toBe('Justin Olsoe · MCI Paint & Drywall, Inc.')
    expect(r.date).toBe('Nov 25, 2025') // responded_at wins over notified_at
    expect(r.text).toBe('Done, ready for review')
    expect(r.status).toBe('Ready for Review')
    expect(r.official).toBe(false)
    expect(d.closedDate).toBe('Dec 1, 2025')
  })

  it('maps photos, dropping any without a thumbnail, and guards non-http urls', () => {
    const d = mapPunchDetail(raw)
    expect(d.photos).toHaveLength(1)
    expect(d.photos![0]).toEqual({ thumbnailUrl: 'https://storage.procore.com/t1?sig=a', url: 'https://storage.procore.com/f1?sig=b', name: '1.jpeg' })
  })

  it('falls back to notified_at when there is no response yet, and is empty-safe', () => {
    const d = mapPunchDetail({ assignments: [{ login_information: { name: 'Chris Law' }, notified_at: '2026-04-14T20:52:40Z', responded_at: null, formatted_status: 'Work Required' }], web_images: [] })
    expect(d.responses[0].date).toBe('Apr 14, 2026')
    expect(d.responses[0].author).toBe('Chris Law')
    expect(d.photos).toEqual([])
    expect(mapPunchDetail({}).responses).toEqual([])
  })
})
