# sync/ — Procore → Supabase operational cache

This is the pipeline that keeps Sitelines' data live. It authenticates to Procore
(OAuth2 client-credentials + DMSA), pulls the tools Sitelines needs for the
allowlisted projects, and writes them to `procore_*_master` tables in Supabase.
Sitelines then reads Supabase views over those tables (Data Seam Phase 2+).

It was moved here from the standalone `FP-Analytics` folder in Data Seam Phase 1.5.
The old name is retired: this is a **complementary operational cache**, not an
analytics/export tool.

## Compliance posture (read before changing sync behavior)

This cache exists to power Sitelines' live, day-to-day operation — the use Procore's
API Terms permit. Guardrails baked into the pipeline:

- **Project allowlist** (`ACTIVE_PROJECT_IDS`) gates all deep per-project fetching,
  on top of the DMSA's platform-level permitted-projects list.
- **Upsert + scoped purge**, not a nightly full clone. A failed fetch never triggers
  a purge (that's the `paginated_get` failure-vs-empty fix — a failed request returns
  `None`, an empty result returns `[]`).
- **Request jitter** between paginated pages to respect the rate-limit spike window.
- **Fail-loud**: the process exits non-zero on failure so the scheduler notices.

**Standing boundary:** data synced here must never feed model training, benchmarking,
or long-term historical archives detached from app operation.

## Files

| File | What it is |
| --- | --- |
| `procore_pipeline.py` | The nightly sync (discovery → gated deep fetch → upsert/purge). |
| `migrations/0001_init_procore_master.sql` | Keyed DDL for the `procore_*_master` tables. Apply once to Supabase. |
| `procore_sandbox_pull.py` / `procore_sandbox_budget.py` | Developer-sandbox smoke tests. |
| `.env.example` | Template for `.env`. |
| `.env` | **Local only, gitignored.** Real credentials. Never commit. |

## Setup

```bash
cd sync
python -m venv .venv && . .venv/Scripts/activate   # Windows; use bin/activate on *nix
pip install -r requirements.txt
cp .env.example .env    # then fill in .env
```

## First run (bootstrapping the allowlist)

1. Leave `ACTIVE_PROJECT_IDS` blank in `.env`.
2. Run `python procore_pipeline.py`. It authenticates, logs every **discovered
   project id**, then aborts *before* any deep fetch (by design).
3. Copy the Orchard Path III id into `ACTIVE_PROJECT_IDS` in `.env`.
4. Re-run. It now deep-fetches only the allowlisted project(s) and writes the masters.

> McKenna shows seed/no live data until it is both (a) permitted on the Procore app
> in App Management and (b) added to `ACTIVE_PROJECT_IDS`.

## Removing a project (retiring it from the cache)

Removing a project from `ACTIVE_PROJECT_IDS` **stops** future syncs but does **not**
delete its already-cached rows — by design. Auto-purging on allowlist state is a
foot-gun (a typo or a failed `.env` load would look like "every project was removed").
When you deliberately retire a project, delete its rows explicitly, e.g.:

```sql
-- Replace 3051002 with the retired project id.
DELETE FROM procore_rfis_master              WHERE project_id = 3051002;
DELETE FROM procore_submittals_master        WHERE project_id = 3051002;
-- …repeat for each procore_*_master table that has a project_id column.
```

## Applying the schema

The `procore_*_master` tables must exist before the first write. Apply
`migrations/0001_init_procore_master.sql` to the Supabase project once (via the
Supabase SQL editor or the MCP `apply_migration`). The pipeline upserts into these
tables; it does not create them.
