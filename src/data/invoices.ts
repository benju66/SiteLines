// Seed fixture: the Invoicing register (Invoicing, Phase 1). A deterministic slice
// shaped like the live sitelines_invoices view after mapInvoice — subcontractor pay
// applications (requisitions) across a few seed commitments, with billing history
// (multiple pay apps per sub, cumulative), one Under Review (needs action), and one
// final. `isLatest` marks the most recent pay app per commitment; those rows'
// cumulative billed/retainage match the seed commitments (COMMITMENTS) so the
// isLatest-gated rollup reconciles offline. Raw dollars. `commitmentId` points at
// the seed commitments so the Phase-2 Invoice → Commitment cross-link resolves.

import type { Invoice } from '@/types'

export const INVOICES: Invoice[] = [
  // SC-25-117-220 Mechanical & Plumbing (Northline) — 2 pay apps; latest Under Review.
  {
    project: 'opiii', id: 'invoicing:7001', number: 'R-220-001', vendor: 'Northline Mechanical', contract: 'Mechanical & Plumbing',
    commitmentId: 'commitments:9001', period: 'Apr 1 – Apr 30, 2026', billingDate: '2026-05-05', status: 'Approved', final: false, isLatest: false,
    thisPeriod: 1_140_000, billedToDate: 1_200_000, retainage: 60_000, pctComplete: 0.6035,
    original: 1_820_000, revised: 1_988_469, netChangeByCOs: 168_469, earnedLessRetainage: 1_140_000, balanceToFinish: 848_469,
  },
  {
    project: 'opiii', id: 'invoicing:7002', number: 'R-220-002', vendor: 'Northline Mechanical', contract: 'Mechanical & Plumbing',
    commitmentId: 'commitments:9001', period: 'May 1 – May 31, 2026', billingDate: '2026-06-05', status: 'Under Review', final: false, isLatest: true,
    thisPeriod: 736_107.5, billedToDate: 1_974_850, retainage: 98_742.5, pctComplete: 0.9932,
    original: 1_820_000, revised: 1_988_469, netChangeByCOs: 168_469, earnedLessRetainage: 1_876_107.5, balanceToFinish: 112_361.5,
  },
  // SC-25-117-092 Drywall & Paint (Summit) — 2 pay apps; latest Approved.
  {
    project: 'opiii', id: 'invoicing:7003', number: 'R-092-001', vendor: 'Summit Interiors', contract: 'Drywall & Paint',
    commitmentId: 'commitments:9002', period: 'Apr 1 – Apr 30, 2026', billingDate: '2026-05-05', status: 'Approved', final: false, isLatest: false,
    thisPeriod: 665_000, billedToDate: 700_000, retainage: 35_000, pctComplete: 0.5609,
    original: 1_190_000, revised: 1_248_111, netChangeByCOs: 58_111, earnedLessRetainage: 665_000, balanceToFinish: 548_111,
  },
  {
    project: 'opiii', id: 'invoicing:7004', number: 'R-092-002', vendor: 'Summit Interiors', contract: 'Drywall & Paint',
    commitmentId: 'commitments:9002', period: 'May 1 – May 31, 2026', billingDate: '2026-06-05', status: 'Approved', final: false, isLatest: true,
    thisPeriod: 472_421.7, billedToDate: 1_197_286, retainage: 59_864.3, pctComplete: 0.9593,
    original: 1_190_000, revised: 1_248_111, netChangeByCOs: 58_111, earnedLessRetainage: 1_137_421.7, balanceToFinish: 110_689.3,
  },
  // SC-25-117-260 Electrical (Granite State) — single pay app, latest Approved.
  {
    project: 'opiii', id: 'invoicing:7005', number: 'R-260-001', vendor: 'Granite State Electric', contract: 'Electrical',
    commitmentId: 'commitments:9003', period: 'May 1 – May 31, 2026', billingDate: '2026-06-05', status: 'Approved', final: false, isLatest: true,
    thisPeriod: 1_093_355, billedToDate: 1_150_900, retainage: 57_545, pctComplete: 0.9872,
    original: 1_090_000, revised: 1_165_775, netChangeByCOs: 75_775, earnedLessRetainage: 1_093_355, balanceToFinish: 72_420,
  },
  // PO-25-117-061 Appliance Package (Lakeside) — single pay app, final.
  {
    project: 'opiii', id: 'invoicing:7006', number: 'R-061-001', vendor: 'Lakeside Supply Co.', contract: 'Appliance Package',
    commitmentId: 'commitments:9004', period: 'May 1 – May 31, 2026', billingDate: '2026-06-05', status: 'Approved', final: true, isLatest: true,
    thisPeriod: 254_718.75, billedToDate: 268_125, retainage: 13_406.25, pctComplete: 0.65,
    original: 412_500, revised: 412_500, netChangeByCOs: 0, earnedLessRetainage: 254_718.75, balanceToFinish: 157_781.25,
  },
]
