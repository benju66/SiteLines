# Drawings — log, in-app sheet viewer, and (later) markup (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + the design handoff (`design_handoff_sitelines/`).
> Sibling done: the Record-Detail Enrichment (RFIs + submittals) — this reuses its
> data-seam patterns (`getDetail`, per-tool mappers, `src/lib/detailText.ts`).

## Goal
Turn Drawings from a flat register into a real **drawing log**: sheets grouped by
**discipline** in collapsible sections, with the columns a PM expects (Drawing
Number · Title · Revision · Drawing Date · Received Date · Set · Status). Opening a
sheet shows it **in the app** — a zoomable image of the sheet — with a **revision
picker** to flip between historical issues, plus "Open PDF" / "Open in Procore"
actions. Later, optionally, add **markup/measure** tools.

Everything the log + viewer needs is **already synced** in
`procore_drawing_revisions_master` (346 current sheets across 346 drawings; 1,100
total revisions; 191 drawings have >1 revision). Each revision row carries
`pdf_url`, `png_url`, `thumbnail_url`/`large_thumbnail_url`, and metadata
(`discipline{.name}`, `drawing_set{.name}`, `number`, `title`, `revision_number`,
`drawing_date`, `received_date`, `status`, `width`/`height`). **No re-sync or
pipeline change is needed for the viewer.** Verified live: the full sheet PNG
(6400×4571) renders in an `<img>` in the running app — cross-origin images are not
blocked.

## Out of scope / deferred
- **Markup / measurement / scale / tool-chest / polygon** — a real annotation
  engine. Deliberately its own phase (Phase 4) and its own go/no-go; do NOT build a
  markup engine from scratch. (See Phase 4.)
- **A backend PDF proxy** — needed for robust *PDF* viewing and to fully kill
  signed-URL expiry/CORS. Phase 3. Phases 1–2 deliberately avoid a backend by using
  the **PNG image** (which embeds cross-origin) + the already-synced URLs.
- **Editing/writing back to Procore** (uploading sheets, publishing revisions) — never.
- **Sheet-to-sheet hyperlinks / callout navigation** (Procore "linked drawings") — later.

## The signed-URL caveat (applies to every phase that shows a sheet)
`pdf_url`/`png_url`/`thumbnail_url` are **pre-signed Procore storage URLs** (a `sig=`
token; each redirects to a fresh 60-second S3 link). Tested: a URL synced ~6.5 hours
earlier still resolved — so with a daily sync they're valid all day, but they are not
permanent. v1 (Phases 1–2) accepts this and degrades gracefully (an `onError` on the
image → a "couldn't load — Open in Procore" fallback). Phase 3's proxy removes the
caveat entirely (mint a fresh URL at view-time, server-side).

## Locked product decisions (from the owner)
- Build the Procore-style drawing log: **discipline-grouped, collapsible**, with the
  7 columns above. (2026-07-06)
- **In-app sheet viewing** is wanted (not only a link-out), plus a **per-drawing
  revision dropdown**. (2026-07-06)
- Markup/measure ("Bluebeam-like") is desirable but understood to be a **separate,
  larger, deliberate investment** — keep it decoupled and decide it on its own. (2026-07-06)

## Proposed decisions (confirm at each phase's kickoff — all have a recommended default)
1. **Viewer placement — a dedicated large overlay (Recommended)** vs. the existing
   452px record drawer. Recommended: sheets are large; the record drawer is too
   narrow to view a sheet. Build a new `DrawingViewerOverlay` (near-fullscreen,
   `position:fixed` sibling of the card, same overlay rules as the drawer). The
   drawing log row opens *this*, not the record drawer.
2. **v1 render tech — zoomable PNG `<img>` (Recommended)** vs. embedded PDF.
   Recommended: the PNG embeds cross-origin with no CORS/proxy (verified); an
   embedded cross-origin PDF (iframe/PDF.js) is unreliable (framing + CORS on the
   byte fetch). The **PDF** is offered as an "Open PDF ↗" button (new tab), not embedded.
3. **Drawings data delivery — current sheets in the snapshot, revisions lazy
   (Recommended)** vs. loading all 1,100 revisions eagerly. Recommended: the log
   needs only the 346 current sheets; the picker fetches a drawing's revisions on
   demand via `getDrawingRevisions(drawingId)` (mirrors `getDetail`). Keeps the main
   snapshot light and scales past OP III.
