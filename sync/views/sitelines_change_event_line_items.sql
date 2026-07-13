-- ============================================================================
-- Change Events, Phase 2 view: sitelines_change_event_line_items — one row per
-- change-event line item (OP III). The priced lines behind each change event:
-- cost code + estimated cost + the commitment the line hits (the Change-Event →
-- Commitment cross-link). Feeds the Change Events detail drawer (loaded in the
-- main snapshot, not lazily — 242 rows, small like the commitment SOV). Raw
-- DOLLARS (negative = a de-scope credit); the selector layer groups by cost code
-- and subtotals (DATA_CONTRACT §6: never store derived).
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- Verified against the masters (read-only dry run, 2026-07-13, project 3051002):
--   242 line items (242 distinct ids) · 21 with no cost code (→ 'Unassigned' in
--   the selector) · 180 linked to a commitment across 40 distinct commitments.
--   Reconciliation: every change event's Σ(line amount) equals the Phase-1
--   sitelines_change_events.est_cost EXACTLY (0 events off), so the drawer's
--   per-cost-code subtotals tie to the register's estimated cost.
--
-- Column notes:
--   id             <- 'changeEvents:<ce id>:li:<line_item_id>' — stable list key.
--   change_event_id<- 'changeEvents:<ce id>' — matches sitelines_change_events.id
--                     (the drawer filters the slice by this).
--   commitment_id  <- resolves contract_number → the commitment's Procore id as
--                     'commitments:<id>' (matches sitelines_commitments.id, which
--                     keys off the commitment's id, NOT its number). NULL when the
--                     line hits no commitment. The LEFT JOIN is 1:0-or-1 (commitment
--                     numbers are unique per project), so it never fans out rows.
--   commitment_number <- the raw contract_number (e.g. 'SC-25-117-220'); shown even
--                     when it doesn't resolve to a synced commitment.
--
-- security_invoker=true respects deny-all RLS; both masters already grant SELECT
-- to `authenticated` (same as sitelines_change_events / sitelines_commitments).
-- Read-only over existing tables; no re-sync — data already synced.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_change_event_line_items WITH (security_invoker = true) AS
SELECT
    'opiii'                                                                                    AS project,
    'changeEvents:' || (li.raw->>'change_event_id') || ':li:' || (li.raw->>'line_item_id')     AS id,
    'changeEvents:' || (li.raw->>'change_event_id')                                            AS change_event_id,
    NULLIF(li.raw->>'cost_code_number', '')                                                    AS cost_code,
    NULLIF(li.raw->>'cost_code_name', '')                                                      AS cost_code_name,
    round(COALESCE(NULLIF(li.raw->>'estimated_cost_amount', '')::numeric, 0), 2)               AS amount,
    li.raw->>'description'                                                                     AS description,
    NULLIF(li.raw->>'contract_number', '')                                                     AS commitment_number,
    CASE WHEN c.raw->>'id' IS NOT NULL THEN 'commitments:' || (c.raw->>'id') END               AS commitment_id
FROM procore_change_event_line_items_master li
LEFT JOIN procore_commitments_master c
  ON c.project_id = li.project_id AND c.raw->>'number' = li.raw->>'contract_number'
WHERE li.project_id = 3051002;
