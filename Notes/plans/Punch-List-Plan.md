# Punch List — enrich the tool into a closeout dashboard (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + the design handoff (`design_handoff_sitelines/`).
> Siblings done — reuse their patterns verbatim: **Change Events**
> (`Notes/plans/Change-Events-Plan.md`) and **Invoicing** (`Notes/plans/Invoicing-Plan.md`):
> per-tool Supabase view → pure mapper → `SiteData` slice → own view + rollup selectors.
> For the Phase-2 detail thread, the model is **Record Detail Enrichment**
> (`Notes/plans/Record-Detail-Enrichment-Plan.md`) — punch was its deferred Phase 2.

## Goal
Turn **Punch List** from a bare register into a **closeout dashboard**: its own view
showing every punch item across the job with a rollup (total · open · overdue ·
ready-for-review · closed · **% complete**), a register grouped by **lifecycle stage**
with a **"who owes what" by-assignee** lens, and per-row indicators for photos and open
responses. Rows open the **existing** `RecordDetailDrawer` (punch is a court `Item`).

**Plain-English:** a punch list is the closeout to-do list — every little fix the subs
owe before the job is done. Procore tracks each item through a lifecycle (a sub gets it →
does the work → the GC/architect verifies → it's closed). This view answers the two
closeout questions the flat register can't: **how far along are we** (progress by stage)
and **who's holding us up** (open items per sub).

## Where the data actually lives (verified live 2026-07-20, OP III / project 3051002)
**Zero re-sync for Phase 1** — everything below is already in `procore_punch_items_master`
(1,097 items); only a new read-only Supabase view.

- **Lifecycle (the gold):** `status` ∈ {Open, Overdue, Closed} and a finer
  `workflow_status` ∈ {`initiated` (4), `work_required` (192), `ready_for_review` (208),
  `closed` (693)}. Closeout progress = closed / total = **693/1097 ≈ 63%**; **404 open**
  (172 **Overdue**).
- **Populated & useful:** `name` (title, 100%), `ball_in_court` + `assignees[]`
  (the 404 open items; **20 distinct subs**), `due_date` (936), `has_attachments`
  (**876 — 80% have photos**), `has_unresolved_responses` / `has_resolved_responses`,
  `punch_item_manager` (100%), `position` (the human "#"), `created_at`, `closed_at`.
- **⚠️ EMPTY on this project — do NOT group by these:** `location` (0), `trade` (6),
  `priority` (0), `description` (0), `punch_item_type` (0). The team tracks by
  **assignee** and **lifecycle stage**, not room/trade/priority. The dashboard groups by
  those two dimensions, NOT location/trade (they'd be one big "Uncategorized" bucket).
- **Photos + response thread are only FLAGS here.** `has_attachments` /
  `has_unresolved_responses` are booleans; the actual photo URLs and the thread text are
  NOT in the list payload — they need a per-item `/punch_items/{id}` detail pull (Phase 2).

## Out of scope / deferred
- **Re-sync / new Procore pulls in Phase 1** — none. (Phase 2 adds a gated per-item pull.)
- **The real response thread + rendered photos** — Phase 2/3 (⛔ re-sync + a fresh-URL
  edge fn for photo bytes, like Drawings/Specs). Phase 1 shows only the *indicators*
  (a 📎 photo count and an "open response" dot) from the synced flags.
- **Grouping by location/trade/priority** — the fields are empty here; skip.
- **A new detail drawer** — punch is a court `Item`; it reuses `RecordDetailDrawer`.
  Do NOT build a `PunchDrawer` (that would fork the court/detail path).
- **Writing back to Procore** — never. Read-only.
- **McKenna / multi-project** — OP III only (only 3051002 synced), like every sibling.

## Locked product decisions (from the owner, 2026-07-20)
1. **Build the closeout dashboard view** (chosen over "just enrich the record drawer" and
   over "dashboard + photos in v1"). A dedicated `PunchView` on already-synced data;
   photos + the response thread are a **separate gated Phase 2**.
2. Group by **lifecycle stage** and **assignee** (the two populated dimensions), not
   location/trade/priority.

## Data model (DATA_CONTRACT)
A new **reference-style** shape `PunchItem` in `src/types.ts` — NOT a court `Item` (the
court `Item` for punch already exists via the `sitelines_items` UNION and drives My Court;
this is the richer dashboard row, like `Commitment`/`ChangeEvent`/`Invoice`). Keep it
light; selectors derive the rollup + groups.

```ts
/** One punch item for the closeout dashboard (Punch List). Reference-style — the
 *  court Item for My Court still comes from the sitelines_items UNION; this is the
 *  richer row the dedicated PunchView renders. Phase-2 detail (thread + photos) is
 *  fetched lazily via the record drawer, not carried here. */
export interface PunchItem {
  id: string            // "punch:<id>" (matches the sitelines_items UNION id)
  number: string        // "#<position>"
  name: string          // the item title (this project's items have no separate description)
  assignee: string      // ball_in_court / assignees[0].name ("" when closed/unassigned)
  status: string        // "Open" | "Overdue" | "Closed"
  workflowStatus: string // "initiated" | "work_required" | "ready_for_review" | "closed"
  dueDate: string | null // preformatted display date
  hasPhotos: boolean    // has_attachments (indicator only in Phase 1)
  hasOpenResponse: boolean // has_unresolved_responses (indicator only in Phase 1)
  manager: string       // punch_item_manager.name (the GC owner)
}
```

- A Supabase view `sitelines_punch` (`security_invoker=true`, `WHERE project_id=3051002`)
  emits these out of `procore_punch_items_master`. A pure `mapPunchItem(row)` shapes it.
- **Keep the `punch:` UNION in `sitelines_items.sql` intact** — My Court + the ball-in-court
  rule read from it. The new view is ADDITIVE (a second, richer lens over the same master).
  Do NOT move punch off the court path.

## Build-on inventory (read these fresh before using)
REUSE, do not fork — Punch's dashboard is a near-clone of Change Events / Invoicing:
- `src/components/views/ChangeEventsView.tsx` (or `InvoicingView.tsx`) — the rollup-KPIs +
  sortable-register layout. `PunchView` is this with lifecycle KPIs + a group toggle.
- `src/selectors/index.ts` — `changeEventRollup` / `invoiceRollup` + the sort helpers are
  the template for `punchRollup` + `groupPunchBy`. Pure; feed them fixtures.
- `sync/views/sitelines_change_events.sql` / `sitelines_invoices.sql` — the view template
  (`security_invoker`, project-scoped).
- `src/lib/mapChangeEvent.ts` / `mapInvoice.ts` — the mapper + Row-interface template.
- `src/lib/dataSource.ts` (`SiteData`) + `src/data/seedSource.ts` + `src/data/supabaseSource.ts`
  — add a `punch: PunchItem[]` slice (mirror the `invoices` wiring: `fetchAll<PunchRow>` +
  `mapPunchItem`; a `PUNCH` seed fixture covering all lifecycle stages + assignees).
- `src/components/layout/MainContent.tsx` + `TOOLS` (`src/data/tools.ts`) + `ViewType`
  (`src/types.ts`) — flip `punch.view` from `'list'` to `'punch'`, add `punch` to `ViewType`,
  register `PunchView`. NOTE `punch` is already in `COURT_TOOLS` / the `TYPE_TO_TOOL` map —
  leave `src/lib/ballInCourt.ts` UNTOUCHED (the rollup uses the punch lifecycle, a DIFFERENT
  question from the My Court inbox rule; never duplicate `TERMINAL`).
- Rows open the existing drawer: `patch({ detail: { tool: 'punch', record } })` needs an
  `Item` — reuse the court `Item` for that punch id (from `itemsByTool.punch`) so the drawer
  gets the shape it expects. (Confirm how the register views open the record drawer.)
- **Phase 2 only:** `src/lib/mapRfiDetail.ts` + `enrich_rfis_with_detail()` in
  `sync/procore_pipeline.py` are the exact model for the per-item detail pull + the
  `getDetail` render path; `supabase/functions/drawing-file` (or `spec-file`) is the
  fresh-URL edge-fn model for the photo bytes.

## Pure logic to extract + unit-test
- `punchRollup(items: PunchItem[]): PunchRollup` in `src/selectors/` — counts by lifecycle
  (initiated / work_required / ready_for_review / closed) + open / overdue + `pctComplete`.
  Pure; feed it fixtures. `PunchRollup = { total, open, overdue, readyForReview, closed, pctComplete }`.
- `groupPunchBy(items, dim: 'stage' | 'assignee'): PunchGroup[]` — buckets + orders (stage
  in lifecycle order initiated→closed; assignee by open-count desc, then alpha), items within
  a group sorted (overdue first, then due date). Deterministic (no clock — pass a comparable
  due value in, or sort on the preformatted-safe key); co-located `.test.ts`.
- `mapPunchItem(row): PunchItem` in `src/lib/` — trivial shaping; unit-test the assignee
  fallback (ball_in_court → assignees[0] → "") and the boolean flags.

## Sub-phasing (ship + verify each)

### Phase 1 — the closeout dashboard view (no re-sync)
- **Scope:** `sitelines_punch` view + `PunchItem` shape + `mapPunchItem` + `punchRollup` +
  `groupPunchBy` selectors + `PunchView` (rollup KPI cards: total · open · overdue ·
  ready-for-review · closed · % complete; a **Stage / Assignee** group toggle; a sortable
  register with #, name, assignee, due date, status pill, 📎 photo + ● open-response
  indicators; rows open `RecordDetailDrawer`) + route wiring (tools.ts / ViewType /
  MainContent) + the `punch` slice across `SiteData`/seed/supabase (+ a `PUNCH` seed
  fixture). Leave the `punch:` UNION in `sitelines_items` and `ballInCourt.ts` untouched.
- **Approval gates:** ⛔ **present the `sitelines_punch` view SQL and STOP** for owner
  sign-off before applying to Supabase (the standing Supabase-DDL invariant). No
  Procore/credential touch in this phase.
- **Exit criteria:** typecheck + test + build green (absolute-prefix commands below);
  `punchRollup` + `groupPunchBy` + `mapPunchItem` unit-tested; seed (`:5174`) click-through
  (KPIs, stage/assignee toggle, sort, indicators, row → drawer) AND live (`:5175`, logged
  in) showing the real 1,097 items with the rollup reconciling (closed 693, open 404,
  overdue 172, % complete ≈ 63); the register no longer renders the flat `ToolRegisterView`;
  My Court still shows the same open punch items (the UNION is untouched). Stop at the phase
  boundary; don't commit until "Approved."

### Phase 2 — the punch detail: response thread + photos (⛔ re-sync)
- **Scope:** `sync/procore_pipeline.py`: `enrich_punch_with_detail()` — per-item
  `/punch_items/{id}` fetch (probe the payload first) → store the response thread + the
  photo attachment metadata onto the punch master `raw` (gated on the `is not None` pattern;
  mark synced only if all succeed, so a partial fetch never purges). Then the app: a `punch`
  branch in `getDetail` (`ItemDetail` with the thread, mirroring `mapRfiDetail`) so the
  existing `RecordDetailDrawer` shows the real item narrative + responses; photo THUMBS via a
  fresh-URL path (reuse/generalize the `drawing-file`/`spec-file` edge fn + a `getPunchPhotos`
  seam). Scope the pull (open items first? all 1,097?) and get explicit go.
- **Approval gates:** ⛔ the **Procore pull** (~404–1,097 GETs — probe for a bulk/incremental
  route first, like the Specs per-division win; scope + get explicit go). ⛔ any migration DDL.
  ⛔ deploying an edge function (reuses existing Procore secrets — confirm before deploy).
- **Exit criteria:** the detail is queryable; counts reconcile (none purged); opening a punch
  item shows its real responses + photo thumbs; typecheck + test + build + live click-through.

## Hard guardrails (do not violate)
- **The ball-in-court rule stays centralized** in `src/lib/ballInCourt.ts` — punch is already
  a `COURT_TOOL`; the dashboard's rollup uses the punch **lifecycle** (`workflow_status`), a
  DIFFERENT question from My Court inclusion. Never duplicate `TERMINAL` or re-implement the
  rule in the view/selector.
- **The domain atom is `Item`** — `PunchItem` is a separate reference shape; never introduce a
  type named `Record`. Punch keeps its court `Item` (the UNION) AND gets the `PunchItem` row.
- **Overlays** render `position:fixed` outside the card's `overflow:hidden` (the record drawer
  already does — don't regress). Rows reuse `RecordDetailDrawer`; don't build a new drawer.
- **One token source** (`src/theme/tokens.ts` + `src/index.css`) — status/stage pill colors +
  any dots come from existing tokens; no ad-hoc hex. Match the sibling register views.
- **Keep the UI dumb / respect the data seam** — `PunchView` reads `punch` via `useSiteData()`;
  selectors take the slice as a parameter; the seed→Supabase swap needs zero view changes.
  `supabaseSource` must keep paging past the 1000-row cap (`fetchAll`) — **punch has 1,097
  rows, so this MATTERS** (a naive single fetch would silently drop 97 items).
- **Present all DDL/SQL and STOP** for owner approval before applying to Supabase; reuse
  Procore + Supabase creds via `sync/.env` / `.env.local`, never commit secrets.

## Open decisions
- **Register default filter:** show all 1,097 (closed collapsible) vs. default to the 404
  actionable (open/overdue) with a "show closed" toggle. Low stakes — resolve at Phase 1
  kickoff; recommend: rollup counts ALL (for % complete), register defaults to actionable.
- **Phase 2 pull scope:** open items only (~404) vs. all (1,097) — decide after the
  Phase-2 payload probe (and whether a bulk/incremental route exists).

## Verification commands (the exit-criteria gate)
```
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck   # tsc -b (primary gate)
npm --prefix "C:/Users/BUrness/Dev/Sitelines" test            # vitest
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run build       # tsc -b && vite build
```
UI: seed `:5174` + live `:5175` click-through (drive with the browser tools; read DOM state
in a SEPARATE call after a click — React re-renders after the tick).
