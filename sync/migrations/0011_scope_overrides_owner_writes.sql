-- ============================================================================
-- Sitelines sync — Migration 0011: scope overrides, scope writes to the author
--
-- ⛔ Applied to Supabase only after owner sign-off (approved 2026-07-09).
--
-- Tightens the Phase-5a write policy from unconditional to (updated_by = auth.uid())
-- so a signed-in writer can only INSERT/UPDATE/DELETE rows they authored. For the
-- current single-user tool this is behavior-IDENTICAL — every row's updated_by is
-- the owner's uid — but it clears the "RLS Policy Always True" security advisor and
-- is the correct posture if this table ever becomes multi-user.
--
-- On INSERT the browser omits updated_by, so the column DEFAULT auth.uid() fills it
-- and the WITH CHECK passes; on the upsert's UPDATE path the existing row's
-- updated_by already equals auth.uid(), so USING passes. SELECT stays open (the
-- read policy is unchanged) — one owner, nothing to hide from.
-- ============================================================================

DROP POLICY IF EXISTS scope_overrides_write ON sitelines_scope_overrides;

CREATE POLICY scope_overrides_write ON sitelines_scope_overrides
    FOR ALL TO authenticated
    USING (updated_by = auth.uid())
    WITH CHECK (updated_by = auth.uid());
