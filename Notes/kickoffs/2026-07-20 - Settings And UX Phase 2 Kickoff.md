# Kickoff — User Settings & UX, Phase 2: persist UI state across reloads

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — a well-specified persistence phase whose
> correctness is load-bearing: a **schema-version migration** (v1→v2 must not wipe a Phase-1
> user's setting) and a **corruption-safe coerce** for a nested `columnWidths` shape. Escalate
> to `claude-fable-5` (`/model claude-fable-5`) only if genuinely stuck.
>
> Implement **Phase 2 of User Settings & UX** (persist UI state across reloads). Read these in
> full, then follow them:
> - `Notes/kickoffs/2026-07-20 - Settings And UX Phase 2 Kickoff.md` (this file)
> - `Notes/plans/Settings-And-UX-Plan.md` (the plan — Phase 2 + the data model) + `PLAN.md`
>   (the User Settings & UX workstream row) + `design_handoff_sitelines/README.md`
>
> Build **only Phase 2**. It builds directly on the Phase 1 store (already shipped). Guardrail:
> **AppState + `patch()` stay the runtime source of truth** — settings persistence is a thin
> hydrate/write-back bridge, NOT a second state system. A malformed/old localStorage blob must
> still degrade to defaults, never throw (extend `coerceSettings` + its tests). No backend
> (localStorage only). Verify with typecheck + test + build + a seed `:5174` click-through **and
> a plain reload** (persistence is the whole point). Don't commit until the owner says "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What Phase 1 already shipped (build ON this — don't refork)
- **The store + seam:** `src/lib/settings.ts` (`UserSettings`, `SETTINGS_VERSION = 1`,
  `defaultSettings()`, `coerceSettings()`), `src/lib/settingsSource.ts`, `src/data/localSettings.ts`
  (localStorage under `sitelines.settings`), `src/state/SettingsContext.tsx`
  (`SettingsProvider` / `useSettings()` → `settings` + `setSetting(key,value)` + `resetSettings()`).
- **One field wired end-to-end:** `sidebarCollapsed`. `AppProvider` (`src/state/AppContext.tsx`)
  boot-hydrates it via a lazy initializer: `useState(() => ({ ...initialState, sidebarCollapsed:
  settings.sidebarCollapsed }))`. The Settings overlay toggles it (`setSetting` + a live `patch`).
- **The contract Phase 2 must honor:** `coerceSettings` is corruption-safe + version-gated —
  an unrecognized `version` returns defaults today. Phase 2 bumps the version, so it MUST add a
  migration that upgrades a recognized v1 blob **forward** (preserving `sidebarCollapsed`) instead
  of discarding it. There's a `// (Future migrations …)` seam comment marking exactly where.

## Scope (build ONLY this)
Persist the durable UI-state fields so they survive a reload; keep AppState the runtime state.

1. **Grow `UserSettings` (versioned migration).** Bump `SETTINGS_VERSION` to `2`. Add
   `drawerWidth: number`, `drawerFull: boolean`, `columnWidths: Record<string, number[]>` (keyed
   by table id, e.g. `{ budget: [...] }`). Update `defaultSettings()` (mirror `initialState`:
   `drawerWidth: 452`, `drawerFull: false`, `columnWidths: {}`). Extend `coerceSettings`:
   - **Migrate v1 → v2:** a `version === 1` blob is recognized — read its `sidebarCollapsed`, fill
     the new fields with defaults. (Add the branch at the existing seam comment.) A v2 blob is read
     field-by-field as today.
   - Clamp `drawerWidth` to a sane range (reuse `DRAWER_MIN_WIDTH` from `src/lib/drawerNav.ts` as
     the floor; a generous static ceiling — the runtime re-clamps to viewport via `clampDrawerWidth`).
     Non-finite / non-number → default.
   - `columnWidths`: accept only a plain object whose values are arrays of finite positive numbers;
     drop any malformed entry. Never throw.
2. **Pure helper `applyToTable(saved, defaults, mins)`** in `src/lib/settings.ts`: given a saved
   width array (possibly wrong length / junk) + a table's `defaults` + per-column `mins`, return a
   valid width array — correct length, each `≥ min`; **fall back to `defaults` on a length mismatch**
   (a stale save from a different column count is untrustworthy). Pure; extend `settings.test.ts`.
