-- ============================================================================
-- Migration 0002 — re-scope the directory tables from company-wide to per-project.
--
-- ⛔ Applied to Supabase ONLY after explicit owner approval.
--
-- WHY: procore_vendors_master / procore_users_master were populated from Procore's
-- COMPANY-wide directory endpoints, which ignore the DMSA's project scope and returned
-- the entire Fendler Patterson book (~2,809 vendors, ~4,614 users) when the app only
-- operates on the allowlisted project(s). This re-scopes them to (id, project_id) so
-- the pipeline pulls only each allowlisted project's directory (minimum-necessary).
--
-- The DROP also clears the over-retrieved company-wide rows. These tables hold cache
-- data re-derivable from Procore, so dropping is safe. The next pipeline run repopulates
-- them with the allowlisted project(s) only.
-- ============================================================================

DROP TABLE IF EXISTS procore_vendors_master;
CREATE TABLE procore_vendors_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_vendors_master_project ON procore_vendors_master (project_id);

DROP TABLE IF EXISTS procore_users_master;
CREATE TABLE procore_users_master (
    id          bigint      NOT NULL,
    project_id  bigint      NOT NULL,
    raw         jsonb       NOT NULL,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_users_master_project ON procore_users_master (project_id);
