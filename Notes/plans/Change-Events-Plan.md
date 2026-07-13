# Change Events — enrich the tool into a cost-exposure ledger (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + the design handoff (`design_handoff_sitelines/`).
> Siblings done — reuse their patterns verbatim: **Budget Insights**
> (`Notes/plans/Budget-Insights-Plan.md`) and **Commitments**
> (`Notes/plans/Commitments-Plan.md`). This workstream is the third in the same
> family (per-tool Supabase view → mapper → `SiteData` slice → own view + drawer),
> and it **closes the change-money loop**: Budget's pending-change section already
> reads OPEN change events — Change Events is literally its source.

## Goal
Turn **Change Events** from a bare register (CE # · title · blank "Owner" · status)
into a **cost-exposure ledger**: its own view (like Budget/Commitments) that leads
with the money — how much potential change is in flight, whether it's In or Out of
Scope, and which funding bucket (Allowance / Buyout / Owner Contingency / Original
Budget) it draws from — plus an enriched, sortable register and a **detail drawer**
showing each event's priced line items, the **commitment(s) each change hits**, and
the **tie-back to Budget's pending-change section**.

**Plain-English:** a change event is a *potential* change being tracked and priced
before it becomes a change order. Today the tool just lists them. Enriched, it
answers the question Procore makes you dig for: *"How much change is in flight,
is it ours to absorb or the owner's to pay, and what pot of money covers it?"*

## Where the data actually lives (verified live 2026-07-13, OP III / 3051002)
Both tables are **already synced** — this whole workstream needs **zero re-sync**,
only new read-only Supabase views over existing masters.

- **`procore_change_events_master`** — **165 events** (143 Closed · 6 open · 16 Void).
  Header fields present: `number`, `alphanumeric_number`, `title`, `description`,
  `status` (`open`/`closed`/`void`), `event_scope` (**In Scope / Out of Scope / TBD**),
  `event_type` (funding bucket: **Allowance / FP Contingency/Buyout / Owner
  Contingency / Original Budget**; null on many older events), `change_order_change_reason`
  (7 distinct), `change_event_origin_type` + `change_event_origin_id` (what spawned
  it — only `Rfi::Header` appears, on **2 events**), `rfi` (link object, 2 events),
  `rfqs`, `attachments`, `created_by`, `created_at`, `updated_at`.
- **`procore_change_event_line_items_master`** — **242 line items across the 165
  events** (small — rides along in the main snapshot, no lazy seam). Fields:
  `change_event_id`, `line_item_id`, `cost_code_number` (e.g. `4-40000.000`; 21 lines
  have none → `Unassigned`), `cost_code_name`, `cost_code_id`, `estimated_cost_amount`
  (the price; **can be negative** = a de-scope credit), `description`, and
  **`contract_id` + `contract_number`** — the **commitment the line hits**.

**Verified totals (the numbers a phase must reconcile to):**
- Total estimated cost across all events ≈ **$409,519**; **open exposure ≈ $19,395**
  (the 6 open events — this is exactly what Budget's pending section sums, so the two
  must tie; the earlier `$32,505` in Budget-Insights was an older snapshot — change-event
  data drifts as events close, expected).
- **Line → Commitment cross-link is real and dense:** **180 of 242 line items** resolve
  to a real commitment by `contract_number` = `procore_commitments_master.raw->>'number'`
  (**40 distinct commitments**). This is the headline cross-link.
- **RFI origin is rare** (2 events) — build it opportunistically, never as a headline.

## Out of scope / deferred
- **Re-sync / new Procore pulls** — none. Everything is already in the masters.
- **Richer line-item pricing** (proposed vs. latest ROM, vendor quotes, markup) — lives
  on Procore's private change-event line-item endpoint, **not synced**. v1 uses
  `estimated_cost_amount` only. A future sync change could add it (its own go/no-go).
- **Change Event → Change Order link** — when a change event closes it may roll into a
  PCO/CCO; that link isn't in the synced masters. Deferred (belongs with the Change
  Orders workstream, if/when it's enriched).
- **Writing back to Procore** — never. All read-only.
- **McKenna / multi-project** — OP III only for v1 (only 3051002 is synced), consistent
  with Budget/Commitments.
- **Attachments in the drawer** — the header carries an `attachments` key; treat as
  opportunistic (render chips if trivially available, otherwise stub). Not a v1 gate.

## Locked product decisions (owner, 2026-07-13)
1. **Primary lens = cost-exposure ledger** — an own analytics view like Budget/Commitments;
   the rollup leads with the money (total estimated exposure, open vs. closed, split by
   **scope** In/Out/TBD and by **funding bucket**), not a plain status list.
2. **Drawer + cross-links are in v1** (not deferred behind a later go/no-go): the detail
   drawer with priced line items, the **Change-Event→Commitment** cross-link, and the
   **Budget-pending tie-back** ship as Phase 2 of this plan.
3. **RFI-origin cross-link is opportunistic** (only 2 events) — wire it if cheap; never a
   headline.
4. Reuse Budget/Commitments' seam + hand-rolled philosophy (no chart lib; one token source).

## The court-tool question — resolved (no `ballInCourt` change)
Change Events **already exists as an `Item` feed** in `sitelines_items` (who=NULL —
"change events carry no ball-in-court") and is in `COURT_TOOLS`. Enriching it exactly
mirrors Commitments: the nav routes "Change Events" to the **new own view** instead of
`ToolRegisterView`, while the thin `Item` feed **stays** (powering My Court's "All"
list, command-palette search, and cross-links). **`src/lib/ballInCourt.ts` is not
touched** — this is a guardrail. The enriched `ChangeEvent` is additive **reference
data** (like `Commitment`/`BudgetLine`), never itself a court `Item`.

## Data model (DATA_CONTRACT — keep the UI dumb)
Add to `src/types.ts` (reference data; **never** enters My Court / `ballInCourt`). Raw
**dollars**; the selector layer formats and derives (%/rollup/buckets):

```ts
// Phase 1
export interface ChangeEvent {
  project: Project          // 'opiii' for v1
  id: string                // "changeEvents:<procore id>" — matches the Item feed id
  number: string            // display, e.g. "CE #12"
  title: string
  status: string            // "Open" | "Closed" | "Void" (initcap of the raw status)
  scope: string             // "In Scope" | "Out of Scope" | "TBD" | '' (event_scope)
  type: string              // funding bucket (event_type): "Allowance" | "FP Contingency/Buyout"
                            //   | "Owner Contingency" | "Original Budget" | '' when unset
  reason: string            // change_order_change_reason, '' when none
  estCost: number           // Σ estimated_cost_amount of the event's line items (± ; credit = negative)
  lineItems: number         // # line items on the event
  commitments: number       // # distinct commitments the event's lines hit (via contract_number)
  originRfi: boolean        // true when change_event_origin_type = 'Rfi::Header'
  description: string        // HTML-stripped flat text
  createdAt: string | null  // preformatted display date
}

// Phase 2
export interface ChangeEventLineItem {
  project: Project          // 'opiii'
  id: string                // "changeEvents:<ce id>:li:<line item id>" — stable list key
  changeEventId: string     // "changeEvents:<ce id>" — matches ChangeEvent.id (drawer filter key)
  costCode: string          // cost_code_number, e.g. "4-40000.000" (or '' → 'Unassigned' in the view)
  costCodeName: string
  amount: number            // estimated_cost_amount (± ; credit = negative)
  description: string
  commitmentNumber: string  // contract_number, '' when none
  commitmentId: string | null // "commitments:<number>" when it resolves to a real commitment, else null
}
```
- **Seam:** add `changeEvents: ChangeEvent[]` (Phase 1) and `changeEventLineItems:
  ChangeEventLineItem[]` (Phase 2) to `SiteData`, both loaded in `fetch()` (165 + 242
  rows — small, no lazy seam, mirroring `commitmentLineItems`). Mappers `mapChangeEvent`
  / `mapChangeEventLineItem` mirror `mapCommitment` / `mapCommitmentLineItem` (guarded
  `num()`). **No new `DataSource` method** — simpler than Commitments (which needed a
  lazy `getCommitmentDetail`); the drawer filters the line-item slice by `changeEventId`.

## Pure logic to extract + unit-test (`src/selectors/` + `.test.ts`)
Deterministic; pass data in, no clock:
- `changeEventRollup(events)` → the KPI + breakdown source: counts (open / closed / void),
  total estimated exposure, **open** exposure (must tie to Budget's pending), exposure
  **by scope** (In/Out/TBD) and **by funding type** (Allowance/Buyout/Owner/Original/—).
- `changeEventsSorted(events, sort)` → register order (by est. cost / status / number /
  scope); default est-cost desc. Reuse the Budget/Commitments sort pattern.
- `changeEventLineGroups(lineItems)` (Phase 2) → the drawer's line items grouped/subtotaled
  by cost code (mirrors `commitmentSovByCostCode`); the drawer resolves `commitmentId` →
  the `Commitment` for the cross-link.
- Keep every derivation here, not in the view (guardrail).

## Build-on inventory (read these fresh before using)
REUSE, do not fork:
- `Notes/plans/Commitments-Plan.md` + `src/components/views/CommitmentsView.tsx` — the
  own-view pattern (rollup KPI cards, sortable/resizable register, hand-rolled). **Mirror
  it for `ChangeEventsView`.**
- `src/components/views/BudgetView.tsx` — the collapsible breakdown-section pattern (its
  "Risk & cost-type mix" / "Pending changes" sections) — mirror for the scope/funding
  breakdown, and note how it opens a commitment (`patch({ commitment: c })` via
  `onOpenCommitment`).
- `src/lib/mapCommitment.ts` + `src/lib/mapCommitmentLineItem.ts` — the view-row →
  contract-shape mapper pattern (guarded `num()`).
- `sync/views/sitelines_commitments.sql` + `sitelines_commitment_line_items.sql` +
  `sitelines_budget_pending.sql` — the `security_invoker=true` view style, the
  vendors/line-item join pattern, and (crucially) `budget_pending`'s exact open-change-event
  aggregation to reconcile against.
- `src/data/supabaseSource.ts` (`fetchAll` paging + slice) · `src/data/seedSource.ts`
  (fixture) · `src/lib/dataSource.ts` (`SiteData`) · `src/state/DataContext.tsx`.
- `src/components/overlays/CommitmentDrawer.tsx` — the drawer shell to clone for
  `ChangeEventDrawer`; `src/App.tsx` overlay slot (fixed sibling of the card) + the
  `patch({ commitment: null, … })` Esc-clear list to extend with `changeEvent`.
- `src/state/AppContext.tsx` — add a `changeEvent: ChangeEvent | null` field to `AppState`
  (drives the drawer), mirroring `commitment`.
- `src/data/tools.ts` (`changeEvents` meta → new `view: 'changeEvents'`) ·
  `src/components/layout/MainContent.tsx` (add the `changeEvents` ViewType to `VIEWS`) ·
  `src/types.ts` (`ViewType` union).
- `src/theme/tokens.ts` + `src/index.css` — the only color source (reuse `tone.*`;
  In-Scope vs Out-of-Scope and credit-negative amounts should reuse existing tone tokens).

## Sub-phasing (ship + verify each — one focused session per phase)

### Phase 1 — Change Events own view (the cost-exposure ledger)
- **Scope:** (a) ⛔ a `sitelines_change_events` view — one row per change event: header
  (number, title, status via `initcap`, event_scope, event_type, change reason,
  description, created_at, `originRfi`) + **aggregates from its line items** (`estCost` =
  Σ estimated_cost_amount, `lineItems` = count, `commitments` = count of distinct
  `contract_number`s that match a real commitment). (b) `ChangeEvent` type +
  `mapChangeEvent` + `changeEvents` slice (seed + supabase). (c) `changeEventRollup` +
  `changeEventsSorted` selectors + tests. (d) a `ChangeEventsView` (own view; route
  Change Events to it via `view: 'changeEvents'`): rollup KPI cards (total exposure ·
  open/closed/void · open exposure) + a collapsible **scope** (In/Out/TBD) and **funding
  bucket** breakdown (hand-rolled bars, like Budget's cost-type mix) + an enriched sortable
  register (CE # · Title · Scope · Type · Reason · Est. Cost · Status).
- **Approval gates:** ⛔ Supabase view SQL (present it, STOP for sign-off, then apply) ·
  no re-sync · never touch the Procore app registration · `ballInCourt.ts` untouched.
- **Exit criteria:** typecheck + build + tests green; live `:5173` — real scope/type/reason
  + values; rollup's **open exposure ties to Budget's pending section** (same open
  change-event lines); seed renders; My Court / registers / other views unchanged.

### Phase 2 — detail drawer + cross-links (line items · Commitment · Budget-pending)
- **Scope:** (a) ⛔ a `sitelines_change_event_line_items` view (cost code · name · amount ·
  description · `contract_number` → resolved `commitmentId`). (b) `ChangeEventLineItem`
  type + mapper + `changeEventLineItems` slice (seed + supabase, loaded in the snapshot).
  (c) a `changeEvent: ChangeEvent | null` field on `AppState` + a `ChangeEventDrawer`
  overlay mounted in `App.tsx`'s overlay slot (fixed sibling of the card; add to the Esc
  clear-list), opened from a `ChangeEventsView` row: header (CE # · title · status · scope ·
  type · reason) + description + **line items grouped by cost code with subtotals** (via
  `changeEventLineGroups`), each showing the **commitment it hits** — click → open the
  existing `CommitmentDrawer` (`patch({ changeEvent: null, commitment: theCommitment })`,
  resolving `commitmentId` against the `commitments` slice). (d) the **Budget-pending
  tie-back**: for an OPEN event, a light cross-reference that its estimated cost feeds
  Budget's pending-change section (a labeled note/link is enough — do not re-implement the
  aggregation). (e) RFI-origin: if `originRfi`, opportunistically link to the RFI item.
- **Approval gates:** ⛔ Supabase view SQL. No re-sync. Overlay = `position:fixed` sibling
  of the card (guardrail). `ballInCourt.ts` untouched.
- **Exit criteria:** typecheck + build + tests green; live `:5173` — drawer opens; line
  items + subtotals tie to the event's `estCost`; a line's commitment opens the
  `CommitmentDrawer`; open-event Budget-pending note is present; seed renders. Then STOP.

## Hard guardrails (do not violate)
- **Overlays** (`ChangeEventDrawer`) render `position:fixed` OUTSIDE the card's
  `overflow:hidden` — mount in `App.tsx`'s overlay slot; add `changeEvent: null` to the
  Esc clear-list.
- **`ballInCourt.ts` is untouched.** Change Events stays a court `Item` for My Court /
  search / cross-links; the enriched `ChangeEvent` is additive **reference** data and must
  NOT enter My Court. `TERMINAL`/`COURT_TOOLS`/`isBallInCourt` unchanged.
- **One token source** (`src/theme/tokens.ts` + `src/index.css`); no ad-hoc hex; **no chart
  library** — hand-rolled bars only (reuse Budget's cost-type-mix approach).
- Domain atom stays `Item`; never introduce a type named `Record`.
- Views derived from flat `AppState` + `patch()`; all grouping/formatting/bucketing lives
  in `src/selectors/` (pure, tested); the UI reads via the provider; `supabaseSource` keeps
  `fetchAll` paging. Keep the seed → Supabase swap zero-view-change.
- **Compliance:** read-only Supabase views over the existing `procore_*_master` tables (per
  view, `security_invoker=true`). ⛔ Present all Supabase DDL/view SQL and STOP before
  applying (ref `jxesfirpghwpfmfjlfng`); don't commit/push until the owner says "Approved."

## Open decisions
- **Register default sort** — est-cost desc (recommended: money-first, matches the lens)
  vs. CE # ascending (chronological). Confirm at Phase 1 kickoff; trivial to change.
- **Scope/type buckets: show void?** — recommend the breakdown counts **open + closed**
  exposure and excludes Void (mirrors how Void is treated as terminal/dropped elsewhere).
  Confirm in Phase 1.
- **Budget-pending tie-back depth** (Phase 2) — a static labeled note vs. a live click that
  navigates to Budget's pending section focused on the event's division. Recommend the
  light note for v1; confirm at Phase 2 kickoff.
