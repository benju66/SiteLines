-- ============================================================================
-- Punch List workstream, Phase 1 view: sitelines_punch
-- The closeout dashboard's rows (one per punch item — all 1,097, incl. closed, so
-- the rollup can show % complete). ADDITIVE: this does NOT replace the `punch:` UNION
-- in sitelines_items.sql (which feeds My Court + the ball-in-court rule) — both read
-- the same master and answer different questions (dashboard lens vs. inbox).
--
-- ⛔ Applied to Supabase only after owner sign-off. NO re-sync needed — the data is
-- already in procore_punch_items_master (security_invoker=true reads it as the
-- querying role, like every sibling view).
--
-- Emits the fields the `PunchItem` contract shape needs; the pure mapPunchItem()
-- mapper does the final date/text shaping client-side:
--   • id               — Item id `punch:<id>` (matches the sitelines_items UNION)
--   • project          — 'opiii' (only OP III synced; matches the UNION) — for scoped()
--   • number           — "#<position>" (the human punch number)
--   • name             — the item title (this project leaves `description` empty)
--   • assignee         — the responsible sub: assignees[0].name → ball_in_court → ""
--                        (assignees[] is retained even after close; ball_in_court clears)
--   • status           — "Open" | "Overdue" | "Closed"
--   • workflow_status  — "initiated" | "work_required" | "ready_for_review" | "closed"
--                        (the closeout lifecycle — the dashboard's primary grouping)
--   • due_date         — ISO "YYYY-MM-DD" (or NULL); the mapper formats + keeps it sortable
--   • has_photos       — has_attachments (a Phase-1 INDICATOR; real photos are Phase 2)
--   • has_open_response — has_unresolved_responses (indicator; the real thread is Phase 2)
--   • manager          — punch_item_manager.name (the GC owner)
--
-- Ordering is intentionally NOT done here: the pure punchRollup / groupPunchBy selectors
-- own the lifecycle order, the assignee order, and the within-group (overdue-first) sort.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_punch WITH (security_invoker = true) AS
SELECT
    'punch:' || (raw->>'id')                                                    AS id,
    'opiii'::text                                                               AS project,
    '#' || (raw->>'position')                                                   AS number,
    raw->>'name'                                                                AS name,
    COALESCE(NULLIF(raw#>>'{assignees,0,name}', ''), NULLIF(raw->>'ball_in_court', ''), '') AS assignee,
    raw->>'status'                                                              AS status,
    raw->>'workflow_status'                                                     AS workflow_status,
    NULLIF(raw->>'due_date', '')                                                AS due_date,
    COALESCE((raw->>'has_attachments')::boolean, false)                         AS has_photos,
    COALESCE((raw->>'has_unresolved_responses')::boolean, false)                AS has_open_response,
    COALESCE(NULLIF(raw#>>'{punch_item_manager,name}', ''), '')                 AS manager
FROM procore_punch_items_master
WHERE project_id = 3051002;
