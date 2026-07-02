# Procore API Integration — Research Findings (2026-07-02)

> Synthesized from three research passes: (A) Procore's live developer docs +
> API Terms of Use (web), (B) the four official developer-guide PDFs stored in
> `FP-Analytics/Procore Developer Guide/`, and (C) a full line-by-line analysis
> of `FP-Analytics/procore_pipeline.py`. Written for a fresh session preparing
> Data Seam Phase 2 and the FP-Analytics compliance refactor. Facts below cite
> their source pass; verify anything marked ⚠️ during implementation.

## 0. Bottom line

**Connectivity is a solved problem.** The pipeline has already authenticated
against production and synced 21 tables to Supabase. The right auth model
(Client Credentials + DMSA) is exactly what's in use. The real work is:
(1) making the pipeline's *caching behavior* compliant (upsert + purge, project
allowlist, jitter — per the owner's compliance spec), (2) tightening secrets,
and (3) then building the Phase 2 SQL views on top. No unknowns block Phase 2.

---

## 1. Authentication (settled)

- **Model: OAuth2 Client Credentials + DMSA (Developer Managed Service
  Account)** — Procore's documented, intended flow for backend "data
  connection" apps with no user login. Legacy service accounts are **dead**
  (deprecated 2021-12-09; stopped working 2025-03-18) — DMSA is the only
  service path. [A]
- **Token:** `POST https://login.procore.com/oauth/token` with
  `grant_type=client_credentials` + client_id/secret. TTL **5400s (90 min)**,
  **no refresh token** — just request a new one (the pipeline requests one per
  run; fine). [A, B: OAuth guide pp.21–24]
- **`Procore-Company-Id` header is mandatory on every call** (MPR routing);
  under client credentials even `/me` and `/companies` need it. The pipeline
  already sends it. [A, B]
- **DMSA = a directory user + admin-selected permitted projects.** At install,
  the company admin picks which projects the app can access; changeable later
  in App Management. ⚠️ Gotcha: **app updates/reinstalls require the admin to
  re-select permitted projects** (settings don't carry over). [B: Plan pp.27–34]
- **Custom apps need no Procore/marketplace review.** Build in the Developer
  Portal, promote to production (requires one-time "Verified Developer" org
  verification), company admin installs via App Management with the App Version
  ID. Production client secret is shown **once** at promotion. [A, B]
- ⚠️ Verify in the Procore Developer Portal: the FP-Analytics app's manifest
  permissions (Permissions Builder) and its permitted-projects list. **DMSA's
  permitted-projects IS the platform-level enforcement of the
  `ACTIVE_PROJECT_IDS` concept** — the code allowlist is defense-in-depth.

## 2. Rate limits (structure known, numbers deliberately unpublished)

- **Two concurrent windows: hourly (60-min) + spike (10-second).** Either can
  429. [A, B: Plan pp.7–9]
- Headers on every response are the **source of truth**: `X-Rate-Limit-Limit`,
  `X-Rate-Limit-Remaining`, `X-Rate-Limit-Reset` (Unix s). Docs explicitly warn
  against assuming fixed numbers (the old "3600/hr" is legacy folklore; example
  values shown are 600/hr, 25/10s). 503s carry `Retry-After`. [A]
- Pipeline today: reactive-only (sleeps to `X-Rate-Limit-Reset` on 429, 3
  retries). **No proactive throttling, no jitter, no 5xx handling.** [C]
- The compliance spec's jitter change is well-founded (the 10s spike window is
  what unjittered pagination loops trip). Consider also watching
  `X-Rate-Limit-Remaining` proactively.

## 3. Delta sync (the big unlock — verified against live API specs)

