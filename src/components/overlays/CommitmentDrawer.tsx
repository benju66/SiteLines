// Commitment detail drawer (Commitments, Phase 2): a right drawer (452px,
// position:fixed sibling of the app card — the overlay guardrail) opened by a
// CommitmentsView row. The descriptive side (contract company, financial
// position, description, dates, privacy) reads straight off the Commitment; the
// CO log + billing history are lazily fetched via the data provider
// (getCommitmentDetail), like the drawing viewer's revisions. Contract summary /
// SOV inclusions-exclusions / additional info aren't synced yet — stubbed until
// Phase 3. Reference data; nothing here touches My Court. Dumb UI — formatting
// (money / %) happens here, ordering comes from pure selectors.

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { TOOLS } from '@/data/tools'
import { formatMoney, statusTone } from '@/lib/derive'
import { parseScope, SUBHEADER_LABEL } from '@/lib/parseScope'
import type { ScopeBlock } from '@/lib/parseScope'
import { commitmentBillingsSorted, commitmentChangeOrdersSorted, commitmentSovByCostCode } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useData, useSiteData } from '@/state/DataContext'
import { mono } from '@/theme/tokens'
import type { Commitment, CommitmentDetail } from '@/types'
import { CodeBadge, ProjectTag, StatusPill } from '@/components/ui/primitives'
import { Backdrop } from './Backdrop'

const sectionLabel: CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '.5px',
  color: 'var(--tx-faint-2)',
  fontWeight: 600,
}
const cellLabel: CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--tx-faint)' }
const money: CSSProperties = { fontFamily: mono, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }

/** Signed money — an explicit + on positive CO amounts (− reads as a credit). */
const signedMoney = (n: number) => (n > 0 ? '+' : '') + formatMoney(n)

function MetaCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', padding: '11px 13px', minWidth: 0 }}>
      <div style={cellLabel}>{label}</div>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  )
}

export function CommitmentDrawer() {
  const { state, patch } = useApp()
  const commitment = state.commitment
  if (!commitment) return null
  // Keyed by id so the lazy detail + scroll reset whenever the drawer swaps.
  return <CommitmentPanel key={commitment.id} commitment={commitment} onClose={() => patch({ commitment: null })} />
}

