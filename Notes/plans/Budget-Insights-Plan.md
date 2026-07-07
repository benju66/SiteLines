# Budget Insights — cost-control analytics on the synced Procore budget (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + the design handoff (`design_handoff_sitelines/`).
> Sibling done: the Drawings workstream (log → viewer → edge fn) — reuses its
> data-seam patterns (per-tool Supabase view → mapper → `SiteData` slice → dumb view)
> and its "self-authored, no heavy lib" philosophy for any visualization.

## Goal
Turn **Budget** from a thin snapshot (6 KPI cards + a 6-row division rollup in round
millions) into a real **cost-control surface**: drill from division into the actual
**115 cost codes** with the numbers a PM watches (Revised Budget · Committed · % bought
out · Uncommitted · Projected Over/Under), a **risk lens** that ranks where the job is
bleeding over budget, and a **cost-type mix** (Labor / Material / Subcontract). The
value isn't data Procore lacks — it's insight Procore buries in a dense grid or splits
across tools; this puts the cost-control picture on one page.

## Out of scope / deferred
- **Pending-change exposure (cross-tool forecast)** — combine budget's Pending COs /
  Pending Cost Changes with change events + CO tables to project budget erosion before
  approval. **Phase 3** (own seam; more join work). The "single-pane" win, deliberately
  after the foundation lands.
- **Actuals & billing** — `procore_direct_costs_master` (879) + `requisitions` (199 pay
  apps) vs. budget (% billed, cash). **Phase 4 (deferred).**
- **Trends over time** — burn rate / budget movement. Requires the sync to start
  **retaining history** (append-only budget snapshots) which it does not today
  (upsert+purge keeps only current state), plus a compliance judgment on retention.
  **Phase 5 (deferred) — its own plan.**
- **Portfolio (cross-project)** — McKenna + OP III. **Blocked**: only OP III (`3051002`)
  is synced for budget/change data; McKenna must be added to the Procore sync (App
  Management permission + `ACTIVE_PROJECT_IDS`) first. Not a UI phase.
- **Writing anything back to Procore** — never. All read-only.

## Locked product decisions (from the owner, 2026-07-07)
1. **v1 = A + B + C**: cost-code **drill-down (A)** + **risk radar (B)** + **cost-type
   mix (C)**. Delivered across build **Phase 1 (A)** and **Phase 2 (B+C)** for
   session-sizing; together they are "v1."
2. **Hand-rolled lightweight SVG** for any chart/bar — **no chart library** (stay
   dependency-free and on-brand; same philosophy as the drawing viewer's self-authored
   zoom/pan). One token source only.
3. **OP III only** for v1; portfolio (McKenna) waits on the sync.
4. **Trends/time-series deferred** (needs snapshot capture + a compliance call).
5. **Recommended (confirm at Phase 1 kickoff):** Budget gets its **own richer view**
   (`BudgetView`); **Prime Contract stays on the existing `FinancialView`** — don't
   entangle the two, since Budget is diverging and Prime Contract is not.

## Data model (DATA_CONTRACT — keep the UI dumb)
Add to `src/types.ts` (the `Item` atom stays untouched; budget lines are **reference**
data — like `Drawing`, they must **never** enter My Court / `ballInCourt`):
```ts
export interface BudgetLine {
  project: Project        // 'opiii' for v1 (only OP III is synced)
  division: string        // root_cost_code, e.g. "9 - Division 09 - Finishes"
  costCode: string        // "9-92116.000 - Gypsum Board Assemblies"
  costType: string        // category: "Labor" | "Material" | "Subcontract"
  budget: number          // "Revised Budget" (raw dollars)
  committed: number       // "Committed Costs"
  jtdCosts: number | null // "Job to Date Costs" (often null in the budget view)
  eac: number             // "Estimated Cost at Completion"
  pendingCos: number      // "Pending COs" (feeds Phase 3)
  projectedOverUnder: number // "Projected over Under" (negative = over budget)
}
```
- Raw **dollars** in the shape; the selector layer formats to `$` / `$M` and computes
  `%`/derived values (never store derived — DATA_CONTRACT §6).