3. **The AppState↔settings bridge (thin + centralized).** A pure `persistedFromState(state)` that
   returns the durable subset `{ sidebarCollapsed, drawerWidth, drawerFull }`, plus a **subscriber**
   that write-throughs that subset whenever it changes (a small `<SettingsBridge/>` mounted under
   both providers, or an effect in `AppProvider`). Skip the write on the initial hydrate (don't
   re-save the just-loaded values); a light debounce is fine but not required (`drawerWidth` commits
   once on drag-release). Extend the boot hydrate in `AppContext.tsx` to seed **all three** fields.
   Add a batched setter to `SettingsContext` if writing the subset in one shot is cleaner than three
   `setSetting` calls (e.g. `patchSettings(partial)` / `setColumnWidths(tableId, widths)`).
4. **Column widths (BudgetView — the only resizable table).** In
   `src/components/views/BudgetView.tsx`: initialize `widthsRef` from
   `applyToTable(settings.columnWidths['budget'], DEFAULT_WIDTHS, MIN_WIDTHS)` instead of always
   `[...DEFAULT_WIDTHS]`; on `onResizeUp` (drag-end) persist the current widths to
   `settings.columnWidths['budget']` (via the new setter). Keep the drag itself DOM-only (the
   `--budget-grid` var trick) — only the committed widths persist. Read settings via `useSettings()`
   (the UI stays dumb; pass the `'budget'` table id).
5. **Optional extras — ONLY if cheap:** the collapse Sets/flags (`collapsedDisciplines`,
   `budgetKpisCollapsed`, …) or last-tool. Default: **skip** unless one falls out for free; they're
   not required for the exit gate.

## Hard guardrails / gates
- **No backend, no ⛔ gates** — localStorage only. Don't touch the read seam / `DataSource` /
  `SiteData`. Settings stay a separate client store; localStorage access stays confined to the
  settings source (components use `useSettings()`).
- **AppState + `patch()` stay the runtime state.** The bridge is a thin hydrate/write-back layer —
  do NOT move view state into components or fork a second state system. View-models stay pure in
  `src/selectors/`.
- **Migration must not lose data:** a v1 blob (a Phase-1 user who set `sidebarCollapsed`) must
  migrate to v2 with that value intact. Test it.
- **Corruption-safe:** a malformed/old blob (bad JSON, junk `columnWidths`, wrong-length arrays,
  out-of-range `drawerWidth`) degrades to valid defaults, never throws.
- **One token source**; overlay guardrail unchanged; never introduce a domain type named `Record`
  (the `Record<string, number[]>` **utility** is fine — the plan's own data model uses it).

## Exit criteria (the gate — all must pass)
```
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck
npm --prefix "C:/Users/BUrness/Dev/Sitelines" test
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run build
```
- `coerceSettings` + `applyToTable` unit-tested, incl.: a **v1 blob migrates → v2 preserving
  `sidebarCollapsed`**; junk / wrong-length `columnWidths` → defaults; out-of-range `drawerWidth`
  clamped; empty/corrupt → defaults.
- Seed `:5174` click-through **+ a plain browser reload**: resize a Budget column, resize the detail
  drawer, toggle drawer full-width, collapse the sidebar → reload → **all remembered**; a fresh
  profile (cleared `sitelines.settings`) still shows defaults; a hand-corrupted blob still boots to
  defaults, no crash / no console errors.
- Stop at the phase boundary; **don't commit or push until the owner says "Approved."**

## Notes for the implementer
- **Only `BudgetView` has resizable columns** (`widthsRef` + `--budget-grid` + `.sl-budget-rz`).
  Its `onResizeUp` does NOT persist today — that's the hook to add. `DEFAULT_WIDTHS` / `MIN_WIDTHS`
  live at the top of the file; feed them to `applyToTable`.
- **`drawerWidth` + `drawerFull` already commit to AppState** (`DrawerShell.tsx`: resize-release →
  `patch({ drawerWidth })`; full toggle → `patch({ drawerFull })`). Phase 2 doesn't change those
  mutation sites — the bridge persists whatever AppState holds, and the boot hydrate seeds them.
  That's the payoff of the centralized bridge: the sidebar's own «/» collapse button becomes durable
  for free (Phase 1 left it session-only precisely because the write-back bridge is this phase).
- Keep the source interface sync (localStorage) as in Phase 1; a Supabase source is still a later
  phase. If you add a batched setter, keep write-through idempotent (StrictMode double-invokes).
- After it's green + verified, update the `PLAN.md` Phase 2 row to the shipped form (mirror the
  Phase 1 row: tests count, what the reload proved, `Committed on <branch>`), and stop for approval.
