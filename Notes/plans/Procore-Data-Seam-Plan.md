# Procore Data Seam — wire FP-Analytics → Supabase → Sitelines (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`.
> Sibling repo (the data source): `C:/Users/BUrness/Dev/FP-Analytics`.
> **REQUIRED READING for Phases 2–4:** `Notes/research/Procore-API-Integration-Research.md`
> (2026-07-02) — auth/DMSA, rate limits, delta-sync support, ToS/compliance
> constraints, and the pipeline compliance refactor that is now a PREREQUISITE
> for Phase 2 (see below).

## 0. How to use this doc
1. Read `design_handoff_sitelines/README.md`, `design_handoff_sitelines/DATA_CONTRACT.md`, and `PLAN.md` (repo root). `design_handoff_sitelines/DATA_CONTRACT.md` is the seam this whole workstream serves.
2. Skim the Procore ETL in `C:/Users/BUrness/Dev/FP-Analytics/procore_pipeline.py` — it already authenticates, paginates, rate-limits, flattens ball-in-court, and writes `procore_*_master` tables to Supabase.
3. Re-read the Sitelines files named below fresh — do not trust line numbers; they drift.
4. Build the phases in order. Verify after each (§ verification). Keep the owner (product owner, not a developer) in the loop: plain-English summary first, jargon explained in passing.

## Goal
Sitelines reads **live Procore data** instead of in-file seed data, with no changes
to its views. FP-Analytics keeps syncing Procore → Supabase (`procore_*_master`
tables); Supabase **SQL views** reshape those into the `DATA_CONTRACT` shapes; the
React app fetches them on load, shows a "last synced" indicator, and has a manual
refresh button. Views, selectors, and the ball-in-court rule are unchanged — only
the *source* behind the selectors changes.

## Out of scope / deferred
- **Writes back to Procore** (Respond/Forward/Resolve stay UI-only for now).
- **Realtime subscriptions** — decided against for v1 (daily-scan tool).
- **Multi-user / per-user permissions** — single-user tool; no 3-legged OAuth.
- **The remaining view surfaces themselves** — those are `PLAN.md`'s workstream.
  This plan makes the data live; PLAN.md builds the UI. They don't block each other.
- **Tools the pipeline doesn't pull yet** (punch, meetings, drawings, specs,
  documents, daily log, photos, schedule) — Phase 4 extends coverage; until then
  those views run on seed data.

## Locked product decisions (from the owner)
- **Mapping lives in Supabase SQL views** over the raw `procore_*_master` tables;
  the app reads them directly via `supabase-js`. Easiest to tweak, mapping next to
  the data. (2026-07-01)
- **Refresh = fetch-on-load + "last synced N ago" indicator + a manual refresh
  button.** Pipeline syncs on a schedule upstream. (2026-07-01)

## Data model
Supabase views emit rows shaped for the contract. Split of responsibility:
- **View emits identity + raw fields:** `id, tool, project, num, title, who, mine,
  raw_status_label, due_date (ISO or null), links[]`. The view does the
  Procore→contract *structural* mapping and `who`/`mine` resolution (from the
  ball-in-court fields the pipeline already flattens).
- **App derives the date-relative + display bits** (see "Pure logic" below):
  `urgency` (from `due_date` vs. today), `date` (display string), and `status.tone`
  (lookup from `raw_status_label`). Rationale: urgency must be computed against the
  *client's* today, not the sync time — data synced hours ago shouldn't show stale
  urgency. Keeps the ball-in-court `TERMINAL` rule as the single source of truth in
  `src/lib/ballInCourt.ts`, applied client-side (do NOT duplicate `TERMINAL` in SQL).
- Views needed: `sitelines_items` (Item feed across tools), `sitelines_contacts`
  (Contact, from `procore_vendors_master` + `procore_users_master`),
  `sitelines_financials` (per-division rollups, §6), `sitelines_activity` (§7).
- ⚠️ Validate `raw_status_label` spelling against `TERMINAL` per tool during
  Phase 2 — a mismatch leaks a closed item into My Court (DATA_CONTRACT §2 warning).

## Build-on inventory (read these fresh before using)
REUSE, do not fork:
- `src/lib/ballInCourt.ts` — the ball-in-court rule stays here, applied client-side.
- `src/selectors/index.ts` — selectors keep their signatures; they change from
  reading a static `DATA` import to reading a provided record set (Phase 1).
- `src/state/AppContext.tsx` — the flat state + `patch()` pattern; the data provider
  is a sibling context, not a merge into AppState.
- `src/theme/tokens.ts` — `tone` / `urgency` maps for the app-side derivation.
- `src/data/*` — becomes the **seed** `DataSource` implementation, not deleted.
- FP-Analytics `procore_pipeline.py` — extend for Phase 4; do not rewrite.

## Pure logic to extract + unit-test (this is where correctness lives)
Framework-free, deterministic, in `src/lib/` with co-located `.test.ts` (add
**vitest**: `npm i -D vitest`). **Pass `today` IN — never call `new Date()` inside.**
- `deriveUrgency(dueDateISO: string | null, today: Date): Urgency` — past→`over`,
  ≤7d→`week`, else→`track`, null/closed→`muted` (DATA_CONTRACT §1).
- `formatDueDate(dueDateISO, ...)` → the display string (or format server-side later).
- `statusTone(rawLabel): Tone` — lookup mirroring the seed's tone assignments.
These are the functions that turn raw view rows into full `Item`s; test them hard.

