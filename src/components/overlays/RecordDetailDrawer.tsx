// Record-Detail drawer (README "Overlays"): right drawer, 452px, opened by any
// record row. Meta grid, description, cross-tool linked records (click swaps
// the drawer to that record), ball-in-court history, attachment chips, and the
// sticky Respond/Forward/Resolve footer.

import { TOOLS } from '@/data/tools'
import { partyContact } from '@/lib/party'
import { resolveLinks } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, projectMeta, urgency as urgencyMap } from '@/theme/tokens'
import { CodeBadge, ProjectTag, StatusPill, YouPill } from '@/components/ui/primitives'
import { Backdrop } from './Backdrop'

const labelStyle = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '.4px',
  color: 'var(--tx-faint)',
} as const

const sectionLabel = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '.5px',
  color: 'var(--tx-faint-2)',
  fontWeight: 600,
} as const

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', padding: '11px 13px' }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  )
}

export function RecordDetailDrawer() {
  const { state, patch } = useApp()
  const { itemsByTool, contacts } = useSiteData()
  const detail = state.detail
  if (!detail) return null

  const r = detail.record
  const toolMeta = TOOLS[detail.tool]
  const p = projectMeta[r.project]
  const u = urgencyMap[r.urgency]
  const statusLabel = r.status?.label ?? 'Open'
  const party = r.mine ? null : partyContact(contacts, r)
  const links = resolveLinks(itemsByTool, r)
  const close = () => patch({ detail: null })

  // Generated prose + placeholder history/attachments, matching the prototype —
  // real description, BIC history, and files come from Procore in production.
  const desc = `${toolMeta.label.replace(/s$/, '')} on ${p.full}. Currently ${statusLabel.toLowerCase()}; ${
    r.mine ? 'awaiting your action.' : `the ball is with ${r.who}.`
  }`
  const history = [
    { text: r.mine ? 'Assigned to you for action' : `${r.who} currently holds the ball`, when: 'now', dot: u.dot },
    { text: `Ben Ostrander opened ${r.num}`, when: r.date, dot: '#c4c9cf' },
    { text: `Filed under ${p.full}`, when: '', dot: '#c4c9cf' },
  ]
  const attachments = ['Reference set.pdf', 'Field photo.jpg']

  return (
    <Backdrop onClose={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="scry"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100%',
          width: 452,
          maxWidth: '94vw',
          background: 'var(--card)',
          boxShadow: '-8px 0 40px rgba(20,25,35,.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px', borderBottom: '1px solid var(--bd-2)', background: '#fff', flex: 'none' }}>
          <CodeBadge code={toolMeta.code || 'ITEM'} style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5 }} />
          <span style={{ fontFamily: mono, fontSize: 12.5, fontWeight: 650, color: 'var(--tx-secondary)' }}>{r.num}</span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="sl-icon-btn"
            onClick={close}
            style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--bd-1)', background: '#fff', cursor: 'pointer', color: 'var(--tx-secondary-2)', fontSize: 15, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* body */}
        <div className="scry" style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 680, lineHeight: 1.3, letterSpacing: '-.2px' }}>{r.title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <StatusPill label={statusLabel} tone={r.status?.tone ?? 'muted'} />
            <ProjectTag project={r.project} />
          </div>

          {/* 2×2 meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e8ebee', border: '1px solid #e8ebee', borderRadius: 9, overflow: 'hidden', marginTop: 16 }}>
            <MetaCell label="Waiting on">
              {r.mine ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600 }}>
                  <YouPill />
                </span>
              ) : party ? (
                <button
                  type="button"
                  className="sl-party-link"
                  onClick={() => patch({ tool: 'directory', dirFocus: party.id, detail: null })}
                  style={{ fontSize: 13, fontWeight: 600, color: '#2f5f8a', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}
                >
                  {r.who} →
                </button>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 540, color: '#3c434c' }}>{r.who}</span>
              )}
            </MetaCell>
            <MetaCell label="Due / status">
              <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: u.color }}>{r.date}</span>
            </MetaCell>
            <MetaCell label="Project">
              <span style={{ fontSize: 13, fontWeight: 540, color: '#3c434c' }}>{p.full}</span>
            </MetaCell>
            <MetaCell label="Tool">
              <span style={{ fontSize: 13, fontWeight: 540, color: '#3c434c' }}>{toolMeta.label}</span>
            </MetaCell>
          </div>

          <div style={{ ...sectionLabel, margin: '18px 0 7px' }}>Description</div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: '#3c434c' }}>{desc}</p>

          {links.length > 0 && (
            <>
              <div style={{ ...sectionLabel, margin: '18px 0 8px' }}>Linked records</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {links.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="sl-linked-row"
                    onClick={() => patch({ detail: { tool: l.tool, record: l } })}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 8, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: urgencyMap[l.urgency].dot, flex: 'none' }} />
                    <CodeBadge code={TOOLS[l.tool].code} style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', flex: 'none' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 540, color: 'var(--tx-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</span>
                      <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--tx-faint)' }}>{l.num}</span>
                    </span>
                    <ProjectTag project={l.project} />
                    <span style={{ color: '#c4c9cf', fontSize: 15, flex: 'none' }}>›</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ ...sectionLabel, margin: '18px 0 9px' }}>Ball-in-court history</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {history.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 11 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: e.dot, marginTop: 3 }} />
                  {i < history.length - 1 && <span style={{ width: 1.5, flex: 1, background: 'var(--bd-2)', minHeight: 14 }} />}
                </div>
                <div style={{ paddingBottom: 12 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--tx-primary)', lineHeight: 1.4 }}>{e.text}</div>
                  {e.when && <div style={{ fontFamily: mono, fontSize: 10, color: '#aab0b8', marginTop: 2 }}>{e.when}</div>}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...sectionLabel, margin: '8px 0 9px' }}>Attachments</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {attachments.map((a) => (
              <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: mono, fontSize: 11, color: 'var(--tx-secondary-2)', background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 7, padding: '6px 10px' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#c4c9cf' }} />
                {a}
              </span>
            ))}
          </div>
        </div>

        {/* sticky footer */}
        <div style={{ display: 'flex', gap: 9, padding: '13px 18px', borderTop: '1px solid var(--bd-2)', background: '#fff', flex: 'none' }}>
          <button type="button" className="sl-respond-btn" style={{ flex: 1, fontSize: 12.5, fontWeight: 600, padding: 9, borderRadius: 8, border: 'none', background: '#1a1d21', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            Respond
          </button>
          <button type="button" className="sl-icon-btn" style={{ fontSize: 12.5, fontWeight: 550, padding: '9px 14px', borderRadius: 8, border: '1px solid #d7dbe0', background: '#fff', color: 'var(--tx-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Forward
          </button>
          <button type="button" className="sl-icon-btn" style={{ fontSize: 12.5, fontWeight: 550, padding: '9px 14px', borderRadius: 8, border: '1px solid #d7dbe0', background: '#fff', color: 'var(--tx-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Resolve
          </button>
        </div>
      </div>
    </Backdrop>
  )
}
