// Change Events register (Change Events, Phase 1). Change Events stop sharing the
// generic ToolRegisterView and get their own cost-exposure ledger (like Budget /
// Commitments): rollup KPI cards (count · open exposure · active exposure · out-of-
// scope · voided), a collapsible scope + funding-bucket breakdown (hand-rolled SVG
// bars — no chart lib), and an enriched, sortable register — CE # · Title · Scope ·
// Type · Reason · Est. Cost · Status. A change event is a POTENTIAL change, priced
// before it becomes a change order; estCost can be negative (a de-scope credit).
// Reference data (never a court Item): reads the `changeEvents` slice, orders via
// the pure changeEventsSorted selector, and formats dollars here (never stored —
// DATA_CONTRACT §6). Open exposure ties to Budget's pending-change section.

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { formatMoney, statusTone } from '@/lib/derive'
import { fuzzyMatchesAny } from '@/lib/fuzzy'
import { changeEventRollup, changeEventsByScope, changeEventsByType, changeEventsSorted, scoped } from '@/selectors'
import type { ChangeEventBucket, ChangeEventSort, ChangeEventSortCol } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, projectMeta, tone } from '@/theme/tokens'
import type { ChangeEvent } from '@/types'
import { Highlight } from '@/components/ui/Highlight'
import { TableSearch } from '@/components/ui/TableSearch'

// Seven columns. `sort` = null → not sortable (the identity column keeps the
// deterministic default order — estimated cost desc — instead).
const COLS: { label: string; sort: ChangeEventSortCol | null; align: 'left' | 'right' }[] = [
  { label: 'Change Event', sort: null, align: 'left' },
  { label: 'Scope', sort: 'scope', align: 'left' },
  { label: 'Funding', sort: 'type', align: 'left' },
  { label: 'Reason', sort: 'reason', align: 'left' },
  { label: 'Est. Cost', sort: 'estCost', align: 'right' },
  { label: 'Status', sort: 'status', align: 'right' },
]
const GRID = 'minmax(220px,1.6fr) 92px minmax(120px,1fr) minmax(120px,1fr) 118px 104px'

// Money columns read best largest-first; text columns A→Z first.
const defaultDir = (col: ChangeEventSortCol): ChangeEventSort['dir'] => (col === 'estCost' ? 'desc' : 'asc')

const rowBase: CSSProperties = { display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center' }
const numBase: CSSProperties = {
  textAlign: 'right',
  fontFamily: mono,
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const teal = projectMeta.opiii.color

/** Signed money with an explicit +/− and color: an add reads neutral, a de-scope
 *  credit reads green (a saving). Zero reads muted. */
function signed(n: number): string {
  return (n > 0 ? '+' : n < 0 ? '−' : '') + formatMoney(Math.abs(n))
}
function moneyColor(n: number): string {
  return n < 0 ? tone.ok.c : n > 0 ? 'var(--tx-secondary)' : 'var(--tx-faint-2)'
}

/** Est-cost cell — signed, credit-green, zero muted. */
function Money({ v }: { v: number }) {
  return <span style={{ ...numBase, color: moneyColor(v) }}>{v === 0 ? '—' : signed(v)}</span>
}

/** Status pill — same tone vocabulary as the registers (Closed ok, Void muted). */
function StatusPill({ label }: { label: string }) {
  const t = tone[statusTone(label, 'track')]
  return (
    <span style={{ textAlign: 'right', minWidth: 0 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 650,
          letterSpacing: '.3px',
          textTransform: 'uppercase',
          color: t.c,
          background: t.bg,
          border: `1px solid ${t.bd}`,
          borderRadius: 20,
          padding: '2px 8px',
          whiteSpace: 'nowrap',
        }}
      >
        {label || '—'}
      </span>
    </span>
  )
}

/** A small inline chip for scope / funding-bucket cells; muted when unspecified. */
function Tag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        color: label ? 'var(--tx-secondary)' : 'var(--tx-faint-2)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        minWidth: 0,
      }}
      title={label}
    >
      {label || '—'}
    </span>
  )
}

const panelCard: CSSProperties = { background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, padding: '13px 15px', minWidth: 0 }
const panelTitle: CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary)', fontWeight: 600 }

/** One breakdown panel — hand-rolled SVG bars (no chart lib) scaled to the largest
 *  |exposure| in the set, so scopes / funding buckets are visually comparable. An
 *  add reads teal; a de-scope credit reads green. */
