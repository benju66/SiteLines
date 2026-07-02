// The data seam (Procore-Data-Seam-Plan, Phase 1). A DataSource produces the
// full DATA_CONTRACT-shaped bundle the app renders from. Today the only
// implementation wraps the in-file seed (src/data/seedSource.ts); Phase 3 adds
// a supabaseDataSource reading the normalization views — the UI never knows
// the difference.

import type { ActivityEvent, Contact, FinancialSource, Item, ToolKey } from '@/types'

export type ItemsByTool = Record<ToolKey, Item[]>

/** Everything the app renders from, in contract shape. */
export interface SiteData {
  itemsByTool: ItemsByTool
  contacts: Contact[]
  activity: ActivityEvent[]
  financials: FinancialSource
}

export interface Snapshot {
  data: SiteData
  syncedAt: Date // when this data was last synced from the source of truth
}

export interface DataSource {
  /** Short label for diagnostics, e.g. 'seed' | 'supabase'. */
  name: string
  /** Fetch a full snapshot. Rejects on failure; the provider surfaces the error state. */
  fetch(): Promise<Snapshot>
}
