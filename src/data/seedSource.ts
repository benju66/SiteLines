// Seed DataSource: wraps the in-file seed objects behind the async seam so the
// live (Supabase) source drops in without UI changes. `delayMs`/`fail` exist to
// exercise the loading/error states in dev (?slow / ?fail query params).

import type { DataSource, Snapshot } from '@/lib/dataSource'
import type { DrawingRevision, Item, ItemDetail, ItemResponse } from '@/types'
import { ACTIVITY } from './activity'
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
        data: { itemsByTool: DATA, contacts: DIRECTORY, activity: ACTIVITY, financials: FINANCIALS, photos: PHOTOS, dailyLogs: DAILY_LOGS, drawings: DRAWINGS },
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
  }
}
