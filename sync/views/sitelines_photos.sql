-- Phase 4 view: sitelines_photos — jobsite photos (README §4 / Photo shape).
-- Capped at the 300 most-recent to keep the browser payload reasonable (OP III has
-- ~5,900 images). caption <- description or filename; mine <- starred.
CREATE OR REPLACE VIEW sitelines_photos WITH (security_invoker = true) AS
SELECT
    CASE project_id WHEN 3051002 THEN 'opiii' END                        AS project,
    COALESCE(NULLIF(raw->>'description', ''), raw->>'filename')          AS caption,
    to_char((raw->>'taken_at')::timestamptz, 'Mon FMDD')                 AS date,
    COALESCE((raw->>'starred')::boolean, false)                         AS mine
FROM procore_images_master
WHERE project_id = 3051002 AND raw->>'taken_at' IS NOT NULL
ORDER BY (raw->>'taken_at')::timestamptz DESC
LIMIT 300;
