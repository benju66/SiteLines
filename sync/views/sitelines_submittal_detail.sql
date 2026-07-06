-- ============================================================================
-- Record Detail Enrichment, Phase 2 view: sitelines_submittal_detail
-- The submittal narrative + approver-workflow thread the drawer renders (one row
-- per submittal).
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- Unlike RFIs, submittals need NO per-record detail fetch: the list endpoint
-- already carries the approver workflow, which the pipeline extracts into
-- procore_submittal_approvers (author, response decision, comment, dates). This
-- view joins the two:
--   • request      — the submittal description (the narrative)
--   • responses    — the approver workflow as {author, date, text, status,
--                    official}, ordered by workflow group then sent date. `status`
--                    is the reviewer's decision (Approved / Rejected / Revise and
--                    Resubmit / …); comment-less decisions are still meaningful.
--   • assignees    — the distinct reviewer names
--   • closed_date  — closed_at
--   • procore_url  — CONSTRUCTED (Procore returns no link for submittals): the
--                    standard /project/submittal_logs/<id> deep link
--   • attachments  — {name, url} from associated_attachments (present on the
--                    subset of submittals that carry them). Pre-signed URLs —
--                    freshest right after a sync.
--
-- Keyed by the Item id `submittals:<id>`. security_invoker=true → both source
-- tables are read as the querying role (authenticated_read, migration 0006).
-- Final HTML→text cleaning happens in the pure mapSubmittalDetail() mapper.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_submittal_detail WITH (security_invoker = true) AS
SELECT
    'submittals:' || (s.raw->>'id')                                 AS id,

    NULLIF(s.raw->>'description', '')                               AS request,

    -- The approver workflow = the review thread.
    (SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'author',   a.raw->>'approver_name',
                    'date',     COALESCE(NULLIF(a.raw->>'returned_date', ''), NULLIF(a.raw->>'sent_date', '')),
                    'text',     a.raw->>'comment',
                    'status',   a.raw->>'response',
                    'official', (a.raw->>'response') IN ('Approved', 'Approved as Noted', 'For Record Only'))
                ORDER BY NULLIF(a.raw->>'workflow_group', '')::int NULLS LAST, a.raw->>'sent_date'), '[]'::jsonb)
     FROM procore_submittal_approvers a
     WHERE a.project_id = s.project_id
       AND a.raw->>'submittal_id' = s.raw->>'id')                   AS responses,

    -- Reviewers (assignees analog): distinct approver names.
    (SELECT NULLIF(string_agg(DISTINCT a.raw->>'approver_name', ', '), '')
     FROM procore_submittal_approvers a
     WHERE a.project_id = s.project_id
       AND a.raw->>'submittal_id' = s.raw->>'id'
       AND NULLIF(a.raw->>'approver_name', '') IS NOT NULL)         AS assignees,

    NULLIF(s.raw->>'closed_at', '')                                 AS closed_date,

    -- Procore exposes no submittal link in the API; construct the standard one.
    'https://app.procore.com/' || s.project_id || '/project/submittal_logs/' || (s.raw->>'id')  AS procore_url,

    -- The FINAL reviewed submittal — the stamped doc from the latest distribution,
    -- captured by the pipeline into `final_reviewed_submittal`. Surfaced separately
    -- from the originally-submitted `attachments` below.
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'name', f->>'name',
                'url',  f->>'url')), '[]'::jsonb)
     FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(s.raw->'final_reviewed_submittal') = 'array'
              THEN s.raw->'final_reviewed_submittal' ELSE '[]'::jsonb END) f
     WHERE f->>'url' IS NOT NULL)                                   AS final_submittal,

    -- The originally-submitted documents (product data, shop drawings, samples).
    (SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
                'name', COALESCE(att->>'filename', att->>'name'),
                'url',  att->>'url')), '[]'::jsonb)
     FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(s.raw->'associated_attachments') = 'array'
              THEN s.raw->'associated_attachments' ELSE '[]'::jsonb END) att
     WHERE att->>'url' IS NOT NULL)                                 AS attachments

FROM procore_submittals_master s
WHERE s.project_id = 3051002;
