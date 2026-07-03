-- ============================================================================
-- Phase 2 view: sitelines_items — the Item feed the app renders (DATA_CONTRACT §1).
--
-- ⛔ Presented for approval; applied to Supabase only after owner sign-off.
--
-- The view emits ONLY identity + raw fields (id, tool, project, num, title, who,
-- mine, raw_status_label, due_date, links). The app derives urgency, the display
-- date, and status.tone client-side, and applies the ball-in-court TERMINAL rule
-- (src/lib/ballInCourt.ts) — we deliberately do NOT put TERMINAL logic in SQL.
--
-- id matches the app's convention `${tool}:${num}` so cross-tool links resolve.
-- who = 'You' when the ball is with Ben Urness (Procore user 10984722); mine=true.
-- raw_status_label uses each tool's FAITHFUL human label:
--   rfis        -> translated_status  (raw `status` is a token like 'closed_draft')
--   submittals  -> status.name        (status is an object)
--   commitments -> status             (already human: 'Approved'/'Draft')
--
-- v1 covers rfis + submittals + commitments (high-confidence mappings). Change
-- Orders and Invoicing are deferred pending two decisions (see the kickoff notes).
-- ============================================================================

-- security_invoker=true: the view runs with the QUERYING role's privileges, so it
-- respects the deny-all RLS on the underlying tables (a plain view would run as its
-- owner and bypass RLS, re-exposing the data). Phase 3 adds the read policy + key.
CREATE OR REPLACE VIEW sitelines_items WITH (security_invoker = true) AS

-- RFIs -----------------------------------------------------------------------
SELECT
    'rfis:#' || (raw->>'full_number')                              AS id,
    'rfis'                                                         AS tool,
    'opiii'                                                        AS project,
    '#' || (raw->>'full_number')                                  AS num,
    raw->>'subject'                                               AS title,
    CASE WHEN raw->>'ball_in_courts' ILIKE '%Ben Urness%'
         THEN 'You' ELSE NULLIF(raw->>'ball_in_courts', '') END   AS who,
    COALESCE(raw->>'ball_in_courts', '') ILIKE '%Ben Urness%'      AS mine,
    raw->>'translated_status'                                     AS raw_status_label,
    NULLIF(raw->>'due_date', '')                                  AS due_date,
    NULL::text[]                                                  AS links
FROM procore_rfis_master
WHERE project_id = 3051002

UNION ALL
-- Submittals -----------------------------------------------------------------
SELECT
    'submittals:' || (raw->>'formatted_number'),
    'submittals',
    'opiii',
    raw->>'formatted_number',
    raw->>'title',
    CASE WHEN raw->>'ball_in_court' ILIKE '%Ben Urness%'
         THEN 'You' ELSE NULLIF(raw->>'ball_in_court', '') END,
    COALESCE(raw->>'ball_in_court', '') ILIKE '%Ben Urness%',
    raw#>>'{status,name}',
    NULLIF(raw->>'due_date', ''),
    NULL::text[]
FROM procore_submittals_master
WHERE project_id = 3051002

UNION ALL
-- Commitments ----------------------------------------------------------------
SELECT
    'commitments:' || (raw->>'number'),
    'commitments',
    'opiii',
    raw->>'number',
    raw->>'title',
    NULLIF(raw#>>'{vendor,name}', ''),          -- a vendor holds a commitment, not Ben
    false,
    raw->>'status',
    NULLIF(raw->>'delivery_date', ''),
    NULL::text[]
FROM procore_commitments_master
WHERE project_id = 3051002;
