// Change Event detail drawer (Change Events, Phase 2): a right drawer (452px,
// position:fixed sibling of the app card — the overlay guardrail) opened by a
// ChangeEventsView row. Everything reads off the ChangeEvent + the
// changeEventLineItems slice (loaded in the main snapshot, not lazily) — no
// network. Shows the event's header, its priced line items grouped by cost code
// (subtotals reconcile to estCost), the commitment each line hits (click → opens
// the existing CommitmentDrawer, the Change-Event → Commitment cross-link), and —
// for an OPEN event — a note that its estimated cost feeds Budget's pending-change
// forecast. Reference data; nothing here touches My Court. Dumb UI — formatting
// happens here, grouping comes from the pure changeEventLineGroups selector.

import type { CSSProperties, ReactNode } from 'react'
import { TOOLS } from '@/data/tools'
import { formatMoney, statusTone } from '@/lib/derive'
import { closePatch, navigatePatch } from '@/lib/drawerNav'
import { changeEventLineGroups } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, tone } from '@/theme/tokens'
import type { ChangeEvent, Commitment } from '@/types'
import { ProjectTag, StatusPill } from '@/components/ui/primitives'
import { DrawerShell } from './DrawerShell'

const sectionLabel: CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-faint-2)', fontWeight: 600 }
const cellLabel: CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--tx-faint)' }
const money: CSSProperties = { fontFamily: mono, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }

/** Signed money with an explicit +/− (a de-scope credit reads −); zero → "—". */
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + formatMoney(Math.abs(n))
const moneyColor = (n: number) => (n < 0 ? tone.ok.c : n > 0 ? 'var(--tx-primary)' : 'var(--tx-faint-2)')

/** A muted uppercase attribute chip (scope / funding / provenance). */
function Chip({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--tx-faint)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 5px' }}>{children}</span>
}

function MetaCell({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div style={{ background: '#fff', padding: '11px 13px', minWidth: 0, ...(full ? { gridColumn: '1 / -1' } : null) }}>
      <div style={cellLabel}>{label}</div>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  )
}

export function ChangeEventDrawer() {
  const { state, patch } = useApp()
  const event = state.changeEvent
  if (!event) return null
  // Keyed by id so the scroll + derived data reset whenever the drawer swaps.
  return <ChangeEventPanel key={event.id} event={event} onClose={() => patch(closePatch())} />
}