## Sub-phasing (ship + verify each)

### Phase 1 — App data provider + states (Sitelines only, NO backend) ✅ DONE 2026-07-01
- **Scope:** Introduce a `DataSource` abstraction (`getItems/getContacts/getFinancials/
  getActivity` + `lastSyncedAt`) with a **seed implementation** wrapping today's
  `src/data/*`. Add a `DataProvider` context that loads a source and exposes
  `{ data, status: 'loading'|'ready'|'error', lastSyncedAt, refresh() }`. Point
  selectors + components (Header's ACTIVITY, directory, financial) at the provider
  instead of static imports. Add loading skeleton, empty, error, and "last synced"
  + refresh-button UI (DATA_CONTRACT §8). Extract the pure logic above.
- **Why first:** decouples the UI from the data source while only 1 view exists —
  retrofitting a provider across 10 views later is churn. Every feature built after
  this is automatically live-data-ready. No Procore/Supabase dependency.
- **Approval gates:** none (pure client refactor).
- **Exit criteria:** app still runs identically on the **seed** source through the
  provider; states render; pure logic unit-tested; typecheck + build green; `:5173`
  click-through. Stop; don't wire Supabase yet.

### Phase 1.5 — PREREQUISITE: FP-Analytics compliance refactor (other repo)
- **Scope (owner's compliance spec, 2026-07-02, in the FP-Analytics repo):**
  (a) `ACTIVE_PROJECT_IDS` allowlist gating the deep-fetch loop (global project
  discovery retained); (b) replace→staging+UPSERT+scoped-purge with real DDL/
  migrations — **fix the `paginated_get` failure-vs-empty conflation FIRST**
  (a failed fetch must never read as "purge everything"); (c) request jitter
  `random.uniform(0.5, 1.5)` in pagination; (d) 🔴 secrets rotation (hardcoded
  creds in both sandbox scripts incl. a plaintext Supabase DB password).
- **Why prerequisite:** Phase 2's views want the stable, keyed DDL this refactor
  introduces; and compliance posture (cache-sync per Procore ToS) should be
  settled before we build more on the cache. Standing boundary: synced data
  never feeds AI/ML training or long-term archives detached from app operation.
- **Approval gates:** ⛔ DB schema migrations (present DDL and STOP); ⛔ secrets
  rotation touches live credentials.
- Details, per-table upsert keys, and hazards: research doc §5 + §7.

### Phase 2 — Supabase normalization views (SQL, server-side)
- **Scope:** SQL views/RPCs over `procore_*_master` producing `sitelines_items`,
  `sitelines_contacts`, `sitelines_financials`, `sitelines_activity` — for the
  **live-ready tools only** (RFIs, submittals, change orders, commitments,
  invoicing, budget, prime contract, directory). Map project ids → `mckenna|opiii`
  scope, resolve `who`/`mine`, emit `raw_status_label` + `due_date`.
- **Approval gates:** ⛔ touches the Supabase database — present the exact SQL and
  **STOP** for owner sign-off before applying. Never touch production data destructively.
- **Exit criteria:** views return contract-shaped rows; validated against a sample
  project vs. the Procore UI; `TERMINAL` labels confirmed per tool.

### Phase 3 — Wire the app to Supabase (`supabaseDataSource`)
- **Scope:** Implement a `supabaseDataSource` using `supabase-js` reading the Phase 2
  views; fetch-on-load, real `lastSyncedAt`, working refresh button. Env toggle
  between `seed` and `live` sources.
- **Approval gates:** ⛔ **security** — use an authenticated Supabase session / RLS
  with a restricted key; do NOT ship a service-role or unrestricted key in the
  browser bundle (financial data). Confirm the key posture before shipping.
- **Exit criteria:** app runs on live data for the covered tools; loading/error/
  stale states behave against the real DB; typecheck + build + live click-through.

### Phase 4 — Extend pipeline + views for the remaining court tools
- **Scope:** Add the Procore endpoints FP-Analytics doesn't pull yet (punch,
  meetings, drawings, specs, documents; then daily log, photos, schedule) →
  `procore_*_master`, and extend the Phase 2 views. Sub-split per tool group.
- **Approval gates:** ⛔ DB writes / new tables — present schema and STOP.
- **Exit criteria:** the new views populate; the app's existing views light up with
  **zero UI changes** (proof the seam holds).

## Hard guardrails (Sitelines invariants — do not violate)
- Ball-in-court rule stays centralized in `src/lib/ballInCourt.ts`, applied
  client-side; never duplicate `TERMINAL` in SQL.
- Keep the UI dumb — views/selectors consume the `DATA_CONTRACT` shapes only; the
  Supabase views are the Procore seam. New features must read through the provider.
- The domain atom is `Item`, not `Record`.
- Design tokens have one source (`src/theme/tokens.ts` + `src/index.css`).
- Views stay derived from state; the data provider is a separate context from `AppState`.
- Secrets: Procore + DB credentials live in env, never committed. (See the sandbox-
  creds fix note in the kickoff.)

## Open decisions
- Exact auth posture for the browser → Supabase read (authenticated session vs.
  restricted anon key + RLS) — resolved at the start of Phase 3.
- Whether `date` display strings are formatted app-side or added to the view later —
  start app-side (Phase 1), revisit if server formatting is cleaner.
