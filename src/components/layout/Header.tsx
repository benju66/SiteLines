import type { CSSProperties } from 'react'
import { TOOLS } from '@/data/tools'
import { timeAgo } from '@/lib/derive'
import { headerMeta } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useData, useSiteData } from '@/state/DataContext'
import type { SavedView, TypeFilter } from '@/state/appState'
import { mono, projectMeta } from '@/theme/tokens'
import { Chip } from '@/components/ui/Chip'

const TYPE_CHIPS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'rfi', label: 'RFIs' },
  { key: 'submittal', label: 'Submittals' },
  { key: 'co', label: 'Change Orders' },
  { key: 'punch', label: 'Punch' },
]

const SAVED_VIEWS: { key: SavedView; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'week', label: 'Due this week' },
  { key: 'mine', label: 'In my court' },
  { key: 'others', label: 'Waiting on others' },
]

const segBase: CSSProperties = {
  fontSize: 11.5,
  padding: '5px 12px',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
  border: 'none',
}
const segOn: CSSProperties = { ...segBase, fontWeight: 600, background: '#fff', color: 'var(--tx-primary)', boxShadow: '0 1px 2px rgba(20,25,35,.08)' }
const segOff: CSSProperties = { ...segBase, fontWeight: 550, background: 'transparent', color: 'var(--tx-secondary-2)' }

function ScopeTag() {
  const { state } = useApp()
  if (state.project === 'all') {
    return <span style={{ fontSize: 11, color: 'var(--tx-tertiary-2)', background: 'var(--fill-3)', border: '1px solid var(--bd-1)', padding: '2px 8px', borderRadius: 5 }}>All Projects</span>
  }
  const p = projectMeta[state.project]
  return <span style={{ fontSize: 11, fontWeight: 600, color: p.color, background: p.bg, border: `1px solid ${p.color}33`, padding: '2px 8px', borderRadius: 5 }}>{p.full}</span>
}

/** "Synced Xm ago" + manual refresh (DATA_CONTRACT §8 staleness indicator). */
function SyncStatus() {
  const { syncedAt, refresh } = useData()
  if (!syncedAt) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      <span title={syncedAt.toLocaleString()} style={{ fontFamily: mono, fontSize: 10, color: 'var(--tx-faint-2)', whiteSpace: 'nowrap' }}>
        synced {timeAgo(syncedAt, new Date())}
      </span>
      <button
        type="button"
        className="sl-icon-btn"
        title="Refresh data"
        onClick={refresh}
        style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--bd-1)', background: '#fff', cursor: 'pointer', color: 'var(--tx-secondary-2)', fontSize: 13, lineHeight: 1 }}
      >
        ⟳
      </button>
    </div>
  )
}

export function Header() {
  const { state, patch } = useApp()
  const data = useSiteData()
  const { activity } = data
  const meta = TOOLS[state.tool]
  const { isHome, count, showToggle, showViews, showControls } = headerMeta(data, state)

  return (
    <div style={{ padding: '16px 22px 14px', borderBottom: '1px solid var(--bd-2)', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: '-.4px' }}>{meta.label}</h1>
            {count && <span style={{ fontSize: 12.5, color: 'var(--tx-tertiary-2)' }}>{count}</span>}
            <ScopeTag />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--tx-tertiary)' }}>{meta.desc}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>
          <SyncStatus />
          <button
            type="button"
            className="sl-search-btn"
            onClick={() => patch({ palette: true, query: '' })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--fill-1)', border: '1px solid var(--bd-1)', borderRadius: 8, padding: '6px 9px 6px 10px', cursor: 'pointer', color: 'var(--tx-tertiary-2)', fontSize: 12, minWidth: 186 }}
          >
            <span style={{ width: 11, height: 11, borderRadius: '50%', border: '1.6px solid var(--tx-faint-2)', flex: 'none' }} />
            <span style={{ flex: 1, textAlign: 'left' }}>Search…</span>
            <span style={{ fontFamily: mono, fontSize: 10, background: '#fff', border: '1px solid #dfe3e8', borderRadius: 4, padding: '1px 5px', color: 'var(--tx-tertiary-2)' }}>⌘K</span>
          </button>
          <button
            type="button"
            className="sl-activity-btn"
            onClick={() => patch({ activity: true })}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', color: 'var(--tx-secondary)', fontSize: 12, fontWeight: 550 }}
          >
            Activity
            <span style={{ background: 'var(--accent)', color: '#fff', fontFamily: mono, fontSize: 9.5, fontWeight: 700, borderRadius: 20, padding: '1px 5px' }}>{activity.length}</span>
          </button>
        </div>
      </div>

      {showControls && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          {isHome && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--tx-faint-2)', marginRight: 2 }}>Type</span>
              {TYPE_CHIPS.map((c) => (
                <Chip key={c.key} label={c.label} active={state.type === c.key} onClick={() => patch({ type: c.key })} />
              ))}
            </div>
          )}
          {showViews && (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--bd-2)' }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--tx-faint-2)', marginRight: 2 }}>Views</span>
                {SAVED_VIEWS.map((v) => (
                  <Chip key={v.key} label={v.label} active={state.savedView === v.key} activeColor="#3c434c" onClick={() => patch({ savedView: v.key })} />
                ))}
              </div>
            </>
          )}
          <div style={{ flex: 1 }} />
          {showToggle && (
            <div style={{ display: 'flex', background: 'var(--fill-3)', border: '1px solid #e0e3e8', borderRadius: 8, padding: 2, flex: 'none' }}>
              <button type="button" style={state.court === 'court' ? segOn : segOff} onClick={() => patch({ court: 'court' })}>In My Court</button>
              <button type="button" style={state.court === 'all' ? segOn : segOff} onClick={() => patch({ court: 'all' })}>All</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
