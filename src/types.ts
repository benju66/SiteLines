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
  | 'changeEvents'
  | 'invoicing'
  | 'photos'
  | 'dailyLog'
  | 'drawings'
  | 'specs'
  | 'punch'

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

/**
 * One current specification section (Specifications). Reference data — NOT a court
 * `Item` and never enters My Court (like `Drawing`). Grouped by CSI MasterFormat
 * `division` (the first token of `number`) in the spec log. `issuedDate`/`pdfUrl`/
 * `revisionId` come from the Phase-2 current-revision enrichment; `pdfUrl` is null
 * when the section has no PDF in Procore (the row then offers only Open-in-Procore).
 */
export interface Spec {
  id: string // "specs:<sectionId>"
  number: string // "26 0519"
  title: string // section title (from description)
  division: string // CSI division code — first token of number, e.g. "26"
  procoreUrl: string | null // deep link to the current revision's PDF viewer in Procore (from current_revision_id — no re-sync)
  revisionId: string | null // the current_revision_id — passed to the spec-file edge fn to stream a fresh PDF
  issuedDate: string | null // the current revision's issued date (preformatted display); null if no revision
  pdfUrl: string | null // the current revision's stored PDF url — an EXISTENCE FLAG only (expiring sig; the edge fn re-mints for viewing)
}

/**
 * One punch item for the closeout dashboard (Punch List). Reference-style — the
 * court `Item` for My Court still comes from the `sitelines_items` UNION; this is the
 * richer row the dedicated `PunchView` renders. Grouped by lifecycle `workflowStatus`
 * or `assignee`. Phase-2 detail (the real response thread + photos) is fetched lazily
 * via the record drawer, not carried here — `hasPhotos`/`hasOpenResponse` are just
 * indicators from the synced flags.
 */
