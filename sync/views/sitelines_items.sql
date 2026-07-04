-- ============================================================================
-- Phase 2 view: sitelines_items — the Item feed the app renders (DATA_CONTRACT §1).
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- Emits identity + raw fields (id, tool, project, num, title, who, mine,
-- raw_status_label, due_date, amount, links). The app derives urgency, the display
-- string, and status.tone client-side, and applies the ball-in-court TERMINAL rule
-- (src/lib/ballInCourt.ts) — we do NOT put TERMINAL logic in SQL.
--
-- id matches `${tool}:${num}`. who='You' when the ball is with Ben Urness (mine=true).
-- raw_status_label uses each tool's FAITHFUL human label. `amount` carries the
-- dollar value for tools that display money (change orders, invoicing) instead of a
-- due date; NULL elsewhere. security_invoker=true so the view respects deny-all RLS.
--
-- Tools: rfis, submittals, commitments, changeOrders (=prime_change_orders, the
-- owner-facing PCCOs), invoicing (=requisitions, shows amount + status).
-- Note: commitments have no amount on the list endpoint (needs the detail endpoint).
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_items WITH (security_invoker = true) AS

-- RFIs -----------------------------------------------------------------------
SELECT
    'rfis:' || (raw->>'id')                                       AS id,   -- id, not number (numbers can repeat)
    'rfis'                                                        AS tool,
    'opiii'                                                       AS project,
    '#' || (raw->>'full_number')                                 AS num,
    raw->>'subject'                                              AS title,
    CASE WHEN raw->>'ball_in_courts' ILIKE '%Ben Urness%'
         THEN 'You' ELSE NULLIF(raw->>'ball_in_courts', '') END  AS who,
    COALESCE(raw->>'ball_in_courts', '') ILIKE '%Ben Urness%'     AS mine,
    raw->>'translated_status'                                    AS raw_status_label,
    NULLIF(raw->>'due_date', '')                                 AS due_date,
    NULL::numeric                                                AS amount,
    NULL::text[]                                                 AS links
FROM procore_rfis_master
WHERE project_id = 3051002

UNION ALL
-- Submittals -----------------------------------------------------------------
SELECT
    'submittals:' || (raw->>'id'),              -- id: submittal revisions share formatted_number
    'submittals', 'opiii',
    raw->>'formatted_number',
    raw->>'title',
    CASE WHEN raw->>'ball_in_court' ILIKE '%Ben Urness%'
         THEN 'You' ELSE NULLIF(raw->>'ball_in_court', '') END,
    COALESCE(raw->>'ball_in_court', '') ILIKE '%Ben Urness%',
    raw#>>'{status,name}',
    NULLIF(raw->>'due_date', ''),
    NULL::numeric,
    NULL::text[]
FROM procore_submittals_master
WHERE project_id = 3051002

UNION ALL
-- Commitments ----------------------------------------------------------------
SELECT
    'commitments:' || (raw->>'number'),
    'commitments', 'opiii',
    raw->>'number',
    raw->>'title',
    NULLIF(raw#>>'{vendor,name}', ''),
    false,
    raw->>'status',
    NULLIF(raw->>'delivery_date', ''),
    NULL::numeric,
    NULL::text[]
FROM procore_commitments_master
WHERE project_id = 3051002

UNION ALL
-- Change Events (already synced; initcap normalizes 'open'/'Closed') ----------
SELECT
    'changeEvents:' || (raw->>'id'),            -- id: change-event numbers repeat, ids don't
    'changeEvents', 'opiii',
    'CE #' || (raw->>'number'),
    raw->>'title',
    NULL,                                       -- change events carry no ball-in-court
    false,
    initcap(raw->>'status'),
    NULL,
    NULL::numeric,
    NULL::text[]
FROM procore_change_events_master
WHERE project_id = 3051002

UNION ALL
-- Change Orders (owner-facing prime change orders / PCCOs) --------------------
SELECT
    'changeOrders:CO #' || (raw->>'number'),
    'changeOrders', 'opiii',
    'CO #' || (raw->>'number'),
    raw->>'title',
    NULL,                                       -- CO counterparty resolution deferred
    false,
    raw->>'status',
    NULLIF(raw->>'due_date', ''),
    NULLIF(raw->>'grand_total', '')::numeric,
    NULL::text[]
FROM procore_prime_change_orders_master
WHERE project_id = 3051002

UNION ALL
-- Invoicing (subcontractor requisitions — amount + status) -------------------
SELECT
    'invoicing:' || (raw->>'id'),               -- id: invoice_number is not unique
    'invoicing', 'opiii',
    COALESCE(NULLIF(raw->>'invoice_number', ''), raw->>'number'),
    NULLIF(raw->>'contract_name', ''),
    NULLIF(raw->>'vendor_name', ''),
    false,
    raw->>'status',
    NULL,                                       -- invoicing shows an amount, not a due date
    NULLIF(raw->>'total_claimed_amount', '')::numeric,
    NULL::text[]
FROM procore_requisitions_master
WHERE project_id = 3051002

UNION ALL
-- Punch (real court tool — ball_in_court + Open/Overdue/Closed) ---------------
SELECT
    'punch:' || (raw->>'id'), 'punch', 'opiii',
    '#' || (raw->>'position'), raw->>'name',
    CASE WHEN raw->>'ball_in_court' ILIKE '%Ben Urness%' THEN 'You' ELSE NULLIF(raw->>'ball_in_court', '') END,
    COALESCE(raw->>'ball_in_court', '') ILIKE '%Ben Urness%',
    raw->>'status',
    NULLIF(raw->>'due_date', ''),
    NULL::numeric, NULL::text[]
FROM procore_punch_items_master
WHERE project_id = 3051002

UNION ALL
-- Drawings (reference: current sheets only; 'Current' keeps them out of My Court)
SELECT
    'drawings:' || (raw->>'id'), 'drawings', 'opiii',
    raw->>'number', raw->>'title',
    NULL, false,
    'Current',
    NULL, NULL::numeric, NULL::text[]
FROM procore_drawing_revisions_master
WHERE project_id = 3051002 AND (raw->>'current')::boolean

UNION ALL
-- Specifications (reference: 'Issued' keeps them out of My Court) -------------
SELECT
    'specs:' || (raw->>'id'), 'specs', 'opiii',
    raw->>'number', raw->>'description',
    NULL, false,
    'Issued',
    NULL, NULL::numeric, NULL::text[]
FROM procore_specification_sections_master
WHERE project_id = 3051002

UNION ALL
-- Documents (files only; 'Current' keeps them out of My Court) ----------------
SELECT
    'documents:' || (raw->>'id'), 'documents', 'opiii',
    'DOC', raw->>'name',
    NULL, false,
    'Current',
    NULL, NULL::numeric, NULL::text[]
FROM procore_documents_master
WHERE project_id = 3051002 AND raw->>'document_type' = 'file' AND COALESCE((raw->>'is_deleted')::boolean, false) = false

UNION ALL
-- Meetings (occurred -> 'Scheduled'/terminal; upcoming -> 'Agenda Due'/in court) -
SELECT
    'meetings:' || (raw->>'id'), 'meetings', 'opiii',
    COALESCE('#' || NULLIF(raw->>'position', ''), 'MTG'), raw->>'title',
    NULL, false,
    CASE WHEN (raw->>'occurred')::boolean THEN 'Scheduled' ELSE 'Agenda Due' END,
    NULLIF(raw->>'starts_at', ''),
    NULL::numeric, NULL::text[]
FROM procore_meetings_master
WHERE project_id = 3051002;
