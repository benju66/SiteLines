// Pure mapper: a `sitelines_specs` view row → the `Spec` shape the spec log renders.
// One row per current specification section. Deterministic — no clock; the CSI
// division is derived from the section number (its first token) and urls are guarded
// to http(s) only (safeUrl), reusing the shared detail-text helpers so specs clean
// display text identically to the record + drawing mappers.

import type { Spec } from '@/types'
import { divisionCode } from './csiDivisions'
import { formatResponseDate, htmlToText, safeUrl } from './detailText'

/** One row of the sitelines_specs view. In Phase 1 the view emits issued_date /
 *  pdf_url as NULL (the master carries only a thin section summary); the Phase 2
 *  detail re-sync + a widened view populate them. */
export interface SpecRow {
  id: string
  number: string | null
  title: string | null // description (section title)
  procore_url: string | null // constructed deep link to the current revision's PDF viewer
  issued_date: string | null // ISO date "YYYY-MM-DD" — NULL until Phase 2
  pdf_url: string | null // current revision attachment — NULL until Phase 2
}

/** Map a specs view row to the Spec contract shape. */
export function mapSpec(row: SpecRow): Spec {
  const number = (row.number ?? '').trim()
  return {
    id: row.id,
    number,
    title: htmlToText(row.title),
    division: divisionCode(number),
    procoreUrl: safeUrl(row.procore_url) ?? null,
    issuedDate: formatResponseDate(row.issued_date),
    pdfUrl: safeUrl(row.pdf_url) ?? null,
  }
}
