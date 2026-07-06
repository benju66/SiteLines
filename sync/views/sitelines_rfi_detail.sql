-- ============================================================================
-- Record Detail Enrichment, Phase 1 view: sitelines_rfi_detail
-- The RFI request→response thread + metadata the detail drawer renders (one row
-- per RFI).
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- Source: procore_rfis_master.raw, enriched by the pipeline's
-- enrich_rfis_with_detail() — which stores the RFI *detail* endpoint's
-- `questions[]` (each with `answers[]` and `attachments[]`) as a JSONB array.
-- This view flattens that into:
--   • request            — the question narrative (all question bodies joined)
--   • proposed_solution  — optional narrative field
--   • instructions       — optional narrative field
--   • responses          — JSONB array of {author, date, text, official}, one
--                          per answer across all questions, oldest-first
--   • assignees          — the full assignee list (pipeline-flattened to a
--                          comma-joined string of names)
--   • closed_date        — time_resolved (set when the RFI is answered/closed)
--   • procore_url        — deep link to open the RFI in Procore (raw `link`)
--   • attachments        — JSONB array of {name, url} across the request +
--                          all responses. NOTE: url is a pre-signed Procore
--                          storage link — freshest right after a sync.
--
-- Keyed by the Item id `rfis:<id>` so the app looks it up by the opened row's id.
-- security_invoker=true → respects the deny-all RLS on procore_rfis_master
-- (reads succeed only for the `authenticated` role, per migration 0006).
--
-- Field-name resilience: Procore answer/question bodies arrive as
-- plain_text_body / body / rich_text_body depending on the record; we COALESCE
-- across them. answer.created_by is a display-name STRING (with a defensive
-- {name} fallback). jsonb_typeof guards let pre-enrichment rows (where
-- `questions` was still the old flattened string, or NULL) return an empty
-- thread instead of erroring. Final HTML→text cleaning happens in the pure
-- mapRfiDetail() mapper.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_rfi_detail WITH (security_invoker = true) AS
SELECT
    'rfis:' || (raw->>'id')                                         AS id,

    CASE WHEN jsonb_typeof(raw->'questions') = 'array' THEN (
        SELECT string_agg(
                   COALESCE(q->>'plain_text_body', q->>'body', q->>'rich_text_body'),
                   E'\n\n')
        FROM jsonb_array_elements(raw->'questions') q
        WHERE COALESCE(q->>'plain_text_body', q->>'body', q->>'rich_text_body') IS NOT NULL
    ) END                                                           AS request,

    NULLIF(raw->>'proposed_solution', '')                           AS proposed_solution,
    NULLIF(raw->>'instructions', '')                                AS instructions,

    CASE WHEN jsonb_typeof(raw->'questions') = 'array' THEN (
        SELECT COALESCE(jsonb_agg(
                   jsonb_build_object(
                       'author',   COALESCE(a->'created_by'->>'name', a->>'created_by'),
                       'date',     a->>'answer_date',
                       'text',     COALESCE(a->>'plain_text_body', a->>'body', a->>'rich_text_body'),
                       'official', COALESCE((a->>'official')::boolean, false))
                   ORDER BY a->>'answer_date'), '[]'::jsonb)
        FROM jsonb_array_elements(raw->'questions') q
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(q->'answers') = 'array' THEN q->'answers' ELSE '[]'::jsonb END) a
    ) ELSE '[]'::jsonb END                                          AS responses,

    NULLIF(raw->>'assignees', '')                                   AS assignees,
    NULLIF(raw->>'time_resolved', '')                               AS closed_date,
    NULLIF(raw->>'link', '')                                        AS procore_url,

    -- All attachments across the request (question) + every response (answer).
    CASE WHEN jsonb_typeof(raw->'questions') = 'array' THEN (
        SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
                   'name', COALESCE(att->>'name', att->>'filename'),
                   'url',  att->>'url')), '[]'::jsonb)
        FROM jsonb_array_elements(raw->'questions') q
        CROSS JOIN LATERAL (
            SELECT qa AS att
            FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(q->'attachments') = 'array' THEN q->'attachments' ELSE '[]'::jsonb END) qa
            UNION ALL
            SELECT aa
            FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(q->'answers') = 'array' THEN q->'answers' ELSE '[]'::jsonb END) ans
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(ans->'attachments') = 'array' THEN ans->'attachments' ELSE '[]'::jsonb END) aa
        ) atts(att)
        WHERE att->>'url' IS NOT NULL
    ) ELSE '[]'::jsonb END                                          AS attachments

FROM procore_rfis_master
WHERE project_id = 3051002;
