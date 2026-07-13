// Shared shell for the four detail drawers (Record / Commitment / Change Event /
// Invoice). Owns the chrome they all share so it's built once, not four times: the
// right-anchored panel, a drag-to-resize handle on its left edge, a full-width
// toggle, and a Back button driven by the cross-link stack (state.drawerHistory).
// A drawer passes its identity (code + number), body, and optional sticky footer;
// width / full-width / history all live in AppState so they survive a cross-drawer
// swap (which unmounts one drawer and mounts another). Still a position:fixed sibling
// of the app card (via Backdrop) — the overlay guardrail is intact.

import { useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { backPatch, clampDrawerWidth, DRAWER_EDGE_GAP } from '@/lib/drawerNav'
import { useApp } from '@/state/AppContext'
import { mono } from '@/theme/tokens'
import { CodeBadge } from '@/components/ui/primitives'
import { Backdrop } from './Backdrop'

const iconBtn: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 7,
  border: '1px solid var(--bd-1)',
  background: '#fff',
  cursor: 'pointer',
  color: 'var(--tx-secondary-2)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
  padding: 0,
  flex: 'none',
}

/** Back chevron. */
function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

/** Maximize (full=false) / restore (full=true) — the standard diagonal expand/collapse. */
function ExpandIcon({ full }: { full: boolean }) {
  return full ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

export function DrawerShell({
  code,
  number,
  onClose,
  children,
  footer,
}: {
  code: string
  number: ReactNode
  onClose: () => void
  children: ReactNode
  /** Optional sticky footer (Record drawer's Respond / Forward / Resolve). */
  footer?: ReactNode
}) {
  const { state, patch } = useApp()
  const full = state.drawerFull
  const canBack = state.drawerHistory.length > 0
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; w: number } | null>(null)

  // Drag the left edge to resize. During the drag we write the width straight to the
  // panel node (no per-move re-render — same trick as the Budget column handle), then
  // commit the final width to AppState on release so it sticks across opens + swaps.
  const onResizeDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { x: e.clientX, w: panelRef.current?.offsetWidth ?? state.drawerWidth }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.classList.add('is-drag')
  }
  const onResizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || !panelRef.current) return
    // The panel is anchored right, so dragging left (clientX decreasing) widens it.
    const next = clampDrawerWidth(d.w + (d.x - e.clientX), window.innerWidth)
    panelRef.current.style.width = `${next}px`
  }
  const onResizeUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    e.currentTarget.classList.remove('is-drag')
    const w = panelRef.current?.offsetWidth
    if (w) patch({ drawerWidth: clampDrawerWidth(w, window.innerWidth) })
  }

  const width = full ? `calc(100vw - ${DRAWER_EDGE_GAP}px)` : `${state.drawerWidth}px`

  return (
    <Backdrop onClose={onClose}>
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="scry"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100%',
          width,
          maxWidth: `calc(100vw - ${DRAWER_EDGE_GAP}px)`,
          background: 'var(--card)',
          boxShadow: '-8px 0 40px rgba(20,25,35,.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* drag-to-resize handle (left edge); hidden in full-width mode */}
        {!full && (
          <div
            className="sl-drawer-rz"
            title="Drag to resize"
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            onPointerCancel={onResizeUp}
          />
        )}

        {/* header: [Back?] badge · number … [full-width] [close] */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px', borderBottom: '1px solid var(--bd-2)', background: '#fff', flex: 'none' }}>
          {canBack && (
            <button type="button" className="sl-icon-btn" title="Back" aria-label="Back" onClick={() => patch((s) => backPatch(s))} style={iconBtn}>
              <BackIcon />
            </button>
          )}
          <CodeBadge code={code} style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5 }} />
          <span style={{ fontFamily: mono, fontSize: 12.5, fontWeight: 650, color: 'var(--tx-secondary)' }}>{number}</span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="sl-icon-btn"
            title={full ? 'Restore width' : 'Expand to full width'}
            aria-label={full ? 'Restore width' : 'Expand to full width'}
            aria-pressed={full}
            onClick={() => patch({ drawerFull: !full })}
            style={iconBtn}
          >
            <ExpandIcon full={full} />
          </button>
          <button type="button" className="sl-icon-btn" title="Close" aria-label="Close" onClick={onClose} style={{ ...iconBtn, fontSize: 15 }}>
            ×
          </button>
        </div>

        {/* body */}
        <div className="scry" style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {children}
        </div>

        {footer}
      </div>
    </Backdrop>
  )
}
