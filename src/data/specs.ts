// Seed specifications (Specifications workstream, Phase 1). A small fixture so seed
// mode (VITE_DATA_SOURCE=seed) still renders the CSI-division-grouped spec log
// offline. In live mode these come from the `sitelines_specs` view via mapSpec().
//
// Numbers are deliberately out of order and exercise the natural sort ("09 9110"
// before "09 9123"; "26 0500" before "26 0519" — both wrong lexicographically here
// only if mis-sorted) across several CSI divisions, so the selector's book-order
// grouping + within-division sort are visible offline. issuedDate/pdfUrl are null
// (Phase 1 syncs only the thin section summary — Phase 2/3 add the date + PDF).

import { divisionCode } from '@/lib/csiDivisions'
import type { Spec } from '@/types'

export const SPECS: Spec[] = [
  s('specs:seed-000101', '00 0101', 'Project Title Page'),
  s('specs:seed-011100', '01 1100', 'Summary of Work'),
  s('specs:seed-012100', '01 2100', 'Allowances'),
  s('specs:seed-033000', '03 3000', 'Cast-in-Place Concrete'),
  s('specs:seed-054000', '05 4000', 'Cold-Formed Metal Framing'),
  s('specs:seed-092900', '09 2900', 'Gypsum Board'),
  s('specs:seed-099123', '09 9123', 'Interior Painting'), // out of order on purpose…
  s('specs:seed-099110', '09 9110', 'Exterior Painting'), // …selector sorts 9110 before 9123
  s('specs:seed-230000', '23 0000', 'Heating, Ventilating & Air Conditioning'),
  s('specs:seed-260519', '26 0519', 'Low-Voltage Electrical Power Conductors & Cables'),
  s('specs:seed-260500', '26 0500', 'Common Work Results for Electrical'), // sorts before 0519
  s('specs:seed-265100', '26 5100', 'Interior Lighting'),
]

/** Compact fixture builder — a spec section. Division is derived from the number
 *  exactly as mapSpec / the view do; issued date + pdf are Phase 2/3 (null here). */
function s(id: string, number: string, title: string): Spec {
  return { id, number, title, division: divisionCode(number), issuedDate: null, pdfUrl: null }
}
