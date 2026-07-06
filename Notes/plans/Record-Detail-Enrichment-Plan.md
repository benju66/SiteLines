# Record Detail Enrichment — full request→response threads (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + `design_handoff_sitelines/README.md` +
> `design_handoff_sitelines/DATA_CONTRACT.md`. Sibling: the Data Seam is DONE
> (`Notes/plans/Procore-Data-Seam-Plan.md`) — this builds on it.

## Goal
Today the app shows each RFI/submittal/etc. as a **register row** and, when you open
the detail drawer, a *generated placeholder* description + fake history + fake
attachments (`src/components/overlays/RecordDetailDrawer.tsx`). This workstream makes
the drawer show the **real thing**: the actual **Request** (the question narrative)
and the actual **Responses** (each answer — who wrote it, when, whether it's the
official answer). Starting with **RFIs** (the highest-value record), then the same
pattern for **submittals** and **punch**.

## Why this is a real workstream (the API finding)
The Procore **list** endpoints we currently sync are summaries. Verified live
(2026-07-04, OP III `id 3051002`):
- `GET /rest/v1.0/projects/{id}/rfis` (what we sync into `procore_rfis_master`) carries
  the request + people + workflow, but its `questions[]` only have `{body, id}` —
  **no answers**. We have every RFI's question and none of its responses.
- `GET /rest/v1.0/projects/{id}/rfis/{id}` (the **detail** endpoint) returns
  `questions[].answers[]` — each answer has `plain_text_body` / `rich_text_body`,
  `official` (bool), `answer_date`, `created_by` (+id), and `attachments`; plus
  question-level `attachments`, and top-level `instructions`, `distribution_list`,
  `drawing_ids`/`drawing_number`, `change_events`, `coordination_issues`,
  `correspondences`, `linked_external_rfis`, `accepted`, `ball_in_court_role`.
- ⚠️ The current pipeline's `clean_rfi_assignees_and_ball_in_court` **flattens**
  `questions` to a joined body-only string and **discards** structure. The enrichment
  must STOP flattening for RFIs and preserve the question→answer thread.
- Cost: one extra API call **per RFI** (~104 for OP III) → ~+2–3 min/sync with the
  existing jitter; scales linearly with record count. This is compliant, minimum-
  necessary enrichment (only records already in scope), not bulk export.

## Out of scope / deferred
- **Attachments** (files): the detail endpoint gives attachment metadata + URLs, but
  rendering/downloading them needs Procore file auth — defer. Show a count at most.
- **Cross-link resolution** (drawing_ids / change_events / correspondences →
  DATA_CONTRACT §5 `links`): the detail endpoint *has* the related ids, but mapping
  them to our `tool:id` item ids is its own task — defer. (Note it as a future unlock.)
- **Writing back** to Procore (Respond/Forward/Resolve stay UI-only).
- **Delta sync** (only re-fetch details for RFIs whose `updated_at` changed) — a good
  later optimization; v1 re-fetches all in-scope RFI details each run.

## Locked product decisions (from the owner)
- Enrich the record detail with the **real request + responses**; **RFIs first**, then
  submittals + punch. (2026-07-04)

## Proposed decisions (confirm at the start of Phase 1 — one-liners)
1. **Storage — enrich `procore_rfis_master.raw` in place (Recommended)** vs. a new
   child table. Recommended: replace the RFI *list* fetch with a *detail* fetch per
   RFI and store the full detail payload (with `questions[].answers[]` intact) as
   `raw`. One table, no new schema, thread lives in JSON — the view/app read it out.
   (A normalized answers child table is more schema for no display benefit.)
2. **App delivery — lazy fetch on drawer-open (Recommended)** vs. load every thread
   in the snapshot. Recommended: extend the `DataSource` with a
   `getDetail(item): Promise<ItemDetail>` the drawer calls when it opens, so the
   register feed stays light and it scales past OP III. Seed returns today's generated
   stub; the Supabase source queries the thread.
3. **v1 content — request + responses only (Recommended)**; defer attachments + cross-
   links (above). Fills the drawer's existing **Description** with the real request and
   adds a **Responses** section (answer text · author · date · "Official" tag).

## Data model (DATA_CONTRACT)
- Add an `ItemDetail` shape to `src/types.ts` (the contract), e.g.
  `{ request: string; proposedSolution?: string; instructions?: string;
     responses: { author: string; date: string | null; text: string; official: boolean }[];
     attachmentCount?: number }`. The `Item` register atom is **unchanged** (stays light).
- A Supabase view (e.g. `sitelines_rfi_detail`, keyed by the item id `rfis:<id>`)
  exposes the request + a JSON array of responses out of `procore_rfis_master.raw`.
  Keep the UI dumb: shaping happens in the view + a pure mapper, not in the component.

## Build-on inventory (read these fresh before using)
REUSE, do not fork:
- `src/components/overlays/RecordDetailDrawer.tsx` — already has a **Description**
  section and a section-label pattern; replace its generated `desc`/`history`/
  `attachments` with real detail. It reads `state.detail.record` (an `Item`).
