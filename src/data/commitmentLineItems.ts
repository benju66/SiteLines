// Seed commitment SOV line items (Commitments, Phase 4). A small OP III fixture
// so seed mode (VITE_DATA_SOURCE=seed) renders the Budget↔Commitment cross-link
// and the drawer's schedule-of-values section offline. In live mode these come
// from the `sitelines_commitment_line_items` view via mapCommitmentLineItem().
//
// The `costCode` values are the Procore full_code (e.g. "9-92116.000"), matching
// the PREFIX of the seed budget cost codes in budgetLines.ts ("9-92116.000 -
// Gypsum Board Assemblies") — that's the join the cross-link makes. Chosen to
// exercise the selector + UI:
//   · Drywall & Paint (9002) spans two cost codes (Gypsum + Painting), summing
//     to its grandTotal ($1,190,000).
//   · Painting and Coating (9-99000.000) has TWO commitments behind it — 9002
//     (field painting) and 9005 (final touch-up) — so the Budget row reveals a
//     multi-subcontract list. 9005 is a just-issued commitment (no requisition)
//     whose SOV is already entered, so it appears behind the code with financials
//     still "—".
// (Live data exercises the split-cost-type case — a code split into Material +
// Subcontract budget lines still shows the affordance once — which the seed
// budget's split code carries no commitment for; the selector's unit tests cover
// the aggregation math.)

import type { CommitmentLineItem } from '@/types'

export const COMMITMENT_LINE_ITEMS: CommitmentLineItem[] = [
  // Drywall & Paint (9002) — Gypsum Board Assemblies (9-92116.000)
  li('9002', 1, '9-92116.000', 'Gypsum Board Assemblies', 760_000, 'Unit gypsum board assemblies, taped and finished.'),
  li('9002', 2, '9-92116.000', 'Gypsum Board Assemblies', 248_000, 'Common area gypsum board assemblies, Level 4 finish.'),
  // Drywall & Paint (9002) — Painting and Coating (9-99000.000)
  li('9002', 3, '9-99000.000', 'Painting and Coating', 150_000, 'Field painting of units, two coats.'),
  li('9002', 4, '9-99000.000', 'Painting and Coating', 32_000, 'Field painting of common areas, two coats.'),
  // Final Cleaning (9005) — a second commitment behind Painting and Coating
  li('9005', 1, '9-99000.000', 'Painting and Coating', 8_000, 'Final touch-up painting after cleaning.'),
]

/** Compact fixture builder — id mirrors the live "commitments:<id>:li:<n>" key. */
function li(
  commitment: string,
  n: number,
  costCode: string,
  costCodeName: string,
  amount: number,
  description: string,
): CommitmentLineItem {
  return {
    project: 'opiii',
    id: `commitments:${commitment}:li:${n}`,
    commitmentId: `commitments:${commitment}`,
    costCode,
    costCodeName,
    amount,
    description,
  }
}
