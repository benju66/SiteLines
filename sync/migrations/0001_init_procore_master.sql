-- ============================================================================
-- Sitelines sync — Procore master tables (Data Seam Phase 1.5)
-- Migration 0001: initial keyed schema for the operational cache.
--
-- ⛔ This DDL is applied to Supabase ONLY after explicit owner approval.
--
-- DESIGN (raw-JSONB-first):
--   Every table stores its declared PRIMARY KEY column(s) + a `raw jsonb` holding
--   the full cleaned Procore record + a `synced_at` timestamp. We deliberately do
--   NOT explode nested Procore fields into typed columns here — that mapping is the
--   job of the Phase 2 Supabase *views* (`sitelines_items`, `sitelines_financials`,
--   …), which read fields out of `raw` (e.g. `raw->>'status'`, `raw->'ball_in_court'`).
--
--   Why: it makes ingestion drift-proof. Procore payloads vary field-to-field and
--   run-to-run; with this shape a new/absent field simply lives (or doesn't) inside
--   `raw` and never breaks the load. The pipeline can therefore UPSERT on stable
--   keys instead of dropping and recreating the table every night.
--
-- KEYS drive the UPSERT (`ON CONFLICT`) and the SCOPED PURGE in the pipeline:
--   * company-scoped tables key on (id) and full-diff on each successful sync;
--   * project-scoped tables key on (…, project_id) and purge only within the
--     projects successfully synced this run — never on a failed fetch.
--
-- All ids are Procore ids (bigint). `synced_at` powers the app's "last synced" badge.
-- ============================================================================

-- ---- Company-scoped reference tables (global; key = id) --------------------

CREATE TABLE IF NOT EXISTS procore_projects_master (
    id         bigint      PRIMARY KEY,
    raw        jsonb       NOT NULL,
    synced_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procore_vendors_master (
    id         bigint      PRIMARY KEY,
    raw        jsonb       NOT NULL,
    synced_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procore_users_master (
    id         bigint      PRIMARY KEY,
    raw        jsonb       NOT NULL,
    synced_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procore_change_order_statuses_master (
    id         bigint      PRIMARY KEY,
    raw        jsonb       NOT NULL,
    synced_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- Project-scoped tables (key = id + project_id) -------------------------

CREATE TABLE IF NOT EXISTS procore_budgets_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_budgets_master_project ON procore_budgets_master (project_id);

CREATE TABLE IF NOT EXISTS procore_budget_modifications_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_budget_mods_master_project ON procore_budget_modifications_master (project_id);

-- One budget summary object per project → key on project_id alone.
CREATE TABLE IF NOT EXISTS procore_budget_meta_master (
    project_id  bigint      PRIMARY KEY,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procore_change_events_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_change_events_master_project ON procore_change_events_master (project_id);

-- Flattened child of change events; project_id added by the refactor (research §5.5).
CREATE TABLE IF NOT EXISTS procore_change_event_line_items_master (
    line_item_id  bigint      NOT NULL,
    project_id    bigint      NOT NULL,
    raw           jsonb       NOT NULL,
    synced_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (line_item_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_ce_line_items_master_project ON procore_change_event_line_items_master (project_id);

CREATE TABLE IF NOT EXISTS procore_change_order_packages_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_co_packages_master_project ON procore_change_order_packages_master (project_id);

CREATE TABLE IF NOT EXISTS procore_change_order_requests_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_cors_master_project ON procore_change_order_requests_master (project_id);

CREATE TABLE IF NOT EXISTS procore_commitments_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_commitments_master_project ON procore_commitments_master (project_id);

CREATE TABLE IF NOT EXISTS procore_commitment_change_orders_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_ccos_master_project ON procore_commitment_change_orders_master (project_id);

CREATE TABLE IF NOT EXISTS procore_prime_contracts_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_prime_contracts_master_project ON procore_prime_contracts_master (project_id);

CREATE TABLE IF NOT EXISTS procore_payment_applications_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_pay_apps_master_project ON procore_payment_applications_master (project_id);

CREATE TABLE IF NOT EXISTS procore_prime_change_orders_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_pccos_master_project ON procore_prime_change_orders_master (project_id);

CREATE TABLE IF NOT EXISTS procore_potential_change_orders_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_pcos_master_project ON procore_potential_change_orders_master (project_id);

CREATE TABLE IF NOT EXISTS procore_requisitions_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_requisitions_master_project ON procore_requisitions_master (project_id);

CREATE TABLE IF NOT EXISTS procore_direct_costs_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_direct_costs_master_project ON procore_direct_costs_master (project_id);

CREATE TABLE IF NOT EXISTS procore_rfis_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_rfis_master_project ON procore_rfis_master (project_id);

CREATE TABLE IF NOT EXISTS procore_submittals_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_submittals_master_project ON procore_submittals_master (project_id);

-- Flattened child of submittals; project_id added by the refactor (research §5.5).
CREATE TABLE IF NOT EXISTS procore_submittal_approvers (
    approver_record_id  bigint      NOT NULL,
    project_id          bigint      NOT NULL,
    raw                 jsonb       NOT NULL,
    synced_at           timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (approver_record_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_submittal_approvers_project ON procore_submittal_approvers (project_id);