- **`filters[updated_at]` (ISO-8601 range, `start...end`) is supported on all
  our core targets:** RFIs (v1.0), Submittals (v1.1), Change Order Packages
  (v1.0), Work Order Contracts/commitments (v1.0), Requisitions (v1.1), Punch
  Items (v1.1). Daily Logs filter by `log_date`/`start_date`/`end_date`
  instead. [A — verified in the portal's per-resource OpenAPI JSON]
- This means the pipeline can eventually do **true incremental sync** (fetch
  only what changed since the last run) rather than nightly full pulls —
  smaller, faster, and maximally aligned with "minimum necessary" retrieval.
  Note: delta-fetch alone can't detect deletions; pair with periodic full-key
  reconciliation per project.
- **Webhooks** exist (create/update/delete pings per resource; thin payloads —
  you re-fetch the resource) but are **unordered, at-least-once, and discarded
  after 12h of delivery failure** — suitable as a freshness trigger, never as
  the sole sync mechanism. Requires a public HTTPS endpoint (5s response
  budget). Deferred: not needed for v1 (nightly/scheduled polls suffice). [A, B]
- RFIs also support `filters[ball_in_court_id]` and a
  `POST …/rfis/{id}/advance_ball_in_court` action (v1.1) — relevant if the app
  ever writes back. Punch Items carry ball_in_court too (useful for Data Seam
  Phase 4).

## 4. Compliance analysis (the owner's spec is well-founded)

What the Terms/Guidelines actually say [A — API Terms of Use eff. 2025-09-30;
API Usage Guidelines; B: APIs guide pp.24–26]:

- **Prohibited for all API use:** large-scale extraction/bulk export beyond the
  app's core integration; scraping/harvesting/copying; "high-volume data
  retrieval to power non-complementary analytics"; **building AI/ML training
  datasets** (Procore's Agentic APIs, GA ~late Q1 2026, are their sanctioned AI
  path); exceeding rate limits; requesting more data/permissions than the app's
  functionality needs.
- **⚠️ No explicit "caching" clause exists anywhere in the Terms.** The
  operative constraints are: *minimum-necessary retention*, the
  anti-database-cloning/bulk-export prohibitions, prompt update/erase of
  modified customer data (Developer Policy), and return/destroy on termination
  (§12.3). A **scoped, synchronized operational cache serving the app's live
  function is consistent with the guidelines; a wholesale mirror is squarely
  prohibited.** The owner's spec (upsert + purge + allowlist) is precisely the
  posture that keeps us on the right side of that line.
- §5.4's strictest data clauses are textually scoped to **commercially
  distributed** apps, and §5.1 carves out single-customer apps — but the Usage
  Guidelines repeat the bans without that scoping. **Assume the stricter
  reading.**
- Sanctioned bulk channel if ever needed: **Procore Analytics** (Delta Sharing)
  or a written agreement with Procore.
- 📛 **Naming/framing:** the repo is called "FP-Analytics" while the Terms
  frown on "non-complementary analytics." The pipeline's actual purpose —
  powering Sitelines' live operations — is the permitted "complementary" kind.
  Consider renaming the repo/service (e.g. `sitelines-sync`) and stating the
  purpose in its README. Cosmetic, but framing matters if ever reviewed.
- **Record the standing boundary:** data synced from Procore must never feed
  model training, benchmarking, or long-term historical archives detached from
  app operation. (Also now in the compliance spec.)

## 5. The compliance spec mapped onto the pipeline (from the code analysis [C])

Full details in the analysis; the load-bearing facts:

1. **`ACTIVE_PROJECT_IDS` gate is one skip** at the top of the deep loop
   (line ~461) — covers all ~15 project-scoped endpoint families. Company-scoped
   pulls (projects/vendors/users/CO-statuses) stay global per the spec. ⚠️ Type
   trap: env-loaded ids are strings, Procore ids are ints.
2. **`if_exists='replace'` is load-bearing:** there is **no DDL anywhere** —
   pandas invents schemas nightly. Upsert therefore requires real migrations
   (declared PKs). Recommended pattern: `to_sql` into a staging table →
   `INSERT … ON CONFLICT (keys) DO UPDATE` → scoped purge → one transaction.
3. **☠️ The #1 correctness hazard:** `paginated_get` returns `[]` for BOTH
   "genuinely empty" and "request failed" (and `get_json` returns `None`).
   Today a failure harmlessly leaves last night's table. Under upsert+purge, a
   failed fetch would read as "everything was deleted upstream" and **purge a
   project's dataset**. Failure must become distinguishable (raise/None) and
   purge must be skipped on failure. Fix this FIRST in the refactor.
4. **Purge design:** per-project delete-or-flag scoped to projects actually
   synced this run (`DELETE … WHERE project_id = :p AND key NOT IN (fetched)`),
   inside a transaction; company-scoped tables can full-diff. Spec is silent on
   projects *removed from the allowlist* — strict reading of the Terms says
   delete their rows (owner decision needed).
5. **Upsert keys:** mostly `(id, project_id)`; `budget_meta` keys on
   `project_id` alone; two flattened child tables
   (`change_event_line_items_master`, `submittal_approvers`) **lack
   `project_id` today** and need it added (their accumulators are called inside
   the project loop — pass `p_id`). Dedupe DataFrames before `ON CONFLICT`
   (duplicate keys in one statement = CardinalityViolation).
6. **Schema drift:** `json_normalize` column sets vary run-to-run. Options:
   auto-`ALTER TABLE ADD COLUMN`, or fixed whitelist + `raw JSONB` catch-all
   (most robust). Missing columns in a run must be sent as NULL, not dropped.
7. **Jitter:** `paginated_get` is the only pagination loop; add
   `time.sleep(random.uniform(0.5, 1.5))` before following each `next` link
   (`random` isn't imported yet). Runtime cost ≈ +1s/page — acceptable once the
   allowlist shrinks scope; the per-contract COR loops are the multiplier to
   watch.
8. **Fail-loud:** the single try/except exits 0 on total failure — must become
   non-zero for the scheduler once purge semantics exist.
9. Endpoint modernization candidates (not required, note only): Prime Contracts
   v1.0 (singular assumption) → **v2.0** (supports multiple primes per
   project); company users → v1.3.

## 6. Sandbox strategy

- **Developer Sandbox** (what the sandbox scripts target): auto-provisioned per
  app, seeded starter project, **cannot be refreshed/deleted**. Auth base:
  `https://login-sandbox.procore.com`; API base: `https://sandbox.procore.com`. [A, B]
- **Monthly Sandbox** (customer-linked): `api-sandbox-monthly.procore.com` /
  `login-sandbox-monthly.procore.com`, refreshed from a ~24h-old production
  snapshot on the first working day of each month — **this is the right place
  to validate real status vocabularies and volumes before production**. [A]
- ⚠️ `procore_sandbox_pull.py` authenticates against
  `sandbox.procore.com/oauth/token` (worked in April 2026) — docs say auth
  lives at `login-sandbox.procore.com`. Verify which is current when touching
  those scripts.

## 7. Security actions (do before any new API work)

- 🔴 **Both sandbox scripts have hardcoded credentials** [C]:
  `procore_sandbox_pull.py` (client id/secret/company id, lines 6–8) and
  `procore_sandbox_budget.py` (same pair, lines 7–9, **plus the live Supabase
  DB password + pooler host in plaintext, lines 63–64**). Rotate the Procore
  sandbox secret AND the Supabase DB password; move both scripts to `.env`.
- Minor: the main pipeline inlines the Supabase user/project-ref in its
  connection string (line ~613) — move to env for consistency.
- FP-Analytics has a `.gitignore` covering `.env`, but the hardcoded values
  bypass it; if that folder was ever pushed anywhere, treat the secrets as
  burned.

## 8. What this changes for Sitelines' plans

- **The Data Seam plan survives intact.** SQL views over `procore_*_master`
  don't care whether rows arrive by replace or upsert. Upsert actually helps
  Phase 2: declared PKs + stable schemas are better view foundations.
- **New prerequisite workstream (FP-Analytics repo): the compliance refactor**
  per the owner's spec — allowlist, staging+upsert+purge (with the
  failure-vs-empty fix first), jitter, secrets rotation. This should land
  before or alongside Data Seam Phase 2, because Phase 2's views want the
  stable DDL the refactor introduces.
- Order of operations for the next sessions:
  1. Secrets rotation (15 min, do immediately).
  2. FP-Analytics compliance refactor (its own phased plan, in that repo).
  3. Data Seam Phase 2 (SQL views) — against the post-refactor schemas.
  4. Phase 3 (app wiring) unchanged; Phase 4 (coverage) uses the endpoint map
     in §3/§6 and inherits the compliance patterns.
- Verify the DMSA app's permitted projects = the two active ones; that plus
  `ACTIVE_PROJECT_IDS` gives two independent layers enforcing project scope.
