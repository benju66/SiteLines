import { describe, expect, it } from 'vitest'
import type { NavGroup, ToolKey } from '@/types'
import { orderedNav } from './index'

// A miniature of the real GROUPS shape — enough to exercise the pin logic.
const GROUPS: NavGroup[] = [
  { label: 'Core', keys: ['directory'] },
  { label: 'Project Management', keys: ['rfis', 'submittals', 'punch'] },
  { label: 'Financial Management', keys: ['budget', 'invoicing'] },
]

describe('orderedNav', () => {
  it('returns all groups unchanged and no pinned list when nothing is pinned', () => {
    expect(orderedNav(GROUPS, [])).toEqual({ pinned: [], groups: GROUPS })
  })

  it('lifts pinned tools out of their groups into the pinned list (pin order preserved)', () => {
    const out = orderedNav(GROUPS, ['budget', 'rfis'])
    expect(out.pinned).toEqual(['budget', 'rfis'])
    expect(out.groups).toEqual([
      { label: 'Core', keys: ['directory'] },
      { label: 'Project Management', keys: ['submittals', 'punch'] },
      { label: 'Financial Management', keys: ['invoicing'] },
    ])
  })

  it('drops a group emptied by pinning', () => {
    const out = orderedNav(GROUPS, ['directory'])
    expect(out.pinned).toEqual(['directory'])
    expect(out.groups.find((g) => g.label === 'Core')).toBeUndefined()
  })

  it('ignores stale pinned keys that no longer exist in any group', () => {
    const out = orderedNav(GROUPS, ['ghostTool' as ToolKey, 'budget'])
    expect(out.pinned).toEqual(['budget'])
    // The groups are untouched apart from the (real) pinned tool being removed.
    expect(out.groups.find((g) => g.label === 'Financial Management')).toEqual({ label: 'Financial Management', keys: ['invoicing'] })
  })

  it('does not mutate the input groups', () => {
    const snapshot = JSON.parse(JSON.stringify(GROUPS))
    orderedNav(GROUPS, ['budget', 'rfis'])
    expect(GROUPS).toEqual(snapshot)
  })
})
