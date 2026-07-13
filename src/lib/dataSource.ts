// The data seam (Procore-Data-Seam-Plan, Phase 1). A DataSource produces the
// full DATA_CONTRACT-shaped bundle the app renders from. Today the only
// implementation wraps the in-file seed (src/data/seedSource.ts); Phase 3 adds
// a supabaseDataSource reading the normalization views — the UI never knows
// the difference.

import type { ActivityEvent, BudgetLine, BudgetPending, ChangeEvent, ChangeEventLineItem, Commitment, CommitmentDetail, CommitmentLineItem, Contact, DailyLogEntry, Drawing, DrawingRevision, FinancialSource, Invoice, InvoiceLineItem, Item, ItemDetail, Photo, ToolKey } from '@/types'

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
  budgetLines: BudgetLine[] // primary-cost-budget lines (reference; the Budget cost-control drill-down)
  budgetPending: BudgetPending[] // pending-change exposure per cost code (reference; the Budget forecast section)
  commitments: Commitment[] // subcontracts / POs with financials (reference; the Commitments register)
  commitmentLineItems: CommitmentLineItem[] // commitment SOV line items (reference; the Budget↔Commitment cross-link + drawer SOV)
  changeEvents: ChangeEvent[] // potential changes, priced (reference; the Change Events cost-exposure ledger)
  changeEventLineItems: ChangeEventLineItem[] // priced change-event lines (reference; the drawer + Change-Event↔Commitment cross-link)
  invoices: Invoice[] // subcontractor pay applications (reference; the Invoicing register + G702 drawer)
  invoiceLineItems: InvoiceLineItem[] // pay-app G703 SOV lines (reference; the drawer's schedule of values)
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
   * Lazily fetch a commitment's detail (the drawer calls this on open, keyed by
   * `Commitment.id`): its change-order log + billing history. The descriptive
   * fields ride on the `Commitment` itself, so this only carries the two lists.
   * Both arrays empty when the commitment has none; the caller orders them.
   * Rejects only on an actual read error.
   */
  getCommitmentDetail(id: string): Promise<CommitmentDetail>
  /**
   * Lazily fetch every revision of a drawing (the viewer's revision picker calls
   * this on open, keyed by `Drawing.drawingId`). Returned newest-first is not
   * required — the caller orders them. Empty array when the drawing has none.
   */
  getDrawingRevisions(drawingId: string): Promise<DrawingRevision[]>
  /**
   * Re-mint a fresh, non-expired sheet URL for one drawing revision (Drawings
   * Phase 3). The synced `png_url`/`pdf_url` carry a `sig=` token that eventually
   * expires; the viewer calls this from its image `onError` to recover. `id` is
   * the revision's seam id (`Drawing`/`DrawingRevision.id`, "drawings:<revId>").
   * The live source proxies to a Supabase Edge Function that mints the URL
   * server-side (the Procore secret never reaches the browser); seed returns the
   * fixture URL. Either field is null when unavailable. Rejects on read error.
   */
  getSheetUrls(id: string): Promise<{ pngUrl: string | null; pdfUrl: string | null }>
  /**
   * Fetch the FINAL reviewed submittal PDF bytes for a submittal (the in-app
   * viewer calls this on open, keyed by the submittal's seam id "submittals:<id>").
   * The live source invokes the `submittal-file` edge function, which mints a fresh
   * Procore URL server-side and streams the stamped PDF back inline (the Procore
   * secret never reaches the browser); the caller wraps the Blob in an object URL
   * for an <iframe>. Returns null on ANY failure — no backend offline (seed), the
   * submittal has no final doc (404), or a read error — so the viewer always
   * degrades to its Open-in-Procore fallback rather than throwing.
   */
  getFinalSubmittalFile(id: string): Promise<Blob | null>
}
