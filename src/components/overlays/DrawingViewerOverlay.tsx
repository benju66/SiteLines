// Drawing sheet viewer (Drawings Phase 2). A large overlay — a position:fixed
// sibling of the app card (mounted in App.tsx's overlay slot, per the overlay
// guardrail) — that renders a sheet IN THE APP as a zoomable/pannable image, no
// download. A revision dropdown (loaded lazily via the data provider, keyed by
// drawingId) flips between historical issues; "Open PDF" / "Open in Procore"
// stay as secondary link-outs. Image load failure (a stale signed URL) degrades
// to an "Open in Procore" fallback. v1 renders the PNG (embeds cross-origin with
// no proxy); a backend proxy that kills URL expiry is the gated Phase 3.

import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { sortRevisionsDesc } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useData } from '@/state/DataContext'
import { mono } from '@/theme/tokens'
import type { Drawing, DrawingRevision } from '@/types'
import { Backdrop } from './Backdrop'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const MAX_ZOOM = 8

export function DrawingViewerOverlay() {
  const { state, patch } = useApp()
  const drawing = state.viewer
  if (!drawing) return null
  // Keyed by sheet id so every state (revisions, zoom/pan) resets on open/swap.
  return <ViewerPanel key={drawing.id} drawing={drawing} onClose={() => patch({ viewer: null })} />
}

type Transform = { zoom: number; x: number; y: number }

