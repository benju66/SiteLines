# Kickoff — Budget Insights, Phase 1: cost-code drill-down

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — new data-seam + net-new view design + money-accurate aggregation; correctness matters. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` mid-session (`/model claude-fable-5`) only if genuinely stuck.
>
> Implement **Phase 1 of Budget Insights** (turn Budget into a cost-control view: drill from division into the real cost codes). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-07 - Budget Insights Phase 1 Kickoff.md` (this file)
> - `Notes/plans/Budget-Insights-Plan.md` (Phase 1) + `PLAN.md` + `design_handoff_sitelines/README.md` (§3 Financials, §6) + `design_handoff_sitelines/DATA_CONTRACT.md` (§6)
>
> Build **only Phase 1**. ⛔ **Present the `sitelines_budget_lines` view SQL and STOP for my sign-off before applying it** — never touch the Procore app/sync, no re-sync. Verify with typecheck + build + a logged-in `:5173` click-through. Don't commit or push until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What this phase is
Budget today is a thin snapshot — 6 KPI cards + a 6-row division rollup in round
millions ([FinancialView](../../src/components/views/FinancialView.tsx), shared with
Prime Contract; fed by [`sitelines_financials`](../../sync/views/sitelines_financials.sql)).
Phase 1 gives Budget **its own view** that drills from division into the actual **115
cost codes** with the numbers a PM watches: **Budget · Committed · % Bought Out ·
Uncommitted · Projected Over/Under**. It is the foundation the risk lens (Phase 2) and
the pending-change forecast (Phase 3) build on. Everything is **already synced** — no
pipeline change.

## Design is decided — build to it (don't re-litigate)
Owner-locked 2026-07-07 (full detail in `Notes/plans/Budget-Insights-Plan.md`):
- v1 = A + B + C; **this phase is A** (drill-down). B+C are Phase 2.
- **Own `BudgetView`**; Prime Contract stays on the existing `FinancialView` (don't
  entangle them).
- **Hand-rolled SVG** only (no chart library) — Phase 1 has no chart yet, but hold the line.
- **OP III only** (`3051002`); portfolio/trends are deferred, not this phase.

## Required reading (fresh — don't trust line numbers)
- `Notes/plans/Budget-Insights-Plan.md` → **Phase 1** + Data model + Pure logic + Build-on
  inventory + Guardrails. This phase = that section.
- `design_handoff_sitelines/README.md` **§3 Financials** and **DATA_CONTRACT.md §6** — the
  existing KPI/table design + the `FinancialSource` contract (the KPI cards stay).
- [`sitelines_financials.sql`](../../sync/views/sitelines_financials.sql) — **copy its
  primary-budget-view CTE verbatim** (lowest-id non-`%profit%` view) so the new view
  doesn't double-count. [`mapDrawing.ts`](../../src/lib/mapDrawing.ts) — the view-row →
  contract mapper pattern to mirror for `mapBudgetLine`.
- [`DrawingsView.tsx`](../../src/components/views/DrawingsView.tsx) — the grouped,
  expandable table pattern (division → cost code mirrors discipline → sheet); collapsed
  state in `AppState`. [`compareDrawingNumber`](../../src/selectors/index.ts) — the
  natural sort to reuse/generalize for cost codes.
- Data seam to extend: [dataSource.ts](../../src/lib/dataSource.ts) (add the `budgetLines`
  slice to `SiteData`), [supabaseSource.ts](../../src/data/supabaseSource.ts) (`fetchAll`
  + a `sitelines_budget_lines` read + `mapBudgetLine`), [seedSource.ts](../../src/data/seedSource.ts)
  (small fixture), [DataContext](../../src/state/DataContext.tsx).

## Scope (build to the plan)
1. ⛔ **`sitelines_budget_lines` view** — one row per cost code in the primary budget view;
   emits the `BudgetLine` fields (division=`root_cost_code`, `cost_code`, `category`,
   `Revised Budget`, `Committed Costs`, `Job to Date Costs`, `Estimated Cost at Completion`,
   `Pending COs`, `Projected over Under`) for project `3051002`. `security_invoker=true`.
   **Present the SQL and STOP** for sign-off; then apply.
2. **`BudgetLine` type** (`src/types.ts`, additive — reference data, NOT an `Item`) +
   `budgetLines: BudgetLine[]` on `SiteData`, loaded in `fetch()` (seed fixture +
   `supabaseSource` query + `mapBudgetLine`), surfaced via `DataContext`. Raw dollars.
3. **Pure selectors + tests** — `budgetByDivision(lines)` (group cost codes under
   divisions, subtotal, natural cost-code sort), buyout helpers (`committed/budget`,
   `budget−committed`). Deterministic; co-located `.test.ts`.
4. **`BudgetView`** — route Budget to it (Prime Contract keeps `FinancialView`): the 6 KPI
   cards on top, then an **expandable division → cost-code table** — **Cost Code · Budget ·
   Committed · % Bought Out · Uncommitted · Over/Under** (over/under red when negative),
   division subtotals + grand total. Collapsed-division state in `AppState`.
5. **Do NOT** build the risk radar / cost-type mix (Phase 2) or any pending-change logic
   (Phase 3).

## Guardrails / gates
- ⛔ **Present the view SQL and STOP** before applying (Supabase ref `jxesfirpghwpfmfjlfng`).
  No re-sync; never touch the Procore app registration.
- One-token-source; no ad-hoc hex; **no chart library**. Keep the UI dumb (selectors take
  `SiteData`; never import data modules). Views derived from `AppState` + `patch()`.
- `BudgetLine` is **reference** data — `src/lib/ballInCourt.ts` untouched; budget lines
  must **not** enter My Court.
- Compliance: read-only view over the existing master; no new mirror, no history.
- Don't commit/push until the owner says "Approved."

## Exit criteria (the gate)
- `npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck` and `... run build` green;
  `budgetByDivision` + the natural sort are unit-tested (`npm test`).
- Live, logged-in `:5173`: divisions expand to real cost codes; Budget · Committed ·
  %-bought-out · Uncommitted · Over/Under tie to Procore's numbers; over-budget codes read
  red; the KPI cards are unchanged; **Prime Contract view still works** (untouched).
- Seed mode renders (small fixture; no live call).
- Then STOP and report; do not start Phase 2 (risk radar + cost-type mix).
