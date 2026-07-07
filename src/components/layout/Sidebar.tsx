import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { GROUPS, TOOLS } from '@/data/tools'
import { courtItems, myCourtCount, overdueTotal } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import type { ProjectScope } from '@/state/appState'
import { mono, projectMeta } from '@/theme/tokens'
import type { ToolKey } from '@/types'

const RAIL_W = 64
const FULL_W = 248

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

function navItemStyle(active: boolean, expanded: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    width: '100%',
    padding: expanded ? '7px 10px' : '7px 0',
    justifyContent: expanded ? 'flex-start' : 'center',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12.5,
    lineHeight: 1.2,
    fontFamily: 'inherit',
    textAlign: 'left',
    marginBottom: 1,
    position: 'relative',
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

/** Small accent dot shown top-right of a rail icon when it has open items. */
const railDot: CSSProperties = { position: 'absolute', top: 5, right: 11, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 2px var(--sidebar)' }

const iconBtn: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  border: '1px solid var(--bd-1)',
  background: '#fff',
  color: 'var(--tx-tertiary)',
  cursor: 'pointer',
  fontSize: 13,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  fontFamily: 'inherit',
}

/** A nav button (pinned or tool): icon/badge + label + count when expanded; icon + accent dot on the rail. */
function NavButton({ active, expanded, label, icon, count = 0, accentCount = false, onClick }: {
  active: boolean
  expanded: boolean
  label: string
  icon: ReactNode
  count?: number
  accentCount?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" title={expanded ? undefined : label} className={`sl-nav-item${active ? ' is-active' : ''}`} style={navItemStyle(active, expanded)} onClick={onClick}>
      {icon}
      {expanded && <span style={{ flex: 1, textAlign: 'left', fontWeight: label === 'Overview' || label === 'My Court' ? 600 : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
      {expanded && count > 0 && <span style={countBadge(accentCount)}>{count}</span>}
      {!expanded && count > 0 && <span style={railDot} />}
    </button>
  )
}

function ToolNavItem({ toolKey, expanded }: { toolKey: ToolKey; expanded: boolean }) {
  const { state, patch } = useApp()
  const { itemsByTool } = useSiteData()
  const active = state.tool === toolKey
  const meta = TOOLS[toolKey]
  const count = myCourtCount(itemsByTool, toolKey, state.project)
  const badge = (
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
  )
  return <NavButton active={active} expanded={expanded} label={meta.label} icon={badge} count={count} onClick={() => patch({ tool: toolKey })} />
}

export function Sidebar() {
  const { state, patch } = useApp()
  const { itemsByTool } = useSiteData()
  const { project, tool } = state
  const [peek, setPeek] = useState(false)

  const collapsed = state.sidebarCollapsed
  const expanded = !collapsed || peek // rail shows minimal chrome; expanded shows labels
  const homeCount = courtItems(itemsByTool, project).length
  const overdue = overdueTotal(itemsByTool, project)

  const toggle = () => {
    setPeek(false)
    patch((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }))
  }

  return (
    // Spacer reserves the rail/full width; when collapsed the panel floats (absolute)
    // so hover-peek slides it open OVER the content instead of reflowing the app.
    <div style={{ flex: 'none', width: collapsed ? RAIL_W : FULL_W, position: 'relative' }}>
      <div
        className="scry"
        onMouseEnter={() => { if (collapsed) setPeek(true) }}
        onMouseLeave={() => setPeek(false)}
        style={{
          position: collapsed ? 'absolute' : 'static',
          top: 0,
          left: 0,
          bottom: 0,
          width: expanded ? FULL_W : RAIL_W,
          height: '100%',
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--bd-1)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          zIndex: 40,
          boxShadow: collapsed && peek ? '8px 0 28px rgba(20,25,35,.14)' : 'none',
        }}
      >
        {/* brand + collapse control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: expanded ? '16px 16px 14px' : '16px 0 14px', justifyContent: expanded ? 'flex-start' : 'center' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2.5px solid var(--accent)' }} />
          </div>
          {expanded && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.3px' }}>Sitelines</span>
                <span style={{ fontSize: 10.5, color: 'var(--tx-tertiary-2)', whiteSpace: 'nowrap' }}>Ben Ostrander · PM</span>
              </div>
              <button type="button" className="sl-icon-btn" title={collapsed ? 'Pin sidebar open' : 'Collapse sidebar'} aria-label={collapsed ? 'Pin sidebar open' : 'Collapse sidebar'} onClick={toggle} style={iconBtn}>
                {collapsed ? '»' : '«'}
              </button>
            </>
          )}
        </div>

        {/* project scope — labels only make sense expanded */}
        {expanded && (
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
        )}

        {/* pinned: Overview + My Court */}
        <div style={{ padding: '2px 12px' }}>
          <NavButton
            active={tool === 'overview'}
            expanded={expanded}
            label="Overview"
            onClick={() => patch({ tool: 'overview' })}
            icon={
              <span style={{ width: 18, height: 18, borderRadius: 5, background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, border: '2px solid #fff' }} />
              </span>
            }
          />
          <NavButton
            active={tool === 'home'}
            expanded={expanded}
            label="My Court"
            count={homeCount}
            accentCount
            onClick={() => patch({ tool: 'home' })}
            icon={
              <span style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', border: '2px solid #fff' }} />
              </span>
            }
          />
        </div>

        {/* tool nav groups */}
        {GROUPS.map((g) => (
          <div key={g.label} style={{ padding: '10px 12px 2px' }}>
            {expanded && <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--tx-faint-2)', fontWeight: 600, padding: '0 4px 4px' }}>{g.label}</div>}
            {g.keys.map((k) => (
              <ToolNavItem key={k} toolKey={k} expanded={expanded} />
            ))}
          </div>
        ))}

        <div style={{ flex: 1 }} />

        {/* rail-mode expand control */}
        {!expanded && (
          <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center' }}>
            <button type="button" className="sl-icon-btn" title="Pin sidebar open" aria-label="Pin sidebar open" onClick={toggle} style={iconBtn}>»</button>
          </div>
        )}

        {/* overdue footer */}
        {expanded ? (
          <div style={{ margin: 12, padding: '11px 12px', borderRadius: 9, background: '#fff', border: '1px solid #e6e9ed', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px #e8590c22', flex: 'none' }} />
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                <span style={{ fontFamily: mono }}>{overdue}</span> overdue
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--tx-tertiary-2)' }}>across your projects</div>
            </div>
          </div>
        ) : (
          <div style={{ margin: '4px 0 14px', display: 'flex', justifyContent: 'center' }} title={`${overdue} overdue across your projects`}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px #e8590c22' }} />
          </div>
        )}
      </div>
    </div>
  )
}