function CommitmentPanel({ commitment: c, onClose }: { commitment: Commitment; onClose: () => void }) {
  const { getCommitmentDetail } = useData()
  const { commitmentLineItems } = useSiteData()
  const [detail, setDetail] = useState<CommitmentDetail | null>(null) // null = still loading
  const [failed, setFailed] = useState(false)

  // SOV line items ride on the main snapshot — filter to this commitment, grouped
  // by cost code (Phase 4). These are the codes the Budget cross-link joins on.
  const sov = commitmentSovByCostCode(commitmentLineItems.filter((li) => li.commitmentId === c.id))
  const sovTotal = sov.reduce((s, g) => s + g.amount, 0)

  useEffect(() => {
    let alive = true
    setDetail(null)
    setFailed(false)
    getCommitmentDetail(c.id)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [c.id, getCommitmentDetail])

  const missing = !c.hasRequisition
  const changeOrders = detail ? commitmentChangeOrdersSorted(detail.changeOrders) : []
  const billings = detail ? commitmentBillingsSorted(detail.billings) : []

  return (
    <Backdrop onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="scry"
        style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 452, maxWidth: '94vw', background: 'var(--card)', boxShadow: '-8px 0 40px rgba(20,25,35,.2)', display: 'flex', flexDirection: 'column' }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px', borderBottom: '1px solid var(--bd-2)', background: '#fff', flex: 'none' }}>
          <CodeBadge code={TOOLS.commitments.code} style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5 }} />
          <span style={{ fontFamily: mono, fontSize: 12.5, fontWeight: 650, color: 'var(--tx-secondary)' }}>{c.number}</span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="sl-icon-btn"
            onClick={onClose}
            style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--bd-1)', background: '#fff', cursor: 'pointer', color: 'var(--tx-secondary-2)', fontSize: 15, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* body */}
        <div className="scry" style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 680, lineHeight: 1.3, letterSpacing: '-.2px' }}>{c.title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <StatusPill label={c.status || '—'} tone={statusTone(c.status, 'track')} />
            <ProjectTag project={c.project} />
            <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--tx-faint)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 5px' }}>{c.type}</span>
            {c.private && <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--tx-faint)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 5px' }}>Private</span>}
          </div>

          {/* contract company + financial position */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e8ebee', border: '1px solid #e8ebee', borderRadius: 9, overflow: 'hidden', marginTop: 16 }}>
            <div style={{ gridColumn: '1 / -1', background: '#fff', padding: '11px 13px' }}>
              <div style={cellLabel}>Contract company</div>
              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: '#3c434c' }}>{c.vendor || '—'}</div>
            </div>
            <MetaCell label="Revised value">
              <span style={{ ...money, color: missing ? 'var(--tx-faint-2)' : 'var(--tx-primary)' }}>{missing ? '—' : formatMoney(c.revised)}</span>
            </MetaCell>
            <MetaCell label="Billed to date">
              <span style={{ ...money, color: missing ? 'var(--tx-faint-2)' : 'var(--tx-primary)' }}>{missing ? '—' : formatMoney(c.billed)}</span>
            </MetaCell>
            <MetaCell label="Retainage held">
              <span style={{ ...money, color: missing ? 'var(--tx-faint-2)' : 'var(--tx-secondary)' }}>{missing ? '—' : formatMoney(c.retainage)}</span>
            </MetaCell>
            <MetaCell label="% complete">
              <span style={{ ...money, color: missing ? 'var(--tx-faint-2)' : 'var(--tx-secondary)' }}>{missing ? '—' : `${Math.round(c.pctComplete * 100)}%`}</span>
            </MetaCell>
            <MetaCell label="Original value">
              <span style={{ ...money, color: missing ? 'var(--tx-faint-2)' : 'var(--tx-secondary)' }}>{missing ? '—' : formatMoney(c.original)}</span>
            </MetaCell>
            <MetaCell label="Executed">
              <span style={{ fontSize: 13, fontWeight: 540, color: '#3c434c' }}>{c.executed ? 'Yes' : 'No'}</span>
            </MetaCell>
          </div>

          {missing && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--tx-faint)' }}>
              No pay application yet — financials appear once the first requisition is billed.
            </div>
          )}

          {/* scope of work — parsed from the flat description into an outline */}
          {c.description.trim() && (
            <>
              <div style={{ ...sectionLabel, margin: '18px 0 7px' }}>Scope of work</div>
              <ScopeOutline blocks={parseScope(c.description)} />
            </>
          )}

          {/* change-order log */}
          <div style={{ ...sectionLabel, margin: '18px 0 9px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span>Change orders{c.coCount > 0 ? ` (${c.coCount})` : ''}</span>
            {c.coCount > 0 && <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 600, color: c.coTotal < 0 ? 'var(--tx-secondary)' : 'var(--tx-faint)', textTransform: 'none', letterSpacing: 0 }}>net {signedMoney(c.coTotal)}</span>}
          </div>
          <Section loading={detail === null && !failed} failed={failed} empty={detail !== null && changeOrders.length === 0} emptyText="No change orders.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {changeOrders.map((co) => (
                <div key={co.id} style={{ background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 9, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 650, color: 'var(--tx-secondary-2)', flex: 'none' }}>CO {co.number}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--tx-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }} title={co.title}>{co.title}</span>
                    <span style={{ ...money, fontSize: 12, color: co.amount < 0 ? 'var(--tx-secondary)' : 'var(--tx-primary)', flex: 'none' }}>{signedMoney(co.amount)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.2px', color: co.executed ? '#2c7a4f' : 'var(--tx-faint)' }}>{co.executed ? 'Executed' : co.status || 'Pending'}</span>
                    {co.date && <span style={{ fontFamily: mono, fontSize: 10, color: '#aab0b8' }}>· {co.date}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* billing history */}
          <div style={{ ...sectionLabel, margin: '18px 0 9px' }}>Billing history{billings.length > 0 ? ` (${billings.length})` : ''}</div>
          <Section loading={detail === null && !failed} failed={failed} empty={detail !== null && billings.length === 0} emptyText="No pay applications yet.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {billings.map((b) => (
                <div key={b.id} style={{ background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 9, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 620, color: 'var(--tx-primary)', flex: 'none' }}>Pay app {b.number}</span>
                    <span style={{ fontSize: 11, color: 'var(--tx-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }} title={b.period}>{b.period}</span>
                    <span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--tx-faint)', flex: 'none' }}>{Math.round(b.pctComplete * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--tx-tertiary)' }}>Billed to date</span>
                    <span style={{ ...money, fontSize: 11.5, color: 'var(--tx-secondary)' }}>{formatMoney(b.billedToDate)}</span>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: 'var(--tx-tertiary)' }}>This period</span>
                    <span style={{ ...money, fontSize: 11.5, color: 'var(--tx-secondary)' }}>{formatMoney(b.thisPeriod)}</span>
                  </div>
                  {b.invoiceNumber && <div style={{ fontFamily: mono, fontSize: 9.5, color: '#aab0b8', marginTop: 5 }}>{b.invoiceNumber}</div>}
                </div>
              ))}
            </div>
          </Section>

          {/* schedule of values — the synced SOV line items grouped by cost code (Phase 4) */}
          {sov.length > 0 && (
            <>
              <div style={{ ...sectionLabel, margin: '18px 0 9px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span>Schedule of values</span>
                <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 600, color: 'var(--tx-faint)', textTransform: 'none', letterSpacing: 0 }}>{formatMoney(sovTotal)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {sov.map((g) => (
                  <div key={g.costCode} style={{ background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 9, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--bd-row)', background: 'var(--fill-1)' }}>
                      <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, color: 'var(--tx-secondary-2)', background: 'var(--fill-3)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 6px', flex: 'none' }}>{g.costCode}</span>
                      <span style={{ fontSize: 12, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }} title={g.costCodeName}>{g.costCodeName}</span>
                      <span style={{ ...money, fontSize: 12 }}>{formatMoney(g.amount)}</span>
                    </div>
                    {g.lineItems.map((li) => (
                      <div key={li.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 12px', borderTop: '1px solid var(--bd-row)' }}>
                        <span style={{ fontSize: 12, color: 'var(--tx-secondary)', lineHeight: 1.4, flex: 1, minWidth: 0 }}>{li.description || '—'}</span>
                        <span style={{ fontFamily: mono, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: li.amount === 0 ? 'var(--tx-faint-2)' : 'var(--tx-secondary)', flex: 'none' }}>{formatMoney(li.amount)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* inclusions / exclusions — real scope fields from the commitment detail sync (Phase 4) */}
          {c.inclusions.trim() && (
            <>
              <div style={{ ...sectionLabel, margin: '18px 0 7px' }}>Inclusions</div>
              <ScopeOutline blocks={parseScope(c.inclusions)} />
            </>
          )}
          {c.exclusions.trim() && (
            <>
              <div style={{ ...sectionLabel, margin: '18px 0 7px' }}>Exclusions</div>
              <ScopeOutline blocks={parseScope(c.exclusions)} />
            </>
          )}

          {/* nothing scope-related synced for this commitment */}
          {sov.length === 0 && !c.inclusions.trim() && !c.exclusions.trim() && (
            <>
              <div style={{ ...sectionLabel, margin: '18px 0 8px' }}>Contract scope</div>
              <div style={{ background: 'var(--fill-1)', border: '1px dashed var(--bd-2)', borderRadius: 9, padding: '12px 13px', fontSize: 11.5, color: 'var(--tx-faint)', lineHeight: 1.5 }}>
                No schedule of values, inclusions, or exclusions recorded on this commitment in Procore.
              </div>
            </>
          )}
        </div>
      </div>
    </Backdrop>
  )
}

/**
 * Render the parsed scope outline: ALL-CAPS headings, numbered sections and
 * clauses (indented), best-effort sub-bullets, and any unstructured prose as
 * plain paragraphs. The parser degrades a marker-less description to a single
 * 'para', so this reads as the old flat paragraph when there's no structure.
 */
function ScopeOutline({ blocks }: { blocks: ScopeBlock[] }) {
  return (
    <div>
      {blocks.map((b, i) => {
        if (b.kind === 'para') {
          return (
            <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0', fontSize: 12.5, lineHeight: 1.55, color: '#3c434c' }}>
              {renderProse(b.text)}
            </p>
          )
        }
        if (b.kind === 'heading') {
          return (
            <div key={i} style={{ margin: '14px 0 5px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.5px', color: 'var(--tx-tertiary)' }}>
              {b.text}
            </div>
          )
        }
        if (b.kind === 'lineitem') {
          // A Schedule-of-Values cost-code section: the code in a mono badge + its
          // title, as a distinct divider (these are the codes the Budget cross-link
          // will join on).
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '14px 0 5px', paddingBottom: 5, borderBottom: '1px solid var(--bd-row)' }}>
              <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: 'var(--tx-secondary-2)', background: 'var(--fill-3)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 6px', flex: 'none' }}>{b.marker}</span>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--tx-primary)' }}>{b.text}</span>
            </div>
          )
        }
        const isSection = b.kind === 'section'
        return (
          <div key={i} style={{ display: 'flex', gap: 8, marginTop: isSection ? 9 : 5, paddingLeft: isSection ? 0 : 16 }}>
            <span style={{ fontFamily: mono, fontSize: isSection ? 11.5 : 11, fontWeight: 650, color: isSection ? 'var(--tx-primary)' : 'var(--tx-tertiary)', flex: 'none', minWidth: isSection ? 14 : 26 }}>
              {b.marker}
            </span>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, fontWeight: isSection ? 650 : 400, color: isSection ? 'var(--tx-primary)' : '#3c434c' }}>{b.text}</span>
              {b.bullets.length > 0 && (
                <ul style={{ margin: '4px 0 0', paddingLeft: 16, listStyle: 'none' }}>
                  {b.bullets.map((item, j) => (
                    <li key={j} style={{ position: 'relative', fontSize: 12, lineHeight: 1.5, color: '#3c434c', paddingLeft: 12, marginTop: 2 }}>
                      <span aria-hidden style={{ position: 'absolute', left: 0, color: 'var(--tx-faint)' }}>•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Render a prose block, bolding inline Title-case sub-labels ("Kitchen
 * Cabinets:", "Hardware:") — the sub-headers Procore's ordered lists collapse to
 * once the sync strips their numbering. Pure emphasis, never a structural split,
 * so a mis-detected label is harmless. Applied to prose blocks only (numbered
 * GENERAL REQUIREMENTS clauses render elsewhere and keep their colons unbolded).
 */
function renderProse(text: string): ReactNode[] {
  const re = new RegExp(SUBHEADER_LABEL.source, 'g')
  const nodes: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const label = m[1]
    const start = m.index + m[0].length - label.length // skip the leading separator char
    if (start > last) nodes.push(text.slice(last, start))
    nodes.push(
      <strong key={start} style={{ fontWeight: 650, color: 'var(--tx-primary)' }}>
        {label}
      </strong>,
    )
    last = start + label.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/** Loading / error / empty wrapper for a lazily-loaded drawer section. */
function Section({ loading, failed, empty, emptyText, children }: { loading: boolean; failed: boolean; empty: boolean; emptyText: string; children: ReactNode }) {
  if (loading) return <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-faint)' }}>Loading…</p>
  if (failed) return <p style={{ margin: 0, fontSize: 12, color: '#b23c0e' }}>Couldn’t load — try reopening.</p>
  if (empty) return <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx-faint)' }}>{emptyText}</p>
  return <>{children}</>
}
