-- ============================================================================
-- Invoicing, Phase 5 view: sitelines_invoice_line_items — one row per pay-app SOV
-- line (the AIA G703 continuation sheet) for OP III. The line-by-line billing
-- behind each pay app's G702 cover sheet: what was billed this period vs. from the
-- previous application vs. to date, against the scheduled value, with retainage and
-- balance to finish. Reference data; the drawer renders it as the schedule of values.
-- Raw DOLLARS; the selector layer orders + subtotals (DATA_CONTRACT §6).
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- Source: procore_requisition_line_items_master (migration 0012), populated by the
-- Phase-4 enrichment from the `/requisitions/{id}/detail` endpoint for the latest pay
-- app per commitment. Verified (read-only, 2026-07-13, project 3051002): 615 raw lines
-- → 452 substantive after the empty-line filter; 49 pay apps; every pay app's line-sum
-- billed_to_date reconciles to sitelines_invoices.billed_to_date (0 off).
--
-- Column notes:
--   id           <- 'invoicing:<req id>:li:<line item id>' (the per-pay-app line's own id).
--   invoice_id   <- 'invoicing:<req id>' → matches sitelines_invoices.id (the drawer filter).
--   pct_complete <- computed billed/scheduled*100 (Procore's own percent field can be the
--                   literal 'NaN' on zero-scheduled lines); NULL when no scheduled value.
--   The WHERE drops fully-empty placeholder lines (no scheduled value AND nothing billed) —
--   they carry $0 so reconciliation is unaffected; keeps the SOV readable.
--
-- security_invoker=true respects deny-all RLS; the master carries authenticated_read
-- (migration 0012). Read-only over the synced table; no re-sync.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_invoice_line_items WITH (security_invoker = true) AS
SELECT
    'opiii'                                                                          AS project,
    'invoicing:' || (raw->>'requisition_id') || ':li:' || (raw->>'line_item_id')      AS id,
    'invoicing:' || (raw->>'requisition_id')                                          AS invoice_id,
    NULLIF(raw->>'item_number', '')                                                   AS item_number,
    raw->>'description_of_work'                                                       AS description,
    NULLIF(raw->>'scheduled_value', '')::numeric                                      AS scheduled_value,
    NULLIF(raw->>'work_completed_from_previous_application', '')::numeric             AS from_previous,
    NULLIF(raw->>'work_completed_this_period', '')::numeric                           AS this_period,
    NULLIF(raw->>'materials_presently_stored', '')::numeric                           AS stored,
    NULLIF(raw->>'total_completed_and_stored_to_date', '')::numeric                   AS billed_to_date,
    CASE WHEN NULLIF(raw->>'scheduled_value', '')::numeric > 0
         THEN round(NULLIF(raw->>'total_completed_and_stored_to_date', '')::numeric
                  / NULLIF(raw->>'scheduled_value', '')::numeric * 100, 2)
         ELSE NULL END                                                               AS pct_complete,
    NULLIF(raw->>'total_retainage_currently_retained', '')::numeric                   AS retainage,
    NULLIF(raw->>'balance_to_finish', '')::numeric                                    AS balance_to_finish
FROM procore_requisition_line_items_master
WHERE project_id = 3051002
  AND (COALESCE(NULLIF(raw->>'scheduled_value', '')::numeric, 0) <> 0
       OR COALESCE(NULLIF(raw->>'total_completed_and_stored_to_date', '')::numeric, 0) <> 0);
