// Pure selectors deriving view-models from (data, state). The prototype's
// monolithic renderVals() is split here into focused, testable functions.
//
// Data seam (Phase 1): selectors take `itemsByTool` from the DataProvider —
// they never import a data module, so the seed → Supabase swap needs no
// changes here.

import { TOOLS } from '@/data/tools'
import { COURT_TOOLS, isBallInCourt } from '@/lib/ballInCourt'
import type { ItemsByTool, SiteData } from '@/lib/dataSource'
import { involvesContact } from '@/lib/party'
import { urgency } from '@/theme/tokens'
import type { AppState, ProjectScope, SavedView, TypeFilter } from '@/state/appState'
import type { Contact, Item, ToolKey } from '@/types'

/** Tools whose overdue items roll up into the sidebar footer / overview. */
const AGGREGATE_KEYS: ToolKey[] = ['rfis', 'submittals', 'changeOrders', 'punch', 'changeEvents', 'commitments', 'invoicing', 'schedule']

/** My Court type chip → tool key. Records from other court tools show only under "All". */
const TYPE_TO_TOOL: Record<Exclude<TypeFilter, 'all'>, ToolKey> = {
  rfi: 'rfis',
  submittal: 'submittals',
  co: 'changeOrders',
  punch: 'punch',
}

/** Filter a record list to the active project scope. */
export function scoped<T extends { project: Item['project'] }>(list: T[], project: ProjectScope): T[] {
  return project === 'all' ? list : list.filter((r) => r.project === project)
}

/** Every live ball-in-court record across all court-bearing tools, in scope. */
export function courtItems(items: ItemsByTool, project: ProjectScope): Item[] {
  return [...COURT_TOOLS].flatMap((k) => scoped(items[k], project).filter(isBallInCourt))
}

/** Sidebar per-tool badge = live court items needing *Ben's* action. */
export function myCourtCount(items: ItemsByTool, tool: ToolKey, project: ProjectScope): number {
  if (!COURT_TOOLS.has(tool)) return 0
  return scoped(items[tool], project).filter((r) => isBallInCourt(r) && r.mine).length
}

/** Total overdue across aggregate tools, in scope (sidebar footer). */
export function overdueTotal(items: ItemsByTool, project: ProjectScope): number {
  return AGGREGATE_KEYS.reduce((sum, k) => sum + scoped(items[k], project).filter((r) => r.urgency === 'over').length, 0)
}

/** Does a record pass the active saved-view quick filter? */
function matchesSavedView(r: Item, view: SavedView): boolean {
  switch (view) {
    case 'overdue':
      return r.urgency === 'over'
    case 'week':
      return r.urgency === 'week'
    case 'mine':
      return r.mine
    case 'others':
      return !r.mine
    default:
      return true
  }
}

const byUrgency = (a: Item, b: Item) => urgency[a.urgency].rank - urgency[b.urgency].rank

/** Records for a single tool register, court-toggled + saved-view filtered, urgency-sorted. */
export function listRows(items: ItemsByTool, state: AppState): Item[] {
  let rows = scoped(items[state.tool], state.project)
  if (state.court === 'court') rows = rows.filter((r) => r.mine)
  return rows.filter((r) => matchesSavedView(r, state.savedView)).sort(byUrgency)
}

/** Contacts in scope for the Directory view. */
export function directoryContacts(contacts: Contact[], project: ProjectScope): Contact[] {
  return project === 'all' ? contacts : contacts.filter((c) => c.projects.includes(project))
}

/**
 * Open-items count per contact (the orange Directory pill, DATA_CONTRACT §4):
 * live ball-in-court records that involve the contact by party or title match.
 */
export function contactOpenCount(items: ItemsByTool, contact: Contact, project: ProjectScope): number {
  return [...COURT_TOOLS].reduce(
    (n, k) => n + scoped(items[k], project).filter((r) => isBallInCourt(r) && involvesContact(r, contact)).length,
    0,
  )
}

/** Header count string + control-row visibility for the active view. */
export function headerMeta(data: SiteData, state: AppState) {
  const items = data.itemsByTool
  const view = TOOLS[state.tool].view
  const isHome = view === 'home'
  let count = ''
  if (isHome) {
    const n = homeRows(items, state).length
    count = `${n} open ${n === 1 ? 'item' : 'items'}`
  } else if (view === 'list') {
    const n = listRows(items, state).length
    count = `${n} ${n === 1 ? 'item' : 'items'}`
  } else if (view === 'directory') {
    const n = directoryContacts(data.contacts, state.project).length
    count = `${n} ${n === 1 ? 'contact' : 'contacts'}`
  }
  return {
    isHome,
    count,
    showToggle: view === 'list' || view === 'photos' || view === 'dailyLog',
    showViews: isHome || view === 'list',
    showControls: isHome || view === 'list' || view === 'photos' || view === 'dailyLog',
  }
}

export type PaletteResult = { kind: 'record'; record: Item } | { kind: 'tool'; tool: ToolKey }

/**
 * Command-palette results. With a query: matching records across all list
 * tools (title + number + tool label, case-insensitive), capped at 24. Empty
 * query: every navigable tool, as jump targets.
 */
export function paletteResults(items: ItemsByTool, query: string): PaletteResult[] {
  const q = query.trim().toLowerCase()
  const keys = Object.keys(TOOLS) as ToolKey[]
  if (!q) {
    return keys.filter((k) => k !== 'home' && k !== 'overview').map((tool) => ({ kind: 'tool' as const, tool }))
  }
  const out: PaletteResult[] = []
  for (const k of keys) {
    if (TOOLS[k].view !== 'list') continue
    for (const r of items[k]) {
      if (`${r.title} ${r.num} ${TOOLS[k].label}`.toLowerCase().includes(q)) out.push({ kind: 'record', record: r })
    }
  }
  return out.slice(0, 24)
}

/**
 * Resolve a record's cross-tool `links` (ids like "drawings:S-101") to their
 * records (DATA_CONTRACT §5). Unresolvable ids are dropped silently.
 */
export function resolveLinks(items: ItemsByTool, record: Item): Item[] {
  return (record.links ?? [])
    .map((id) => {
      const tool = id.split(':')[0] as ToolKey
      return items[tool]?.find((r) => r.id === id)
    })
    .filter((r): r is Item => !!r)
}

/** The My Court home feed: court items filtered by type + saved view, urgency-sorted. */
export function homeRows(items: ItemsByTool, state: AppState): Item[] {
  let rows = courtItems(items, state.project)
  if (state.type !== 'all') {
    const tool = TYPE_TO_TOOL[state.type]
    rows = rows.filter((r) => r.tool === tool)
  }
  return rows.filter((r) => matchesSavedView(r, state.savedView)).sort(byUrgency)
}
