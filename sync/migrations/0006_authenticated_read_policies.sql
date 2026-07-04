-- ============================================================================
-- Migration 0006 — allow LOGGED-IN users to read the master tables.
--
-- The sitelines_* views are security_invoker, so they read the master tables AS the
-- querying role. This grants SELECT to the `authenticated` role only — anonymous
-- visitors (no login) still read nothing, and nobody can write. The app requires a
-- Supabase Auth login before it can read live data (Phase 3 security decision).
-- ============================================================================

CREATE POLICY authenticated_read ON procore_projects_master                FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_vendors_master                 FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_users_master                   FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_change_order_statuses_master   FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_budget_views_master            FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_budget_detail_rows_master      FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_budget_modifications_master    FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_budget_meta_master             FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_change_events_master           FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_change_event_line_items_master FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_change_order_packages_master   FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_change_order_requests_master   FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_commitments_master            FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_commitment_change_orders_master FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_prime_contracts_master         FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_payment_applications_master    FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_prime_change_orders_master     FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_potential_change_orders_master FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_requisitions_master            FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_direct_costs_master            FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_rfis_master                    FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_submittals_master              FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON procore_submittal_approvers            FOR SELECT TO authenticated USING (true);
