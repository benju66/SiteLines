import { describe, expect, it } from 'vitest'
import { deriveUrgency, formatDueDate, statusTone, timeAgo } from './derive'

// Fixed clock for every case — the fns take `today`/`now` in, so tests are
// fully deterministic.
const TODAY = new Date('2026-07-01T09:30:00')

describe('deriveUrgency', () => {
  it('past due → over', () => {
    expect(deriveUrgency('2026-06-30', TODAY)).toBe('over')
    expect(deriveUrgency('2026-06-24', TODAY)).toBe('over')
  })
  it('due today → week (not past yet)', () => {
    expect(deriveUrgency('2026-07-01', TODAY)).toBe('week')
  })
  it('due within 7 days → week, boundary inclusive', () => {
    expect(deriveUrgency('2026-07-08', TODAY)).toBe('week')
  })
  it('due beyond 7 days → track', () => {
    expect(deriveUrgency('2026-07-09', TODAY)).toBe('track')
  })
  it('no due date → track', () => {
    expect(deriveUrgency(null, TODAY)).toBe('track')
  })
  it('terminal wins regardless of date', () => {
    expect(deriveUrgency('2026-06-01', TODAY, true)).toBe('muted')
    expect(deriveUrgency(null, TODAY, true)).toBe('muted')
  })
  it('full timestamps work like bare dates', () => {
    expect(deriveUrgency('2026-06-30T16:00:00', TODAY)).toBe('over')
    expect(deriveUrgency('2026-07-01T23:59:00', TODAY)).toBe('week')
  })
})

describe('formatDueDate', () => {
  it('formats same-year dates without the year', () => {
    expect(formatDueDate('2026-07-08', TODAY)).toBe('due Jul 8')
    expect(formatDueDate('2026-06-24', TODAY)).toBe('due Jun 24')
  })
  it('appends the year when it differs from today', () => {
    expect(formatDueDate('2027-01-15', TODAY)).toBe('due Jan 15 2027')
  })
  it('no due date → em dash', () => {
    expect(formatDueDate(null, TODAY)).toBe('—')
  })
})

describe('statusTone', () => {
  it('maps known labels directly', () => {
    expect(statusTone('Under Review', 'track')).toBe('info')
    expect(statusTone('Pending Owner', 'track')).toBe('danger')
    expect(statusTone('Approved', 'over')).toBe('ok')
    expect(statusTone('Draft', 'over')).toBe('muted')
  })
  it('Open is urgency-dependent', () => {
    expect(statusTone('Open', 'over')).toBe('danger')
    expect(statusTone('Open', 'week')).toBe('warn')
    expect(statusTone('Open', 'track')).toBe('info')
  })
  it('unknown labels degrade to muted', () => {
    expect(statusTone('Some Future Procore Status', 'over')).toBe('muted')
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-07-01T12:00:00')
  it('sub-minute → just now', () => {
    expect(timeAgo(new Date('2026-07-01T11:59:30'), now)).toBe('just now')
  })
  it('minutes / hours / days', () => {
    expect(timeAgo(new Date('2026-07-01T11:45:00'), now)).toBe('15m ago')
    expect(timeAgo(new Date('2026-07-01T09:00:00'), now)).toBe('3h ago')
    expect(timeAgo(new Date('2026-06-28T12:00:00'), now)).toBe('3d ago')
  })
  it('clock skew (then in the future) clamps to just now', () => {
    expect(timeAgo(new Date('2026-07-01T12:05:00'), now)).toBe('just now')
  })
})
