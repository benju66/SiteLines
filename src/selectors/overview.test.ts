import { describe, expect, it } from 'vitest'
import { DATA } from '@/data/records'
import { overviewStats, projectCardStats } from './index'

// Hand-counted from src/data/records.ts across the aggregate tools
// (rfis, submittals, changeOrders, punch, changeEvents, commitments,
// invoicing, schedule), where "open" = status not in TERMINAL:
//   terminal records: RFI #019 (Closed), CO #005 (Approved),
//   CE #011 (Void), SC-14 (Executed) → 27 total − 4 = 23 open

describe('overviewStats', () => {
  it('counts open / overdue / due-this-week / in-your-court across all projects', () => {
    expect(overviewStats(DATA, 'all')).toEqual({ open: 23, over: 4, week: 10, mine: 11 })
  })

  it('respects project scope', () => {
    const m = overviewStats(DATA, 'mckenna')
    const o = overviewStats(DATA, 'opiii')
    expect(m.open + o.open).toBe(23)
    expect(m.over).toBe(4) // #042, CO #007, punch #008, schedule M-03 — all McKenna
    expect(o.over).toBe(0)
  })
})

describe('projectCardStats', () => {
  it('mckenna: open RFIs exclude terminal, overdue spans four tools', () => {
    expect(projectCardStats(DATA, 'mckenna')).toEqual({ openRfis: 3, submittals: 2, overdue: 3 })
  })

  it('opiii: closed RFI #019 not counted as open', () => {
    expect(projectCardStats(DATA, 'opiii')).toEqual({ openRfis: 1, submittals: 2, overdue: 0 })
  })
})
