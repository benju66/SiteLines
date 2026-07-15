// CSI MasterFormat division reference (Specifications, Phase 1). Pure, table-driven:
// a spec section number's first token IS its division code ("26 0519" → "26"), so the
// whole spec-book structure derives from the number with no re-sync. This maps a
// 2-digit code to its canonical MasterFormat division title. An empty/malformed code
// → "Uncategorized"; an unrecognized code → "Division <code>" (a stable, honest
// fallback). Used by the groupByDivision selector + the mapSpec mapper.

/** Canonical CSI MasterFormat division titles (active divisions; reserved ranges
 *  like 15–20 are intentionally absent and fall through to the "Division NN" guard). */
const CSI_DIVISIONS: Record<string, string> = {
  '00': 'Procurement & Contracting Requirements',
  '01': 'General Requirements',
  '02': 'Existing Conditions',
  '03': 'Concrete',
  '04': 'Masonry',
  '05': 'Metals',
  '06': 'Wood, Plastics & Composites',
  '07': 'Thermal & Moisture Protection',
  '08': 'Openings',
  '09': 'Finishes',
  '10': 'Specialties',
  '11': 'Equipment',
  '12': 'Furnishings',
  '13': 'Special Construction',
  '14': 'Conveying Equipment',
  '21': 'Fire Suppression',
  '22': 'Plumbing',
  '23': 'Heating, Ventilating & Air Conditioning (HVAC)',
  '25': 'Integrated Automation',
  '26': 'Electrical',
  '27': 'Communications',
  '28': 'Electronic Safety & Security',
  '31': 'Earthwork',
  '32': 'Exterior Improvements',
  '33': 'Utilities',
  '34': 'Transportation',
  '35': 'Waterway & Marine Construction',
  '40': 'Process Interconnections',
  '41': 'Material Processing & Handling Equipment',
  '42': 'Process Heating, Cooling & Drying Equipment',
  '43': 'Process Gas & Liquid Handling, Purification & Storage Equipment',
  '44': 'Pollution & Waste Control Equipment',
  '45': 'Industry-Specific Manufacturing Equipment',
  '46': 'Water & Wastewater Equipment',
  '48': 'Electrical Power Generation',
}

/** The division code — the first whitespace-delimited token of a section number
 *  ("26 0519" → "26"). Empty string when the number is blank/malformed. */
export function divisionCode(number: string): string {
  return (number ?? '').trim().split(/\s+/)[0] ?? ''
}

/** Canonical CSI division title for a code. Empty code → "Uncategorized";
 *  unrecognized code → "Division <code>". */
export function csiDivisionName(code: string): string {
  const c = (code ?? '').trim()
  if (!c) return 'Uncategorized'
  return CSI_DIVISIONS[c] ?? `Division ${c}`
}
