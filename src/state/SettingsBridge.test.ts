import { describe, expect, it } from 'vitest'
import { initialState } from './appState'
import { persistedFromState } from './SettingsBridge'

describe('persistedFromState', () => {
  it('projects only the durable subset of AppState', () => {
    expect(persistedFromState(initialState)).toEqual({
      sidebarCollapsed: false,
      drawerWidth: 452,
      drawerFull: false,
    })
  })

  it('reflects changed durable fields and ignores runtime-only ones', () => {
    const state = { ...initialState, sidebarCollapsed: true, drawerWidth: 600, drawerFull: true, activity: true, palette: true }
    expect(persistedFromState(state)).toEqual({
      sidebarCollapsed: true,
      drawerWidth: 600,
      drawerFull: true,
    })
  })
})
