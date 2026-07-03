-- ============================================================================
-- Phase 2 view: sitelines_financials — per-division budget rollups (DATA_CONTRACT §6).
--
-- One row per (project, division). The app's selector assembles FinancialSource
-- (divisions[name,budget,committed,invoiced] + approvedChanges + projectedOverUnder)
-- and converts to $M for display — this view emits raw DOLLARS.
--
-- Source: procore_budget_detail_rows_master (Budget Views detail rows). Each project
-- can have several budget views; we use the primary cost budget (excluding profit
-- views) so numbers aren't double-counted. Division = root_cost_code. The financial
-- columns come inline from Procore's calculated columns:
--   budget   <- "Revised Budget"       committed <- "Committed Costs"
--   invoiced <- "Commitments Invoiced"  approved_changes <- "Approved COs"
--   projected_over_under <- "Projected over Under"
-- security_invoker=true respects deny-all RLS.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_financials WITH (security_invoker = true) AS
WITH primary_view AS (
    -- one budget view per project: the lowest-id non-profit ("cost") budget.
    SELECT project_id, min(id) AS budget_view_id
    FROM procore_budget_views_master
    WHERE raw->>'name' NOT ILIKE '%profit%'
    GROUP BY project_id
)
SELECT
    CASE d.project_id WHEN 3051002 THEN 'opiii' END          AS project,
    d.raw->>'root_cost_code'                                 AS division,
    round(sum(COALESCE(NULLIF(d.raw->>'Revised Budget','')::numeric, 0)), 2)        AS budget,
    round(sum(COALESCE(NULLIF(d.raw->>'Committed Costs','')::numeric, 0)), 2)       AS committed,
    round(sum(COALESCE(NULLIF(d.raw->>'Commitments Invoiced','')::numeric, 0)), 2)  AS invoiced,
    round(sum(COALESCE(NULLIF(d.raw->>'Approved COs','')::numeric, 0)), 2)          AS approved_changes,
    round(sum(COALESCE(NULLIF(d.raw->>'Projected over Under','')::numeric, 0)), 2)  AS projected_over_under
FROM procore_budget_detail_rows_master d
JOIN primary_view pv
  ON pv.project_id = d.project_id AND pv.budget_view_id = d.budget_view_id
GROUP BY d.project_id, d.raw->>'root_cost_code'
ORDER BY project, division;
