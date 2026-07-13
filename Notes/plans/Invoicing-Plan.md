# Invoicing — enrich the tool into a pay-application register (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + the design handoff (`design_handoff_sitelines/`).
> Siblings done — reuse their patterns verbatim: **Commitments**
> (`Notes/plans/Commitments-Plan.md`) and **Change Events**
> (`Notes/plans/Change-Events-Plan.md`): per-tool Supabase view → mapper → `SiteData`
> slice → own view + drawer. The invoice financials reconcile to Commitments.

## Goal
Turn **Invoicing** from a bare register into a project-wide **pay-application register**
(the billing log): its own view showing every subcontractor pay app across the job with a
rollup (billed to date · retainage held · this period · # under review), an enriched
sortable register (Vendor · Pay App # · Period · This Period · Billed to Date · Retainage ·
% · Status), and a **detail drawer** showing the pay app's AIA **G702 cover sheet**
(original → revised contract, net change by COs, billed, retainage breakdown, balance to
finish) with a cross-link to the **commitment** it bills against.

**Plain-English:** a pay application (requisition) is a subcontractor's monthly invoice. The
Commitments tool shows each sub's contract; Invoicing shows the **invoices themselves** —
what got billed, when, and (crucially) **what's under review and needs approval**.

## Where the data actually lives (verified live 2026-07-13, OP III / 3051002)
**Zero re-sync** — everything is already synced; only new read-only Supabase views.

- **`procore_requisitions_master`** — **200 subcontractor pay apps** across **49 commitments**
  (statuses: **Approved** + **1 Under Review**). Each carries: `invoice_number`, `number`,
  `vendor_name`, `contract_name`, `commitment_id` (→ a `Commitment`), `billing_date`,
  `requisition_start`/`end`, `status`, `final`, `percent_complete`, and a full AIA **G702
  `summary`**: `original_contract_sum`, `contract_sum_to_date` (= revised),
  `net_change_by_change_orders`, `total_completed_and_stored_to_date` (= billed cumulative),
  `current_payment_due` (= this period, **net of retainage**), `total_retainage`,
  `completed_work_retainage_amount`, `stored_materials_retainage_amount`,
  `total_earned_less_retainage`, `balance_to_finish_including_retainage`, `formatted_period`.
  **No per-pay-app line items** are synced (`line_items` absent) — the drawer is the G702
  cover sheet, not an SOV breakdown.
- **`procore_payment_applications_master`** — the **owner-side** pay apps (money IN). Only
  **1 row** synced for OP III → surfaced as a small note/section, not the focus of v1.

**⚠️ The load-bearing aggregation rule (verified):** cumulative G702 fields (billed,
retainage) must NOT be summed across all 200 rows — each row is cumulative-to-that-pay-app.
- Σ `current_payment_due` across all rows = **$14,663,022.51** (net of retainage — NOT the total).
- Σ **latest pay app per commitment** `total_completed_and_stored_to_date` = **$15,285,899.19**
  (= Commitments billed, incl. the 1 Under-Review pay app) ✅
- Σ latest-per-commitment `total_retainage` = **$622,876.68** (= Commitments retainage) ✅
So the view marks `is_latest` (the most recent pay app per commitment, `billing_date` desc,
id-tiebroken) and the rollup sums cumulative fields over `is_latest` rows only.

## Out of scope / deferred
- **Re-sync / new Procore pulls** — none.
- **Per-pay-app SOV line items** — not synced; the drawer shows the G702 cover-sheet totals.
  A future sync change could add the line detail (its own go/no-go).
- **Owner-side billing depth** — only 1 owner pay app is synced; surfaced as a note, not a
  full receivable surface. Revisit if more owner pay apps sync.
- **Writing back to Procore** — never. Read-only.
- **McKenna / multi-project** — OP III only for v1 (only 3051002 synced), like the siblings.

## Locked product decisions (owner, 2026-07-13)
1. **Build Invoicing next** (chosen over Change Orders — the owner/prime COs total only $34K
   and can't trace back to change events without a re-sync; Invoicing is the $15.28M surface).
2. **Sub-side pay apps are the surface** (money out, 200 rows); the single owner pay app is a
   note. Own view like Commitments + a G702 detail drawer.
3. Reuse the Commitments/Change-Events seam + hand-rolled philosophy (no chart lib; one token source).

## Data model (DATA_CONTRACT — keep the UI dumb)
Add to `src/types.ts` (reference data; **never** a court `Item` / My Court). Raw DOLLARS; the
selector layer formats and rolls up. One `sitelines_invoices` view carries BOTH the register
and the drawer's G702 fields, so **Phase 2 needs no new SQL**.
```ts
export interface Invoice {
  project: Project           // 'opiii'
  id: string                 // "invoicing:<requisition id>"
  number: string             // invoice_number || number
  vendor: string             // vendor_name ('' for the owner pay app)
  contract: string           // contract_name
  commitmentId: string | null// "commitments:<commitment_id>" — matches Commitment.id (cross-link)
  period: string             // summary.formatted_period (or start–end)
  billingDate: string | null // preformatted display date
  status: string             // "Approved" | "Under Review"
  final: boolean             // marked the final pay app
  isLatest: boolean          // the most recent pay app for its commitment (drives the rollup's cumulative sums)
  thisPeriod: number         // summary.current_payment_due (net due this period)
  billedToDate: number       // summary.total_completed_and_stored_to_date (cumulative gross)
  retainage: number          // summary.total_retainage (cumulative held)
  pctComplete: number        // 0..1
  // G702 cover sheet (drawer):
  original: number           // summary.original_contract_sum
  revised: number            // summary.contract_sum_to_date
  netChangeByCOs: number     // summary.net_change_by_change_orders
  earnedLessRetainage: number// summary.total_earned_less_retainage
  balanceToFinish: number    // summary.balance_to_finish_including_retainage
}
```
- **Seam:** add `invoices: Invoice[]` to `SiteData`, loaded in `fetch()` (200 rows). Mapper
  `mapInvoice` mirrors `mapCommitment` (guarded `num()`; pct 0–100 → 0..1). No lazy seam.

## Pure logic to extract + unit-test (`src/selectors/` + `.test.ts`)
- `invoiceRollup(invoices)` → count · underReview count · **billedToDate = Σ isLatest.billedToDate**
  · **retainageHeld = Σ isLatest.retainage** · thisPeriod = Σ isLatest.thisPeriod · subs = distinct
  commitments. (The isLatest gate is the correctness crux — test it: summing all rows is wrong.)
- `invoicesSorted(invoices, sort)` → register order; default **billing date desc** (most recent
  invoices first), then by this-period / billed / vendor / status. Under-review sorts surfaceable.

## Build-on inventory (read these fresh before using)
REUSE, do not fork:
- `src/components/views/CommitmentsView.tsx` — the own-view pattern (KPI cards + sortable
  register). Mirror for `InvoicingView`.
- `src/components/overlays/CommitmentDrawer.tsx` — the drawer shell (header, meta grid,
  Backdrop) for the G702 cover-sheet drawer; `src/components/overlays/ChangeEventDrawer.tsx`
  is the simpler recent example (no lazy fetch) — mirror IT.
- `src/lib/mapCommitment.ts` — the row → shape mapper pattern.
- `sync/views/sitelines_commitments.sql` — the `latest_req` DISTINCT-ON-per-commitment CTE is
  exactly the `is_latest` logic; `security_invoker=true` style.
- `src/data/supabaseSource.ts` (`fetchAll` + slice) · `src/data/seedSource.ts` · `src/lib/dataSource.ts`
  (`SiteData`) · `src/state/DataContext.tsx` · `src/state/appState.ts` (add an `invoice` drawer field).
- `src/data/tools.ts` (`invoicing` meta → new `view: 'invoicing'`) · `src/components/layout/MainContent.tsx`
  · `src/types.ts` (`ViewType` union) · `src/App.tsx` (mount the drawer, Esc clear-list).
- `src/theme/tokens.ts` + `src/index.css` — the only color source.

## Sub-phasing (ship + verify each — one focused session per phase)

### Phase 1 — Invoicing own view (the pay-app register)
- **Scope:** (a) ⛔ a `sitelines_invoices` view — one row per requisition with the register
  fields + G702 summary + `is_latest` flag (DISTINCT-ON-per-commitment by billing_date desc,
  id-tiebroken) + `commitment_id` resolved to `commitments:<id>`. (b) `Invoice` type +
  `mapInvoice` + `invoices` slice (seed + supabase). (c) `invoiceRollup` (isLatest-gated) +
  `invoicesSorted` selectors + tests. (d) an `InvoicingView` (route `invoicing` to
  `view: 'invoicing'`): rollup KPIs (Billed to Date · Retainage Held · This Period · # Under
  Review · Pay Apps) + a sortable register (Vendor · Pay App # · Period · This Period · Billed
  to Date · Retainage · % · Status), Under-Review flagged.
- **Approval gates:** ⛔ Supabase view SQL (present, STOP for sign-off, then apply) · no
  re-sync · `ballInCourt.ts` untouched (invoicing stays a court `Item`; `Invoice` is additive
  reference data).
- **Exit criteria:** typecheck + build + tests green; live `:5173` — real vendors/values;
  rollup **billed to date ties to $15,285,899 / retainage $622,877** (= Commitments); seed
  renders; other views unchanged.

### Phase 2 — G702 detail drawer + commitment cross-link (no new SQL)
- **Scope:** a `invoice: Invoice | null` field on `AppState` + an `InvoiceDrawer` overlay
  (fixed sibling of the card; Esc clear-list) opened from a row: the **G702 cover sheet**
  (original → net change by COs → revised; billed; this period; retainage breakdown —
  completed + stored; earned less retainage; balance to finish) + status/period/dates + a
  **click-through to the commitment** it bills (`patch({ invoice: null, commitment })`), and a
  small **owner pay app** note. Reuses the Phase-1 view (no ⛔ SQL).
- **Exit criteria:** typecheck + build + tests; live — drawer opens, G702 totals tie to the
  row, the commitment cross-link opens `CommitmentDrawer`; seed renders. Then STOP.

---

## v2 — deeper billing detail (owner feedback, 2026-07-13)
Phases 1–2 shipped a flat pay-app register + a G702 **cover-sheet** drawer. The owner (a GC
PM) noted it should work more like Procore's Invoicing: **navigate by billing period**, see a
sub's **current + past invoices**, and drill into each invoice's **SOV / G703 — what's getting
billed per line**. Data check (verified live 2026-07-13):
- **14 billing periods** synced (`summary.formatted_period`, Jun 2025 → Jul 2026) → a period
  selector needs **no re-sync**.
- Pay apps **chain** via `previous_requisition_id` (151/200) + `billing_date` → a sub's
  current/past history needs **no re-sync**.
- **Per-line SOV billing (G703) is NOT synced** — `raw->'line_items'` is absent on all 200
  requisitions (`with_line_items = 0`). The line detail lives on Procore's requisition **detail
  (show)** endpoint → getting it is a **⛔ backend sync change** (Phase 4), the same shape as
  Commitments Phase 3. ⚠️ 200 requisitions = 200 per-record GETs (vs. 51 commitments, which hit
  a ~39-min Procore rate-limit cooldown) — so the scope of *which* pay apps to pull line items
  for is a real decision (see Phase 4).

**Locked (owner, 2026-07-13):** pursue the sync change for the per-invoice SOV lines.

### Phase 3 — billing-period navigation + per-sub invoice history (no re-sync)
- **Scope:** (a) a **billing-period selector** on `InvoicingView` — a dropdown of the distinct
  periods (default: the latest period; an "All periods" option) that filters the register; a
  pure `invoicePeriods(invoices)` selector (distinct periods, newest-first) + a period filter in
  `invoicesSorted`/a new `invoicesInPeriod`. (b) a **Billing history** section in the
  `InvoiceDrawer`: the clicked pay app's **sibling pay apps for the same commitment** (the sub's
  chain), current one marked, each showing period · this-period · billed-to-date · status, click
  to switch the drawer to that pay app. Pure `invoiceHistoryFor(invoices, invoice)` (the
  commitment's pay apps, recency-sorted). No new data — all from the `invoices` slice.
- **Approval gates:** none (no SQL, no re-sync). `ballInCourt.ts` untouched.
- **Exit criteria:** typecheck + build + tests; live `:5173` — pick a period → register filters;
  open an invoice → its billing history lists the sub's other pay apps, clicking one switches the
  drawer; seed renders. Then STOP.

### Phase 4 — ⛔ Procore sync change: per-requisition SOV line items (G703)
- **Scope (in-repo `sync/`):** mirror `enrich_commitments_with_detail` →
  `enrich_requisitions_with_detail(token, reqs, li_rows, project_id)`: a per-requisition
  `GET /rest/v1.1/requisitions/{id}?project_id={pid}` (the show endpoint carries the G703
  `line_items[]` — scheduled value, work_completed_from_previous_application, work_completed_this_period,
  materials_presently_stored, percent, retainage, balance_to_finish, cost_code). Flatten each
  line to a new **`procore_requisition_line_items_master`** (`line_item_id, project_id, raw jsonb,
  synced_at` — migration **0012**, mirroring 0009; PK + project index + deny-all RLS +
  `authenticated_read`). The requisition LIST upsert stays unconditional; the new table is gated
  on full-enrichment success (purge safety), like commitments.
- **⚠️ Rate-limit decision (owner, at kickoff):** which pay apps to pull line items for —
  **(Recommended) latest pay app per commitment (~49 GETs)**: covers "what's billed now" per line,
  keeps the run well under the rate ceiling; past invoices keep cover-sheet-only. Alternatives:
  **all 200** (full per-line history, highest rate-limit risk — space them / gate to changed
  requisitions) or **incremental** (only requisitions whose `updated_at` changed since last run).
- **Approval gates:** ⛔ this is a real Procore pull + a new Supabase base table — present the
  migration + the pipeline diff and STOP for owner sign-off; run the sync only on approval; never
  recreate the Procore app registration. Do NOT run it near the nightly job's rate ceiling.
- **Exit criteria:** migration applied; a manual/one-off enrichment run populates
  `procore_requisition_line_items_master`; spot-check that a pay app's line items sum to its G702
  `total_completed_and_stored_to_date` (the G703 → G702 tie). Then STOP.

### Phase 5 — render the G703 SOV in the invoice drawer (no re-sync; needs Phase 4)
- **Scope:** ⛔ a `sitelines_invoice_line_items` view (one row per requisition line: invoice id,
  cost_code, description, scheduled_value, this_period, from_previous, stored, pct, retainage,
  balance) + an `InvoiceLineItem` type + mapper + `invoiceLineItems` slice (loaded in the
  snapshot, like `changeEventLineItems`). The `InvoiceDrawer` gains a **Schedule of values (G703)**
  section: per line, what's billed this period vs. to date vs. scheduled, % complete, retainage —
  grouped by cost code with subtotals reconciling to the G702 cover sheet. Pure
  `invoiceLineGroups(lineItems)` (+ tests), mirroring `changeEventLineGroups`.
- **Approval gates:** ⛔ Supabase view SQL (present, STOP, apply). No re-sync (Phase 4 did it).
- **Exit criteria:** typecheck + build + tests; live — an invoice opens into its G703 SOV; the
  line subtotals tie to the G702 `total_completed_and_stored_to_date`; seed renders. Then STOP.

## Hard guardrails (do not violate)
- **Overlays** (`InvoiceDrawer`) render `position:fixed` OUTSIDE the card's `overflow:hidden`
  (mount in `App.tsx`'s overlay slot; add `invoice: null` to the Esc clear-list).
- **`ballInCourt.ts` untouched** — invoicing stays a court `Item` (My Court / search / links);
  the enriched `Invoice` is additive **reference** data, never in My Court.
- **One token source**; no ad-hoc hex; **no chart library** — hand-rolled.
- Domain atom stays `Item`; never a type named `Record`.
- Views derived from flat `AppState` + `patch()`; all rollup/format/aggregation in
  `src/selectors/` (pure, tested); keep the seed → Supabase swap zero-view-change.
- **Compliance:** read-only Supabase views over existing `procore_*_master` tables
  (`security_invoker=true`). ⛔ Present all Supabase DDL/view SQL and STOP before applying (ref
  `jxesfirpghwpfmfjlfng`); don't commit/push until the owner says "Approved."

## Open decisions
- **Register default sort** — billing date desc (recommended: newest invoices first) vs.
  under-review-first (action-first). Confirm at Phase 1 kickoff; trivial to change.
- **Owner pay app placement** (Phase 2) — a note vs. a small separate section. Recommend a note
  for v1 (only 1 row).
