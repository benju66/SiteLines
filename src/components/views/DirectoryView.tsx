// Directory (README §6) — project contacts: owner, design team, subs, agencies.
// Reference data with no ball-in-court (never feeds My Court, no toggle). The
// orange "Open" pill cross-links a person to their live court items; when
// reached from a record's "Waiting on" link, the matching row is highlighted
// (state.dirFocus). A TableSearch filters by name/company/role/trade/email.

import { useState } from 'react'
import { fuzzyMatchesAny } from '@/lib/fuzzy'
import { contactOpenCount, directoryContacts } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, projectMeta } from '@/theme/tokens'
import type { Contact } from '@/types'
import { Highlight } from '@/components/ui/Highlight'
import { TableSearch } from '@/components/ui/TableSearch'

// Name · Company · Role · Trade · Projects · Contact (email/phone) · Open.
const GRID = 'minmax(130px,1.1fr) minmax(120px,1.1fr) 118px 84px 58px minmax(0,1fr) 50px'

function ContactRow({ contact, focused, query }: { contact: Contact; focused: boolean; query: string }) {
  const { state } = useApp()
  const { itemsByTool } = useSiteData()
  const open = contactOpenCount(itemsByTool, contact, state.project)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: GRID,
        gap: 12,
        alignItems: 'center',
        padding: '11px 22px',
        borderBottom: '1px solid var(--bd-row)',
        ...(focused ? { background: '#fdf6ee', boxShadow: 'inset 3px 0 0 var(--accent)' } : {}),
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={contact.name}>
        <Highlight text={contact.name} query={query} />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--tx-secondary)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={contact.company}>
        {contact.company ? <Highlight text={contact.company} query={query} /> : '—'}
      </div>
      <span style={{ fontSize: 12, color: 'var(--tx-secondary)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={contact.role}>
        {contact.role ? <Highlight text={contact.role} query={query} /> : '—'}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--tx-tertiary)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={contact.trade}>
        {contact.trade ? <Highlight text={contact.trade} query={query} /> : '—'}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {contact.projects.map((p) => (
          <span key={p} title={projectMeta[p].full} style={{ width: 9, height: 9, borderRadius: 2, background: projectMeta[p].color }} />
        ))}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={contact.email}>
          <Highlight text={contact.email} query={query} />
        </div>
        <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--tx-faint)', marginTop: 1 }}>{contact.phone}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {open > 0 && (
          <span
            title="Open ball-in-court items involving this contact"
            style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: '#fdf0ea', border: '1px solid #f2c9b6', borderRadius: 20, padding: '2px 8px' }}
          >
            {open}
          </span>
        )}
      </div>
    </div>
  )
}

export function DirectoryView() {
  const { state } = useApp()
  const { contacts } = useSiteData()
  const rows = directoryContacts(contacts, state.project)
  const [query, setQuery] = useState('')

  // Filter by name / company / role / trade / email (fuzzy, same as the other tables).
  const q = query.trim()
  const visible = q ? rows.filter((c) => fuzzyMatchesAny(query, [c.name, c.company, c.role, c.trade, c.email])) : rows

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 22px 9px' }}>
        <TableSearch value={query} onChange={setQuery} placeholder="Filter contacts…" count={{ shown: visible.length, total: rows.length }} />
      </div>
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
        <span>Name</span>
        <span>Company</span>
        <span>Role</span>
        <span>Trade</span>
        <span>Projects</span>
        <span>Contact</span>
        <span style={{ textAlign: 'right' }}>Open</span>
      </div>
      {visible.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--tx-faint)', fontSize: 13 }}>No contacts match “{q}”.</div>
      ) : (
        visible.map((c) => <ContactRow key={c.id} contact={c} focused={state.dirFocus === c.id} query={query} />)
      )}
    </div>
  )
}
