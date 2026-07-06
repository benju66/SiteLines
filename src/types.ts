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
  | 'drawings'

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

/**
 * One response on a record's thread (an RFI answer, later a submittal/punch
 * reply). `date` and `text` are preformatted display strings (like `Item.date`);
 * `official` marks the answer of record.
 */
export interface ItemResponse {
  author: string
  date: string | null // preformatted, e.g. "Jun 24, 2024"; null when undated
  text: string
  official: boolean
  status?: string // decision label, e.g. a submittal approver's "Approved as Noted"
}

/** A downloadable file on a record. `url` is a pre-signed Procore link. */
export interface ItemAttachment {
  name: string
  url: string
}

/**
 * The lazily-loaded detail thread behind a record (DATA_CONTRACT record detail).
 * Fetched via `DataSource.getDetail(item)` when the drawer opens — the register
 * `Item` stays light. Carries the RFI request + responses + surrounding metadata
 * (all assignees, closed date, a deep link into Procore, and attachments).
 * proposedSolution/instructions are contract-available but not yet surfaced.
 */
export interface ItemDetail {
  request: string
  proposedSolution?: string
  instructions?: string
  responses: ItemResponse[]
  assignees?: string // full assignee list, comma-joined
  closedDate?: string | null // preformatted, e.g. "May 12, 2026"; null when open
  procoreUrl?: string // deep link to open the record in Procore
  attachments: ItemAttachment[]
  /** The final reviewed submittal (Procore's distributed, stamped doc), surfaced
   *  separately from the originally-submitted attachments. Submittals only. */
  finalSubmittal?: ItemAttachment[]
}

/**
 * A current drawing sheet (Drawings workstream, Phase 1). Reference data — NOT a
 * court `Item` and never enters My Court. Grouped by `discipline` in the drawing
 * log; `drawingId` groups a sheet's historical revisions (the Phase 2 picker).
 * Dates are preformatted display strings; urls are pre-signed Procore links.
 */
export interface Drawing {
  id: string // item id of the current revision, e.g. "drawings:<revId>"
  drawingId: string // parent drawing id — groups a sheet's revisions
  number: string // "A1.1"
  title: string
  discipline: string // "Architectural" (from discipline.name; "" → "Uncategorized")
  revision: string // revision_number, e.g. "5"
  drawingDate: string | null // preformatted display date
  receivedDate: string | null // preformatted display date
  set: string | null // drawing_set.name
  status: string // "published"
  thumbnailUrl: string | null
  pngUrl: string | null
  pdfUrl: string | null
}

/**
 * One historical issue of a drawing sheet (Drawings Phase 2 — the viewer's
 * revision picker). Fetched lazily by `drawingId` via
 * `DataSource.getDrawingRevisions`, so the log snapshot stays light. `current`
 * marks the issue that appears in the log; `pngUrl` is the image the viewer
 * renders (pre-signed Procore link).
 */
export interface DrawingRevision {
  id: string // this revision's item id, e.g. "drawings:<revId>"
  revision: string // revision_number, e.g. "12"
  drawingDate: string | null // preformatted display date
  current: boolean
  pngUrl: string | null
  pdfUrl: string | null
  procoreUrl: string | null // constructed deep link to the sheet in Procore
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

/** A jobsite photo (README §4). `mine` = flagged by Ben. */
export interface Photo {
  project: Project
  caption: string
  date: string
  mine: boolean
}

/** A daily-log field report (README §5). `mine` = awaiting Ben's sign-off. */
export interface DailyLogEntry {
  project: Project
  date: string
  weather: string
  temp: string
  crew: number
  mine: boolean
  notes: string
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
