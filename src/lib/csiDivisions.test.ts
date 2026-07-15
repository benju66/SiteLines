import { describe, expect, it } from 'vitest'
import { csiDivisionName, divisionCode } from './csiDivisions'

describe('divisionCode', () => {
  it('takes the first token of a spec number', () => {
    expect(divisionCode('26 0519')).toBe('26')
    expect(divisionCode('00 0101')).toBe('00')
    expect(divisionCode('03 3000')).toBe('03')
  })
  it('tolerates extra whitespace', () => {
    expect(divisionCode('  09   9123 ')).toBe('09')
  })
  it('guards blank / malformed numbers', () => {
    expect(divisionCode('')).toBe('')
    expect(divisionCode('   ')).toBe('')
  })
})

describe('csiDivisionName', () => {
  it('maps known CSI codes to canonical titles', () => {
    expect(csiDivisionName('03')).toBe('Concrete')
    expect(csiDivisionName('26')).toBe('Electrical')
    expect(csiDivisionName('00')).toBe('Procurement & Contracting Requirements')
  })
  it('falls back to "Division <code>" for an unrecognized code', () => {
    expect(csiDivisionName('15')).toBe('Division 15')
  })
  it('returns "Uncategorized" for an empty code', () => {
    expect(csiDivisionName('')).toBe('Uncategorized')
    expect(csiDivisionName('  ')).toBe('Uncategorized')
  })
})
