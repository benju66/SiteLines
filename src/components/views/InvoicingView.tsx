// Invoicing register (Invoicing, Phase 1). Invoicing stops sharing the generic
// ToolRegisterView and gets its own pay-application register (like Commitments):
// rollup KPI cards (Billed to Date · Retainage Held · This Period · # Under Review,
// plus the count) over an enriched, sortable register — Vendor · Pay App # · Period
// · This Period · Billed to Date · Retainage · % · Status. Every subcontractor pay
// app across the job (the billing log); Under-Review ones flag what needs approval.
// Reference data (never a court Item): reads the `invoices` slice, orders via the
// pure invoicesSorted selector, rolls up via invoiceRollup (cumulative fields summed
// over the latest pay app per commitment — never double-counted), and formats here.
// Hand-rolled — no table library. The G702 detail drawer is Phase 2.

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { formatMoney, statusTone } from '@/lib/derive'
import { openPatch } from '@/lib/drawerNav'
import { fuzzyMatchesAny } from '@/lib/fuzzy'
import { invoicePeriods, invoiceRollup, invoicesSorted, scoped } from '@/selectors'
import type { InvoiceSort, InvoiceSortCol } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, tone } from '@/theme/tokens'
import type { Invoice } from '@/types'
import { Highlight } from '@/components/ui/Highlight'
import { TableSearch } from '@/components/ui/TableSearch'

// Eight columns. `sort` = null → not sortable (the identity column keeps the
// deterministic default order — most recent pay app first — instead).
const COLS: { label: string; sort: InvoiceSortCol | null; align: 'left' | 'right' }[] = [
  { label: 'Vendor', sort: 'vendor', align: 'left' },
  { label: 'Pay App', sort: null, align: 'left' },
  { label: 'Period', sort: 'period', align: 'left' },
  { label: 'This Period', sort: 'thisPeriod', align: 'right' },
  { label: 'Billed to Date', sort: 'billed', align: 'right' },
  { label: 'Retainage', sort: 'retainage', align: 'right' },
  { label: '%', sort: 'pct', align: 'right' },
  { label: 'Status', sort: 'status', align: 'right' },
]
const GRID = 'minmax(170px,1.4fr) 96px minmax(150px,1.1fr) 116px 118px 104px 52px 104px'

// Money columns read best largest-first; text columns A→Z first; period newest-first.
const defaultDir = (col: InvoiceSortCol): InvoiceSort['dir'] => (col === 'vendor' || col === 'status' ? 'asc' : 'desc')

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

function Money({ v }: { v: number }) {
  return <span style={{ ...numBase, color: v === 0 ? 'var(--tx-faint-2)' : 'var(--tx-secondary)' }}>{formatMoney(v)}</span>
}

