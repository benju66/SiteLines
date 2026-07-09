import { describe, expect, it } from 'vitest'
import { hashText, normalizeScope } from './hashText'

describe('normalizeScope', () => {
  it('collapses internal whitespace and trims', () => {
    expect(normalizeScope('  a   b\tc\n d ')).toBe('a b c d')
  })
  it('treats nullish as empty', () => {
    expect(normalizeScope(null)).toBe('')
    expect(normalizeScope(undefined)).toBe('')
    expect(normalizeScope('')).toBe('')
  })
})

describe('hashText', () => {
  it('is deterministic — same input → same hash', () => {
    expect(hashText('Complete mechanical scope per contract documents.')).toBe(
      hashText('Complete mechanical scope per contract documents.'),
    )
  })

  it('is whitespace-insensitive (hashes the normalized text)', () => {
    expect(hashText('a b c')).toBe(hashText('  a   b\n\tc  '))
    // Leading/trailing/interior collapse all fold to the same normalized string.
    expect(hashText('GENERAL REQUIREMENTS\n\n1. Use of premises')).toBe(
      hashText('  GENERAL REQUIREMENTS 1. Use of premises  '),
    )
  })

  it('differs when the meaningful text differs', () => {
    expect(hashText('inclusions A')).not.toBe(hashText('inclusions B'))
    // A single character change (not just whitespace) changes the hash.
    expect(hashText('1. Domestic water')).not.toBe(hashText('2. Domestic water'))
  })

  it('nullish and empty share the empty-string hash', () => {
    const empty = hashText('')
    expect(hashText(null)).toBe(empty)
    expect(hashText(undefined)).toBe(empty)
    expect(hashText('   ')).toBe(empty)
  })

  it('always returns an 8-char lowercase hex string', () => {
    for (const s of ['', 'x', 'a longer piece of scope text with punctuation; and numbers 12.3']) {
      expect(hashText(s)).toMatch(/^[0-9a-f]{8}$/)
    }
  })
})
