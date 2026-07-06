// The data seam (Procore-Data-Seam-Plan, Phase 1). A DataSource produces the
// full DATA_CONTRACT-shaped bundle the app renders from. Today the only
// implementation wraps the in-file seed (src/data/seedSource.ts); Phase 3 adds
// a supabaseDataSource reading the normalization views — the UI never knows
// the difference.

import type { ActivityEvent, Contact, DailyLogEntry, Drawing, DrawingRevision, FinancialSource, Item, ItemDetail, Photo, ToolKey } from '@/types'

export type ItemsByTool = Record<ToolKey, Item[]>

/** Everything the app renders from, in contract shape. */
export interface SiteData {
  itemsByTool: ItemsByTool
  contacts: Contact[]
  activity: ActivityEvent[]
  financials: FinancialSource
  photos: Photo[]
  dailyLogs: DailyLogEntry[]
  drawings: Drawing[] // current drawing sheets (reference; grouped by discipline in the log)
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
  /**
   * Lazily fetch the detail thread for one record (the drawer calls this on open).
   * Returns `null` when the source has no enriched detail for the item (e.g. a
   * tool not yet enriched, or an RFI with no thread) — the drawer falls back to a
   * generated summary. Rejects only on an actual read error.
   */
  getDetail(item: Item): Promise<ItemDetail | null>
  /**
   * Lazily fetch every revision of a drawing (the viewer's revision picker calls
   * this on open, keyed by `Drawing.drawingId`). Returned newest-first is not
   * required — the caller orders them. Empty array when the drawing has none.
   */
  getDrawingRevisions(drawingId: string): Promise<DrawingRevision[]>
}
