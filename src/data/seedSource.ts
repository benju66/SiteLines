// Seed DataSource: wraps the in-file seed objects behind the async seam so the
// live (Supabase) source drops in without UI changes. `delayMs`/`fail` exist to
// exercise the loading/error states in dev (?slow / ?fail query params).

import type { DataSource, Snapshot } from '@/lib/dataSource'
import type { CommitmentDetail, DrawingRevision, Item, ItemDetail, ItemResponse } from '@/types'
import { ACTIVITY } from './activity'
import { BUDGET_LINES } from './budgetLines'
import { BUDGET_PENDING } from './budgetPending'
import { CHANGE_EVENTS } from './changeEvents'
import { COMMITMENTS } from './commitments'
import { COMMITMENT_LINE_ITEMS } from './commitmentLineItems'
import { DAILY_LOGS } from './dailyLogs'
import { DIRECTORY } from './directory'
import { DRAWINGS } from './drawings'
import { FINANCIALS } from './financials'
import { PHOTOS } from './photos'
import { DATA } from './records'

export function createSeedSource(opts: { delayMs?: number; fail?: boolean } = {}): DataSource {
  const { delayMs = 0, fail = false } = opts
  return {
    name: 'seed',
    async fetch(): Promise<Snapshot> {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
      if (fail) throw new Error('Simulated sync failure (seed source, ?fail)')
      return {
        data: { itemsByTool: DATA, contacts: DIRECTORY, activity: ACTIVITY, financials: FINANCIALS, photos: PHOTOS, dailyLogs: DAILY_LOGS, drawings: DRAWINGS, budgetLines: BUDGET_LINES, budgetPending: BUDGET_PENDING, commitments: COMMITMENTS, commitmentLineItems: COMMITMENT_LINE_ITEMS, changeEvents: CHANGE_EVENTS },
        syncedAt: new Date(),
      }
    },
    async getDetail(item: Item): Promise<ItemDetail | null> {
      // Seed has no real Procore threads; synthesize a small deterministic stub
      // (no clock) so seed mode still exercises the Request + Responses sections.
      const request = `${item.title}. Requesting confirmation to proceed on ${item.num}.`
      const responses: ItemResponse[] = item.mine
        ? []
        : [{ author: item.who, date: null, text: 'Reviewing — will respond shortly.', official: false }]
      return {
        request,
        responses,
        assignees: item.mine ? undefined : item.who,
        attachments: [], // no real files in seed mode
      }
    },
    async getCommitmentDetail(id: string): Promise<CommitmentDetail> {
      // Seed has no Procore detail; synthesize a deterministic CO log + billing
      // history off the fixture commitment (no clock, no random) so the drawer's
      // sections are exercised offline. Amounts stay internally consistent (COs
      // sum to coTotal; pay apps ramp cumulatively to billed).
      const c = COMMITMENTS.find((x) => x.id === id)
      if (!c) return { changeOrders: [], billings: [] }
      const round = (n: number) => Math.round(n * 100) / 100
      const each = c.coCount > 0 ? round(c.coTotal / c.coCount) : 0
      const changeOrders = Array.from({ length: c.coCount }, (_, i) => {
        const number = String(i + 1).padStart(3, '0')
        const amount = i === c.coCount - 1 ? round(c.coTotal - each * (c.coCount - 1)) : each
        return { id: `${c.id}:co:${number}`, number, title: `Change order ${i + 1}`, amount, status: 'Approved', executed: true, date: null }
      })
      const periods = ['Apr 30, 2026', 'May 31, 2026', 'Jun 30, 2026']
      const steps = c.hasRequisition ? 3 : 0
      const billings = Array.from({ length: steps }, (_, i) => {
        const k = i + 1
        const number = String(k)
        return {
          id: `${c.id}:req:${number}`,
          number,
          invoiceNumber: `${c.number}-${number}`,
          period: periods[i] ?? '',
          billingDate: periods[i] ?? null,
          status: 'Approved',
          pctComplete: round((c.pctComplete * k) / steps * 100) / 100,
          billedToDate: round((c.billed * k) / steps),
          thisPeriod: round(c.billed / steps),
        }
      })
      return { changeOrders, billings }
    },
    async getDrawingRevisions(drawingId: string): Promise<DrawingRevision[]> {
      // Seed has no Procore history; synthesize a short deterministic chain
      // (current + a couple prior issues) off the matching fixture sheet so the
      // picker is exercised offline. Same placeholder image for each.
      const d = DRAWINGS.find((x) => x.drawingId === drawingId)
      if (!d) return []
      const top = Number(d.revision) || 1
      const count = Math.min(top, 3)
      return Array.from({ length: count }, (_, i) => {
        const n = top - i
        return {
          id: i === 0 ? d.id : `${d.id}#r${n}`,
          revision: String(n),
          drawingDate: i === 0 ? d.drawingDate : null,
          current: i === 0,
          pngUrl: d.pngUrl,
          pdfUrl: d.pdfUrl,
          procoreUrl: null,
        }
      })
    },
    async getSheetUrls(id: string): Promise<{ pngUrl: string | null; pdfUrl: string | null }> {
      // Seed has no backend; return the fixture sheet's URLs so the seam matches
      // live shape. The seed SVG placeholders never error, so the viewer's
      // onError (the only caller) doesn't fire offline — this is here for parity.
      const base = id.split('#')[0] // drop any synthesized "#rN" revision suffix
      const d = DRAWINGS.find((x) => x.id === base)
      return { pngUrl: d?.pngUrl ?? null, pdfUrl: d?.pdfUrl ?? null }
    },
    async getFinalSubmittalFile(): Promise<Blob | null> {
      // Seed has no backend to stream Procore bytes; return null so the viewer
      // shows its Open-in-Procore fallback (parity stub, like getSheetUrls).
      return null
    },
  }
}
