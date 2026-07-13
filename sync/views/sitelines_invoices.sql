-- ============================================================================
-- Invoicing, Phase 1 view: sitelines_invoices — one row per subcontractor pay
-- application (requisition) for OP III. The project-wide billing log: vendor +
-- contract + period + this-period + cumulative billed/retainage + status, plus
-- the AIA G702 cover-sheet totals for the Phase-2 drawer (so Phase 2 needs no new
-- view). Raw DOLLARS; the selector layer formats and rolls up (DATA_CONTRACT §6).
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- ⚠️ The load-bearing field is `is_latest`: the most recent pay app per commitment
-- (billing_date desc, id-tiebroken). CUMULATIVE G702 fields (billed, retainage)
-- are cumulative-to-that-pay-app, so the app rollup sums them over `is_latest`
-- rows ONLY — summing all rows double-counts. Verified (read-only, 2026-07-13,
-- project 3051002): 200 pay apps · 49 latest (= 49 distinct commitments) · 1 Under
-- Review · Σ latest billed = $15,285,899.19 and Σ latest retainage = $622,876.68 —
-- both tie to Commitments (sitelines_commitments) to the penny.
--
-- Column notes:
--   id            <- 'invoicing:<requisition id>' (matches the sitelines_items feed).
--   number        <- invoice_number, else the requisition number.
--   commitment_id <- 'commitments:' || commitment_id → matches sitelines_commitments.id
--                    (which keys off the commitment's id) for the Invoice → Commitment
--                    cross-link. All 200 pay apps carry a commitment_id (0 null).
--   period        <- summary.formatted_period ("05/01/26 - 05/31/26").
--   billing_date  <- raw ISO (the app sorts on it, then formats for display).
--   this_period   <- summary.current_payment_due (NET of retainage — do NOT sum as billed).
--   billed/ret    <- summary.total_completed_and_stored_to_date / total_retainage (cumulative).
--   G702 tail     <- original_contract_sum, contract_sum_to_date, net_change_by_change_orders,
--                    total_earned_less_retainage, balance_to_finish_including_retainage.
--
-- Owner-side pay apps (procore_payment_applications_master, money IN) are NOT in
-- this view — only 1 is synced for OP III; the Phase-2 drawer notes it. security_
-- invoker=true respects deny-all RLS; procore_requisitions_master already grants
-- SELECT to `authenticated` (used by sitelines_commitment_billings). No re-sync.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_invoices WITH (security_invoker = true) AS
WITH req AS (
    SELECT
        r.raw,
        row_number() OVER (
            PARTITION BY r.raw->>'commitment_id'
            ORDER BY NULLIF(r.raw->>'billing_date', '')::date DESC NULLS LAST, (r.raw->>'id')::bigint DESC
        ) AS rn
    FROM procore_requisitions_master r
    WHERE r.project_id = 3051002
)
SELECT
    'opiii'                                                                          AS project,
    'invoicing:' || (raw->>'id')                                                     AS id,
    COALESCE(NULLIF(raw->>'invoice_number', ''), raw->>'number')                      AS number,
    NULLIF(raw->>'vendor_name', '')                                                   AS vendor,
    NULLIF(raw->>'contract_name', '')                                                 AS contract,
    CASE WHEN raw->>'commitment_id' IS NOT NULL
         THEN 'commitments:' || (raw->>'commitment_id') END                          AS commitment_id,
    NULLIF(raw#>>'{summary,formatted_period}', '')                                    AS period,
    NULLIF(raw->>'billing_date', '')                                                  AS billing_date,
    raw->>'status'                                                                    AS status,
    COALESCE((raw->>'final')::boolean, false)                                         AS final,
    (rn = 1)                                                                          AS is_latest,
    NULLIF(raw#>>'{summary,current_payment_due}', '')::numeric                        AS this_period,
    NULLIF(raw#>>'{summary,total_completed_and_stored_to_date}', '')::numeric         AS billed_to_date,
    NULLIF(raw#>>'{summary,total_retainage}', '')::numeric                            AS retainage,
    NULLIF(replace(raw->>'percent_complete', '%', ''), '')::numeric                   AS pct_complete,
    NULLIF(raw#>>'{summary,original_contract_sum}', '')::numeric                      AS original,
    NULLIF(raw#>>'{summary,contract_sum_to_date}', '')::numeric                       AS revised,
    NULLIF(raw#>>'{summary,net_change_by_change_orders}', '')::numeric                AS net_change_by_cos,
    NULLIF(raw#>>'{summary,total_earned_less_retainage}', '')::numeric               AS earned_less_retainage,
    NULLIF(raw#>>'{summary,balance_to_finish_including_retainage}', '')::numeric      AS balance_to_finish
FROM req;
