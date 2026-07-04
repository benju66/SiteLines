-- ============================================================================
-- Migration 0007 — Phase 4 tool coverage tables.
--
-- Ten new master tables for the tools the pipeline now pulls: punch, meetings,
-- drawing revisions, spec sections, documents, schedule calendar items, images
-- (photos), and the three daily-log sub-logs (weather / manpower / notes).
-- Same shape as every other master: (id, project_id, raw jsonb, synced_at) + RLS.
-- ============================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'procore_punch_items_master',
    'procore_meetings_master',
    'procore_drawing_revisions_master',
    'procore_specification_sections_master',
    'procore_documents_master',
    'procore_schedule_calendar_items_master',
    'procore_images_master',
    'procore_weather_logs_master',
    'procore_manpower_logs_master',
    'procore_notes_logs_master'
  ]
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I (
         id bigint NOT NULL, project_id bigint NOT NULL, raw jsonb NOT NULL,
         synced_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, project_id))', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (project_id)', 'idx_' || t || '_project', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY authenticated_read ON %I FOR SELECT TO authenticated USING (true)', t);
  END LOOP;
END $$;
