-- ============================================================================
-- Commitments, Phase 2 views: the commitment detail drawer's two lazily-loaded
-- lists — the change-order log and the billing (pay-application) history — each
-- one row per underlying record, keyed by the commitment's seam id
-- ('commitments:<procore id>') so the app can filter with a single .eq().
-- Read-only over the existing masters; the descriptive fields (description,
-- dates, privacy) already ride on sitelines_commitments, so these carry only the
-- two per-commitment lists. Raw DOLLARS + Procore's 0–100 percent (the mapper
-- coerces / the drawer formats — DATA_CONTRACT §6).
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- sitelines_commitment_change_orders: one row per non-Void commitment change
--   order (link contract_id = commitment id). Void COs (dead paper) excluded, to
--   match the co_count/co_total summary already on sitelines_commitments.
-- sitelines_commitment_billings: one row per requisition (subcontractor pay app;
--   link commitment_id). Carries the AIA G702 period, billed-to-date, and this
--   period's payment due. percent_complete arrives as "92.00%" → stripped here.
--
-- Both security_invoker=true; the two masters already grant the authenticated_read
-- SELECT policy (same basis sitelines_commitments reads them). No re-sync — data
-- already synced. The app orders the rows (pure selectors), so no ORDER BY here.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_commitment_change_orders WITH (security_invoker = true) AS
SELECT
    'commitments:' || (raw->>'contract_id')                    AS commitment,
    raw->>'number'                                             AS number,
    raw->>'title'                                              AS title,
    NULLIF(raw->>'grand_total', '')::numeric                   AS amount,
    raw->>'status'                                             AS status,
    COALESCE((raw->>'executed')::boolean, false)               AS executed,
    NULLIF(raw->>'created_at', '')                             AS created_at
FROM procore_commitment_change_orders_master
WHERE project_id = 3051002 AND raw->>'status' <> 'Void';

CREATE OR REPLACE VIEW sitelines_commitment_billings WITH (security_invoker = true) AS
SELECT
    'commitments:' || (raw->>'commitment_id')                              AS commitment,
    raw->>'number'                                                         AS number,
    raw->>'invoice_number'                                                 AS invoice_number,
    raw#>>'{summary,formatted_period}'                                     AS period,
    NULLIF(raw->>'billing_date', '')                                       AS billing_date,
    raw->>'status'                                                         AS status,
    NULLIF(replace(raw->>'percent_complete', '%', ''), '')::numeric        AS pct_complete,
    NULLIF(raw#>>'{summary,total_completed_and_stored_to_date}', '')::numeric AS billed_to_date,
    NULLIF(raw#>>'{summary,current_payment_due}', '')::numeric             AS this_period
FROM procore_requisitions_master
WHERE project_id = 3051002;
