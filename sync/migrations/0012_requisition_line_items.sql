-- ============================================================================
-- Sitelines sync — Migration 0012: requisition SOV line items (Invoicing Phase 4)
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- The requisition LIST endpoint (/rest/v1.1/requisitions?project_id=) carries the
-- G702 cover-sheet `summary` (totals) but NOT the per-line Schedule of Values. The
-- per-requisition DETAIL (show) endpoint (/rest/v1.1/requisitions/{id}?project_id=)
-- returns `line_items[]` — the AIA G703 continuation sheet: each SOV line with its
-- cost_code, scheduled value, work completed from previous, work completed this
-- period, materials presently stored, percent, retainage, and balance to finish.
-- This is the flattened child of procore_requisitions_master, keyed by the line
-- item's own id (a pay app has several lines), exactly like
-- procore_commitment_line_items_master (0009) and procore_change_event_line_items_master.
--
-- raw-JSONB-first (see 0001): the pipeline stores each full line item in `raw`,
-- tagged with `requisition_id` (the parent pay app) + `commitment_id` (the sub); the
-- Phase-5 sitelines_invoice_line_items view maps the G703 fields out of it, so exact
-- Procore field names don't have to be predicted here. Keyed for UPSERT + scoped purge.
-- ============================================================================

CREATE TABLE IF NOT EXISTS procore_requisition_line_items_master (
    line_item_id  bigint      NOT NULL,
    project_id    bigint      NOT NULL,
    raw           jsonb       NOT NULL,
    synced_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (line_item_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_requisition_line_items_master_project
    ON procore_requisition_line_items_master (project_id);

-- Match the security posture of every other master (migrations 0003 + 0006):
-- deny-all RLS, with SELECT for logged-in users only. The pipeline connects as the
-- table owner and bypasses RLS; the security_invoker Phase-5 view reads it as the
-- authenticated role.
ALTER TABLE public.procore_requisition_line_items_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY authenticated_read ON procore_requisition_line_items_master
    FOR SELECT TO authenticated USING (true);
