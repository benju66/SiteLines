// Record-Detail drawer (README "Overlays"): right drawer, 452px, opened by any
// record row. Meta grid, the real request, responses thread (RFIs — lazily
// fetched via the data provider), cross-tool linked records (click swaps the
// drawer to that record), ball-in-court history, and the sticky
// Respond/Forward/Resolve footer.

import { useEffect, useState } from 'react'
import { TOOLS } from '@/data/tools'
import { closePatch, navigatePatch } from '@/lib/drawerNav'
import { partyContact } from '@/lib/party'
import { resolveLinks } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useData, useSiteData } from '@/state/DataContext'
import { mono, projectMeta, urgency as urgencyMap } from '@/theme/tokens'
import type { ItemDetail, ItemResponse } from '@/types'
import { CodeBadge, ProjectTag, StatusPill, YouPill } from '@/components/ui/primitives'
import { DrawerShell } from './DrawerShell'

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

// Tag on a response: a submittal approver's decision (colored by outcome), or the
// RFI "Official" answer marker.
function ResponseTag({ resp }: { resp: ItemResponse }) {
  const base = {
    fontSize: 8.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    borderRadius: 5,
    padding: '2px 6px',
  } as const
  if (resp.status) {
    const s = resp.status.toLowerCase()
    const tone = /reject|revise|void/.test(s)
      ? { color: '#b4462f', background: '#fbecea', border: '1px solid #f0cfc7' }
      : /approv|for record|closed|complete/.test(s)
        ? { color: '#1f7a4d', background: '#e7f4ec', border: '1px solid #bfe3cd' }
        : { color: '#6b7480', background: '#f1f3f5', border: '1px solid #e2e6ea' }
    return <span style={{ ...base, ...tone }}>{resp.status}</span>
  }
  if (resp.official) {
    return <span style={{ ...base, color: '#1f7a4d', background: '#e7f4ec', border: '1px solid #bfe3cd' }}>Official</span>
  }
  return null
}

