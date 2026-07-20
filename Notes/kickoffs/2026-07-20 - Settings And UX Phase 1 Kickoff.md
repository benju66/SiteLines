# Kickoff — User Settings & UX, Phase 1: settings store + Settings menu

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — foundational client architecture (a persistence seam) with corruption-safety correctness. Escalate to `claude-fable-5` (`/model claude-fable-5`) only if genuinely stuck.
>
> Implement **Phase 1 of User Settings & UX** (a localStorage-backed settings store + a Settings menu). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-20 - Settings And UX Phase 1 Kickoff.md` (this file)
> - `Notes/plans/Settings-And-UX-Plan.md` (the plan) + `PLAN.md` (the User Settings & UX workstream) + `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase 1**. Guardrail: the Settings menu is a `position:fixed` overlay mounted in `App.tsx`'s overlay slot (OUTSIDE the card's `overflow:hidden`); a corrupt/old localStorage blob must degrade to defaults, never throw. No backend (localStorage only). Verify with typecheck + test + build + a seed `:5174` click-through **and a plain reload** (persistence is the point). Don't commit until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What this phase is
Build the **foundation** the whole workstream plugs into: a **user-settings store**
(localStorage for v1) + a **Settings menu** surface, proven end-to-end with one real
persisted setting. Later phases (persist UI state, pin tools, project fix) add preferences
onto this store — Phase 1 must make the store + menu + persistence loop solid and
corruption-safe.

## Required reading (in order)
1. `Notes/plans/Settings-And-UX-Plan.md` — the full plan (data model, build-on inventory,
   pure logic, all four phases). **Authoritative.**
2. `PLAN.md` — the User Settings & UX workstream row (context/status).
3. `design_handoff_sitelines/README.md` (Global Layout / overlay rules, Header) +
   `DATA_CONTRACT.md` (the read seam stays a pure mirror — settings are SEPARATE).
4. **Re-read fresh before cloning the pattern:** `src/lib/userDataSource.ts` +
   `src/state/UserDataContext.tsx` + `src/data/localUserData.ts` (the seam + provider +
   localStorage impl to model the settings store on); `src/main.tsx` (where providers
   mount); `src/components/layout/Header.tsx` (where the gear trigger goes); `App.tsx`
   (the overlay slot); `src/state/appState.ts` + `AppContext.tsx` (`sidebarCollapsed` is
   the setting to wire).

## Scope (build ONLY this)
- **Seam:** `src/lib/settingsSource.ts` — a `SettingsSource` interface (`load()` /
  `save(settings)`; sync is fine for localStorage v1) modeled on `UserDataSource`. A
  `src/data/localSettings.ts` localStorage impl (`sitelines.settings` key). (A
  `supabaseSettings` variant is a LATER phase — leave a note, don't build it.)
- **Pure logic (+tests):** `src/lib/settings.ts` — `UserSettings` type (versioned, see the
  plan), `defaultSettings()`, and `coerceSettings(raw: unknown): UserSettings` that
  validates + version-migrates a loaded blob and **falls back to defaults on anything
  malformed** (bad JSON, wrong version, junk fields, out-of-range numbers). Co-located
  `settings.test.ts` covering: empty, valid, partial, corrupt, and old-version blobs.
- **Provider:** `src/state/SettingsContext.tsx` — `SettingsProvider` (loads once via the
  source, exposes `settings` + `setSetting(key, value)` / `resetSettings()`, write-through
  to the source). Mount it HIGH in `src/main.tsx` (both live + seed branches — localStorage
  needs no auth).
- **Surface:** a **gear button** in the Header opening a **Settings overlay** — a
  `position:fixed` panel mounted in `App.tsx`'s overlay slot (per the overlay guardrail),
  Esc/backdrop to close. v1 content: a "Collapse sidebar by default" toggle wired to persist
  `sidebarCollapsed` end-to-end + a "Reset to defaults" action. Keep it small but real.
- Wire `AppState.sidebarCollapsed` to initialize from settings at boot (the minimal
  hydrate) so the toggle demonstrably persists across reload. (The fuller UI-state bridge is
  Phase 2 — keep Phase 1 to this one field.)

## Hard guardrails / gates
- **No backend, no ⛔ gates** — localStorage only. Do NOT add a Supabase table or touch the
  read seam / `DataSource` / `SiteData`. Settings are a separate client store.
- **Overlay rule:** the Settings menu is `position:fixed` in `App.tsx`'s overlay slot,
  OUTSIDE the card's `overflow:hidden`. Add Esc handling alongside the other overlays.
- **Corruption-safe:** `coerceSettings` must never throw on a bad blob — always return a
  valid `UserSettings` (defaults for missing/invalid fields). This is the load-bearing
  correctness; test it hard.
- **AppState + `patch()` stay the runtime state** — settings persistence is a thin bridge,
  not a second state system. One token source; no ad-hoc hex. Never introduce a `Record` type.

## Exit criteria (the gate — all must pass)
```
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck
npm --prefix "C:/Users/BUrness/Dev/Sitelines" test
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run build
```
- `defaultSettings` + `coerceSettings` unit-tested (incl. corrupt/old/partial blobs → defaults).
- Seed `:5174` click-through **+ a plain browser reload**: open Settings (gear), toggle
  "Collapse sidebar by default", reload → the sidebar preference sticks; "Reset to defaults"
  restores it; hand-corrupt the `sitelines.settings` localStorage value → the app still
  loads (falls back to defaults), no crash, no console errors. Overlay renders outside the card.
- Stop at the phase boundary; **don't commit or push until the owner says "Approved."**

## Notes for the implementer
- localStorage is synchronous, so the settings source can be sync (simpler than the async
  UserData seam) — but keep the source interface small so a later async Supabase impl is a
  provider-only change. Note that in a comment.
- `SettingsProvider` wraps the tree in BOTH branches of `main.tsx` (it doesn't depend on
  auth/data). Put it outermost so the whole app (incl. the shell) can read settings.
- Keep Phase 1 tight: ONE wired setting (`sidebarCollapsed`) proves the loop. Resist wiring
  column widths / drawer here — that's Phase 2.
