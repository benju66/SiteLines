-- ============================================================================
-- Migration 0005 — drop procore_budget_detail_columns_master.
--
-- The Budget Views detail_rows return their calculated columns INLINE as named keys
-- (e.g. "Committed Costs", "Commitments Invoiced"), so the separate column-definition
-- table (created in 0004) is unnecessary. It also had a type mismatch (column ids are
-- text identifiers, not bigint). Dropping it; the pipeline no longer populates it.
-- ============================================================================

DROP TABLE IF EXISTS procore_budget_detail_columns_master;
