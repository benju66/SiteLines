# User Settings & UX — a preferences layer + UX polish (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + the design handoff (`design_handoff_sitelines/`).
> Sibling to reuse: the **scope-editor UserData** seam (`src/lib/userDataSource.ts` +
> `src/state/UserDataContext.tsx` + `src/data/localUserData.ts`) — its live/local source
> pattern is the model for the settings store.

## Goal
Give Sitelines a **user-preferences layer** so the app remembers how the owner likes to
work, plus the UX polish that rides on it: a **Settings menu**, **persisted UI state**
(column widths, drawer width, sidebar-collapsed remembered across reloads), **pinned /
reordered tools** in the sidebar, and a **fix for the project switcher** so the empty
"McKenna Crossing" ghost (hardcoded, zero synced data) no longer appears. Everything
persists to **localStorage for v1** (a later phase can upgrade to per-user Supabase).

## Out of scope / deferred
- **Per-user Supabase persistence** — v1 is localStorage-only. The seam is shaped so a
  Supabase source drops in later (like the read/UserData seams); note it, don't build it.
- **A dynamic multi-project data model** — v1 keeps the `Project = 'mckenna' | 'opiii'`
  union and just DERIVES which scopes are visible (empty ones hidden). Loosening `Project`
  to an open string + a `sitelines_projects` registry view (real names/colors for any
  synced project) is a later, separate upgrade (⛔ SQL). Note it; don't build it.
- **User show/hide/reorder of projects** — Phase 4 is the pure data-derive fix; a
  settings-driven project visibility control is a later add on the Phase-1 store.
- **Theming / dark mode / new visual settings** — not in scope unless trivially free.
- **Re-sync / new Procore pulls** — none.

## Locked product decisions (from the owner, 2026-07-20)
1. **Persist to localStorage for v1** (Supabase per-user later).
2. **Full scope, foundation first:** the settings store + menu (Phase 1) before the
   preferences that plug into it.
3. **Fix the project switcher by DATA-DERIVING the visible scopes** — hide projects with
   no synced data (kills the McKenna ghost); no new Supabase view for v1.

## Data model (contract)
No Procore/DATA_CONTRACT shapes change. This adds a **client-only** settings shape:

```ts
// A versioned, forward-migratable settings blob (localStorage today; a Supabase row later).
export interface UserSettings {
  version: 1
  sidebarCollapsed: boolean
  drawerWidth: number
  drawerFull: boolean
  columnWidths: Record<string, number[]> // keyed by table id, e.g. { budget: [..7 widths..] }
  pinnedTools: ToolKey[]                  // Phase 3
  // (collapse states / last-tool are OPTIONAL extras — add only if cheap)
}
```
- Keep the UI dumb: a pure `defaultSettings()` + `coerceSettings(raw)` (validate/migrate a
  loaded blob) live in `src/lib/`; components read via a `useSettings()` hook, never touch
  `localStorage` directly.
- **AppState stays the runtime source of truth.** Persistence is a thin layer: hydrate the
  persisted subset of `AppState` from settings at boot, and write changes back (debounced).
  Do NOT move all of AppState into settings — only the durable-preference fields.

## Build-on inventory (read these fresh before using)
REUSE, do not fork:
- `src/lib/userDataSource.ts` + `src/state/UserDataContext.tsx` + `src/data/localUserData.ts`
  — the seam + provider + localStorage impl pattern. The settings store is a leaner sibling
  (`SettingsSource` with a `localSettings()` v1 impl; a `supabaseSettings()` later).
- `src/main.tsx` — where providers mount. `SettingsProvider` goes HIGH (localStorage needs
  no auth/data), wrapping the tree in both the live and seed branches.
- `src/state/appState.ts` + `src/state/AppContext.tsx` (`patch()`) — the runtime state. The
  persist-worthy fields today: `sidebarCollapsed`, `drawerWidth`, `drawerFull` (+ the
  collapse Sets/flags as optional). `initialState` hydrates from settings at boot.
- `src/components/views/BudgetView.tsx` — the resizable-column precedent: widths live in a
  `widthsRef` + a `--budget-grid` CSS var written to the DOM (NOT React state), reset on
  reload. Phase 2 hydrates that ref from `settings.columnWidths.budget` + saves on drag-end.
- `src/components/layout/Sidebar.tsx` — the hardcoded `SCOPES` array (Phase 4 derives it) +
  the tool nav / `GROUPS` (Phase 3 pins/reorders). `src/theme/tokens.ts` `projectMeta` +
  `src/types.ts` `Project` — the hardcoded project meta/type (Phase 4 touches the visible
  list, NOT the type, for v1).
- `src/components/layout/Header.tsx` — where the Settings gear button + trigger live.
- Overlay pattern (README "Global Layout"): the Settings menu renders `position:fixed`
  OUTSIDE the card's `overflow:hidden` — mount it in `App.tsx`'s overlay slot like the
  other overlays; never inside the card.

## Pure logic to extract + unit-test
- `src/lib/settings.ts` — `defaultSettings(): UserSettings`, `coerceSettings(raw: unknown):
  UserSettings` (validate + version-migrate a loaded blob; drop junk, clamp numbers), and
  `applyToTable(widths, colCount, mins)` helpers. Pure; co-located `.test.ts`. **This is the
  load-bearing correctness** — a corrupt/old localStorage blob must never crash the app.
