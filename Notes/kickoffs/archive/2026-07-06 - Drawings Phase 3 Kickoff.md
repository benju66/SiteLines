# Kickoff — Drawings, Phase 3: the fresh-URL edge function (kills sheet-image expiry)

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — first backend build; server-side Procore secret + correctness in the auth/proxy path. (`/model claude-opus-4-8` first.)
>
> Build **Phase 3 of the Drawings workstream** (a Supabase **edge function** that re-mints a fresh Procore sheet-image URL server-side, so drawing sheets never go stale and the Procore token stays off the browser). The design is **locked** (in the plan + this kickoff) — build to it, do NOT re-litigate it. Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-06 - Drawings Phase 3 Kickoff.md` (this file)
> - `Notes/plans/Drawings-Viewer-Plan.md` (Phase 3) + `PLAN.md` + `Notes/research/Procore-API-Integration-Research.md` (§1 auth, §4 compliance) + `design_handoff_sitelines/README.md`
>
> ⛔ **Prerequisite:** the Procore secret must be set as **Supabase Edge Function secrets** (`PROCORE_CLIENT_ID`/`_SECRET`/`COMPANY_ID`) before you can verify — confirm with me it's set. Never put the Procore secret (or a Supabase service-role key) in the browser bundle. Reuse the existing DMSA app (`sync/.env`); no new Procore app, no re-sync. Verify with typecheck + build + a logged-in `:5173` check (a deliberately-expired URL still renders). Don't commit or push until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What this phase is
Today the viewer ([DrawingViewerOverlay](../../src/components/overlays/DrawingViewerOverlay.tsx))
loads Procore's **pre-signed** image URLs captured at sync time (the `sitelines_drawings` /
`sitelines_drawing_revisions` views). They're valid through the working day but the `sig=`
token eventually expires — a stale one shows the "Open in Procore" fallback instead of the
sheet. Phase 3 adds a small **Supabase Edge Function** that re-mints a fresh `pdf_url`/`png_url`
server-side on demand, so sheets never go stale **and** the Procore credential stays off the
browser. It is a **robustness + security upgrade, not a new feature** — Phases 1–2 work today.

## Design is locked — this is a build session
The owner approved the design on 2026-07-06; **do not re-litigate it.** Build to the locked
decisions (full detail in `Notes/plans/Drawings-Viewer-Plan.md` → Phase 3):
1. **Delivery:** a fresh-signed-URL **JSON** function (verify caller → mint Procore token →
   GET the revision → return fresh `{ pngUrl, pdfUrl }`); the browser fetches the bytes from
   Procore. **No** byte-streaming and **no** PDF.js this phase.
2. **Wiring:** **lazy refresh-on-error** — the viewer shows the synced URL first and only calls
   the function from its image `onError`, then retries once.
3. **Secret:** reuse the DMSA app; the Procore client id/secret live **only** as Supabase Edge
   Function secrets (server-side) — never in the bundle. Mint a token per invocation.
4. **Caller auth:** `verify_jwt` — logged-in Sitelines users only.

The one owner action left is provisioning the secret (below). This is the **first backend
piece** in Sitelines, so keep the auth/proxy path correct and the secret server-side.

## Required reading (fresh — don't trust line numbers)
- `Notes/plans/Drawings-Viewer-Plan.md` → **Phase 3** — the design of record: the 5 **locked**
  decisions, the Procore-auth summary, cost, compliance, exit criteria. This phase = that section.
- `Notes/research/Procore-API-Integration-Research.md` → **§1 Authentication** (Client
  Credentials + DMSA; `POST login.procore.com/oauth/token`; 90-min token, no refresh;
  mandatory `Procore-Company-Id`) and **§4 Compliance** (per-view, authenticated,
  pass-through — no bulk/mirror; the standing boundary).
- `sync/procore_pipeline.py` — the real auth in code: `get_access_token()` (line ~91),
  `get_json()`/headers (line ~162), the drawings pull
  `GET /rest/v1.0/projects/{p_id}/drawing_revisions` (line ~901). The edge function
  reproduces exactly this, per-view. `sync/.env.example` — the secret names
  (`PROCORE_CLIENT_ID`/`_SECRET`, `PROCORE_COMPANY_ID=8906`).
- The viewer + seam already shipped (Phase 2): [DrawingViewerOverlay](../../src/components/overlays/DrawingViewerOverlay.tsx)
  (the `onError` fallback is where lazy refresh hooks in), [dataSource.ts](../../src/lib/dataSource.ts)
  (`getDrawingRevisions` — add `getSheetUrls` beside it), [supabaseSource.ts](../../src/data/supabaseSource.ts),
  [seedSource.ts](../../src/data/seedSource.ts), [DataContext.tsx](../../src/state/DataContext.tsx).
- Supabase Edge Functions basics (Deno; `verify_jwt`; `supabase secrets set`; deploy). The
  Supabase MCP has a `deploy_edge_function` tool; secrets are set out-of-band by the owner.

## Scope (build to the locked design)
1. **Edge function** (e.g. `drawing-file`): `verify_jwt` on (authenticated callers only);
   input = a drawing-revision id (+ kind png/pdf); mints a Procore token (client-credentials,
   cached in-process or a Postgres row w/ TTL), GETs the revision, returns fresh
   `{ pngUrl, pdfUrl }` as JSON. Procore secret read from edge-function env only.
2. **Data seam:** `getSheetUrls(revisionId): Promise<{ pngUrl: string|null; pdfUrl: string|null }>`
   on `DataSource` — supabase impl invokes the function with the caller's session; seed returns
   the fixture URL. Expose via `DataContext`. Keep the UI dumb.
3. **Viewer wiring — lazy refresh-on-error:** in the overlay's image `onError`, call
   `getSheetUrls(selected.id)`, swap in the fresh `pngUrl`, and retry once before falling back
   to the "Open in Procore" message. Normal path is unchanged (synced URL, no function call).
4. **Do NOT** adopt PDF.js / byte-streaming this phase (deferred — decision 5).

## Guardrails / gates
- ⛔ Confirm the Procore secret is set as Supabase Edge Function secrets before building/verifying
  (owner action). The design is **locked** — build to it; don't commit/push until "Approved."
- **Never** ship the Procore secret or a Supabase **service-role** key to the browser — the
  function uses its own server-side env; the browser only ever holds the publishable/anon key.
- Reuse the existing DMSA app registration (`sync/.env`); **do not** create a new Procore app,
  and don't touch the sync pipeline. **No re-sync.**
- Overlays rule / one-token-source / `Item`-is-the-atom / views-derived-from-state all still
  apply. Drawings stay reference-only — `src/lib/ballInCourt.ts` untouched.
- Compliance: per-view, authenticated, pass-through — the function stores no image bytes and
  builds no mirror.

## Exit criteria (the gate)
- `npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck` and `... run build` green;
  any pure logic added is unit-tested (`npm test`).
- Live, logged-in: a **deliberately expired** sheet URL still renders (the function re-mints
  it); the function **rejects an unauthenticated caller**; the Procore secret exists only as an
  edge-function secret (grep the bundle to prove it's absent).
- Seed mode unaffected (no function call; the fixture/SVG still renders).
- Then STOP and report; do not start Phase 4 (markup/measure — its own ⛔⛔ licensing gate).
