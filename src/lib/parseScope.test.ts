import { describe, expect, it } from 'vitest'
import { parseScope, SUBHEADER_LABEL } from './parseScope'

// A realistic slice of a synced commitment description (flat — no newlines), built
// from the actual OP III contract text: an intro paragraph, an ALL-CAPS heading,
// integer sections with decimal clauses, a "Label: a; b" sub-list, a numbering
// restart under a second heading, and the money/time/acronym false positives.
const REAL = [
  'No work shall commence and no costs shall be incurred by the Vendor until the Owner has closed on their construction loan.',
  'GENERAL REQUIREMENTS',
  '1. Use of Project Premises',
  '1.1. All deliveries must be scheduled between 8:00 A.M. and 2:00 P.M. Deliveries outside this window require prior approval from the Project Superintendent.',
  '1.2. Delivery of materials must occur on an as-needed basis due to limited site storage.',
  '2. Project Schedule and Submittals',
  '2.1. All submittals must be uploaded via Procore.',
  '2.6. As-Built Drawings: Must be updated weekly in coordination with the Superintendent; Professionally completed as-builts shall be submitted at project closeout.',
  '3. Vendor Responsibilities',
  '3.3. Sales tax at 8.125% shall be included in all pricing.',
  'SCOPE OF WORK',
  '1. Temporary power and OSHA-level general lighting will be provided by others.',
].join(' ')

describe('parseScope', () => {
  const blocks = parseScope(REAL)

  it('leads with the intro prose as a paragraph', () => {
    expect(blocks[0].kind).toBe('para')
    expect(blocks[0].text).toMatch(/^No work shall commence/)
  })

  it('detects multi-word ALL-CAPS headings (and restarts under the second one)', () => {
    const headings = blocks.filter((b) => b.kind === 'heading').map((b) => b.text)
    expect(headings).toEqual(['GENERAL REQUIREMENTS', 'SCOPE OF WORK'])
  })

  it('captures integer sections with their titles', () => {
    const sections = blocks.filter((b) => b.kind === 'section')
    expect(sections).toContainEqual(expect.objectContaining({ marker: '1', text: 'Use of Project Premises' }))
    expect(sections).toContainEqual(expect.objectContaining({ marker: '2', text: 'Project Schedule and Submittals' }))
    // numbering restarts to "1" under the second heading — nested by shape, not a counter
    expect(sections.filter((s) => s.marker === '1')).toHaveLength(2)
  })

  it('captures decimal clauses with the marker stripped of its trailing dot', () => {
    const clause = blocks.find((b) => b.kind === 'clause' && b.marker === '1.1')
    expect(clause?.text).toMatch(/^All deliveries must be scheduled/)
  })

  it('does NOT split a time colon (8:00 A.M.) or treat A.M./P.M. as a heading', () => {
    const clause = blocks.find((b) => b.marker === '1.1')
    expect(clause?.bullets).toEqual([])
    expect(blocks.filter((b) => b.kind === 'heading').map((b) => b.text)).not.toContain('A.M.')
  })

  it('splits a "Label: a; b" clause into a lead + bullets (best-effort)', () => {
    const co = blocks.find((b) => b.marker === '2.6')
    expect(co?.text).toBe('As-Built Drawings:')
    expect(co?.bullets).toEqual([
      'Must be updated weekly in coordination with the Superintendent',
      'Professionally completed as-builts shall be submitted at project closeout.',
    ])
  })

  it('does not treat 8.125% as a marker (money/measurements are safe)', () => {
    const taxClause = blocks.find((b) => b.marker === '3.3')
    expect(taxClause?.text).toBe('Sales tax at 8.125% shall be included in all pricing.')
  })

  it('does not treat lone acronyms (OSHA) as a heading', () => {
    const headings = blocks.filter((b) => b.kind === 'heading').map((b) => b.text)
    expect(headings).not.toContain('OSHA')
  })

  it('falls back to a single paragraph when there is no structure', () => {
    const out = parseScope('Furnish and install all casework per plans and specifications.')
    expect(out).toEqual([{ kind: 'para', marker: null, text: 'Furnish and install all casework per plans and specifications.', bullets: [] }])
  })

  it('empty / null / whitespace → no blocks', () => {
    expect(parseScope('')).toEqual([])
    expect(parseScope(null)).toEqual([])
    expect(parseScope('   ')).toEqual([])
  })
})

describe('parseScope — SOV cost-code line items', () => {
  // Real synced form: line-item cost codes with titles, in both "12-3530 Title"
  // and "06 4023 - Title" styles, plus a spec-section reference run.
  const blocks = parseScope(
    'a. NA 12-3530 Residential Casework (Materials) SCOPE OF WORK Furnish per plans. 06 4023 - Interior Architectural Woodwork 08 1416 - Flush Wood Doors',
  )

  it('detects a "12-3530 Title" line-item header', () => {
    expect(blocks).toContainEqual(expect.objectContaining({ kind: 'lineitem', marker: '12-3530', text: 'Residential Casework (Materials)' }))
  })

  it('detects a "06 4023 - Title" line-item header', () => {
    expect(blocks).toContainEqual(expect.objectContaining({ kind: 'lineitem', marker: '06 4023', text: 'Interior Architectural Woodwork' }))
  })

  it('handles a run of spec-section codes (each becomes a line item)', () => {
    const codes = blocks.filter((b) => b.kind === 'lineitem').map((b) => b.marker)
    expect(codes).toEqual(['12-3530', '06 4023', '08 1416'])
  })

  it('does NOT treat measurements or dates as line-item codes', () => {
    const out = parseScope('Wall Cabinets: Nominal 12" deep, 24" high. Delivery 09/01/2025 through 2/13/2026.')
    expect(out.filter((b) => b.kind === 'lineitem')).toEqual([])
  })
})

describe('SUBHEADER_LABEL (inline sub-header bolding for prose blocks)', () => {
  const grab = (s: string) => Array.from(s.matchAll(SUBHEADER_LABEL), (m) => m[1])

  it('matches Title-case labels that end in a colon', () => {
    expect(grab('cabinets Kitchen Cabinets: Uppers may alternate')).toContain('Kitchen Cabinets:')
    expect(grab('sides Hardware: Cabinets to be predrilled')).toContain('Hardware:')
    expect(grab('above General Scope: All plastic-laminate')).toContain('General Scope:')
  })

  it('does NOT match labels with lowercase connector words', () => {
    expect(grab('unit Basis of Design: Rev-A-Shelf')).not.toContain('Basis of Design:')
    expect(grab('sides Corner base cabinets: Chamfered')).toHaveLength(0)
  })
})
