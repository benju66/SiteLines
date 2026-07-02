// Shared list table: the urgency-coded row grid used by My Court and every
// tool register. Grid + density come straight from the README spec.

import type { ReactNode } from 'react'
import { useApp } from '@/state/AppContext'
import { TOOLS } from '@/data/tools'
import { mono, urgency as urgencyMap } from '@/theme/tokens'
import type { Item } from '@/types'
import { CodeBadge, ProjectTag, StatusPill, UrgencyDot, YouPill } from './primitives'

const GRID = '12px 46px minmax(120px,1fr) 104px 132px 98px'

export function ListTableHeader({ whoLabel, rightLabel }: { whoLabel: string; rightLabel: string }) {
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
        zIndex: 1,
      }}
    >
      <span />
      <span>Type</span>
      <span>Item</span>
      <span>Project</span>
      <span>{whoLabel}</span>
      <span style={{ textAlign: 'right' }}>{rightLabel}</span>
    </div>
  )
}

/**
 * A single record row.
 * - `isHome`: the project tag sets the global scope (vs. opening detail).
 * - `showPill`: register mode shows the status pill above the date subline.
 */
export function RecordRow({ record, isHome, showPill }: { record: Item; isHome: boolean; showPill: boolean }) {
  const { patch } = useApp()
  const u = urgencyMap[record.urgency]
  const openDetail = () => patch({ detail: { tool: record.tool, record } })

  return (
    <div
      className="sl-hover-row"
      onClick={openDetail}
      style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center', padding: '11px 22px', borderBottom: '1px solid var(--bd-row)', cursor: 'pointer' }}
    >
      <UrgencyDot urgency={record.urgency} title={record.status?.label} />
      <CodeBadge code={TOOLS[record.tool].code} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 530, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.title}</div>
        <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--tx-faint)', marginTop: 1 }}>{record.num}</div>
      </div>
      <ProjectTag project={record.project} onClick={isHome ? () => patch({ project: record.project }) : openDetail} />
      <div style={{ minWidth: 0 }}>
        {record.mine ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--tx-primary)' }}>
            <YouPill />
          </span>
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--tx-secondary)' }}>{record.who}</span>
        )}
      </div>
      <div style={{ textAlign: 'right', minWidth: 0 }}>
        {showPill && record.status && <StatusPill label={record.status.label} tone={record.status.tone} />}
        <div style={{ fontFamily: mono, fontSize: 11, color: showPill ? 'var(--tx-faint)' : u.color, marginTop: 3 }}>{record.date}</div>
      </div>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div style={{ padding: 52, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>{children}</div>
}
