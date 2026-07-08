# Sitelines — Build Plan

The single source of truth for **implementation sequencing**. The *what* lives in
[README.md](design_handoff_sitelines/README.md) and [DATA_CONTRACT.md](design_handoff_sitelines/DATA_CONTRACT.md) (the design handoff);
this file is the *in what order, and why*.

**Stack:** Vite + React 18 + TypeScript (strict), path alias `@/*`. Greenfield —
no prior codebase; stack chosen per the handoff's recommendation.

---

## Sequencing principle

Unlock the most surface with components already built → build the shared overlay
pattern once and reuse it → leaf views last. Within that, order by **(value
unlocked ÷ effort)** while respecting cross-links between views.

---

## Status

| # | Surface | Status |
|---|---------|--------|
| 0 | Layout shell (sidebar, header, content router, tokens, state, ball-in-court rule) | ✅ Done |
| 0 | My Court (home) view | ✅ Done |
| 1 | Tool registers (list view) | ✅ Done |
| 2 | Record-detail drawer (overlay) | ✅ Done |
| 3 | Directory | ✅ Done |
| 4 | Activity drawer (overlay) | ✅ Done |
| 5 | Command palette (overlay) | ✅ Done |
| 6 | Financial — Budget + Prime Contract | ✅ Done |
| 7 | Photos + Daily Log | ✅ Done |
| 8 | Overview (placeholder dashboard) | ✅ Done |

**🏁 UI workstream complete (2026-07-02):** every surface and overlay from the
design handoff is built and verified against the reference screenshots. The app
is feature-complete on seed data. Remaining work lives in the
[Procore Data Seam plan](Notes/plans/Procore-Data-Seam-Plan.md) (Phases 2–4:
Supabase views → live wiring → pipeline coverage).

All not-yet-built views currently route to `PlaceholderView`
([MainContent.tsx](src/components/layout/MainContent.tsx)), so nav is fully functional throughout.

### Parallel workstream: Drawings (log + in-app viewer + later markup)
Turning Drawings into a Procore-style **drawing log** (discipline-grouped, 7 columns),
an **in-app zoomable sheet viewer** with a revision picker, then (later, gated) a PDF
proxy and an optional Bluebeam-style markup engine — its own plan:
[Notes/plans/Drawings-Viewer-Plan.md](Notes/plans/Drawings-Viewer-Plan.md). Phases 1–2
need no re-sync (drawing PDFs/PNGs/thumbnails are already synced); Phases 3–4 are
deliberate backend/licensing investments with their own go/no-go.

| Phase | Surface | Status |
|-------|---------|--------|
| 1 | Drawing log — discipline-grouped, collapsible, 7 columns + Open PDF ↗ ([`sitelines_drawings`](sync/views/sitelines_drawings.sql) view · [DrawingsView](src/components/views/DrawingsView.tsx) · [groupByDiscipline](src/selectors/index.ts)) | ✅ Done (2026-07-06) |
| 2 | In-app sheet viewer + revision picker — zoom/pan PNG overlay, lazy revisions ([`sitelines_drawing_revisions`](sync/views/sitelines_drawing_revisions.sql) view · [DrawingViewerOverlay](src/components/overlays/DrawingViewerOverlay.tsx) · [sortRevisionsDesc](src/selectors/index.ts)) | ✅ Done (2026-07-06) |
| 3 | Fresh-URL edge function — kills sheet-image expiry: server-side Procore token mint → fresh `{pngUrl,pdfUrl}` ([`drawing-file`](supabase/functions/drawing-file/index.ts) edge fn on `sitelines-sync`, `verify_jwt` + `authenticated`-role gated · `getSheetUrls` seam · [DrawingViewerOverlay](src/components/overlays/DrawingViewerOverlay.tsx) lazy refresh-on-error) | ✅ Done (2026-07-07) |
| 4 | Markup & measure engine ("Bluebeam-like") | 🗄️ Backlogged (owner, 2026-07-07) — revisit only if in-app takeoff/measure is needed |

### Parallel workstream: Budget Insights (cost-control analytics)
Deepen **Budget** from a thin snapshot into a real cost-control surface on the
already-synced budget data — its own plan:
[Notes/plans/Budget-Insights-Plan.md](Notes/plans/Budget-Insights-Plan.md). v1 (owner,
2026-07-07) = cost-code drill-down + a risk lens + cost-type mix, built from
`procore_budget_detail_rows_master` (OP III; 23 divisions → 115 cost codes) — no
re-sync. Hand-rolled SVG (no chart lib); portfolio (McKenna) and trends-over-time are
deferred (need a sync change). The "next Procore tool to enrich" after RFIs + submittals.

