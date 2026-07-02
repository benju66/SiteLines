import type { CSSProperties } from 'react'

/** A filter chip. Active fills with `activeColor` (default near-black). */
export function Chip({
  label,
  active,
  activeColor = '#1a1d21',
  onClick,
}: {
  label: string
  active: boolean
  activeColor?: string
  onClick: () => void
}) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 550,
    padding: '5px 10px',
    borderRadius: 7,
    cursor: 'pointer',
    lineHeight: 1,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  }
  const style: CSSProperties = active
    ? { ...base, background: activeColor, color: '#fff', border: `1px solid ${activeColor}` }
    : { ...base, background: '#fff', color: 'var(--tx-secondary)', border: '1px solid var(--bd-3)' }
  return (
    <button type="button" className={`sl-chip${active ? ' is-active' : ''}`} style={style} onClick={onClick}>
      {label}
    </button>
  )
}
