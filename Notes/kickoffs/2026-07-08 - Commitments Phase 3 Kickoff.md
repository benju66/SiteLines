# Kickoff — Commitments, Phase 3: FP-Analytics sync change (commitment SOV line items + detail fields)

> ⚠️ **Cross-repo:** this phase is work in the SIBLING repo
> `C:/Users/BUrness/Dev/FP-Analytics` (the Python Procore→Supabase ETL), **not** Sitelines.
> Sitelines only *depends on* the new data. No Sitelines app code changes here.

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — money-accurate ETL change against a live schema, and step 0 is an ambiguous reconciliation (the repo's pipeline file doesn't match the production schema, so you must first find the code that actually writes the live `raw`-JSONB masters). Correctness matters; a wrong table shape breaks the Phase-4 views. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` mid-session (`/model claude-fable-5`) if the pipeline-discrepancy reconciliation gets gnarly.
>
> Implement **Phase 3 of Commitments** in the **FP-Analytics** repo: add a per-commitment
> Procore detail (show) pull so the Schedule-of-Values line items (cost code + amount +
> `budget_line_item_id`) and the scope detail fields (inclusions/exclusions/grand_total/dates)
> land in Supabase. Read these in full first, then follow them:
> - `Notes/kickoffs/2026-07-08 - Commitments Phase 3 Kickoff.md` (this file, in the Sitelines repo)
> - `Notes/plans/Commitments-Plan.md` § Phase 3 (in the Sitelines repo)
>
> ⛔ **Do step 0 (reconcile the pipeline discrepancy) and STOP for my sign-off before editing
> the pipeline or running any sync.** Never change Procore app scopes. I run the re-sync.

---

## What this phase is (and why)
The synced commitment `description` is a **lossy, flattened** scope blob — Procore strips the
SOV line items, the priced breakdown, inclusions/exclusions, and the list numbering during
sync (verified 2026-07-08 against the live data + a real export, Alpine Cabinetry Casework
`PO-25-117-123`). The structured data lives on the Procore **commitment detail (show)**
endpoint. Pulling it unlocks the Budget↔Commitment cross-link (Phase 4, Sitelines) and the
drawer's real inclusions/exclusions.

**Proven joinable:** the Casework PO's 4 SOV lines carry budget codes `12-123530.000` and
`6-64100.000`, both present verbatim in `procore_budget_detail_rows_master`; they sum to
`$539,086.57`. The detail endpoint also returns a direct **`budget_line_item_id`** per line.

## ⛔ Step 0 — reconcile the pipeline discrepancy (STOP for sign-off after)
The FP-Analytics `procore_pipeline.py` writes **flat, wide columns** (`pandas.json_normalize`
+ `df.to_sql(..., if_exists='replace')`, no `raw` column). But the **live** Supabase masters
are a thin key + JSONB:
- `procore_commitments_master` = `id bigint, project_id bigint, raw jsonb, synced_at timestamptz`
- `procore_change_event_line_items_master` = `line_item_id bigint, project_id bigint, raw jsonb, synced_at`
- `procore_requisitions_master` = `id bigint, project_id bigint, raw jsonb, synced_at`

So the repo file the last investigation read is **not** the code that populated production.
**First task:** find/confirm the actual production sync (the version that writes `raw` +
`synced_at`) — check for another script, branch, or a newer pipeline; confirm how the live
tables are actually produced. Present findings and the intended new-table shape, then STOP.

## ⭐ Also verify at step 0 — is the scope recoverable as structure?
The owner wants the drawer scope to read like the Procore/contract PDF (nested headers +
numbered lists), which the Phase-2 text parser can only approximate because the synced
`description` is flattened (no HTML, no list numbering — confirmed: `has_html_tags = false`
on the current masters). **Decisive check:** pull ONE real `GET /rest/v1.0/commitments/{id}`
response and inspect how the scope comes back:
- If `description` (or a sibling field) is **HTML / rich text with list markup**, or if
  `inclusions`/`exclusions`/`line_items` carry the structure → **store the rich/structured
  form** and the drawer can render it faithfully, automatically, for every commitment (no
  parser, no per-commitment hand-editing, and it survives re-syncs). This is the real answer
  to "make the scope look like the contract."
- If the API returns it **flat too** → the prose narrative can't be auto-structured; only the
  `line_items[]` SOV is structured. Report this so we decide whether the parser stopgap stays.
Report the finding at the step-0 sign-off — it changes how much of the scope UI is worth building.

## Scope (after step 0 is signed off)
Mirror the **live** `procore_change_event_line_items_master` convention (thin key + `raw`
JSONB + `synced_at`), NOT the repo's flat-column pattern.
1. Add a per-commitment `GET /rest/v1.0/commitments/{id}` (show) call in the commitment sync
   loop (a `for c in com` per-commitment GET already exists for CO-requests — mirror it).
2. New **`procore_commitment_line_items_master`**: one row per `line_items[]` entry —
   `line_item_id` (key), `project_id`, `raw` JSONB of the line (carrying `cost_code`,
   `amount`, `total_amount`, `budget_line_item_id`, `description`), `synced_at`.
3. Merge the fuller show response into **`procore_commitments_master.raw`** (the show payload
   is a superset of the list payload), so `inclusions`, `exclusions`, `grand_total`,
   `line_items_total`, `retainage_percent`, contract dates ride along — no separate table.
4. Keep every existing master byte-identical in shape.

## Guardrails / gates
- ⛔ Step 0 sign-off before any pipeline edit; ⛔ owner runs the full re-sync (drop-and-recreate;
  the run lengthens by ~1 GET per commitment — the existing rate-limit handling covers it).
- ⛔ Confirm the Procore Data Connection App already has the Commitments **show** permission in
  the Developer Portal (expected identical to the list scope — but verify). Do **not** add or
  change Procore scopes without owner action.
- The repo is **not git-tracked** — flag before editing; consider `git init` first.
- Read-only from Procore; no writes back. No Sitelines changes in this phase.

## Exit criteria (the gate)
- `procore_commitment_line_items_master` populated for OP III (project `3051002`); per
  commitment, the line-item `amount`s reconcile to that commitment's `grand_total`.
- Spot-check: `PO-25-117-123` shows 4 SOV lines summing to `$539,086.57` across codes
  `12-123530.000` / `6-64100.000`; `inclusions`/`exclusions` present on the commitment `raw`.
- Verified read-only; other masters unchanged. Then STOP — Phase 4 (the Sitelines
  `sitelines_commitment_line_items` view + Budget cross-link) is a separate kickoff.
