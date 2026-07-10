import { describe, expect, it } from 'vitest'
import { proseEmphasis } from './proseEmphasis'

const concat = (text: string, bold?: number[]) =>
  proseEmphasis(text, bold)
    .map((s) => s.text)
    .join('')
const strongText = (text: string, bold?: number[]) =>
  proseEmphasis(text, bold)
    .filter((s) => s.strong)
    .map((s) => s.text)

// "Kitchen Cabinets:" is a Title-case sub-label the auto-bolder catches; the leading
// "Furnish the following." is lowercase-tailed so it never becomes the label itself.
// Word indices: Furnish0 the1 following.2 Kitchen3 Cabinets:4 base5 and6 wall7 units.8
const LABELED = 'Furnish the following. Kitchen Cabinets: base and wall units.'

describe('proseEmphasis — manual bold (Phase 6c)', () => {
  it('renders exactly the bold-index words strong, reconstructing the text', () => {
    const text = 'Furnish all labor and material.'
    expect(strongText(text, [0, 2])).toEqual(['Furnish', 'labor'])
    expect(concat(text, [0, 2])).toBe(text) // decoration only — never a text change
  })

  it('SUPPRESSES auto sub-label bolding on a manually-bolded block (your bold wins)', () => {
    // A manual bold is present, so ONLY that word renders strong — the "Kitchen
    // Cabinets:" sub-label that auto-bold would catch is left alone.
    expect(strongText(LABELED, [5])).toEqual(['base'])
    expect(concat(LABELED, [5])).toBe(LABELED)
  })

  it('treats absent / empty bold as no manual bold (falls through to auto-bold)', () => {
    expect(strongText(LABELED, [])).toEqual(['Kitchen Cabinets:'])
    expect(strongText(LABELED, undefined)).toEqual(['Kitchen Cabinets:'])
  })
})

describe('proseEmphasis — auto-bold (unchanged Phase 2 behavior)', () => {
  it('bolds inline Title-case sub-labels and reconstructs the text', () => {
    expect(strongText(LABELED)).toEqual(['Kitchen Cabinets:'])
    expect(concat(LABELED)).toBe(LABELED)
  })

  it('leaves plain prose (no sub-label) entirely unbolded', () => {
    const text = 'Furnish all labor and material.'
    expect(strongText(text)).toEqual([])
    expect(concat(text)).toBe(text)
  })
})
