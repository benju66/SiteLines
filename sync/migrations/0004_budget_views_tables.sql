-- ============================================================================
-- Migration 0004 — Budget Views tables (replace the private budget endpoint).
--
-- Drops procore_budgets_master (populated from the PRIVATE /budget_line_items
-- endpoint) and adds three tables sourced from the PUBLIC Budget Views API:
--   * procore_budget_views_master        — the project's budget view(s)
--   * procore_budget_detail_rows_master  — per-cost-code rows incl. calculated
--     columns (committed, invoiced) that sitelines_financials needs
--   * procore_budget_detail_columns_master — the view's column definitions
--     (so a view can map which calculated column is committed vs invoiced)
--
-- detail rows/columns belong to a specific budget view, so budget_view_id is part
-- of their key. RLS enabled deny-all, matching every other master table.
-- ============================================================================

DROP TABLE IF EXISTS procore_budgets_master;

CREATE TABLE IF NOT EXISTS procore_budget_views_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_budget_views_master_project ON procore_budget_views_master (project_id);

CREATE TABLE IF NOT EXISTS procore_budget_detail_rows_master (
    id             bigint      NOT NULL,
    budget_view_id bigint      NOT NULL,
    project_id     bigint      NOT NULL,
    raw            jsonb       NOT NULL,
    synced_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, budget_view_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_budget_detail_rows_master_project ON procore_budget_detail_rows_master (project_id);

CREATE TABLE IF NOT EXISTS procore_budget_detail_columns_master (
    id             bigint      NOT NULL,
    budget_view_id bigint      NOT NULL,
    project_id     bigint      NOT NULL,
    raw            jsonb       NOT NULL,
    synced_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, budget_view_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_budget_detail_columns_master_project ON procore_budget_detail_columns_master (project_id);

ALTER TABLE public.procore_budget_views_master           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_budget_detail_rows_master     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_budget_detail_columns_master  ENABLE ROW LEVEL SECURITY;
