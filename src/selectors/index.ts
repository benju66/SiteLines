// Pure selectors deriving view-models from (data, state). The prototype's
// monolithic renderVals() is split here into focused, testable functions.
//
// Data seam (Phase 1): selectors take `itemsByTool` from the DataProvider —
// they never import a data module, so the seed → Supabase swap needs no
// changes here.

import { TOOLS } from '@/data/tools'
import { COURT_TOOLS, TERMINAL, isBallInCourt } from '@/lib/ballInCourt'
import type { ItemsByTool, SiteData } from '@/lib/dataSource'
import { involvesContact } from '@/lib/party'
import { tone, urgency } from '@/theme/tokens'
import type { AppState, ProjectScope, SavedView, TypeFilter } from '@/state/appState'
import type { Contact, Drawing, FinancialSource, Item, Project, ToolKey } from '@/types'

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

/**
 * Photos / daily logs in scope: project-scoped, and the In My Court toggle
 * narrows to Ben's items (flagged photos / logs needing his sign-off). Saved
 * views don't apply to these surfaces.
 */
export function mediaInScope<T extends { project: Item['project']; mine: boolean }>(list: T[], state: AppState): T[] {
  const rows = scoped(list, state.project)
  return state.court === 'court' ? rows.filter((r) => r.mine) : rows
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
  } else if (view === 'photos') {
    const n = mediaInScope(data.photos, state).length
    count = `${n} ${n === 1 ? 'photo' : 'photos'}`
  } else if (view === 'dailyLog') {
    const n = mediaInScope(data.dailyLogs, state).length
    count = `${n} ${n === 1 ? 'entry' : 'entries'}`
  } else if (view === 'drawings') {
    // Drawings are single-project reference data (not project-scoped in the slice).
    const n = data.drawings.length
    count = `${n} ${n === 1 ? 'sheet' : 'sheets'}`
  }
  return {
    isHome,
    count,
    showToggle: view === 'list' || view === 'photos' || view === 'dailyLog',
    showViews: isHome || view === 'list',
    showControls: isHome || view === 'list' || view === 'photos' || view === 'dailyLog',
  }
}

// ---- Overview (dashboard placeholder) ----

const isOpen = (r: Item) => !(r.status && TERMINAL.has(r.status.label))

/**
 * Portfolio KPIs across the aggregate tools, in scope. "Open" means
 * non-terminal status (the same TERMINAL set that governs My Court); overdue /
 * due-this-week / in-your-court are counted among open items only.
 */
export function overviewStats(items: ItemsByTool, project: ProjectScope) {
  let open = 0
  let over = 0
  let week = 0
  let mine = 0
  for (const k of AGGREGATE_KEYS) {
    for (const r of scoped(items[k], project)) {
      if (!isOpen(r)) continue
      open++
      if (r.urgency === 'over') over++
      if (r.urgency === 'week') week++
      if (r.mine) mine++
    }
  }
  return { open, over, week, mine }
}

/** Per-project mini-stats for the Overview project cards. */
export function projectCardStats(items: ItemsByTool, project: Project) {
  const openRfis = items.rfis.filter((r) => r.project === project && isOpen(r)).length
  const submittals = items.submittals.filter((r) => r.project === project).length
  const overdueKeys: ToolKey[] = ['rfis', 'submittals', 'changeOrders', 'punch']
  const overdue = overdueKeys.reduce(
    (n, k) => n + items[k].filter((r) => r.project === project && r.urgency === 'over').length,
    0,
  )
  return { openRfis, submittals, overdue }
}

// ---- Financial rollups (DATA_CONTRACT §6) ----

export interface FinancialViewModel {
  kpis: { label: string; value: string; color: string }[]
  head: [string, string, string, string]
  rows: { name: string; c1: string; c2: string; c3: string; c3Negative?: boolean }[]
  total: { c1: string; c2: string; c3: string }
}

const fmtM = (m: number) => `$${m.toFixed(2)}M`
/** Signed $M, formatted with an explicit +/− (avoids "$-0.08M"). */
const fmtSigned = (m: number) => `${m >= 0 ? '+' : '-'}${fmtM(Math.abs(m))}`

/**
 * Budget / Prime Contract view-model: per-division numbers summed across the
 * scope (both projects under "All"), with derived KPIs. `%` and derived values
 * are computed here, never stored (DATA_CONTRACT §6).
 */
