# Specifications — enrich the tool into a CSI-divisioned spec book (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + the design handoff (`design_handoff_sitelines/`).
> Sibling done — reuse its patterns almost verbatim: **Drawings**
> (`Notes/plans/Drawings-Viewer-Plan.md`): per-tool Supabase view → pure mapper →
> `SiteData` slice → own discipline-grouped view → (later, gated) a per-record
> detail re-sync + a fresh-URL edge function for the PDFs. Specs is the same three
> steps, grouped by **CSI division** instead of discipline.

## Goal
Turn **Specifications** from a bare, flat 189-row register into the navigable
**spec book** everyone recognizes: sections grouped into their **CSI MasterFormat
divisions** (00 Procurement & Contracting … 33 Utilities), each division
collapsible, searchable, with the section number + title — and eventually an
**Open PDF ↗** on each row that opens the current spec section, exactly like the
drawing log's sheets.

**Plain-English:** a construction spec book is organized into ~50 numbered
"divisions" (03 = Concrete, 26 = Electrical, …); each division holds numbered
"sections" (26 0519 = Low-Voltage Electrical Conductors). Procore syncs us the
flat list of 189 sections; the first two digits of every section number ARE its
division. So we can rebuild the book's structure for free — and then (a deliberate
backend step) pull each section's PDF so the field can open the actual spec.

## Where the data actually lives (verified live 2026-07-14, OP III / project 3051002)
`procore_specification_sections_master` — **189 sections**. Each `raw` is a THIN
list-endpoint summary with only:
- `id` — section id (→ item id `specs:<id>`)
- `number` — e.g. `"26 0519"` (space-separated; **first token = CSI division code**)
- `label` — e.g. `"26 0519 - Low-Voltage Electrical Power Conductors and Cables"`
- `description` — the section title (e.g. `"Low-Voltage Electrical…"`)
- `current_revision_id` — a **pointer only** (e.g. `"46699486"`); the revision's
  date + attachment are NOT in this row.

Division spread (all 21 present divisions parse cleanly from `number`): 00→6, 01→20,
02→2, 03→5, 04→2, 05→4, 06→11, 07→16, 08→12, 09→14, 10→13, 11→2, 12→5, 14→2, 21→3,
22→10, 23→13, **26→37**, 31→3, 32→5, 33→4.

