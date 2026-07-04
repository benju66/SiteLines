# Kickoff — Record Detail Enrichment, Phase 1: RFIs (real request + responses)

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — pipeline + schema + app slice, correctness-critical, with a ⛔ DB gate. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` mid-session (`/model claude-fable-5`) only if genuinely stuck.
>
> Implement **Phase 1 of Record Detail Enrichment** (make the RFI detail drawer show the real Request + Responses thread, pulled from Procore's RFI detail endpoint). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-04 - Record Detail Enrichment Phase 1 Kickoff.md` (this file)
> - `Notes/plans/Record-Detail-Enrichment-Plan.md` (Phase 1) + `PLAN.md` + `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase 1 (RFIs)**. ⛔ Present all Supabase DDL/view SQL and STOP for my approval before applying; do NOT touch the Procore app registration (reuse `sync/.env`). Verify with typecheck + build + a `:5173` live click-through (logged in). Don't commit or push until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What this phase is
The RFI detail drawer (`src/components/overlays/RecordDetailDrawer.tsx`) currently shows
a **generated placeholder** Description + fake ball-in-court history + fake attachments.
Make it show the **real** RFI **Request** (the question narrative) and **Responses**
(each answer: text, who wrote it, when, and whether it's the *official* answer). RFIs
only this phase; submittals + punch are Phase 2.

## The core finding you're acting on (already verified live)
- We sync the RFI **list** endpoint into `procore_rfis_master`. Its `questions[]` only
  carry `{body, id}` — **no answers**. The current pipeline also *flattens* `questions`
  to a body-only string (`clean_rfi_assignees_and_ball_in_court`) and discards structure.
- The RFI **detail** endpoint `GET /rest/v1.0/projects/{id}/rfis/{id}` returns
  `questions[].answers[]`, each with `plain_text_body`/`rich_text_body`, `official`
  (bool), `answer_date`, `created_by`, `attachments` — plus `instructions`,
  `proposed_solution`, `distribution_list`, linked drawing/change-event/correspondence
  ids, `accepted`, `ball_in_court_role`.
- So: fetch the detail **per RFI** (~104 for OP III, +2–3 min with jitter), preserve the
  thread, and surface request + responses. Defer attachments + cross-links (Plan §Out of scope).

## Required reading (fresh — don't trust line numbers)
- `Notes/plans/Record-Detail-Enrichment-Plan.md` — the plan-of-record (Phase 1 scope,
  the 3 "proposed decisions" to confirm, the data model, guardrails).
- `sync/procore_pipeline.py` — `MasterTable` (upsert + scoped purge), `paginated_get`/
  `get_json` (failure → `None`, never `[]`), jitter, `run_ts`; the **payment-applications
  loop** is your model for "fetch a detail per parent, mark the table synced only if
  *every* sub-fetch succeeded" (so a partial failure never purges).
- `src/lib/dataSource.ts`, `src/data/seedSource.ts`, `src/data/supabaseSource.ts` — the
  `DataSource` seam; `supabaseSource` has `fetchAll` (pages past PostgREST's 1000-row cap).
- `src/state/DataContext.tsx` — the provider (expose the detail fetch here).
- `src/components/overlays/RecordDetailDrawer.tsx` — the drawer to fill; it has a
  Description section + section-label pattern already; reads `state.detail.record` (`Item`).
- `src/types.ts` — add the `ItemDetail` shape here (keep `Item` unchanged/light).

## Scope (build)
1. **Pipeline** (`sync/procore_pipeline.py`): after the RFI list fetch for an allowlisted
   project, fetch each RFI's detail via `get_json(.../rfis/{id})`; keep the ball-in-court/
   assignee flattening but **stop flattening `questions`** — store the detail payload
   (with `questions[].answers[]` intact) into `procore_rfis_master`. Only call
   `rfis_tbl.add(...)` if every detail fetch succeeded (mirror the pay-app loop); on any
   `None`, skip so the scoped purge can't delete. Reuse jitter/timeouts.
2. ⛔ **Supabase** (present SQL, STOP): a `security_invoker=true` view (e.g.
   `sitelines_rfi_detail`, keyed by item id `rfis:<id>`) exposing `request`,
   `proposed_solution`, `instructions`, and a JSON array of `responses`
   (`{author, date, text, official}`) out of `raw`. No new table needed if enriching
   `raw` in place (the recommended storage decision); if a table is added it needs RLS +
   an `authenticated_read` policy (see migrations 0003/0006). Apply only after approval,
   then re-sync OP III and verify the thread is queryable.
3. **App:** add `ItemDetail` to `src/types.ts`; extend `DataSource` with
   `getDetail(item): Promise<ItemDetail>` (seed returns today's generated stub;
   `supabaseSource` queries `sitelines_rfi_detail` for the opened id); expose it via
   `DataContext`; render the real **Request** (replace the placeholder Description) + a
   new **Responses** section in the drawer (text · author · date · an "Official" tag).
   Add a pure `mapRfiDetail(...)` + `.test.ts`.

## Guardrails / ⛔ gates
- ⛔ **Present all DDL/view SQL and STOP** before applying to Supabase (ref `jxesfirpghwpfmfjlfng`).
- ⛔ **Do NOT touch the Procore app registration** — reuse creds via `sync/.env`.
- Ball-in-court rule stays in `src/lib/ballInCourt.ts`; `Item` stays light (detail is a
  separate `ItemDetail`); one token source; UI reads through the provider (drawer fetches
  detail via `DataContext`, not a raw client); `supabaseSource` keeps `fetchAll` paging;
  never commit secrets.
- The app runs live behind login: `VITE_DATA_SOURCE=live`, user `ben@sitelines.local`
  (temp). Seed mode (`VITE_DATA_SOURCE=seed`) must still render the drawer.

## Exit criteria (the gate)
- `npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck` and `... run build` green.
- `mapRfiDetail` unit-tested (`npm test`), deterministic (feed fixture JSON).
- `:5173` live click-through (start dev server, log in, drive with Playwright; read DOM in
  a SEPARATE call after a click): open an RFI → its **real question** and **real answers**
  (author + Official tag) render; seed mode still shows the drawer.
- Then STOP and report; do not start Phase 2 (submittals + punch).
