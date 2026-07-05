# Kickoff — Sync DB Size Observability (keep capacity visible as enrichment scales)

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort high** — small, mechanical, read-only pipeline change. (`/model claude-opus-4-8` first.)
>
> Implement **Sync DB Size Observability**: at the end of every sync run, log the Supabase database size + the largest tables, and warn past a configurable threshold — so DB usage stays visible as we enrich more tools (RFIs, submittals, change events, commitments, punch). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-04 - Sync DB Size Observability Kickoff.md` (this file)
> - `sync/procore_pipeline.py` + `sync/README.md`
>
> This is **read-only** — no schema changes, no ⛔ DB gate, no app/TypeScript changes. Reuse creds via `sync/.env` (never commit). Verify by running the pipeline and reading the new log lines. Don't commit until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## Why this exists
We're about to enrich record detail (full request→response threads) across several tools,
which grows the `procore_*_master` tables. Measured 2026-07-04: the whole DB is **29 MB**
(one project, Orchard Path III); enrichment roughly 2–4×'s the threaded tables. That's tiny
against Supabase Pro's 8 GB — but as we add tools and (later) projects, we want the number
**in front of us each run** instead of discovering it. No files/photos are stored (only
metadata), so growth is bounded, but visibility is cheap and worth having.

## Scope (build) — all in `sync/procore_pipeline.py`
1. Add a small `log_db_size(engine)` helper and call it at the **end of `run_pipeline()`**
   (after the `for tbl in ...: tbl.flush(engine)` loop, before/with the final SUCCESS log).
   It runs read-only queries via the existing SQLAlchemy `engine` and logs:
   - **Total DB size:** `SELECT pg_size_pretty(pg_database_size(current_database()))`.
   - **Top ~8 tables by size:** from `pg_class`/`pg_namespace` (schema `public`,
     `relkind='r'`, `relname LIKE 'procore_%'`), `pg_total_relation_size(oid)`, ordered desc,
     as one INFO line each or a compact summary.
2. **Soft threshold guard:** read `DB_SIZE_WARN_MB` from env (default e.g. `6000` ≈ 75% of
   Pro's 8 GB). If `pg_database_size` in MB exceeds it, `logging.warning(...)` a clear message;
   otherwise stay at INFO. Add `DB_SIZE_WARN_MB` to `sync/.env.example` with a comment.
3. Make it non-fatal: wrap the size logging in its own try/except so a stats hiccup never
   fails a good sync (log a warning and continue). Do NOT let it affect the exit code of a
   successful data sync.

## Optional stretch (only if quick; else note it and stop)
Persist a row per run to a tiny `sync_runs` metadata table (run timestamp, duration,
total rows upserted, db size). That doubles as the **real "last synced" source** the app
still lacks (the header currently shows fetch-time). If you do this, it's a DDL change →
⛔ present the table DDL + RLS (`authenticated_read`, like migrations 0003/0006) and STOP
for approval before applying. Keep it OUT of the core task unless approved.

## Guardrails
- Read-only for the core task — no `CREATE`/`ALTER`/`DROP`, no data writes, no app changes.
- Reuse Procore + Supabase creds via `sync/.env`; never commit secrets. Don't touch the
  Procore app registration.
- Keep the existing compliance behavior intact (allowlist, upsert/scoped-purge,
  failure-vs-empty, jitter, fail-loud) — you're only appending a logging step.

## Exit criteria (the gate)
- `python -m py_compile sync/procore_pipeline.py` clean (run with the venv, e.g.
  `C:/Users/BUrness/Dev/FP-Analytics/.venv/Scripts/python.exe`).
- Run the pipeline (`python sync/procore_pipeline.py` from `sync/` with `sync/.env` filled)
  and confirm the log ends with the **DB size + top-tables** lines (and the WARNING path
  works if you temporarily set `DB_SIZE_WARN_MB` low). Exit code still 0 on success.
- No TypeScript/build gate applies (Python-only change). Then STOP and report.
