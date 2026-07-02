// Small presentational primitives shared across views. Each maps design tokens
// to the exact chrome from the prototype.

import type { CSSProperties, MouseEvent } from 'react'
import { mono, projectMeta, tone as toneMap, urgency as urgencyMap } from '@/theme/tokens'
import type { Project, Tone, Urgency } from '@/types'

/** 9px urgency status dot with a soft ring. */
export function UrgencyDot({ urgency, title }: { urgency: Urgency; title?: string }) {
  const u = urgencyMap[urgency]
  return (
    <span
      title={title}
      style={{ width: 9, height: 9, borderRadius: '50%', background: u.dot, boxShadow: `0 0 0 3px ${u.ring}`, flex: 'none' }}
    />
  )
}

/** Monospace tool code badge, e.g. RFI / SUB / BUD. */
export function CodeBadge({ code, style }: { code: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: mono,
        fontSize: 9.5,
        fontWeight: 650,
        letterSpacing: '.3px',
        color: 'var(--tx-secondary-2)',
        background: 'var(--fill-3)',
        border: '1px solid var(--bd-1)',
        padding: '2px 5px',
        borderRadius: 4,
        textAlign: 'center',
        justifySelf: 'start',
        ...style,
      }}
    >
      {code}
    </span>
  )
}

/** Status pill (register status). */
export function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const t = toneMap[tone] ?? toneMap.muted
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

/** Black "YOU" chip — Ben holds the ball. */
export function YouPill() {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '.4px',
        background: 'var(--tx-primary)',
        color: '#fff',
        padding: '2px 5px',
        borderRadius: 4,
      }}
    >
      YOU
    </span>
  )
}

/**
 * Project tag pill. Clickable variant (My Court rows) stops propagation.
 * Non-clickable renders a <span> — tags often sit inside row/link buttons, and
 * a nested <button> is invalid DOM nesting.
 */
export function ProjectTag({
  project,
  onClick,
}: {
  project: Project
  onClick?: (e: MouseEvent) => void
}) {
  const p = projectMeta[project]
  const clickable = !!onClick
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 6,
    lineHeight: 1.3,
    fontFamily: 'inherit',
    border: `1px solid ${p.color}33`,
    background: p.bg,
    color: p.color,
    cursor: clickable ? 'pointer' : 'default',
  }
  if (!clickable) return <span style={style}>{p.short}</span>
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
      className="sl-proj-tag"
      style={style}
    >
      {p.short}
    </button>
  )
}
