// Live DataSource (Data Seam Phase 3). Reads the four Supabase normalization
// views and maps them into the same SiteData shape the seed source produces, so
// the UI is unchanged. Raw view rows are "partial" Items (id/num/title/who/mine/
// raw_status_label/due_date/amount); this completes them into full Items using the
// pure client-side derivation (urgency/date/tone) against the client's `now`.

import type { SupabaseClient } from '@supabase/supabase-js'
import { TOOLS } from '@/data/tools'
import { TERMINAL } from '@/lib/ballInCourt'
import type { DataSource, ItemsByTool, SiteData, Snapshot } from '@/lib/dataSource'
import { deriveUrgency, formatDueDate, formatMoney, statusTone, timeAgo } from '@/lib/derive'
import { mapBudgetLine, type BudgetLineRow } from '@/lib/mapBudgetLine'
import { mapDrawing, mapDrawingRevision, type DrawingRow, type DrawingRevisionRow } from '@/lib/mapDrawing'
import { mapRfiDetail, type RfiDetailRow } from '@/lib/mapRfiDetail'
import { mapSubmittalDetail, type SubmittalDetailRow } from '@/lib/mapSubmittalDetail'
import type { ActivityEvent, DailyLogEntry, FinancialSource, Item, ItemDetail, Project, Status, ToolKey } from '@/types'

// Postgres `numeric` comes back over the wire as a string (to preserve precision).
const num = (v: number | string | null): number => (v == null ? 0 : Number(v))

interface ItemRow {
  id: string
  tool: ToolKey
  project: Project
  num: string
  title: string | null
  who: string | null
  mine: boolean
  raw_status_label: string | null
  due_date: string | null
  amount: number | string | null
  links: string[] | null
}

function toItem(r: ItemRow, today: Date): Item {
  const label = r.raw_status_label
  const isTerminal = label != null && TERMINAL.has(label)
  const urgency = deriveUrgency(r.due_date, today, isTerminal)
  const status: Status | null = label ? { label, tone: statusTone(label, urgency) } : null
  // Money-display tools carry `amount`; everything else shows a derived due date.
  const date = r.amount != null ? formatMoney(num(r.amount)) : formatDueDate(r.due_date, today)
  return {
    id: r.id,
    tool: r.tool,
    project: r.project,
    num: r.num,
    title: r.title ?? '',
    who: r.who ?? '—',
    mine: !!r.mine,
    date,
    urgency,
    status,
    links: r.links ?? undefined,
  }
}

function emptyItemsByTool(): ItemsByTool {
  const out = {} as ItemsByTool
  for (const k of Object.keys(TOOLS) as ToolKey[]) out[k] = []
  return out
}

interface ContactRow {
  id: string
  name: string
  company: string
  role: string
  trade: string
  email: string
  phone: string
  projects: Project[]
  match: string | null
}

interface FinRow {
  project: Project
  division: string
  budget: number | string
  committed: number | string
  invoiced: number | string
  approved_changes: number | string
  projected_over_under: number | string
}

const M = 1_000_000

function toFinancials(rows: FinRow[]): FinancialSource {
  // FinancialSource is keyed by every Project and holds $millions.
  const divisions: FinancialSource['divisions'] = { mckenna: [], opiii: [] }
  const approvedChanges: FinancialSource['approvedChanges'] = { mckenna: 0, opiii: 0 }
  const projectedOverUnder: FinancialSource['projectedOverUnder'] = { mckenna: 0, opiii: 0 }
  for (const r of rows) {
    if (!r.project) continue
    divisions[r.project].push([r.division, num(r.budget) / M, num(r.committed) / M, num(r.invoiced) / M])
    approvedChanges[r.project] += num(r.approved_changes) / M
    projectedOverUnder[r.project] += num(r.projected_over_under) / M
  }
  return { divisions, approvedChanges, projectedOverUnder }
}

interface ActivityRow {
  project: Project
  text: string
  sub: string | null
  raw_status_label: string | null
  updated_at: string
}

function toActivity(r: ActivityRow, now: Date): ActivityEvent {
  return {
    project: r.project,
    text: r.text,
    sub: r.sub ?? '',
    tone: r.raw_status_label ? statusTone(r.raw_status_label, 'track') : 'muted',
    when: timeAgo(new Date(r.updated_at), now),
  }
}

const PAGE = 1000

