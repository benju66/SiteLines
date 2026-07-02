// Tool register (list view) — the full register for one tool, project-scoped,
// with the In My Court / All toggle (rendered by the Header). Same grid as My
// Court, but rows show a status pill + date/amount subline, and column labels
// come from the tool registry (e.g. "Revision"/"Issued" for Drawings).

import { TOOLS } from '@/data/tools'
import { listRows } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { EmptyState, ListTableHeader, RecordRow } from '@/components/ui/ListTable'

export function ToolRegisterView() {
  const { state } = useApp()
  const { itemsByTool } = useSiteData()
  const meta = TOOLS[state.tool]
  const rows = listRows(itemsByTool, state)

  return (
    <div>
      <ListTableHeader whoLabel={meta.whoLabel ?? 'Waiting on'} rightLabel={meta.rightLabel ?? 'Status'} />
      {rows.length === 0 ? (
        <EmptyState>
          Nothing here for these filters. Try <b style={{ color: 'var(--tx-secondary-2)' }}>All</b> or reset the view.
        </EmptyState>
      ) : (
        rows.map((r) => <RecordRow key={r.id} record={r} isHome={false} showPill />)
      )}
    </div>
  )
}