4. **"Discipline" grouping — group by Procore's `discipline.name` verbatim
   (Recommended)**, which includes a few punch/renovation *sets* Procore files under
   discipline (e.g. "PUNCH LIST", "Renovation Set Architectural"). Alternative: hide
   those. Recommended: match Procore 1:1 in v1; add a filter later if noisy.

## Data model (DATA_CONTRACT — keep the UI dumb)
Add to `src/types.ts` (the `Item` atom stays unchanged and untouched):
```ts
export interface Drawing {
  id: string            // item id of the current revision, e.g. "drawings:<revId>"
  drawingId: string     // parent drawing id — groups a sheet's revisions
  number: string        // "A1.1"
  title: string
  discipline: string    // "Architectural" (from discipline.name; "" → "Uncategorized")
  revision: string      // revision_number, e.g. "5"
  drawingDate: string | null   // preformatted display date
  receivedDate: string | null  // preformatted display date
  set: string | null    // drawing_set.name
  status: string        // "published"
  thumbnailUrl: string | null
  pngUrl: string | null
  pdfUrl: string | null
}
export interface DrawingRevision {   // Phase 2, for the picker
  id: string            // this revision's item id
  revision: string
  drawingDate: string | null
  current: boolean
  pngUrl: string | null
  pdfUrl: string | null
}
```
- Supabase views (`security_invoker=true`, over deny-all-RLS masters, migration
  0006 policy already covers `procore_drawing_revisions_master`):
  - `sitelines_drawings` — one row per **current** sheet, the fields above.
  - `sitelines_drawing_revisions` (Phase 2) — one row per revision, keyed by
    `drawing_id`, ordered by `revision_number`.
- `SiteData` gains `drawings: Drawing[]` (loaded in `fetch()`; seed provides a small
  fixture). `DataSource` gains `getDrawingRevisions(drawingId): Promise<DrawingRevision[]>`.

## Pure logic to extract + unit-test
- `groupByDiscipline(drawings): { discipline: string; sheets: Drawing[] }[]` in
  `src/selectors/` (+ `.test.ts`) — stable discipline order (by Procore `position`
  if present, else sheet-count desc then alpha), sheets sorted by `number`
  (natural/human sort so `A2.10` follows `A2.9`). Deterministic; feed fixtures.
- Reuse `src/lib/detailText.ts` helpers (`safeUrl`, date formatting) for URL/date shaping.

## Build-on inventory (read these fresh before using)
REUSE, do not fork:
- `src/components/layout/MainContent.tsx` — the `ViewType → component` router; add
  `drawings` there.
- `src/data/tools.ts` — flip `drawings.view` from `'list'` to `'drawings'`; keep the
  DWG code/label. `src/types.ts` `ViewType` union — add `'drawings'`.
- `src/components/ui/ListTable.tsx` + `primitives.tsx` — reuse the row/badge/pill
  *styling vocabulary*, but the log is its own grouped table (ListTable's grid is
  fixed 6-col). Don't force it into ListTable.