- **Source (verified live):** `procore_budget_detail_rows_master` — 248 rows, project
  `3051002` only; 23 divisions, 115 cost codes; `category` ∈ {Labor, Material,
  Subcontract}. Rich calc columns are populated: `Revised Budget`, `Committed Costs`,
  `Estimated Cost at Completion`, `Pending COs`, `Projected Costs`, `Projected over
  Under` (`Job to Date Costs` is often null — actuals live separately in
  `procore_direct_costs_master`). Use the **primary cost budget view** exactly as
  `sitelines_financials.sql` does (the lowest-id non-`%profit%` view) so numbers aren't
  double-counted.
- **Seam:** add `budgetLines: BudgetLine[]` to `SiteData`, loaded in `fetch()` (248 rows
  → fine in the snapshot; seed provides a small fixture). Mapper `mapBudgetLine` mirrors
  `mapDrawing`. Note for later: revisit to a lazy `getBudgetLines(project)` if it grows
  with McKenna.

## Pure logic to extract + unit-test (`src/selectors/` or `src/lib/`, + `.test.ts`)
Deterministic; pass data in, no clock:
- `budgetByDivision(lines)` → division groups (subtotaled) each holding its cost codes,
  sorted by a **natural cost-code sort** (reuse/generalize `compareDrawingNumber` so
  `3-34100` follows `3-33000`).
- buyout helpers: `committed/budget` (% bought out), `budget − committed` (uncommitted).
- **Phase 2** `overBudget(lines)` → cost codes/divisions with `projectedOverUnder < 0`,
  ranked by magnitude, with a total exposure figure.
- **Phase 2** `costTypeMix(lines)` → budget & committed summed per `costType`.

## Build-on inventory (read these fresh before using)
REUSE, do not fork:
- [`sitelines_financials.sql`](../../sync/views/sitelines_financials.sql) — copy the
  **primary-budget-view CTE** verbatim for the new cost-code view.
- [`mapDrawing.ts`](../../src/lib/mapDrawing.ts) — the view-row → contract-shape mapper
  pattern (guarded numeric/text coercion); mirror for `mapBudgetLine`.
- [`FinancialView.tsx`](../../src/components/views/FinancialView.tsx) +
  [`financialView`](../../src/selectors/index.ts) — the KPI-card + total-row **styling
  vocabulary**; Budget diverges into its own component but should look of-a-piece.
- [`DrawingsView.tsx`](../../src/components/views/DrawingsView.tsx) — the **grouped,
  collapsible/expandable table** pattern (division → cost code mirrors discipline →
  sheet). Don't force this into the fixed-grid `ListTable`.
- [`supabaseSource.ts`](../../src/data/supabaseSource.ts) `fetchAll` + slice pattern;
  [`seedSource.ts`](../../src/data/seedSource.ts) fixture; [`DataContext`](../../src/state/DataContext.tsx).
- [`compareDrawingNumber`](../../src/selectors/index.ts) — natural sort to reuse/generalize.
- `src/theme/tokens.ts` + `src/index.css` — the only color source.

## Sub-phasing (ship + verify each)

### Phase 1 — Cost-code drill-down (A)
- **Scope:** (a) ⛔ **present + apply** a `sitelines_budget_lines` view (one row per cost
  code in the primary budget view — the `BudgetLine` fields; project `3051002`). No
  re-sync. (b) `BudgetLine` type + `budgetLines` slice on the DataSource (seed fixture +
  `supabaseSource` query + `mapBudgetLine`) surfaced via `DataContext`. (c) pure
  `budgetByDivision` + buyout helpers + natural cost-code sort, with tests. (d) a
  `BudgetView` (Budget stops sharing `FinancialView`; Prime Contract keeps it): the 6 KPI
  cards on top, then an **expandable division → cost-code table** — columns **Cost Code ·
  Budget · Committed · % Bought Out · Uncommitted · Over/Under** (over/under colored when
  negative), division subtotals, a grand total.
