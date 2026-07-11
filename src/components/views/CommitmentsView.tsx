// Commitments register (Commitments, Phase 1). Commitments stop sharing the
// generic ToolRegisterView and get their own financial surface (like Budget):
// rollup KPI cards (Committed/Revised · Billed · Retainage · % Complete, plus
// the count) over an enriched, sortable register — Commitment · Contract
// Company · Type · Revised · Billed · Retainage · % Complete · Status. The
// financials come from each commitment's latest requisition (G702 summary);
// rows with no pay app yet show "—" instead of a misleading $0. Reference data
// (never a court Item): reads the `commitments` slice, orders via the pure
// commitmentsSorted selector, and formats dollars / % here (never stored —
// DATA_CONTRACT §6). Headers click-to-sort; default is revised value desc.
// Hand-rolled — no table library. The detail drawer is Phase 2.

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { formatMoney, statusTone } from '@/lib/derive'
import { fuzzyMatchesAny } from '@/lib/fuzzy'
import { commitmentRollup, commitmentsSorted, scoped } from '@/selectors'
import type { CommitmentSort, CommitmentSortCol } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, tone } from '@/theme/tokens'
import type { Commitment } from '@/types'
import { Highlight } from '@/components/ui/Highlight'
import { TableSearch } from '@/components/ui/TableSearch'

// Eight columns. `sort` = null → not sortable (the identity column keeps the
// deterministic default order instead).
const COLS: { label: string; sort: CommitmentSortCol | null; align: 'left' | 'right' }[] = [
  { label: 'Commitment', sort: null, align: 'left' },
  { label: 'Contract Company', sort: 'vendor', align: 'left' },
  { label: 'Type', sort: 'type', align: 'left' },
  { label: 'Revised', sort: 'revised', align: 'right' },
  { label: 'Billed', sort: 'billed', align: 'right' },
  { label: 'Retainage', sort: 'retainage', align: 'right' },
  { label: '% Complete', sort: 'pct', align: 'right' },
  { label: 'Status', sort: 'status', align: 'right' },
]
const GRID = 'minmax(230px,1.5fr) minmax(170px,1.1fr) 52px 118px 118px 104px 96px 104px'

// Money columns read best largest-first; text columns A→Z first.
const defaultDir = (col: CommitmentSortCol): CommitmentSort['dir'] =>
  col === 'vendor' || col === 'type' || col === 'status' ? 'asc' : 'desc'