/** Status pill — same tone vocabulary as the registers (Approved ok, Under Review info). */
function StatusPill({ label }: { label: string }) {
  const t = tone[statusTone(label, 'track')]
  return (
    <span style={{ textAlign: 'right', minWidth: 0 }}>
      <span
        style={{ fontSize: 10, fontWeight: 650, letterSpacing: '.3px', textTransform: 'uppercase', color: t.c, background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}
      >
        {label || '—'}
      </span>
    </span>
  )
}

export function InvoicingView() {
  const { state, patch } = useApp()
  const { invoices } = useSiteData()

  const [sort, setSort] = useState<InvoiceSort | null>(null)
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState<string>('') // '' = All periods

  const rows = scoped(invoices, state.project)
  const rollup = invoiceRollup(rows) // KPI cards = the job's whole billing position (never period-filtered)
  const periods = invoicePeriods(rows)
  const sorted = invoicesSorted(rows, sort)
  // A selected period that falls out of scope (project switch) degrades to All.
  const activePeriod = period && periods.includes(period) ? period : ''
  const inPeriod = activePeriod ? sorted.filter((i) => i.period === activePeriod) : sorted
  const q = query.trim()
  const shown = q ? inPeriod.filter((i) => fuzzyMatchesAny(query, [i.vendor, i.number, i.contract, i.period, i.status])) : inPeriod
  // Total row sums THIS-PERIOD billing (always summable) — not the cumulative
  // billed/retainage, which would be misleading under a period filter.
  const shownThisPeriod = shown.reduce((s, i) => s + i.thisPeriod, 0)
  const shownUnderReview = shown.filter((i) => i.status === 'Under Review').length
  const filtered = !!activePeriod || !!q

  // Header click cycles: default order → column default dir → opposite → default order.
  const onSort = (col: InvoiceSortCol) =>
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: defaultDir(col) }
      if (prev.dir === defaultDir(col)) return { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return null
    })

  const kpis: { label: string; value: string; sub?: string }[] = [
    { label: 'Pay Applications', value: String(rollup.count), sub: `${rollup.subs} subs billing` },
    { label: 'Billed to Date', value: formatMoney(rollup.billedToDate), sub: 'latest pay app per sub' },
    { label: 'Retainage Held', value: formatMoney(rollup.retainageHeld) },
    { label: 'This Period', value: formatMoney(rollup.thisPeriod), sub: 'current cycle, net' },
    { label: 'Under Review', value: String(rollup.underReview), sub: 'awaiting approval' },
  ]

  return (
    <div style={{ padding: '18px 22px 20px' }}>
      {/* rollup KPI cards — 3 per row (matches Budget/Commitments); 5 metrics wrap 3 + 2. */}
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
        <div style={{ padding: 52, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>No pay applications for this project.</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 2px 9px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--tx-faint)', fontWeight: 600 }}>Period</span>
              <select
                value={activePeriod}
                onChange={(e) => setPeriod(e.target.value)}
                style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 540, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--bd-2)', background: '#fff', color: 'var(--tx-secondary)', cursor: 'pointer', maxWidth: 168 }}
              >
                <option value="">All periods</option>
                {periods.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <TableSearch value={query} onChange={setQuery} placeholder="Filter pay applications…" count={{ shown: shown.length, total: rows.length }} />
            <span style={{ fontSize: 12, color: 'var(--tx-tertiary)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Click a row for the G702 &amp; billing history.
            </span>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 1000 }}>
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
                        onClick={c.sort ? () => onSort(c.sort as InvoiceSortCol) : undefined}
                        style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: c.align, cursor: c.sort ? 'pointer' : 'default', color: active ? 'var(--tx-secondary)' : undefined }}
                      >
                        {c.label}
                        {arrow}
                      </span>
                    )
                  })}
                </div>

                {shown.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>No pay applications match “{q}”.</div>
                ) : (
                  <>
                    {shown.map((i) => (
                      <InvoiceRow key={i.id} inv={i} query={query} onOpen={() => patch(openPatch({ kind: 'invoice', value: i }))} />
                    ))}

                    {/* totals — sums THIS-PERIOD billing across the shown set (billed/
                        retainage are cumulative and would mislead under a period filter;
                        the KPI cards above carry the job's cumulative position) */}
                    <div style={{ ...rowBase, padding: '11px 16px', background: '#f9fafb', borderTop: '1px solid var(--bd-2)' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>Total — {shown.length} {filtered ? 'shown' : 'pay apps'}</span>
                      <span />
                      <span style={{ ...numBase, textAlign: 'left', fontSize: 10.5, color: 'var(--tx-faint)' }}>billed this period →</span>
                      <Money v={shownThisPeriod} />
                      <span />
                      <span />
                      <span />
                      <span style={{ textAlign: 'right', fontSize: 11, color: shownUnderReview > 0 ? 'var(--tx-secondary)' : 'var(--tx-faint)' }}>{shownUnderReview > 0 ? `${shownUnderReview} in review` : ''}</span>
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

function InvoiceRow({ inv, query, onOpen }: { inv: Invoice; query?: string; onOpen: () => void }) {
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
        <span style={{ fontSize: 12.5, color: 'var(--tx-primary)', fontWeight: 540, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={inv.vendor || inv.contract}>
          <Highlight text={inv.vendor || inv.contract || '—'} query={query} />
        </span>
        {inv.final && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--tx-faint)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '0 4px', flex: 'none' }}>Final</span>}
      </span>
      <span style={{ fontFamily: mono, fontSize: 11.5, fontWeight: 600, color: 'var(--tx-secondary-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <Highlight text={inv.number} query={query} />
      </span>
      <span style={{ fontSize: 12, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={inv.period}>
        {inv.period || '—'}
      </span>
      <Money v={inv.thisPeriod} />
      <Money v={inv.billedToDate} />
      <Money v={inv.retainage} />
      <span style={{ ...numBase, fontSize: 11.5, color: 'var(--tx-secondary)' }}>{Math.round(inv.pctComplete * 100)}%</span>
      <StatusPill label={inv.status} />
    </div>
  )
}
