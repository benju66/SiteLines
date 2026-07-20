import { describe, expect, it } from 'vitest'
import type { ItemsByTool } from '@/lib/dataSource'
import type { Item, Project } from '@/types'

import { activeProjects } from './index'

// activeProjects only reads each item's `project`, so a minimal partial is enough.
const item = (project: Project) => ({ project }) as Item

/** Build an ItemsByTool from a per-tool map of projects (missing tools = empty). */
const itemsByTool = (byTool: Partial<Record<string, Project[]>>): ItemsByTool =>
  Object.fromEntries(Object.entries(byTool).map(([tool, projects]) => [tool, (projects ?? []).map(item)])) as unknown as ItemsByTool

describe('activeProjects', () => {
  it('includes both projects when both have items', () => {
    expect(activeProjects(itemsByTool({ rfis: ['mckenna'], budget: ['opiii'] }))).toEqual(['mckenna', 'opiii'])
  })

  it('excludes a project with zero items (the live McKenna ghost)', () => {
    expect(activeProjects(itemsByTool({ rfis: ['opiii'], submittals: ['opiii'] }))).toEqual(['opiii'])
  })

  it('includes only mckenna when only mckenna has items', () => {
    expect(activeProjects(itemsByTool({ punch: ['mckenna'] }))).toEqual(['mckenna'])
  })

  it('returns [] when there are no items at all', () => {
    expect(activeProjects(itemsByTool({ rfis: [], submittals: [] }))).toEqual([])
    expect(activeProjects(itemsByTool({}))).toEqual([])
  })

  it('de-dupes across tools and always returns canonical order', () => {
    // opiii encountered first, mckenna later → still mckenna-then-opiii.
    const items = itemsByTool({ rfis: ['opiii', 'opiii'], submittals: ['mckenna'], budget: ['opiii', 'mckenna'] })
    expect(activeProjects(items)).toEqual(['mckenna', 'opiii'])
  })
})
