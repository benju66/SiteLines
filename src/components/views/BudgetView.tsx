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
import { boughtOut, budgetByDivision, budgetTotals, financialView, scoped, sortedBudgetGroups } from '@/selectors'
import type { BudgetDivisionGroup, BudgetSort, BudgetSortCol } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, tone } from '@/theme/tokens'
import type { BudgetLine } from '@/types'

// Seven columns. Widths are resizable; these defaults are mirrored in the CSS-var
// fallback so rows render before the effect runs. `sort` = null → not sortable.
const COLS: { label: string; sort: BudgetSortCol | null }[] = [
  { label: 'Cost Code', sort: null },
  { label: 'Budget', sort: 'budget' },
  { label: 'Committed', sort: 'committed' },
  { label: '% Bought Out', sort: 'pct' },
  { label: 'Uncommitted', sort: 'uncommitted' },
  { label: 'Projected', sort: 'eac' },
  { label: 'Over / Under', sort: 'over' },
]
const DEFAULT_WIDTHS = [332, 116, 116, 112, 116, 116, 120]
const MIN_WIDTHS = [180, 72, 72, 72, 72, 72, 72]
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
  const { financials, budgetLines } = useSiteData()

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
            <span>Projected = estimated cost at completion (EAC)</span>
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
      <Money v={line.eac} />
      <Money v={line.projectedOverUnder} over />
    </div>
  )
}
