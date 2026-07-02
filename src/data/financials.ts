// Financial seed (DATA_CONTRACT §6). Division rows are
// [name, budget, committed, invoiced] in $millions. In production this comes
// from Procore Budget + Prime Contract + Commitments/Direct-Costs endpoints.

import type { FinancialSource } from '@/types'

export const FINANCIALS: FinancialSource = {
  divisions: {
    mckenna: [
      ['Concrete', 3.1, 2.9, 2.1],
      ['Structural Steel', 4.6, 4.4, 1.8],
      ['Curtain Wall', 2.2, 2.0, 0.4],
      ['MEP', 6.8, 6.1, 2.6],
      ['Finishes', 5.4, 4.2, 1.9],
      ['General Conditions', 3.34, 1.6, 1.0],
    ],
    opiii: [
      ['Concrete', 2.3, 2.1, 1.4],
      ['Structural Steel', 3.4, 3.1, 0.9],
      ['Curtain Wall', 3.1, 2.8, 0.5],
      ['MEP', 4.6, 3.0, 0.8],
      ['Finishes', 3.3, 0.9, 0.3],
      ['General Conditions', 1.81, 0.7, 0.2],
    ],
  },
  approvedChanges: { mckenna: 0.84, opiii: 0.31 },
  projectedOverUnder: { mckenna: 0.12, opiii: -0.08 },
}
