-- ============================================================================
-- Migration 0003 — enable Row Level Security (deny-all) on every master table.
--
-- Enabling RLS with NO policies denies the anon/authenticated roles all access,
-- closing the exposure flagged by Supabase's security advisor (the anon key could
-- otherwise read/modify every row, including financials). The pipeline is unaffected:
-- it connects as the table-owner postgres role, which bypasses RLS.
--
-- Phase 3 adds explicit read policies for the app's restricted key when it's wired.
-- ============================================================================

ALTER TABLE public.procore_projects_master               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_vendors_master                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_users_master                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_change_order_statuses_master  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_budgets_master                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_budget_modifications_master   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_budget_meta_master            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_change_events_master          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_change_event_line_items_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_change_order_packages_master  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_change_order_requests_master  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_commitments_master            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_commitment_change_orders_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_prime_contracts_master        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_payment_applications_master   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_prime_change_orders_master    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_potential_change_orders_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_requisitions_master           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_direct_costs_master           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_rfis_master                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_submittals_master             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procore_submittal_approvers           ENABLE ROW LEVEL SECURITY;
