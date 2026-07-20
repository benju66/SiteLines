import { describe, expect, it } from 'vitest'
import type { PunchItem } from '@/types'
import { groupPunchBy, punchRollup } from './index'

function p(over: Partial<PunchItem> & Pick<PunchItem, 'id'>): PunchItem {
  return {
    id: over.id,
    project: 'opiii',
    number: over.number ?? '#1',
    name: over.name ?? 'x',
    assignee: over.assignee ?? '',
    status: over.status ?? 'Open',
    workflowStatus: over.workflowStatus ?? 'work_required',
    dueDate: over.dueDate ?? null,
    dueSort: over.dueSort ?? '',
    hasPhotos: over.hasPhotos ?? false,
    hasOpenResponse: over.hasOpenResponse ?? false,
    manager: over.manager ?? '',
  }
}

describe('punchRollup', () => {
  it('counts lifecycle buckets + % complete', () => {
    const r = punchRollup([
      p({ id: '1', status: 'Closed', workflowStatus: 'closed' }),
      p({ id: '2', status: 'Closed', workflowStatus: 'closed' }),
      p({ id: '3', status: 'Overdue', workflowStatus: 'work_required' }),
      p({ id: '4', status: 'Open', workflowStatus: 'ready_for_review' }),
    ])
    expect(r).toEqual({ total: 4, open: 2, overdue: 1, readyForReview: 1, closed: 2, pctComplete: 0.5 })
  })
  it('is 0% and empty-safe on no items', () => {
    expect(punchRollup([])).toEqual({ total: 0, open: 0, overdue: 0, readyForReview: 0, closed: 0, pctComplete: 0 })
  })
})

describe('groupPunchBy — stage', () => {
  it('orders groups by lifecycle (initiated → closed), not insertion', () => {
    const groups = groupPunchBy(
      [
        p({ id: '1', workflowStatus: 'closed', status: 'Closed' }),
        p({ id: '2', workflowStatus: 'initiated' }),
        p({ id: '3', workflowStatus: 'ready_for_review' }),
        p({ id: '4', workflowStatus: 'work_required' }),
      ],
      'stage',
    )
    expect(groups.map((g) => g.key)).toEqual(['initiated', 'work_required', 'ready_for_review', 'closed'])
    expect(groups.map((g) => g.label)).toEqual(['Initiated', 'Work Required', 'Ready for Review', 'Closed'])
  })
  it('within a group: overdue first, then earliest due date, id-tiebroken', () => {
    const [g] = groupPunchBy(
      [
        p({ id: 'b', workflowStatus: 'work_required', status: 'Open', dueSort: '2025-12-01' }),
        p({ id: 'a', workflowStatus: 'work_required', status: 'Open', dueSort: '2025-11-01' }),
        p({ id: 'c', workflowStatus: 'work_required', status: 'Overdue', dueSort: '2026-01-01' }),
      ],
      'stage',
    )
    expect(g.items.map((i) => i.id)).toEqual(['c', 'a', 'b']) // overdue c first; then a(Nov) before b(Dec)
  })
})

describe('groupPunchBy — assignee', () => {
  it('orders by open-count desc then alpha, Unassigned last', () => {
    const groups = groupPunchBy(
      [
        p({ id: '1', assignee: 'Zed' }),
        p({ id: '2', assignee: 'Amy' }),
        p({ id: '3', assignee: 'Amy' }),
        p({ id: '4', assignee: '' }), // → Unassigned
      ],
      'assignee',
    )
    expect(groups.map((g) => g.label)).toEqual(['Amy', 'Zed', 'Unassigned'])
  })
})
