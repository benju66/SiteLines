import type { CSSProperties } from 'react'
import { GROUPS, TOOLS } from '@/data/tools'
import { courtItems, myCourtCount, overdueTotal } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import type { ProjectScope } from '@/state/appState'
import { mono, projectMeta } from '@/theme/tokens'
import type { ToolKey } from '@/types'

const SCOPES: { key: ProjectScope; label: string }[] = [
  { key: 'all', label: 'All Projects' },
  { key: 'mckenna', label: 'McKenna Crossing' },
  { key: 'opiii', label: 'OP_III' },
]

function scopeSwatch(scope: ProjectScope) {
  if (scope === 'all') {
    return <span style={{ width: 8, height: 8, borderRadius: 2, background: 'linear-gradient(135deg,#2f5f8a 50%,#2f7d76 50%)', flex: 'none' }} />
  }
  return <span style={{ width: 8, height: 8, borderRadius: 2, background: projectMeta[scope].color, flex: 'none' }} />
}

function navItemStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    width: '100%',
    padding: '7px 10px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12.5,
    lineHeight: 1.2,
    fontFamily: 'inherit',
    textAlign: 'left',
    marginBottom: 1,
    // Keep `border` a single property (no shorthand + borderColor mix) — React
    // warns when a conflicting shorthand is removed on rerender.
    ...(active
      ? { background: '#fff', color: 'var(--tx-primary)', fontWeight: 600, border: '1px solid var(--bd-1)', boxShadow: '0 1px 2px rgba(20,25,35,.05)' }
      : { background: 'transparent', color: '#525963', border: '1px solid transparent' }),
  }
}

function countBadge(accent: boolean): CSSProperties {
  return {
    fontFamily: mono,
    fontSize: 10,
    fontWeight: 700,
    minWidth: 18,
    textAlign: 'center',
    padding: '1px 5px',
    borderRadius: 20,
    flex: 'none',
    ...(accent ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--bd-2)', color: 'var(--tx-secondary-2)' }),
  }
}

function ToolNavItem({ toolKey }: { toolKey: ToolKey }) {
  const { state, patch } = useApp()
  const { itemsByTool } = useSiteData()
  const active = state.tool === toolKey
  const meta = TOOLS[toolKey]
  const count = myCourtCount(itemsByTool, toolKey, state.project)
  return (
    <button type="button" className={`sl-nav-item${active ? ' is-active' : ''}`} style={navItemStyle(active)} onClick={() => patch({ tool: toolKey })}>
      <span
        style={{
          fontFamily: mono,
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: '.2px',
          color: active ? '#2f5f8a' : 'var(--tx-tertiary-2)',
          background: active ? '#eaf1f8' : '#e9ebee',
          borderRadius: 4,
          width: 34,
          textAlign: 'center',
          padding: '3px 0',
          flex: 'none',
        }}
      >
        {meta.code}
      </span>
      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.label}</span>
      {count > 0 && <span style={countBadge(false)}>{count}</span>}
    </button>
  )
}

export function Sidebar() {
  const { state, patch } = useApp()
  const { itemsByTool } = useSiteData()
  const { project, tool } = state
  const homeCount = courtItems(itemsByTool, project).length
  const overdue = overdueTotal(itemsByTool, project)

  return (
    <div className="scry" style={{ width: 248, flex: 'none', background: 'var(--sidebar)', borderRight: '1px solid var(--bd-1)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 14px' }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2.5px solid var(--accent)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.3px' }}>Sitelines</span>
          <span style={{ fontSize: 10.5, color: 'var(--tx-tertiary-2)' }}>Ben Ostrander · PM</span>
        </div>
      </div>

      {/* project scope */}
      <div style={{ padding: '2px 12px 10px' }}>
        <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--tx-faint-2)', fontWeight: 600, padding: '0 4px 6px' }}>Project</div>
        {SCOPES.map((s) => {
          const active = project === s.key
          return (
            <button
              key={s.key}
              type="button"
              className={`sl-scope-btn${active ? ' is-active' : ''}`}
              onClick={() => patch({ project: s.key })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                justifyContent: 'flex-start',
                fontSize: 12,
                fontWeight: 550,
                padding: '7px 10px',
                borderRadius: 7,
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginBottom: 4,
                ...(active
                  ? { background: '#3c434c', color: '#fff', border: '1px solid #3c434c' }
                  : { background: '#fff', color: 'var(--tx-secondary)', border: '1px solid var(--bd-3)' }),
              }}
            >
              {scopeSwatch(s.key)}
              <span style={{ flex: 1, textAlign: 'left' }}>{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* pinned: Overview + My Court */}
      <div style={{ padding: '2px 12px' }}>
        <button type="button" className={`sl-nav-item${tool === 'overview' ? ' is-active' : ''}`} style={navItemStyle(tool === 'overview')} onClick={() => patch({ tool: 'overview' })}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, border: '2px solid #fff' }} />
          </span>
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>Overview</span>
        </button>
        <button type="button" className={`sl-nav-item${tool === 'home' ? ' is-active' : ''}`} style={navItemStyle(tool === 'home')} onClick={() => patch({ tool: 'home' })}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', border: '2px solid #fff' }} />
          </span>
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>My Court</span>
          {homeCount > 0 && <span style={countBadge(true)}>{homeCount}</span>}
        </button>
      </div>

      {/* tool nav groups */}
      {GROUPS.map((g) => (
        <div key={g.label} style={{ padding: '10px 12px 2px' }}>
          <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--tx-faint-2)', fontWeight: 600, padding: '0 4px 4px' }}>{g.label}</div>
          {g.keys.map((k) => (
            <ToolNavItem key={k} toolKey={k} />
          ))}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {/* overdue footer */}
      <div style={{ margin: 12, padding: '11px 12px', borderRadius: 9, background: '#fff', border: '1px solid #e6e9ed', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px #e8590c22', flex: 'none' }} />
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
            <span style={{ fontFamily: mono }}>{overdue}</span> overdue
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--tx-tertiary-2)' }}>across your projects</div>
        </div>
      </div>
    </div>
  )
}
