// Punch List closeout dashboard (Punch List workstream, Phase 1). Punch stops sharing
// the generic ToolRegisterView and gets its own closeout surface: rollup KPI cards
// (total · open · overdue · ready-for-review · closed · % complete) over a register
// GROUPED by lifecycle stage or by assignee (the two dimensions this project actually
// populates — location/trade/priority are empty), with per-row photo + open-response
// indicators. Reference-style: reads the `punch` slice, rolls up via punchRollup, groups
// via groupPunchBy, and formats here. Rows open the EXISTING RecordDetailDrawer (punch is
// a court Item) — the drawer's real thread + photos are Phase 2.

import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { statusTone } from '@/lib/derive'
import { openPatch } from '@/lib/drawerNav'
import { fuzzyMatchesAny } from '@/lib/fuzzy'
import { groupPunchBy, punchRollup, scoped } from '@/selectors'
import type { PunchGroupDim } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, tone as toneMap } from '@/theme/tokens'
import type { Item, PunchItem } from '@/types'
import { Highlight } from '@/components/ui/Highlight'
import { TableSearch } from '@/components/ui/TableSearch'

// # · Name · Assignee · Due · Status · Indicators.
const GRID = '68px minmax(190px,1.6fr) minmax(120px,1fr) 104px 92px 58px'
const HEADS = ['#', 'Item', 'Assignee', 'Due', 'Status', '']

// Status pill tone: Overdue reads danger, Open warn, Closed ok (done). Falls back to the
// shared statusTone vocabulary for anything unexpected.
function pillTone(status: string) {
  if (status === 'Overdue') return toneMap.danger
  if (status === 'Open') return toneMap.warn
  if (status === 'Closed') return toneMap.ok
  return toneMap[statusTone(status, 'track')]
}

