// Seed fixture: the Commitments register (Commitments, Phase 1 + Phase 4). A
// small, deterministic slice shaped like the live sitelines_commitments view
// after mapCommitment — a few subcontracts and a PO in various states, including
// one with no requisition yet (hasRequisition false → the register shows "—")
// and one still in Draft. Raw dollars; internally consistent (revised = original
// + coTotal, retainage = 5% of billed) so the rollup reads sensibly offline.
//
// Phase 4 adds `inclusions` / `exclusions` (HTML-stripped flat scope text, ''
// when none) and `grandTotal` (the SOV total = Σ this commitment's seed line
// items in COMMITMENT_LINE_ITEMS, 0 when it has none entered). Drywall & Paint
// (9002) carries a full SOV; Final Cleaning (9005) shows a just-issued
// commitment whose SOV is entered but has no requisition yet (grandTotal > 0,
// financials still "—").

import type { Commitment } from '@/types'

const RAW: Omit<Commitment, 'procoreUrl'>[] = [
  {
    project: 'opiii',
    id: 'commitments:9001',
    number: 'SC-25-117-220',
    title: 'Mechanical & Plumbing',
    vendor: 'Northline Mechanical',
    type: 'SC',
    status: 'Approved',
    executed: true,
    hasRequisition: true,
    original: 1_820_000,
    revised: 1_988_469,
    billed: 1_974_850,
    retainage: 98_742.5,
    pctComplete: 0.9932,
    coCount: 5,
    coTotal: 168_469,
    description: 'Complete mechanical and plumbing scope per contract documents.',
    deliveryDate: null,
    private: true,
    inclusions:
      'MECHANICAL AND PLUMBING SCOPE OF WORK Furnish all labor, material, and equipment for the following. 1. Complete HVAC systems including rooftop units, ductwork, and controls. 2. Domestic water, sanitary, and storm piping. 3. Mechanical insulation of ducts and piping.',
    exclusions: 'Temporary heat. Fire protection / sprinkler. Cutting and patching. Painting of exposed piping.',
    grandTotal: 0, // no SOV line items in the seed slice for this one
  },
  {
    project: 'opiii',
    id: 'commitments:9002',
    number: 'SC-25-117-092',
    title: 'Drywall & Paint',
    vendor: 'Summit Interiors',
    type: 'SC',
    status: 'Approved',
    executed: true,
    hasRequisition: true,
    original: 1_190_000,
    revised: 1_248_111,
    billed: 1_197_286,
    retainage: 59_864.3,
    pctComplete: 0.9593,
    coCount: 5,
    coTotal: 58_111,
    description: 'Gypsum board assemblies, taping, and field painting.',
    deliveryDate: null,
    private: true,
    inclusions:
      'DRYWALL AND PAINT SCOPE OF WORK Furnish all labor, material, and equipment for the following. 1. Gypsum board assemblies at all units and common areas. 2. Level 4 finish at exposed walls and ceilings. 3. Field painting of all gypsum surfaces, two coats.',
    exclusions: 'Acoustical ceilings. Fireproofing. Wallcovering. Exterior painting.',
    grandTotal: 1_190_000, // = Σ its seed SOV line items (gypsum + painting)
  },
  {
    project: 'opiii',
    id: 'commitments:9003',
    number: 'SC-25-117-260',
    title: 'Electrical',
    vendor: 'Granite State Electric',
    type: 'SC',
    status: 'Approved',
    executed: true,
    hasRequisition: true,
    original: 1_090_000,
    revised: 1_165_775,
    billed: 1_150_900,
    retainage: 57_545,
    pctComplete: 0.9872,
    coCount: 10,
    coTotal: 75_775,
    description: 'Power, lighting, and low-voltage rough-in and trim.',
    deliveryDate: null,
    private: true,
    inclusions:
      'ELECTRICAL SCOPE OF WORK Furnish all labor, material, and equipment for the following. 1. Power distribution, panels, and feeders. 2. Lighting and lighting controls. 3. Low-voltage rough-in for data and fire alarm.',
    exclusions: 'Fire alarm devices and programming. Owner AV systems. Site lighting.',
    grandTotal: 0,
  },
  {
    project: 'opiii',
    id: 'commitments:9004',
    number: 'PO-25-117-061',
    title: 'Appliance Package',
    vendor: 'Lakeside Supply Co.',
    type: 'PO',
    status: 'Approved',
    executed: true,
    hasRequisition: true,
    original: 412_500,
    revised: 412_500,
    billed: 268_125,
    retainage: 13_406.25,
    pctComplete: 0.65,
    coCount: 0,
    coTotal: 0,
    description: 'Unit appliance package, delivered per phasing schedule.',
    deliveryDate: '2026-08-14',
    private: false,
    inclusions: '',
    exclusions: '',
    grandTotal: 0,
  },
  {
    project: 'opiii',
    id: 'commitments:9005',
    number: 'SC-25-117-101',
    title: 'Final Cleaning',
    vendor: 'BrightWorks Services',
    type: 'SC',
    status: 'Approved',
    executed: false,
    hasRequisition: false, // just issued — no pay app yet; the register shows "—"
    original: 0,
    revised: 0,
    billed: 0,
    retainage: 0,
    pctComplete: 0,
    coCount: 0,
    coTotal: 0,
    description: 'Rough and final cleaning of all units and common areas.',
    deliveryDate: null,
    private: true,
    inclusions: 'FINAL CLEANING SCOPE OF WORK Rough and final cleaning of all units and common areas, plus final touch-up painting after cleaning.',
    exclusions: 'Post-occupancy cleaning. Window washing above second floor.',
    grandTotal: 8_000, // SOV entered (touch-up painting) but no requisition yet → financials still "—"
  },
  {
    project: 'opiii',
    id: 'commitments:9006',
    number: 'SC-25-117-310',
    title: 'Landscaping & Irrigation',
    vendor: 'Terraform Grounds',
    type: 'SC',
    status: 'Draft',
    executed: false,
    hasRequisition: false,
    original: 0,
    revised: 0,
    billed: 0,
    retainage: 0,
    pctComplete: 0,
    coCount: 0,
    coTotal: 0,
    description: 'Site landscaping, irrigation, and seasonal plantings.',
    deliveryDate: null,
    private: true,
    inclusions: '',
    exclusions: '',
    grandTotal: 0,
  },
]

// Build the same Procore commitment deep link the `sitelines_commitments` view
// constructs (company 8906 · project 3051002 · type path · procore id), so seed mode
// exercises the "Open in Procore" link with a format-identical URL. SC → work order
// contract, PO → purchase order contract.
const procoreCommitmentUrl = (c: Pick<Commitment, 'id' | 'type'>): string =>
  `https://app.procore.com/webclients/host/companies/8906/projects/3051002/tools/contracts/commitments/${c.type === 'PO' ? 'purchase_order_contracts' : 'work_order_contracts'}/${c.id.replace('commitments:', '')}`

export const COMMITMENTS: Commitment[] = RAW.map((c) => ({ ...c, procoreUrl: procoreCommitmentUrl(c) }))