| Phase | Surface | Status |
|-------|---------|--------|
| 1 | Cost-code drill-down (A) — `sitelines_budget_lines` view + `BudgetLine` seam + own [`BudgetView`](src/components/views/BudgetView.tsx): expandable division→cost-code table (Budget · Committed · % bought out · Uncommitted · Job-to-Date · Forecast · Projected/EAC · Over/Under). Fast-follows: collapsible KPIs + risk/mix, drag-resizable columns, click-to-sort, over-budget filter, over-committed (amber) cue — all hand-rolled | ✅ Done (2026-07-07) — view applied; ties to `sitelines_financials` to the penny |
| 2 | Risk radar + cost-type mix (B+C) — collapsible "Risk & cost-type mix" section on `BudgetView`: over-budget exposure ranking (worst-first + total) + largest-uncommitted + hand-rolled SVG Labor/Material/Subcontract bars (`overBudget`/`costTypeMix`/`buyoutGaps` selectors). No new seam | ✅ Done (2026-07-07) — exposure/mix tie to `sitelines_budget_lines` |
| 1.5 | Actuals columns + wider shell — view gains `erp_jtd` (actual spent) · `direct_costs` · `pending_cost_changes`; table adds **Job-to-Date** (% spent) + **Forecast to Complete** (EAC − spent). App goes full-screen (drops 1440px cap) with a collapsible icon-rail sidebar (pin toggle + hover-peek) | ✅ Done (2026-07-07) — JTD $16.5M / forecast $1.75M tie to Procore |
| 3 | Pending-change exposure (D) — cross-tool `sitelines_budget_pending` view (OPEN change events → line items → budget divisions) + `BudgetPending` seam + `budgetForecast` selector + collapsible "Pending changes" section on `BudgetView` (per-division Revised → Pending → Projected, incl. de-scope credits + an Unassigned bucket) | ✅ Done (2026-07-07) — $32,505 pending → projected $18.46M; ties to the open change-events register |
| 4–5 | Actuals & billing (E, ERP JTD now surfaced — requisitions/billing still deferred) · Trends over time (F, needs snapshot capture) · Portfolio (G, needs McKenna sync) | 🗄️ Deferred |

### Parallel workstream: Commitments (subcontract cost surface)
Enrich **Commitments** from a bare register (no vendor, no value today) into a subcontract
cost surface — its own plan: [Notes/plans/Commitments-Plan.md](Notes/plans/Commitments-Plan.md).
Financials come from each commitment's **latest requisition G702 summary** (billed
$15,283,425 reconciles to Budget's Invoiced-to-Date); the **Budget↔Commitment cost-code
cross-link** needs an FP-Analytics sync change (owner chose to pursue it, 2026-07-08).

| Phase | Surface | Status |
|-------|---------|--------|
| 1 | Commitments own view (like Budget) — `sitelines_commitments` view + `Commitment` seam + rollup KPIs + enriched sortable register (contract company · type · revised · billed · retainage · % complete · status) | ✅ Shipped — view applied, live-verified (billed $15,283,425), committed on `commitments-phase-1` |
| 2 | Commitment detail drawer — description · dates · privacy + CO log + billing history (lazy `getCommitmentDetail`) + scope-outline parser ([parseScope.ts](src/lib/parseScope.ts)); summary/inclusions-exclusions still stubbed until Phase 3 | 🚧 Built + 2 detail views applied (app + 111 tests green; live drawer verified) — ⛔ awaiting owner "Approved" to commit |
| 3 | ⛔ FP-Analytics sync change — per-commitment detail (show) pull → `procore_commitment_line_items_master` (cost code + amount + `budget_line_item_id`) + inclusions/exclusions onto commitment `raw` (sibling repo; owner-run re-sync) | 📋 Planned — kickoff ready ([kickoff](Notes/kickoffs/2026-07-08%20-%20Commitments%20Phase%203%20Kickoff.md)); ⛔ cross-repo · reconcile pipeline↔live-schema discrepancy first |
| 4 | Budget↔Commitment cross-link — `sitelines_commitment_line_items` view; Budget cost code → the sub(s) behind it; fill the richer drawer fields | 📋 Planned ⛔ new view (after Phase 3) |
| 5 | ⚖️ CONDITIONAL — manual scope-structure cleanup (non-destructive editor + user-overrides layer); build only if Phase 3 step-0 finds the API returns flat scope text | 📋 Deferred — decide after Phase 3 |

