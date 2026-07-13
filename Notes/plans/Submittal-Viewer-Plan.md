# Submittal Viewer — open the Final reviewed submittal PDF in-app (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + the design handoff (`design_handoff_sitelines/`).
> Sibling done: the **Drawings viewer + fresh-URL edge function** (Drawings Phases 2–3)
> — this reuses its whole shape: the overlay pattern + the `drawing-file` edge
> function (`supabase/functions/drawing-file/index.ts`). Read that function first;
> the new one is ~90% the same.

## Goal
Today the **"Final reviewed submittal"** row in the record-detail drawer
([`RecordDetailDrawer.tsx`](../../src/components/overlays/RecordDetailDrawer.tsx))
is a plain link to Procore's pre-signed file URL. Because Procore serves that file
as an *attachment*, clicking it **downloads** the PDF instead of showing it. When
this is done, clicking the row opens the stamped PDF **inside Sitelines** — a large
overlay rendering the browser's own PDF viewer — with no download. A small
"Download / Open in Procore" action stays as a fallback.

**Why it can't be a one-line fix:** an `<iframe>` pointed straight at Procore's URL
downloads for the same reason the link does (attachment header), and the browser
can't `fetch()` the bytes directly (Procore storage sends no CORS header). So the
PDF must pass through a small server function of ours — a **byte-streaming proxy** —
that re-serves it inline and same-origin-safe. That function is the real work; the
viewer is a thin iframe on top of it.

## Locked product decisions (from the owner, 2026-07-13)
- **Two short phases** — the proxy function first (verify it returns the PDF), then
  the viewer overlay. Approve/deploy the backend before the UI. (Mirrors Drawings.)
- **v1 scope = the Final reviewed submittal only.** The originally-submitted
  **Attachments** list stays as plain download links (re-opened far less often;
  extend later if wanted).
- **Keep a fallback.** The in-app viewer is the default click, but a small
  **Download** + **Open in Procore ↗** stays for huge files, odd file types, or if
  the proxy can't render the PDF.

## Locked engineering decisions (recommended + confirmed in planning)
- **Re-mint a fresh URL server-side, then stream — do NOT accept a URL from the
  browser.** The function takes the submittal's **seam id** (`submittals:<id>`),
  mints a Procore token (same DMSA flow as `drawing-file`), GETs the submittal
  detail, extracts the latest final attachment URL, then fetches *those* bytes and
  streams them back inline. Deriving the URL server-side (a) never goes stale and
  (b) avoids an **open-proxy / SSRF hole** (a client-supplied URL would let anyone
  make our function fetch anything). Allowlist the upstream host as defense-in-depth.
- **No new secrets gate.** `PROCORE_CLIENT_ID` / `_SECRET` / `COMPANY_ID` are
  **already** set as edge-function secrets on the Supabase project (`drawing-file`
  uses them). The only ⛔ backend step is **deploying** the new function.
- **The iframe renders a blob, not a remote URL.** The frontend fetches the bytes
  (authenticated) → `Blob` → `URL.createObjectURL()` → `<iframe src={objectUrl}>`.
  The browser's built-in PDF viewer renders it. (So the disposition header is belt-
  and-suspenders; the blob URL renders by MIME type regardless.) Revoke the object
  URL on close.

## Out of scope / deferred
- **A custom PDF renderer (PDF.js) / zoom-pan / markup** — the browser's native PDF
  viewer is enough for reading a stamped approval doc. (This is the "B-full" option
  we deliberately did not pick.) If in-app markup is ever wanted it rides the same
  deferred track as Drawings Phase 4.
- **The originally-submitted Attachments** opening in-app (v1 scope decision above).
- **Non-PDF final docs** — final reviewed submittals are effectively always PDFs.
  If the upstream `Content-Type` isn't a browser-renderable type, the overlay
  degrades to the Download / Open-in-Procore fallback rather than iframing it.
- **McKenna / multi-project** — the views + `drawing-file` already hardcode project
  `3051002` (OP III); the new function does the same. Not a multi-project feature yet.

