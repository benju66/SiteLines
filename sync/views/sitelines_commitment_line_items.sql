-- ============================================================================
-- Commitments, Phase 4 view: sitelines_commitment_line_items — one row per
-- commitment SOV (schedule-of-values) LINE ITEM for OP III. This is the seam
-- for the Budget↔Commitment cross-link: each line item carries the Procore
-- `cost_code.full_code` (e.g. "12-123530.000"), which matches the budget's
-- cost_code prefix ("12-123530.000 - Residential Casework"), so a Budget cost
-- code can drill to the subcontract(s) behind it. Emits raw DOLLARS; the
-- selector layer joins to budget codes + rolls up (DATA_CONTRACT §6: never
-- store derived).
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- Source: procore_commitment_line_items_master (synced in Phase 3 — the
-- per-commitment detail GET flattens each line_items[] entry as `raw`, tagged
-- with line_item_id + commitment_id). Grain: one row per line item. Verified
-- read-only against the master (2026-07-08, project 3051002):
--   479 line items across all 51 real commitments · line_item_id is a clean PK
--   (479 distinct, = raw->>'line_item_id') · every row carries a cost_code with
--   a full_code + name · amount is never null and equals total_amount on every
--   row (no unit/qty split survives on these SOV rows) · all 479 belong to a
--   real (non-template) commitment. The Casework PO (PO-25-117-123 / id
--   13488699) → 9 lines summing to $539,086.57 = its grand_total, across
--   12-123530.000 / 6-64100.000. All 69 distinct line-item cost codes match a
--   budget cost code (exact or "<code> - <title>") — zero unmatched.
--
-- Columns (→ the CommitmentLineItem contract shape; mapCommitmentLineItem
-- does final coercion):
--   project        <- 3051002 → 'opiii' (only OP III is synced)
--   id             <- 'commitments:<commitment_id>:li:<line_item_id>' (stable key)
--   commitment_id  <- 'commitments:<commitment_id>' (matches Commitment.id / the
--                     sitelines_commitments seam id, so the app filters with .eq())
--   cost_code      <- raw->'cost_code'->>'full_code' ("12-123530.000") — the
--                     Budget↔Commitment join key
--   cost_code_name <- raw->'cost_code'->>'name' ("Residential Casework")
--   amount         <- raw->>'amount' (dollars; = total_amount on every row)
--   description    <- raw->>'description' (the SOV line's scope text)
--
-- The EXISTS guard restricts to line items whose commitment is a real
-- (non-template) commitment present in sitelines_commitments — a no-op on
-- today's data (all 479 already qualify), kept so the line-item slice can never
-- reference a commitment id the app doesn't have.
--
-- security_invoker=true respects deny-all RLS; procore_commitment_line_items_master
-- and procore_commitments_master already grant SELECT to `authenticated`
-- (authenticated_read, using true — verified) — no new grants needed. Read-only
-- over existing tables; no re-sync — data already synced.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_commitment_line_items WITH (security_invoker = true) AS
SELECT
    'opiii'                                                                   AS project,
    'commitments:' || (li.raw->>'commitment_id') || ':li:' || li.line_item_id AS id,
    'commitments:' || (li.raw->>'commitment_id')                             AS commitment_id,
    li.raw->'cost_code'->>'full_code'                                        AS cost_code,
    li.raw->'cost_code'->>'name'                                            AS cost_code_name,
    NULLIF(li.raw->>'amount', '')::numeric                                   AS amount,
    li.raw->>'description'                                                    AS description
FROM procore_commitment_line_items_master li
WHERE li.project_id = 3051002
  AND EXISTS (
      SELECT 1
      FROM procore_commitments_master c
      WHERE c.project_id = 3051002
        AND (c.raw->>'id')::bigint = (li.raw->>'commitment_id')::bigint
        AND c.raw->>'number' NOT LIKE '\_%'
  )
ORDER BY (li.raw->>'commitment_id')::bigint, li.line_item_id;