function ViewerPanel({ drawing, onClose }: { drawing: Drawing; onClose: () => void }) {
  const { getDrawingRevisions } = useData()
  const [revisions, setRevisions] = useState<DrawingRevision[] | null>(null) // null = still loading
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [t, setT] = useState<Transform>({ zoom: 1, x: 0, y: 0 })
  const [imgError, setImgError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mx: number; my: number; x: number; y: number } | null>(null)

  // Load this sheet's revisions once (component is keyed by drawing.id).
  useEffect(() => {
    let alive = true
    getDrawingRevisions(drawing.drawingId)
      .then((revs) => {
        if (!alive) return
        const ordered = sortRevisionsDesc(revs)
        setRevisions(ordered)
        const cur = ordered.find((r) => r.current) ?? ordered[0] ?? null
        setSelectedId(cur ? cur.id : null)
      })
      .catch(() => alive && setRevisions([]))
    return () => {
      alive = false
    }
  }, [drawing.drawingId, getDrawingRevisions])

  // Always have at least the current sheet from the log row, so the viewer shows
  // immediately (and survives a revisions fetch that errors or returns nothing).
  const pseudo: DrawingRevision = {
    id: drawing.id,
    revision: drawing.revision,
    drawingDate: drawing.drawingDate,
    current: true,
    pngUrl: drawing.pngUrl,
    pdfUrl: drawing.pdfUrl,
    procoreUrl: null,
  }
  const list = revisions && revisions.length > 0 ? revisions : [pseudo]
  const selected: DrawingRevision = list.find((r) => r.id === selectedId) ?? list[0] ?? pseudo

  // Reset view + image-error whenever the shown revision changes.
  useEffect(() => {
    setT({ zoom: 1, x: 0, y: 0 })
    setImgError(false)
  }, [selected.id])

  // Cursor-anchored wheel zoom. Native, non-passive so preventDefault sticks
  // (React's onWheel is passive). Pure functional update — StrictMode-safe.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setT((p) => {
        const nz = clamp(p.zoom * factor, 1, MAX_ZOOM)
        const ratio = nz / p.zoom
        // At fit (zoom back to 1) recentre so the sheet can't drift off-screen.
        if (nz === 1) return { zoom: 1, x: 0, y: 0 }
        return { zoom: nz, x: cx - ratio * (cx - p.x), y: cy - ratio * (cy - p.y) }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onMouseDown = (e: ReactMouseEvent) => {
    if (t.zoom <= 1) return
    drag.current = { mx: e.clientX, my: e.clientY, x: t.x, y: t.y }
  }
  const onMouseMove = (e: ReactMouseEvent) => {
    const d = drag.current
    if (!d) return
    setT((p) => ({ zoom: p.zoom, x: d.x + (e.clientX - d.mx), y: d.y + (e.clientY - d.my) }))
  }
  const endDrag = () => {
    drag.current = null
  }

  const zoomBy = (factor: number) =>
    setT((p) => {
      const nz = clamp(p.zoom * factor, 1, MAX_ZOOM)
      return nz === 1 ? { zoom: 1, x: 0, y: 0 } : { zoom: nz, x: p.x, y: p.y }
    })
  const resetView = () => setT({ zoom: 1, x: 0, y: 0 })

  const revLabel = (r: DrawingRevision) =>
    `Rev ${r.revision}${r.drawingDate ? ` · ${r.drawingDate}` : ''}${r.current ? ' · current' : ''}`

  return (
    <Backdrop onClose={onClose} background="rgba(20,25,35,.55)">
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(1200px, 94vw)',
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
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: 'var(--tx-primary)' }}>{drawing.number}</span>
              <span style={{ fontSize: 13.5, fontWeight: 560, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{drawing.title}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {drawing.discipline}
              {drawing.set ? ` · ${drawing.set}` : ''}
            </div>
          </div>

          {/* revision picker */}
          {list.length > 1 ? (
            <select
              value={selected.id}
              onChange={(e) => setSelectedId(e.target.value)}
              title="Revision"
              style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 550, color: 'var(--tx-secondary)', background: 'var(--fill-1)', border: '1px solid var(--bd-1)', borderRadius: 8, padding: '7px 9px', cursor: 'pointer', maxWidth: 260 }}
            >
              {list.map((r) => (
                <option key={r.id} value={r.id}>
                  {revLabel(r)}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 550, color: 'var(--tx-tertiary)', background: 'var(--fill-1)', border: '1px solid var(--bd-1)', borderRadius: 8, padding: '7px 9px' }}>
              {revLabel(selected)}
            </span>
          )}

          {/* zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--fill-3)', border: '1px solid var(--bd-1)', borderRadius: 8, padding: 2 }}>
            <ZoomBtn label="−" title="Zoom out" onClick={() => zoomBy(1 / 1.3)} />
            <button type="button" onClick={resetView} title="Fit to screen" style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: 'var(--tx-secondary-2)', background: 'none', border: 'none', cursor: 'pointer', minWidth: 44, padding: '4px 2px' }}>
              {Math.round(t.zoom * 100)}%
            </button>
            <ZoomBtn label="+" title="Zoom in" onClick={() => zoomBy(1.3)} />
          </div>

          {selected.pdfUrl && (
            <a href={selected.pdfUrl} target="_blank" rel="noopener noreferrer" className="sl-linked-row" style={linkBtn}>
              Open PDF <span aria-hidden style={{ fontSize: 10 }}>↗</span>
            </a>
          )}
          {selected.procoreUrl && (
            <a href={selected.procoreUrl} target="_blank" rel="noopener noreferrer" className="sl-linked-row" style={linkBtn}>
              Open in Procore <span aria-hidden style={{ fontSize: 10 }}>↗</span>
            </a>
          )}
          <button type="button" className="sl-icon-btn" onClick={onClose} title="Close" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--bd-1)', background: '#fff', cursor: 'pointer', color: 'var(--tx-secondary-2)', fontSize: 16, lineHeight: 1, flex: 'none' }}>
            ×
          </button>
        </div>

        {/* canvas */}
        <div
          ref={containerRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onDoubleClick={resetView}
          style={{
            flex: 1,
            overflow: 'hidden',
            background: 'var(--app-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: t.zoom > 1 ? (drag.current ? 'grabbing' : 'grab') : 'default',
          }}
        >
          {selected.pngUrl && !imgError ? (
            <img
              src={selected.pngUrl}
              alt={`${drawing.number} — ${drawing.title}`}
              draggable={false}
              onError={() => setImgError(true)}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: `translate(${t.x}px, ${t.y}px) scale(${t.zoom})`,
                transformOrigin: 'center center',
                userSelect: 'none',
                willChange: 'transform',
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--tx-tertiary)', fontSize: 13, padding: 24 }}>
              <div style={{ fontWeight: 600, color: 'var(--tx-secondary)' }}>Couldn’t load this sheet</div>
              <div style={{ marginTop: 6, maxWidth: 320 }}>The image link may have expired. Open it directly instead:</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {selected.procoreUrl && (
                  <a href={selected.procoreUrl} target="_blank" rel="noopener noreferrer" className="sl-linked-row" style={linkBtn}>
                    Open in Procore <span aria-hidden style={{ fontSize: 10 }}>↗</span>
                  </a>
                )}
                {selected.pdfUrl && (
                  <a href={selected.pdfUrl} target="_blank" rel="noopener noreferrer" className="sl-linked-row" style={linkBtn}>
                    Open PDF <span aria-hidden style={{ fontSize: 10 }}>↗</span>
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

function ZoomBtn({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: '#fff', cursor: 'pointer', color: 'var(--tx-secondary-2)', fontSize: 15, lineHeight: 1, boxShadow: '0 1px 1px rgba(20,25,35,.06)' }}
    >
      {label}
    </button>
  )
}
