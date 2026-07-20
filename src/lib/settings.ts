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

import type { ToolKey } from '@/types'
import { DRAWER_DEFAULT_WIDTH, DRAWER_MIN_WIDTH } from './drawerNav'

/** The current on-disk schema version. Bump this when the shape changes, and add a
 *  migration branch in coerceSettings() that upgrades recognized older blobs.
 *  History: v1 = { sidebarCollapsed }; v2 adds drawerWidth/drawerFull/columnWidths;
 *  v3 (Phase 3) adds pinnedTools. */
export const SETTINGS_VERSION = 3

/** Absolute ceiling for a persisted drawer width. Generous on purpose — the runtime
 *  re-clamps to the live viewport via clampDrawerWidth(); this only rejects garbage. */
const DRAWER_WIDTH_CEILING = 4000

/**
 * The persisted user-settings shape.
 *
 * Grown a field at a time (each with a coerceSettings migration branch): v1 wired
 * `sidebarCollapsed`; v2 added the drawer width/full + per-table column widths; v3
 * adds `pinnedTools` (sidebar tools surfaced to a "Pinned" section, in pin order).
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
  /** Sidebar tools the user pinned, in pin order (surfaced above the groups). */
  pinnedTools: ToolKey[]
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
    pinnedTools: [],
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

/** A de-duplicated array of the string entries in `v` (dropping non-strings); [] if not
 *  an array. Tool-existence isn't checked here (this pure blob-level coerce doesn't know
 *  the tool registry) — orderedNav filters stale keys against the live groups at read time. */
function coerceStringArray(v: unknown): ToolKey[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: ToolKey[] = []
  for (const x of v) {
    if (typeof x === 'string' && !seen.has(x)) {
      seen.add(x)
      out.push(x as ToolKey)
    }
  }
  return out
}

/** The v2 field set (shared by the v2→current migration and the current-version read). */
function coerceV2Fields(raw: Record<string, unknown>, d: UserSettings) {
  return {
    sidebarCollapsed: typeof raw.sidebarCollapsed === 'boolean' ? raw.sidebarCollapsed : d.sidebarCollapsed,
    drawerWidth: coerceDrawerWidth(raw.drawerWidth, d.drawerWidth),
    drawerFull: typeof raw.drawerFull === 'boolean' ? raw.drawerFull : d.drawerFull,
    columnWidths: coerceColumnWidths(raw.columnWidths),
  }
}

/**
 * Validate + version-migrate a loaded blob into a clean UserSettings.
 *
 * Guarantees: never throws, always returns a valid UserSettings, and strips any
 * unknown keys (the result is built field-by-field from a fresh default). A field of
 * the wrong type falls back to its default; numbers out of range are clamped.
 *
 * Version handling (forward-migratable): a recognized OLDER version is upgraded,
 * reading only the fields that legitimately existed in that version (so a hand-forged
 * old blob can't smuggle a newer field through) and defaulting the rest; the CURRENT
 * version is read field-by-field; an unrecognized version — newer than this build, or
 * junk/non-integer — degrades to defaults rather than trusting an unknown structure.
 */
export function coerceSettings(raw: unknown): UserSettings {
  const d = defaultSettings()
  if (!isPlainObject(raw)) return d

  // v1 → current: v1 only had sidebarCollapsed.
  if (raw.version === 1) {
    return { ...d, sidebarCollapsed: typeof raw.sidebarCollapsed === 'boolean' ? raw.sidebarCollapsed : d.sidebarCollapsed }
  }
  // v2 → current: v2 added drawerWidth/drawerFull/columnWidths (no pinnedTools yet).
  if (raw.version === 2) {
    return { ...d, ...coerceV2Fields(raw, d) }
  }
  // Anything that isn't the current version (a newer build's blob, or junk) → defaults.
  if (raw.version !== SETTINGS_VERSION) return d

  return {
    version: SETTINGS_VERSION,
    ...coerceV2Fields(raw, d),
    pinnedTools: coerceStringArray(raw.pinnedTools),
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
