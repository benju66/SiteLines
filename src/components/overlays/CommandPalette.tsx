// Command Palette (README "Overlays"): ⌘K / Ctrl+K center-top modal. Search
// across all list-tool records; empty query lists tools to jump to. Click (or
// Enter for the top hit) opens a record's detail or navigates to a tool.

import { TOOLS } from '@/data/tools'
import { openPatch } from '@/lib/drawerNav'
import { paletteResults } from '@/selectors'
import type { PaletteResult } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, projectMeta } from '@/theme/tokens'
import { Backdrop } from './Backdrop'

export function CommandPalette() {
  const { state, patch } = useApp()
  const { itemsByTool } = useSiteData()
  if (!state.palette) return null

  const results = paletteResults(itemsByTool, state.query)
  const close = () => patch({ palette: false })
  const open = (res: PaletteResult) => {
    if (res.kind === 'record') {
      patch({ tool: res.record.tool, palette: false, ...openPatch({ kind: 'detail', value: { tool: res.record.tool, record: res.record } }) })
    } else {
      patch({ tool: res.tool, palette: false })
    }
  }

  return (
    <Backdrop
      onClose={close}
      zIndex={60}
      background="rgba(20,25,35,.34)"
      style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '11vh' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 580, maxWidth: '92vw', background: '#fff', borderRadius: 13, boxShadow: '0 24px 64px rgba(20,25,35,.35)', overflow: 'hidden' }}
      >
        {/* input row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', borderBottom: '1px solid var(--bd-row)' }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', border: '1.8px solid var(--tx-faint-2)', flex: 'none' }} />
          <input
            autoFocus
            value={state.query}
            onChange={(e) => patch({ query: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results.length > 0) open(results[0])
            }}
            placeholder="Search RFIs, submittals, tools…"
            style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 15, color: 'var(--tx-primary)', background: 'transparent' }}
          />
          <span style={{ fontFamily: mono, fontSize: 10, background: 'var(--fill-1)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '2px 6px', color: 'var(--tx-tertiary-2)' }}>esc</span>
        </div>

        {/* results */}
        <div className="scry" style={{ maxHeight: '52vh', overflowY: 'auto', padding: 6 }}>
          {results.map((res) => {
            const key = res.kind === 'record' ? res.record.id : `tool:${res.tool}`
            const code = res.kind === 'record' ? TOOLS[res.record.tool].code : TOOLS[res.tool].code || '—'
            const title = res.kind === 'record' ? res.record.title : TOOLS[res.tool].label
            const sub = res.kind === 'record' ? `${projectMeta[res.record.project].short} · ${TOOLS[res.record.tool].label}` : 'Open tool'
            return (
              <button
                key={key}
                type="button"
                className="sl-palette-row"
                onClick={() => open(res)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '9px 11px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              >
                <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: 'var(--tx-secondary-2)', background: 'var(--fill-3)', border: '1px solid var(--bd-1)', padding: '3px 6px', borderRadius: 5, minWidth: 42, textAlign: 'center', flex: 'none' }}>
                  {code}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 540, color: 'var(--tx-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--tx-faint)', marginTop: 1 }}>{sub}</span>
                </span>
              </button>
            )
          })}
          {results.length === 0 && (
            <div style={{ padding: 34, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>No matches for “{state.query}”.</div>
          )}
        </div>

        {/* footer hints */}
        <div style={{ display: 'flex', gap: 16, padding: '9px 16px', borderTop: '1px solid var(--bd-row)', background: '#fafbfc', fontSize: 10.5, color: 'var(--tx-faint)' }}>
          <span>↵ open</span>
          <span>esc close</span>
          <span style={{ marginLeft: 'auto' }}>Search across all tools · sample data</span>
        </div>
      </div>
    </Backdrop>
  )
}
