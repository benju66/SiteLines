# Kickoff — Submittal Viewer, Phase 1: `submittal-file` byte-streaming edge function + data seam

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · xhigh** — security-sensitive auth + SSRF-safe proxy; well-specified but correctness-critical. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` mid-session (`/model claude-fable-5`) only if genuinely stuck.
>
> Implement **Phase 1 of the Submittal Viewer** (a byte-streaming edge function that streams the Final reviewed submittal PDF inline + the data-seam method). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-13 - Submittal Viewer Phase 1 Kickoff.md` (this file)
> - `Notes/plans/Submittal-Viewer-Plan.md` (the plan-of-record) + `PLAN.md` (Submittal Viewer table) + `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
> - `supabase/functions/drawing-file/index.ts` — the function this one is copied from
>
> Build **only Phase 1** (function + seam — no overlay yet). **⛔ Do NOT deploy the edge function until I say "Approved"** — present the code first. Never accept a fetch URL from the client (derive it server-side; allowlist the host). Verify by invoking the function + typecheck + build. Don't commit or push until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What you're building & why
The **"Final reviewed submittal"** row in the record drawer currently links straight
to Procore's pre-signed file URL, which **downloads** the PDF (Procore serves it with
an attachment header). The end goal (Phase 2) is to open that PDF **inside Sitelines**.
That's impossible from the browser directly — an `<iframe>` at Procore's URL still
downloads (attachment header) and a `fetch()` of the bytes is CORS-blocked. So the PDF
must pass through **our** small server function that re-mints a fresh URL server-side,
fetches the bytes, and streams them back **inline**. **This phase builds that function
+ the data-seam method only.** The viewer overlay is Phase 2.

## Required reading (fresh — do not trust line numbers in docs)
1. `Notes/plans/Submittal-Viewer-Plan.md` — the plan-of-record (goal, locked decisions, seam shape, exit criteria).
2. `supabase/functions/drawing-file/index.ts` — **the template.** The new function is ~90% this.
3. `sync/procore_pipeline.py` — read `enrich_submittals_with_final` + `_latest_final_attachments` (~lines 506–557) and the submittals pull (~line 947). This is the exact Procore call + extraction to reproduce server-side.
4. `sync/views/sitelines_submittal_detail.sql` — how `final_submittal` is surfaced (to pick a known-good test submittal id).
5. `src/lib/dataSource.ts`, `src/data/supabaseSource.ts`, `src/data/seedSource.ts`, `src/state/DataContext.tsx` — where the seam method goes.

## Scope (Phase 1 only)
1. **`supabase/functions/submittal-file/index.ts`** — copy `drawing-file` and keep verbatim: the CORS block, `getProcoreToken` (+ in-process cache + 401-retry), and the `jwtRole` auth-gate (the `verify_jwt`-also-admits-the-publishable-key gotcha → require role `authenticated`). Change only:
   - Endpoint: `GET {BASE_API_URL}/rest/v1.1/projects/{PROJECT_ID}/submittals/{submittalId}` (note **v1.1**, and it's the *detail* GET). `PROJECT_ID` default `3051002` (same as `drawing-file`).
   - Input: `{ id: "submittals:<id>" }` → strip the `submittals:` prefix → validate it's a positive integer (reject otherwise, like `drawing-file`'s `revisionId`).
   - Extraction: from the response, take the **latest** `distributed_submittals[]` that has a non-empty `final_attachments[]`, then that entry's first attachment `url` (+ `name`, and its `content_type`/filename if present). Mirror `_latest_final_attachments`. If there is none → `{ error: 'no_final' }` 404.
   - **SSRF guard:** the URL is derived from Procore's response, NOT from the client. Before fetching it, **allowlist the host** (Procore / its storage domain, e.g. `*.procore.com` / the S3-style storage host you observe) — reject anything else. Never fetch a client-supplied URL.
   - Response: `GET` the attachment URL, then `return new Response(upstream.body, { headers: { ...CORS, 'Content-Type': <upstream content-type or 'application/pdf'>, 'Content-Disposition': 'inline; filename="…"' } })`. **Stream `upstream.body` — do not buffer the whole PDF into memory.** On any failure return a JSON `{error}` (the Phase-2 overlay falls back to Open-in-Procore).
2. **`getFinalSubmittalFile(id: string): Promise<Blob | null>`** on the `DataSource` interface (`src/lib/dataSource.ts`, with a doc comment like `getSheetUrls`):
   - `supabaseSource`: `const { data, error } = await client.functions.invoke('submittal-file', { body: { id } })` — supabase-js parses an `application/pdf` response as a `Blob`. Return `data as Blob` (null on error / non-Blob). Throw only on an actual transport error, matching the other seam methods.
   - `seedSource`: return `null` (parity stub — the Phase-2 overlay shows its fallback offline).
   - Expose through `DataContext.tsx` exactly like `getSheetUrls` (callback + value memo).

## ⚠️ Verify during build
- The submittal **detail** GET (v1.1) actually returns `distributed_submittals[].final_attachments[]` with a usable URL — pick a submittal that has a final doc from the live `sitelines_submittal_detail` view (`final_submittal` non-empty).
- Streaming `upstream.body` through the `Response` preserves the PDF (open the returned bytes and confirm it's a valid PDF).
- The auth-gate admits a logged-in session token and **rejects** the publishable key and an unauthenticated call.

## ⛔ Approval gates / guardrails
- **Do NOT deploy the function until the owner says "Approved."** Present the code first. (Deploy target: Supabase project `jxesfirpghwpfmfjlfng`, functions app `sitelines-sync`, alongside `drawing-file`.)
- **No new secrets** — `PROCORE_CLIENT_ID`/`_SECRET`/`COMPANY_ID` are already set as edge-function secrets. Never put the Procore secret in the browser bundle.
- **Never accept a fetch URL from the client** (SSRF) — derive it server-side, allowlist the host.
- Don't commit or push until the owner says "Approved."

## Exit criteria (the gate)
- `npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck` and `... run build` green.
- Invoking `submittal-file` with a real `submittals:<id>` (logged-in session token) → **200 + `Content-Type: application/pdf` inline bytes** that open as a valid PDF.
- An unauthenticated / publishable-key call → **401**; a submittal with no final doc → **404 `no_final`**.
- `getFinalSubmittalFile` wired through the seam + `DataContext` (seed returns null); `npm test` green.
- **Stop at the phase boundary** — no overlay, no commit/push until "Approved." Phase 2 (the `SubmittalViewerOverlay` + open-from-row wiring) is the next kickoff.
