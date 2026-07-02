// Content router — picks the surface for the active tool's view type.
// Not-yet-built view types render a placeholder (see PLAN.md).

import { TOOLS } from '@/data/tools'
import { useApp } from '@/state/AppContext'
import { DirectoryView } from '@/components/views/DirectoryView'
import { MyCourtView } from '@/components/views/MyCourtView'
import { PlaceholderView } from '@/components/views/PlaceholderView'
import { ToolRegisterView } from '@/components/views/ToolRegisterView'

export function MainContent() {
  const { state } = useApp()
  const view = TOOLS[state.tool].view

  return (
    <div className="scry" style={{ flex: 1, overflowY: 'auto' }}>
      {view === 'home' ? (
        <MyCourtView />
      ) : view === 'list' ? (
        <ToolRegisterView />
      ) : view === 'directory' ? (
        <DirectoryView />
      ) : (
        <PlaceholderView />
      )}
    </div>
  )
}
