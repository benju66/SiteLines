// The ball-in-court rule (DATA_CONTRACT §2). This is the SINGLE place that
// governs what feeds "My Court" — an item only appears while it has a live
// ball. Terminal/closed items and non-court tools never appear.
//
// ⚠️ Validate TERMINAL against real Procore status labels per tool during
// integration — spelling must match exactly or a closed item leaks in.

import type { Item, ToolKey } from '@/types'

export const TERMINAL = new Set([
  'Closed',
  'Approved',
  'Current',
  'Superseded',
  'Void',
  'Final',
  'Issued',
  'Executed',
  'Answered',
  'Scheduled',
])

export const COURT_TOOLS = new Set<ToolKey>([
  'rfis',
  'submittals',
  'changeEvents',
  'changeOrders',
  'punch',
  'commitments',
  'invoicing',
  'meetings',
  'drawings',
  'specs',
  'documents',
])

/** True while a record has a live ball-in-court. */
export function isBallInCourt(rec: Item): boolean {
  return COURT_TOOLS.has(rec.tool) && !(rec.status !== null && TERMINAL.has(rec.status.label))
}