- `src/lib/dataSource.ts` (`DataSource` interface) + `src/data/seedSource.ts` +
  `src/data/supabaseSource.ts` — extend with `getDetail`; `supabaseSource` already has
  `fetchAll` (pages past PostgREST's 1000-row cap) and the client.
- `src/state/DataContext.tsx` — the provider; expose the detail fetch here (a hook the
  drawer calls), keeping components reading through the provider.
- `sync/procore_pipeline.py` — the `MasterTable` upsert/scoped-purge, `paginated_get`/
  `get_json` (failure→None), jitter, `run_ts`. The per-prime pay-app loop is the
  existing model for "fetch detail per parent, mark synced only if all succeed."
- Supabase invariants: views are `security_invoker=true` over deny-all-RLS tables with
  `authenticated_read` policies (migrations 0003/0006). Any new table needs RLS + that
  policy. Project ref `jxesfirpghwpfmfjlfng`.

## Pure logic to extract + unit-test
- `mapRfiDetail(raw): ItemDetail` (or from the view row) in `src/lib/` with a
  co-located `.test.ts` — turns the stored detail JSON into the `ItemDetail` shape
  (pick the request body, order responses by date, carry the `official` flag,
  HTML→text). Deterministic; feed it fixture JSON.

## Sub-phasing (ship + verify each)

### Phase 1 — RFIs, end to end ✅ SHIPPED (2026-07-06)
Live on the `rfi-detail-enrichment` branch. The drawer now shows each RFI's real
**Request** + **Responses** (author · date · Official tag), plus — beyond the original
v1 scope, at the owner's request — **all assignees**, the **closed date**
(`time_resolved`), **attachment download links** (pre-signed Procore URLs; paired with
the always-fresh "Open in Procore" deep link), and **Open in Procore ↗**. Pipeline:
`enrich_rfis_with_detail()` fetches `/rfis/{id}` per RFI (gated so a partial failure
never purges) and stops flattening `questions`. View: `sitelines_rfi_detail`
(`security_invoker`). App: `ItemDetail` + `getDetail` on the DataSource, pure
`mapRfiDetail` (unit-tested). Verified: typecheck + 38 tests + build + live click-through
(OP III, logged in). Attachment note: signed URLs are freshest right after a sync; a
click-time refresh (needs a small backend) is a future unlock. **Phase 2 (submittals +
punch) not started.**

- **Scope:** (a) `sync/procore_pipeline.py`: after the RFI list fetch, fetch each RFI's
  detail (`/rfis/{id}`), gated on the `is not None` failure pattern; store the detail
  (thread preserved) into `procore_rfis_master` — stop the questions-flattening for
  RFIs. Mark the table synced only if every detail fetch succeeded (mirror the pay-app
  loop) so a partial failure never purges. (b) ⛔ **present the DDL/view SQL and STOP**
  for owner approval; apply; re-sync OP III; verify the thread is queryable. (c) App:
  add `ItemDetail` + `getDetail` to the DataSource (seed stub + supabase query),
  surface it via the provider, and render the real **Request** + a **Responses**
  section in `RecordDetailDrawer` (replace the placeholders). Keep seed source working.
- **Approval gates:** ⛔ Supabase DDL/view (present SQL, STOP) · ⛔ nothing touches the
  Procore app registration (reuse `sync/.env`).
- **Exit criteria:** typecheck + build green; `mapRfiDetail` unit-tested; live `:5173`
  click-through logged in as `ben@sitelines.local` (`VITE_DATA_SOURCE=live`) — open an
  RFI, see its real question and answers (with author + Official tag); seed mode still
  renders. This phase is on the larger side — the ⛔ DDL gate is a clean pause point if
  the session runs long.

### Phase 2 — Submittals + Punch (same pattern)
- **Scope:** repeat the list→detail enrichment for submittals (`/submittals/{id}` —
  has the approver workflow + responses) and punch (`/punch_items/{id}` — has the
  item's responses/threads). Reuse the Phase 1 `ItemDetail` shape + drawer section;
  add per-tool mappers. Present any DDL and STOP.
- **Exit criteria:** opening a submittal / punch item shows its real thread; the RFI
  path is unchanged; typecheck + build + click-through.

## Hard guardrails (do not violate)
- Ball-in-court rule stays centralized in `src/lib/ballInCourt.ts`; never duplicate
  `TERMINAL` in SQL. The `Item` atom stays light — detail is a separate `ItemDetail`.
- Domain atom is `Item`, not `Record`. One token source (`src/theme/tokens.ts` +
  `src/index.css`). Views derived from state; UI reads via the provider (`useData`/
  `useSiteData`) — the drawer must fetch detail through the provider, not a raw client.
- Overlays render `position:fixed` outside the card's `overflow:hidden` (the drawer
  already does — don't regress it).
- `supabaseSource` must keep paging past the 1000-row cap (`fetchAll`).
- Secrets: reuse Procore + Supabase creds via `sync/.env` / `.env.local`, never commit.
- Present all DDL/SQL and STOP for approval before applying to Supabase.

## Open decisions
- The three "proposed decisions" above — confirm at Phase 1 kickoff (all have a
  recommended default; the plan is written to that default).
- Whether the drawer's **ball-in-court history** should also become real (from
  `initiated_at`/`time_resolved`/`received_from`) or stay generated in v1 — decide in
  Phase 1 (low stakes; recommend: real request+responses first, leave history as-is).
