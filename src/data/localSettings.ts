// Local (localStorage) SettingsSource — the v1 backend for the settings seam
// (User Settings & UX, Phase 1). Persists the whole UserSettings blob under a
// single key. Reads are defensive at every step so a corrupt/absent value, bad
// JSON, or an unavailable localStorage (private mode / no DOM) can NEVER crash the
// app — each failure path returns clean defaults, and the blob itself is run
// through coerceSettings() (which strips junk and version-migrates). Mirrors
// `createLocalUserData`'s shape so a later `createSupabaseSettings` swap in
// `main.tsx` needs zero component changes.

import { coerceSettings, defaultSettings, type UserSettings } from '@/lib/settings'
import type { SettingsSource } from '@/lib/settingsSource'

const STORAGE_KEY = 'sitelines.settings'

export function createLocalSettings(): SettingsSource {
  return {
    name: 'local-settings',

    load(): UserSettings {
      let raw: string | null = null
      try {
        raw = localStorage.getItem(STORAGE_KEY)
      } catch {
        return defaultSettings() // localStorage unavailable (private mode / no DOM)
      }
      if (!raw) return defaultSettings() // never written yet
      try {
        return coerceSettings(JSON.parse(raw)) // coerce validates + falls back per field
      } catch {
        return defaultSettings() // bad JSON → start clean rather than crash
      }
    },

    save(settings: UserSettings): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      } catch {
        // Quota / availability failures are non-fatal: the in-memory provider state
        // still reflects the change for this session.
      }
    },
  }
}
