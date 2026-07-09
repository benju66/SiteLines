-- ============================================================================
-- Sitelines sync — Migration 0010: scope-structure overrides (Commitments Phase 5a)
--
-- ⛔ Applied to Supabase only after owner sign-off. THE APP'S FIRST WRITABLE TABLE.
--
-- Every table before this is a read-only Procore mirror (procore_*_master, synced
-- by the pipeline) surfaced through security_invoker views. This one is different:
-- it is the first *user-authored* layer — the browser (authenticated role) writes
-- to it directly. So unlike the masters' deny-all + authenticated_read posture, it
-- needs INSERT/UPDATE/DELETE RLS for `authenticated`, not just SELECT.
--
-- What it stores: a manual, non-destructive structural override of a commitment's
-- flat scope text (Commitments Phase 5). Procore syncs the subcontract scope as one
-- HTML-stripped run with list numbering stripped; parseScope recovers what it can,
-- but the un-numbered prose walls can't be auto-structured. The owner hand-imposes
-- structure once; because an executed subcontract's scope language never changes
-- (a change order carries its own scope, it doesn't rewrite the original), that
-- structure persists across nightly re-syncs. `source_hash` guards the rare
-- exception (a still-draft or re-executed commitment): on load, a hash mismatch
-- falls back to the parser output rather than showing stale formatting (Phase 5b).
--
-- Keyed (commitment_id, field): one override per scope field per commitment.
--   commitment_id — the stable seam id, 'commitments:<procore id>' (matches
--                   Commitment.id / sitelines_commitments.id), NOT the bare Procore id.
--   field         — which scope field: description | inclusions | exclusions.
--   blocks        — the override, a flat ordered list the editor (5c) produces and
--                   the drawer (5b) renders: [{kind:'para'|'heading', indent, text}].
--                   Words are locked: the editor only performs structural ops, so
--                   blocks are always a partition of the source text (invariant
--                   asserted on save in 5c). Stored as jsonb; validated app-side.
--   source_hash   — hashText(normalize(source)) the structure was built on.
--   updated_by    — auth.uid() of the writer (audit only; not surfaced in the app).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sitelines_scope_overrides (
    commitment_id text        NOT NULL,          -- 'commitments:<procore id>' (stable seam id)
    field         text        NOT NULL,          -- 'description' | 'inclusions' | 'exclusions'
    blocks        jsonb       NOT NULL,          -- ordered [{kind:'para'|'heading', indent:int, text}]
    source_hash   text        NOT NULL,          -- hashText(normalize(source)) the structure was built on
    updated_at    timestamptz NOT NULL DEFAULT now(),
    updated_by    uuid        DEFAULT auth.uid(),
    PRIMARY KEY (commitment_id, field),
    CONSTRAINT scope_override_field CHECK (field IN ('description', 'inclusions', 'exclusions'))
);

-- First writable table → SELECT *and* write RLS for the authenticated owner.
-- Single-user tool, so both policies are unconditional (USING/WITH CHECK true).
-- If this ever becomes multi-user, scope the write policy to (updated_by = auth.uid())
-- — confirm before assuming multi-user. The pipeline never touches this table.
ALTER TABLE public.sitelines_scope_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY scope_overrides_read ON sitelines_scope_overrides
    FOR SELECT TO authenticated USING (true);
CREATE POLICY scope_overrides_write ON sitelines_scope_overrides
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
