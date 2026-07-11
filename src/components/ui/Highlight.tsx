// Render `text` with the characters that fuzzy-match `query` tinted — the shared
// highlighter for the in-table search filters. Runs the same pure `fuzzyMatch`
// the filter uses, so what's highlighted is exactly what matched. No query (or no
// match) → the plain text, so it's a safe drop-in for any cell.

import type { CSSProperties, ReactNode } from 'react'
import { fuzzyMatch } from '@/lib/fuzzy'
import { tone } from '@/theme/tokens'

const markStyle: CSSProperties = {
  background: tone.warn.bg,
  color: 'inherit',
  borderRadius: 2,
  padding: '0 1px',
  fontWeight: 650,
}

export function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) return <>{text}</>
  const pos = fuzzyMatch(query, text)
  if (!pos || pos.length === 0) return <>{text}</>

  const hit = new Set(pos)
  const out: ReactNode[] = []
  let buf = ''
  let bufHit = false
  let start = 0
  const flush = () => {
    if (!buf) return
    out.push(
      bufHit ? (
        <mark key={start} style={markStyle}>
          {buf}
        </mark>
      ) : (
        buf
      ),
    )
    buf = ''
  }
  for (let i = 0; i < text.length; i++) {
    const isHit = hit.has(i)
    if (buf && isHit !== bufHit) {
      flush()
      start = i
    }
    buf += text[i]
    bufHit = isHit
  }
  flush()
  return <>{out}</>
}
