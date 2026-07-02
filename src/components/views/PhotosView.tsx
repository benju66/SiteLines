// Photos (README §4) — jobsite documentation gallery. Striped CSS placeholders
// stand in for Procore thumbnails; the In My Court toggle filters to Ben's
// flagged photos.

import { mediaInScope } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, projectMeta } from '@/theme/tokens'

export function PhotosView() {
  const { state } = useApp()
  const { photos } = useSiteData()
  const rows = mediaInScope(photos, state)

  return (
    <div style={{ padding: '20px 22px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {rows.map((p) => (
          <div key={`${p.project}:${p.caption}`} style={{ border: '1px solid var(--bd-2)', borderRadius: 9, overflow: 'hidden', background: '#fff' }}>
            <div
              style={{
                position: 'relative',
                height: 118,
                background: 'repeating-linear-gradient(45deg,#e9ecef,#e9ecef 9px,#eef1f4 9px,#eef1f4 18px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontFamily: mono, fontSize: 10, color: '#aab0b8', letterSpacing: '.5px' }}>JOBSITE PHOTO</span>
              <span
                style={{
                  position: 'absolute',
                  bottom: 8,
                  left: 8,
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#fff',
                  background: `${projectMeta[p.project].color}dd`,
                  padding: '2px 7px',
                  borderRadius: 5,
                }}
              >
                {projectMeta[p.project].short}
              </span>
              {p.mine && (
                <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 8.5, fontWeight: 700, letterSpacing: '.4px', background: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>
                  FLAGGED
                </span>
              )}
            </div>
            <div style={{ padding: '9px 11px' }}>
              <div style={{ fontSize: 12, fontWeight: 550, lineHeight: 1.3 }}>{p.caption}</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--tx-faint)', marginTop: 3 }}>{p.date}</div>
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 && (
        <div style={{ padding: 52, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>
          No flagged photos. Toggle to <b style={{ color: 'var(--tx-secondary-2)' }}>All</b> to browse the album.
        </div>
      )}
    </div>
  )
}