export function financialView(
  fin: FinancialSource,
  tool: 'budget' | 'primeContract',
  project: ProjectScope,
): FinancialViewModel {
  const keys: Project[] = project === 'all' ? ['mckenna', 'opiii'] : [project]

  // Aggregate by division name, preserving first-seen order.
  const agg = new Map<string, [number, number, number]>()
  let budget = 0
  let committed = 0
  let invoiced = 0
  let changes = 0
  let overUnder = 0
  for (const k of keys) {
    changes += fin.approvedChanges[k]
    overUnder += fin.projectedOverUnder[k]
    for (const [name, b, c, i] of fin.divisions[k]) {
      const d = agg.get(name) ?? [0, 0, 0]
      d[0] += b
      d[1] += c
      d[2] += i
      agg.set(name, d)
      budget += b
      committed += c
      invoiced += i
    }
  }

  const ink = '#1a1d21'
  if (tool === 'budget') {
    return {
      kpis: [
        { label: 'Original Budget', value: fmtM(budget - changes), color: ink },
        { label: 'Approved Changes', value: `+${fmtM(changes)}`, color: tone.info.c },
        { label: 'Revised Budget', value: fmtM(budget), color: ink },
        { label: 'Committed', value: fmtM(committed), color: ink },
        { label: 'Invoiced to Date', value: fmtM(invoiced), color: ink },
        { label: 'Projected Over / Under', value: fmtSigned(overUnder), color: overUnder > 0 ? tone.danger.c : tone.ok.c },
      ],
      head: ['Division', 'Budget', 'Committed', 'Uncommitted'],
      rows: [...agg.entries()].map(([name, [b, c]]) => ({
        name,
        c1: fmtM(b),
        c2: fmtM(c),
        c3: fmtM(b - c),
        c3Negative: b - c < 0,
      })),
      total: { c1: fmtM(budget), c2: fmtM(committed), c3: fmtM(budget - committed) },
    }
  }
  return {
    kpis: [
      { label: 'Contract Sum', value: fmtM(budget - changes), color: ink },
      { label: 'Approved COs', value: `+${fmtM(changes)}`, color: tone.info.c },
      { label: 'Revised Contract', value: fmtM(budget), color: ink },
      { label: 'Invoiced to Date', value: fmtM(invoiced), color: ink },
      { label: 'Balance to Finish', value: fmtM(budget - invoiced), color: ink },
      { label: 'Retainage Held', value: fmtM(invoiced * 0.05), color: tone.warn.c },
    ],
    head: ['Division', 'Scheduled Value', 'Invoiced', '% Billed'],
    rows: [...agg.entries()].map(([name, [b, , i]]) => ({
      name,
      c1: fmtM(b),
      c2: fmtM(i),
      c3: `${Math.round((i / b) * 100)}%`,
    })),
    total: { c1: fmtM(budget), c2: fmtM(invoiced), c3: `${Math.round((invoiced / budget) * 100)}%` },
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

// ---- Drawings log (discipline-grouped) ----

export interface DisciplineGroup {
  discipline: string
  sheets: Drawing[]
}

/**
 * Split a drawing number into alternating alpha / numeric tokens for a
 * natural (human) sort — numeric runs are compared as numbers, so "A2.10"
 * follows "A2.9" and "S-11" precedes "S-101" (both wrong lexicographically).
 */
function numberTokens(s: string): (string | number)[] {
  return s
    .split(/(\d+)/)
    .filter((t) => t !== '')
    .map((t) => (/^\d+$/.test(t) ? Number(t) : t.toLowerCase()))
}

/** Natural/human comparison of two drawing numbers. Total order (deterministic). */
export function compareDrawingNumber(a: string, b: string): number {
  const ta = numberTokens(a)
  const tb = numberTokens(b)
  const n = Math.min(ta.length, tb.length)
  for (let i = 0; i < n; i++) {
    const x = ta[i]
    const y = tb[i]
    const xNum = typeof x === 'number'
    const yNum = typeof y === 'number'
    if (xNum && yNum) {
      if (x !== y) return (x as number) - (y as number)
    } else if (xNum !== yNum) {
      return xNum ? -1 : 1 // a numeric run sorts before an alpha run at the same position
    } else if (x !== y) {
      return (x as string) < (y as string) ? -1 : 1
    }
  }
  return ta.length - tb.length
}

/**
 * Group current sheets by discipline for the drawing log. Deterministic:
 * disciplines ordered by sheet count (desc) then name (alpha, case-insensitive);
 * sheets within a group ordered by natural number sort, id-tiebroken. Pure — the
 * view reads this via the provider; no clock, no state.
 */
export function groupByDiscipline(drawings: Drawing[]): DisciplineGroup[] {
  const buckets = new Map<string, Drawing[]>()
  for (const d of drawings) {
    const key = d.discipline || 'Uncategorized'
    const arr = buckets.get(key)
    if (arr) arr.push(d)
    else buckets.set(key, [d])
  }
  const groups: DisciplineGroup[] = [...buckets.entries()].map(([discipline, sheets]) => ({
    discipline,
    sheets: [...sheets].sort(
      (a, b) => compareDrawingNumber(a.number, b.number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    ),
  }))
  groups.sort((a, b) => {
    if (a.sheets.length !== b.sheets.length) return b.sheets.length - a.sheets.length
    const la = a.discipline.toLowerCase()
    const lb = b.discipline.toLowerCase()
    return la < lb ? -1 : la > lb ? 1 : 0
  })
  return groups
}
