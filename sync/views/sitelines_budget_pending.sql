-- ============================================================================
-- Budget Insights, Phase 3 view: sitelines_budget_pending — pending-change
-- exposure per cost code. The single-pane insight Procore silos: how much the
-- budget will move once the OPEN change events land, before they're approved.
--
-- Source (cross-tool): procore_change_events_master (status='open' = pending,
-- i.e. not yet Closed into a CO/budget, not Void) joined to
-- procore_change_event_line_items_master (cost_code_number + estimated_cost_amount).
-- Each open line item's cost is attributed to a budget division by matching its
-- cost_code_number to the primary cost budget's cost_code prefix (same primary_view
-- CTE as sitelines_budget_lines) — so pending exposure rolls up under the SAME
-- divisions as the drill-down. Line items with no cost code yet fall under
-- 'Unassigned'. A negative amount is a de-scope (credit) that would reduce the budget.
--
-- The app's selector adds this to each division's Revised Budget → "projected
-- budget after pending changes land" vs. today's revised. Verified (OP III):
-- 11 rows, $32,505 total exposure across 10 divisions + $5,000 Unassigned,
-- reconciles to the open change-events register.
--
-- Columns (→ the BudgetPending contract shape; mapBudgetPending coerces):
--   project        <- 3051002 → 'opiii'
--   division       <- budget root_cost_code (or 'Unassigned' when the CE line has no cost code)
--   cost_code      <- budget cost_code (or the CE cost_code_name / 'Unassigned' when unmatched)
--   pending_amount <- Σ estimated_cost_amount of the cost code's OPEN change-event line items
--   open_events    <- count of distinct open change events touching the cost code
--
-- security_invoker=true respects deny-all RLS; the change-event tables + budget
-- tables already grant SELECT to `authenticated`. No re-sync — data already synced.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_budget_pending WITH (security_invoker = true) AS
WITH primary_view AS (
    -- one budget view per project: the lowest-id non-profit ("cost") budget.
    SELECT project_id, min(id) AS budget_view_id
    FROM procore_budget_views_master
    WHERE raw->>'name' NOT ILIKE '%profit%'
    GROUP BY project_id
),
budget_cc AS (
    -- cost_code_number ("4-40000.000") → its division + full cost_code, from the primary budget.
    SELECT DISTINCT
        d.project_id,
        split_part(d.raw->>'cost_code', ' - ', 1) AS cc_number,
        d.raw->>'root_cost_code'                  AS division,
        d.raw->>'cost_code'                       AS cost_code
    FROM procore_budget_detail_rows_master d
    JOIN primary_view pv ON pv.project_id = d.project_id AND pv.budget_view_id = d.budget_view_id
),
pending AS (
    -- OPEN change-event line items = budget erosion before approval (excludes Closed / Void).
    SELECT
        li.project_id,
        li.raw->>'cost_code_number'                          AS cc_number,
        li.raw->>'cost_code_name'                            AS cc_name,
        NULLIF(li.raw->>'estimated_cost_amount','')::numeric AS est_cost,
        ce.raw->>'id'                                        AS change_event_id
    FROM procore_change_events_master ce
    JOIN procore_change_event_line_items_master li
      ON li.project_id = ce.project_id AND li.raw->>'change_event_id' = ce.raw->>'id'
    WHERE ce.project_id = 3051002 AND ce.raw->>'status' = 'open'
)
SELECT
    CASE p.project_id WHEN 3051002 THEN 'opiii' END          AS project,
    COALESCE(bc.division, 'Unassigned')                      AS division,
    COALESCE(bc.cost_code, p.cc_name, 'Unassigned')          AS cost_code,
    round(sum(COALESCE(p.est_cost, 0)), 2)                   AS pending_amount,
    count(DISTINCT p.change_event_id)                        AS open_events
FROM pending p
LEFT JOIN budget_cc bc ON bc.project_id = p.project_id AND bc.cc_number = p.cc_number
GROUP BY p.project_id, COALESCE(bc.division, 'Unassigned'), COALESCE(bc.cost_code, p.cc_name, 'Unassigned')
ORDER BY division, cost_code;