export interface PunchItem {
  id: string // "punch:<id>" (matches the sitelines_items UNION id)
  project: Project // 'opiii' (only OP III synced) — for scoped()
  number: string // "#<position>"
  name: string // the item title (this project's items have no separate description)
  assignee: string // assignees[0].name → ball_in_court → "" (the responsible sub)
  status: string // "Open" | "Overdue" | "Closed"
  workflowStatus: string // "initiated" | "work_required" | "ready_for_review" | "closed"
  dueDate: string | null // preformatted display date
  dueSort: string // sortable ISO "YYYY-MM-DD" (or "") — the raw due date, for chronological order
  hasPhotos: boolean // has_attachments (indicator only in Phase 1)
  hasOpenResponse: boolean // has_unresolved_responses (indicator only in Phase 1)
  manager: string // punch_item_manager.name (the GC owner)
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
 * One change event (Change Events, Phase 1) — a POTENTIAL change being tracked and
 * priced before it becomes a change order. Reference data — NOT a court `Item` and
 * never enters My Court (like `Commitment`/`BudgetLine`); the thin `Item` feed for
 * change events (itemsByTool.changeEvents) still powers My Court / search / links.
 * The header carries scope + funding bucket + reason; `estCost` is the Σ of the
 * event's line-item estimated costs (raw DOLLARS; negative = a de-scope credit). The
 * selector layer formats $ / % and computes the rollup + breakdowns (never stored —
 * DATA_CONTRACT §6). Open events are the source of Budget's pending-change section.
 */
export interface ChangeEvent {
  project: Project // 'opiii' for v1 (only OP III is synced)
  id: string // "changeEvents:<procore id>" — matches the Item-feed id
  number: string // display number, e.g. "CE #12"
  title: string
  status: string // "Open" | "Closed" | "Void" (initcap of the raw status)
  scope: string // "In Scope" | "Out of Scope" | "TBD" | '' (event_scope)
  type: string // funding bucket (event_type): "Allowance" | "FP Contingency/Buyout" |
  // "Owner Contingency" | "Original Budget" | '' when unset (older events carry none)
  reason: string // change_order_change_reason, '' when none
  estCost: number // Σ estimated_cost_amount of the event's line items (± ; credit = negative)
  lineItems: number // # line items on the event
  commitments: number // # distinct commitments the event's lines hit (via contract_number)
  originRfi: boolean // true when the event originated from an RFI (change_event_origin_type)
  description: string // HTML-stripped flat text
  createdAt: string | null // preformatted display date (e.g. "Jun 11, 2026")
}

/**
 * One change-event line item (Change Events, Phase 2) — a priced line on a change
 * event, carrying its cost code and the commitment it hits. Reference data — NOT a
 * court `Item`, never in My Court. Loaded in the main snapshot (242 rows for OP III),
 * not lazily — small enough to ride along (like `CommitmentLineItem`). Raw DOLLARS
 * (negative = a de-scope credit); the selector layer groups by cost code and
 * subtotals (never stored — DATA_CONTRACT §6). `commitmentId` resolves the
 * `contract_number` to a real commitment (matches `Commitment.id`) for the drawer's
 * Change-Event → Commitment cross-link; null when the line hits no commitment.
 */
export interface ChangeEventLineItem {
  project: Project // 'opiii' for v1
  id: string // "changeEvents:<ce id>:li:<line item id>" — stable list key
  changeEventId: string // "changeEvents:<ce id>" — matches ChangeEvent.id (the drawer filter)
  costCode: string // cost_code_number, e.g. "4-40000.000" ('' → grouped under 'Unassigned')
  costCodeName: string // cost_code_name
  amount: number // estimated_cost_amount (± ; credit = negative)
  description: string // the line's scope text
  commitmentNumber: string // contract_number, e.g. "SC-25-117-220" ('' when none)
  commitmentId: string | null // "commitments:<procore id>" when it resolves to a commitment, else null
}

/**
 * One pay application / requisition (Invoicing, Phase 1) — a subcontractor's
 * invoice against a commitment. Reference data — NOT a court `Item`, never in My
 * Court (like `Commitment`/`ChangeEvent`); the thin `Item` feed for invoicing still
 * powers My Court / search / links. Loaded in the main snapshot (200 rows for OP
 * III), not lazily. Raw DOLLARS; the selector layer formats and rolls up (never
 * stored — DATA_CONTRACT §6). CUMULATIVE G702 fields (`billedToDate`, `retainage`)
 * are cumulative-to-this-pay-app — the rollup sums them over `isLatest` rows only
 * (the most recent pay app per commitment), NEVER across all rows. `commitmentId`
 * matches `Commitment.id` for the drawer's Invoice → Commitment cross-link.
 */
export interface Invoice {
  project: Project // 'opiii' for v1 (only OP III is synced)
  id: string // "invoicing:<requisition id>"
  number: string // pay-app number (invoice_number, else number)
  vendor: string // vendor_name ('' for the owner pay app)
  contract: string // contract_name
  commitmentId: string | null // "commitments:<commitment id>" — matches Commitment.id; null when none
  period: string // billing period, e.g. "05/01/26 - 05/31/26"
  billingDate: string | null // ISO date ("2026-06-05") — kept raw so the register sorts
  // chronologically (ISO sorts lexically); the view formats it at render (formatShortDate)
  status: string // "Approved" | "Under Review"
  final: boolean // marked the final pay app
  isLatest: boolean // the most recent pay app for its commitment (gates the rollup's cumulative sums)
  thisPeriod: number // current_payment_due (net due this period, net of retainage)
  billedToDate: number // total_completed_and_stored_to_date (cumulative gross)
  retainage: number // total_retainage (cumulative held)
  pctComplete: number // 0..1
  // G702 cover sheet (the Phase-2 drawer; carried now so Phase 2 needs no new view):
  original: number // original_contract_sum
  revised: number // contract_sum_to_date
  netChangeByCOs: number // net_change_by_change_orders
  earnedLessRetainage: number // total_earned_less_retainage
  balanceToFinish: number // balance_to_finish_including_retainage
}

/**
 * One pay-application SOV line — the AIA G703 continuation sheet (Invoicing, Phase 5).
 * Reference data — NOT a court `Item`, never in My Court. Loaded in the main snapshot
 * (like `changeEventLineItems`). Each line is one scheduled-value item on a pay app:
 * what was billed this period vs. from the previous application vs. to date, against
 * the scheduled value, with retainage and balance to finish. Raw DOLLARS; the selector
 * layer orders + subtotals (never stored — DATA_CONTRACT §6). `invoiceId` matches
 * `Invoice.id`. The lines' `billedToDate` sum to the pay app's G702 cover-sheet total.
 */
export interface InvoiceLineItem {
  project: Project // 'opiii' for v1
  id: string // "invoicing:<req id>:li:<line item id>" — stable list key
  invoiceId: string // "invoicing:<req id>" — matches Invoice.id (the drawer filter)
  itemNumber: string // G703 item number (display order / label)
  description: string // description_of_work
  scheduledValue: number // scheduled_value (this line's contract amount)
  fromPrevious: number // work_completed_from_previous_application
  thisPeriod: number // work_completed_this_period
  stored: number // materials_presently_stored
  billedToDate: number // total_completed_and_stored_to_date (cumulative)
  pctComplete: number // 0..1 (of scheduled value billed)
  retainage: number // total_retainage_currently_retained (held on this line)
  balanceToFinish: number // balance_to_finish
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

/** Which commitment scope field an override structures (DATA_CONTRACT — the three
 *  scope surfaces covered in Phase 5). */
export type ScopeField = 'description' | 'inclusions' | 'exclusions'

/**
 * One block of a scope-structure override (Commitments, Phase 5). A flat, ordered
 * list — nesting is carried by `indent`, not a tree — so the editor (5c) and the
 * "blocks are a partition of the source" invariant stay simple. The editor only
 * performs structural ops (split / heading / indent / merge), never typed text, so
 * `text` is always a verbatim slice of the source. Kept intentionally narrower than
 * `parseScope`'s `ScopeBlock` (just para/heading, no markers/bullets): this is what
 * the user authored, not what the parser guessed.
 */
export interface ScopeBlockOverride {
  kind: 'para' | 'heading'
  indent: number // 0-based nesting depth
  text: string // a verbatim slice of the source scope text
  list?: 'bullet' | 'number' // presentation-only list style (Phase 6a); absent =
  // plain. The `•` / computed ordinal is drawn at render — NEVER stored in `text`,
  // so the words-locked partition invariant is untouched. Rendered on para blocks.
  bold?: number[] // presentation-only word-level emphasis (Phase 6c): indices into
  // the block's space-split words (`text.split(' ')`) to render bold. Absent/empty =
  // no manual bold. Which words, NEVER markup in `text`, so the partition invariant is
  // untouched (same safe model as `list`); split/merge re-map these indices.
  source?: 'user' // Phase 6b — present = a user-authored NOTE (free text the owner
  // typed, a clarification/reminder), absent = contract words (a verbatim slice of the
  // source). Notes are the ONLY place typing is allowed; they are EXCLUDED from the
  // words-locked partition assertion (see partitionsSource) and rendered clearly marked
  // as the owner's addition — so the contract's language can never be shown altered.
}

/**
 * A user-authored structural override of a commitment's scope text (Commitments,
 * Phase 5). The app's FIRST user-authored / write-back data — distinct from the
 * read-only Procore mirror (`Commitment` et al.), never a court `Item`, never in
 * My Court / `ballInCourt`. Persisted via the `UserData` seam (Supabase table
 * live, `localStorage` in seed), keyed by `(commitmentId, field)`. `sourceHash`
 * (a `hashText` of the normalized source the structure was built on) guards
 * staleness: on a mismatch, 5b falls back to the parser output. `updatedAt` is an
 * ISO display timestamp stamped at save; the DB's `updated_by` audit column is not
 * surfaced here.
 */
export interface ScopeOverride {
  commitmentId: string // "commitments:<procore id>" — matches Commitment.id
  field: ScopeField
  blocks: ScopeBlockOverride[]
  sourceHash: string
  updatedAt: string // ISO timestamp, stamped at save (display only)
}

/** A `ScopeOverride` as authored, before the seam stamps `updatedAt` at save. */
export type ScopeOverrideInput = Omit<ScopeOverride, 'updatedAt'>

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

/**
 * A target the detail drawer can show — the discriminated union behind the
 * cross-drawer navigation stack (`AppState.drawerHistory`). Each variant carries
 * exactly what its `AppState` slot holds, so restoring a target is a plain slot
 * assignment. Powers the drawer's Back button: following a cross-link (a linked
 * record, the commitment a change event / invoice hits) pushes the current target
 * here so Back can restore it. Pure transitions live in `src/lib/drawerNav.ts`.
 */
export type DrawerTarget =
  | { kind: 'detail'; value: { tool: ToolKey; record: Item } }
  | { kind: 'commitment'; value: Commitment }
  | { kind: 'changeEvent'; value: ChangeEvent }
  | { kind: 'invoice'; value: Invoice }

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
