-- ============================================================================
-- Sitelines sync — Migration 0009: commitment SOV line items (Commitments Phase 3)
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- The commitment LIST endpoint omits the Schedule of Values; the per-commitment
-- DETAIL (show) endpoint carries line_items[] (cost code + amount + a direct
-- budget_line_item_id) — the join that powers the Budget↔Commitment cross-link
-- (Phase 4). This is the flattened child of procore_commitments_master, keyed by
-- the line item's own id (a real subcontract's SOV has several lines per
-- commitment), exactly like procore_change_event_line_items_master.
--
-- raw-JSONB-first (see 0001): the pipeline stores each full line item in `raw`;
-- the Phase-4 sitelines_commitment_line_items view maps cost_code / amount /
-- budget_line_item_id out of it. Keyed for UPSERT + scoped purge.
-- ============================================================================

CREATE TABLE IF NOT EXISTS procore_commitment_line_items_master (
    line_item_id  bigint      NOT NULL,
    project_id    bigint      NOT NULL,
    raw           jsonb       NOT NULL,
    synced_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (line_item_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_commitment_line_items_master_project
    ON procore_commitment_line_items_master (project_id);

-- Match the security posture of every other master (migrations 0003 + 0006):
-- deny-all RLS, with SELECT for logged-in users only. The pipeline connects as the
-- table owner and bypasses RLS; the security_invoker Phase-4 view reads it as the
-- authenticated role.
ALTER TABLE public.procore_commitment_line_items_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY authenticated_read ON procore_commitment_line_items_master
    FOR SELECT TO authenticated USING (true);
