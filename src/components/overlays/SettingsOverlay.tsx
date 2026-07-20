// Settings menu (User Settings & UX, Phase 1). A centered, position:fixed modal —
// mounted in App.tsx's overlay slot as a SIBLING of the card, OUTSIDE its
// overflow:hidden (per the overlay guardrail), so it's never clipped. Opened by the
// header gear (AppState.settingsOpen); Esc / backdrop / × close it.
//
// v1 content is intentionally small but REAL: one preference wired end-to-end
// ("Collapse sidebar by default" → persists settings.sidebarCollapsed) plus a
// "Reset to defaults" action. Toggling also patches the live AppState so the change
// is visible immediately; on the next load the boot hydrate reads the persisted
// value. Later phases add more rows here.

import type { CSSProperties } from 'react'
import { defaultSettings } from '@/lib/settings'
import { useApp } from '@/state/AppContext'
import { useSettings } from '@/state/SettingsContext'
import { Backdrop } from './Backdrop'

/** A small on/off switch (role="switch") styled from tokens — no ad-hoc palette. */
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  const track: CSSProperties = {
    width: 38,
    height: 22,
    borderRadius: 999,
    border: 'none',
    padding: 2,
    cursor: 'pointer',
    flex: 'none',
    display: 'flex',
    justifyContent: on ? 'flex-end' : 'flex-start',
    alignItems: 'center',
    background: on ? '#3c434c' : 'var(--bd-3)',
    transition: 'background .14s ease',
  }
  const knob: CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 2px rgba(20,25,35,.28)',
  }
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} style={track}>
      <span style={knob} />
    </button>
  )
}

export function SettingsOverlay() {
  const { state, patch } = useApp()
  const { settings, setSetting, resetSettings } = useSettings()
  if (!state.settingsOpen) return null

  const close = () => patch({ settingsOpen: false })

  const toggleSidebarDefault = () => {
    const next = !settings.sidebarCollapsed
    setSetting('sidebarCollapsed', next) // persist the durable preference
    patch({ sidebarCollapsed: next }) // and reflect it in the live session immediately
  }

  const reset = () => {
    const defaults = defaultSettings()
    resetSettings()
    patch({ sidebarCollapsed: defaults.sidebarCollapsed }) // keep the live session in sync with the reset
  }

  return (
    <Backdrop onClose={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="scry"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 440,
          maxWidth: '92vw',
          maxHeight: '86vh',
          background: 'var(--card)',
          border: '1px solid var(--bd-card)',
          borderRadius: 14,
          boxShadow: '0 12px 48px rgba(20,25,35,.24)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px', borderBottom: '1px solid var(--bd-2)', background: '#fff' }}>
          <span style={{ fontSize: 15, fontWeight: 680 }}>Settings</span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="sl-icon-btn"
            onClick={close}
            aria-label="Close settings"
            style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--bd-1)', background: '#fff', cursor: 'pointer', color: 'var(--tx-secondary-2)', fontSize: 15, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '6px 18px 14px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--tx-faint-2)', fontWeight: 600, padding: '12px 0 4px' }}>Appearance</div>

          {/* the one wired preference */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--tx-primary)' }}>Collapse sidebar by default</div>
              <div style={{ fontSize: 11.5, color: 'var(--tx-tertiary)', marginTop: 2 }}>Start with the sidebar as a compact icon rail. Remembered across reloads.</div>
            </div>
            <Toggle on={settings.sidebarCollapsed} onClick={toggleSidebarDefault} label="Collapse sidebar by default" />
          </div>
        </div>

        {/* footer actions */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', borderTop: '1px solid var(--bd-2)', background: 'var(--fill-2)' }}>
          <button
            type="button"
            className="sl-icon-btn"
            onClick={reset}
            style={{ fontSize: 12, fontWeight: 550, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--bd-1)', background: '#fff', color: 'var(--tx-secondary)', cursor: 'pointer' }}
          >
            Reset to defaults
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={close}
            style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1a1d21', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Done
          </button>
        </div>
      </div>
    </Backdrop>
  )
}
