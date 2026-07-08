# Kickoff — Commitments, Phase 1: own view (financial register + rollup + contract company)

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — new data-seam + net-new view design + money-accurate aggregation (must reconcile to Budget); correctness matters. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` mid-session (`/model claude-fable-5`) only if genuinely stuck.
>
> Implement **Phase 1 of Commitments** (turn the bare register into an own view like Budget: rollup + contract company + revised/billed/retainage/% complete). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-08 - Commitments Phase 1 Kickoff.md` (this file)
> - `Notes/plans/Commitments-Plan.md` (Phase 1 + data model + build-on inventory) + `PLAN.md` + `design_handoff_sitelines/README.md` (§3 Financials, §2 register) + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase 1**. ⛔ **Present the `sitelines_commitments` view SQL and STOP for my sign-off before applying it** — no re-sync, never touch the Procore app. Verify with typecheck + build + tests + a logged-in `:5173` click-through. Don't commit or push until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What this phase is
Commitments today is a bare register — number + title + status, with **no contract
company and no value** (`sitelines_items` even notes "commitments have no amount on the
list endpoint"). Phase 1 gives Commitments **its own view** (like `BudgetView`): a rollup
(committed/revised · billed · retainage · % complete) on top, then an enriched, sortable
register — **Contract Company · Type · Revised · Billed · Retainage · % Complete · Status**.
The financials come from each commitment's **latest requisition G702 summary** (see the
plan's "Where the data actually lives"). Everything is **already synced** — no pipeline
change. The detail drawer is Phase 2; the Budget↔Commitment cross-link is Phase 3–4.

## Design is decided — build to it (don't re-litigate)
Owner-locked 2026-07-08 (full detail in `Notes/plans/Commitments-Plan.md`):
- **Own view (like Budget) for the financial side + contract company** (this phase);
  a **detail drawer** for the descriptive side is Phase 2.
- **Hand-rolled** only (no chart/table library) — same philosophy as Budget.
- **OP III only** (`3051002`).

## Required reading (fresh — don't trust line numbers)
- `Notes/plans/Commitments-Plan.md` → **Phase 1** + Data model + "Where the data actually
  lives" + Build-on inventory + Guardrails. This phase = that section.
- [`BudgetView.tsx`](../../src/components/views/BudgetView.tsx) + [`sitelines_budget_lines.sql`](../../sync/views/sitelines_budget_lines.sql)
  + [`mapBudgetLine.ts`](../../src/lib/mapBudgetLine.ts) — the own-view + view + mapper
  pattern to mirror (rollup KPIs, sortable register, `security_invoker` view, guarded `num()`).
- [`sitelines_items.sql`](../../sync/views/sitelines_items.sql) — how commitments currently
  surface (header-only; vendor is `{id}` with no name — **join `procore_vendors_master`**).
- Data seam to extend: [dataSource.ts](../../src/lib/dataSource.ts) (`commitments` slice on
  `SiteData`), [supabaseSource.ts](../../src/data/supabaseSource.ts) (`fetchAll` +
  `sitelines_commitments` read + `mapCommitment`), [seedSource.ts](../../src/data/seedSource.ts)
  (small fixture), [DataContext](../../src/state/DataContext.tsx), [tools.ts](../../src/data/tools.ts)
  + [MainContent.tsx](../../src/components/layout/MainContent.tsx) (add a `commitments` ViewType, like `budget`).

## Scope (build to the plan)
1. ⛔ **`sitelines_commitments` view** — one row per real commitment (exclude `_`-prefixed
   templates) for project `3051002`: header (number, title, vendor via vendors join, type
   from the number prefix, status, executed, description, delivery_date, private) +
   financials from the **latest requisition per `commitment_id`** (`original`, `revised` =
   `contract_sum_to_date`, `billed` = `total_completed_and_stored_to_date`, `retainage`,
   `pct_complete`) + CO summary (`co_count`, `co_total` from `procore_commitment_change_orders_master`).
   `security_invoker=true`. **Present the SQL and STOP** for sign-off; then apply.
2. **`Commitment` type** (`src/types.ts`, additive — reference data, NOT an `Item`) +
   `commitments: Commitment[]` on `SiteData`, loaded in `fetch()` (seed fixture +
   `supabaseSource` query + `mapCommitment`), surfaced via `DataContext`. Raw dollars.
3. **Pure selectors + tests** — `commitmentRollup(commitments)` (totals for the KPIs) +
   `commitmentsSorted(commitments, sort)` (register order; default revised desc). Deterministic; co-located `.test.ts`.
4. **`CommitmentsView`** — route Commitments to it (add a `commitments` ViewType): rollup KPI
   cards (Revised · Billed · Retainage · % Complete, + count) on top, then a sortable register
   — **Contract Company · Type · Revised · Billed · Retainage · % Complete · Status**.
   Rows with no requisition show "—" for financials. (No detail drawer this phase.)
5. **Do NOT** build the detail drawer (Phase 2), the FP-Analytics sync change (Phase 3), or
   the Budget↔Commitment cross-link (Phase 4).

## Guardrails / gates
- ⛔ **Present the view SQL and STOP** before applying (Supabase ref `jxesfirpghwpfmfjlfng`).
  No re-sync; never touch the Procore app registration.
- One-token-source; no ad-hoc hex; **no chart/table library**. Keep the UI dumb (selectors
  take `SiteData`; never import data modules). Views derived from `AppState` + `patch()`.
- `Commitment` is **reference** data — `src/lib/ballInCourt.ts` untouched; commitments must
  **not** enter My Court.
- Compliance: read-only view over the existing masters; no new mirror, no history.
- Don't commit/push until the owner says "Approved."

## Exit criteria (the gate)
- `npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck` and `... run build` green;
  `commitmentRollup` + the sort are unit-tested (`npm test`).
- Live, logged-in `:5173`: the register shows real **contract companies** and **values**;
  rollup ties to Procore — **billed total = $15,283,425** (= Budget's Invoiced-to-Date);
  revised ≈ $16.6M; retainage ≈ $623k; sorting works; other views unchanged.
- Seed mode renders (small fixture; no live call).
- Then STOP and report; do not start Phase 2 (detail drawer).
