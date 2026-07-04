-- Phase 4 view: sitelines_daily_logs — daily field reports (README §5 / DailyLogEntry).
-- Anchored on weather_logs (the per-day record), enriched by manpower (crew headcount)
-- and notes (free text) for the same day. OP III barely used Procore daily logs, so this
-- is legitimately sparse. crew sums manpower counts; notes concatenates notes-log bodies.
CREATE OR REPLACE VIEW sitelines_daily_logs WITH (security_invoker = true) AS
SELECT
    CASE w.project_id WHEN 3051002 THEN 'opiii' END                     AS project,
    to_char((w.raw->>'date')::date, 'Mon FMDD')                         AS date,
    COALESCE(NULLIF(w.raw->>'sky', ''), '—')                            AS weather,
    COALESCE(NULLIF(w.raw->>'temperature', '') || '°', '—')             AS temp,
    COALESCE((
        SELECT sum(COALESCE((m.raw->>'num_workers')::int, (m.raw->>'workers')::int, 0))
        FROM procore_manpower_logs_master m
        WHERE m.project_id = w.project_id AND (m.raw->>'date')::date = (w.raw->>'date')::date
    ), 0)::int                                                          AS crew,
    false                                                              AS mine,
    COALESCE((
        SELECT string_agg(NULLIF(n.raw->>'notes', ''), ' · ')
        FROM procore_notes_logs_master n
        WHERE n.project_id = w.project_id AND (n.raw->>'date')::date = (w.raw->>'date')::date
    ), '')                                                             AS notes
FROM procore_weather_logs_master w
WHERE w.project_id = 3051002 AND w.raw->>'date' IS NOT NULL
ORDER BY (w.raw->>'date')::date DESC;
