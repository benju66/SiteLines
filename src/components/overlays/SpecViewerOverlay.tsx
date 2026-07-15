// Spec-section PDF viewer (Specifications Phase 3). A large overlay — a position:fixed
// sibling of the app card (mounted in App.tsx's overlay slot, per the overlay guardrail)
// — that renders the spec section's current-revision PDF IN THE APP, no download.
//
// The synced Procore file URL expires and the browser can't embed it (attachment header
// + no CORS), so we fetch the bytes through the `spec-file` edge function (getSpecFile →
// Blob), wrap them in an object URL, and point an <iframe> at it. Backdrop/× closes,
// Esc closes everything. On any failure (offline seed, no PDF, read error → null) it
// degrades to an "Open in Procore" fallback. Cloned from SubmittalViewerOverlay.

import { useEffect, useState } from 'react'
import { useApp } from '@/state/AppContext'
import { useData } from '@/state/DataContext'
import { Backdrop } from './Backdrop'

type Viewer = NonNullable<ReturnType<typeof useApp>['state']['specViewer']>

export function SpecViewerOverlay() {
  const { state, patch } = useApp()
  const v = state.specViewer
  if (!v) return null
  // Keyed by revisionId so the fetch/object-URL state resets on open/swap.
  return <ViewerPanel key={v.revisionId} viewer={v} onClose={() => patch({ specViewer: null })} />
}

type Load = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error' }

function ViewerPanel({ viewer, onClose }: { viewer: Viewer; onClose: () => void }) {
  const { getSpecFile } = useData()
  const [load, setLoad] = useState<Load>({ status: 'loading' })

  // Fetch the PDF bytes once (component is keyed by revisionId), build an object URL for
  // the iframe, and revoke it on unmount. Force the PDF MIME so the browser renders it
  // inline even if the source content-type is generic.
  useEffect(() => {
    let alive = true
    let objectUrl: string | null = null
    setLoad({ status: 'loading' })
    getSpecFile(viewer.revisionId)
      .then((blob) => {
        if (!alive) return
        if (!blob) {
          setLoad({ status: 'error' })
          return
        }
        const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
        objectUrl = URL.createObjectURL(pdf)
        setLoad({ status: 'ready', url: objectUrl })
      })
      .catch(() => alive && setLoad({ status: 'error' }))
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [viewer.revisionId, getSpecFile])

  return (
    <Backdrop onClose={onClose} zIndex={60} background="rgba(20,25,35,.55)">
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(1100px, 94vw)',
          height: '92vh',
          background: 'var(--card)',
          border: '1px solid var(--bd-card)',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(20,25,35,.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--bd-2)', background: '#fff', flex: 'none', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-faint)', fontWeight: 700 }}>Specification section</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx-primary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={viewer.title}>
              {viewer.title}
            </div>
          </div>

          {load.status === 'ready' && (
            <a href={load.url} download={`${viewer.title}.pdf`} target="_blank" rel="noopener noreferrer" className="sl-linked-row" style={linkBtn}>
              Download <span aria-hidden style={{ fontSize: 10 }}>↓</span>
            </a>
          )}
          {viewer.procoreUrl && (
            <a href={viewer.procoreUrl} target="_blank" rel="noopener noreferrer" className="sl-linked-row" style={linkBtn}>
              Open in Procore <span aria-hidden style={{ fontSize: 10 }}>↗</span>
            </a>
          )}
          <button type="button" className="sl-icon-btn" onClick={onClose} title="Close" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--bd-1)', background: '#fff', cursor: 'pointer', color: 'var(--tx-secondary-2)', fontSize: 16, lineHeight: 1, flex: 'none' }}>
            ×
          </button>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflow: 'hidden', background: 'var(--app-bg)', position: 'relative' }}>
          {load.status === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--tx-tertiary)', fontSize: 13 }}>
              <div className="sl-spin" style={{ width: 26, height: 26, borderRadius: '50%', border: '2.5px solid var(--bd-1)', borderTopColor: 'var(--tx-tertiary)' }} />
              <div>Loading the spec PDF…</div>
            </div>
          )}
          {load.status === 'ready' && (
            <iframe
              src={load.url}
              title={viewer.title}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          )}
          {load.status === 'error' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--tx-tertiary)', fontSize: 13, padding: 24 }}>
              <div style={{ fontWeight: 600, color: 'var(--tx-secondary)' }}>Couldn’t load this PDF</div>
              <div style={{ marginTop: 6, maxWidth: 340 }}>The document couldn’t be fetched here. Open it directly instead:</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {viewer.procoreUrl && (
                  <a href={viewer.procoreUrl} target="_blank" rel="noopener noreferrer" className="sl-linked-row" style={linkBtn}>
                    Open in Procore <span aria-hidden style={{ fontSize: 10 }}>↗</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Backdrop>
  )
}

const linkBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--tx-secondary-2)',
  background: '#fff',
  border: '1px solid var(--bd-1)',
  borderRadius: 8,
  padding: '7px 11px',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  flex: 'none',
} as const
