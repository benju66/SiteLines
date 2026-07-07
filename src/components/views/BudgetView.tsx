// Budget cost-control view (Budget Insights, Phase 1 + fast-follows). Budget
// stops sharing the FinancialView (Prime Contract keeps it) and gets its own
// drill-down: the six KPI cards (collapsible) over an expandable division →
// cost-code table — Cost Code · Budget · Committed · % Bought Out · Uncommitted ·
// Projected (EAC) · Over/Under, with division subtotals and a grand total.
// Reference data (never a court Item): reads the `budgetLines` slice, groups via
// the pure budgetByDivision selector, and formats dollars / % here (never stored
// — DATA_CONTRACT §6). Columns are drag-resizable; headers click-to-sort (worst
// Over/Under first); an "Over budget only" filter narrows to the red lines;
// over-committed lines (committed > budget) read amber. Collapse state lives in
// AppState. Hand-rolled — no table library.

import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { formatMoney } from '@/lib/derive'
import { boughtOut, budgetByDivision, budgetForecast, budgetTotals, buyoutGaps, costTypeMix, financialView, overBudget, scoped, sortedBudgetGroups } from '@/selectors'
import type { BudgetDivisionGroup, BudgetForecast, BudgetSort, BudgetSortCol, CostTypeSlice, OverBudgetResult } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, projectMeta, tone } from '@/theme/tokens'
import type { BudgetLine } from '@/types'

// Seven columns. Widths are resizable; these defaults are mirrored in the CSS-var
// fallback so rows render before the effect runs. `sort` = null → not sortable.
const COLS: { label: string; sort: BudgetSortCol | null }[] = [
  { label: 'Cost Code', sort: null },
  { label: 'Budget', sort: 'budget' },
  { label: 'Committed', sort: 'committed' },
  { label: '% Bought Out', sort: 'pct' },
  { label: 'Uncommitted', sort: 'uncommitted' },
  { label: 'Job-to-Date', sort: 'jtd' },
  { label: 'Forecast', sort: 'forecast' },
  { label: 'Projected', sort: 'eac' },
  { label: 'Over / Under', sort: 'over' },
]
const DEFAULT_WIDTHS = [300, 110, 110, 106, 110, 132, 118, 110, 116]
const MIN_WIDTHS = [168, 72, 72, 72, 72, 88, 72, 72, 72]
const GRID_FALLBACK = DEFAULT_WIDTHS.map((w) => `${w}px`).join(' ')

// Over/Under's most useful first click is ascending (most-negative = worst first);
// every other column defaults to descending (largest first).
const defaultDir = (col: BudgetSortCol): BudgetSort['dir'] => (col === 'over' ? 'asc' : 'desc')

const rowBase: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `var(--budget-grid, ${GRID_FALLBACK})`,
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

/** Money cell. `over` marks the Over/Under column (red when negative = over budget);
 *  zeros read muted to keep the grid scannable. `strong` bolds subtotal / total rows. */
function Money({ v, over = false, strong = false }: { v: number; over?: boolean; strong?: boolean }) {
  const color = over && v < 0 ? tone.danger.c : v === 0 ? 'var(--tx-faint-2)' : strong ? 'var(--tx-primary)' : 'var(--tx-secondary)'
  return <span style={{ ...numBase, color, fontSize: strong ? 12.5 : 12, fontWeight: strong ? 700 : 400 }}>{formatMoney(v)}</span>
}

/** % bought out — amber when over-committed (committed > budget = a locked-in buyout loss). */
function PctCell({ budget, committed, strong = false }: { budget: number; committed: number; strong?: boolean }) {
  const overCommitted = budget > 0 && committed > budget
  const color = overCommitted ? tone.warn.c : strong ? 'var(--tx-primary)' : 'var(--tx-secondary)'
  const text = budget > 0 ? `${Math.round(boughtOut(budget, committed) * 100)}%` : '—'
  return <span style={{ ...numBase, color, fontSize: strong ? 12.5 : 12, fontWeight: strong ? 700 : overCommitted ? 600 : 400 }}>{text}</span>
}

