# Kickoff — Punch List, Phase 1: the closeout dashboard view

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — well-specified view build with correctness-critical rollup/grouping logic. Escalate to `claude-fable-5` mid-session (`/model claude-fable-5`) only if genuinely stuck.
>
> Implement **Phase 1 of Punch List** (a closeout-dashboard view on already-synced punch data — no re-sync). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-20 - Punch List Phase 1 Kickoff.md` (this file)
> - `Notes/plans/Punch-List-Plan.md` (the self-contained plan) + `PLAN.md` (the Punch List workstream row) + `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase 1**. ⛔ **Present the `sitelines_punch` view SQL and STOP for my approval before applying it to Supabase.** Leave `sitelines_items.sql`'s `punch:` UNION and `src/lib/ballInCourt.ts` UNTOUCHED. Verify with typecheck + test + build + a seed `:5174` and live `:5175` click-through. Don't commit until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What this phase is
Turn **Punch List** from the flat `ToolRegisterView` into its own **closeout dashboard**
(`PunchView`) — the same pattern as Change Events / Invoicing — on data already synced in
`procore_punch_items_master` (1,097 items, OP III). **No re-sync**; only a new read-only
Supabase view + app code.

Punch is a court tool that already feeds My Court via the `sitelines_items` `punch:` UNION.
This adds a **second, richer lens** over the same master — it does NOT change the court path.

## Required reading (in this order)
1. `Notes/plans/Punch-List-Plan.md` — the full plan: data findings, the `PunchItem` shape,
   the build-on inventory, the pure logic to extract, exit criteria. **Authoritative.**
2. `PLAN.md` — the Punch List workstream row (context + status).
3. `design_handoff_sitelines/README.md` §2 (tool register) + the token/interaction sections;
   `design_handoff_sitelines/DATA_CONTRACT.md` (the `Item` seam + ball-in-court rule).
4. **Re-read the real sibling files fresh** before cloning (don't trust line numbers):
   `src/components/views/ChangeEventsView.tsx` or `InvoicingView.tsx`, the
   `changeEventRollup`/`invoiceRollup` selectors in `src/selectors/index.ts`,
   `src/lib/mapChangeEvent.ts`/`mapInvoice.ts`, `sync/views/sitelines_change_events.sql`,
   and how a register row opens `RecordDetailDrawer`.

## Scope (build ONLY this)
- **View:** `sync/views/sitelines_punch.sql` (`security_invoker=true`, `WHERE project_id=3051002`)
  — emits id (`punch:<id>`), number (`#<position>`), name, assignee (`ball_in_court` →
  `assignees[0].name` → ""), status, workflow_status, due_date, has_photos (`has_attachments`),
  has_open_response (`has_unresolved_responses`), manager (`punch_item_manager.name`).
  ⛔ **Present this SQL and STOP** before applying.
- **Seam:** `PunchItem` in `src/types.ts` + `mapPunchItem` (+ `PunchRow`) in `src/lib/` +
  a `punch: PunchItem[]` slice on `SiteData` wired through `seedSource` (a `PUNCH` fixture)
  and `supabaseSource` (`fetchAll<PunchRow>('sitelines_punch')` — **must page past 1000; punch
  has 1,097 rows**).
- **Pure selectors (+ tests):** `punchRollup` (total · open · overdue · ready-for-review ·
  closed · % complete) and `groupPunchBy(items, 'stage' | 'assignee')`. No clock inside.
- **View surface:** `PunchView` — rollup KPI cards + a **Stage / Assignee** group toggle +
  a sortable register (# · name · assignee · due · status pill · 📎 photo + ● open-response
  indicators). Rows open the existing `RecordDetailDrawer` (reuse the court `Item` for that
  punch id from `itemsByTool.punch`). Register defaults to the actionable (open/overdue) with
  a show-closed affordance; the rollup counts ALL for % complete.
- **Wiring:** `TOOLS.punch.view` `'list'` → `'punch'`; add `'punch'` to `ViewType`; register
  `PunchView` in `MainContent`. A `collapsed*`/toggle state on `AppState` if needed (mirror
  the sibling views' pattern; keep view-models in selectors).

## Hard guardrails / ⛔ gates
- ⛔ **Present the `sitelines_punch` view DDL and STOP** for approval before applying to Supabase.
- **Do NOT touch** `sync/views/sitelines_items.sql` (the `punch:` UNION) or `src/lib/ballInCourt.ts`.
  The rollup uses the punch **lifecycle** (`workflow_status`) — a DIFFERENT question from My
  Court inclusion. Never duplicate `TERMINAL` or the ball-in-court rule in the view/selector.
- **Punch is a court `Item`** — reuse `RecordDetailDrawer`; do NOT build a `PunchDrawer`. The
  domain atom stays `Item`; never introduce a type named `Record`.
- Overlays stay `position:fixed` outside the card's `overflow:hidden` (the drawer already is).
- One token source (`src/theme/tokens.ts` + `src/index.css`); status/stage pill colors from
  existing tokens — no ad-hoc hex. Keep the UI dumb (selectors take the slice as a param).

## Exit criteria (the gate — all must pass)
```
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck
npm --prefix "C:/Users/BUrness/Dev/Sitelines" test
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run build
```
- `punchRollup` + `groupPunchBy` + `mapPunchItem` unit-tested (co-located `.test.ts`).
- Seed `:5174` click-through: KPIs render, Stage/Assignee toggle regroups, sort works,
  photo/open-response indicators show, a row opens the record drawer.
- Live `:5175` (logged in): the real **1,097 items** render; the rollup reconciles —
  **closed 693 · open 404 · overdue 172 · % complete ≈ 63**; My Court still shows the same
  open punch items (the UNION is untouched); no console errors.
- Stop at the phase boundary; **don't commit or push until the owner says "Approved."**

## Notes for the implementer
- The `sitelines_punch` view is additive — it does not replace the `punch:` UNION in
  `sitelines_items`. Both read the same master; they answer different questions (dashboard
  lens vs. My Court inbox).
- `assignees` is a JSON array; `ball_in_court` is a display string. Prefer `ball_in_court`,
  fall back to `assignees[0].name`, else "" (closed items have no ball).
- Apply the view via the Supabase MCP `apply_migration` AFTER owner approval; then run
  `get_advisors` (security) and confirm it's clean, like the sibling views.
