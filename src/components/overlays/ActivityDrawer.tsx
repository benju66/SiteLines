// Activity drawer (README "Overlays"): right drawer, 400px — reverse-chron
// feed of events (tone-colored dot + text + project tag + subline + relative
// time), filtered by the global project scope.

import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, tone as toneMap } from '@/theme/tokens'
import { ProjectTag } from '@/components/ui/primitives'
import { Backdrop } from './Backdrop'

export function ActivityDrawer() {
  const { state, patch } = useApp()
  const { activity } = useSiteData()
  if (!state.activity) return null

  const feed = state.project === 'all' ? activity : activity.filter((a) => a.project === state.project)
  const close = () => patch({ activity: false })

  return (
    <Backdrop onClose={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="scry"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100%',
          width: 400,
          maxWidth: '92vw',
          background: 'var(--card)',
          boxShadow: '-8px 0 40px rgba(20,25,35,.2)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--bd-2)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 680 }}>Activity</span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="sl-icon-btn"
            onClick={close}
            style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--bd-1)', background: '#fff', cursor: 'pointer', color: 'var(--tx-secondary-2)', fontSize: 15, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '8px 0' }}>
          {feed.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 11, padding: '12px 18px', borderBottom: '1px solid #f0f2f4' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: (toneMap[a.tone] ?? toneMap.muted).c, marginTop: 4, flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--tx-primary)' }}>{a.text}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                  <ProjectTag project={a.project} />
                  <span style={{ fontSize: 11, color: 'var(--tx-faint)' }}>{a.sub}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: mono, fontSize: 10, color: '#aab0b8' }}>{a.when}</span>
                </div>
              </div>
            </div>
          ))}
          {feed.length === 0 && (
            <div style={{ padding: 34, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>No recent activity in this scope.</div>
          )}
        </div>
      </div>
    </Backdrop>
  )
}
