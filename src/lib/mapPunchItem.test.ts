import { describe, expect, it } from 'vitest'
import { mapPunchItem, type PunchRow } from './mapPunchItem'

const base: PunchRow = {
  id: 'punch:1',
  project: 'opiii',
  number: '#163',
  name: 'All painted doors need another coat ',
  assignee: 'Justin Olsoe',
  status: 'Overdue',
  workflow_status: 'work_required',
  due_date: '2025-11-21',
  has_photos: true,
  has_open_response: true,
  manager: 'Travis Paddock',
}

describe('mapPunchItem', () => {
  it('shapes a full row, trimming text and keeping the raw ISO for sorting', () => {
    const p = mapPunchItem(base)
    expect(p.id).toBe('punch:1')
    expect(p.number).toBe('#163')
    expect(p.name).toBe('All painted doors need another coat') // trimmed
    expect(p.assignee).toBe('Justin Olsoe')
    expect(p.status).toBe('Overdue')
    expect(p.workflowStatus).toBe('work_required')
    expect(p.dueSort).toBe('2025-11-21') // raw ISO, sortable
    expect(p.dueDate).not.toBe('2025-11-21') // formatted for display
    expect(p.hasPhotos).toBe(true)
    expect(p.hasOpenResponse).toBe(true)
    expect(p.manager).toBe('Travis Paddock')
    expect(p.project).toBe('opiii')
  })

  it('coerces missing flags/date/text to safe empties', () => {
    const p = mapPunchItem({ ...base, assignee: null, due_date: null, has_photos: null, has_open_response: null, name: null })
    expect(p.assignee).toBe('')
    expect(p.dueDate).toBeNull()
    expect(p.dueSort).toBe('')
    expect(p.hasPhotos).toBe(false)
    expect(p.hasOpenResponse).toBe(false)
    expect(p.name).toBe('')
  })

  it('defaults an unknown project to opiii', () => {
    expect(mapPunchItem({ ...base, project: null }).project).toBe('opiii')
    expect(mapPunchItem({ ...base, project: 'mckenna' }).project).toBe('mckenna')
  })
})
