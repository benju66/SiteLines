# Kickoff — Specifications, Phase 1: the CSI-division-grouped spec log

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — new view + data seam + pure selectors, correctness-critical. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` mid-session (`/model claude-fable-5`) only if genuinely stuck.
>
> Implement **Phase 1 of Specifications** (turn the flat Specs register into a collapsible, searchable **spec log grouped by CSI division**). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-15 - Specifications Phase 1 Kickoff.md` (this file)
> - `Notes/plans/Specifications-Plan.md` (the workstream plan-of-record)
> - `PLAN.md` (the Specifications workstream rows) + `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase 1** (no re-sync; PDF + dates are Phases 2–3). ⛔ **Present the `sitelines_specs` view SQL and STOP for my approval before applying it to Supabase.** Verify with typecheck + test + build + a `:5173` click-through (seed AND live). Don't commit or push until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What you're building
Specifications is currently a **bare, flat 189-row register** (`ToolRegisterView`,
number + description + an "Issued" pill). Rebuild it as the **spec book**: 189 sections
grouped into their **CSI MasterFormat divisions** (00, 01, 02, 03 … 33), each division
collapsible, searchable, showing section number + title — the exact structure of
`DrawingsView`, but grouped by division instead of discipline. This is a **near-clone of
Drawings**; read `DrawingsView.tsx` + `groupByDiscipline` first and mirror them.

**No re-sync in this phase.** The division is derivable from the section `number` (its
first token), so the whole grouped log is built from data already in Supabase. The real
PDF + issued dates need a gated Procore re-sync — that's Phases 2–3, NOT now.

## Required reading (in this order, re-read the real files — don't trust line numbers)
1. `Notes/plans/Specifications-Plan.md` — the full plan (data findings, the `Spec`
   shape, the pure logic to extract, all three phases). **This is your spec.**
2. `src/components/views/DrawingsView.tsx` — the view you're cloning.
3. `src/selectors/index.ts` — `groupByDiscipline` + `compareDrawingNumber` (clone as
   `groupByDivision`; note the ordering change below).
4. `sync/views/sitelines_drawings.sql` — the view template.
5. `src/lib/dataSource.ts` (`SiteData` + `DataSource`), `src/data/seedSource.ts`,
   `src/data/supabaseSource.ts` — the slice-wiring pattern (`drawings` is your model).
6. `src/data/tools.ts`, `src/components/layout/MainContent.tsx`, `src/types.ts`
   (`ViewType`), `src/state/AppContext.tsx` (`collapsedDisciplines`) — the routing +
   collapse-state precedents.

## Scope (Phase 1 only)
- **Pure logic (test these):**
  - `src/lib/csiDivisions.ts` — `csiDivisionName(code)` → canonical CSI division name
    (`"03"→"Concrete"`, `"26"→"Electrical"`, unknown → `"Division <code>"`). Table-driven.
  - `groupByDivision(specs): DivisionGroup[]` in `src/selectors/` — bucket by division;
    **divisions ordered by code ASCENDING (book order — NOT count-desc like drawings)**;
    sections by natural number sort, id-tiebroken. `DivisionGroup = { code, name, sections }`.
  - The division parse (`number.split(' ')[0]`) with a malformed-number guard.
- **Data seam:** add `Spec` to `src/types.ts` (per the plan — carry `issuedDate`/`pdfUrl`
  as `string | null`, both `null` this phase); a `specs: Spec[]` slice on `SiteData`;
  `mapSpec` + `fetchAll<SpecRow>('sitelines_specs')` in `supabaseSource`; a `SPECS` seed
  fixture in `src/data/` covering several divisions; wire both sources.
- **View:** `src/components/views/SpecsView.tsx` — clone `DrawingsView`'s structure
  (collapsible sections, `TableSearch`, `Highlight`, count pill, dot color via a stable
  hash off existing tokens). Columns: **section number · title**. Each row gets a
  constructed **Open in Procore ↗** link (build from the section id — verify the URL
  pattern by clicking one, like the Submittals constructed link; if unsure of the
  pattern, leave rows non-interactive and flag it — do not guess a broken URL).
- **Routing/state:** `specs.view` `'list'→'specs'` in `tools.ts`; add `'specs'` to
  `ViewType`; register `SpecsView` in `MainContent`'s `VIEWS`; add
  `collapsedDivisions: Set<string>` to `AppState` (mirror `collapsedDisciplines`).
- **Leave `sitelines_items.sql`'s `specs:` UNION in place** — the command palette needs
  specs to stay searchable there (Drawings does the same: own slice AND an items row).

## The ⛔ gate (do not blow past)
Present the **`sitelines_specs` view SQL and STOP** for the owner's approval before
applying it to Supabase (the standing Supabase-DDL invariant). Emit `issued_date` and
`pdf_url` as `NULL` in this phase — Phase 3 widens the view. `security_invoker=true`,
`WHERE project_id = 3051002`, mirror `sitelines_drawings.sql`.

## Exit criteria (the gate that closes the phase)
- `npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck` — green (primary gate)
- `npm --prefix "C:/Users/BUrness/Dev/Sitelines" test` — green (`csiDivisions` +
  `groupByDivision` + division-parse tests added, co-located `.test.ts`)
- `npm --prefix "C:/Users/BUrness/Dev/Sitelines" run build` — green
- `:5173` click-through in **seed** (`VITE_DATA_SOURCE` unset/seed): divisions render in
  book order, collapse/expand works, search filters within/across divisions, count pill
  updates. Drive with Playwright; read DOM state in a **separate** call after each click.
- `:5173` click-through **live** logged-in (`VITE_DATA_SOURCE=live`): the real **189
  sections in 21 divisions** render; the flat `ToolRegisterView` no longer shows for Specs.
- Stop at the phase boundary. **Do not commit or push until the owner says "Approved."**

## Guardrails specific to this phase
- `Spec` is a **light reference shape, NOT an `Item`** — never route it through
  `ballInCourt.ts` or the court path (specs are reference, never in My Court). Never
  introduce a type named `Record`.
- Grouping/naming/sorting live in the **pure selector/lib layer**; `SpecsView` owns no
  state beyond reading AppState. No clock in pure fns.
- One token source — division dot colors from existing tokens via a stable hash (copy
  DrawingsView's `DOTS`/`disciplineColor`); no ad-hoc hex.
- `SpecsView` reads `specs` via `useSiteData()`; the seed→Supabase swap needs zero view
  changes. `supabaseSource` keeps paging past the 1000-row cap (`fetchAll`).
