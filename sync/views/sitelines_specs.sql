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
--   • issued_date  — the current revision's issued date (Phase 2 enrichment). NULL only
--                    if enrichment hasn't run.
--   • pdf_url      — the current revision's stored PDF url (Phase 2). Used as an
--                    EXISTENCE FLAG (present → the row offers in-app "Open PDF"); the url
--                    itself carries an expiring `sig`, so the app never loads it directly
--                    — the `spec-file` edge fn re-mints a fresh one server-side.
--   • revision_id  — the current_revision_id, passed to the `spec-file` edge fn so it can
--                    GET a fresh PDF url for the in-app viewer.
--
-- Ordering is intentionally NOT done here: the pure groupByDivision selector owns
-- division order (CSI code ascending — book order) and the natural number sort.
-- ============================================================================

-- NOTE: column ORDER — issued_date/pdf_url are early (they were the original Phase-1
-- NULL placeholders, now given real expressions — a CREATE OR REPLACE may change a
-- column's expression but not rename one); procore_url/revision_id are appended (adding
-- columns is allowed and preserves the view's grants — no DROP). The app reads by name.
CREATE OR REPLACE VIEW sitelines_specs WITH (security_invoker = true) AS
SELECT
    'specs:' || (raw->>'id')                  AS id,
    raw->>'number'                            AS number,
    raw->>'description'                        AS title,
    NULLIF(raw->>'issued_date', '')           AS issued_date,
    NULLIF(raw->>'current_revision_url', '')  AS pdf_url,
    CASE
        WHEN raw->>'current_revision_id' IS NOT NULL
        THEN 'https://app.procore.com/' || project_id
             || '/project/specification_section_revisions/' || (raw->>'current_revision_id')
             || '?open_viewer=true&mfe_view=true'
    END                                       AS procore_url,
    raw->>'current_revision_id'               AS revision_id
FROM procore_specification_sections_master
WHERE project_id = 3051002;