- `src/lib/dataSource.ts` / `src/data/seedSource.ts` / `src/data/supabaseSource.ts` —
  extend the `DataSource` (new slice + `getDrawingRevisions`); `supabaseSource` has
  `fetchAll` (pages past PostgREST's 1000-row cap) + the client.
- `src/state/DataContext.tsx` — expose `getDrawingRevisions` like `getDetail`.
- `src/state/appState.ts` — add drawing UI state (collapsed-discipline set; open
  viewer `{ drawingId, revisionId }`) to the flat `AppState` + `patch()`.
- `src/components/overlays/Backdrop.tsx` + the drawer — the overlay pattern
  (fixed sibling of the card, z-index, Esc-to-close) the viewer reuses.
- `src/theme/tokens.ts` + `src/index.css` — the only color source.

## Sub-phasing (ship + verify each)

### Phase 1 — Drawing log (discipline-grouped table) — no viewer yet
- **Scope:** (a) ⛔ **present + apply** a `sitelines_drawings` view (current sheets;
  fields above) — no re-sync. (b) `Drawing` type + `drawings` slice on `DataSource`
  (seed fixture + `supabaseSource` query) surfaced via `DataContext`. (c) pure
  `groupByDiscipline` + test. (d) `DrawingsView` (new `ViewType 'drawings'`, routed
  in `MainContent`, `drawings.view='drawings'`): collapsible discipline sections
  (counts in the header), columns **Number · Title · Revision · Drawing Date ·
  Received Date · Set · Status**; collapsed/expanded state in `AppState`. Rows show
  an **Open PDF ↗** action (new tab) as the interim "view"; the in-app viewer is
  Phase 2.
- **Approval gates:** ⛔ Supabase view SQL (present, apply) · never touch the Procore
  app registration.
- **Exit criteria:** typecheck + build green; `groupByDiscipline` unit-tested; live
  `:5173` click-through (logged in) — disciplines match Procore's counts, groups
  collapse/expand, all 7 columns render, Open PDF opens the sheet; seed mode renders.

### Phase 2 — In-app sheet viewer + revision picker
- **Scope:** (a) ⛔ `sitelines_drawing_revisions` view + `getDrawingRevisions` on the
  DataSource (seed stub + supabase). (b) `DrawingViewerOverlay` — a large overlay
  (fixed sibling of the card): a **zoomable/pannable PNG** of the sheet
  (scroll/pinch-to-zoom, drag-to-pan; a small self-authored transform is fine — no
  heavy lib), sheet metadata header, a **revision dropdown** (loads revisions lazily,
  labels like "Rev 5 · Mar 4 2026 · current"), **Open PDF ↗** and a constructed
  **Open in Procore** link. Image `onError` → graceful "Open in Procore" fallback
  (the signed-URL caveat). Clicking a log row opens this overlay.
- **Approval gates:** ⛔ Supabase view SQL. No re-sync.
- **Exit criteria:** typecheck + build; open a sheet → zoom/pan works; switching
  revision swaps the sheet + date; Open PDF works; Esc/backdrop closes; seed renders.

### Phase 3 — Fresh-URL edge function — kills sheet-image expiry  ⛔⛔ backend
The first backend piece. Today the viewer loads Procore's pre-signed image URLs
captured at sync time — valid through the working day, but they eventually expire
(the `sig=` token), and the browser carries a Procore-issued token. A small
**Supabase Edge Function** re-mints a fresh URL server-side on demand, so sheets
never go stale and the Procore credential stays off the browser.

**How Procore auth works (settled — from `Notes/research/Procore-API-Integration-Research.md`
§1 and `sync/procore_pipeline.py`):** OAuth2 **Client Credentials + DMSA**. `POST
https://login.procore.com/oauth/token` (`grant_type=client_credentials` +
client_id/secret) → a bearer token, **90-min TTL, no refresh** (request a new one).
Every call needs the `Procore-Company-Id` header. Drawing revisions come from
`GET /rest/v1.0/projects/{project_id}/drawing_revisions` — the response carries
fresh `pdf_url`/`png_url`. So an edge function reproduces exactly what the sync
does, but per-view.

**Proposed design + decisions (confirm at the ⛔⛔ kickoff — all have a default):**
1. **Delivery — a fresh-signed-URL JSON function (Recommended)** vs. a byte-streaming
   proxy. The function verifies the caller, mints a Procore token, GETs the drawing
   revision, and returns fresh `{ pngUrl, pdfUrl }` as JSON; the viewer sets the
   `<img src>` to that fresh URL (the browser fetches the bytes straight from Procore
   storage — the PNG already embeds cross-origin, verified in Phase 2). Kills expiry,
   **zero image bytes through the function**, and sidesteps the fact that an `<img>`
   tag can't send an `Authorization` header. *Byte-streaming* (the function fetches
   and streams the bytes, making them same-origin) is only needed for PDF.js and adds
   egress + latency — **deferred** with PDF.js (decision 4).
2. **Wiring — lazy refresh-on-staleness (Recommended)** vs. always-fresh. The viewer
   shows the synced URL first (fast, no function call); only on the image `onError`
   does it call the function for a fresh URL and retry. Minimizes invocations to
   *only* genuinely-stale sheets (most of the day, the synced URL just works). Add a
   `getSheetUrls(revisionId): Promise<{ pngUrl, pdfUrl }>` on the `DataSource`
   (supabase impl calls the function with the caller's auth header; seed returns the
   fixture URL) surfaced via `DataContext`; the overlay calls it inside its existing
   `onError` fallback before showing the "Open in Procore" message.
3. **Token + secrets (Recommended):** reuse the existing DMSA app registration —
   `PROCORE_CLIENT_ID`/`_SECRET`/`COMPANY_ID` from `sync/.env`; **do NOT create a new
   Procore app.** Store them as **Supabase Edge Function secrets** (server-side env),
   never in the browser bundle. Mint a token per invocation (90-min TTL); optional
   later optimization — cache the token in a Postgres row with expiry.
