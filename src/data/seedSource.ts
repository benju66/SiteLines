// Seed DataSource: wraps the in-file seed objects behind the async seam so the
// live (Supabase) source drops in without UI changes. `delayMs`/`fail` exist to
// exercise the loading/error states in dev (?slow / ?fail query params).

import type { DataSource, Snapshot } from '@/lib/dataSource'
import type { CommitmentDetail, DrawingRevision, Item, ItemDetail, ItemPhoto, ItemResponse } from '@/types'
import { ACTIVITY } from './activity'
import { BUDGET_LINES } from './budgetLines'
import { BUDGET_PENDING } from './budgetPending'
import { CHANGE_EVENTS } from './changeEvents'
import { CHANGE_EVENT_LINE_ITEMS } from './changeEventLineItems'
import { COMMITMENTS } from './commitments'
import { COMMITMENT_LINE_ITEMS } from './commitmentLineItems'
import { DAILY_LOGS } from './dailyLogs'
import { DIRECTORY } from './directory'
import { DRAWINGS } from './drawings'
import { FINANCIALS } from './financials'
import { INVOICES } from './invoices'
import { INVOICE_LINE_ITEMS } from './invoiceLineItems'
import { PHOTOS } from './photos'
import { PUNCH } from './punch'
import { SPECS } from './specs'
import { DATA } from './records'

/** A self-contained SVG-tile placeholder photo (data URI) so the punch drawer's Photos
 *  section renders offline. Live photos come from Procore via the punch-detail edge fn. */
function seedPhoto(label: string, hue: number): ItemPhoto {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='90'><rect width='120' height='90' fill='hsl(${hue},42%,86%)'/><text x='60' y='50' font-size='12' text-anchor='middle' font-family='sans-serif' fill='hsl(${hue},34%,38%)'>${label}</text></svg>`
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`
  return { thumbnailUrl: uri, url: uri, name: `${label}.jpg` }
}

export function createSeedSource(opts: { delayMs?: number; fail?: boolean } = {}): DataSource {
  const { delayMs = 0, fail = false } = opts
  return {
    name: 'seed',
    async fetch(): Promise<Snapshot> {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
      if (fail) throw new Error('Simulated sync failure (seed source, ?fail)')
      return {
        data: { itemsByTool: DATA, contacts: DIRECTORY, activity: ACTIVITY, financials: FINANCIALS, photos: PHOTOS, dailyLogs: DAILY_LOGS, drawings: DRAWINGS, specs: SPECS, punch: PUNCH, budgetLines: BUDGET_LINES, budgetPending: BUDGET_PENDING, commitments: COMMITMENTS, commitmentLineItems: COMMITMENT_LINE_ITEMS, changeEvents: CHANGE_EVENTS, changeEventLineItems: CHANGE_EVENT_LINE_ITEMS, invoices: INVOICES, invoiceLineItems: INVOICE_LINE_ITEMS },
        syncedAt: new Date(),
      }
    },
    async getDetail(item: Item): Promise<ItemDetail | null> {
      // Punch: an assignment-style thread + placeholder photos so seed exercises the
      // Responses + Photos sections (live comes from the punch-detail edge fn).
      if (item.tool === 'punch') {
        const p = PUNCH.find((x) => x.id === item.id)
        const closed = item.status?.label === 'Closed'
        const responses: ItemResponse[] =
          item.who && item.who !== '—'
            ? [{ author: item.who, date: item.date?.replace(/^due /, '') ?? null, text: closed ? 'Completed and verified.' : 'On it — will mark ready for review.', official: closed, status: closed ? 'Closed' : 'Work Required' }]
            : []
        return {
          request: '',
          responses,
          attachments: [],
          photos: p && !p.hasPhotos ? [] : [seedPhoto('Before', 12), seedPhoto('After', 145)],
          closedDate: closed ? 'Apr 15, 2026' : null,
        }
      }
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
    async getSpecFile(): Promise<Blob | null> {
      // Seed has no backend to stream Procore bytes; return null so the spec viewer
      // shows its Open-in-Procore fallback (parity stub, like getFinalSubmittalFile).
      return null
    },
    async getFinalSubmittalFile(): Promise<Blob | null> {
      // Seed has no backend to stream Procore bytes; return null so the viewer
      // shows its Open-in-Procore fallback (parity stub, like getSheetUrls).
      return null
    },
  }
}
