-- ============================================================================
-- Specifications workstream, Phase 1 view: sitelines_specs
-- The current specification sections the CSI-division-grouped spec log renders
-- (one row per section — the spec book's table of contents).
--
-- ⛔ Applied to Supabase only after owner sign-off. NO re-sync needed — the data
-- is already in procore_specification_sections_master (authenticated_read grant +
-- security_invoker=true reads it as the querying role, like sitelines_drawings).
--
-- The master is a THIN list-endpoint summary: only id / number / label /
-- description / current_revision_id. So this view emits the section identity + the
-- constructed Procore deep link now, and leaves the Phase-2 fields NULL until the
-- per-section current-revision re-sync lands:
--   • id           — Item id `specs:<section id>` (matches the sitelines_items UNION)
--   • number       — CSI section number, e.g. "26 0519" (its first token = the
--                    CSI division; the pure groupByDivision selector derives the group)
--   • title        — the section title (from `description`)
--   • procore_url  — CONSTRUCTED deep link that opens the CURRENT revision's PDF in
--                    Procore's viewer: /project/specification_section_revisions/
--                    <current_revision_id>?open_viewer=true&mfe_view=true. Uses the
--                    already-synced current_revision_id — NO re-sync. NULL if a section
--                    has no current revision. (Owner-supplied pattern, verified against
--                    03 3000 → revision 46700073.)
--   • issued_date  — NULL in Phase 1 (Phase 2 pulls the current revision's date)
--   • pdf_url      — NULL in Phase 1 (Phase 2 pulls the current revision's attachment;
--                    a later phase serves it in-app via a fresh-URL edge fn)
--
-- Ordering is intentionally NOT done here: the pure groupByDivision selector owns
-- division order (CSI code ascending — book order) and the natural number sort.
-- ============================================================================

-- NOTE: column ORDER — procore_url is appended AFTER issued_date/pdf_url so that a
-- CREATE OR REPLACE over the original Phase-1 view (id/number/title/issued_date/
-- pdf_url) only APPENDS a column (Postgres forbids inserting one mid-list, and
-- appending preserves the view's grants — no DROP). The app reads columns by name.
CREATE OR REPLACE VIEW sitelines_specs WITH (security_invoker = true) AS
SELECT
    'specs:' || (raw->>'id')          AS id,
    raw->>'number'                    AS number,
    raw->>'description'               AS title,
    NULL::text                        AS issued_date,
    NULL::text                        AS pdf_url,
    CASE
        WHEN raw->>'current_revision_id' IS NOT NULL
        THEN 'https://app.procore.com/' || project_id
             || '/project/specification_section_revisions/' || (raw->>'current_revision_id')
             || '?open_viewer=true&mfe_view=true'
    END                               AS procore_url
FROM procore_specification_sections_master
WHERE project_id = 3051002;
