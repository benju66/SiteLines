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
import type { BudgetLine, BudgetPending, ChangeEvent, ChangeEventLineItem, Commitment, CommitmentBilling, CommitmentChangeOrder, CommitmentLineItem, Contact, Drawing, DrawingRevision, FinancialSource, Invoice, Item, Project, ToolKey } from '@/types'

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

/** Numeric revision value; malformed/blank sinks to the bottom of a desc sort. */
const revValue = (r: DrawingRevision): number => {
  const n = Number(r.revision)
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY
}

/**
 * A drawing's revisions newest-first (highest revision number first) for the
 * viewer's picker — the current issue leads. Deterministic (id-tiebroken); pure.
 */
export function sortRevisionsDesc(revisions: DrawingRevision[]): DrawingRevision[] {
  return [...revisions].sort(
    (a, b) => revValue(b) - revValue(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

// ---- Budget cost-control drill-down (Budget Insights, Phase 1) ----

/** % of budget bought out (committed / budget). 0 when budget is 0 or negative
 *  — an unbudgeted or credit line has no meaningful buyout ratio (the view shows "—"). */
export function boughtOut(budget: number, committed: number): number {
  return budget > 0 ? committed / budget : 0
}

/** Uncommitted = budget − committed (scope still to buy; negative = over-committed). */
export function uncommitted(budget: number, committed: number): number {
  return budget - committed
}

/** A division and its budget lines, with subtotals, for the drill-down. */
export interface BudgetDivisionGroup {
  division: string
  lines: BudgetLine[]
  budget: number
  committed: number
  uncommitted: number
  erpJtd: number
  eac: number
  projectedOverUnder: number
}

/**
 * Group budget lines by division for the cost-control drill-down: each division
 * holds its lines in natural cost-code order (a split cost code's Material line
 * precedes its Subcontract line), with summed subtotals; divisions themselves in
 * natural order (division 9 before 10, by leading cost-code number). Reuses
 * `compareDrawingNumber` so "3-34100" follows "3-33000". Deterministic, pure — no
 * clock, no mutation (the view reads it via the provider).
 */
export function budgetByDivision(lines: BudgetLine[]): BudgetDivisionGroup[] {
  const buckets = new Map<string, BudgetLine[]>()
  for (const l of lines) {
    const arr = buckets.get(l.division)
    if (arr) arr.push(l)
    else buckets.set(l.division, [l])
  }
  const groups: BudgetDivisionGroup[] = [...buckets.entries()].map(([division, ls]) => {
    let budget = 0
    let committed = 0
    let erpJtd = 0
    let eac = 0
    let projectedOverUnder = 0
    for (const l of ls) {
      budget += l.budget
      committed += l.committed
      erpJtd += l.erpJtd
      eac += l.eac
      projectedOverUnder += l.projectedOverUnder
    }
    const sorted = [...ls].sort(
      (a, b) => compareDrawingNumber(a.costCode, b.costCode) || compareDrawingNumber(a.costType, b.costType),
    )
    return { division, lines: sorted, budget, committed, uncommitted: budget - committed, erpJtd, eac, projectedOverUnder }
  })
  groups.sort(
    (a, b) => compareDrawingNumber(a.division, b.division) || (a.division < b.division ? -1 : a.division > b.division ? 1 : 0),
  )
  return groups
}

/** Grand totals across all budget lines (the drill-down's total row). */
export function budgetTotals(lines: BudgetLine[]): { budget: number; committed: number; uncommitted: number; erpJtd: number; eac: number; projectedOverUnder: number } {
  let budget = 0
  let committed = 0
  let erpJtd = 0
  let eac = 0
  let projectedOverUnder = 0
  for (const l of lines) {
    budget += l.budget
    committed += l.committed
    erpJtd += l.erpJtd
    eac += l.eac
    projectedOverUnder += l.projectedOverUnder
  }
  return { budget, committed, uncommitted: budget - committed, erpJtd, eac, projectedOverUnder }
}

/** A sortable numeric column of the drill-down (natural cost-code order is the default = no sort). */
export type BudgetSortCol = 'budget' | 'committed' | 'pct' | 'uncommitted' | 'jtd' | 'forecast' | 'eac' | 'over'
export interface BudgetSort {
  col: BudgetSortCol
  dir: 'asc' | 'desc'
}

function lineMetric(l: BudgetLine, col: BudgetSortCol): number {
  switch (col) {
    case 'budget':
      return l.budget
    case 'committed':
      return l.committed
    case 'pct':
      return boughtOut(l.budget, l.committed)
    case 'uncommitted':
      return l.budget - l.committed
    case 'jtd':
      return l.erpJtd
    case 'forecast':
      return l.eac - l.erpJtd
    case 'eac':
      return l.eac
    case 'over':
      return l.projectedOverUnder
  }
}

function groupMetric(g: BudgetDivisionGroup, col: BudgetSortCol): number {
  switch (col) {
    case 'budget':
      return g.budget
    case 'committed':
      return g.committed
    case 'pct':
      return boughtOut(g.budget, g.committed)
    case 'uncommitted':
      return g.uncommitted
    case 'jtd':
      return g.erpJtd
    case 'forecast':
      return g.eac - g.erpJtd
    case 'eac':
      return g.eac
    case 'over':
      return g.projectedOverUnder
  }
}

/**
 * Sort the drill-down by a numeric column: divisions by their subtotal, and each
 * division's lines by the same field. `null` keeps the natural cost-code order.
 * Ties fall back to the natural sort so the order stays deterministic. Pure — the
 * groups (and their line arrays) are copied, never mutated.
 */
export function sortedBudgetGroups(groups: BudgetDivisionGroup[], sort: BudgetSort | null): BudgetDivisionGroup[] {
  if (!sort) return groups
  const sign = sort.dir === 'asc' ? 1 : -1
  const out = groups.map((g) => ({
    ...g,
    lines: [...g.lines].sort(
      (a, b) =>
        (lineMetric(a, sort.col) - lineMetric(b, sort.col)) * sign ||
        compareDrawingNumber(a.costCode, b.costCode) ||
        compareDrawingNumber(a.costType, b.costType),
    ),
  }))
  out.sort(
    (a, b) =>
      (groupMetric(a, sort.col) - groupMetric(b, sort.col)) * sign ||
      compareDrawingNumber(a.division, b.division),
  )
  return out
}

// ---- Budget risk radar + cost-type mix (Budget Insights, Phase 2) ----

/** The over-budget lines ranked by exposure, plus the job's total exposure. */
export interface OverBudgetResult {
  lines: BudgetLine[] // projectedOverUnder < 0, worst (most negative) first
  totalExposure: number // Σ of the overruns — negative dollars (0 when nothing is over)
}

/**
 * Rank the cost codes bleeding over budget (`projectedOverUnder < 0`) worst-first,
 * with the summed exposure. Ties fall back to the natural cost-code sort. Pure — no
 * clock, no mutation. `totalExposure` is negative so the UI can color it like the
 * drill-down's Over/Under column.
 */
export function overBudget(lines: BudgetLine[]): OverBudgetResult {
  const over = lines.filter((l) => l.projectedOverUnder < 0)
  const ranked = [...over].sort(
    (a, b) =>
      a.projectedOverUnder - b.projectedOverUnder ||
      compareDrawingNumber(a.costCode, b.costCode) ||
      compareDrawingNumber(a.costType, b.costType),
  )
  const totalExposure = over.reduce((s, l) => s + l.projectedOverUnder, 0)
  return { lines: ranked, totalExposure }
}

/**
 * The biggest buyout gaps — bought-out scope (Material / Subcontract) with the most
 * budget still uncommitted, i.e. the largest procurements still to award. Labor is
 * excluded (self-perform work is never "bought out", so its full budget always reads
 * as uncommitted). Worst-first, capped at `limit`. Pure.
 */
export function buyoutGaps(lines: BudgetLine[], limit = 5): BudgetLine[] {
  return lines
    .filter((l) => l.costType !== 'Labor' && l.budget - l.committed > 0)
    .sort(
      (a, b) =>
        b.budget - b.committed - (a.budget - a.committed) ||
        compareDrawingNumber(a.costCode, b.costCode) ||
        compareDrawingNumber(a.costType, b.costType),
    )
    .slice(0, limit)
}

/** Budget & committed summed per cost type (the cost-type mix bars). */
export interface CostTypeSlice {
  costType: string
  budget: number
  committed: number
}

const COST_TYPE_ORDER = ['Labor', 'Material', 'Subcontract']

/**
 * Sum budget & committed per cost type for the mix bars. Canonical order (Labor,
 * Material, Subcontract) first, then any other types by budget descending. Pure —
 * no clock, no mutation.
 */
export function costTypeMix(lines: BudgetLine[]): CostTypeSlice[] {
  const map = new Map<string, CostTypeSlice>()
  for (const l of lines) {
    const s = map.get(l.costType) ?? { costType: l.costType, budget: 0, committed: 0 }
    s.budget += l.budget
    s.committed += l.committed
    map.set(l.costType, s)
  }
  const known = COST_TYPE_ORDER.filter((t) => map.has(t)).map((t) => map.get(t) as CostTypeSlice)
  const others = [...map.values()].filter((s) => !COST_TYPE_ORDER.includes(s.costType)).sort((a, b) => b.budget - a.budget)
  return [...known, ...others]
}

// ---- Commitments register (Commitments, Phase 1) ----

/** Totals for the Commitments KPI cards. Sums span every commitment (rows with
 *  no requisition contribute 0); `billing` counts the ones with a requisition. */
export interface CommitmentRollup {
  count: number
  billing: number // commitments with a pay app (financials present)
  original: number
  revised: number
  billed: number
  retainage: number
  pctComplete: number // overall billed / revised, 0..1 (0 when revised is 0)
}

/** Roll commitments up for the KPI cards. Deterministic, pure — no clock. */
export function commitmentRollup(commitments: Commitment[]): CommitmentRollup {
  let billing = 0
  let original = 0
  let revised = 0
  let billed = 0
  let retainage = 0
  for (const c of commitments) {
    if (c.hasRequisition) billing++
    original += c.original
    revised += c.revised
    billed += c.billed
    retainage += c.retainage
  }
  return {
    count: commitments.length,
    billing,
    original,
    revised,
    billed,
    retainage,
    pctComplete: revised > 0 ? billed / revised : 0,
  }
}

/** A sortable column of the Commitments register. */
export type CommitmentSortCol = 'vendor' | 'type' | 'revised' | 'billed' | 'retainage' | 'pct' | 'status'
export interface CommitmentSort {
  col: CommitmentSortCol
  dir: 'asc' | 'desc'
}

/** Deterministic tiebreak: natural commitment-number order, then id. */
const byCommitmentNumber = (a: Commitment, b: Commitment) =>
  compareDrawingNumber(a.number, b.number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

const strCompare = (x: string, y: string): number => {
  const a = x.toLowerCase()
  const b = y.toLowerCase()
  return a < b ? -1 : a > b ? 1 : 0
}

function commitmentMetric(c: Commitment, col: CommitmentSortCol): number | string {
  switch (col) {
    case 'vendor':
      return c.vendor
    case 'type':
      return c.type
    case 'revised':
      return c.revised
    case 'billed':
      return c.billed
    case 'retainage':
      return c.retainage
    case 'pct':
      return c.pctComplete
    case 'status':
      return c.status
  }
}

/**
 * The register order. `null` = the default: largest revised value first, with
 * commitments that have no pay app yet (no financials) sinking to the bottom.
 * An explicit sort orders by that column (strings case-insensitive); ties fall
 * back to the natural number order so the result stays deterministic. Pure —
 * the input array is copied, never mutated.
 */
export function commitmentsSorted(commitments: Commitment[], sort: CommitmentSort | null): Commitment[] {
  const rows = [...commitments]
  if (!sort) {
    return rows.sort(
      (a, b) => Number(b.hasRequisition) - Number(a.hasRequisition) || b.revised - a.revised || byCommitmentNumber(a, b),
    )
  }
  const sign = sort.dir === 'asc' ? 1 : -1
  return rows.sort((a, b) => {
    const x = commitmentMetric(a, sort.col)
    const y = commitmentMetric(b, sort.col)
    const cmp = typeof x === 'string' ? strCompare(x, y as string) : x - (y as number)
    return cmp * sign || byCommitmentNumber(a, b)
  })
}

// ---- Commitment detail drawer (Commitments, Phase 2) ----

/** Numeric value of a "001"/"7" number; non-numeric sinks (NEGATIVE_INFINITY). */
const seqValue = (s: string): number => {
  const n = Number(s)
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY
}

/**
 * The CO log in chronological order — by change-order number ascending (001,
 * 002, …), id-tiebroken. Deterministic, pure — the input is copied.
 */
export function commitmentChangeOrdersSorted(cos: CommitmentChangeOrder[]): CommitmentChangeOrder[] {
  return [...cos].sort(
    (a, b) => seqValue(a.number) - seqValue(b.number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

/**
 * Billing history newest-first — by requisition number descending (the latest
 * pay app leads), id-tiebroken. Deterministic, pure — the input is copied.
 */
export function commitmentBillingsSorted(bills: CommitmentBilling[]): CommitmentBilling[] {
  return [...bills].sort(
    (a, b) => seqValue(b.number) - seqValue(a.number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

// ---- Budget↔Commitment cross-link (Commitments, Phase 4) ----

/** One subcontract behind a budget cost code: the commitment plus the dollars
 *  and line-item count it carries against that specific cost code. */
export interface CostCodeCommitment {
  commitment: Commitment
  amount: number // Σ this commitment's SOV line-item amounts under the cost code
  lineItemCount: number
}

/**
 * The cost-code prefix of a budget cost-code string — "12-123530.000 -
 * Residential Casework" → "12-123530.000" (the key commitment line items carry
 * in `costCode`). Split on the first " - " (the code itself has no spaced dash);
 * a code with no title is returned whole. Pure.
 */
export function costCodeKey(budgetCostCode: string): string {
  const i = budgetCostCode.indexOf(' - ')
  return (i >= 0 ? budgetCostCode.slice(0, i) : budgetCostCode).trim()
}

/**
 * Map each commitment cost code (full_code, e.g. "12-123530.000") to the
 * subcontract(s) behind it — the seam for the Budget↔Commitment cross-link.
 * Aggregates a commitment's SOV line-item amounts per cost code, joins to the
 * commitment by id, and orders the subcontracts by amount desc (natural
 * commitment-number tiebreak). Line items whose commitment isn't in
 * `commitments` (e.g. filtered out of scope) are skipped, and a cost code left
 * with no resolvable commitment is omitted. Deterministic, pure — no clock, the
 * inputs are never mutated.
 */
export function commitmentsByCostCode(
  lineItems: CommitmentLineItem[],
  commitments: Commitment[],
): Map<string, CostCodeCommitment[]> {
  const byId = new Map<string, Commitment>(commitments.map((c) => [c.id, c] as const))
  // costCode → commitmentId → running { amount, count }
  const acc = new Map<string, Map<string, { amount: number; count: number }>>()
  for (const li of lineItems) {
    const code = li.costCode
    if (!code) continue
    let inner = acc.get(code)
    if (!inner) {
      inner = new Map()
      acc.set(code, inner)
    }
    const e = inner.get(li.commitmentId) ?? { amount: 0, count: 0 }
    e.amount += li.amount
    e.count += 1
    inner.set(li.commitmentId, e)
  }
  const out = new Map<string, CostCodeCommitment[]>()
  for (const [code, inner] of acc) {
    const list: CostCodeCommitment[] = []
    for (const [cid, e] of inner) {
      const commitment = byId.get(cid)
      if (!commitment) continue
      list.push({ commitment, amount: e.amount, lineItemCount: e.count })
    }
    if (list.length === 0) continue
    list.sort((a, b) => b.amount - a.amount || byCommitmentNumber(a.commitment, b.commitment))
    out.set(code, list)
  }
  return out
}

/**
 * A commitment's SOV line items grouped by cost code, for the drawer's schedule-
 * of-values section: each group is one cost code (code + name) with its line
 * items and a subtotal. Groups ordered by subtotal desc (natural cost-code
 * tiebreak); line items within a group by amount desc (id-tiebroken).
 * Deterministic, pure — the input is never mutated.
 */
export interface CommitmentSovGroup {
  costCode: string
  costCodeName: string
  amount: number // subtotal for the code
  lineItems: CommitmentLineItem[]
}

export function commitmentSovByCostCode(lineItems: CommitmentLineItem[]): CommitmentSovGroup[] {
  const buckets = new Map<string, CommitmentLineItem[]>()
  for (const li of lineItems) {
    const arr = buckets.get(li.costCode)
    if (arr) arr.push(li)
    else buckets.set(li.costCode, [li])
  }
  const groups: CommitmentSovGroup[] = [...buckets.entries()].map(([costCode, lis]) => {
    const sorted = [...lis].sort((a, b) => b.amount - a.amount || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return {
      costCode,
      costCodeName: sorted.find((l) => l.costCodeName)?.costCodeName ?? '',
      amount: lis.reduce((s, l) => s + l.amount, 0),
      lineItems: sorted,
    }
  })
  groups.sort((a, b) => b.amount - a.amount || compareDrawingNumber(a.costCode, b.costCode))
  return groups
}

// ---- Pending-change forecast (Budget Insights, Phase 3) ----

/** One division's projected budget once its open change events land. */
export interface BudgetForecastDivision {
  division: string
  revised: number // today's revised budget for the division (0 for 'Unassigned')
  pending: number // Σ pending-change amount (negative = de-scope credit)
  projected: number // revised + pending
  openEvents: number
  costCodes: BudgetPending[] // the pending cost codes in this division, biggest-impact first
}

export interface BudgetForecast {
  divisions: BudgetForecastDivision[] // only divisions with pending changes, biggest impact first
  total: { revised: number; pending: number; projected: number }
}

/**
 * Project the budget after pending (open) change events land: for each division
 * that has pending changes, revised budget → pending → projected (revised +
 * pending); plus job totals (total revised across ALL lines, total pending). The
 * 'Unassigned' bucket (changes with no cost code yet) surfaces with revised 0.
 * Deterministic, pure — divisions and their cost codes copied, never mutated.
 */
export function budgetForecast(lines: BudgetLine[], pending: BudgetPending[]): BudgetForecast {
  const revisedByDiv = new Map<string, number>()
  let totalRevised = 0
  for (const l of lines) {
    revisedByDiv.set(l.division, (revisedByDiv.get(l.division) ?? 0) + l.budget)
    totalRevised += l.budget
  }

  const byDiv = new Map<string, { pending: number; openEvents: number; costCodes: BudgetPending[] }>()
  let totalPending = 0
  for (const p of pending) {
    const e = byDiv.get(p.division) ?? { pending: 0, openEvents: 0, costCodes: [] }
    e.pending += p.pendingAmount
    e.openEvents += p.openEvents
    e.costCodes.push(p)
    byDiv.set(p.division, e)
    totalPending += p.pendingAmount
  }

  const divisions: BudgetForecastDivision[] = [...byDiv.entries()].map(([division, e]) => {
    const revised = revisedByDiv.get(division) ?? 0
    const costCodes = [...e.costCodes].sort(
      (a, b) => Math.abs(b.pendingAmount) - Math.abs(a.pendingAmount) || compareDrawingNumber(a.costCode, b.costCode),
    )
    return { division, revised, pending: e.pending, projected: revised + e.pending, openEvents: e.openEvents, costCodes }
  })
  divisions.sort(
    (a, b) => Math.abs(b.pending) - Math.abs(a.pending) || compareDrawingNumber(a.division, b.division),
  )

  return { divisions, total: { revised: totalRevised, pending: totalPending, projected: totalRevised + totalPending } }
}

// ---- Change Events cost-exposure ledger (Change Events, Phase 1) ----

/**
 * Rollup for the Change Events KPI cards. A change event is a POTENTIAL change,
 * priced before it becomes a change order; `estCost` can be negative (a de-scope
 * credit). Counts split by status; exposure sums EXCLUDE Void (dead paper). Open
 * exposure is what feeds Budget's pending-change section (they must tie).
 */
export interface ChangeEventRollup {
  count: number // all events
  open: number
  closed: number
  voided: number
  openExposure: number // Σ estCost of OPEN events — ties to Budget's pending section
  activeExposure: number // Σ estCost of open + closed (excludes Void) — total change in flight/landed
  outOfScopeExposure: number // Σ estCost of open+closed 'Out of Scope' events — the owner's likely bill
}

const isVoid = (e: ChangeEvent) => e.status.toLowerCase() === 'void'

/** Roll change events up for the KPI cards. Deterministic, pure — no clock. */
export function changeEventRollup(events: ChangeEvent[]): ChangeEventRollup {
  let open = 0
  let closed = 0
  let voided = 0
  let openExposure = 0
  let activeExposure = 0
  let outOfScopeExposure = 0
  for (const e of events) {
    const s = e.status.toLowerCase()
    if (s === 'void') {
      voided++
      continue // Void is excluded from every exposure sum
    }
    if (s === 'open') {
      open++
      openExposure += e.estCost
    } else if (s === 'closed') {
      closed++
    }
    activeExposure += e.estCost
    if (e.scope === 'Out of Scope') outOfScopeExposure += e.estCost
  }
  return { count: events.length, open, closed, voided, openExposure, activeExposure, outOfScopeExposure }
}

/** One scope/funding bucket for the breakdown bars: label + count + summed exposure. */
export interface ChangeEventBucket {
  key: string // the scope or funding-type label; '' → 'Unspecified'
  count: number
  exposure: number // Σ estCost of the bucket's events (± ; excludes Void)
}

const UNSPECIFIED = 'Unspecified'

/** Bucket active (non-Void) events by a key, dropping empties. Shared by scope/type. */
function bucketBy(events: ChangeEvent[], keyOf: (e: ChangeEvent) => string): Map<string, ChangeEventBucket> {
  const map = new Map<string, ChangeEventBucket>()
  for (const e of events) {
    if (isVoid(e)) continue
    const key = keyOf(e) || UNSPECIFIED
    const b = map.get(key) ?? { key, count: 0, exposure: 0 }
    b.count++
    b.exposure += e.estCost
    map.set(key, b)
  }
  return map
}

const SCOPE_ORDER = ['In Scope', 'Out of Scope', 'TBD']

/**
 * Exposure by scope (In Scope / Out of Scope / TBD) for the breakdown, Void
 * excluded. Canonical scope order first, then any other scopes by |exposure| desc;
 * 'Unspecified' always last. Pure — no clock, no mutation.
 */
export function changeEventsByScope(events: ChangeEvent[]): ChangeEventBucket[] {
  return orderedBuckets(bucketBy(events, (e) => e.scope), SCOPE_ORDER)
}

/**
 * Exposure by funding bucket (Allowance / Buyout / Owner Contingency / Original
 * Budget / …) for the breakdown, Void excluded. Ordered by |exposure| desc;
 * 'Unspecified' always last. Pure — no clock, no mutation.
 */
export function changeEventsByType(events: ChangeEvent[]): ChangeEventBucket[] {
  return orderedBuckets(bucketBy(events, (e) => e.type), [])
}

/** Order buckets: canonical keys first (in the given order), then the rest by
 *  |exposure| desc (name-tiebroken); 'Unspecified' sinks to the very bottom. */
function orderedBuckets(map: Map<string, ChangeEventBucket>, canonical: string[]): ChangeEventBucket[] {
  const known = canonical.filter((k) => map.has(k)).map((k) => map.get(k) as ChangeEventBucket)
  const rest = [...map.values()]
    .filter((b) => !canonical.includes(b.key) && b.key !== UNSPECIFIED)
    .sort((a, b) => Math.abs(b.exposure) - Math.abs(a.exposure) || strCompare(a.key, b.key))
  const unspecified = map.get(UNSPECIFIED)
  return [...known, ...rest, ...(unspecified ? [unspecified] : [])]
}

/** A sortable column of the Change Events register. */
export type ChangeEventSortCol = 'scope' | 'type' | 'reason' | 'estCost' | 'status'
export interface ChangeEventSort {
  col: ChangeEventSortCol
  dir: 'asc' | 'desc'
}

/** Deterministic tiebreak: natural CE-number order, then id. */
const byChangeEventNumber = (a: ChangeEvent, b: ChangeEvent) =>
  compareDrawingNumber(a.number, b.number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function changeEventMetric(e: ChangeEvent, col: ChangeEventSortCol): number | string {
  switch (col) {
    case 'scope':
      return e.scope
    case 'type':
      return e.type
    case 'reason':
      return e.reason
    case 'estCost':
      return e.estCost
    case 'status':
      return e.status
  }
}

/**
 * The register order. `null` = the default: largest estimated cost first (adds at
 * the top, de-scope credits at the bottom), CE-number tiebroken. An explicit sort
 * orders by that column (strings case-insensitive); ties fall back to the natural
 * number order so the result stays deterministic. Pure — the input is copied.
 */
export function changeEventsSorted(events: ChangeEvent[], sort: ChangeEventSort | null): ChangeEvent[] {
  const rows = [...events]
  if (!sort) return rows.sort((a, b) => b.estCost - a.estCost || byChangeEventNumber(a, b))
  const sign = sort.dir === 'asc' ? 1 : -1
  return rows.sort((a, b) => {
    const x = changeEventMetric(a, sort.col)
    const y = changeEventMetric(b, sort.col)
    const cmp = typeof x === 'string' ? strCompare(x, y as string) : x - (y as number)
    return cmp * sign || byChangeEventNumber(a, b)
  })
}

// ---- Change Event detail drawer (Change Events, Phase 2) ----

const UNASSIGNED_CODE = 'Unassigned'

/** A change event's priced lines grouped by cost code, for the detail drawer:
 *  each group is one cost code (code + name) with its lines and a subtotal (± ;
 *  the subtotals sum to the event's estCost). Lines with no cost code fall under
 *  'Unassigned'. */
export interface ChangeEventLineGroup {
  costCode: string // '' → 'Unassigned'
  costCodeName: string
  amount: number // subtotal for the code (± ; credit negative)
  lineItems: ChangeEventLineItem[]
}

/**
 * Group a change event's line items by cost code (drawer schedule). Groups ordered
 * by |subtotal| desc with 'Unassigned' always last; lines within a group by |amount|
 * desc (id-tiebroken). Deterministic, pure — the input is never mutated.
 */
export function changeEventLineGroups(lineItems: ChangeEventLineItem[]): ChangeEventLineGroup[] {
  const buckets = new Map<string, ChangeEventLineItem[]>()
  for (const li of lineItems) {
    const key = li.costCode || UNASSIGNED_CODE
    const arr = buckets.get(key)
    if (arr) arr.push(li)
    else buckets.set(key, [li])
  }
  const groups: ChangeEventLineGroup[] = [...buckets.entries()].map(([costCode, lis]) => {
    const sorted = [...lis].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return {
      costCode: costCode === UNASSIGNED_CODE ? '' : costCode,
      costCodeName: sorted.find((l) => l.costCodeName)?.costCodeName ?? '',
      amount: lis.reduce((s, l) => s + l.amount, 0),
      lineItems: sorted,
    }
  })
  groups.sort((a, b) => {
    // 'Unassigned' (empty costCode) always sinks last.
    const au = a.costCode === '' ? 1 : 0
    const bu = b.costCode === '' ? 1 : 0
    return au - bu || Math.abs(b.amount) - Math.abs(a.amount) || compareDrawingNumber(a.costCode, b.costCode)
  })
  return groups
}

// ---- Invoicing pay-application register (Invoicing, Phase 1) ----

/** Totals for the Invoicing KPI cards. CUMULATIVE G702 fields (billed, retainage)
 *  are summed over the LATEST pay app per commitment (`isLatest`) — summing all
 *  rows would double-count, since each pay app's figures are cumulative-to-date. */
export interface InvoiceRollup {
  count: number // all pay apps
  underReview: number // # Under Review (needs approval)
  subs: number // distinct commitments billed (isLatest rows)
  billedToDate: number // Σ isLatest.billedToDate — ties to Commitments' billed
  retainageHeld: number // Σ isLatest.retainage — ties to Commitments' retainage
  thisPeriod: number // Σ isLatest.thisPeriod — the current cycle's net billing
}

/** Roll pay apps up for the KPI cards. Deterministic, pure — no clock. The
 *  isLatest gate is the correctness crux: cumulative fields sum over latest-per-
 *  commitment only. */
export function invoiceRollup(invoices: Invoice[]): InvoiceRollup {
  let underReview = 0
  let subs = 0
  let billedToDate = 0
  let retainageHeld = 0
  let thisPeriod = 0
  for (const inv of invoices) {
    if (inv.status === 'Under Review') underReview++
    if (inv.isLatest) {
      subs++
      billedToDate += inv.billedToDate
      retainageHeld += inv.retainage
      thisPeriod += inv.thisPeriod
    }
  }
  return { count: invoices.length, underReview, subs, billedToDate, retainageHeld, thisPeriod }
}

/** A sortable column of the Invoicing register. */
export type InvoiceSortCol = 'vendor' | 'period' | 'thisPeriod' | 'billed' | 'retainage' | 'pct' | 'status'
export interface InvoiceSort {
  col: InvoiceSortCol
  dir: 'asc' | 'desc'
}

/** Deterministic tiebreak: billing date desc (newest first), then id. */
const byInvoiceRecency = (a: Invoice, b: Invoice) => {
  const da = a.billingDate ?? ''
  const db = b.billingDate ?? ''
  // billingDate is preformatted ("Jun 5, 2026"); fall back to id for a total order.
  return db < da ? -1 : db > da ? 1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

function invoiceMetric(inv: Invoice, col: InvoiceSortCol): number | string {
  switch (col) {
    case 'vendor':
      return inv.vendor
    case 'period':
      return inv.billingDate ?? ''
    case 'thisPeriod':
      return inv.thisPeriod
    case 'billed':
      return inv.billedToDate
    case 'retainage':
      return inv.retainage
    case 'pct':
      return inv.pctComplete
    case 'status':
      return inv.status
  }
}

/**
 * The register order. `null` = the default: most recent pay app first (billing
 * date desc), id-tiebroken. An explicit sort orders by that column (strings
 * case-insensitive); ties fall back to recency so the result stays deterministic.
 * Pure — the input is copied, never mutated.
 */
export function invoicesSorted(invoices: Invoice[], sort: InvoiceSort | null): Invoice[] {
  const rows = [...invoices]
  if (!sort) return rows.sort(byInvoiceRecency)
  const sign = sort.dir === 'asc' ? 1 : -1
  // 'period' sorts by the real billing date via the recency comparator, not the
  // preformatted string (which wouldn't sort chronologically).
  if (sort.col === 'period') return rows.sort((a, b) => -sign * byInvoiceRecency(a, b) || byInvoiceRecency(a, b))
  return rows.sort((a, b) => {
    const x = invoiceMetric(a, sort.col)
    const y = invoiceMetric(b, sort.col)
    const cmp = typeof x === 'string' ? strCompare(x, y as string) : x - (y as number)
    return cmp * sign || byInvoiceRecency(a, b)
  })
}

/** Sortable YYYYMMDD from a "MM/DD/YY - MM/DD/YY" period's START date; -1 when
 *  unparseable. Used so the period dropdown sorts chronologically (a "06/01/25"
 *  period is OLDER than "01/01/26" — a lexical sort gets that wrong). */
function periodStartValue(period: string): number {
  const start = period.split(' - ')[0]?.trim() ?? ''
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(start)
  if (!m) return -1
  return (2000 + Number(m[3])) * 10000 + Number(m[1]) * 100 + Number(m[2])
}

/**
 * The distinct billing periods present, NEWEST first (by parsed start date, not
 * the lexical string). Empty periods dropped. Feeds the register's period
 * dropdown. Deterministic, pure — no clock.
 */
export function invoicePeriods(invoices: Invoice[]): string[] {
  const seen = new Set<string>()
  for (const inv of invoices) {
    const p = inv.period.trim()
    if (p) seen.add(p)
  }
  return [...seen].sort((a, b) => periodStartValue(b) - periodStartValue(a) || (a < b ? 1 : a > b ? -1 : 0))
}

/**
 * A pay app's sibling invoices — the same commitment's pay apps, newest first
 * (recency, id-tiebroken), the given invoice included. A pay app with no
 * commitment returns just itself. Drives the drawer's Billing history section.
 * Deterministic, pure — the input is never mutated.
 */
export function invoiceHistoryFor(invoices: Invoice[], invoice: Invoice): Invoice[] {
  if (!invoice.commitmentId) return [invoice]
  return invoices.filter((i) => i.commitmentId === invoice.commitmentId).sort(byInvoiceRecency)
}
