// Tool register (list view) — the full register for one tool, project-scoped,
// with the In My Court / All toggle (rendered by the Header). Same grid as My
// Court, but rows show a status pill + date/amount subline, and column labels
// come from the tool registry (e.g. "Revision"/"Issued" for Drawings). A
// per-register fuzzy filter (title / number / party / status) narrows the list in
// place and highlights matches — distinct from the ⌘K global finder.

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { TOOLS } from '@/data/tools'
import { fuzzyMatchesAny } from '@/lib/fuzzy'
import { listRows } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { EmptyState, ListTableHeader, RecordRow } from '@/components/ui/ListTable'
import { TableSearch } from '@/components/ui/TableSearch'

const toolbar: CSSProperties = { display: 'flex', alignItems: 'center', padding: '10px 22px 9px' }

export function ToolRegisterView() {
  const { state } = useApp()
  const { itemsByTool } = useSiteData()
  const meta = TOOLS[state.tool]
  const rows = listRows(itemsByTool, state)

  // Local to the surface; reset when the active tool changes (searching RFIs
  // shouldn't carry into Submittals — same component instance, different data).
  const [query, setQuery] = useState('')
  useEffect(() => setQuery(''), [state.tool])

  const q = query.trim()
  const shown = q ? rows.filter((r) => fuzzyMatchesAny(query, [r.title, r.num, r.who, r.status?.label])) : rows

  return (
    <div>
      <div style={toolbar}>
        <TableSearch value={query} onChange={setQuery} placeholder={`Filter ${meta.label.toLowerCase()}…`} count={{ shown: shown.length, total: rows.length }} />
      </div>
      <ListTableHeader whoLabel={meta.whoLabel ?? 'Waiting on'} rightLabel={meta.rightLabel ?? 'Status'} />
      {shown.length === 0 ? (
        <EmptyState>
          {q ? (
            <>No {meta.label.toLowerCase()} match “{q}”.</>
          ) : (
            <>
              Nothing here for these filters. Try <b style={{ color: 'var(--tx-secondary-2)' }}>All</b> or reset the view.
            </>
          )}
        </EmptyState>
      ) : (
        shown.map((r) => <RecordRow key={r.id} record={r} isHome={false} showPill query={query} />)
      )}
    </div>
  )
}
