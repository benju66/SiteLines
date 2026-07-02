// My Court (home) — the morning scan. Every live ball-in-court item across all
// court-bearing tools, both Ben's court and others' clocks, urgency-sorted.

import { homeRows } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { EmptyState, ListTableHeader, RecordRow } from '@/components/ui/ListTable'

export function MyCourtView() {
  const { state } = useApp()
  const { itemsByTool } = useSiteData()
  const rows = homeRows(itemsByTool, state)

  return (
    <div>
      <ListTableHeader whoLabel="Waiting on" rightLabel="Age" />
      {rows.length === 0 ? (
        <EmptyState>
          Nothing here for these filters. Try <b style={{ color: 'var(--tx-secondary-2)' }}>All</b> or reset the view.
        </EmptyState>
      ) : (
        rows.map((r) => <RecordRow key={r.id} record={r} isHome showPill={false} />)
      )}
    </div>
  )
}
