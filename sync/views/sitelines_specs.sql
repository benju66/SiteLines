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
-- description / current_revision_id. So this view emits the section identity now
-- and leaves the Phase-2 fields NULL until the per-section current-revision
-- re-sync lands:
--   • id           — Item id `specs:<section id>` (matches the sitelines_items UNION)
--   • number       — CSI section number, e.g. "26 0519" (its first token = the
--                    CSI division; the pure groupByDivision selector derives the group)
--   • title        — the section title (from `description`)
--   • issued_date  — NULL in Phase 1 (Phase 2 pulls the current revision's date)
--   • pdf_url      — NULL in Phase 1 (Phase 2 pulls the current revision's attachment;
--                    Phase 3 surfaces it as "Open PDF ↗" via a fresh-URL edge fn)
--
-- Ordering is intentionally NOT done here: the pure groupByDivision selector owns
-- division order (CSI code ascending — book order) and the natural number sort.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_specs WITH (security_invoker = true) AS
SELECT
    'specs:' || (raw->>'id')          AS id,
    raw->>'number'                    AS number,
    raw->>'description'               AS title,
    NULL::text                        AS issued_date,
    NULL::text                        AS pdf_url
FROM procore_specification_sections_master
WHERE project_id = 3051002;
