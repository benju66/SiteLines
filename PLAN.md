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