## Where the data comes from (already synced — no pipeline change)
The pipeline (`sync/procore_pipeline.py`) captures the final doc into the submittal
`raw` as `final_reviewed_submittal` (`enrich_submittals_with_final` /
`_latest_final_attachments`): it GETs `/rest/v1.1/projects/{project_id}/submittals/{id}`
and takes the **latest** `distributed_submittals[].final_attachments[]` as a small
`{name, url}` list. `sitelines_submittal_detail.sql` surfaces it as `final_submittal`,
and [`mapSubmittalDetail.ts`](../../src/lib/mapSubmittalDetail.ts) maps it to
`ItemDetail.finalSubmittal: ItemAttachment[]`. **The edge function reproduces exactly
that one Procore call**, per-view, to get a fresh URL — the server-side analog of
what `drawing-file` does for `drawing_revisions/{id}`.

## Data seam (keep the UI dumb)
- **`DataSource` gains one method** ([`src/lib/dataSource.ts`](../../src/lib/dataSource.ts)):
  ```ts
  /**
   * Fetch the FINAL reviewed submittal PDF bytes for a submittal (the in-app
   * viewer calls this on open, keyed by the submittal's seam id "submittals:<id>").
   * Live source invokes the `submittal-file` edge function (mints a fresh Procore
   * URL server-side, streams the bytes inline); seed returns null (no backend
   * offline → the viewer shows its Open-in-Procore fallback). Rejects on read error.
   */
  getFinalSubmittalFile(id: string): Promise<Blob | null>
  ```
  - `supabaseSource`: `client.functions.invoke('submittal-file', { body: { id } })`
    — supabase-js parses an `application/pdf` response as a `Blob`; return it (null on error/empty).
  - `seedSource`: return `null` (parity stub, like `getSheetUrls`).
  - Surface it through [`DataContext.tsx`](../../src/state/DataContext.tsx) like `getSheetUrls`.
- **`AppState` gains** ([`src/state/appState.ts`](../../src/state/appState.ts)):
  `submittalViewer: { id: string; name: string; downloadUrl?: string; procoreUrl?: string } | null`
  (default `null`) — the open viewer overlay + its fallback links.

## Pure logic to extract + unit-test
This feature is light on new *pure* logic (the URL extraction lives in the Deno
function, which the vitest gate doesn't cover — it's verified by invoking it).
Optionally extract a tiny pure `isInlineRenderable(contentType: string): boolean`
(true for `application/pdf` and image types) in `src/lib/` with a co-located
`.test.ts`, used to decide viewer-vs-fallback. Everything else (blob lifecycle,
overlay state) is inherently effectful — don't force it into a pure fn.

## Build-on inventory (read these fresh before using — do NOT fork)
- [`supabase/functions/drawing-file/index.ts`](../../supabase/functions/drawing-file/index.ts)
  — **the template for the new function.** Reuse verbatim: CORS block, `getProcoreToken`
  (+ in-process cache + 401 retry), `jwtRole` auth-gate (the `verify_jwt`-also-admits-
  the-publishable-key gotcha), the Procore endpoints/headers. Change only: the
  endpoint (submittal detail, **v1.1**), the extraction (latest final attachment),
  and the response (stream bytes inline, not JSON).
- [`src/components/overlays/DrawingViewerOverlay.tsx`](../../src/components/overlays/DrawingViewerOverlay.tsx)
  + [`Backdrop.tsx`](../../src/components/overlays/Backdrop.tsx) — the large-overlay
  shell, keyed-by-id remount, Esc/backdrop close, loading + onError fallback pattern.
  The new overlay is this minus the zoom/pan engine, plus an `<iframe>`.
- [`src/App.tsx`](../../src/App.tsx) — mount the new overlay in the **overlay slot**
  (fixed sibling of the card), exactly like `DrawingViewerOverlay`.
- [`RecordDetailDrawer.tsx`](../../src/components/overlays/RecordDetailDrawer.tsx)
  (the Final-reviewed-submittal block, ~line 220) — swap the `<a download link>` for
  a button that opens the viewer; keep the synced url + `thread.procoreUrl` as the
  overlay's fallback links.
- One token source (`src/theme/tokens.ts` + `src/index.css`); the domain atom stays
  `Item`; views derive from flat `AppState` + `patch()`.

## Sub-phasing (ship + verify each)