**The load-bearing finding that shapes the phases:** the **grouped log is free**
(division derives from `number`, no re-sync), but **there is NO attachment/PDF URL
and NO issued date synced** — only the `current_revision_id` pointer. So "Open
PDF ↗" and dates are a **separate, gated re-sync** (Phase 2), then a view+edge-fn
step (Phase 3). This mirrors Drawings exactly: log first (Phase 1), the always-fresh
PDF later (Drawings Phase 3's `drawing-file` edge function).

## Locked product decisions (from the owner, 2026-07-14)
1. **Enrich Specifications next**, following the Drawings-log pattern.
2. **Commit to the full result including the PDF** — plan and build all the way to
   Open PDF, accepting the ⛔ backend re-sync (≈189 per-section Procore GETs, which
   risk a Procore rate-limit cooldown like the commitment line-item pull hit) and a
   spec fresh-URL edge function. (Phases 2–3 carry the ⛔ gates; Phase 1 has none
   beyond the standard view-DDL sign-off.)

## Out of scope / deferred
- **In-app zoom/pan spec viewer** (the Drawings Phase-2 overlay analogue) — deferred.
  v1 of the PDF is **Open PDF ↗ in a new tab** (Drawings Phase-1 parity). Revisit only
  if reading specs in-app is wanted.
- **Spec revision *history*** (prior issues of a section, an addendum/revision picker) —
  deferred. Phase 2 pulls only the **current** revision's date + file. The
  `current_revision_id` is enough for "the section as it stands."
- **Cross-links** (submittal/RFI → the spec section it's submitted against) — a real
  future unlock (submittals carry a spec section), but its own task. Note it; don't build it.
- **Writing back to Procore** — never. Read-only.
- **McKenna / multi-project** — OP III only (only 3051002 synced), like every sibling.

## Data model (DATA_CONTRACT)
A new **reference** shape `Spec` in `src/types.ts` — NOT a court `Item`, never enters
My Court (exactly like `Drawing`/`BudgetLine`). Keep it light; the selector derives
the division group.

```ts
/** One current specification section (Specifications, Phase 1). Reference data —
 *  NOT a court `Item`. Grouped by CSI `division` in the spec log. Phase-3 fields
 *  (`issuedDate`, `pdfUrl`) are null until the detail re-sync lands. */
export interface Spec {
  id: string          // "specs:<sectionId>"
  number: string      // "26 0519"
  title: string       // description (section title)
  division: string    // CSI division code, first token of number: "26"
  issuedDate: string | null // Phase 3 (from the current revision) — null in Phase 1
  pdfUrl: string | null     // Phase 3 (current revision's attachment) — null in Phase 1
}
```

- A Supabase view `sitelines_specs` (`security_invoker=true`, like every sibling
  view) emits these columns out of `procore_specification_sections_master` for
  project 3051002. Phase 1 emits `issued_date`/`pdf_url` as `NULL`; Phase 3 widens it.
- **Keep the UI dumb:** the CSI code→name mapping and the grouping/sort live in the
  selector layer (`src/lib/csiDivisions.ts` + `groupByDivision`), never in the view.
- **Keep specs in `sitelines_items` too.** Specs already appear in `sitelines_items.sql`
  (the `specs:` UNION, status `'Issued'`) so the **command palette** can find them —
  leave that UNION in place (Drawings does the same: own slice AND an items row).

## Build-on inventory (read these fresh before using)
REUSE, do not fork — Specs is a near-clone of Drawings:
- `src/components/views/DrawingsView.tsx` — the collapsible, grouped, searchable log.
  `SpecsView` is this with division sections instead of discipline, and fewer columns
  (Phase 1: number · title; Phase 3 adds Issued + Open PDF). Reuse `TableSearch`,
  `Highlight`, the collapse chevron, the count pill, `sl-hover-row`.
- `src/selectors/index.ts` `groupByDiscipline` + `compareDrawingNumber` — clone as
  `groupByDivision` (bucket by `division`, order divisions by **CSI code ascending**
  — the book's real order, NOT count-desc — and sections by natural number sort).
- `sync/views/sitelines_drawings.sql` — the view template (`security_invoker`,
  `WHERE project_id = 3051002`).
- `src/lib/dataSource.ts` (`SiteData` + `DataSource`) + `src/data/seedSource.ts` +
  `src/data/supabaseSource.ts` — add a `specs: Spec[]` slice (mirror the `drawings`
  wiring: `fetchAll<SpecRow>('sitelines_specs')` + `mapSpec`; a `SPECS` seed fixture).
- `src/state/AppContext.tsx` — `collapsedDisciplines` is the exact precedent for the
  spec log's collapse state; add a parallel `collapsedDivisions: Set<string>` (or
  generalize — but a parallel set is lower-risk and matches the sibling).
- `src/components/layout/MainContent.tsx` + `TOOLS` (`src/data/tools.ts`) + `ViewType`
  (`src/types.ts`) — flip `specs.view` from `'list'` to `'specs'`, add `specs` to
  `ViewType`, register `SpecsView` in the `VIEWS` map.
- **Phase 3 only:** `supabase/functions/drawing-file/index.ts` (the auth-gated
  fresh-URL edge function) + `getSheetUrls` on the DataSource — the spec PDF reuses
  this pattern wholesale (Procore spec attachment URLs expire the same way).
- `sync/procore_pipeline.py` — **Phase 2 only:** `enrich_rfis_with_detail()` is the
  exact model for "fetch a detail per parent, gate on `is not None`, mark synced only
  if all succeed so a partial failure never purges." Spec detail is the same shape.

## Pure logic to extract + unit-test
- `src/lib/csiDivisions.ts` — `csiDivisionName(code: string): string` mapping the
  2-digit CSI MasterFormat division code → its canonical name (`"03" → "Concrete"`,
  `"26" → "Electrical"`, …; unknown code → `"Division <code>"`). Pure, table-driven,
  co-located `.test.ts`.
- `groupByDivision(specs: Spec[]): DivisionGroup[]` in `src/selectors/` — buckets by
  `division`, **divisions ordered by code ascending** (book order), sections by
  natural number sort, id-tiebroken. Pure (no clock, no state); feed it fixtures.
  `DivisionGroup = { code: string; name: string; sections: Spec[] }`.
- `mapSpec(row): Spec` in `src/lib/` (or inline in `supabaseSource` beside `mapDrawing`)
  — trivial shaping; unit-test the division parse (`number.split(' ')[0]`) against a
  couple of real numbers incl. a malformed guard.

## Sub-phasing (ship + verify each)

### Phase 1 — the CSI-division-grouped spec log (no re-sync)
- **Scope:** `sitelines_specs` view (issued/pdf NULL) + `Spec` shape + `mapSpec` +
  `csiDivisions` lib + `groupByDivision` selector + `SpecsView` (clone DrawingsView:
  collapsible divisions in book order, `TableSearch`, `Highlight`, count pill,
  per-row constructed **Open in Procore ↗** — a URL built from the section id, no
  re-sync, verify the pattern by click like Submittals' constructed link) + route
  wiring (tools.ts / ViewType / MainContent) + `collapsedDivisions` on AppState +
  the `specs` slice across `SiteData`/seed/supabase (+ a `SPECS` seed fixture that
  covers several divisions). Leave the `specs:` UNION in `sitelines_items` intact.
- **Approval gates:** ⛔ **present the `sitelines_specs` view SQL and STOP** for owner
  sign-off before applying to Supabase (the standing Supabase-DDL invariant). No
  Procore/credential touch in this phase.
- **Exit criteria:** typecheck + test + build green (absolute-prefix commands below);
  `csiDivisions` + `groupByDivision` + the division parse unit-tested; `:5173`
  click-through in **seed** (divisions collapse/expand, search filters, book order)
  AND **live** logged-in (`VITE_DATA_SOURCE=live`) showing the real 189 sections in
  21 divisions; the register no longer renders the flat `ToolRegisterView`. Stop at
  the phase boundary; don't commit until "Approved."

### Phase 2 — spec current-revision detail sync (⛔ re-sync)
- **Scope:** `sync/procore_pipeline.py`: `enrich_specs_with_detail()` — after the spec
  list fetch, for each section fetch its **current revision** (the section detail /
  `/specification_sections/{id}` or the revision endpoint; **probe the real payload
  first** to confirm where the date + attachment url live) and store `issued/effective
  date` + the current PDF **attachment url** onto the spec master `raw` (gated on the
  `is not None` failure pattern; mark synced only if every fetch succeeded, so a
  partial failure never purges). A migration if a new column/child table is needed
  (prefer enriching `raw` in place — no DDL — like the RFI enrichment).
- **Approval gates:** ⛔ the **Procore pull** — ~189 per-section GETs; scope it and get
  explicit go before running (rate-limit cooldown risk, per the commitment line-item
  pull). ⛔ any migration DDL (present + STOP) — avoid if enriching `raw` suffices.
- **Exit criteria:** the detail is queryable in Supabase; section counts reconcile
  (189 in → 189 enriched, none purged); a spot-check section's stored PDF url resolves.
  Backend-only phase — no app change here.

### Phase 3 — Open PDF ↗ + Issued date in the log (view + edge fn; reuses Phase 2 data)
- **Scope:** widen `sitelines_specs` to emit `issued_date` + `pdf_url` (present the
  view diff + STOP); add an **Issued** column + an **Open PDF ↗** action to `SpecsView`
  (reuse Drawings' `OpenPdf`); a fresh-URL path so the link never 403s on expiry —
  reuse/generalize the `drawing-file` edge function (a `spec-file` sibling or a shared
  fn) + a `getSpecFileUrl(id)` seam mirroring `getSheetUrls` (seed returns the fixture
  url; live invokes the edge fn, Procore secret server-side only).
- **Approval gates:** ⛔ the widened-view DDL (present + STOP). ⛔ deploying an edge
  function (reuses existing Procore secrets — no new-secret gate, but confirm before deploy).
- **Exit criteria:** typecheck + test + build green; `:5173` live click-through opens a
  real spec section PDF in a new tab (and recovers a fresh url if the synced one expired);
  seed still renders (fixture url). Stop; don't commit until "Approved."

## Hard guardrails (do not violate)
- **Views stay derived from state** — `groupByDivision`/`csiDivisions` are pure in the
  selector/lib layer; `SpecsView` owns no state beyond reading AppState. No clock in
  pure fns (specs have no "today" logic anyway).
- **The domain atom is `Item`; `Spec` is a separate light reference shape** — do NOT
  route specs through the court/`Item` path or `ballInCourt.ts` (specs are reference,
  status `'Issued'`, never in My Court). Never introduce a type named `Record`.
- **One token source** (`src/theme/tokens.ts` + `src/index.css`) — division dot colors
  come from existing tokens via a stable hash (copy DrawingsView's `DOTS`/`disciplineColor`);
  no ad-hoc hex.
- **Keep the UI dumb / respect the data seam** — `SpecsView` reads `specs` via
  `useSiteData()`; the seed→Supabase swap needs zero view changes. `supabaseSource`
  must keep paging past the 1000-row cap (`fetchAll`).
- **Overlays** (if Phase 3 ever adds an in-app viewer — out of scope now) render
  `position:fixed` outside the card's `overflow:hidden`.
- **Present all DDL/SQL and STOP** for owner approval before applying to Supabase;
  reuse Procore + Supabase creds via `sync/.env` / `.env.local`, never commit secrets.

## Open decisions
- **Phase 1 row action:** constructed **Open in Procore ↗** (Recommended — gives the
  row a job with no re-sync; verify the URL pattern by click, like the Submittals link)
  vs. non-interactive rows until Phase 3's Open PDF. Low stakes; resolve at Phase 1
  kickoff (plan is written to the recommended default).
- **Phase 2 storage:** enrich `raw` in place (Recommended — no DDL, mirrors RFI detail)
  vs. a new column/child table. Decide after the Phase-2 payload probe.
- **Phase 3 edge function:** a dedicated `spec-file` fn vs. generalizing `drawing-file`
  to take a record type. Decide at Phase 3 (lean: a `spec-file` sibling — lowest blast
  radius on the working Drawings function).

## Verification commands (the exit-criteria gate)
```
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck   # tsc -b (primary gate)
npm --prefix "C:/Users/BUrness/Dev/Sitelines" test            # vitest
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run build       # tsc -b && vite build
```
UI: live `:5173` click-through (start dev server, drive with Playwright; read DOM
state in a SEPARATE call after a click — React re-renders after the tick).
