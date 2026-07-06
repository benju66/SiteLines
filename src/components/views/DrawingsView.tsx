// Drawings log (Drawings workstream, Phase 1) — the discipline-grouped,
// collapsible drawing register. Reference data (NOT court items): reads the
// `drawings` slice, groups by discipline via the pure groupByDiscipline
// selector, and lets each section collapse/expand (state lives in AppState;
// default = all expanded). Each row exposes an "Open PDF ↗" link (new tab) as
// the interim view — the in-app zoomable viewer + revision picker are Phase 2.

import type { CSSProperties } from 'react'
import { groupByDiscipline } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, projectMeta, tone as toneMap } from '@/theme/tokens'
import type { Drawing } from '@/types'

// 7 data columns + a trailing action cell:
// Drawing Number · Title · Revision · Drawing Date · Received Date · Set · Status · (Open PDF)
const GRID = '104px minmax(150px,1.5fr) 58px 104px 108px minmax(120px,1fr) 92px 98px'
const HEADS = ['Drawing Number', 'Drawing Title', 'Revision', 'Drawing Date', 'Received Date', 'Set', 'Status']

// Discipline dot colors, drawn only from existing tokens (no ad-hoc hex). A
// stable hash keeps each discipline's dot color constant across data changes.
const DOTS = [projectMeta.opiii.color, projectMeta.mckenna.color, toneMap.warn.c, toneMap.ok.c, toneMap.info.c, toneMap.muted.c]
function disciplineColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return DOTS[h % DOTS.length]
}

const cellFaint: CSSProperties = { fontFamily: mono, fontSize: 11, color: 'var(--tx-faint)', minWidth: 0 }

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
      <span />
    </div>
  )
}

function StatusTag({ status }: { status: string }) {
  if (!status) return <span style={{ color: 'var(--tx-faint)' }}>—</span>
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  const t = toneMap.muted
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 650,
        letterSpacing: '.2px',
        padding: '2px 8px',
        borderRadius: 20,
        lineHeight: 1.4,
        color: t.c,
        background: t.bg,
        border: `1px solid ${t.bd}`,
      }}
    >
      {label}
    </span>
  )
}

function OpenPdf({ url }: { url: string | null }) {
  if (!url) return <span style={{ fontSize: 11.5, color: 'var(--tx-faint-2)' }}>—</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="sl-linked-row"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--tx-secondary-2)',
        background: '#fff',
        border: '1px solid var(--bd-1)',
        borderRadius: 6,
        padding: '4px 9px',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      Open PDF <span aria-hidden style={{ fontSize: 10 }}>↗</span>
    </a>
  )
}

function SheetRow({ sheet }: { sheet: Drawing }) {
  return (
    <div
      className="sl-hover-row"
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
        {sheet.number || '—'}
      </span>
      <span style={{ fontSize: 13, fontWeight: 530, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sheet.title}>
        {sheet.title || '—'}
      </span>
      <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--tx-secondary)' }}>{sheet.revision || '—'}</span>
      <span style={cellFaint}>{sheet.drawingDate ?? '—'}</span>
      <span style={cellFaint}>{sheet.receivedDate ?? '—'}</span>
      <span style={{ fontSize: 11.5, color: 'var(--tx-tertiary)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sheet.set ?? undefined}>
        {sheet.set ?? '—'}
      </span>
      <span style={{ minWidth: 0 }}>
        <StatusTag status={sheet.status} />
      </span>
      <span style={{ justifySelf: 'start' }}>
        <OpenPdf url={sheet.pdfUrl} />
      </span>
    </div>
  )
}

export function DrawingsView() {
  const { state, patch } = useApp()
  const { drawings } = useSiteData()
  const groups = groupByDiscipline(drawings)

  const toggle = (name: string) =>
    patch((s) => {
      const next = new Set(s.collapsedDisciplines)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return { collapsedDisciplines: next }
    })

  if (drawings.length === 0) {
    return (
      <div style={{ padding: 52, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>
        No drawings in the current set.
      </div>
    )
  }

  return (
    <div>
      <ColumnHeader />
      {groups.map((g) => {
        const collapsed = state.collapsedDisciplines.has(g.discipline)
        return (
          <section key={g.discipline}>
            <button
              type="button"
              onClick={() => toggle(g.discipline)}
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
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: disciplineColor(g.discipline), flex: 'none' }} />
              <span style={{ fontSize: 13.5, fontWeight: 680, color: 'var(--tx-primary)' }}>{g.discipline}</span>
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
                {g.sheets.length}
              </span>
            </button>
            {!collapsed && g.sheets.map((s) => <SheetRow key={s.id} sheet={s} />)}
          </section>
        )
      })}
    </div>
  )
}
