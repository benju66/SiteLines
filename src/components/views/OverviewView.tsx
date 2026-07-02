// Overview (README §7) — portfolio health. Explicitly a PLACEHOLDER: the blue
// banner states metrics populate live from Procore; sample data locks the
// layout, and the trend charts are intentionally not built.

import { overviewStats, projectCardStats } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, projectMeta, projectPct } from '@/theme/tokens'
import type { Project } from '@/types'

const CHART_SLOTS = [
  { title: 'RFI & submittal aging', hint: 'RESPONSE-TIME CHART', full: false },
  { title: 'Ball-in-court over time', hint: 'YOURS vs. OTHERS TREND', full: false },
  { title: 'Budget · committed · invoiced', hint: 'STACKED BAR BY PROJECT', full: true },
]

function MiniStat({ value, label, danger, tinted }: { value: number; label: string; danger?: boolean; tinted?: boolean }) {
  return (
    <div style={{ flex: 1, background: tinted ? '#fdf0ea' : 'var(--fill-2)', borderRadius: 8, padding: '10px 11px' }}>
      <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 680, color: danger ? '#b23c0e' : 'var(--tx-primary)' }}>{value}</div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--tx-tertiary-2)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const { itemsByTool } = useSiteData()
  const p = projectMeta[project]
  const pct = projectPct[project]
  const { openRfis, submittals, overdue } = projectCardStats(itemsByTool, project)

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 10, padding: '16px 17px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flex: 'none' }} />
        <span style={{ fontSize: 15, fontWeight: 680, letterSpacing: '-.2px' }}>{p.full}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: mono, fontSize: 12.5, fontWeight: 650, color: p.color }}>{pct}%</span>
      </div>
      <div style={{ height: 7, background: 'var(--fill-3)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 99 }} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
        <MiniStat value={openRfis} label="Open RFIs" />
        <MiniStat value={submittals} label="Submittals" />
        <MiniStat value={overdue} label="Overdue" danger={overdue > 0} tinted />
      </div>
    </div>
  )
}

export function OverviewView() {
  const { state } = useApp()
  const { itemsByTool } = useSiteData()
  const s = overviewStats(itemsByTool, state.project)
  const kpis = [
    { label: 'Open Items', value: s.open, color: 'var(--tx-primary)' },
    { label: 'Overdue', value: s.over, color: '#b23c0e' },
    { label: 'In Your Court', value: s.mine, color: 'var(--accent)' },
    { label: 'Due This Week', value: s.week, color: '#8a6300' },
  ]
  const projects: Project[] = state.project === 'all' ? ['mckenna', 'opiii'] : [state.project]

  return (
    <div style={{ padding: '18px 22px 26px' }}>
      {/* placeholder banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#eaf1f8', border: '1px solid #c3d5e8', borderRadius: 9, padding: '10px 13px', marginBottom: 18 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2f5f8a', flex: 'none' }} />
        <span style={{ fontSize: 12, color: '#2f5f8a', lineHeight: 1.4 }}>
          <b>Placeholder dashboard.</b> Portfolio metrics populate live once connected to the Procore API — figures below use sample data to lock the layout.
        </span>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 9, padding: '14px 15px' }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-tertiary-2)', fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 680, marginTop: 6, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* per-project cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
        {projects.map((p) => (
          <ProjectCard key={p} project={p} />
        ))}
      </div>

      {/* chart placeholders — intentionally not built */}
      <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--tx-faint-2)', fontWeight: 600, margin: '22px 0 10px' }}>
        Trends · from Procore
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {CHART_SLOTS.map((c) => (
          <div key={c.title} style={{ background: '#fff', border: '1px solid var(--bd-2)', borderRadius: 10, padding: 15, ...(c.full ? { gridColumn: '1 / -1' } : {}) }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{c.title}</div>
            <div
              style={{
                height: 150,
                borderRadius: 8,
                background: 'repeating-linear-gradient(-45deg,#eef1f4,#eef1f4 10px,#f5f7f9 10px,#f5f7f9 20px)',
                border: '1px dashed #d7dce1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontFamily: mono, fontSize: 10.5, color: '#aab0b8', letterSpacing: '.5px' }}>{c.hint}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
