# Kickoff — Commitments, Phase 5a: the scope-override write seam (⛔ first writable table + `UserData` provider)

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — the app's FIRST write-back to Supabase: a new writable table + RLS write policy + a `UserData` seam. Correctness (RLS, write safety, seed/live parity) matters. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` mid-session only if genuinely stuck.
>
> Implement **Phase 5a of Commitments** (the scope-override *write seam* only — the plumbing, no editor UI yet). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-09 - Commitments Phase 5a Kickoff.md` (this file)
> - `Notes/plans/Commitments-Plan.md` § Phase 5 (+ 5a) + `CLAUDE.md` + `design_handoff_sitelines/DATA_CONTRACT.md` §8
>
> Build **only Phase 5a**. ⛔ **Present the new-table DDL and STOP for my sign-off before applying** (ref `jxesfirpghwpfmfjlfng`) — this is the first *writable* table, so it needs INSERT/UPDATE/DELETE RLS, not just SELECT. Verify with typecheck + tests + build + a logged-in `:5173` round-trip (a written override survives a refresh; seed mode writes to `localStorage`). Don't commit or push until I say "Approved."

---

## Why this phase exists (context the launch prompt points at)
Phase 4 shipped the real inclusions/exclusions + SOV. But the scope text Procore syncs is a
flat, HTML-stripped blob with list numbering stripped — `parseScope` recovers ALL-CAPS headings,
numbered clauses, and SOV cost-code dividers, but the **un-numbered prose walls can't be
auto-structured** (there's no marker to key on). Phase 5 lets the owner hand-impose structure on
those walls, non-destructively, and have it persist across nightly re-syncs.

**Phase 5a is the plumbing only** — the app's first *write* path. No editor UI and no drawer
changes yet (those are 5b render + 5c editor). The goal is a clean, proven `UserData` seam that
5b/5c build on: a writable table, a source + provider, and an end-to-end write round-trip.

## Locked decisions (owner, 2026-07-09) — for the whole of Phase 5
- **Coverage:** all three scope fields — `description` · `inclusions` · `exclusions`.
- **Editing power (5c):** split · heading · indent/outdent · merge.
- **Placement (5c):** inline in `CommitmentDrawer` ("Edit structure" toggle), not a new overlay.
- **Safety invariant:** the editor only does *structural* ops, never typed text, so stored blocks
  are always a partition of the source — `normalize(blocks.map(b=>b.text).join(' ')) ===
  normalize(source)`. (Enforced in 5c; keep the 5a data shape able to carry it.)

## Read fresh before editing (don't trust line numbers in any doc)
- `src/lib/dataSource.ts` + `src/data/supabaseSource.ts` + `src/data/seedSource.ts` — the existing
  read seam to mirror (interface → live impl → seed impl). **5a adds a parallel *write* seam; do
  not overload the read `DataSource` with writes — make a separate `UserDataSource`.**
- `src/state/DataContext.tsx` — the `DataProvider` pattern to mirror for a `UserDataProvider`.
- `src/main.tsx` — where the source is chosen (`VITE_DATA_SOURCE === 'live'` → Supabase behind
  `AuthGate`, else seed). Wire the `UserData` source the same way (live → Supabase, else local).
- `src/lib/supabaseClient.ts` + `src/components/AuthGate.tsx` — the live client is an authenticated
  session (`authenticated` role), so RLS **write** policies for `authenticated` are the mechanism.
- `sync/migrations/0009_commitment_line_items.sql` — the table + RLS migration style to mirror
  (but 5a's table needs write policies too, and is NOT a `procore_*_master`).
- `src/types.ts` — add the `ScopeOverride` shape here (reference/user data; never enters My Court).

## Scope (Phase 5a)

### 1. ⛔ New writable table — `sitelines_scope_overrides`
Present this DDL, STOP for sign-off, then apply via the Supabase MCP. Mirror 0009's style; add a
migration file `sync/migrations/0010_scope_overrides.sql`. Sketch (refine as you see fit):
```sql
CREATE TABLE IF NOT EXISTS sitelines_scope_overrides (
    commitment_id text        NOT NULL,          -- 'commitments:<procore id>' (stable seam id)
    field         text        NOT NULL,          -- 'description' | 'inclusions' | 'exclusions'
    blocks        jsonb       NOT NULL,          -- ordered [{kind:'para'|'heading', indent:int, text}]
    source_hash   text        NOT NULL,          -- hashText(normalize(source)) the structure was built on
    updated_at    timestamptz NOT NULL DEFAULT now(),
    updated_by    uuid        DEFAULT auth.uid(),
    PRIMARY KEY (commitment_id, field),
    CONSTRAINT scope_override_field CHECK (field IN ('description','inclusions','exclusions'))
);
ALTER TABLE public.sitelines_scope_overrides ENABLE ROW LEVEL SECURITY;
-- Single-user tool → the authenticated owner may read AND write. (If per-user is ever wanted,
-- swap USING/WITH CHECK to (updated_by = auth.uid()); confirm before assuming multi-user.)
CREATE POLICY scope_overrides_read  ON sitelines_scope_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY scope_overrides_write ON sitelines_scope_overrides FOR ALL    TO authenticated USING (true) WITH CHECK (true);
```
Note: this is NOT a `security_invoker` read view over a master — it's a real base table the browser
writes to. Confirm with `get_advisors` after applying (no new security warnings).

### 2. `ScopeOverride` type + `hashText`
- `ScopeOverride` in `src/types.ts`: `{ commitmentId, field: 'description'|'inclusions'|'exclusions',
  blocks: ScopeBlockOverride[], sourceHash, updatedAt }`. Reuse/extend `parseScope`'s block idea:
  `ScopeBlockOverride = { kind: 'para' | 'heading'; indent: number; text: string }` (a flat list).
- `src/lib/hashText.ts` — a pure, deterministic non-crypto hash of the **normalized** source text
  (collapse whitespace, trim), for staleness detection. Co-located `.test.ts` (stable output, same
  input → same hash, whitespace-insensitive). Pass the string in; no clock.

### 3. The `UserData` seam (separate from the read seam)
- `src/lib/userDataSource.ts` — a `UserDataSource` interface:
  `getScopeOverrides(): Promise<ScopeOverride[]>` · `saveScopeOverride(o): Promise<void>` ·
  `deleteScopeOverride(commitmentId, field): Promise<void>`.
- `src/data/supabaseUserData.ts` — live impl over `sitelines_scope_overrides` (uses the same
  authenticated `SupabaseClient`; upsert on the composite PK).
- `src/data/localUserData.ts` — seed/local impl backed by `localStorage` (so seed mode still
  exercises writes offline, and there's no live dependency). Same interface.
- `src/state/UserDataContext.tsx` — a `UserDataProvider` mirroring `DataProvider`: loads overrides
  on mount, exposes `{ overrides (keyed by `commitmentId|field`), saveOverride, deleteOverride,
  reload, status }`. Mount it in `main.tsx` (live → `supabaseUserData(client)`, else `localUserData`).

### 4. Prove the round-trip (no editor UI)
Add a **minimal, temporary** write proof so the phase is verifiable end-to-end — e.g. a tiny dev-only
"reset structure" control (or a one-off effect) that writes then re-reads an override row for one
commitment. This is a scaffold to prove RLS admits the write and the seam works; 5c replaces it with
the real editor. Keep it obviously temporary and note it in the exit report.

## Guardrails / gates
- ⛔ **Present the table DDL and STOP** before applying (ref `jxesfirpghwpfmfjlfng`). First writable
  table — double-check the RLS write policy is scoped to `authenticated` and no `service_role` key
  ever reaches the browser bundle.
- **New write seam stays separate** from the read `DataSource`/`SiteData` — the read path is a pure
  Procore mirror; `UserData` is the user-authored layer. Don't entangle them.
- Keep the UI dumb / logic pure: `hashText` + (5b's) `applyScopeOverride` are pure, tested fns in
  `src/lib`/`src/selectors`; the provider does I/O, components read via the provider.
- Standard Sitelines invariants: overlays are `position:fixed` siblings of the card; one token
  source; domain atom stays `Item`; `ScopeOverride` is user/reference data and **never** enters My
  Court / `ballInCourt`; views derived from `AppState` + `patch()`.
- Seed → live parity: the editor (5c) must work in both modes; 5a's `localUserData` is what makes
  seed mode writable. Keep the seam swap zero-component-change.
- Don't commit or push until the owner says "Approved."

## Exit criteria
typecheck + tests + build green; live logged-in `:5173` — a written override **persists across a
refresh** (authenticated RLS admits the write + read); seed mode (`:5174`) writes/reads the same
override via `localStorage`; `get_advisors` clean; no editor/drawer UI yet (that's 5b/5c). Then STOP
and report (including the temporary write-proof scaffold to remove in 5c).

## Not this phase (5b / 5c)
- 5b — `applyScopeOverride` selector + wiring the three drawer scope sections to render overrides +
  the source-hash staleness banner/fallback (read path).
- 5c — the inline "Edit structure" editor (split/heading/indent/merge) writing through this seam,
  with the concatenation invariant asserted on save.
