-- ============================================================================
-- Commitments, Phase 1 view: sitelines_commitments — one row per REAL
-- commitment (subcontract / purchase order) for OP III, excluding the two
-- `_`-prefixed template rows. The commitments master is header-only (no value),
-- so the financials come from each commitment's LATEST requisition (its AIA
-- G702 summary): original_contract_sum, contract_sum_to_date (= revised),
-- total_completed_and_stored_to_date (= billed), total_retainage, and the
-- requisition's percent_complete. This view emits raw DOLLARS; the selector
-- layer formats $ / % and computes the rollup (DATA_CONTRACT §6: never store
-- derived).
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- Verified against the masters (2026-07-08, read-only dry run, project 3051002):
--   51 commitments (53 − 2 templates) · 49 with a requisition (2 new ones show
--   NULL financials → the app renders "—") · original $16,147,644.27 → revised
--   $16,608,011.78 → billed $15,283,425.15 (= Budget's Invoiced-to-Date, exact)
--   → retainage $622,876.68. The G702 net_change_by_change_orders sums to
--   revised − original to the penny, so `revised` comes from the G702 — the CO
--   log columns (co_count / co_total) are informational (they feed the Phase 2
--   drawer), not the money source of record.
--
-- Latest requisition = max billing_date (id-tiebroken) per commitment_id; all
-- 199 requisitions are status Approved. percent_complete arrives as a string
-- like "5.02%" — stripped here, emitted on the 0–100 scale (mapCommitment
-- converts to 0..1). Vendor names join procore_vendors_master (the master's
-- vendor is a bare {id}); coverage is 100% today, LEFT JOIN so a missing vendor
-- degrades to NULL, not a dropped row. co_count / co_total exclude Void COs
-- (dead paper; 2 of 100) and count Approved ones whether or not executed.
--
-- security_invoker=true respects RLS; all four masters already carry the
-- authenticated_read SELECT policy (verified) — no new grants needed. Read-only
-- over existing tables; no re-sync — data already synced.
--
-- 2026-07-08 Phase 4 addition: inclusions / exclusions / grand_total are ADDITIVE
-- (new columns appended at the END only — CREATE OR REPLACE requires the existing
-- columns keep their order/types; every prior column is byte-identical, so the
-- Phase 1–3 rollup is unchanged). They come from the commitment detail sync
-- (Phase 3), which merged the detail-only scope fields onto the commitment raw.
-- Verified read-only (project 3051002): inclusions on 41 real commitments,
-- exclusions on 15, grand_total on all 53 (incl. templates). inclusions/exclusions
-- are HTML-stripped flat text (a few surviving entities like &amp; / &gt; are
-- decoded in mapCommitment); grand_total = the commitment's SOV total (= Σ its
-- line-item amounts; = original contract sum before COs). No re-sync.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_commitments WITH (security_invoker = true) AS
WITH latest_req AS (
    -- one row per commitment: its most recent pay app (max billing_date)
    SELECT DISTINCT ON ((raw->>'commitment_id')::bigint)
           (raw->>'commitment_id')::bigint                                    AS commitment_id,
           raw->'summary'                                                     AS s,
           NULLIF(replace(raw->>'percent_complete', '%', ''), '')::numeric    AS pct_complete
    FROM procore_requisitions_master
    WHERE project_id = 3051002
    ORDER BY (raw->>'commitment_id')::bigint,
             NULLIF(raw->>'billing_date', '')::date DESC NULLS LAST,
             (raw->>'id')::bigint DESC
),
co_summary AS (
    -- CO log rollup per commitment (contract_id = commitment id); Void excluded
    SELECT (raw->>'contract_id')::bigint                                      AS commitment_id,
           count(*)::int                                                      AS co_count,
           COALESCE(sum(NULLIF(raw->>'grand_total', '')::numeric), 0)         AS co_total
    FROM procore_commitment_change_orders_master
    WHERE project_id = 3051002 AND raw->>'status' <> 'Void'
    GROUP BY 1
)
SELECT
    'opiii'                                                                   AS project,
    'commitments:' || (c.raw->>'id')                                          AS id,
    c.raw->>'number'                                                          AS number,
    c.raw->>'title'                                                           AS title,
    v.raw->>'name'                                                            AS vendor,
    CASE WHEN c.raw->>'number' LIKE 'PO-%' THEN 'PO'
         WHEN c.raw->>'number' LIKE 'SC-%' THEN 'SC'
         ELSE 'Other' END                                                     AS type,
    c.raw->>'status'                                                          AS status,
    COALESCE((c.raw->>'executed')::boolean, false)                            AS executed,
    r.commitment_id IS NOT NULL                                               AS has_requisition,
    NULLIF(r.s->>'original_contract_sum', '')::numeric                        AS original,
    NULLIF(r.s->>'contract_sum_to_date', '')::numeric                         AS revised,
    NULLIF(r.s->>'total_completed_and_stored_to_date', '')::numeric           AS billed,
    NULLIF(r.s->>'total_retainage', '')::numeric                              AS retainage,
    r.pct_complete                                                            AS pct_complete,
    COALESCE(k.co_count, 0)                                                   AS co_count,
    COALESCE(k.co_total, 0)                                                   AS co_total,
    c.raw->>'description'                                                     AS description,
    NULLIF(c.raw->>'delivery_date', '')                                       AS delivery_date,
    COALESCE((c.raw->>'private')::boolean, false)                             AS private,
    -- appended 2026-07-08 (Phase 4; CREATE OR REPLACE appends at the end):
    NULLIF(c.raw->>'inclusions', '')                                          AS inclusions,
    NULLIF(c.raw->>'exclusions', '')                                          AS exclusions,
    NULLIF(c.raw->>'grand_total', '')::numeric                                AS grand_total,
    -- appended 2026-07-20: a CONSTRUCTED Procore deep link to the commitment (the
    -- master has no `link` field). Mirrors the drawings/specs views. company 8906 is
    -- the single synced company; project_id is per-row; the type path is
    -- work_order_contracts for subcontracts (SC-…) and purchase_order_contracts for
    -- POs (PO-…). No re-sync — id + project_id already present.
    'https://app.procore.com/webclients/host/companies/8906/projects/' || c.project_id
        || '/tools/contracts/commitments/'
        || CASE WHEN c.raw->>'number' LIKE 'PO-%' THEN 'purchase_order_contracts'
                ELSE 'work_order_contracts' END
        || '/' || (c.raw->>'id')                                             AS procore_url
FROM procore_commitments_master c
LEFT JOIN procore_vendors_master v ON (v.raw->>'id')::bigint = (c.raw#>>'{vendor,id}')::bigint
LEFT JOIN latest_req r ON r.commitment_id = (c.raw->>'id')::bigint
LEFT JOIN co_summary k ON k.commitment_id = (c.raw->>'id')::bigint
WHERE c.project_id = 3051002 AND c.raw->>'number' NOT LIKE '\_%'
ORDER BY NULLIF(r.s->>'contract_sum_to_date', '')::numeric DESC NULLS LAST, c.raw->>'number';
