import { describe, expect, it } from 'vitest'
import { DATA } from '@/data/records'
import { overviewStats, projectCardStats } from './index'

// Hand-counted from src/data/records.ts across the aggregate tools
// (rfis, submittals, changeOrders, punch, changeEvents, commitments,
// invoicing, schedule), where "open" = status not in TERMINAL. TERMINAL now
// includes 'Draft' (drafts are pre-submission, not in anyone's court):
//   terminal: RFI #019 (Closed), CO #005 (Approved), CE #011 (Void),
//   SC-14 (Executed) + drafts RFI #044, CO #003, PO-08 → 27 − 7 = 20 open.
//   The three drafts are all mine:true; CO #003 is due-this-week.

describe('overviewStats', () => {
  it('counts open / overdue / due-this-week / in-your-court across all projects', () => {
    expect(overviewStats(DATA, 'all')).toEqual({ open: 20, over: 4, week: 9, mine: 8 })
  })

  it('respects project scope', () => {
    const m = overviewStats(DATA, 'mckenna')
    const o = overviewStats(DATA, 'opiii')
    expect(m.open + o.open).toBe(20)
    expect(m.over).toBe(4) // #042, CO #007, punch #008, schedule M-03 — all McKenna
    expect(o.over).toBe(0)
  })
})

describe('projectCardStats', () => {
  it('mckenna: open RFIs exclude terminal (incl. draft), overdue spans four tools', () => {
    expect(projectCardStats(DATA, 'mckenna')).toEqual({ openRfis: 2, submittals: 2, overdue: 3 })
  })

  it('opiii: closed RFI #019 not counted as open', () => {
    expect(projectCardStats(DATA, 'opiii')).toEqual({ openRfis: 1, submittals: 2, overdue: 0 })
  })
})
