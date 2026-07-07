-- ============================================================================
-- Budget Insights, Phase 1 view: sitelines_budget_lines — one row per BUDGET
-- LINE (WBS row = cost_code × category) in the primary cost budget. The app's
-- BudgetView drills division → cost code from these lines; the pure
-- budgetByDivision selector groups + subtotals them (Budget · Committed · %
-- bought out · Uncommitted · Projected Over/Under). This view emits raw DOLLARS
-- (one value per line, unaggregated) — the selector layer formats $ / % and
-- computes derived values (DATA_CONTRACT §6: never store derived).
--
-- Source: procore_budget_detail_rows_master (Budget Views detail rows). Each
-- project has several budget views; we use the PRIMARY cost budget (lowest-id,
-- non-profit) — the same primary_view CTE as sitelines_financials — so numbers
-- aren't double-counted. Verified: this line-level view rolls up to the penny
-- against sitelines_financials (budget 18,426,571.05 · committed 16,659,240.14
-- · projected O/U +130,625.55 for OP III).
--
-- Grain: 124 lines across 115 cost codes / 23 divisions for project 3051002.
-- Nine cost codes carry two category lines (Material + Subcontract); (cost_code,
-- category) is unique. One row per LINE (not per code) keeps money exact AND
-- preserves the single `category` each line needs for the Phase 2 cost-type mix.
--
-- Columns (→ the BudgetLine contract shape; mapBudgetLine does final coercion):
--   project              <- 3051002 → 'opiii' (only OP III is synced for budget)
--   division             <- root_cost_code    ("9 - Division 09 - Finishes")
--   cost_code            <- cost_code          ("9-92116.000 - Gypsum Board Assemblies")
--   category             <- category           ("Labor" | "Material" | "Subcontract")
--   budget               <- "Revised Budget"
--   committed            <- "Committed Costs"
--   jtd_costs            <- "Job to Date Costs" (NULL in this view — actuals live
--                           in procore_direct_costs_master; kept nullable)
--   eac                  <- "Estimated Cost at Completion"
--   pending_cos          <- "Pending COs"        (feeds Phase 3)
--   projected_over_under <- "Projected over Under" (NEGATIVE = over budget)
--
-- security_invoker=true respects deny-all RLS; procore_budget_detail_rows_master
-- and procore_budget_views_master already grant SELECT to `authenticated`
-- (same basis sitelines_financials reads them). No re-sync — data already synced.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_budget_lines WITH (security_invoker = true) AS
WITH primary_view AS (
    -- one budget view per project: the lowest-id non-profit ("cost") budget.
    SELECT project_id, min(id) AS budget_view_id
    FROM procore_budget_views_master
    WHERE raw->>'name' NOT ILIKE '%profit%'
    GROUP BY project_id
)
SELECT
    CASE d.project_id WHEN 3051002 THEN 'opiii' END                          AS project,
    d.raw->>'root_cost_code'                                                 AS division,
    d.raw->>'cost_code'                                                      AS cost_code,
    d.raw->>'category'                                                       AS category,
    COALESCE(NULLIF(d.raw->>'Revised Budget','')::numeric, 0)               AS budget,
    COALESCE(NULLIF(d.raw->>'Committed Costs','')::numeric, 0)              AS committed,
    NULLIF(d.raw->>'Job to Date Costs','')::numeric                          AS jtd_costs,
    COALESCE(NULLIF(d.raw->>'Estimated Cost at Completion','')::numeric, 0)  AS eac,
    COALESCE(NULLIF(d.raw->>'Pending COs','')::numeric, 0)                  AS pending_cos,
    COALESCE(NULLIF(d.raw->>'Projected over Under','')::numeric, 0)         AS projected_over_under
FROM procore_budget_detail_rows_master d
JOIN primary_view pv
  ON pv.project_id = d.project_id AND pv.budget_view_id = d.budget_view_id
WHERE d.project_id = 3051002
ORDER BY d.raw->>'root_cost_code', d.raw->>'cost_code', d.raw->>'category';