- **Approval gates:** ⛔ Supabase view SQL (present, STOP for sign-off, then apply) ·
  never touch the Procore app registration · no re-sync.
- **Exit criteria:** typecheck + build green; `budgetByDivision`/sort unit-tested; live
  `:5173` click-through (logged in) — divisions expand to real cost codes, numbers tie to
  Procore, over-budget codes read red; seed mode renders; Prime Contract view unchanged.

### Phase 2 — Risk radar + cost-type mix (B + C)
- **Scope:** on Phase 1's `budgetLines` (no new seam): (a) a **Budget Risk** section —
  cost codes/divisions with `projectedOverUnder < 0` ranked by exposure, a total-exposure
  figure, and buyout gaps (largest uncommitted). (b) a **cost-type mix** (Labor / Material
  / Subcontract) as hand-rolled SVG bars (budget vs. committed). Pure `overBudget` +
  `costTypeMix` selectors + tests; UI sections on `BudgetView`.
- **Approval gates:** none new (read-only, existing data).
- **Exit criteria:** typecheck + build + tests green; live — the risk list matches the
  drill-down's red rows, exposure total is correct, mix bars render; seed renders.

### Phase 3 — Pending-change exposure (D)  ⛔ cross-tool seam
- **Scope:** ⛔ a view joining budget `Pending COs`/`Pending Cost Changes` with
  `procore_change_events_master` (+ line items) / CO tables → **projected budget after
  pending changes land** vs. today's revised budget, per division. New seam + a
  "forecast" section/toggle on `BudgetView`. The single-pane insight Procore silos.
- **Approval gates:** ⛔ Supabase view SQL. No re-sync.
- **Exit criteria:** typecheck + build + tests; live — pending exposure ties to the
  change-events register; seed renders. Then STOP.

### Deferred (own go/no-go later)
- **Phase 4 — Actuals & billing (E):** direct costs + requisitions vs. budget.
- **Phase 5 — Trends over time (F):** needs append-only budget-snapshot capture in the
  sync + a retention/compliance decision — its own plan, don't start from here.
- **Portfolio (G):** unblocks only once McKenna is permitted on the Procore sync.

## Hard guardrails (do not violate)
- Overlays (if any) render `position:fixed` OUTSIDE the card's `overflow:hidden`.
- **One token source** (`src/theme/tokens.ts` + `src/index.css`); no ad-hoc hex; **no
  chart library** — hand-rolled SVG only.
- Domain atom stays `Item`; `BudgetLine` is additive **reference** data — the
  ball-in-court rule (`src/lib/ballInCourt.ts`) is **untouched**; budget lines must NOT
  enter My Court.
- Views derived from flat `AppState` + `patch()`; grouping/formatting live in
  `src/selectors/` (pure, tested); the UI reads via the provider; `supabaseSource` keeps
  `fetchAll` paging. Keep the seed → Supabase swap zero-view-change.
- **Compliance:** read-only Supabase views over the existing `procore_*_master` tables —
  no re-sync, no new mirror, no history retained (that's the deferred Phase 5's explicit
  decision). Per-view, authenticated (`security_invoker=true` over deny-all RLS).
- ⛔ Present all Supabase DDL/view SQL and STOP before applying (ref `jxesfirpghwpfmfjlfng`);
  don't commit/push until the owner says "Approved."

## Open decisions
- **Own `BudgetView` vs. extend `FinancialView`** — recommend own view (above); confirm
  at Phase 1 kickoff.
- **Snapshot slice vs. lazy fetch** for `budgetLines` — recommend snapshot for v1 (248
  rows); revisit with McKenna.
- **KPI enrichment** — keep the existing 6 Budget KPIs, or add EAC / Projected-at-
  Completion tiles in Phase 1? Recommend keep as-is in Phase 1; revisit in Phase 2.
