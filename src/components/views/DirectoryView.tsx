// Directory (README §6) — project contacts: owner, design team, subs, agencies.
// Reference data with no ball-in-court (never feeds My Court, no toggle). The
// orange "Open" pill cross-links a person to their live court items; when
// reached from a record's "Waiting on" link, the matching row is highlighted
// (state.dirFocus).

import { contactOpenCount, directoryContacts } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, projectMeta } from '@/theme/tokens'
import type { Contact } from '@/types'

const GRID = 'minmax(140px,1.3fr) 128px 92px 62px minmax(0,1fr) 54px'

function ContactRow({ contact, focused }: { contact: Contact; focused: boolean }) {
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
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.name}</div>
        <div style={{ fontSize: 11, color: 'var(--tx-faint)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.company}</div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--tx-secondary)' }}>{contact.role}</span>
      <span style={{ fontSize: 11.5, color: 'var(--tx-tertiary)' }}>{contact.trade}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {contact.projects.map((p) => (
          <span key={p} title={projectMeta[p].full} style={{ width: 9, height: 9, borderRadius: 2, background: projectMeta[p].color }} />
        ))}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.email}</div>
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

  return (
    <div>
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
        <span>Role</span>
        <span>Trade</span>
        <span>Projects</span>
        <span>Contact</span>
        <span style={{ textAlign: 'right' }}>Open</span>
      </div>
      {rows.map((c) => (
        <ContactRow key={c.id} contact={c} focused={state.dirFocus === c.id} />
      ))}
    </div>
  )
}