### Phase 1 — `submittal-file` byte-streaming edge function + data seam  ⛔ deploy gate
- **Scope:** (a) `supabase/functions/submittal-file/index.ts` — copy `drawing-file`;
  keep the auth-gate + token mint; GET `/rest/v1.1/projects/{PROJECT_ID}/submittals/{submittalId}`;
  extract the latest `distributed_submittals[].final_attachments[0].url` (mirror
  `_latest_final_attachments`); **allowlist the upstream host**, GET the bytes, and
  return `new Response(upstream.body, { headers: { ...CORS, 'Content-Type': <upstream or application/pdf>, 'Content-Disposition': 'inline; filename="…"' } })` — **stream, don't buffer** the whole PDF. Errors → JSON `{error}` (the overlay falls back).
  (b) `getFinalSubmittalFile(id)` on the `DataSource` (`supabaseSource` invokes the
  function → Blob; `seedSource` returns null); expose via `DataContext`.
- **Approval gates:** ⛔ **deploying** the edge function to the Supabase project
  (`jxesfirpghwpfmfjlfng` / project `sitelines-sync`) — present + get "Approved"
  before deploy. No new secrets (already set). Never put the Procore secret in the
  bundle. Don't commit/push until owner says "Approved."
- **⚠️ Verify during build:** that the submittal **detail** GET (v1.1) returns
  `distributed_submittals[].final_attachments[]` with a usable URL for a submittal
  that has a final doc (pick a known one from the live `sitelines_submittal_detail`);
  that streaming the upstream `res.body` through works and preserves the PDF; that
  `verify_jwt` + the `authenticated`-role check admits a logged-in session and
  **rejects** the publishable key / unauthenticated caller.
- **Exit criteria:** typecheck + build green; invoking `submittal-file` with a real
  `submittals:<id>` (logged-in session token) returns **200 + `Content-Type:
  application/pdf` inline bytes**; an unauthenticated call returns **401**; seam
  method wired (seed returns null). No overlay yet.

### Phase 2 — `SubmittalViewerOverlay` + open-from-row wiring
- **Scope:** (a) `AppState.submittalViewer` + `patch()`. (b)
  `src/components/overlays/SubmittalViewerOverlay.tsx` — a large overlay (fixed
  sibling of the card, mounted in `App.tsx`, Backdrop + Esc/backdrop close, keyed by
  id): on open call `getFinalSubmittalFile(id)` → `URL.createObjectURL(blob)` →
  `<iframe src={objectUrl} title={name}>`; **loading** state while fetching;
  **error/fallback** state (Download + "Open in Procore ↗") on null/throw; **revoke**
  the object URL on close/unmount. (c) In `RecordDetailDrawer`, the Final-reviewed-
  submittal row becomes a button that `patch({ submittalViewer: { id: r.id, name,
  downloadUrl: a.url, procoreUrl: thread.procoreUrl } })`; keep a small download
  affordance per the fallback decision.
- **Approval gates:** overlay MUST render outside the card's `overflow:hidden`
  (fixed sibling in `App.tsx`'s slot) — a clipped overlay is invisible. Don't
  commit/push until owner says "Approved."
- **Exit criteria:** typecheck + build green; **live `:5173` click-through (logged
  in):** open a submittal that has a final doc → click the row → the stamped PDF
  renders **in-app, no download**; Download + Open-in-Procore fallback work; Esc /
  backdrop close and the object URL is revoked; seed mode shows the graceful
  fallback (no backend offline); a submittal with **no** final doc doesn't show the
  row (unchanged). Optional `isInlineRenderable` unit-tested if extracted.

## Hard guardrails (do not violate)
- Overlays render `position:fixed` **outside** the card's `overflow:hidden` — mount
  in `App.tsx`'s overlay slot like `DrawingViewerOverlay`.
- The Procore secret lives **only** as an edge-function secret — never in the browser
  bundle. Don't accept a fetch URL from the client (SSRF); derive it server-side.
- One token source (`src/theme/tokens.ts` + `src/index.css`); no ad-hoc hex.
- The domain atom stays `Item`; the ball-in-court rule (`src/lib/ballInCourt.ts`) is
  untouched (this is a reference/view action, not a court item).
- Views derived from flat `AppState` + `patch()`; the UI reads data via the provider
  (`useData`/`getFinalSubmittalFile`) — never import the client into a component.
- ⛔ Deploying the edge function stops for owner "Approved"; never commit/push before it.

## Open decisions
- None load-bearing. Minor, decide in-build: whether to also swap the originally-
  submitted **Attachments** to the viewer (deferred by the v1 scope decision — leave
  as links); exact fallback affordance placement (row vs. inside the overlay).