function StatusPill({ status }: { status: string }) {
  if (!status) return <span style={{ color: 'var(--tx-faint)' }}>—</span>
  const t = pillTone(status)
  return (
    <span style={{ fontSize: 10, fontWeight: 650, letterSpacing: '.2px', padding: '2px 8px', borderRadius: 20, lineHeight: 1.4, color: t.c, background: t.bg, border: `1px solid ${t.bd}`, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

const kpiCard: CSSProperties = { background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, padding: '14px 15px', minWidth: 0 }

/** A minimal court Item built from a PunchItem — the fallback for opening the record
 *  drawer when the seed's court twin isn't present. In LIVE the real derived Item from
 *  itemsByTool.punch is used instead (it carries the proper tone/urgency/mine). */
function fallbackItem(p: PunchItem): Item {
  const urg = p.status === 'Overdue' ? 'over' : p.status === 'Closed' ? 'muted' : 'track'
  return {
    id: p.id,
    tool: 'punch',
    project: p.project,
    num: p.number,
    title: p.name,
    who: p.assignee || '—',
    mine: false,
    date: p.dueDate ?? '—',
    urgency: urg,
    status: p.status ? { label: p.status, tone: statusTone(p.status, urg) } : null,
  }
}

export function PunchView() {
  const { state, patch } = useApp()
  const { punch, itemsByTool } = useSiteData()

  const [groupBy, setGroupBy] = useState<PunchGroupDim>('stage')
  const [showClosed, setShowClosed] = useState(false)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // The real derived court Items, keyed by id — the drawer's preferred source.
  const itemById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const it of itemsByTool.punch) m.set(it.id, it)
    return m
  }, [itemsByTool.punch])

  const rows = scoped(punch, state.project)
  const rollup = punchRollup(rows) // KPI cards = the whole closeout position (never filtered)

  const q = query.trim()
  const bySearch = q ? rows.filter((p) => fuzzyMatchesAny(query, [p.name, p.number, p.assignee, p.status])) : rows
  const visible = showClosed ? bySearch : bySearch.filter((p) => p.status !== 'Closed')
  const groups = groupPunchBy(visible, groupBy)
  const shownCount = visible.length

  const openItem = (p: PunchItem) =>
    patch(openPatch({ kind: 'detail', value: { tool: 'punch', record: itemById.get(p.id) ?? fallbackItem(p) } }))

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const kpis: { label: string; value: string; sub?: string }[] = [
    { label: 'Punch Items', value: String(rollup.total), sub: `${rollup.open} open` },
    { label: 'Overdue', value: String(rollup.overdue), sub: 'past due date' },
    { label: 'Ready for Review', value: String(rollup.readyForReview), sub: 'awaiting verification' },
    { label: 'Closed', value: String(rollup.closed) },
    { label: '% Complete', value: `${Math.round(rollup.pctComplete * 100)}%`, sub: `${rollup.closed} of ${rollup.total}` },
  ]

  return (
    <div style={{ padding: '18px 22px 20px' }}>
      {/* rollup KPI cards — 3 per row (matches the sibling registers); 5 metrics wrap 3 + 2. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={kpiCard}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary-2)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</div>
            <div style={{ fontFamily: mono, fontSize: 19, fontWeight: 680, marginTop: 6, color: 'var(--tx-primary)' }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 10.5, color: 'var(--tx-faint)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 52, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>No punch items for this project.</div>
      ) : (
        <>
          {/* controls: group-by toggle · show-closed · filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 2px 9px', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', border: '1px solid var(--bd-2)', borderRadius: 8, overflow: 'hidden' }}>
              {(['stage', 'assignee'] as PunchGroupDim[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setGroupBy(d)}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 12px',
                    border: 'none',
                    cursor: 'pointer',
                    background: groupBy === d ? 'var(--fill-3)' : '#fff',
                    color: groupBy === d ? 'var(--tx-primary)' : 'var(--tx-tertiary)',
                  }}
                >
                  {d === 'stage' ? 'By stage' : 'By sub'}
                </button>
              ))}
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
              Show closed ({rollup.closed})
            </label>
            <TableSearch value={query} onChange={setQuery} placeholder="Filter punch items…" count={{ shown: shownCount, total: rows.length }} />
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, overflow: 'hidden' }}>
            {/* column header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: GRID,
                gap: 12,
                alignItems: 'center',
                padding: '9px 16px',
                background: 'var(--fill-1)',
                borderBottom: '1px solid var(--bd-2)',
                fontSize: 9.5,
                textTransform: 'uppercase',
                letterSpacing: '.5px',
                color: 'var(--tx-faint)',
                fontWeight: 600,
              }}
            >
              {HEADS.map((h, i) => (
                <span key={i}>{h}</span>
              ))}
            </div>

            {groups.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>
                {q ? <>No punch items match “{q}”.</> : <>Nothing to show. Try “Show closed”.</>}
              </div>
            ) : (
              groups.map((g) => {
                const isCollapsed = collapsed.has(g.key)
                return (
                  <section key={g.key}>
                    <button
                      type="button"
                      onClick={() => toggle(g.key)}
                      aria-expanded={!isCollapsed}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--fill-2)', border: 'none', borderBottom: '1px solid var(--bd-2)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                    >
                      <span aria-hidden style={{ display: 'inline-block', width: 10, fontSize: 10, color: 'var(--tx-faint)', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform .12s ease' }}>▸</span>
                      <span style={{ fontSize: 13, fontWeight: 680, color: 'var(--tx-primary)' }}>{g.label}</span>
                      <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 650, color: 'var(--tx-secondary-2)', background: 'var(--fill-3)', border: '1px solid var(--bd-1)', borderRadius: 20, padding: '1px 8px' }}>{g.items.length}</span>
                    </button>
                    {!isCollapsed && g.items.map((p) => <PunchRow key={p.id} item={p} query={query} onOpen={() => openItem(p)} />)}
                  </section>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

function PunchRow({ item, query, onOpen }: { item: PunchItem; query?: string; onOpen: () => void }) {
  return (
    <div
      className="sl-hover-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--bd-row)', cursor: 'pointer' }}
    >
      <span style={{ fontFamily: mono, fontSize: 11.5, fontWeight: 600, color: 'var(--tx-secondary-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <Highlight text={item.number} query={query} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 530, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={item.name}>
        {item.name ? <Highlight text={item.name} query={query} /> : '—'}
      </span>
      <span style={{ fontSize: 12, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={item.assignee}>
        {item.assignee ? <Highlight text={item.assignee} query={query} /> : <span style={{ color: 'var(--tx-faint)' }}>Unassigned</span>}
      </span>
      <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--tx-faint)', whiteSpace: 'nowrap' }}>{item.dueDate ?? '—'}</span>
      <span style={{ minWidth: 0 }}>
        <StatusPill status={item.status} />
      </span>
      <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center', color: 'var(--tx-faint)', fontSize: 12 }}>
        {item.hasPhotos && <span title="Has photos" aria-label="Has photos">📎</span>}
        {item.hasOpenResponse && <span title="Open response" aria-label="Open response" style={{ width: 7, height: 7, borderRadius: '50%', background: toneMap.info.c }} />}
      </span>
    </div>
  )
}