### Parallel workstream: Procore Data Seam
Wiring live Procore data (FP-Analytics → Supabase → app) is a **separate workstream**
with its own plan: [Notes/plans/Procore-Data-Seam-Plan.md](Notes/plans/Procore-Data-Seam-Plan.md).
It doesn't block the UI build (both go through the `DATA_CONTRACT` shapes). **One
piece of it should land early, though:** its **Phase 1 (app data provider + loading/
stale/refresh states)** is a pure client refactor best done while few views exist —
do it before the bulk of the view build-out below, so every later view is
live-data-ready by construction. Phases 2–4 (Supabase views, live wiring, pipeline
coverage) can run whenever.

---

## The ordered plan

### 1. Tool registers (list view)
RFIs, Submittals, Drawings, Specs, Change Events, Punch, Meetings, Schedule,
Documents, Commitments, Change Orders, Invoicing.
- **Why first:** nearly free — [ListTable](src/components/ui/ListTable.tsx) and the
  In-My-Court/All toggle already exist. Wiring `listRows` + the status-pill column
  lights up **11 tools** at once, and gives many rows to open the drawer from next.
- **Work:** a `ToolRegisterView` using `listRows(state)`, per-tool column labels
  (`whoLabel`/`rightLabel` from [tools.ts](src/data/tools.ts)), `showPill` rows, empty state.

### 2. Record-detail drawer (overlay)
- **Why second:** the shared payoff of every row (My Court + all 11 registers). It
  establishes the `position:fixed` **sibling-of-the-card** overlay pattern (backdrop,
  z-index 55, Esc-to-close) that the palette and activity drawer reuse — build once,
  ride three times.
- **Work:** mount at the overlay slot in [App.tsx](src/App.tsx); header (code badge +
  num + ×), title + status pill + project tag, 2×2 meta grid, description, **Linked
  records** (resolve `record.links` ids → open on click), ball-in-court history,
  attachment chips, sticky Respond/Forward/Resolve footer. "Waiting on → party" link
  navigates to Directory with `dirFocus` (target arrives in step 3).
- ⚠️ Overlays MUST render outside the card's `overflow:hidden` (README "Global Layout").

### 3. Directory
- **Why here:** completes the drawer's "Waiting on → party" cross-link (`dirFocus`
  focus-highlight) so it lands on a real target; has its own per-contact open-count
  pill (reuses [ballInCourt](src/lib/ballInCourt.ts) + `WHO2ID`, already in place).
- **Work:** `DirectoryView` — its own grid (README §6), projects dot-swatches, contact
  cell, open-count pill, focus-highlight row style driven by `state.dirFocus`.

### 4. Activity drawer (overlay)
- **Why here:** trivial once the overlay pattern exists; data is done
  ([activity.ts](src/data/activity.ts)). Quick win.
- **Work:** right drawer, reverse-chron feed (tone dot + text + project tag + sub +
  relative time), filtered by project scope.

### 5. Command palette (overlay)
- **Why here:** reuses the overlay pattern; searches across the registers (now they
  exist). ⌘K plumbing already wired in [App.tsx](src/App.tsx).
- **Work:** center-top modal, autofocus input, results = matching records across list
  tools (empty query → tool list to jump to), click opens detail / navigates.

### 6. Financial — Budget + Prime Contract
- **Why here:** self-contained but a genuinely different layout (6 KPI cards +
  aggregating division table). No dependencies; medium effort.
- **Work:** `FinancialView` — KPI grid + division table with total row; re-aggregates
  per project scope (single vs. summed). Numbers per DATA_CONTRACT §6.

### 7. Photos + Daily Log
- **Why here:** leaf card-grids that reuse the header toggle (flagged / needs-sign-off).
  Low complexity, no cross-dependencies.
- **Work:** `PhotosView` (4-col striped placeholders) + `DailyLogView` (stacked cards).
  Needs `PHOTOS` and `LOGS` seed data (not yet ported from the prototype).

### 8. Overview (placeholder dashboard)
- **Why last:** the README explicitly calls this a **placeholder** (striped chart
  panels, sample data locks the layout). Lowest value pixels per hour.
- **Work:** `OverviewView` — info banner, 4 KPI tiles, per-project cards with %
  bars + mini-stats, three dashed chart-placeholder panels. Real charts intentionally
  not built.

---

## Through-line
- **1–2** make the app feel real: browse any tool → open any record.
- **3–5** finish the interaction model off one overlay pattern.
- **6–8** are independent leaves — reorder freely.

## Remaining seed data to port (from `Sitelines.dc.html`)
`PHOTOS`, `LOGS` (step 7); financial `DIV`/`CHG`/`OU` (step 6). Records, tools,
directory, activity, and cross-links are already in [src/data/](src/data/).
