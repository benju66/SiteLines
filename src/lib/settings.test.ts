import { describe, expect, it } from 'vitest'
import { coerceSettings, defaultSettings, SETTINGS_VERSION, type UserSettings } from './settings'

describe('defaultSettings', () => {
  it('is a valid, current-version blob', () => {
    expect(defaultSettings()).toEqual({ version: SETTINGS_VERSION, sidebarCollapsed: false })
  })

  it('returns a fresh object each call (safe to mutate/store)', () => {
    const a = defaultSettings()
    const b = defaultSettings()
    expect(a).not.toBe(b)
    a.sidebarCollapsed = true
    expect(defaultSettings().sidebarCollapsed).toBe(false)
  })
})

describe('coerceSettings', () => {
  const D = defaultSettings()

  it('keeps a valid current-version blob', () => {
    expect(coerceSettings({ version: 1, sidebarCollapsed: true })).toEqual({ version: 1, sidebarCollapsed: true })
    expect(coerceSettings({ version: 1, sidebarCollapsed: false })).toEqual({ version: 1, sidebarCollapsed: false })
  })

  it('falls back to defaults for a partial blob (missing field)', () => {
    // version present, sidebarCollapsed absent → the field defaults, version kept.
    expect(coerceSettings({ version: 1 })).toEqual(D)
  })

  it('falls back per-field when a field is the wrong type', () => {
    expect(coerceSettings({ version: 1, sidebarCollapsed: 'yes' })).toEqual(D)
    expect(coerceSettings({ version: 1, sidebarCollapsed: 1 })).toEqual(D)
    expect(coerceSettings({ version: 1, sidebarCollapsed: null })).toEqual(D)
  })

  it('strips unknown/junk keys', () => {
    const out = coerceSettings({ version: 1, sidebarCollapsed: true, bogus: 123, nested: { x: 1 } })
    expect(out).toEqual({ version: 1, sidebarCollapsed: true })
    expect(Object.keys(out).sort()).toEqual(['sidebarCollapsed', 'version'])
  })

  it('falls back to defaults for an empty object', () => {
    expect(coerceSettings({})).toEqual(D)
  })

  it('falls back to defaults for non-object input (never throws)', () => {
    expect(coerceSettings(null)).toEqual(D)
    expect(coerceSettings(undefined)).toEqual(D)
    expect(coerceSettings('sitelines')).toEqual(D)
    expect(coerceSettings(42)).toEqual(D)
    expect(coerceSettings(true)).toEqual(D)
    expect(coerceSettings([{ version: 1, sidebarCollapsed: true }])).toEqual(D)
    expect(coerceSettings(NaN)).toEqual(D)
  })

  it('falls back to defaults for an old/newer/out-of-range version', () => {
    // A previous schema we do not (yet) migrate → defaults, not a trusted read.
    expect(coerceSettings({ version: 0, sidebarCollapsed: true })).toEqual(D)
    // A newer schema this build cannot understand → defaults.
    expect(coerceSettings({ version: 99, sidebarCollapsed: true })).toEqual(D)
    // Out-of-range / non-integer / negative version numbers → defaults.
    expect(coerceSettings({ version: -1, sidebarCollapsed: true })).toEqual(D)
    expect(coerceSettings({ version: 1.5, sidebarCollapsed: true })).toEqual(D)
  })

  it('falls back to defaults when version is the wrong type or absent', () => {
    expect(coerceSettings({ version: '1', sidebarCollapsed: true })).toEqual(D)
    expect(coerceSettings({ version: null, sidebarCollapsed: true })).toEqual(D)
    expect(coerceSettings({ sidebarCollapsed: true })).toEqual(D)
  })

  it('never returns the same reference as the caller-visible default', () => {
    // Guards against accidentally returning a shared singleton that a caller mutates.
    const a = coerceSettings({ version: 1, sidebarCollapsed: true })
    const b = coerceSettings({ version: 1, sidebarCollapsed: true })
    expect(a).not.toBe(b)
  })

  it('round-trips a coerced blob unchanged (idempotent)', () => {
    const once: UserSettings = coerceSettings({ version: 1, sidebarCollapsed: true, junk: true })
    expect(coerceSettings(once)).toEqual(once)
  })
})
