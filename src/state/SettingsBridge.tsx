// The AppState↔settings write-back bridge (User Settings & UX, Phase 2). AppState +
// patch() stay the runtime source of truth; this is the thin mirror-out layer: when
// a DURABLE field of AppState changes, persist that subset to settings. The reverse
// direction (settings → AppState) is the boot hydrate in AppContext.tsx.
//
// Only these fields persist — a deliberately small map, NOT all of AppState (view
// state like open drawers / sort stays runtime-only). Adding a field to persistence
// is a one-line change to persistedFromState + the boot hydrate.
//
// No debounce needed: the writes are already coarse. `drawerWidth` is committed once
// on drag-release (not per pointer-move — the drag writes straight to the DOM node);
// `sidebarCollapsed` / `drawerFull` are discrete toggles. So each user action is at
// most one save.

import { useEffect, useRef } from 'react'
import { useSettings } from './SettingsContext'
import { useApp } from './AppContext'
import type { AppState } from './appState'

/** The persisted subset of AppState — the single source of "which fields are durable". */
export type PersistedAppState = {
  sidebarCollapsed: boolean
  drawerWidth: number
  drawerFull: boolean
}

/** Pure projection of AppState onto its durable subset. */
export function persistedFromState(state: AppState): PersistedAppState {
  return {
    sidebarCollapsed: state.sidebarCollapsed,
    drawerWidth: state.drawerWidth,
    drawerFull: state.drawerFull,
  }
}

/** Renders nothing; subscribes AppState's durable subset out to the settings store. */
export function SettingsBridge() {
  const { state } = useApp()
  const { settings, patchSettings } = useSettings()
  const persisted = persistedFromState(state)

  // Baseline = what's already persisted (initialized from the loaded settings). Because
  // AppState boot-hydrates FROM settings, the mount value equals this baseline, so the
  // initial render never writes — and StrictMode's double-invoked effect stays a no-op
  // too. localStorage therefore stays untouched until the user actually changes something.
  const lastRef = useRef<PersistedAppState>({
    sidebarCollapsed: settings.sidebarCollapsed,
    drawerWidth: settings.drawerWidth,
    drawerFull: settings.drawerFull,
  })

  useEffect(() => {
    const prev = lastRef.current
    if (
      prev.sidebarCollapsed === persisted.sidebarCollapsed &&
      prev.drawerWidth === persisted.drawerWidth &&
      prev.drawerFull === persisted.drawerFull
    ) {
      return
    }
    lastRef.current = persisted
    patchSettings(persisted)
  }, [persisted.sidebarCollapsed, persisted.drawerWidth, persisted.drawerFull, patchSettings])

  return null
}
