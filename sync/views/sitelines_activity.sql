-- ============================================================================
-- Phase 2 view: sitelines_activity — the activity feed (DATA_CONTRACT §7).
--
-- v1 HEURISTIC: a "recently updated" feed across the court tools, ordered by each
-- item's updated_at (created_at for commitments, which have no updated_at). Procore
-- has no event log we sync, so this is the honest, buildable version; richer event
-- semantics (no-response nudges, status-change events, webhooks) can come later.
--
-- Emits raw fields + updated_at; the app derives `when` (timeAgo) and `tone`
-- (statusTone from raw_status_label) client-side. security_invoker=true respects RLS.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_activity WITH (security_invoker = true) AS
WITH ev AS (
    SELECT 'rfis:#' || (raw->>'full_number') AS id, 'RFI' AS label,
           '#' || (raw->>'full_number') AS num, raw->>'subject' AS title,
           raw->>'translated_status' AS status, NULLIF(raw->>'updated_at', '') AS updated_at,
           project_id
    FROM procore_rfis_master
    UNION ALL
    SELECT 'submittals:' || (raw->>'formatted_number'), 'Submittal',
           raw->>'formatted_number', raw->>'title', raw#>>'{status,name}', NULLIF(raw->>'updated_at', ''), project_id
    FROM procore_submittals_master
    UNION ALL
    SELECT 'commitments:' || (raw->>'number'), 'Commitment',
           raw->>'number', raw->>'title', raw->>'status', NULLIF(raw->>'created_at', ''), project_id
    FROM procore_commitments_master
    UNION ALL
    SELECT 'changeOrders:CO #' || (raw->>'number'), 'Change Order',
           'CO #' || (raw->>'number'), raw->>'title', raw->>'status', NULLIF(raw->>'updated_at', ''), project_id
    FROM procore_prime_change_orders_master
    UNION ALL
    SELECT 'invoicing:' || COALESCE(NULLIF(raw->>'invoice_number', ''), raw->>'number'), 'Invoice',
           COALESCE(NULLIF(raw->>'invoice_number', ''), raw->>'number'), NULLIF(raw->>'contract_name', ''),
           raw->>'status', NULLIF(raw->>'updated_at', ''), project_id
    FROM procore_requisitions_master
)
SELECT
    id,
    CASE project_id WHEN 3051002 THEN 'opiii' END        AS project,
    label || ' ' || num || ' — ' || COALESCE(status, '') AS text,
    COALESCE(title, '')                                  AS sub,
    status                                               AS raw_status_label,
    updated_at
FROM ev
WHERE project_id = 3051002 AND updated_at IS NOT NULL
ORDER BY updated_at DESC
LIMIT 50;
