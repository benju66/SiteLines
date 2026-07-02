// Shared overlay backdrop. Overlays render as siblings of the app card,
// position:fixed, so the card's overflow:hidden never clips them (README
// "Global Layout" — this bit the prototype). Click on the backdrop closes;
// panels inside must stopPropagation.

import type { CSSProperties, ReactNode } from 'react'

export function Backdrop({
  onClose,
  zIndex = 55,
  background = 'rgba(20,25,35,.3)',
  style,
  children,
}: {
  onClose: () => void
  zIndex?: number
  background?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background, zIndex, ...style }}>
      {children}
    </div>
  )
}
