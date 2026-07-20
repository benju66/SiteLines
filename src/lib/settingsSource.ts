// The settings seam (User Settings & UX, Phase 1). Modeled on the read/UserData
// seams (`dataSource.ts` / `userDataSource.ts`): a tiny interface with swappable
// implementations chosen once in `main.tsx`, so components never touch storage
// directly (they read via `useSettings()`), and the storage backend can change
// with ZERO view changes.
//
//   • localSettings   (v1)    — localStorage, synchronous (see `data/localSettings.ts`).
//   • supabaseSettings (later) — a per-user row; a LATER phase, not built here.
//
// Kept deliberately small (just load/save) so the seed → Supabase swap is a
// provider-only change. localStorage is synchronous, so v1's load()/save() are
// sync — simpler than the async UserData seam. A future Supabase impl would make
// load() async; that change is absorbed inside `SettingsProvider` (it would gain a
// loading state), while consumers reading `settings` via `useSettings()` stay
// identical.

import type { UserSettings } from './settings'

export interface SettingsSource {
  /** Short label for diagnostics, e.g. 'local-settings' | 'supabase-settings'. */
  name: string
  /** Read the persisted settings. Always resolves to a valid UserSettings — the
   *  impl coerces a malformed/absent blob to defaults rather than throwing. */
  load(): UserSettings
  /** Persist the full settings object (write-through). Never throws — storage
   *  failures (quota / unavailable) are swallowed as non-fatal. */
  save(settings: UserSettings): void
}
