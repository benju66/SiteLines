// Financial views (README §3) — Prime Contract & Budget: six KPI cards, then a
// by-division table with a bold total row. Values re-aggregate with project
// scope (single project vs. summed). No toggle, no view chips.

import { financialView } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono } from '@/theme/tokens'

const TABLE_GRID = 'minmax(0,1fr) 130px 130px 130px'

export function FinancialView() {
  const { state } = useApp()
  const { financials } = useSiteData()
  const tool = state.tool === 'budget' ? 'budget' : 'primeContract'
  const v = financialView(financials, tool, state.project)

  return (
    <div style={{ padding: '20px 22px' }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {v.kpis.map((k) => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, padding: '14px 15px' }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary-2)', fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 680, marginTop: 6, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* division table */}
      <div style={{ marginTop: 18, background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: TABLE_GRID,
            gap: 12,
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
          <span>{v.head[0]}</span>
          <span style={{ textAlign: 'right' }}>{v.head[1]}</span>
          <span style={{ textAlign: 'right' }}>{v.head[2]}</span>
          <span style={{ textAlign: 'right' }}>{v.head[3]}</span>
        </div>
        {v.rows.map((r) => (
          <div key={r.name} style={{ display: 'grid', gridTemplateColumns: TABLE_GRID, gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--bd-row)', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 530 }}>{r.name}</span>
            <span style={{ textAlign: 'right', fontFamily: mono, fontSize: 12, color: 'var(--tx-secondary)' }}>{r.c1}</span>
            <span style={{ textAlign: 'right', fontFamily: mono, fontSize: 12, color: 'var(--tx-secondary)' }}>{r.c2}</span>
            <span style={{ textAlign: 'right', fontFamily: mono, fontSize: 12, color: r.c3Negative ? '#b23c0e' : 'var(--tx-secondary)' }}>{r.c3}</span>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: TABLE_GRID, gap: 12, padding: '11px 16px', background: '#f9fafb', alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Total</span>
          <span style={{ textAlign: 'right', fontFamily: mono, fontSize: 12.5, fontWeight: 700 }}>{v.total.c1}</span>
          <span style={{ textAlign: 'right', fontFamily: mono, fontSize: 12.5, fontWeight: 700 }}>{v.total.c2}</span>
          <span style={{ textAlign: 'right', fontFamily: mono, fontSize: 12.5, fontWeight: 700 }}>{v.total.c3}</span>
        </div>
      </div>
    </div>
  )
}
