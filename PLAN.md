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
| 3 | Sync change (in-repo `sync/`) — per-commitment detail (show) pull → `procore_commitment_line_items_master` (cost code + amount) + inclusions/exclusions onto commitment `raw` | ✅ Shipped + synced — 479 line items across 51 commitments; Casework PO ties to grand_total $539,086.57 (codes 12-123530.000 / 6-64100.000); inclusions/exclusions on 41/17 commitments. [migration 0009](sync/migrations/0009_commitment_line_items.sql) + `procore_pipeline.py`. ⚠️ per-commitment GETs pushed the run into a ~39-min Procore rate-limit cooldown |
| 4 | Budget↔Commitment cross-link — `sitelines_commitment_line_items` view; Budget cost code → the sub(s) behind it; real inclusions/exclusions + SOV line items in the drawer | ✅ Shipped — both views applied + live-verified (Casework `12-123530.000` → PO-25-117-123 $500,000; drawer SOV + inclusions/exclusions render). App + 121 tests green. Note: commitments billed now $15,285,899 (incl. one Under-Review pay app, PO-25-117-085 #3 $2,474.04); Budget's approved-only Invoiced-to-Date stays $15,283,425 — reconverges on approval, not a defect |
| 5 | Manual scope-structure cleanup — non-destructive inline editor (split/heading/indent/merge over description + inclusions + exclusions) + the app's first user-authored write layer (`sitelines_scope_overrides` table + `UserData` seam). Sub-phased **5a** write seam ⛔ · **5b** render + staleness · **5c** the editor | ✅ **Shipped (5a + 5b + 5c)** — 5a: writable `sitelines_scope_overrides` table ([0010](sync/migrations/0010_scope_overrides.sql) + [0011](sync/migrations/0011_scope_overrides_owner_writes.sql); write RLS scoped to `auth.uid()`) + `UserData` seam (Supabase live / `localStorage` seed). 5b: pure [applyScopeOverride](src/lib/applyScopeOverride.ts) (override / parser / stale) wired into the drawer's 3 scope sections via `ScopeOutline` (+ indent) with a "source changed" banner. 5c: inline "Edit structure" editor — pure [scopeEdit](src/lib/scopeEdit.ts) ops (split/heading/indent/merge, words locked, partition asserted on save) writing through the seam; structure-aware seed (`segmentSource` breaks before headings/clause markers so numbers lead their clauses); temp `?scopeproof` scaffold removed. 158 tests green; advisors clean; full round-trip verified live (`:5175`) + seed |
| 6 | Scope list formatting + bold + your-own-notes — bullets, opt-in numbered items, word-level **bold**, and user-authored "notes" pinned into a commitment's scope (extends the Phase-5 editor; contract words stay locked, notes shown clearly marked). Sub-phased **6a** list styling (bullets + numbers) · **6c** bold (word-level emphasis) · **6b** notes (the one words-locked safety-model change) | 🚧 **6a + 6c shipped** (list styling + bold) — 6a: `list?: 'bullet'\|'number'` on `ScopeBlockOverride` + `ScopeBlock`; pure tested [annotateOrdinals](src/lib/applyScopeOverride.ts) (counter per indent · nested runs restart · any non-number block breaks the run); `ScopeOutline` draws `•` / the computed ordinal on **para** blocks (headings unaffected); [scopeEdit](src/lib/scopeEdit.ts) `setList` op + a plain→bullet→number cycle control (disabled on headings); `coerceBlocks` validates `list`. **6c**: `bold?: number[]` (which words are bold, as space-split indices) on `ScopeBlockOverride` + `ScopeBlock`; [scopeEdit](src/lib/scopeEdit.ts) `toggleBold` op + bold-index-aware `splitBlock`/`mergeUp` re-mapping; a bold-mode editor toggle ("B") where a word-click bolds instead of splitting; pure tested [proseEmphasis](src/lib/proseEmphasis.ts) — *your bold wins per block* (manual bold suppresses the Title-case auto-bolder on that block only); `coerceBlocks` validates `bold` (sorted unique in-range integers). Both **presentation-only** — the marker / emphasis is drawn at render, never in `text`, so `partitionsSource` is untouched. **6b**: `source:'user'` notes — the one words-locked safety-model change: `partitionsSource` now filters to contract blocks (`source !== 'user'`) before asserting, so notes (free text, the ONLY typing path) are excluded from the contract partition; [scopeEdit](src/lib/scopeEdit.ts) `addNote`/`setNoteText`/`removeNote`/`dropEmptyNotes` + cross-`source` merge guard; `ScopeOutline` renders notes with a tinted "Your note" treatment (`tone.info`); `coerceBlocks` validates `source`. **Phase 6 complete (6a + 6b + 6c) — 201 tests green**; verified seed (`:5174`, full note + bold round-trips — persist · render · words verbatim · empty note dropped · split/merge keeps the right words bold) + live (`:5175`, 6a authenticated write to the real table). No ⛔ SQL gate (`blocks` is `jsonb`; CHECK only on `field`). **Follow-on: a UI-only editor redesign** (Notion-feel on this same safe engine) — [Scope-Editor-Redesign-Plan](Notes/plans/Scope-Editor-Redesign-Plan.md). **Phase R1 ✅ shipped 2026-07-10** (plain-text lines · gap-split · selection→Bold chip · hover `⠿` handle menu · note textareas; `setBoldWords` added; **+ owner-requested undo/redo** via pure `src/lib/history.ts`). Seed-verified + 216 tests green; live `:5175` left to the owner. **R2 (drag-to-reorder) still pending.** |

### Parallel workstream: Submittal Viewer (open the Final reviewed submittal in-app)
Make the **"Final reviewed submittal"** row in the record drawer open the stamped PDF
**inside Sitelines** (browser's native PDF viewer in a large overlay) instead of
downloading it — its own plan:
[Notes/plans/Submittal-Viewer-Plan.md](Notes/plans/Submittal-Viewer-Plan.md). Needs a
small **byte-streaming edge function** (re-mints a fresh Procore URL server-side and
streams the PDF inline — the browser can't fetch it directly: attachment header + no
CORS). Reuses the Drawings [`drawing-file`](supabase/functions/drawing-file/index.ts)
function wholesale; Procore secrets already set (no new-secret gate). Owner-locked
(2026-07-13): two phases · v1 = final doc only · keep a Download/Open-in-Procore fallback.

| Phase | Surface | Status |
|-------|---------|--------|
| 1 | `submittal-file` byte-streaming edge function (auth-gated proxy: Procore token → submittal detail v1.1 → latest `final_attachments` url → stream PDF inline) + `getFinalSubmittalFile` seam (supabase invoke / seed null) | ✅ Shipped + deployed (2026-07-13) — `submittal-file` v1 ACTIVE on `sitelines-sync` (`verify_jwt`+`authenticated`-role gated). Live-verified: unauth/publishable-key → 401; `submittals:63076362` → 200 `application/pdf` `%PDF-` 2.3 MB; no-final `submittals:63205968` → 404 `no_final`. 228 tests green. ⛔ awaiting owner "Approved" to commit |
| 2 | `SubmittalViewerOverlay` (iframe + blob, loading/error/fallback) + open-from-row wiring in the record drawer + `AppState.submittalViewer` | ✅ Shipped (2026-07-13) — the drawer's Final-reviewed-submittal row opens the stamped PDF in-app (`getFinalSubmittalFile` → Blob → object URL → `<iframe>`), z-60 over the drawer; Download + Open-in-Procore fallbacks; ×/backdrop returns to the drawer, Esc closes all; revokes the object URL on close. Live-verified (`:5175`, logged in): `03 4100-1` Precast → blob PDF renders in-app, no download, no console errors, close returns to drawer. typecheck + 228 tests + build green. ⛔ awaiting owner "Approved" to commit |

### Parallel workstream: Change Events (cost-exposure ledger)
Enrich **Change Events** from a bare register (CE # · title · blank "Owner" · status) into a
**cost-exposure ledger** — its own plan: [Notes/plans/Change-Events-Plan.md](Notes/plans/Change-Events-Plan.md).
Closes the change-money loop: Budget's pending-change section already reads OPEN change
events, so Change Events is literally its source. **No re-sync** — both masters
(`procore_change_events_master` 165 events · `procore_change_event_line_items_master` 242
lines) are already synced; only new read-only Supabase views. Locked (owner, 2026-07-13):
**cost-exposure lens** (own analytics view like Budget/Commitments, money-first — scope
In/Out/TBD + funding bucket Allowance/Buyout/Owner-Contingency/Original) **with the drawer +
cross-links in v1**. The line→commitment cross-link is dense (180 lines → 40 subs); RFI-origin
is rare (2 events) → opportunistic.

| Phase | Surface | Status |
|-------|---------|--------|
| 1 | Change Events own view (like Budget/Commitments) — `sitelines_change_events` view + `ChangeEvent` seam + rollup KPIs (total/open exposure · open/closed/void) + scope & funding-bucket breakdown + enriched sortable register (CE # · title · scope · type · reason · est. cost · status) | ✅ Shipped (2026-07-13) — [view](sync/views/sitelines_change_events.sql) applied (`security_invoker`, no re-sync); typecheck + **240 tests** + build green; seed (`:5174`) + live (`:5175`) reconcile — **open exposure $19,395.00 = `sitelines_budget_pending` to the penny**; 165 events (6 open · 143 closed · 16 void); advisors clean on the view; `ballInCourt` untouched. Committed on `change-events-phase-1` |
| 2 | Detail drawer + cross-links — `sitelines_change_event_line_items` view + `ChangeEventLineItem` seam + `changeEvent` on `AppState` + a `ChangeEventDrawer` overlay: priced line items grouped by cost code, the **commitment each change hits** (click → opens `CommitmentDrawer`), the **Budget-pending tie-back**, RFI-origin as a static "From RFI" chip (clickable nav deferred — 2 events) | ✅ Shipped (2026-07-13) — [view](sync/views/sitelines_change_event_line_items.sql) applied (`security_invoker`, no re-sync); typecheck + **243 tests** + build green; seed (`:5174`) + live (`:5175`) verified — **242 lines · 180→40 subs · every event's line sum = `est_cost` exactly**; CE #8 → SC-25-117-051 opens the real Commitment drawer; advisors clean. Committed on `change-events-phase-1` |

### Parallel workstream: Invoicing (pay-application register)
Enrich **Invoicing** from a bare register into a project-wide **pay-application register** —
its own plan: [Notes/plans/Invoicing-Plan.md](Notes/plans/Invoicing-Plan.md). The money-out
surface: 200 subcontractor pay apps across 49 commitments (Approved + 1 Under Review), the AIA
G702 billing history that currently only lives per-commitment. **No re-sync**
(`procore_requisitions_master` already synced; owner-side `procore_payment_applications_master`
has just 1 row → a note). Chosen (owner, 2026-07-13) over Change Orders (owner COs total only
$34K, no synced change-event trace). **Load-bearing rule:** cumulative G702 fields are summed
over the **latest pay app per commitment** (not all rows) → billed $15,285,899 · retainage
$622,877, tying to Commitments.

| Phase | Surface | Status |
|-------|---------|--------|
| 1 | Invoicing own view — `sitelines_invoices` view (one row/requisition + G702 summary + `is_latest`) + `Invoice` seam + rollup KPIs (billed to date · retainage · this period · # under review) + enriched sortable register (vendor · pay app # · period · this period · billed · retainage · % · status) | ✅ Shipped (2026-07-13) — [view](sync/views/sitelines_invoices.sql) applied (`security_invoker`, no re-sync); typecheck + **251 tests** + build green; seed (`:5174`) + live (`:5175`) reconcile — **billed $15,285,899 + retainage $622,877 = Commitments** (isLatest-gated); 200 pay apps · 49 subs · 1 under review; advisors clean. Committed on `change-events-phase-1` |
| 2 | G702 detail drawer (no new SQL) — `invoice` on `AppState` + an `InvoiceDrawer`: the G702 cover sheet (original → net COs → revised · billed · retainage breakdown · balance to finish) + **click-through to the commitment** it bills + owner-pay-app note | ✅ Shipped (2026-07-13) — reuses the Phase-1 view (no SQL); typecheck + **251 tests** + build green; seed (`:5174`) + live (`:5175`) — G702 cover sheet renders, "Bills against" opens the real Commitment drawer (PO-25-117-085). Committed & merged to `main` |
| 3 | **v2** — billing-period selector on the register (14 periods, no re-sync) + a **billing-history** section in the drawer (a sub's current + past pay apps, click to switch) | 🚧 Built + verified (typecheck + **256 tests** + build green; seed `:5174` — period filter + history click-switch + Viewing/Current markers; live `:5175` — 15-option dropdown newest-first, June→28 pay apps, real 11-pay-app billing history). No SQL/re-sync. ⛔ awaiting owner "Approved" to commit |
| 4 | **v2** ⛔ — Procore sync change: per-requisition **SOV line items** (G703) → `procore_requisition_line_items_master` (migration 0012). Endpoint is `/requisitions/{id}/detail` (a LIST; the show endpoint has no lines — caught by a probe). Scope `'latest'` (~49) | ✅ **Synced + verified (2026-07-13)** — migration 0012 applied; `enrich_requisitions_with_detail` (owner-approved run, scope=latest) pulled **615 G703 lines across 49 latest pay apps**; **all 49 reconcile to their G702 billed** (`reqs_reconciling=49`, none outside `is_latest`); requisitions master refreshed from the same pull (billed now $15,481,880, incl. a new live pay app). **Phase 4.1 (incremental) shipped** — the nightly now pulls a requisition's SOV only when it's new or not-yet-Approved (an Approved pay app's G703 is immutable), rewriting just those and keeping the rest (accumulates history, no purge). Verified live: a re-run pulled **2 of 49** (the under-review ones), rows 615→615, still reconciles. Nightly cost ~2 GETs, not ~49 |
| 5 | **v2** — render the **G703 SOV** in the drawer: `sitelines_invoice_line_items` view + seam + a "Schedule of values" section (per line: scheduled · this period · to date · % · retainage), subtotals tie to the G702 cover sheet | ✅ **Shipped (2026-07-13)** — [view](sync/views/sitelines_invoice_line_items.sql) applied (`security_invoker`, no re-sync); typecheck + **258 tests** + build green; seed (`:5174`) + live (`:5175`) — a pay app opens into its G703 (**17 lines, $1,974,850 to date = the G702 billed**), %-bars per line, history-switch swaps the SOV; advisors clean. The full "what's getting billed per line" ask, delivered |

### Parallel workstream: Specifications (CSI-divisioned spec book)
Enrich **Specifications** from a bare, flat 189-row register into the navigable **spec
book** — CSI-MasterFormat-division-grouped, collapsible, searchable — then (gated) each
section's real PDF via **Open PDF ↗** — its own plan:
[Notes/plans/Specifications-Plan.md](Notes/plans/Specifications-Plan.md). Chosen next
(owner, 2026-07-14) as the lowest-risk high-utility win, cloning the **Drawings** log
pattern. **The grouped log is free** (division = the first token of every section
`number`; no re-sync), but the spec master is a thin summary (`number` · `label` ·
`description` · `current_revision_id` pointer only) — so **the PDF + issued dates are a
gated re-sync** (⛔ ≈189 per-section Procore GETs + a spec fresh-URL edge function),
exactly the two-step Drawings itself took. Owner **committed to the full PDF result**.
**Update (2026-07-15):** the owner supplied Procore's spec-viewer URL pattern
(`/project/specification_section_revisions/<current_revision_id>?open_viewer=true`) —
and `current_revision_id` is **already synced**, so a per-row **Open in Procore ↗** (opens
the section's PDF in Procore's viewer) shipped **for free** as Phase 1.5, verified live to
the digit (`03 3000` → revision `46700073`). That makes the Phase-2/3 re-sync purely about
(a) the **Issued date** column and (b) serving the PDF **in-app** (no Procore bounce); the
owner **chose the full in-app PDF** (2026-07-15), reusing the **Submittal Viewer** pattern
(`submittal-file` edge fn + blob overlay). Open-in-Procore stays as the fallback.

| Phase | Surface | Status |
|-------|---------|--------|
| 1 | Spec log — `sitelines_specs` view + `Spec` seam + `csiDivisions` lib + `groupByDivision` selector + own collapsible/searchable `SpecsView` (CSI divisions in book order, section # · title). No re-sync | ✅ Shipped (2026-07-15) — [view](sync/views/sitelines_specs.sql) applied (`security_invoker`, no re-sync); typecheck + **282 tests** + build green; view returns **189 sections / 21 divisions** (dates+pdf NULL), advisors clean; seed (`:5174`) verified — book order (00→26), within-division natural sort (`09 9110` before `09 9123`), search (name-match keeps a division whole), collapse/expand. Live (`:5175`, logged in) verified — the real **189 sections / 21 divisions** render, division counts tie to the DB to the row (00→6, 01→20, 06→11, 26→37 …), canonical CSI names + real titles, no console errors. Committed on `specifications-phase-1` |
| 1.5 | **Open in Procore ↗** per row — `procore_url` on `sitelines_specs` (constructed from the already-synced `current_revision_id`, no re-sync) + `Spec.procoreUrl` + a link cell on `SpecsView` (opens the section's PDF in Procore's viewer); the row's permanent Procore fallback once the in-app PDF lands | ✅ Shipped (2026-07-15) — view widened (append-only `CREATE OR REPLACE`); typecheck + **282 tests** + build green; seed (`:5174`) link href-verified; live (`:5175`, logged in) — **189/189** rows link out, `03 3000` → revision **46700073** (= the owner's URL to the digit), no console errors |
| 2 | **⛔ re-sync** — `enrich_specs_with_detail()`: per-section current-revision fetch → issued date + attachment PDF url onto the spec master `raw` (gated, no purge on partial fail). ⚠️ **probe for a bulk `/specification_section_revisions` list first** (one call for the whole project) to avoid ~189 per-section GETs + the rate-limit cooldown | ⏳ Planned |
| 3 | **In-app PDF** (owner chose over Open-in-new-tab, 2026-07-15) + Issued date — widen `sitelines_specs` (issued_date + pdf_url) + a `spec-file` byte-streaming edge fn + a `SpecViewerOverlay` (blob iframe) reusing the **Submittal Viewer** wholesale; Open-in-Procore (1.5) stays as the fallback | ⏳ Planned |

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
