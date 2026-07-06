-- ============================================================================
-- Drawings, Phase 2 view: sitelines_drawing_revisions
-- Every issue of every sheet (current + historical) — the source for the sheet
-- viewer's revision picker. One row per revision; the app fetches a single
-- drawing's revisions on demand by `drawing_id` (getDrawingRevisions), so the
-- main snapshot stays light. Ordering (newest-first) is done client-side in the
-- pure sortRevisionsDesc selector; no ORDER BY here.
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- Fields:
--   • id           — the revision's Item id, 'drawings:<revId>' (matches the log)
--   • drawing_id    — parent drawing; the picker's lookup key
--   • revision      — revision_number ("0".."12"; all integer-valued here)
--   • drawing_date  — issue date (cleaned to display in the mapper)
--   • current       — the issue shown in the log (the default-selected revision)
--   • png_url       — the sheet image the viewer renders (pre-signed; every
--                     revision has one). pdf_url is the link-out.
--   • procore_url   — CONSTRUCTED deep link to the sheet in Procore (the graceful
--                     fallback when a signed image URL has expired). Format is
--                     the drawing-area/drawing path; confirm it resolves.
--
-- security_invoker=true → reads procore_drawing_revisions_master as the querying
-- role (authenticated_read, migration 0007). No re-sync — data is already synced.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_drawing_revisions WITH (security_invoker = true) AS
SELECT
    'drawings:' || (raw->>'id')            AS id,
    raw->>'drawing_id'                     AS drawing_id,
    raw->>'revision_number'                AS revision,
    NULLIF(raw->>'drawing_date', '')       AS drawing_date,
    (raw->>'current')::boolean             AS current,
    NULLIF(raw->>'png_url', '')            AS png_url,
    NULLIF(raw->>'pdf_url', '')            AS pdf_url,
    'https://app.procore.com/' || project_id || '/project/drawing_areas/'
        || (raw #>> '{drawing_area,id}') || '/drawings/' || (raw->>'drawing_id')  AS procore_url
FROM procore_drawing_revisions_master
WHERE project_id = 3051002;
