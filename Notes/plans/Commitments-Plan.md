# Commitments — enrich the tool into a subcontract cost surface (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + the design handoff (`design_handoff_sitelines/`).
> Sibling done: the **Budget Insights** workstream (`Notes/plans/Budget-Insights-Plan.md`)
> — reuse its data-seam pattern (per-tool Supabase view → mapper → `SiteData` slice →
> own view) and its hand-rolled, dependency-free philosophy. The commitment financials
> reconcile to Budget (total billed = Budget's "Invoiced to Date").

## Goal
Turn **Commitments** from a bare register (number + title + status; **no vendor, no
value** today) into a real **subcontract cost surface**: its own view (like Budget)
showing a rollup (committed · billed · retainage · % complete) and an enriched register
(contract company, type, revised value, billed, retainage, % complete, status), **plus a
detail drawer** for the descriptive side of each commitment (description, contract
summary, SOV inclusions/exclusions, dates, privacy, additional info) and its change-order
log + billing history. Then wire the **Budget ↔ Commitment cross-link** so a Budget cost
code drills to the subcontract(s) behind it.

## Where the data actually lives (verified 2026-07-08, OP III / 3051002)
The commitments master is **header-only** — the money is elsewhere:
- **`procore_commitments_master`** (~53; 2 are `_`-prefixed templates → exclude): `number`,
  `title`, `vendor` (an `{id}` — **name needs a `procore_vendors_master` join**),
  `status` (Draft/Approved), `executed`, `description`, `delivery_date`, `private`.
  **No contract value / SOV / billed / retainage.**
- **`procore_requisitions_master`** (199 subcontractor pay apps; link `commitment_id`):
  the **latest requisition per commitment** carries a full **AIA G702 `summary`** object —
  `original_contract_sum`, `net_change_by_change_orders`, `contract_sum_to_date` (= revised),
  `total_completed_and_stored_to_date` (= billed), `total_retainage`, `balance_to_finish…`
  — plus `percent_complete`. **This is the commitment's financials.** Coverage: **49 of 51**
  real commitments have a requisition (2 new ones have no value yet → show "—").
- **`procore_commitment_change_orders_master`** (~100; link `contract_id` = commitment id):
  `grand_total`, `status`, `executed`, `title`, `number` — the **CO log**.
- **`procore_vendors_master`** (~75): `name` — the contract company.

Verified rollup: original $16,147,644 → revised $16,608,012 → billed **$15,283,425**
(= Budget's Invoiced-to-Date, exact) → retainage $622,877.

**Not synced (the constraint):** commitment **SOV line items with cost codes**, and the
commitment **detail fields** (contract summary, SOV inclusions/exclusions, additional
information). Both need a **sync change in the sibling `FP-Analytics` repo** (Phase 3).

## Out of scope / deferred
- **Budget ↔ Commitment cost-code cross-link** — needs SOV line items (cost code →
  commitment) synced. Owner chose to **pursue the sync change** → Phase 3 (⛔ FP-Analytics)
  then Phase 4 (app). Not in v1 (Phases 1–2).
- **Richer drawer fields** (contract summary, SOV inclusions/exclusions, additional info) —
  not in the synced master; ride along on the Phase 3 sync change.
- **Writing back to Procore** — never. All read-only.
- **Prime contract / owner billings** (payment applications, prime COs) — a different tool
  (Prime Contract / Invoicing), not this workstream.

## Locked product decisions (owner, 2026-07-08)
1. **Own view (like Budget) for the financial side + contract company**, **and a detail
   drawer** for the descriptive side (description, contract summary, SOV inclusions/
   exclusions, contract dates, privacy, additional info).
2. **Pursue the FP-Analytics sync change** to unlock the Budget↔Commitment cross-link
   (and the richer drawer fields).
3. Reuse Budget's seam + hand-rolled philosophy (no chart lib; one token source).
4. **OP III only** for v1 (only 3051002 is synced), consistent with Budget.

## Data model (DATA_CONTRACT — keep the UI dumb)
Add to `src/types.ts` (reference data, like `Drawing`/`BudgetLine`; **never** enters My
Court / `ballInCourt`). Raw **dollars**; the selector layer formats and derives (%/rollup):
```ts
export interface Commitment {
  project: Project          // 'opiii' for v1
  id: string                // "commitments:<procore id>"
  number: string            // "PO-25-117-061" / "SC-…"
  title: string
  vendor: string            // contract company (vendors_master.name; '' when unknown)
  type: 'PO' | 'SC' | 'Other' // from the number prefix (or a type field)
  status: string            // "Draft" | "Approved" | …
  executed: boolean
  original: number          // original_contract_sum (0 when no requisition yet)
  revised: number           // contract_sum_to_date (original + executed COs)
  billed: number            // total_completed_and_stored_to_date
  retainage: number         // total_retainage
  pctComplete: number       // 0..1 (billed / revised, or the requisition's percent_complete)
  coCount: number           // # commitment change orders
  coTotal: number           // Σ commitment CO grand_total (executed)
  // descriptive (for the drawer; available now): description, deliveryDate, private
  description: string
  deliveryDate: string | null
  private: boolean
}
```
- **Seam:** add `commitments: Commitment[]` to `SiteData`, loaded in `fetch()` (51 rows).
  Mapper `mapCommitment` mirrors `mapBudgetLine`. The CO log + billing history are
  per-commitment lists → a **lazy `getCommitmentDetail(id)`** seam (Phase 2), like
  `getDrawingRevisions`, so the snapshot stays light.

## Pure logic to extract + unit-test (`src/selectors/` + `.test.ts`)
Deterministic; pass data in, no clock:
- `commitmentRollup(commitments)` → totals (original, revised, billed, retainage,
  overall % complete) for the KPI cards.
- `commitmentsSorted(commitments, sort)` → the register order (by value / % complete /
  vendor / status); default by revised desc. Reuse the Budget sort pattern.
- buyout/complete helpers as needed (billed/revised, retainage %).

## Build-on inventory (read these fresh before using)
REUSE, do not fork:
- `Notes/plans/Budget-Insights-Plan.md` + `src/components/views/BudgetView.tsx` — the own-view
  pattern (collapsible KPIs, resizable/sortable register, hand-rolled). Mirror for Commitments.
- `src/lib/mapBudgetLine.ts` — the view-row → contract-shape mapper pattern (guarded `num()`).
- `sync/views/sitelines_budget_lines.sql` — the `security_invoker` view + primary-view CTE style.
- `src/data/supabaseSource.ts` `fetchAll` + slice; `src/data/seedSource.ts` fixture;
  `src/state/DataContext.tsx`; `src/lib/dataSource.ts` (`SiteData` + the lazy `getDetail`/
  `getDrawingRevisions` seam pattern for `getCommitmentDetail`).
- `src/components/overlays/RecordDetailDrawer.tsx` — the drawer shell (backdrop, 452px,
  meta grid, sections) to reuse/extend for the commitment detail drawer.
- `src/data/tools.ts` (`commitments` meta), `src/components/layout/MainContent.tsx`
  (view routing — add a `commitments` ViewType like `budget`).
- `src/theme/tokens.ts` + `src/index.css` — the only color source.

## Sub-phasing (ship + verify each)

### Phase 1 — Commitments own view (financial register + rollup + contract company)
- **Scope:** (a) ⛔ a `sitelines_commitments` view — one row per real commitment:
  header (number, title, vendor via vendors join, type, status, executed, description,
  delivery_date, private) + financials from the **latest requisition's G702 summary**
  (original, revised, billed, retainage, pct_complete) + CO summary (co_count, co_total).
  (b) `Commitment` type + `mapCommitment` + `commitments` slice (seed + supabase). (c)
  `commitmentRollup` + `commitmentsSorted` selectors + tests. (d) a `CommitmentsView`
  (own view; route Commitments to it): rollup KPI cards + an enriched, sortable register
  (Contract Company · Type · Revised · Billed · Retainage · % Complete · Status).
- **Approval gates:** ⛔ Supabase view SQL (present, STOP for sign-off, then apply) ·
  no re-sync · never touch the Procore app registration.
- **Exit criteria:** typecheck + build + tests green; live `:5173` — real vendors + values;
  rollup ties to Procore (billed $15,283,425 = Budget's Invoiced-to-Date); seed renders;
  other views unchanged.

### Phase 2 — Commitment detail drawer (available fields + CO log + billing history)
- **Scope:** a detail drawer opened from a `CommitmentsView` row: Description · Contract
  Dates · Privacy (from the slice) + the **CO log** (`commitment_change_orders`) + **billing
  history** (`requisitions` for the commitment), via a lazy `getCommitmentDetail(id)` seam.
  Reuse/extend `RecordDetailDrawer` (or a commitment-specific drawer mounted in `App.tsx`'s
  overlay slot). Contract Summary / SOV inclusions-exclusions / additional info are **stubbed
  "from Procore" until Phase 3** (not synced yet).
- **Approval gates:** none new (read-only, existing data). Overlay = `position:fixed` sibling
  of the card (guardrail).
- **Exit criteria:** typecheck + build + tests; live — drawer opens, CO log + billing tie to
  Procore; seed renders.

### Phase 3 — ⛔ FP-Analytics sync change: commitment SOV line items + detail fields
- **Scope (SIBLING REPO `C:/Users/BUrness/Dev/FP-Analytics`, not Sitelines):** extend the
  Procore→Supabase sync to pull the **commitment detail endpoint** — SOV line items (cost
  code + amount) into a new `procore_commitment_line_items_master`, plus the commitment
  detail fields (contract summary, SOV inclusions/exclusions, additional info). Owner-run.
- **Approval gates:** ⛔ owner runs the sync change + a re-sync; touches Procore app scopes.
  This Sitelines plan only **depends on** it; the FP-Analytics work is its own effort.
- **Exit criteria:** the new table/fields populated for OP III; verified read-only.

### Phase 4 — Budget↔Commitment cross-link + richer drawer (after Phase 3)
- **Scope:** ⛔ a `sitelines_commitment_line_items` view (cost code → commitment). Budget
  cost codes drill to the subcontract(s) behind them; Commitments ↔ Budget cross-links;
  fill in the drawer's contract-summary / inclusions-exclusions / additional-info fields.
- **Approval gates:** ⛔ Supabase view SQL. No re-sync (Phase 3 did it).
- **Exit criteria:** typecheck + build + tests; live — a Budget cost code opens its
  commitment(s); seed renders. Then STOP.

## Hard guardrails (do not violate)
- Overlays (the detail drawer) render `position:fixed` OUTSIDE the card's `overflow:hidden`
  (mount in `App.tsx`'s overlay slot).
- **One token source** (`src/theme/tokens.ts` + `src/index.css`); no ad-hoc hex; **no chart
  library** — hand-rolled only.
- Domain atom stays `Item`; `Commitment` is additive **reference** data — the ball-in-court
  rule (`src/lib/ballInCourt.ts`) is **untouched**; commitments must NOT enter My Court.
- Views derived from flat `AppState` + `patch()`; grouping/formatting live in `src/selectors/`
  (pure, tested); the UI reads via the provider; `supabaseSource` keeps `fetchAll` paging.
  Keep the seed → Supabase swap zero-view-change.
- **Compliance:** read-only Supabase views over the existing `procore_*_master` tables (per
  view, `security_invoker=true`). ⛔ Present all Supabase DDL/view SQL and STOP before
  applying (ref `jxesfirpghwpfmfjlfng`); don't commit/push until the owner says "Approved."

## Open decisions
- **Drawer host** — extend the shared `RecordDetailDrawer` (adds a commitment branch) vs. a
  dedicated `CommitmentDrawer` overlay. Recommend a dedicated overlay (commitment detail is
  financial/SOV, not the request/response shape `RecordDetailDrawer` is built around);
  confirm at Phase 2 kickoff.
- **`type` derivation** — PO/SC from the `number` prefix vs. a Procore field; confirm in Phase 1.
