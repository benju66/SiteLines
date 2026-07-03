-- ============================================================================
-- Phase 2 view: sitelines_contacts — the Directory (DATA_CONTRACT §4).
--
-- Built from procore_users_master (people — the rich source: name, role/job_title,
-- company, email, phone) + procore_vendors_master (companies — sparse: name + phone).
-- The seed directory mixes people and companies, so we emit both, id-namespaced.
--
-- Required Contact string fields are COALESCEd to '' so the UI never gets null.
-- projects is ['opiii'] (this is OP III's directory); match (record-association hint)
-- is deferred to Phase 3/4 party resolution. security_invoker=true respects RLS.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_contacts WITH (security_invoker = true) AS

-- People (Procore users) -----------------------------------------------------
SELECT
    'user:' || id                                             AS id,
    COALESCE(raw->>'name', '')                                AS name,
    COALESCE(NULLIF(raw#>>'{vendor,name}', ''), '')           AS company,
    COALESCE(NULLIF(raw->>'job_title', ''), '')               AS role,
    ''                                                        AS trade,   -- users carry no trade
    COALESCE(NULLIF(raw->>'email_address', ''), '')           AS email,
    COALESCE(NULLIF(raw->>'business_phone', ''),
             NULLIF(raw->>'mobile_phone', ''), '')            AS phone,
    ARRAY['opiii']::text[]                                    AS projects,
    NULL::text                                                AS match
FROM procore_users_master
WHERE project_id = 3051002 AND raw->>'is_active' = 'true'

UNION ALL
-- Companies (Procore vendors) ------------------------------------------------
SELECT
    'vendor:' || id,
    COALESCE(raw->>'name', ''),
    COALESCE(raw->>'name', ''),
    'Vendor',
    COALESCE(NULLIF(raw->>'trade_name', ''), ''),
    COALESCE(NULLIF(raw->>'email_address', ''), ''),
    COALESCE(NULLIF(raw->>'business_phone', ''),
             NULLIF(raw->>'mobile_phone', ''), ''),
    ARRAY['opiii']::text[],
    NULL::text
FROM procore_vendors_master
WHERE project_id = 3051002 AND raw->>'is_active' = 'true';