4. **Caller auth (Recommended):** require the app's **Supabase Auth JWT** (`verify_jwt`)
   so only logged-in Sitelines users can call the function — mirrors the app's login
   gate; the DMSA's permitted-projects list is the platform-level backstop.
5. **True PDF render (PDF.js) — defer (Recommended).** Keep the zoomable PNG. PDF.js
   needs same-origin bytes (the byte-streaming variant) + a ~1 MB lib; fold it into
   Phase 4 (markup needs the PDF anyway) or a small Phase 3b if wanted on its own.

**Cost:** Supabase Edge Functions free tier ≈ 500K invocations/mo; fresh-URL delivery
transfers **no image bytes**, and lazy refresh only fires on a stale sheet — so cost
is negligible for a single-user app. (Byte-streaming would add egress = image size
per view.)

**Compliance (aligned with the research doc):** per-view, authenticated, pass-through;
the function **stores nothing new** and mints the URL on demand — if anything it
*improves* retention posture (the pre-signed URLs need not be persisted at all long
term). No bulk export, no new mirror.

- **⚠️ Verify during build:** the single-revision endpoint
  `GET /rest/v1.0/projects/{project_id}/drawing_revisions/{id}` returns a fresh
  `pdf_url`/`png_url` (vs. having to page the list); the Deno fetch + `Procore-Company-Id`
  header shape; that `verify_jwt` accepts the app's anon-key session token.
- **Approval gates:** ⛔⛔ first backend function + server-side Procore token handling —
  the kickoff **presents this design and STOPs** for the owner's go/no-go before any
  build. Never ship the Procore secret (or a Supabase service-role key) to the browser.
- **Exit criteria:** logged-in, a **deliberately expired** sheet URL still renders
  (the function re-mints it); the function **rejects an unauthenticated caller**; the
  Procore secret exists only as an edge-function secret (never in the bundle);
  typecheck + build green; seed mode unaffected (no function call).

### Phase 4 — Markup & measure engine  ⛔⛔ licensing + product decision (optional)
- **Scope:** integrate a commercial web viewer SDK (**Apryse/PDFTron WebViewer** is
  the construction-grade default; PSPDFKit/Nutrient the alternative) for annotations,
  **measurement + scale calibration**, area/polygon, and **custom tool sets** (≈ a
  tool chest); persist markups (XFDF/JSON) to a new `drawing_markups` table
  (Supabase, per drawing-revision + user, RLS + `authenticated_read`). Depends on
  Phase 3 (the viewer needs same-origin PDF bytes).
- **Approval gates:** ⛔⛔ **explicit go/no-go before any build** — a paid SDK license
  (recurring cost), a multi-week build, and a positioning choice (in-app markup vs.
  leaning on Procore's own markup via the Open-in-Procore link). Present options +
  rough cost; STOP.
- **Exit criteria:** mark up a sheet (measure w/ scale, polygon, a custom tool), save,
  reload → markups persist; performance acceptable on a large sheet.

## Hard guardrails (do not violate)
- Overlays render `position:fixed` OUTSIDE the card's `overflow:hidden` (the viewer
  overlay must follow this — mount in `App.tsx`'s overlay slot like the drawer).
- One token source (`src/theme/tokens.ts` + `src/index.css`); no ad-hoc hex.
- The domain atom stays `Item`; `Drawing`/`DrawingRevision` are additive, and the
  ball-in-court rule (`src/lib/ballInCourt.ts`) is untouched (drawings are reference,
  not court items — they must NOT enter My Court).
- Views derived from flat `AppState` + `patch()`; grouping/formatting live in
  `src/selectors/` (pure), the UI reads via the provider — `supabaseSource` keeps
  `fetchAll` paging; never commit secrets; reuse creds via `sync/.env` / `.env.local`.
- ⛔ Present all Supabase DDL/view SQL and STOP before applying (ref `jxesfirpghwpfmfjlfng`).

## Open decisions
- The four "proposed decisions" above — confirm at each phase's kickoff (all have a
  recommended default; the plan is written to the defaults).
- Whether Phase 1 also **removes drawings from `sitelines_items`** (the old flat
  register) or leaves them for command-palette search. Recommend: leave for now;
  revisit if the palette double-lists them.
- Phase 4 is a genuine fork (build in-app markup vs. rely on Procore's). Not needed
  until Phases 1–3 land.
