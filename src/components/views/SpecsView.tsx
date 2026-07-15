// Spec log (Specifications workstream, Phase 1) — the CSI-division-grouped,
// collapsible specification register. Reference data (NOT court items): reads the
// `specs` slice, groups by CSI MasterFormat division via the pure groupByDivision
// selector (divisions in book order, sections natural-sorted), and lets each
// division collapse/expand (state lives in AppState; default = all expanded).
//
// Rows are static reference lines in Phase 1: the spec master syncs only a thin
// section summary (number + title), so there is nothing per-row to open yet. The
// per-section "Open PDF ↗" + issued date arrive in Phase 3 (they need the detail
// re-sync in Phase 2). Mirrors DrawingsView; kept trimmed to what specs carry.

import { useState } from 'react'
import { fuzzyMatch, fuzzyMatchesAny } from '@/lib/fuzzy'
import { groupByDivision } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, projectMeta, tone as toneMap } from '@/theme/tokens'
import type { Spec } from '@/types'
import { Highlight } from '@/components/ui/Highlight'
import { TableSearch } from '@/components/ui/TableSearch'

// 2 data columns: Section number · Title. (Phase 3 adds Issued + Open PDF.)
const GRID = '132px minmax(200px,1fr)'
const HEADS = ['Section', 'Title']

// Division dot colors, drawn only from existing tokens (no ad-hoc hex). A stable
// hash keeps each division's dot color constant across data changes.
const DOTS = [projectMeta.opiii.color, projectMeta.mckenna.color, toneMap.warn.c, toneMap.ok.c, toneMap.info.c, toneMap.muted.c]
function divisionColor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return DOTS[h % DOTS.length]
}

function ColumnHeader() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: GRID,
        gap: 12,
        alignItems: 'center',
        padding: '8px 22px',
        background: 'var(--fill-1)',
        borderBottom: '1px solid var(--bd-2)',
        fontSize: 9.5,
        textTransform: 'uppercase',
        letterSpacing: '.6px',
        color: 'var(--tx-faint)',
        fontWeight: 600,
        position: 'sticky',
        top: 0,
        zIndex: 2,
      }}
    >
      {HEADS.map((h) => (
        <span key={h}>{h}</span>
      ))}
    </div>
  )
}

function SectionRow({ section, query }: { section: Spec; query?: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: GRID,
        gap: 12,
        alignItems: 'center',
        padding: '10px 22px',
        borderBottom: '1px solid var(--bd-row)',
      }}
    >
      <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 650, color: 'var(--tx-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {section.number ? <Highlight text={section.number} query={query} /> : '—'}
      </span>
      <span style={{ fontSize: 13, fontWeight: 530, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={section.title}>
        {section.title ? <Highlight text={section.title} query={query} /> : '—'}
      </span>
    </div>
  )
}

export function SpecsView() {
  const { state, patch } = useApp()
  const { specs } = useSiteData()
  const groups = groupByDivision(specs)
  const [query, setQuery] = useState('')

  const toggle = (code: string) =>
    patch((s) => {
      const next = new Set(s.collapsedDivisions)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return { collapsedDivisions: next }
    })

  if (specs.length === 0) {
    return (
      <div style={{ padding: 52, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>
        No specification sections in the current set.
      </div>
    )
  }

  // Filter within each division (number/title); if the division NAME or CODE itself
  // matches, keep all its sections. Empty groups drop out.
  const q = query.trim()
  const visible = groups
    .map((g) => {
      if (!q) return { g, sections: g.sections }
      const divisionHit = fuzzyMatch(query, g.name) !== null || fuzzyMatch(query, g.code) !== null
      const sections = divisionHit ? g.sections : g.sections.filter((s) => fuzzyMatchesAny(query, [s.number, s.title]))
      return { g, sections }
    })
    .filter((v) => v.sections.length > 0)
  const shownCount = visible.reduce((n, v) => n + v.sections.length, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 22px 9px' }}>
        <TableSearch value={query} onChange={setQuery} placeholder="Filter specifications…" count={{ shown: shownCount, total: specs.length }} />
      </div>
      <ColumnHeader />
      {visible.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>No sections match “{q}”.</div>
      ) : (
        visible.map(({ g, sections }) => {
          const collapsed = q ? false : state.collapsedDivisions.has(g.code) // force-expand while searching
          return (
            <section key={g.code}>
              <button
                type="button"
                onClick={() => toggle(g.code)}
                aria-expanded={!collapsed}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 22px',
                  background: 'var(--fill-2)',
                  border: 'none',
                  borderBottom: '1px solid var(--bd-2)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 10,
                    fontSize: 10,
                    color: 'var(--tx-faint)',
                    transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                    transition: 'transform .12s ease',
                  }}
                >
                  ▸
                </span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: divisionColor(g.code), flex: 'none' }} />
                <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: 'var(--tx-secondary)' }}>
                  {g.code ? <Highlight text={g.code} query={query} /> : '—'}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 680, color: 'var(--tx-primary)' }}><Highlight text={g.name} query={query} /></span>
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 10.5,
                    fontWeight: 650,
                    color: 'var(--tx-secondary-2)',
                    background: 'var(--fill-3)',
                    border: '1px solid var(--bd-1)',
                    borderRadius: 20,
                    padding: '1px 8px',
                  }}
                >
                  {q ? `${sections.length} / ${g.sections.length}` : g.sections.length}
                </span>
              </button>
              {!collapsed && sections.map((s) => <SectionRow key={s.id} section={s} query={query} />)}
            </section>
          )
        })
      )}
    </div>
  )
}