/** Job-to-Date actual cost (erpJtd) with the % spent (jtd / EAC) riding along, muted. */
function JtdCell({ jtd, eac, strong = false }: { jtd: number; eac: number; strong?: boolean }) {
  const pct = eac > 0 ? Math.round((jtd / eac) * 100) : null
  const color = strong ? 'var(--tx-primary)' : jtd === 0 ? 'var(--tx-faint-2)' : 'var(--tx-secondary)'
  return (
    <span style={{ ...numBase, color, fontSize: strong ? 12.5 : 12, fontWeight: strong ? 700 : 400 }}>
      {formatMoney(jtd)}
      {pct !== null && <span style={{ color: 'var(--tx-faint)', fontWeight: 400 }}> · {pct}%</span>}
    </span>
  )
}

/** Split "1-10320.000 - Sr Project Manager" into [code, description]. */
function codeParts(s: string): [string, string] {
  const i = s.indexOf(' - ')
  return i >= 0 ? [s.slice(0, i), s.slice(i + 3)] : [s, '']
}

/** Strip the leading root number: "9 - Division 09 - Finishes" → "Division 09 — Finishes". */
function divName(s: string): string {
  const p = s.split(' - ')
  return p.length >= 2 ? p.slice(1).join(' — ') : s
}

export function BudgetView() {
  const { state, patch } = useApp()
  const { financials, budgetLines, budgetPending } = useSiteData()

  const [sort, setSort] = useState<BudgetSort | null>(null)
  const [overBudgetOnly, setOverBudgetOnly] = useState(false)

  // KPI cards stay identical to today's Budget (reuse the shared selector); the
  // table is the new drill-down. Both re-scope with the global project.
  const kpis = financialView(financials, 'budget', state.project).kpis
  const kpiByLabel = (label: string) => kpis.find((k) => k.label === label)?.value ?? ''

  const lines = scoped(budgetLines, state.project)
  const shownLines = overBudgetOnly ? lines.filter((l) => l.projectedOverUnder < 0) : lines
  const groups = sortedBudgetGroups(budgetByDivision(shownLines), sort)
  const totals = budgetTotals(shownLines)

  // Phase 2 analysis — always over the full scoped lines (independent of the table's filter).
  const risk = overBudget(lines)
  const gaps = buyoutGaps(lines, 4)
  const mix = costTypeMix(lines)
  // Phase 3 — pending-change forecast (revised → pending → projected).
  const forecast = budgetForecast(lines, scoped(budgetPending, state.project))

  // Resizable columns — widths in a ref + a CSS var written straight to the DOM so
  // a drag doesn't re-render every row (the var cascades to all .row children).
  const innerRef = useRef<HTMLDivElement>(null)
  const widthsRef = useRef<number[]>([...DEFAULT_WIDTHS])
  const dragRef = useRef<{ col: number; x: number; w: number } | null>(null)
  const applyGrid = () => {
    const el = innerRef.current
    if (!el) return
    const w = widthsRef.current
    el.style.setProperty('--budget-grid', w.map((x) => `${x}px`).join(' '))
    el.style.minWidth = `${w.reduce((a, b) => a + b, 0)}px`
  }
  useLayoutEffect(applyGrid, [])

  const onResizeDown = (col: number) => (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { col, x: e.clientX, w: widthsRef.current[col] }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.classList.add('is-drag')
  }
  const onResizeMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    const d = dragRef.current
    if (!d) return
    widthsRef.current = widthsRef.current.map((w, i) => (i === d.col ? Math.max(MIN_WIDTHS[d.col], d.w + (e.clientX - d.x)) : w))
    applyGrid()
  }
  const onResizeUp = (e: ReactPointerEvent<HTMLSpanElement>) => {
    dragRef.current = null
    e.currentTarget.classList.remove('is-drag')
  }

  // Header click cycles: unsorted → default dir → opposite → unsorted.
  const onSort = (col: BudgetSortCol) =>
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: defaultDir(col) }
      if (prev.dir === defaultDir(col)) return { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return null
    })

  const toggleKpis = () => patch((s) => ({ budgetKpisCollapsed: !s.budgetKpisCollapsed }))
  const toggleAnalysis = () => patch((s) => ({ budgetAnalysisCollapsed: !s.budgetAnalysisCollapsed }))
  const toggleForecast = () => patch((s) => ({ budgetForecastCollapsed: !s.budgetForecastCollapsed }))
  const toggleDiv = (name: string) =>
    patch((s) => {
      const next = new Set(s.expandedBudgetDivisions)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return { expandedBudgetDivisions: next }
    })
  const expandAll = () => patch({ expandedBudgetDivisions: new Set(groups.map((g) => g.division)) })
  const collapseAll = () => patch({ expandedBudgetDivisions: new Set() })

  const kpisCollapsed = state.budgetKpisCollapsed
  const analysisCollapsed = state.budgetAnalysisCollapsed
  const forecastCollapsed = state.budgetForecastCollapsed
  const isExpanded = (division: string) => overBudgetOnly || state.expandedBudgetDivisions.has(division)

  return (
    <div style={{ padding: '18px 22px 20px' }}>
      {/* Key figures (collapsible) */}
      <button
        type="button"
        onClick={toggleKpis}
        aria-expanded={!kpisCollapsed}
        style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', background: 'none', border: 'none', padding: '2px 2px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span aria-hidden style={{ display: 'inline-block', width: 9, fontSize: 10, color: 'var(--tx-faint)', transform: kpisCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform .12s ease' }}>▸</span>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary)', fontWeight: 600 }}>Key figures</span>
        {kpisCollapsed && (
          <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--tx-faint)', marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Revised {kpiByLabel('Revised Budget')} · Committed {kpiByLabel('Committed')} · Over/Under {kpiByLabel('Projected Over / Under')}
          </span>
        )}
      </button>
      {!kpisCollapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {kpis.map((k) => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, padding: '14px 15px' }}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary-2)', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 680, marginTop: 6, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {lines.length === 0 ? (
        <div style={{ padding: 52, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>
          No budget lines for this project.
        </div>
      ) : (
        <>
          {/* risk radar + cost-type mix (Phase 2) — collapsible */}
          <button
            type="button"
            onClick={toggleAnalysis}
            aria-expanded={!analysisCollapsed}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', background: 'none', border: 'none', padding: '2px 2px 12px', marginTop: 16, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
          >
            <span aria-hidden style={{ display: 'inline-block', width: 9, fontSize: 10, color: 'var(--tx-faint)', transform: analysisCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform .12s ease' }}>▸</span>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary)', fontWeight: 600 }}>Risk &amp; cost-type mix</span>
            {analysisCollapsed && (
              <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--tx-faint)', marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {risk.lines.length > 0 ? `${formatMoney(risk.totalExposure)} over budget · ${risk.lines.length} codes` : 'No cost codes over budget'}
              </span>
            )}
          </button>
          {!analysisCollapsed && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)', gap: 12 }}>
              <RiskPanel risk={risk} gaps={gaps} />
              <MixPanel mix={mix} />
            </div>
          )}

          {/* pending-change forecast (Phase 3) — collapsible; only when there's a pending pipeline */}
          {forecast.divisions.length > 0 && (
            <>
              <button
                type="button"
                onClick={toggleForecast}
                aria-expanded={!forecastCollapsed}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', background: 'none', border: 'none', padding: '2px 2px 12px', marginTop: 16, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <span aria-hidden style={{ display: 'inline-block', width: 9, fontSize: 10, color: 'var(--tx-faint)', transform: forecastCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform .12s ease' }}>▸</span>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary)', fontWeight: 600 }}>Pending changes</span>
                {forecastCollapsed && (
                  <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--tx-faint)', marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {signedMoney(forecast.total.pending)} pending · projected {formatMoney(forecast.total.projected)}
                  </span>
                )}
              </button>
              {!forecastCollapsed && <ForecastPanel forecast={forecast} />}
            </>
          )}

          {/* toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 2px 9px' }}>
            <span style={{ fontSize: 12, color: 'var(--tx-tertiary)' }}>Click a division to drill in · a column header to sort · a column edge to resize.</span>
            <span style={{ marginLeft: 'auto' }} />
            <button
              type="button"
              onClick={() => setOverBudgetOnly((v) => !v)}
              aria-pressed={overBudgetOnly}
              className="sl-linked-row"
              style={{ ...btnStyle, color: overBudgetOnly ? '#fff' : tone.danger.c, background: overBudgetOnly ? tone.danger.c : '#fff', borderColor: overBudgetOnly ? tone.danger.c : 'var(--bd-1)' }}
            >
              Over budget only
            </button>
            <button type="button" onClick={expandAll} className="sl-linked-row" style={btnStyle}>Expand all</button>
            <button type="button" onClick={collapseAll} className="sl-linked-row" style={btnStyle}>Collapse all</button>
          </div>

          {shownLines.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>
              No over-budget lines — every cost code is on or under budget.
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <div ref={innerRef}>
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
                    {COLS.map((c, i) => {
                      const active = sort && c.sort === sort.col
                      const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''
                      return (
                        <span
                          key={c.label}
                          onClick={c.sort ? () => onSort(c.sort as BudgetSortCol) : undefined}
                          style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: i === 0 ? 'flex-start' : 'flex-end', minWidth: 0, cursor: c.sort ? 'pointer' : 'default', color: active ? 'var(--tx-secondary)' : undefined }}
                        >
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}{arrow}</span>
                          {i < COLS.length - 1 && (
                            <span
                              className="sl-budget-rz"
                              aria-hidden
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={onResizeDown(i)}
                              onPointerMove={onResizeMove}
                              onPointerUp={onResizeUp}
                              onPointerCancel={onResizeUp}
                            />
                          )}
                        </span>
                      )
                    })}
                  </div>

                  {groups.map((g) => (
                    <DivisionSection key={g.division} group={g} expanded={isExpanded(g.division)} onToggle={() => toggleDiv(g.division)} />
                  ))}

                  {/* grand total */}
                  <div style={{ ...rowBase, padding: '11px 16px', background: '#f9fafb', borderTop: '1px solid var(--bd-2)' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{overBudgetOnly ? 'Total — over-budget exposure' : 'Total — all divisions'}</span>
                    <Money v={totals.budget} strong />
                    <Money v={totals.committed} strong />
                    <PctCell budget={totals.budget} committed={totals.committed} strong />
                    <Money v={totals.uncommitted} strong />
                    <JtdCell jtd={totals.erpJtd} eac={totals.eac} strong />
                    <Money v={totals.eac - totals.erpJtd} strong />
                    <Money v={totals.eac} strong />
                    <Money v={totals.projectedOverUnder} over strong />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* legend */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '11px 2px 0', fontSize: 11, color: 'var(--tx-faint)' }}>
            <span>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: tone.danger.c, verticalAlign: -1, marginRight: 5 }} />
              Over / Under red when negative (over budget)
            </span>
            <span>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: tone.warn.c, verticalAlign: -1, marginRight: 5 }} />
              % Bought Out amber when over-committed (committed &gt; budget)
            </span>
            <span>Job-to-Date = actual spent (% of EAC) · Forecast = cost to complete (EAC − spent) · Projected = EAC</span>
          </div>
        </>
      )}
    </div>
  )
}

const btnStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  color: 'var(--tx-secondary)',
  background: '#fff',
  border: '1px solid var(--bd-1)',
  borderRadius: 6,
  padding: '4px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

function DivisionSection({ group, expanded, onToggle }: { group: BudgetDivisionGroup; expanded: boolean; onToggle: () => void }) {
  return (
    <section>
      <div
        className="sl-budget-divhead"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        style={{ ...rowBase, padding: '10px 16px', background: 'var(--fill-2)', borderBottom: '1px solid var(--bd-2)', cursor: 'pointer' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span aria-hidden style={{ display: 'inline-block', width: 9, flex: 'none', fontSize: 10, color: 'var(--tx-faint)', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .12s ease' }}>▸</span>
          <span style={{ fontSize: 13, fontWeight: 680, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{divName(group.division)}</span>
          <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 650, color: 'var(--tx-secondary)', background: 'var(--fill-3)', border: '1px solid var(--bd-1)', borderRadius: 20, padding: '1px 7px', flex: 'none' }}>{group.lines.length}</span>
        </span>
        <Money v={group.budget} strong />
        <Money v={group.committed} strong />
        <PctCell budget={group.budget} committed={group.committed} strong />
        <Money v={group.uncommitted} strong />
        <JtdCell jtd={group.erpJtd} eac={group.eac} strong />
        <Money v={group.eac - group.erpJtd} strong />
        <Money v={group.eac} strong />
        <Money v={group.projectedOverUnder} over strong />
      </div>
      {expanded && group.lines.map((l) => <LineRow key={`${l.costCode}|${l.costType}`} line={l} />)}
    </section>
  )
}

function LineRow({ line }: { line: BudgetLine }) {
  const [ccnum, ccname] = codeParts(line.costCode)
  return (
    <div className="sl-hover-row" style={{ ...rowBase, padding: '9px 16px', borderBottom: '1px solid var(--bd-row)' }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, paddingLeft: 19 }}>
        <span style={{ fontFamily: mono, fontSize: 11.5, fontWeight: 650, color: 'var(--tx-primary)', flex: 'none' }}>{ccnum}</span>
        <span style={{ fontSize: 12.5, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ccname}>{ccname}</span>
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--tx-faint)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 5px', flex: 'none' }}>{line.costType}</span>
      </span>
      <Money v={line.budget} />
      <Money v={line.committed} />
      <PctCell budget={line.budget} committed={line.committed} />
      <Money v={line.budget - line.committed} />
      <JtdCell jtd={line.erpJtd} eac={line.eac} />
      <Money v={line.eac - line.erpJtd} />
      <Money v={line.eac} />
      <Money v={line.projectedOverUnder} over />
    </div>
  )
}

const panelCard: CSSProperties = { background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, padding: '13px 15px', minWidth: 0 }
const panelTitle: CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary)', fontWeight: 600 }

/** Budget risk radar — total over-budget exposure, the worst cost codes, and the
 *  largest un-bought scope still to award. */
function RiskPanel({ risk, gaps }: { risk: OverBudgetResult; gaps: BudgetLine[] }) {
  const top = risk.lines.slice(0, 6)
  return (
    <div style={panelCard}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={panelTitle}>Budget risk</span>
        <span style={{ fontSize: 10.5, color: 'var(--tx-faint)' }}>{risk.lines.length} over budget</span>
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: mono, fontSize: 20, fontWeight: 680, color: risk.totalExposure < 0 ? tone.danger.c : 'var(--tx-primary)' }}>{formatMoney(risk.totalExposure)}</span>
        <span style={{ fontSize: 11, color: 'var(--tx-faint)' }}>projected over budget</span>
      </div>

      {top.length > 0 ? (
        <div style={{ marginTop: 11 }}>
          {top.map((l) => (
            <RiskRow key={`${l.costCode}|${l.costType}`} line={l} amount={l.projectedOverUnder} amountColor={tone.danger.c} />
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--tx-tertiary)' }}>No cost codes over budget.</div>
      )}

      {gaps.length > 0 && (
        <>
          <div style={{ marginTop: 12, marginBottom: 3, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--tx-faint)', fontWeight: 600 }}>Largest uncommitted budget</div>
          {gaps.map((l) => (
            <RiskRow key={`${l.costCode}|${l.costType}`} line={l} amount={l.budget - l.committed} amountColor="var(--tx-secondary)" />
          ))}
        </>
      )}
    </div>
  )
}

function RiskRow({ line, amount, amountColor }: { line: BudgetLine; amount: number; amountColor: string }) {
  const [ccnum, ccname] = codeParts(line.costCode)
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', minWidth: 0 }}>
      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 650, color: 'var(--tx-secondary-2)', flex: 'none' }}>{ccnum}</span>
      <span style={{ fontSize: 12, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }} title={ccname}>{ccname}</span>
      <span style={{ fontFamily: mono, fontSize: 11.5, fontWeight: 600, color: amountColor, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(amount)}</span>
    </div>
  )
}

/** Cost-type mix — hand-rolled SVG bars (no chart lib): budget as a light track,
 *  committed overlaid in teal (amber when a type is over-committed). Bars scale to
 *  the largest budget so the three types are comparable. */
function MixPanel({ mix }: { mix: CostTypeSlice[] }) {
  const max = Math.max(1, ...mix.map((s) => s.budget))
  const teal = projectMeta.opiii.color
  return (
    <div style={panelCard}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={panelTitle}>Cost-type mix</span>
        <span style={{ fontSize: 10.5, color: 'var(--tx-faint)' }}>committed / budget</span>
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 13 }}>
        {mix.map((s) => {
          const over = s.budget > 0 && s.committed > s.budget
          const budgetW = (s.budget / max) * 100
          const committedW = Math.min(100, (s.committed / max) * 100)
          const pct = s.budget > 0 ? `${Math.round((s.committed / s.budget) * 100)}%` : '—'
          return (
            <div key={s.costType}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-secondary)' }}>{s.costType}</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: over ? tone.warn.c : 'var(--tx-faint)' }}>
                  {formatMoney(s.committed)} / {formatMoney(s.budget)} · {pct}
                </span>
              </div>
              <svg viewBox="0 0 100 8" preserveAspectRatio="none" style={{ width: '100%', height: 9, display: 'block' }} role="img" aria-label={`${s.costType}: ${pct} of budget committed`}>
                <rect x="0" y="0" width={budgetW} height="8" fill="var(--bd-3)" />
                <rect x="0" y="0" width={committedW} height="8" fill={over ? tone.warn.c : teal} />
              </svg>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 14, fontSize: 10, color: 'var(--tx-faint)' }}>
        <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--bd-3)', verticalAlign: -1, marginRight: 5 }} />Budget</span>
        <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: teal, verticalAlign: -1, marginRight: 5 }} />Committed</span>
      </div>
    </div>
  )
}