/** Read a whole view, paging past PostgREST's 1000-row response cap. */
async function fetchAll<T>(client: SupabaseClient, table: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select('*').range(from, from + PAGE - 1)
    if (error) throw new Error(`Supabase read failed (${table}): ${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

export function createSupabaseSource(client: SupabaseClient): DataSource {
  return {
    name: 'supabase',
    async fetch(): Promise<Snapshot> {
      const now = new Date()
      const [items, contacts, financials, activity, dailyLogs, drawings, budgetLines] = await Promise.all([
        fetchAll<ItemRow>(client, 'sitelines_items'),
        fetchAll<ContactRow>(client, 'sitelines_contacts'),
        fetchAll<FinRow>(client, 'sitelines_financials'),
        fetchAll<ActivityRow>(client, 'sitelines_activity'),
        fetchAll<DailyLogEntry>(client, 'sitelines_daily_logs'),
        fetchAll<DrawingRow>(client, 'sitelines_drawings'),
        fetchAll<BudgetLineRow>(client, 'sitelines_budget_lines'),
      ])

      const itemsByTool = emptyItemsByTool()
      for (const row of items) {
        const it = toItem(row, now)
        if (itemsByTool[it.tool]) itemsByTool[it.tool].push(it)
      }

      const data: SiteData = {
        itemsByTool,
        contacts: contacts.map((c) => ({ ...c, match: c.match ?? undefined })),
        financials: toFinancials(financials),
        activity: activity.map((a) => toActivity(a, now)),
        // Photos intentionally not synced (metadata for ~6k images is over-retrieval for a
        // captions-only view, and grows fastest on active projects). Shows its empty state.
        photos: [],
        dailyLogs: dailyLogs.map((d) => ({ ...d, crew: Number(d.crew), mine: !!d.mine })),
        drawings: drawings.map(mapDrawing),
        budgetLines: budgetLines.map(mapBudgetLine),
      }
      // syncedAt = fetch time for now; a future sitelines_meta view can expose the
      // pipeline's true last-sync timestamp (max synced_at) once it's readable.
      return { data, syncedAt: now }
    },
    async getDetail(item: Item): Promise<ItemDetail | null> {
      // Enriched tools: RFIs (request + answers) and submittals (approver workflow).
      // Everything else has no detail view yet → null (drawer falls back gracefully).
      if (item.tool === 'rfis') {
        const { data, error } = await client
          .from('sitelines_rfi_detail')
          .select('*')
          .eq('id', item.id)
          .maybeSingle()
        if (error) throw new Error(`Supabase read failed (sitelines_rfi_detail): ${error.message}`)
        return data ? mapRfiDetail(data as RfiDetailRow) : null
      }
      if (item.tool === 'submittals') {
        const { data, error } = await client
          .from('sitelines_submittal_detail')
          .select('*')
          .eq('id', item.id)
          .maybeSingle()
        if (error) throw new Error(`Supabase read failed (sitelines_submittal_detail): ${error.message}`)
        return data ? mapSubmittalDetail(data as SubmittalDetailRow) : null
      }
      return null
    },
    async getDrawingRevisions(drawingId: string) {
      const { data, error } = await client
        .from('sitelines_drawing_revisions')
        .select('*')
        .eq('drawing_id', drawingId)
      if (error) throw new Error(`Supabase read failed (sitelines_drawing_revisions): ${error.message}`)
      return ((data ?? []) as DrawingRevisionRow[]).map(mapDrawingRevision)
    },
    async getSheetUrls(id: string) {
      // Invoke the `drawing-file` edge function (verify_jwt) with the caller's
      // session; supabase-js attaches the logged-in user's bearer token so the
      // gateway admits it. The function mints a fresh Procore URL server-side and
      // returns { pngUrl, pdfUrl } as JSON — no image bytes flow through it, and
      // the Procore secret stays server-side (never in this bundle).
      const { data, error } = await client.functions.invoke('drawing-file', { body: { id } })
      if (error) throw new Error(`Edge function drawing-file failed: ${error.message}`)
      const png = (data as { pngUrl?: unknown } | null)?.pngUrl
      const pdf = (data as { pdfUrl?: unknown } | null)?.pdfUrl
      return {
        pngUrl: typeof png === 'string' ? png : null,
        pdfUrl: typeof pdf === 'string' ? pdf : null,
      }
    },
  }
}
