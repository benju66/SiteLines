-- ============================================================================
-- Drawings workstream, Phase 1 view: sitelines_drawings
-- The current drawing sheets the discipline-grouped log renders (one row per
-- CURRENT sheet — the latest revision of each drawing).
--
-- ⛔ Applied to Supabase only after owner sign-off. NO re-sync needed — the data
-- is already in procore_drawing_revisions_master (migration 0007 grants
-- authenticated_read; security_invoker=true reads it as the querying role).
--
-- One row per current sheet (`(raw->>'current')::boolean`), project 3051002.
-- Emits the fields the `Drawing` contract shape needs; the pure mapDrawing()
-- mapper does the final date/url/text shaping client-side:
--   • id            — Item id `drawings:<revision id>` (matches sitelines_items)
--   • drawing_id    — parent drawing id (groups a sheet's revisions; Phase 2)
--   • number/title  — sheet number ("A1.1") + title
--   • discipline    — discipline.name (grouping key; NULL → "Uncategorized" in the mapper)
--   • revision      — revision_number (e.g. "5")
--   • drawing_date  — the sheet's drawing date (ISO YYYY-MM-DD)
--   • received_date — when the sheet was received (ISO YYYY-MM-DD)
--   • set           — drawing_set.name (quoted: `set` is a reserved word)
--   • status        — "published"
--   • thumbnail_url / png_url / pdf_url — pre-signed Procore storage links
--     (freshest right after a sync; the viewer degrades gracefully — Phase 2/3).
--
-- Ordering is intentionally NOT done here: the pure groupByDiscipline selector
-- owns discipline order (count desc, alpha) and the natural number sort.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_drawings WITH (security_invoker = true) AS
SELECT
    'drawings:' || (raw->>'id')            AS id,
    raw->>'drawing_id'                     AS drawing_id,
    raw->>'number'                         AS number,
    raw->>'title'                          AS title,
    raw#>>'{discipline,name}'              AS discipline,
    raw->>'revision_number'                AS revision,
    NULLIF(raw->>'drawing_date', '')       AS drawing_date,
    NULLIF(raw->>'received_date', '')      AS received_date,
    raw#>>'{drawing_set,name}'             AS "set",
    raw->>'status'                         AS status,
    NULLIF(raw->>'thumbnail_url', '')      AS thumbnail_url,
    NULLIF(raw->>'png_url', '')            AS png_url,
    NULLIF(raw->>'pdf_url', '')            AS pdf_url
FROM procore_drawing_revisions_master
WHERE project_id = 3051002
  AND (raw->>'current')::boolean;
