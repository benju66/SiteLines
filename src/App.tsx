import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '@/state/AppContext'
import { useData } from '@/state/DataContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MainContent } from '@/components/layout/MainContent'
import { ActivityDrawer } from '@/components/overlays/ActivityDrawer'
import { CommandPalette } from '@/components/overlays/CommandPalette'
import { CommitmentDrawer } from '@/components/overlays/CommitmentDrawer'
import { DrawingViewerOverlay } from '@/components/overlays/DrawingViewerOverlay'
import { RecordDetailDrawer } from '@/components/overlays/RecordDetailDrawer'

/**
 * Global keyboard shortcuts (README "Interactions"):
 * ⌘K / Ctrl+K toggles the command palette (clearing the query); Esc closes all
 * overlays.
 */
function useGlobalKeys() {
  const { patch } = useApp()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        patch((s) => ({ palette: !s.palette, query: '' }))
      } else if (e.key === 'Escape') {
        patch({ palette: false, detail: null, commitment: null, activity: false, viewer: null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [patch])
}

/** The outer full-viewport card frame (shared by the ready UI and the state screens). */
function CardFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ height: '100vh', padding: 16, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--card)',
          border: '1px solid var(--bd-card)',
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(20,25,35,.05), 0 12px 40px rgba(20,25,35,.08)',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Centered brand mark + message, used by the loading and error screens. */
function StatePanel({ children }: { children: ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#1a1d21', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2.5px solid var(--accent)' }} />
      </div>
      {children}
    </div>
  )
}

export function App() {
  useGlobalKeys()
  const { status, error, refresh } = useData()

  // Data-lifecycle gate (DATA_CONTRACT §8): the main UI only mounts once a
  // snapshot is loaded, so everything below it can assume non-null data.
  if (status === 'loading') {
    return (
      <CardFrame>
        <StatePanel>
          <div style={{ fontSize: 13, color: 'var(--tx-tertiary-2)' }}>Syncing your projects…</div>
        </StatePanel>
      </CardFrame>
    )
  }
  if (status === 'error') {
    return (
      <CardFrame>
        <StatePanel>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Couldn’t reach the data source</div>
          <div style={{ fontSize: 12, color: 'var(--tx-tertiary-2)', maxWidth: 360, textAlign: 'center' }}>{error}</div>
          <button
            type="button"
            onClick={refresh}
            style={{ fontSize: 12.5, fontWeight: 600, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1a1d21', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Retry
          </button>
        </StatePanel>
      </CardFrame>
    )
  }

  return (
    <>
      <CardFrame>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--card)' }}>
          <Header />
          <MainContent />
        </div>
      </CardFrame>

      {/*
        Overlays render HERE — siblings of the card, position:fixed — so the
        card's overflow:hidden never clips them (README "Global Layout").
      */}
      <RecordDetailDrawer />
      <CommitmentDrawer />
      <DrawingViewerOverlay />
      <ActivityDrawer />
      <CommandPalette />
    </>
  )
}
