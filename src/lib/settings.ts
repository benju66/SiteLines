// User settings — the pure, load-bearing core of the preferences layer (User
// Settings & UX, Phase 1). A versioned, forward-migratable client-only blob
// (localStorage today; a per-user Supabase row later). This module is pure and
// unit-tested: NO DOM, NO localStorage, NO clock. The seam that reads/writes it
// lives in `settingsSource.ts` (+ `data/localSettings.ts`); the provider that
// exposes it lives in `state/SettingsContext.tsx`.
//
// Corruption-safety is the whole point of coerceSettings(): a malformed, junk, or
// old/newer blob must ALWAYS degrade to valid defaults and NEVER throw. Everything
// downstream (the provider, the boot hydrate) can then assume a clean UserSettings.

/** The current on-disk schema version. Bump this when the shape changes, and add a
 *  migration branch in coerceSettings() that upgrades recognized older blobs. */
export const SETTINGS_VERSION = 1

/**
 * The persisted user-settings shape.
 *
 * Phase 1 wires exactly ONE preference end-to-end (`sidebarCollapsed`) to prove the
 * store → menu → persistence → boot-hydrate loop. Later phases GROW this shape (and
 * bump SETTINGS_VERSION with a migration): Phase 2 adds `drawerWidth` / `drawerFull`
 * / `columnWidths`; Phase 3 adds `pinnedTools`. See `Notes/plans/Settings-And-UX-Plan.md`
 * for the fuller target shape.
 */
export interface UserSettings {
  version: typeof SETTINGS_VERSION
  /** Start the app with the sidebar pinned to its compact icon rail. */
  sidebarCollapsed: boolean
}

/** A fresh, valid settings object — the fallback for anything missing or malformed.
 *  These defaults mirror `initialState` in `state/appState.ts` for the fields the
 *  boot hydrate bridges (Phase 1: sidebarCollapsed). Returns a NEW object each call
 *  so callers can freely mutate/store the result. */
export function defaultSettings(): UserSettings {
  return {
    version: SETTINGS_VERSION,
    sidebarCollapsed: false,
  }
}

/** Narrow an unknown to a plain (non-array, non-null) object without ever throwing. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Validate + version-migrate a loaded blob into a clean UserSettings.
 *
 * Guarantees: never throws, always returns a valid UserSettings, and strips any
 * unknown keys (the result is built field-by-field from a fresh default). A field
 * of the wrong type falls back to its default; the whole blob falls back to defaults
 * when it isn't a plain object or its `version` isn't recognized.
 *
 * Version handling: only a blob at the CURRENT version is read field-by-field. When
 * a future phase bumps SETTINGS_VERSION, add branches here that upgrade a recognized
 * OLDER blob (preserving its still-valid fields) rather than discarding it. Anything
 * with an unrecognized version — an unmigrated-old, a newer, or a junk/non-integer
 * `version` — degrades safely to defaults instead of trusting an unknown structure.
 */
export function coerceSettings(raw: unknown): UserSettings {
  const d = defaultSettings()
  if (!isPlainObject(raw)) return d

  // (Future migrations for older recognized versions slot in here, e.g.
  //   if (raw.version === 1) return migrateV1ToV2(raw)
  // Until then, only the current version is trusted; everything else → defaults.)
  if (raw.version !== SETTINGS_VERSION) return d

  return {
    version: SETTINGS_VERSION,
    sidebarCollapsed: typeof raw.sidebarCollapsed === 'boolean' ? raw.sidebarCollapsed : d.sidebarCollapsed,
  }
}
