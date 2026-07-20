// Settings provider (User Settings & UX, Phase 1). Loads the persisted settings
// ONCE from the source and exposes them plus get/set + reset, write-through to the
// source on every change. Mounts HIGH in `main.tsx` (outermost, both branches) —
// localStorage needs no auth/data, and the whole tree (including AppProvider's boot
// hydrate of `sidebarCollapsed`) reads it.
//
// This is a THIN persistence layer, deliberately separate from AppState: AppState +
// patch() stay the runtime source of truth; SettingsContext only owns the durable
// preferences. Components never touch localStorage — they read via useSettings().
//
// v1 loads synchronously (localStorage is sync), so there's no loading state. A
// later async Supabase source would move the load into an effect and add a loading
// state HERE; consumers reading `settings` via useSettings() would not change.

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { defaultSettings, type UserSettings } from '@/lib/settings'
import type { SettingsSource } from '@/lib/settingsSource'
import type { ToolKey } from '@/types'

interface SettingsContextValue {
  /** The current, always-valid settings (coerced at load). */
  settings: UserSettings
  /** Update one preference and write it through to the source. */
  setSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void
  /** Merge a partial patch across several preferences in ONE write-through (used by
   *  the AppState↔settings bridge to persist the durable subset in a single save). */
  patchSettings: (partial: Partial<UserSettings>) => void
  /** Persist a resizable table's column widths (merged into `columnWidths[tableId]`). */
  setColumnWidths: (tableId: string, widths: number[]) => void
  /** Pin (append) or unpin a sidebar tool, persisting the new `pinnedTools` order. */
  togglePinnedTool: (toolKey: ToolKey) => void
  /** Restore every preference to its default and persist that. */
  resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ source, children }: { source: SettingsSource; children: ReactNode }) {
  // Lazy initializer → load() runs once at mount (idempotent, so StrictMode's
  // dev-only double-invoke is harmless).
  const [settings, setSettings] = useState<UserSettings>(() => source.load())

  const setSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value }
        source.save(next) // write-through inside the updater always sees the latest state; save is idempotent
        return next
      })
    },
    [source],
  )

  const patchSettings = useCallback(
    (partial: Partial<UserSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial }
        source.save(next)
        return next
      })
    },
    [source],
  )

  const setColumnWidths = useCallback(
    (tableId: string, widths: number[]) => {
      setSettings((prev) => {
        const next = { ...prev, columnWidths: { ...prev.columnWidths, [tableId]: widths } }
        source.save(next)
        return next
      })
    },
    [source],
  )

  const togglePinnedTool = useCallback(
    (toolKey: ToolKey) => {
      setSettings((prev) => {
        const pinnedTools = prev.pinnedTools.includes(toolKey)
          ? prev.pinnedTools.filter((t) => t !== toolKey)
          : [...prev.pinnedTools, toolKey]
        const next = { ...prev, pinnedTools }
        source.save(next)
        return next
      })
    },
    [source],
  )

  const resetSettings = useCallback(() => {
    const next = defaultSettings()
    source.save(next)
    setSettings(next)
  }, [source])

  const value = useMemo(
    () => ({ settings, setSetting, patchSettings, setColumnWidths, togglePinnedTool, resetSettings }),
    [settings, setSetting, patchSettings, setColumnWidths, togglePinnedTool, resetSettings],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>')
  return ctx
}
