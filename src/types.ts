// Core domain types. These mirror DATA_CONTRACT.md — the normalized shapes a
// Procore-integration service must produce. Keep them in sync with that doc.

export type Project = 'mckenna' | 'opiii' // extend as projects are added
export type Urgency = 'over' | 'week' | 'track' | 'muted'
export type Tone = 'danger' | 'warn' | 'ok' | 'info' | 'muted'

/** A tool's view type — governs which content surface renders. */
export type ViewType =
  | 'home'
  | 'overview'
  | 'directory'
  | 'list'
  | 'financial'
  | 'photos'
  | 'dailyLog'

/** Stable tool keys used for nav, records, and the ball-in-court rule. */
export type ToolKey =
  | 'overview'
  | 'home'
  | 'directory'
  | 'rfis'
  | 'submittals'
  | 'drawings'
  | 'specs'
  | 'changeEvents'
  | 'punch'
  | 'dailyLog'
  | 'photos'
  | 'meetings'
  | 'schedule'
  | 'documents'
  | 'primeContract'
  | 'budget'
  | 'commitments'
  | 'changeOrders'
  | 'invoicing'

export interface Status {
  label: string
  tone: Tone
}

/**
 * The atom: every actionable record across tools normalizes to this. Named
 * `Item` (not `Record`) to avoid shadowing TypeScript's built-in `Record<K,V>`
 * utility; this is the contract's "Record (the atom)" (DATA_CONTRACT §1).
 */
export interface Item {
  id: string // stable Procore id (used for links + navigation)
  tool: ToolKey
  project: Project
  num: string // display number, e.g. "#042", "CO #007", "A-201"
  title: string // subject / description line
  who: string // party currently holding the ball; "You" == Ben
  mine: boolean // true when who === Ben (drives YOU pill + "In My Court")
  date: string // preformatted display string, e.g. "due Jun 24", "$186,400"
  urgency: Urgency
  status: Status | null
  links?: string[] // ids of related records in other tools
}

export interface Contact {
  id: string
  name: string
  company: string
  role: string
  trade: string
  email: string
  phone: string
  projects: Project[]
  match?: string // optional keyword to associate records by title
}

/** One activity-feed event (DATA_CONTRACT §7). */
export interface ActivityEvent {
  project: Project
  text: string
  sub: string
  tone: Tone
  when: string // relative time, e.g. "2h ago"
}

/**
 * Financial rollup source (DATA_CONTRACT §6). Division rows are
 * [name, budget, committed, invoiced] in $millions; KPIs and % are computed in
 * the selector layer, not stored.
 */
export interface FinancialSource {
  divisions: Record<Project, [string, number, number, number][]>
  approvedChanges: Record<Project, number> // approved COs, $M
  projectedOverUnder: Record<Project, number> // +over / -under, $M
}

export interface ToolMeta {
  label: string
  code: string // short mono code badge, e.g. "RFI"
  view: ViewType
  group?: number // index into GROUPS (nav grouping)
  desc: string
  /** Column labels for list registers. */
  whoLabel?: string
  rightLabel?: string
}

export interface NavGroup {
  label: string
  keys: ToolKey[]
}