export function RecordDetailDrawer() {
  const { state, patch } = useApp()
  const { itemsByTool, contacts } = useSiteData()
  const { getDetail } = useData()
  const detail = state.detail
  const recordId = detail?.record.id ?? null

  // Lazily load the record's request/response thread when the drawer opens (or
  // when it swaps to a linked record). null = source has no enriched detail →
  // fall back to the generated summary below.
  const [thread, setThread] = useState<ItemDetail | null>(null)
  useEffect(() => {
    const rec = detail?.record
    if (!rec) {
      setThread(null)
      return
    }
    let alive = true
    setThread(null)
    getDetail(rec)
      .then((d) => alive && setThread(d))
      .catch(() => alive && setThread(null))
    return () => {
      alive = false
    }
    // Keyed on recordId (stable per open), not the record object (new ref each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, getDetail])

  if (!detail) return null

  const r = detail.record
  const toolMeta = TOOLS[detail.tool]
  const p = projectMeta[r.project]
  const u = urgencyMap[r.urgency]
  const statusLabel = r.status?.label ?? 'Open'
  const party = r.mine ? null : partyContact(contacts, r)
  const links = resolveLinks(itemsByTool, r)
  const close = () => patch(closePatch())

  // The real request comes from Procore (thread.request); fall back to generated
  // prose until it loads or when the source has no enriched detail. BIC history
  // stays generated for now (Phase 1 surfaces request + responses only).
  const desc = `${toolMeta.label.replace(/s$/, '')} on ${p.full}. Currently ${statusLabel.toLowerCase()}; ${
    r.mine ? 'awaiting your action.' : `the ball is with ${r.who}.`
  }`
  const requestText = thread?.request?.trim() ? thread.request : desc
  const history = [
    { text: r.mine ? 'Assigned to you for action' : `${r.who} currently holds the ball`, when: 'now', dot: u.dot },
    { text: `Ben Ostrander opened ${r.num}`, when: r.date, dot: '#c4c9cf' },
    { text: `Filed under ${p.full}`, when: '', dot: '#c4c9cf' },
  ]

  return (
    <DrawerShell
      code={toolMeta.code || 'ITEM'}
      number={r.num}
      onClose={close}
      footer={
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
      }
    >
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
              onClick={() => patch({ tool: 'directory', dirFocus: party.id, ...closePatch() })}
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
        {/* Enriched metadata (RFIs): all assignees + closed date. Rendered as a
            pair so the grid stays rectangular. */}
        {thread && (
          <>
            <MetaCell label="Assignees">
              <span style={{ fontSize: 13, fontWeight: 540, color: '#3c434c', lineHeight: 1.4 }}>{thread.assignees ?? '—'}</span>
            </MetaCell>
            <MetaCell label="Closed">
              <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: thread.closedDate ? '#3c434c' : 'var(--tx-faint)' }}>
                {thread.closedDate ?? '—'}
              </span>
            </MetaCell>
          </>
        )}
      </div>

      {thread?.procoreUrl && (
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <a
            href={thread.procoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, fontWeight: 600, color: '#2f5f8a', textDecoration: 'none' }}
          >
            Open in Procore ↗
          </a>
        </div>
      )}

      {/* Final reviewed submittal — the stamped doc Procore distributed back.
          Surfaced up top, distinct from the submitted Attachments below. Clicking
          opens it in the in-app PDF viewer (SubmittalViewerOverlay) rather than
          downloading; the viewer keeps Download / Open-in-Procore as fallbacks. */}
      {thread?.finalSubmittal && thread.finalSubmittal.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ ...sectionLabel, margin: '0 0 8px', color: '#1f7a4d' }}>Final reviewed submittal</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {thread.finalSubmittal.map((a, i) => (
              <button
                key={i}
                type="button"
                className="sl-final-sub"
                title={`View ${a.name}`}
                onClick={() => patch({ submittalViewer: { id: r.id, name: a.name, downloadUrl: a.url, procoreUrl: thread.procoreUrl } })}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: '#eef8f1', border: '1px solid #bfe3cd', borderRadius: 9, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#1f7a4d', color: '#fff', fontSize: 11, fontWeight: 700, flex: 'none' }}>✓</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 620, color: '#1f5f3d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <span aria-hidden style={{ fontFamily: mono, fontSize: 11, color: '#4a8b68', flex: 'none' }}>⤢</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...sectionLabel, margin: '18px 0 7px' }}>Description</div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: '#3c434c', whiteSpace: 'pre-wrap' }}>{requestText}</p>

      {/* Responses thread — present whenever the source has enriched detail
          (RFIs). Shows "No responses yet." when the request is unanswered. */}
      {thread && (
        <>
          <div style={{ ...sectionLabel, margin: '18px 0 9px' }}>
            Responses{thread.responses.length > 0 ? ` (${thread.responses.length})` : ''}
          </div>
          {thread.responses.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {thread.responses.map((resp, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 9, padding: '11px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: resp.text ? 6 : 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 620, color: 'var(--tx-primary)' }}>{resp.author}</span>
                    <ResponseTag resp={resp} />
                    <div style={{ flex: 1 }} />
                    {resp.date && <span style={{ fontFamily: mono, fontSize: 10, color: '#aab0b8' }}>{resp.date}</span>}
                  </div>
                  {resp.text && <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: '#3c434c', whiteSpace: 'pre-wrap' }}>{resp.text}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx-faint)' }}>No responses yet.</p>
          )}
        </>
      )}

      {/* Real attachments (request + responses). Each opens/downloads the file
          via its pre-signed Procore link; for a guaranteed-fresh copy the user
          can "Open in Procore" above. */}
      {thread && thread.attachments.length > 0 && (
        <>
          <div style={{ ...sectionLabel, margin: '18px 0 9px' }}>Attachments ({thread.attachments.length})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {thread.attachments.map((a, i) => (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                title={a.name}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '100%', fontFamily: mono, fontSize: 11, color: 'var(--tx-secondary-2)', background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 7, padding: '6px 10px', textDecoration: 'none' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#c4c9cf', flex: 'none' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <span style={{ color: '#9aa0a8', flex: 'none' }}>↓</span>
              </a>
            ))}
          </div>
        </>
      )}

      {links.length > 0 && (
        <>
          <div style={{ ...sectionLabel, margin: '18px 0 8px' }}>Linked records</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {links.map((l) => (
              <button
                key={l.id}
                type="button"
                className="sl-linked-row"
                onClick={() => patch((s) => navigatePatch(s, { kind: 'detail', value: { tool: l.tool, record: l } }))}
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
    </DrawerShell>
  )
}