function BucketPanel({ title, buckets }: { title: string; buckets: ChangeEventBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => Math.abs(b.exposure)))
  return (
    <div style={panelCard}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={panelTitle}>{title}</span>
        <span style={{ fontSize: 10.5, color: 'var(--tx-faint)' }}>est. cost · count</span>
      </div>
      {buckets.length === 0 ? (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--tx-faint)' }}>No priced changes.</div>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 13 }}>
          {buckets.map((b) => {
            const w = Math.min(100, (Math.abs(b.exposure) / max) * 100)
            const credit = b.exposure < 0
            return (
              <div key={b.key}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.key}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: credit ? tone.ok.c : 'var(--tx-faint)', whiteSpace: 'nowrap' }}>
                    {signed(b.exposure)} · {b.count}
                  </span>
                </div>
                <svg viewBox="0 0 100 8" preserveAspectRatio="none" style={{ width: '100%', height: 9, display: 'block' }} role="img" aria-label={`${b.key}: ${signed(b.exposure)} across ${b.count}`}>
                  <rect x="0" y="0" width="100" height="8" fill="var(--bd-3)" />
                  <rect x="0" y="0" width={w} height="8" fill={credit ? tone.ok.c : teal} />
                </svg>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ChangeEventsView() {
  const { state, patch } = useApp()
  const { changeEvents } = useSiteData()

  const [sort, setSort] = useState<ChangeEventSort | null>(null)
  const [query, setQuery] = useState('')
  const [breakdownCollapsed, setBreakdownCollapsed] = useState(false)

  const rows = scoped(changeEvents, state.project)
  const rollup = changeEventRollup(rows)
  const byScope = changeEventsByScope(rows)
  const byType = changeEventsByType(rows)
  const sorted = changeEventsSorted(rows, sort)
  const q = query.trim()
  const shown = q ? sorted.filter((e) => fuzzyMatchesAny(query, [e.number, e.title, e.scope, e.type, e.reason, e.status])) : sorted
  const totals = q ? changeEventRollup(shown) : rollup

  // Header click cycles: default order → column default dir → opposite → default order.
  const onSort = (col: ChangeEventSortCol) =>
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: defaultDir(col) }
      if (prev.dir === defaultDir(col)) return { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return null
    })

  const kpis: { label: string; value: string; sub?: string; color?: string }[] = [
    { label: 'Change Events', value: String(rollup.count), sub: `${rollup.open} open · ${rollup.closed} closed` },
    { label: 'Open Exposure', value: signed(rollup.openExposure), sub: 'in flight → Budget pending' },
    { label: 'Active Exposure', value: signed(rollup.activeExposure), sub: 'open + closed, excl. void' },
    { label: 'Out of Scope', value: signed(rollup.outOfScopeExposure), sub: 'likely owner-funded' },
    { label: 'Voided', value: String(rollup.voided), sub: 'excluded from exposure' },
  ]

  return (
    <div style={{ padding: '18px 22px 20px' }}>
      {/* rollup KPI cards — 3 per row (matches Budget/Commitments); 5 metrics wrap 3 + 2. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, padding: '14px 15px', minWidth: 0 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary-2)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</div>
            <div style={{ fontFamily: mono, fontSize: 19, fontWeight: 680, marginTop: 6, color: k.color ?? 'var(--tx-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 10.5, color: 'var(--tx-faint)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 52, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>No change events for this project.</div>
      ) : (
        <>
          {/* scope + funding-bucket breakdown — collapsible */}
          <button
            type="button"
            onClick={() => setBreakdownCollapsed((c) => !c)}
            aria-expanded={!breakdownCollapsed}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', background: 'none', border: 'none', padding: '2px 2px 12px', marginTop: 16, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
          >
            <span aria-hidden style={{ display: 'inline-block', width: 9, fontSize: 10, color: 'var(--tx-faint)', transform: breakdownCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform .12s ease' }}>▸</span>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary)', fontWeight: 600 }}>Scope &amp; funding breakdown</span>
            {breakdownCollapsed && (
              <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--tx-faint)', marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {signed(rollup.outOfScopeExposure)} out of scope · {byType.length} funding buckets
              </span>
            )}
          </button>

          {!breakdownCollapsed && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
              <BucketPanel title="By scope" buckets={byScope} />
              <BucketPanel title="By funding source" buckets={byType} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 2px 9px' }}>
            <TableSearch value={query} onChange={setQuery} placeholder="Filter change events…" count={{ shown: shown.length, total: rows.length }} />
            <span style={{ fontSize: 12, color: 'var(--tx-tertiary)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Click a row to open its detail · “−” = de-scope credit · a column header to sort.
            </span>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 860 }}>
                {/* column header */}
                <div
                  style={{
                    ...rowBase,
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
                  {COLS.map((c) => {
                    const active = sort && c.sort === sort.col
                    const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''
                    return (
                      <span
                        key={c.label}
                        onClick={c.sort ? () => onSort(c.sort as ChangeEventSortCol) : undefined}
                        style={{
                          minWidth: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: c.align,
                          cursor: c.sort ? 'pointer' : 'default',
                          color: active ? 'var(--tx-secondary)' : undefined,
                        }}
                      >
                        {c.label}
                        {arrow}
                      </span>
                    )
                  })}
                </div>

                {shown.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>No change events match “{q}”.</div>
                ) : (
                  <>
                    {shown.map((e) => (
                      <ChangeEventRow key={e.id} e={e} query={query} onOpen={() => patch({ changeEvent: e })} />
                    ))}

                    {/* totals — reflect the filtered set when searching; exposure excludes void */}
                    <div style={{ ...rowBase, padding: '11px 16px', background: '#f9fafb', borderTop: '1px solid var(--bd-2)' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>Total — {totals.count} {q ? 'matching' : 'events'}</span>
                      <span />
                      <span />
                      <span style={{ fontSize: 11, color: 'var(--tx-faint)', textAlign: 'right' }}>active</span>
                      <Money v={totals.activeExposure} />
                      <span />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ChangeEventRow({ e, query, onOpen }: { e: ChangeEvent; query?: string; onOpen: () => void }) {
  return (
    <div
      className="sl-hover-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          onOpen()
        }
      }}
      style={{ ...rowBase, padding: '9px 16px', borderBottom: '1px solid var(--bd-row)', cursor: 'pointer' }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span style={{ fontFamily: mono, fontSize: 11.5, fontWeight: 650, color: 'var(--tx-primary)', flex: 'none' }}>
          <Highlight text={e.number} query={query} />
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.title}>
          <Highlight text={e.title} query={query} />
        </span>
      </span>
      <Tag label={e.scope} />
      <Tag label={e.type} />
      <Tag label={e.reason} />
      <Money v={e.estCost} />
      <StatusPill label={e.status} />
    </div>
  )
}
