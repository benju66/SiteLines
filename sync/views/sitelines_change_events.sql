-- ============================================================================
-- Change Events, Phase 1 view: sitelines_change_events — one row per change
-- event (a POTENTIAL change, tracked and priced before it becomes a change
-- order) for OP III. The header carries scope + funding bucket + reason; the
-- money comes from the event's line items (procore_change_event_line_items_master):
-- est_cost = Σ estimated_cost_amount (raw DOLLARS, negative = a de-scope credit),
-- with the line count and the number of distinct commitments the event's lines
-- hit (contract_number → procore_commitments_master.number). This view emits raw
-- dollars; the selector layer formats $/% and computes the rollup + scope/funding
-- breakdowns (DATA_CONTRACT §6: never store derived).
--
-- ⛔ Applied to Supabase only after owner sign-off.
--
-- Verified against the masters (read-only dry run, 2026-07-13, project 3051002):
--   165 events (6 open · 143 closed · 16 void) · 242 line items · origin RFI on 2.
--   open exposure = $19,395.00 — reconciles EXACTLY to sitelines_budget_pending
--   (same open change-event lines; Change Events is that view's source). active
--   exposure (open + closed, Void excluded) = $412,618.92; out-of-scope (non-void)
--   = $308,302.35. The Void events (16) are excluded from every exposure sum in
--   the app selector (dead paper) — the view emits them so the register can still
--   show them with a muted Void pill.
--
-- Column notes:
--   status  <- initcap(raw->>'status'): 'open'/'closed'/'void' → Open/Closed/Void.
--   number  <- 'CE #' || raw->>'number' (matches the sitelines_items id-num style).
--   id      <- 'changeEvents:' || raw->>'id' (matches the Item-feed id, so the
--              Phase-2 detail drawer can key off it).
--   commitments <- count(DISTINCT matched commitment number). The LEFT JOIN to
--              commitments is 1:0-or-1 (commitment numbers are unique per project),
--              so it never fans out the line-item count or the est_cost sum.
--   origin_rfi <- change_event_origin_type ILIKE 'Rfi%' (only 'Rfi::Header' appears;
--              2 events). The richer per-line pricing (proposed/latest ROM, vendor
--              quotes) is on Procore's PRIVATE line-item endpoint — NOT synced; v1
--              uses estimated_cost_amount only.
--
-- security_invoker=true respects deny-all RLS; the change-event + commitment
-- masters already grant SELECT to `authenticated` (same as budget_pending /
-- commitments). Read-only over existing tables; no re-sync — data already synced.
-- ============================================================================

CREATE OR REPLACE VIEW sitelines_change_events WITH (security_invoker = true) AS
WITH li AS (
    -- per change-event line-item aggregates: cost, line count, distinct commitments hit
    SELECT
        l.raw->>'change_event_id'                                            AS change_event_id,
        sum(COALESCE(NULLIF(l.raw->>'estimated_cost_amount', '')::numeric, 0)) AS est_cost,
        count(*)                                                             AS line_items,
        count(DISTINCT c.raw->>'number')                                     AS commitments
    FROM procore_change_event_line_items_master l
    LEFT JOIN procore_commitments_master c
      ON c.project_id = l.project_id AND c.raw->>'number' = l.raw->>'contract_number'
    WHERE l.project_id = 3051002
    GROUP BY 1
)
SELECT
    'opiii'                                                       AS project,
    'changeEvents:' || (ce.raw->>'id')                           AS id,
    'CE #' || (ce.raw->>'number')                                AS number,
    ce.raw->>'title'                                             AS title,
    initcap(ce.raw->>'status')                                   AS status,
    NULLIF(ce.raw->>'event_scope', '')                           AS scope,
    NULLIF(ce.raw->>'event_type', '')                            AS type,
    NULLIF(ce.raw->>'change_order_change_reason', '')            AS reason,
    round(COALESCE(li.est_cost, 0), 2)                           AS est_cost,
    COALESCE(li.line_items, 0)                                   AS line_items,
    COALESCE(li.commitments, 0)                                  AS commitments,
    (ce.raw->>'change_event_origin_type') ILIKE 'Rfi%'           AS origin_rfi,
    ce.raw->>'description'                                       AS description,
    NULLIF(ce.raw->>'created_at', '')                            AS created_at
FROM procore_change_events_master ce
LEFT JOIN li ON li.change_event_id = ce.raw->>'id'
WHERE ce.project_id = 3051002
ORDER BY round(COALESCE(li.est_cost, 0), 2) DESC, (ce.raw->>'number');
