# Kickoff — Drawings, Phase 1: the discipline-grouped drawing log

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — new view surface + data-seam slice + a ⛔ DB gate; correctness in the grouping selector. (`/model claude-opus-4-8` first.)
>
> Implement **Phase 1 of the Drawings workstream** (a Procore-style, discipline-grouped, collapsible **drawing log** — no in-app viewer yet). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-06 - Drawings Phase 1 Kickoff.md` (this file)
> - `Notes/plans/Drawings-Viewer-Plan.md` (Phase 1) + `PLAN.md` + `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
> - Design reference (the target look): the "Sitelines · Drawings design reference" artifact — Screen 1, the drawing log.
>
> Build **only Phase 1**. ⛔ Present the `sitelines_drawings` view SQL and STOP for my approval before applying to Supabase (ref `jxesfirpghwpfmfjlfng`); no re-sync is needed (drawing data is already synced); don't touch the Procore app registration (reuse `sync/.env`). Verify with typecheck + build + tests + a `:5173` click-through (logged in). Don't commit or push until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What this phase is
Replace the Drawings tool's generic list register with a dedicated **`DrawingsView`**:
sheets grouped by **discipline** in **collapsible** sections, each header showing a
count, with the columns **Drawing Number · Drawing Title · Revision · Drawing Date ·
Received Date · Set · Status**. Rows expose an **Open PDF ↗** action (opens the sheet
in a new tab) as the interim "view" — the in-app zoomable viewer + revision picker is
**Phase 2**, not this phase. Match Screen 1 of the design-reference artifact.

## The finding you're acting on (already verified)
All of it is already synced in `procore_drawing_revisions_master` — **no re-sync, no
pipeline change.** 346 current sheets; each current revision row has `pdf_url`,
`png_url`, `thumbnail_url`, and metadata: `discipline` (an object → `.name`),
`drawing_set` (→ `.name`), `number`, `title`, `revision_number`, `drawing_date`,
`received_date`, `status` (all `published`). Live discipline counts (must match):
Architectural 63 · Structural 24 · Mechanical 24 · Electrical 18 · Low Voltage 12 ·
General 12 · Civil 9 · Landscape 5 · plus a few punch/renovation sets Procore files
under discipline (group them verbatim in v1).

## Required reading (fresh — don't trust line numbers)
- `Notes/plans/Drawings-Viewer-Plan.md` — the plan-of-record (Phase 1 scope, the 4
  proposed decisions, the `Drawing` shape, guardrails). This phase = its Phase 1 only.
- `src/components/layout/MainContent.tsx` — the `ViewType → component` router (add
  `drawings`). `src/types.ts` — add `'drawings'` to `ViewType` + the `Drawing` type.
  `src/data/tools.ts` — flip `drawings.view` `'list'`→`'drawings'`.
- `src/lib/dataSource.ts` / `src/data/seedSource.ts` / `src/data/supabaseSource.ts` —
  the `DataSource` seam; add a `drawings: Drawing[]` slice to `SiteData` + the fetch
  (seed fixture + a `sitelines_drawings` query). `supabaseSource` has `fetchAll`
  (pages past PostgREST's 1000-row cap). `src/state/DataContext.tsx` exposes it.
- `src/components/ui/ListTable.tsx` + `primitives.tsx` — reuse the styling vocabulary
  (badge, pill, mono, tokens) but the log is its OWN grouped table (ListTable's grid
  is fixed 6-col; don't force it). `src/theme/tokens.ts` — the only color source.
- `src/state/appState.ts` — add collapsed-discipline UI state to the flat `AppState`.
- The `sitelines_submittal_detail.sql` view + `mapSubmittalDetail.ts` (just shipped) —
  the current pattern for a `security_invoker` view + a pure mapper.

## Scope (build)
1. ⛔ **Supabase view** (present SQL, STOP): `sitelines_drawings` (`security_invoker=true`)
   over `procore_drawing_revisions_master` where `(raw->>'current')::boolean`, project
   3051002 — emitting `id` (`'drawings:'||raw->>'id'`), `drawing_id`, `number`, `title`,
   `discipline` (`raw#>>'{discipline,name}'`), `revision` (`raw->>'revision_number'`),
   `drawing_date`, `received_date`, `set` (`raw#>>'{drawing_set,name}'`), `status`,
   `thumbnail_url`, `png_url`, `pdf_url`. Apply after approval; **no re-sync**.
2. **Data seam:** `Drawing` type (plan's shape); `drawings` on `SiteData`; `fetch()`
   loads it (seed fixture + `fetchAll('sitelines_drawings')` → mapper); expose via
   `DataContext`. Keep the UI dumb — a pure mapper shapes rows (reuse
   `src/lib/detailText.ts` for date/url shaping).
3. **Pure selector + test:** `groupByDiscipline(drawings)` in `src/selectors/`
   (+ `.test.ts`) — stable discipline order (sheet-count desc, then alpha) and sheets
   sorted by `number` with a **natural/human sort** (so `A2.10` follows `A2.9`).
   Deterministic; feed fixtures.
4. **View:** `DrawingsView` (`ViewType 'drawings'`, routed in `MainContent`,
   `drawings.view='drawings'`): collapsible discipline groups (chevron + discipline
   dot + name + count), the 7 columns, an Open-PDF affordance per row (a real `<a
   target="_blank" rel="noopener noreferrer">` to `pdf_url`). Collapsed/expanded state
   lives in `AppState` (default: all expanded, or first-open — your call, note it).
   Match the design-reference artifact's density/tokens.

## Guardrails / ⛔ gates
- ⛔ **Present the view SQL and STOP** before applying (ref `jxesfirpghwpfmfjlfng`).
  **No re-sync** — the data is already there.
- ⛔ Do NOT touch the Procore app registration — reuse `sync/.env`.
- Drawings are **reference, not court items** — they must NOT enter My Court; do not
  touch `src/lib/ballInCourt.ts`. `Item` stays the atom; `Drawing` is additive.
- One token source; overlays rule N/A this phase (no overlay yet); views derived from
  `AppState`; `supabaseSource` keeps `fetchAll`; never commit secrets.
- Seed mode (`VITE_DATA_SOURCE=seed`) must still render `DrawingsView` from a small
  fixture. Live mode is behind login (`ben@sitelines.local`).

## Exit criteria (the gate)
- `npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck` and `... run build` green.
- `groupByDiscipline` unit-tested (`npm test`), deterministic.
- `:5173` live click-through (logged in): the Drawings nav opens the grouped log;
  discipline counts match the numbers above; groups collapse/expand; all 7 columns
  render; Open PDF opens the sheet in a new tab; seed mode still renders.
- Then STOP and report; do NOT start Phase 2 (the in-app viewer + revision picker).