function ChangeEventPanel({ event: e, onClose }: { event: ChangeEvent; onClose: () => void }) {
  const { patch } = useApp()
  const { changeEventLineItems, commitments } = useSiteData()

  const lines = changeEventLineItems.filter((li) => li.changeEventId === e.id)
  const groups = changeEventLineGroups(lines)
  const lineTotal = groups.reduce((s, g) => s + g.amount, 0)
  const byId = new Map<string, Commitment>(commitments.map((c) => [c.id, c] as const))

  // Cross-link: open the commitment a line hits in the existing CommitmentDrawer,
  // pushing this change event onto the Back stack.
  const openCommitment = (commitmentId: string | null) => {
    if (!commitmentId) return
    const c = byId.get(commitmentId)
    if (c) patch((s) => navigatePatch(s, { kind: 'commitment', value: c }))
  }

  const isOpen = e.status.toLowerCase() === 'open'

  return (
    <DrawerShell code={TOOLS.changeEvents.code} number={e.number} onClose={onClose}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 680, lineHeight: 1.3, letterSpacing: '-.2px' }}>{e.title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <StatusPill label={e.status || '—'} tone={statusTone(e.status, 'track')} />
        <ProjectTag project={e.project} />
        {e.scope && <Chip>{e.scope}</Chip>}
        {e.type && <Chip>{e.type}</Chip>}
        {e.originRfi && <Chip>From RFI</Chip>}
      </div>

      {/* estimated cost + counts + reason */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e8ebee', border: '1px solid #e8ebee', borderRadius: 9, overflow: 'hidden', marginTop: 16 }}>
        <MetaCell label="Estimated cost">
          <span style={{ ...money, color: moneyColor(e.estCost) }}>{e.estCost === 0 ? '—' : signed(e.estCost)}</span>
        </MetaCell>
        <MetaCell label="Status">
          <span style={{ fontSize: 13, fontWeight: 540, color: '#3c434c' }}>{e.status || '—'}</span>
        </MetaCell>
        <MetaCell label="Line items">
          <span style={{ ...money, color: 'var(--tx-secondary)' }}>{e.lineItems}</span>
        </MetaCell>
        <MetaCell label="Commitments hit">
          <span style={{ ...money, color: e.commitments > 0 ? 'var(--tx-secondary)' : 'var(--tx-faint-2)' }}>{e.commitments || '—'}</span>
        </MetaCell>
        {e.reason && (
          <MetaCell label="Change reason" full>
            <span style={{ fontSize: 13, fontWeight: 540, color: '#3c434c' }}>{e.reason}</span>
          </MetaCell>
        )}
        {e.createdAt && (
          <MetaCell label="Created" full>
            <span style={{ fontSize: 12.5, color: 'var(--tx-secondary)' }}>{e.createdAt}</span>
          </MetaCell>
        )}
      </div>

      {/* open-event tie-back to Budget's pending-change forecast */}
      {isOpen && e.estCost !== 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start', background: tone.info.bg, border: `1px solid ${tone.info.bd}`, borderRadius: 8, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.5, color: tone.info.c }}>
          <span aria-hidden style={{ flex: 'none', fontSize: 12 }}>↳</span>
          <span>
            This change is <b>open</b> — its estimated <b>{signed(e.estCost)}</b> is included in the Budget tool’s pending-change forecast until it’s closed into a change order.
          </span>
        </div>
      )}

      {/* description */}
      {e.description && (
        <>
          <div style={{ ...sectionLabel, margin: '18px 0 7px' }}>Description</div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: '#3c434c' }}>{e.description}</p>
        </>
      )}

      {/* priced line items, grouped by cost code (subtotals reconcile to estimated cost) */}
      <div style={{ ...sectionLabel, margin: '18px 0 9px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span>Line items{lines.length > 0 ? ` (${lines.length})` : ''}</span>
        {lines.length > 0 && <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 600, color: moneyColor(lineTotal), textTransform: 'none', letterSpacing: 0 }}>{signed(lineTotal)}</span>}
      </div>
      {lines.length === 0 ? (
        <div style={{ background: 'var(--fill-1)', border: '1px dashed var(--bd-2)', borderRadius: 9, padding: '12px 13px', fontSize: 11.5, color: 'var(--tx-faint)', lineHeight: 1.5 }}>
          No priced line items recorded on this change event in Procore.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {groups.map((g) => (
            <div key={g.costCode || 'unassigned'} style={{ background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--bd-row)', background: 'var(--fill-1)' }}>
                <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, color: g.costCode ? 'var(--tx-secondary-2)' : 'var(--tx-faint)', background: 'var(--fill-3)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 6px', flex: 'none' }}>{g.costCode || 'Unassigned'}</span>
                <span style={{ fontSize: 12, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }} title={g.costCodeName}>{g.costCodeName}</span>
                <span style={{ ...money, fontSize: 12, color: moneyColor(g.amount) }}>{signed(g.amount)}</span>
              </div>
              {g.lineItems.map((li) => {
                const commitment = li.commitmentId ? byId.get(li.commitmentId) : undefined
                return (
                  <div key={li.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 12px', borderTop: '1px solid var(--bd-row)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12, color: 'var(--tx-secondary)', lineHeight: 1.4 }}>{li.description || '—'}</span>
                      {li.commitmentNumber && (
                        <div style={{ marginTop: 3 }}>
                          {commitment ? (
                            <button
                              type="button"
                              className="sl-ce-sub"
                              onClick={() => openCommitment(li.commitmentId)}
                              style={{ fontFamily: mono, fontSize: 10, fontWeight: 650, color: tone.info.c, background: tone.info.bg, border: `1px solid ${tone.info.bd}`, borderRadius: 4, padding: '1px 6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title={`Open ${commitment.vendor || li.commitmentNumber}`}
                            >
                              {li.commitmentNumber} ↗
                            </button>
                          ) : (
                            <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 650, color: 'var(--tx-faint)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 6px' }}>{li.commitmentNumber}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <span style={{ fontFamily: mono, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: moneyColor(li.amount), flex: 'none' }}>{signed(li.amount)}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </DrawerShell>
  )
}
