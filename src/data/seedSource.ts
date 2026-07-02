// Seed DataSource: wraps the in-file seed objects behind the async seam so the
// live (Supabase) source drops in without UI changes. `delayMs`/`fail` exist to
// exercise the loading/error states in dev (?slow / ?fail query params).

import type { DataSource, Snapshot } from '@/lib/dataSource'
import { ACTIVITY } from './activity'
import { DIRECTORY } from './directory'
import { FINANCIALS } from './financials'
import { DATA } from './records'

export function createSeedSource(opts: { delayMs?: number; fail?: boolean } = {}): DataSource {
  const { delayMs = 0, fail = false } = opts
  return {
    name: 'seed',
    async fetch(): Promise<Snapshot> {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
      if (fail) throw new Error('Simulated sync failure (seed source, ?fail)')
      return {
        data: { itemsByTool: DATA, contacts: DIRECTORY, activity: ACTIVITY, financials: FINANCIALS },
        syncedAt: new Date(),
      }
    },
  }
}
