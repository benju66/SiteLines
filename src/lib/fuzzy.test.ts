import { describe, expect, it } from 'vitest'
import { fuzzyMatch, fuzzyMatchesAny } from './fuzzy'

describe('fuzzyMatch', () => {
  it('matches a substring and returns its indices', () => {
    expect(fuzzyMatch('case', 'Residential Casework')).toEqual([12, 13, 14, 15])
  })

  it('is case-insensitive', () => {
    expect(fuzzyMatch('CASEWORK', 'casework')).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('matches multiple terms in any order (union of their indices)', () => {
    // "gyp" @0-2, "board" @7-11 in "Gypsum Board" (space at index 6)
    expect(fuzzyMatch('gyp board', 'Gypsum Board')).toEqual([0, 1, 2, 7, 8, 9, 10, 11])
    expect(fuzzyMatch('board gyp', 'Gypsum Board')).toEqual([0, 1, 2, 7, 8, 9, 10, 11])
  })

  it('requires EVERY term to be present', () => {
    expect(fuzzyMatch('gyp bd', 'Gypsum Board')).toBeNull() // "bd" is not a substring
    expect(fuzzyMatch('gyp roof', 'Gypsum Board')).toBeNull()
  })

  it('stays precise on short/common queries (no scattered subsequence match)', () => {
    expect(fuzzyMatch('a2', 'A2.9')).toEqual([0, 1]) // real "A2"
    expect(fuzzyMatch('a2', 'A0.1A')).toBeNull() // has an 'a' and a '2'? no "a2" substring → no match
  })

  it('matches a cost-code fragment including the hyphen/digits', () => {
    expect(fuzzyMatch('12-1235', '12-123530.000')).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('returns null when the term is absent', () => {
    expect(fuzzyMatch('xyz', 'Gypsum Board')).toBeNull()
  })

  it('treats an empty / whitespace query as a trivial match (no filter)', () => {
    expect(fuzzyMatch('', 'anything')).toEqual([])
    expect(fuzzyMatch('   ', 'anything')).toEqual([])
  })

  it('does not mutate and is deterministic (same input → same output)', () => {
    const q = 'case'
    const t = 'Casework'
    expect(fuzzyMatch(q, t)).toEqual(fuzzyMatch(q, t))
    expect(q).toBe('case')
  })
})

describe('fuzzyMatchesAny', () => {
  it('is true when any field matches, false when none do', () => {
    expect(fuzzyMatchesAny('north', ['Mechanical', 'Northline Mechanical', 'SC'])).toBe(true)
    expect(fuzzyMatchesAny('zzz', ['Mechanical', 'Northline Mechanical', 'SC'])).toBe(false)
  })

  it('matches everything on an empty query', () => {
    expect(fuzzyMatchesAny('', ['a', 'b'])).toBe(true)
    expect(fuzzyMatchesAny('  ', [])).toBe(true)
  })

  it('skips null/undefined fields', () => {
    expect(fuzzyMatchesAny('sc', ['Painting', null, undefined, 'SC-25-117-092'])).toBe(true)
    expect(fuzzyMatchesAny('sc', [null, undefined])).toBe(false)
  })
})
