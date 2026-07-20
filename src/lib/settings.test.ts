import { describe, expect, it } from 'vitest'
import { DRAWER_DEFAULT_WIDTH, DRAWER_MIN_WIDTH } from './drawerNav'
import { applyToTable, coerceSettings, defaultSettings, SETTINGS_VERSION } from './settings'

describe('defaultSettings', () => {
  it('is a valid, current-version blob mirroring initialState', () => {
    expect(defaultSettings()).toEqual({
      version: SETTINGS_VERSION,
      sidebarCollapsed: false,
      drawerWidth: DRAWER_DEFAULT_WIDTH,
      drawerFull: false,
      columnWidths: {},
      pinnedTools: [],
    })
  })

  it('returns a fresh object each call (safe to mutate/store)', () => {
    const a = defaultSettings()
    const b = defaultSettings()
    expect(a).not.toBe(b)
    expect(a.columnWidths).not.toBe(b.columnWidths)
    expect(a.pinnedTools).not.toBe(b.pinnedTools)
    a.sidebarCollapsed = true
    a.pinnedTools.push('budget')
    expect(defaultSettings().sidebarCollapsed).toBe(false)
    expect(defaultSettings().pinnedTools).toEqual([])
  })
})

describe('coerceSettings', () => {
  const D = defaultSettings()

  it('keeps a valid current-version (v3) blob', () => {
    const blob = { version: 3, sidebarCollapsed: true, drawerWidth: 520, drawerFull: true, columnWidths: { budget: [300, 110] }, pinnedTools: ['budget', 'rfis'] }
    expect(coerceSettings(blob)).toEqual(blob)
  })

  it('strips unknown/junk keys', () => {
    const out = coerceSettings({ version: 3, sidebarCollapsed: true, drawerWidth: 500, drawerFull: false, columnWidths: {}, pinnedTools: [], bogus: 1, nested: { x: 1 } })
    expect(Object.keys(out).sort()).toEqual(['columnWidths', 'drawerFull', 'drawerWidth', 'pinnedTools', 'sidebarCollapsed', 'version'])
  })

  it('falls back per-field when a field is the wrong type', () => {
    const out = coerceSettings({ version: 3, sidebarCollapsed: 'yes', drawerWidth: 'wide', drawerFull: 1, columnWidths: 'nope', pinnedTools: 'budget' })
    expect(out).toEqual(D)
  })

  describe('drawerWidth clamping', () => {
    it('clamps an out-of-range-high number to the ceiling', () => {
      expect(coerceSettings({ ...D, drawerWidth: 99999 }).drawerWidth).toBe(4000)
    })
    it('clamps a below-min number up to the floor', () => {
      expect(coerceSettings({ ...D, drawerWidth: 10 }).drawerWidth).toBe(DRAWER_MIN_WIDTH)
    })
    it('keeps an in-range number', () => {
      expect(coerceSettings({ ...D, drawerWidth: 600 }).drawerWidth).toBe(600)
    })
    it('defaults on a non-finite / non-number', () => {
      expect(coerceSettings({ ...D, drawerWidth: NaN }).drawerWidth).toBe(DRAWER_DEFAULT_WIDTH)
      expect(coerceSettings({ ...D, drawerWidth: Infinity }).drawerWidth).toBe(DRAWER_DEFAULT_WIDTH)
      expect(coerceSettings({ ...D, drawerWidth: null }).drawerWidth).toBe(DRAWER_DEFAULT_WIDTH)
    })
  })

  describe('columnWidths coercion', () => {
    it('keeps well-formed entries (arrays of positive finite numbers)', () => {
      expect(coerceSettings({ ...D, columnWidths: { budget: [300, 110, 72] } }).columnWidths).toEqual({ budget: [300, 110, 72] })
    })
    it('drops malformed entries (non-array, or arrays with junk / negatives)', () => {
      const out = coerceSettings({ ...D, columnWidths: { budget: [300, 110], bad: 'x', neg: [1, -5], nan: [1, NaN], obj: [{}] } }).columnWidths
      expect(out).toEqual({ budget: [300, 110] })
    })
    it('defaults to {} when columnWidths is not a plain object', () => {
      expect(coerceSettings({ ...D, columnWidths: [1, 2, 3] }).columnWidths).toEqual({})
      expect(coerceSettings({ ...D, columnWidths: null }).columnWidths).toEqual({})
    })
  })

  describe('pinnedTools coercion', () => {
    it('keeps an array of string keys', () => {
      expect(coerceSettings({ ...D, pinnedTools: ['budget', 'rfis', 'punch'] }).pinnedTools).toEqual(['budget', 'rfis', 'punch'])
    })
    it('drops non-string entries and de-duplicates (order preserved)', () => {
      expect(coerceSettings({ ...D, pinnedTools: ['budget', 42, 'budget', null, 'rfis', {}] }).pinnedTools).toEqual(['budget', 'rfis'])
    })
    it('defaults to [] when pinnedTools is not an array', () => {
      expect(coerceSettings({ ...D, pinnedTools: 'budget' }).pinnedTools).toEqual([])
      expect(coerceSettings({ ...D, pinnedTools: null }).pinnedTools).toEqual([])
    })
  })

  describe('version migration', () => {
    it('migrates a v1 blob forward, preserving sidebarCollapsed', () => {
      expect(coerceSettings({ version: 1, sidebarCollapsed: true })).toEqual({ ...D, sidebarCollapsed: true })
    })
    it('ignores v1 fields that never existed in v1 (only sidebarCollapsed carries over)', () => {
      const out = coerceSettings({ version: 1, sidebarCollapsed: true, drawerWidth: 999, pinnedTools: ['budget'] })
      expect(out).toEqual({ ...D, sidebarCollapsed: true })
    })
    it('migrates a v2 blob forward, preserving its fields and defaulting pinnedTools', () => {
      const v2 = { version: 2, sidebarCollapsed: true, drawerWidth: 600, drawerFull: true, columnWidths: { budget: [300] } }
      expect(coerceSettings(v2)).toEqual({ version: 3, sidebarCollapsed: true, drawerWidth: 600, drawerFull: true, columnWidths: { budget: [300] }, pinnedTools: [] })
    })
    it('ignores a v2 blob’s stray pinnedTools (that field did not exist in v2)', () => {
      const out = coerceSettings({ version: 2, sidebarCollapsed: false, pinnedTools: ['budget'] })
      expect(out.pinnedTools).toEqual([])
    })
  })

  it('falls back to defaults for a partial/empty blob', () => {
    expect(coerceSettings({ version: 3 })).toEqual(D)
    expect(coerceSettings({})).toEqual(D)
  })

  it('falls back to defaults for an unrecognized version (newer / out-of-range / wrong type)', () => {
    expect(coerceSettings({ version: 99, sidebarCollapsed: true })).toEqual(D)
    expect(coerceSettings({ version: 0, sidebarCollapsed: true })).toEqual(D)
    expect(coerceSettings({ version: 2.5, sidebarCollapsed: true })).toEqual(D)
    expect(coerceSettings({ version: '3', sidebarCollapsed: true })).toEqual(D)
    expect(coerceSettings({ sidebarCollapsed: true })).toEqual(D)
  })

  it('falls back to defaults for non-object input (never throws)', () => {
    expect(coerceSettings(null)).toEqual(D)
    expect(coerceSettings(undefined)).toEqual(D)
    expect(coerceSettings('sitelines')).toEqual(D)
    expect(coerceSettings(42)).toEqual(D)
    expect(coerceSettings([{ version: 3 }])).toEqual(D)
    expect(coerceSettings(NaN)).toEqual(D)
  })

  it('round-trips a coerced blob unchanged (idempotent)', () => {
    const once = coerceSettings({ version: 3, sidebarCollapsed: true, drawerWidth: 600, drawerFull: true, columnWidths: { budget: [300] }, pinnedTools: ['budget'], junk: 1 })
    expect(coerceSettings(once)).toEqual(once)
  })
})

describe('applyToTable', () => {
  const DEFAULTS = [300, 110, 90]
  const MINS = [168, 72, 72]

  it('returns defaults when nothing is saved', () => {
    expect(applyToTable(undefined, DEFAULTS, MINS)).toEqual(DEFAULTS)
    expect(applyToTable(undefined, DEFAULTS, MINS)).not.toBe(DEFAULTS) // a copy, not the shared ref
  })

  it('returns defaults on a length mismatch (stale save from a different column count)', () => {
    expect(applyToTable([300, 110], DEFAULTS, MINS)).toEqual(DEFAULTS)
    expect(applyToTable([300, 110, 90, 50], DEFAULTS, MINS)).toEqual(DEFAULTS)
  })

  it('keeps matching-length saved widths', () => {
    expect(applyToTable([320, 140, 100], DEFAULTS, MINS)).toEqual([320, 140, 100])
  })

  it('floors each column at its min', () => {
    expect(applyToTable([10, 140, 5], DEFAULTS, MINS)).toEqual([168, 140, 72])
  })

  it('falls back a junk (non-finite) element to that column default', () => {
    expect(applyToTable([320, NaN, 100], DEFAULTS, MINS)).toEqual([320, 110, 100])
  })
})