- `src/selectors/` — `activeProjects(itemsByTool): Project[]` (Phase 4): the scopes that have
  ≥1 item, in a stable order. Pure. And `orderedNav(groups, pinned)` (Phase 3): the sidebar
  order with pinned tools surfaced. Both deterministic; feed fixtures.

## Sub-phasing (ship + verify each)

### Phase 1 — settings store + Settings menu (the foundation)
- **Scope:** `SettingsSource` seam + `localSettings()` (localStorage) impl + `SettingsProvider`
  / `useSettings()` (get/set, write-through) + pure `defaultSettings`/`coerceSettings`
  (+tests) + a **Settings overlay** (gear in the Header → a `position:fixed` panel in the
  App overlay slot) with a "Reset to defaults" action and ONE real setting wired end-to-end
  (recommend: "Collapse sidebar by default" → persists `sidebarCollapsed`) to prove the loop.
- **Approval gates:** none (localStorage only, no backend/Procore). Standard exit gate.
- **Exit criteria:** typecheck + test + build green; `coerceSettings` unit-tested against
  junk/old blobs; seed `:5174` + a plain reload — toggle the setting, reload, it sticks;
  "Reset" restores defaults; a hand-corrupted localStorage value doesn't crash (falls back
  to defaults). Overlay renders outside the card. Don't commit until "Approved."

### Phase 2 — persist UI state across reloads
- **Scope:** hydrate + write-back for `sidebarCollapsed`, `drawerWidth`, `drawerFull` (a thin
  AppState↔settings bridge — a pure map of which fields persist + a debounced subscriber) and
  **column widths** (refactor `BudgetView` — and any other resizable table — to hydrate the
  `widthsRef` from `settings.columnWidths[tableId]` and save on drag-end). Optional extras
  (only if cheap): collapse states, last-tool.
- **Exit criteria:** typecheck + test + build green; resize a Budget column + the drawer,
  collapse the sidebar, reload → all remembered; defaults still apply on a fresh profile.

### Phase 3 — pin / reorder tools in the sidebar
- **Scope:** `pinnedTools` setting + a pin control (hover affordance) on each tool + a
  "Pinned" section (or surfaced order) in the Sidebar via a pure `orderedNav`. (Drag-to-
  reorder optional; a pin toggle is the v1 floor.)
- **Exit criteria:** typecheck + test + build green; pin/unpin persists across reload; the
  ball-in-court badges + nav still work; `orderedNav` unit-tested.

### Phase 4 — fix the project switcher (data-derived; independent of the store)
- **Scope:** a pure `activeProjects(itemsByTool)` selector; the Sidebar's `SCOPES` becomes
  `['all', ...activeProjects]` so empty projects (McKenna) vanish. Guard `state.project`:
  if it points at a now-hidden scope, reset to `'all'`. Keep the `Project` union + `projectMeta`
  as-is for v1 (a synced project without meta gets a fallback swatch color — note it). This
  phase needs NO settings store, so it can run independently / first if desired.
- **Exit criteria:** typecheck + test + build green; live `:5175` — only OP III (+ All) show,
  no McKenna; `activeProjects` unit-tested; switching scope still filters correctly.

## Hard guardrails (do not violate)
- **Overlays render `position:fixed` OUTSIDE the card's `overflow:hidden`** — the Settings
  menu mounts in `App.tsx`'s overlay slot, never inside the card.
- **AppState + `patch()` stay the runtime state model** — settings persistence is a thin
  hydrate/write-back bridge; don't fork a second state system or move view state into
  components. View-models stay in `src/selectors/`.
- **The ball-in-court rule stays centralized** in `src/lib/ballInCourt.ts` — Phase 3/4 touch
  the sidebar's nav order + project list, NOT the court rule; never duplicate `TERMINAL`.
- **The domain atom is `Item`** — never introduce a type named `Record`. `UserSettings` is a
  new client type, not a Procore shape.
- **One token source** (`src/theme/tokens.ts` + `src/index.css`) — the Settings menu + pins
  use existing tokens; no ad-hoc hex.
- **Keep the read seam a pure mirror** — settings are a SEPARATE client-only store; do NOT
  add settings to `DataSource`/`SiteData`. localStorage access is confined to the settings
  source (components use `useSettings()`), exactly like the UserData seam confines its writes.
- **Corruption-safe** — a malformed/old localStorage blob must degrade to defaults, never
  throw (that's what `coerceSettings` + its tests guarantee).

## Open decisions (minor — resolve at each phase, defaults noted)
- Settings menu = an overlay panel (recommended) vs. a full view. → overlay panel.
- Which extras persist (collapse states, last tool/project) — decide in Phase 2; default:
  ship the high-value set (sidebar/drawer/columns) first, extras only if cheap.
- Phase 3 reorder: pin-toggle only (v1 floor) vs. + drag-to-reorder — decide at Phase 3.

## Verification commands (the exit-criteria gate)
```
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck   # tsc -b (primary gate)
npm --prefix "C:/Users/BUrness/Dev/Sitelines" test            # vitest
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run build       # tsc -b && vite build
```
UI: seed `:5174` + live `:5175` click-through + a **plain reload** (the whole point is
persistence). Read DOM state in a SEPARATE call after a click — React re-renders after the tick.