/** Money with an explicit + on positive amounts (a pending change reads as +add / −credit). */
function signedMoney(n: number): string {
  return (n > 0 ? '+' : '') + formatMoney(n)
}

/** Pending-change forecast — job-level pending → projected headline, then the
 *  affected divisions with revised → pending → projected. */
function ForecastPanel({ forecast }: { forecast: BudgetForecast }) {
  const fGrid = 'minmax(0,1.7fr) 130px 120px 130px'
  const pendColor = (v: number) => (v > 0 ? tone.warn.c : v < 0 ? tone.ok.c : 'var(--tx-faint-2)')
  const statLabel: CSSProperties = { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary-2)', fontWeight: 600 }
  const statVal: CSSProperties = { fontFamily: mono, fontSize: 20, fontWeight: 680, marginTop: 3 }
  return (
    <div style={panelCard}>
      {/* headline: pending → projected (job level) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={statLabel}>Pending exposure</div>
          <div style={{ ...statVal, color: pendColor(forecast.total.pending) }}>{signedMoney(forecast.total.pending)}</div>
        </div>
        <span aria-hidden style={{ fontSize: 16, color: 'var(--tx-faint)', paddingBottom: 3 }}>→</span>
        <div>
          <div style={statLabel}>Projected budget</div>
          <div style={statVal}>{formatMoney(forecast.total.projected)}</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx-faint)', paddingBottom: 4 }}>
          from {formatMoney(forecast.total.revised)} revised · {forecast.divisions.length} {forecast.divisions.length === 1 ? 'division' : 'divisions'} affected
        </div>
      </div>

      {/* per-division: revised → pending → projected */}
      <div style={{ border: '1px solid var(--bd-2)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: fGrid, gap: 12, padding: '8px 14px', background: 'var(--fill-1)', borderBottom: '1px solid var(--bd-2)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-faint)', fontWeight: 600 }}>
          <span>Division</span>
          <span style={{ textAlign: 'right' }}>Revised</span>
          <span style={{ textAlign: 'right' }}>Pending</span>
          <span style={{ textAlign: 'right' }}>Projected</span>
        </div>
        {forecast.divisions.map((d) => (
          <div key={d.division} style={{ display: 'grid', gridTemplateColumns: fGrid, gap: 12, padding: '8px 14px', borderBottom: '1px solid var(--bd-row)', alignItems: 'center' }}>
            <span style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontSize: 12.5, fontWeight: 530, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{divName(d.division)}</span>
              <span style={{ fontSize: 10, color: 'var(--tx-faint)', flex: 'none' }}>{d.openEvents} open</span>
            </span>
            <span style={{ ...numBase, color: 'var(--tx-secondary)' }}>{d.revised > 0 ? formatMoney(d.revised) : '—'}</span>
            <span style={{ ...numBase, color: pendColor(d.pending), fontWeight: 600 }}>{signedMoney(d.pending)}</span>
            <span style={{ ...numBase, color: 'var(--tx-primary)', fontWeight: 600 }}>{formatMoney(d.projected)}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--tx-faint)', lineHeight: 1.5 }}>
        Projected = revised budget + the cost of <span style={{ fontWeight: 600, color: 'var(--tx-tertiary)' }}>open</span> change events (not yet approved). Negative = a de-scope credit · “Unassigned” = changes with no cost code yet.
      </div>
    </div>
  )
}