const rowBase: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: GRID,
  gap: 12,
  alignItems: 'center',
}
const numBase: CSSProperties = {
  textAlign: 'right',
  fontFamily: mono,
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

/** Money cell; `missing` (no requisition yet) renders "—", zeros read muted. */
function Money({ v, missing = false }: { v: number; missing?: boolean }) {
  if (missing) return <span style={{ ...numBase, color: 'var(--tx-faint-2)' }}>—</span>
  return <span style={{ ...numBase, color: v === 0 ? 'var(--tx-faint-2)' : 'var(--tx-secondary)' }}>{formatMoney(v)}</span>
}

/** % complete cell (0..1 → whole %); "—" when there's no requisition. */
function PctCell({ pct, missing = false }: { pct: number; missing?: boolean }) {
  if (missing) return <span style={{ ...numBase, color: 'var(--tx-faint-2)' }}>—</span>
  return <span style={{ ...numBase, color: 'var(--tx-secondary)' }}>{Math.round(pct * 100)}%</span>
}

/** Status pill — same tone vocabulary as the registers (Approved ok, Draft muted). */
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

export function CommitmentsView() {
  const { state, patch } = useApp()
  const { commitments } = useSiteData()

  const [sort, setSort] = useState<CommitmentSort | null>(null)
  const [query, setQuery] = useState('')

  const rows = scoped(commitments, state.project)
  const rollup = commitmentRollup(rows)
  const sorted = commitmentsSorted(rows, sort)
  const q = query.trim()
  const shown = q ? sorted.filter((c) => fuzzyMatchesAny(query, [c.number, c.title, c.vendor, c.type, c.status])) : sorted
  // KPI cards summarize the whole project; the table total reflects what's shown.
  const totals = q ? commitmentRollup(shown) : rollup

  // Header click cycles: default order → column default dir → opposite → default order.
  const onSort = (col: CommitmentSortCol) =>
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: defaultDir(col) }
      if (prev.dir === defaultDir(col)) return { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return null
    })

  const kpis: { label: string; value: string; sub?: string }[] = [
    { label: 'Commitments', value: String(rollup.count), sub: `${rollup.billing} billing` },
    { label: 'Committed (Revised)', value: formatMoney(rollup.revised), sub: `${formatMoney(rollup.original)} original` },
    { label: 'Billed to Date', value: formatMoney(rollup.billed) },
    { label: 'Retainage Held', value: formatMoney(rollup.retainage) },
    { label: '% Complete', value: `${Math.round(rollup.pctComplete * 100)}%`, sub: 'billed / revised' },
  ]

  return (
    <div style={{ padding: '18px 22px 20px' }}>
      {/* rollup KPI cards — 3 per row (matches Budget); 5 metrics wrap to 3 + 2.
          The app card's content column is ~595px, too tight for 5 across without
          truncating the dollar values. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, padding: '14px 15px', minWidth: 0 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary-2)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</div>
            <div style={{ fontFamily: mono, fontSize: 19, fontWeight: 680, marginTop: 6, color: 'var(--tx-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 10.5, color: 'var(--tx-faint)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 52, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>
          No commitments for this project.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 2px 9px' }}>
            <TableSearch value={query} onChange={setQuery} placeholder="Filter commitments…" count={{ shown: shown.length, total: rows.length }} />
            <span style={{ fontSize: 12, color: 'var(--tx-tertiary)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Click a row to open its detail · a column header to sort · “—” = no billing yet.
            </span>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 980 }}>
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
                        onClick={c.sort ? () => onSort(c.sort as CommitmentSortCol) : undefined}
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
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>No commitments match “{q}”.</div>
                ) : (
                  <>
                    {shown.map((c) => (
                      <CommitmentRow key={c.id} c={c} query={query} onOpen={() => patch({ commitment: c })} />
                    ))}

                    {/* totals — reflect the filtered set when searching */}
                    <div style={{ ...rowBase, padding: '11px 16px', background: '#f9fafb', borderTop: '1px solid var(--bd-2)' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>Total — {totals.count} {q ? 'matching' : 'commitments'}</span>
                      <span />
                      <span />
                      <Money v={totals.revised} />
                      <Money v={totals.billed} />
                      <Money v={totals.retainage} />
                      <PctCell pct={totals.pctComplete} />
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

function CommitmentRow({ c, query, onOpen }: { c: Commitment; query?: string; onOpen: () => void }) {
  const missing = !c.hasRequisition
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
      style={{ ...rowBase, padding: '9px 16px', borderBottom: '1px solid var(--bd-row)', cursor: 'pointer' }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span style={{ fontFamily: mono, fontSize: 11.5, fontWeight: 650, color: 'var(--tx-primary)', flex: 'none' }}><Highlight text={c.number} query={query} /></span>
        <span style={{ fontSize: 12.5, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.title}>
          <Highlight text={c.title} query={query} />
        </span>
      </span>
      <span style={{ fontSize: 12.5, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={c.vendor}>
        {c.vendor ? <Highlight text={c.vendor} query={query} /> : '—'}
      </span>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: '.3px',
          textTransform: 'uppercase',
          color: 'var(--tx-faint)',
          border: '1px solid var(--bd-1)',
          borderRadius: 4,
          padding: '1px 5px',
          justifySelf: 'start',
        }}
      >
        {c.type}
      </span>
      <Money v={c.revised} missing={missing} />
      <Money v={c.billed} missing={missing} />
      <Money v={c.retainage} missing={missing} />
      <PctCell pct={c.pctComplete} missing={missing} />
      <StatusPill label={c.status} />
    </div>
  )
}
