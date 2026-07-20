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
    })
  })

  it('returns a fresh object each call (safe to mutate/store)', () => {
    const a = defaultSettings()
    const b = defaultSettings()
    expect(a).not.toBe(b)
    expect(a.columnWidths).not.toBe(b.columnWidths)
    a.sidebarCollapsed = true
    a.columnWidths.budget = [1]
    expect(defaultSettings().sidebarCollapsed).toBe(false)
    expect(defaultSettings().columnWidths).toEqual({})
  })
})

describe('coerceSettings', () => {
  const D = defaultSettings()

  it('keeps a valid current-version (v2) blob', () => {
    const blob = { version: 2, sidebarCollapsed: true, drawerWidth: 520, drawerFull: true, columnWidths: { budget: [300, 110] } }
    expect(coerceSettings(blob)).toEqual(blob)
  })

  it('strips unknown/junk keys', () => {
    const out = coerceSettings({ version: 2, sidebarCollapsed: true, drawerWidth: 500, drawerFull: false, columnWidths: {}, bogus: 1, nested: { x: 1 } })
    expect(Object.keys(out).sort()).toEqual(['columnWidths', 'drawerFull', 'drawerWidth', 'sidebarCollapsed', 'version'])
  })

  it('falls back per-field when a field is the wrong type', () => {
    const out = coerceSettings({ version: 2, sidebarCollapsed: 'yes', drawerWidth: 'wide', drawerFull: 1, columnWidths: 'nope' })
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

  describe('version migration', () => {
    it('migrates a v1 blob forward, preserving sidebarCollapsed', () => {
      expect(coerceSettings({ version: 1, sidebarCollapsed: true })).toEqual({ ...D, sidebarCollapsed: true })
      expect(coerceSettings({ version: 1, sidebarCollapsed: false })).toEqual({ ...D, sidebarCollapsed: false })
    })
    it('migrates a v1 blob with a bad sidebarCollapsed to defaults for that field', () => {
      expect(coerceSettings({ version: 1, sidebarCollapsed: 'x' })).toEqual(D)
      expect(coerceSettings({ version: 1 })).toEqual(D)
    })
    it('ignores v1 fields that never existed in v1 (only sidebarCollapsed carries over)', () => {
      // A hand-forged v1 blob with a stray drawerWidth must NOT smuggle it through the migration.
      const out = coerceSettings({ version: 1, sidebarCollapsed: true, drawerWidth: 999 })
      expect(out).toEqual({ ...D, sidebarCollapsed: true })
      expect(out.drawerWidth).toBe(DRAWER_DEFAULT_WIDTH)
    })
  })

  it('falls back to defaults for a partial/empty blob', () => {
    expect(coerceSettings({ version: 2 })).toEqual(D)
    expect(coerceSettings({})).toEqual(D)
  })

  it('falls back to defaults for an unrecognized version (newer / out-of-range / wrong type)', () => {
    expect(coerceSettings({ version: 99, sidebarCollapsed: true })).toEqual(D)
    expect(coerceSettings({ version: 0, sidebarCollapsed: true })).toEqual(D)
    expect(coerceSettings({ version: 1.5, sidebarCollapsed: true })).toEqual(D)
    expect(coerceSettings({ version: '2', sidebarCollapsed: true })).toEqual(D)
    expect(coerceSettings({ sidebarCollapsed: true })).toEqual(D)
  })

  it('falls back to defaults for non-object input (never throws)', () => {
    expect(coerceSettings(null)).toEqual(D)
    expect(coerceSettings(undefined)).toEqual(D)
    expect(coerceSettings('sitelines')).toEqual(D)
    expect(coerceSettings(42)).toEqual(D)
    expect(coerceSettings([{ version: 2 }])).toEqual(D)
    expect(coerceSettings(NaN)).toEqual(D)
  })

  it('round-trips a coerced blob unchanged (idempotent)', () => {
    const once = coerceSettings({ version: 2, sidebarCollapsed: true, drawerWidth: 600, drawerFull: true, columnWidths: { budget: [300] }, junk: 1 })
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
