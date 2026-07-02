// Temporary surface for views not yet implemented (financial, photos, daily
// log, directory, overview, list registers). Keeps nav fully functional while
// those views are built out.

import { TOOLS } from '@/data/tools'
import { useApp } from '@/state/AppContext'

export function PlaceholderView() {
  const { state } = useApp()
  const meta = TOOLS[state.tool]
  return (
    <div style={{ padding: '52px 22px', textAlign: 'center', color: 'var(--tx-faint)' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-secondary)' }}>{meta.label}</div>
      <div style={{ fontSize: 12.5, marginTop: 6 }}>{meta.desc}</div>
      <div style={{ fontSize: 11.5, marginTop: 18, color: 'var(--tx-faint-2)' }}>This view is coming next in the build-out.</div>
    </div>
  )
}
