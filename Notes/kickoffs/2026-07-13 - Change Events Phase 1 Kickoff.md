# Kickoff — Change Events, Phase 1: the cost-exposure ledger (own view)

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · xhigh** — well-specified plan, a ⛔ SQL gate, and financial
> aggregation that must reconcile to the penny; correctness-critical. (`/model claude-opus-4-8`
> first.) Escalate to `claude-fable-5` mid-session (`/model claude-fable-5`) only if genuinely stuck.
>
> Implement **Phase 1 of Change Events** (turn the bare register into a cost-exposure ledger — an
> own analytics view like Budget/Commitments). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-13 - Change Events Phase 1 Kickoff.md` (this file)
> - `Notes/plans/Change-Events-Plan.md` (the workstream plan-of-record)
> - `PLAN.md` (the Change Events table) + `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase 1**. ⛔ The `sitelines_change_events` view is a Supabase DDL change — present
> the SQL and STOP for my sign-off before applying it; do not touch `src/lib/ballInCourt.ts`. Verify
> with typecheck + build + tests + a `:5173` click-through. Don't commit or push until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What you're building
**Plain-English:** a change event is a *potential* change being tracked and priced before it becomes
a change order. Today "Change Events" is a thin generic list. Phase 1 gives it **its own view** (the
Budget/Commitments pattern) that leads with the money: how much change is in flight, whether it's In
or Out of Scope, and which funding bucket covers it — plus an enriched, sortable register.

This is the third tool in the Budget → Commitments → Change Events family. **Mirror those two exactly**
— the plan's "Build-on inventory" lists the files to clone (don't fork the seam or the token source).

## Required reading (in order, fresh — don't trust line numbers in any doc)
1. `Notes/plans/Change-Events-Plan.md` — the full plan (data model, verified numbers, guardrails).
2. `Notes/plans/Commitments-Plan.md` (Phase 1) — the own-view pattern this clones.
3. `src/components/views/CommitmentsView.tsx` + `src/components/views/BudgetView.tsx` — the KPI-cards +
   sortable register + collapsible hand-rolled-bar breakdown you're mirroring.
4. `src/lib/mapCommitment.ts`, `src/data/supabaseSource.ts`, `src/data/seedSource.ts`,
   `src/lib/dataSource.ts`, `src/state/DataContext.tsx` — the seam (view-row → shape → slice).
5. `sync/views/sitelines_commitments.sql` + `sync/views/sitelines_budget_pending.sql` — the
   `security_invoker=true` view style, and (important) `budget_pending`'s exact OPEN-change-event
   aggregation, which your rollup's **open exposure must tie to**.
6. `src/data/tools.ts`, `src/components/layout/MainContent.tsx`, `src/types.ts` (`ViewType` union).

## Scope — Phase 1 only (three bullets)
- **⛔ `sitelines_change_events` view** — one row per change event from `procore_change_events_master`
  (165 rows, OP III / 3051002): header (`number` → "CE #N", `title`, `initcap(status)`, `event_scope`,
  `event_type` funding bucket, `change_order_change_reason`, `description`, `created_at`, `originRfi` =
  `change_event_origin_type='Rfi::Header'`) **+ aggregates from `procore_change_event_line_items_master`**
  (`estCost` = Σ `estimated_cost_amount` ±, `lineItems` = count, `commitments` = # distinct
  `contract_number`s that match a real commitment). Present the SQL, STOP, apply after sign-off.
- **Seam + selectors:** `ChangeEvent` type (per the plan) + `mapChangeEvent` + `changeEvents` slice
  (supabase + seed); pure tested `changeEventRollup` (counts open/closed/void · total & **open**
  exposure · exposure by scope In/Out/TBD · by funding type) and `changeEventsSorted` (default est-cost
  desc). Co-located `.test.ts`; pass data in, no clock.
- **`ChangeEventsView`** (route `changeEvents` to `view: 'changeEvents'`): rollup KPI cards + a
  collapsible scope & funding-bucket breakdown (hand-rolled bars, like Budget's cost-type mix) + an
  enriched sortable register (CE # · Title · Scope · Type · Reason · Est. Cost · Status). Hand-rolled,
  one token source.

Deferred to **Phase 2** (do NOT build now): the detail drawer, the line-item slice, the
Change-Event→Commitment cross-link, and the Budget-pending tie-back.

## Verified numbers to reconcile against (OP III, live 2026-07-13)
- 165 events: **143 Closed · 6 open · 16 Void**. Total est. exposure ≈ **$409,519**; **open ≈ $19,395**.
- Open exposure **must tie to Budget's pending section** (same 6 open events' lines). If it doesn't,
  the view or the open-filter is wrong — reconcile before calling it done.
- `event_type` is null on many events → bucket those as "—"; 21 line items have no cost code.

## Hard guardrails (this phase)
- ⛔ **Supabase DDL gate** — present the `sitelines_change_events` SQL and STOP; apply only after
  "Approved". Read-only view, `security_invoker=true`. No re-sync. Never touch the Procore app
  registration. (Project ref `jxesfirpghwpfmfjlfng`.)
- **Do NOT touch `src/lib/ballInCourt.ts`.** Change Events stays a court `Item` (My Court / search /
  cross-links keep working via the existing `sitelines_items` feed); the new `ChangeEvent` is additive
  **reference** data and must not enter My Court.
- One token source (`src/theme/tokens.ts` + `src/index.css`); no ad-hoc hex; **no chart library** —
  hand-rolled bars. Domain atom stays `Item` (never a type named `Record`).
- All grouping/bucketing/formatting in `src/selectors/` (pure, tested); the view stays dumb; keep the
  seed → Supabase swap zero-view-change; `supabaseSource` keeps `fetchAll` paging.

## Exit criteria (the gate — run before calling it done)
```
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck   # tsc -b (primary gate)
npm --prefix "C:/Users/BUrness/Dev/Sitelines" test            # vitest — the new selectors
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run build
```
Plus a live `:5173` click-through: real scope/type/reason + values render; the rollup's **open
exposure ties to Budget's pending section**; seed mode renders the same; My Court / registers / other
views unchanged. Then **STOP at the phase boundary — do not start Phase 2, do not commit/push until I
say "Approved."**
