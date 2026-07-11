// The in-table search input — a filter box styled to match the header's search
// field (fill + hairline + leading ring glyph), with a clear (×) affordance. It's
// a controlled input; each table owns its query state and does the filtering. This
// is distinct from the ⌘K command palette (a global finder that navigates); this
// only narrows the current table in place.

import { mono } from '@/theme/tokens'

export function TableSearch({
  value,
  onChange,
  placeholder = 'Filter…',
  width = 220,
  count,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  width?: number
  /** Optional "N of M" result count shown when a query is active. */
  count?: { shown: number; total: number }
}) {
  const active = value.trim().length > 0
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          background: 'var(--fill-1)',
          border: '1px solid var(--bd-1)',
          borderRadius: 8,
          padding: '5px 8px 5px 10px',
          width,
        }}
      >
        <span aria-hidden style={{ width: 11, height: 11, borderRadius: '50%', border: '1.6px solid var(--tx-faint-2)', flex: 'none' }} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="sl-table-search"
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 12.5, color: 'var(--tx-primary)', fontFamily: 'inherit' }}
        />
        {active && (
          <button
            type="button"
            aria-label="Clear filter"
            onClick={() => onChange('')}
            style={{ flex: 'none', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--tx-faint)', fontSize: 14, lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        )}
      </div>
      {active && count && (
        <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--tx-faint)', whiteSpace: 'nowrap' }}>
          {count.shown} of {count.total}
        </span>
      )}
    </div>
  )
}
