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
  | 'budget'
  | 'commitments'
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
 * One budget line (Budget Insights, Phase 1) — a WBS row of a project's primary
 * cost budget, at the grain Procore stores: cost code × cost type. Reference
 * data — NOT a court `Item` and never enters My Court (like `Drawing`). Raw
 * DOLLARS; the selector layer groups by division, subtotals, and computes the
 * `%`/derived values (never stored — DATA_CONTRACT §6). A cost code that splits
 * across cost types appears as more than one line (e.g. a Material line + a
 * Subcontract line), so 115 cost codes surface as 124 lines for OP III.
 */
export interface BudgetLine {
  project: Project // 'opiii' for v1 (only OP III is synced for budget)
  division: string // root_cost_code, e.g. "9 - Division 09 - Finishes"
  costCode: string // "9-92116.000 - Gypsum Board Assemblies"
  costType: string // category: "Labor" | "Material" | "Subcontract"
  budget: number // "Revised Budget"
  committed: number // "Committed Costs"
  jtdCosts: number | null // "Job to Date Costs" (empty in this budget view — use erpJtd for actuals)
  erpJtd: number // "ERP Job to Date Cost" — actual cost to date (= Commitments Invoiced + Direct Costs)
  directCosts: number // "Direct Costs" — actuals billed outside commitments
  eac: number // "Estimated Cost at Completion"
  pendingCos: number // "Pending COs" (all $0 today — feeds Phase 3)
  pendingCostChanges: number // "Pending Cost Changes" (sparse today — feeds Phase 3)
  projectedOverUnder: number // "Projected over Under" (negative = over budget)
}

/**
 * Pending-change exposure for one cost code (Budget Insights, Phase 3). Reference
 * data — the cost impact of OPEN change events (not yet approved into the budget),
 * attributed to a budget division. `pendingAmount` is raw dollars (negative = a
 * de-scope credit); the selector adds it to the division's revised budget to
 * project the budget after pending changes land. `division`/`costCode` are
 * `'Unassigned'` when a change-event line has no cost code yet.
 */
export interface BudgetPending {
  project: Project
  division: string // budget root_cost_code, or 'Unassigned'
  costCode: string // budget cost_code, or the change-event cost-code name, or 'Unassigned'
  pendingAmount: number // Σ estimated_cost_amount of the cost code's open change-event line items
  openEvents: number // count of open change events touching the cost code
}

/**
 * One commitment — a subcontract (SC) or purchase order (PO) with its financial
 * position (Commitments, Phase 1). Reference data — NOT a court `Item` and never
 * enters My Court (like `Drawing`/`BudgetLine`). The commitments master is
 * header-only, so the financials come from the commitment's LATEST requisition
 * (its AIA G702 summary); `hasRequisition` is false for a just-issued commitment
 * with no pay app yet — the register shows "—" for its financials. Raw DOLLARS;
 * the selector layer computes the rollup and % (never stored — DATA_CONTRACT §6).
 */
export interface Commitment {
  project: Project // 'opiii' for v1 (only OP III is synced)
  id: string // "commitments:<procore id>"
  number: string // "SC-25-117-030" / "PO-25-117-061"
  title: string
  vendor: string // contract company (vendors_master.name; '' when unknown)
  type: 'PO' | 'SC' | 'Other' // from the number prefix (no type field in the synced master)
  status: string // "Draft" | "Approved" | …
  executed: boolean
  hasRequisition: boolean // financials below are real only when true
  original: number // original_contract_sum (0 when no requisition yet)
  revised: number // contract_sum_to_date (original + change orders)
  billed: number // total_completed_and_stored_to_date
  retainage: number // total_retainage
  pctComplete: number // 0..1 (the latest requisition's percent_complete)
  coCount: number // # commitment change orders (Void excluded)
  coTotal: number // Σ commitment CO grand_total (Void excluded)
  // descriptive (for the Phase 2 drawer; already synced):
  description: string
  deliveryDate: string | null
  private: boolean
  // scope detail (Phase 4 — from the commitment detail sync; HTML-stripped flat
  // text, '' when Procore has none). `grandTotal` is the SOV total (= Σ the
  // commitment's line-item amounts; the original contract sum before COs); 0 when
  // absent.
  inclusions: string
  exclusions: string
  grandTotal: number
}

/**
 * One commitment SOV (schedule-of-values) line item (Commitments, Phase 4).
 * Reference data — NOT a court `Item` and never enters My Court (like
 * `Commitment`/`BudgetLine`). Each line carries the Procore `cost_code.full_code`
 * (e.g. "12-123530.000"), which matches the budget's cost_code prefix — this is
 * the seam for the Budget↔Commitment cross-link. Raw DOLLARS; the selector layer
 * joins to budget codes and rolls up (never stored — DATA_CONTRACT §6). Loaded in
 * the main snapshot (479 rows for OP III), not lazily — small enough to ride along.
 */
export interface CommitmentLineItem {
  project: Project // 'opiii' for v1 (only OP III is synced)
  id: string // "commitments:<commitment id>:li:<line item id>" — stable list key
  commitmentId: string // "commitments:<commitment id>" — matches Commitment.id
  costCode: string // Procore cost_code.full_code, e.g. "12-123530.000" (the join key)
  costCodeName: string // cost_code.name, e.g. "Residential Casework"
  amount: number // the line's value in dollars (= total_amount on the synced rows)
  description: string // the SOV line's scope text
}

/**
 * One commitment change order (Commitments, Phase 2 — the detail drawer's CO
 * log). Reference data, lazily fetched per commitment via
 * `DataSource.getCommitmentDetail`. `amount` is raw dollars (can be negative — a
 * de-scope credit); `date` is a preformatted display string.
 */
export interface CommitmentChangeOrder {
  id: string // "<commitment id>:co:<number>" — stable list key
  number: string // "001"
  title: string
  amount: number // grand_total (negative = credit)
  status: string // "Approved" | …
  executed: boolean
  date: string | null // preformatted, e.g. "Sep 22, 2025"
}

/**
 * One subcontractor pay application against a commitment (Commitments, Phase 2 —
 * the detail drawer's billing history). Reference data, lazily fetched. Amounts
 * are raw dollars; `pctComplete` is 0..1.
 */
export interface CommitmentBilling {
  id: string // "<commitment id>:req:<number>" — stable list key
  number: string // requisition number, e.g. "7"
  invoiceNumber: string // "R-030567-000-7"
  period: string // "05/01/26 - 05/31/26"
  billingDate: string | null // preformatted, e.g. "Jun 11, 2026"
  status: string
  pctComplete: number // 0..1
  billedToDate: number // total_completed_and_stored_to_date at this pay app
  thisPeriod: number // current_payment_due for this pay app
}

/**
 * The lazily-loaded detail behind a commitment (Commitments, Phase 2). Fetched
 * via `DataSource.getCommitmentDetail(id)` when the drawer opens — the register
 * `Commitment` stays light. The descriptive fields (description, dates, privacy)
 * ride on the `Commitment` itself; this carries the two per-commitment lists.
 * Contract summary / SOV inclusions-exclusions / additional info aren't synced
 * yet (Phase 3) — the drawer stubs them.
 */
export interface CommitmentDetail {
  changeOrders: CommitmentChangeOrder[]
  billings: CommitmentBilling[]
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
