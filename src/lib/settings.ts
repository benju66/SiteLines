// User settings — the pure, load-bearing core of the preferences layer (User
// Settings & UX). A versioned, forward-migratable client-only blob (localStorage
// today; a per-user Supabase row later). This module is pure and unit-tested: NO
// DOM, NO localStorage, NO clock. The seam that reads/writes it lives in
// `settingsSource.ts` (+ `data/localSettings.ts`); the provider that exposes it
// lives in `state/SettingsContext.tsx`; the AppState↔settings write-back bridge
// lives in `state/SettingsBridge.tsx`.
//
// Corruption-safety is the whole point of coerceSettings(): a malformed, junk, or
// old/newer blob must ALWAYS degrade to valid defaults and NEVER throw. Everything
// downstream (the provider, the boot hydrate, the bridge) can then assume a clean
// UserSettings.

import { DRAWER_DEFAULT_WIDTH, DRAWER_MIN_WIDTH } from './drawerNav'

/** The current on-disk schema version. Bump this when the shape changes, and add a
 *  migration branch in coerceSettings() that upgrades recognized older blobs.
 *  History: v1 = { sidebarCollapsed }; v2 (Phase 2) adds drawerWidth/drawerFull/columnWidths. */
export const SETTINGS_VERSION = 2

/** Absolute ceiling for a persisted drawer width. Generous on purpose — the runtime
 *  re-clamps to the live viewport via clampDrawerWidth(); this only rejects garbage. */
const DRAWER_WIDTH_CEILING = 4000

/**
 * The persisted user-settings shape.
 *
 * Phase 1 wired `sidebarCollapsed`; Phase 2 adds the rest of the durable UI state:
 * the detail-drawer width + full-width toggle, and per-table column widths (keyed by
 * a table id, e.g. `{ budget: [...9 widths...] }`). Phase 3 will add `pinnedTools`.
 * See `Notes/plans/Settings-And-UX-Plan.md` for the fuller target shape.
 */
export interface UserSettings {
  version: typeof SETTINGS_VERSION
  /** Start the app with the sidebar pinned to its compact icon rail. */
  sidebarCollapsed: boolean
  /** Detail-drawer width in px (drag-resizable; runtime re-clamps to viewport). */
  drawerWidth: number
  /** Detail drawer expanded to near-full width. */
  drawerFull: boolean
  /** Resizable-table column widths, keyed by table id (e.g. 'budget'). */
  columnWidths: Record<string, number[]>
}

/** A fresh, valid settings object — the fallback for anything missing or malformed.
 *  These defaults mirror `initialState` in `state/appState.ts` for the fields the
 *  boot hydrate bridges. Returns a NEW object each call so callers can freely
 *  mutate/store the result. */
export function defaultSettings(): UserSettings {
  return {
    version: SETTINGS_VERSION,
    sidebarCollapsed: false,
    drawerWidth: DRAWER_DEFAULT_WIDTH,
    drawerFull: false,
    columnWidths: {},
  }
}

/** Narrow an unknown to a plain (non-array, non-null) object without ever throwing. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** A finite drawer width, clamped to [DRAWER_MIN_WIDTH, ceiling]; else the fallback. */
function coerceDrawerWidth(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(DRAWER_WIDTH_CEILING, Math.max(DRAWER_MIN_WIDTH, v))
}

/** Keep only well-formed entries: a table id → an array of finite positive numbers.
 *  Any malformed entry (non-array, or an array with junk/negative numbers) is dropped.
 *  Length-vs-column-count is NOT validated here — that's applyToTable's job at read time
 *  (the column count isn't known to this pure blob-level coerce). */
function coerceColumnWidths(v: unknown): Record<string, number[]> {
  if (!isPlainObject(v)) return {}
  const out: Record<string, number[]> = {}
  for (const [key, val] of Object.entries(v)) {
    if (Array.isArray(val) && val.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)) {
      out[key] = val.slice()
    }
  }
  return out
}

/**
 * Validate + version-migrate a loaded blob into a clean UserSettings.
 *
 * Guarantees: never throws, always returns a valid UserSettings, and strips any
 * unknown keys (the result is built field-by-field from a fresh default). A field of
 * the wrong type falls back to its default; numbers out of range are clamped.
 *
 * Version handling (forward-migratable): a recognized OLDER version is upgraded,
 * preserving its still-valid fields; the CURRENT version is read field-by-field; an
 * unrecognized version — newer than this build, or junk/non-integer — degrades to
 * defaults rather than trusting an unknown structure.
 */
export function coerceSettings(raw: unknown): UserSettings {
  const d = defaultSettings()
  if (!isPlainObject(raw)) return d

  // v1 → v2 migration: v1 only had `sidebarCollapsed`. Preserve it; the fields v1
  // never had (drawerWidth/drawerFull/columnWidths) take their v2 defaults. A v1 user
  // keeps their sidebar preference across the upgrade rather than being reset.
  if (raw.version === 1) {
    return {
      ...d,
      sidebarCollapsed: typeof raw.sidebarCollapsed === 'boolean' ? raw.sidebarCollapsed : d.sidebarCollapsed,
    }
  }

  // Anything that isn't the current version (a newer build's blob, or junk) → defaults.
  if (raw.version !== SETTINGS_VERSION) return d

  return {
    version: SETTINGS_VERSION,
    sidebarCollapsed: typeof raw.sidebarCollapsed === 'boolean' ? raw.sidebarCollapsed : d.sidebarCollapsed,
    drawerWidth: coerceDrawerWidth(raw.drawerWidth, d.drawerWidth),
    drawerFull: typeof raw.drawerFull === 'boolean' ? raw.drawerFull : d.drawerFull,
    columnWidths: coerceColumnWidths(raw.columnWidths),
  }
}

/**
 * Resolve a persisted width array against a table's CURRENT columns. Returns a valid
 * width array — same length as `defaults`, each column `≥ mins[i]`. Falls back
 * entirely to `defaults` when `saved` is missing or its length doesn't match the
 * current column count (a stale save from a different table shape can't be trusted).
 * A junk element (non-finite) falls back to that column's default. Pure.
 */
export function applyToTable(saved: number[] | undefined, defaults: number[], mins: number[]): number[] {
  if (!Array.isArray(saved) || saved.length !== defaults.length) return [...defaults]
  return saved.map((w, i) =>
    typeof w === 'number' && Number.isFinite(w) ? Math.max(mins[i] ?? 0, w) : defaults[i],
  )
}
