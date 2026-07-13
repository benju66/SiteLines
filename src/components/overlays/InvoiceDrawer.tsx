// Invoice (pay-app) detail drawer (Invoicing, Phase 2): a right drawer (452px,
// position:fixed sibling of the app card — the overlay guardrail) opened by an
// InvoicingView row. Everything reads off the Invoice (the sitelines_invoices view
// already carries the G702 fields — Phase 2 needs no new SQL). Shows the pay app's
// AIA G702 cover sheet (original → net change by COs → revised; completed & stored;
// retainage; earned less retainage; this period; balance to finish) and a
// cross-link to the commitment it bills against (click → opens the existing
// CommitmentDrawer). Reference data; nothing here touches My Court. Dumb UI —
// formatting happens here.

import type { CSSProperties, ReactNode } from 'react'
import { TOOLS } from '@/data/tools'
import { formatMoney, formatShortDate, statusTone } from '@/lib/derive'
import { invoiceHistoryFor } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, tone } from '@/theme/tokens'
import type { Invoice } from '@/types'
import { CodeBadge, ProjectTag, StatusPill } from '@/components/ui/primitives'
import { Backdrop } from './Backdrop'

const cellLabel: CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--tx-faint)' }
const sectionLabel: CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-faint-2)', fontWeight: 600 }
const money: CSSProperties = { fontFamily: mono, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }

function MetaCell({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div style={{ background: '#fff', padding: '11px 13px', minWidth: 0, ...(full ? { gridColumn: '1 / -1' } : null) }}>
      <div style={cellLabel}>{label}</div>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  )
}

/** One G702 cover-sheet line: label left, mono amount right. `strong` for the
 *  running-total rows; `deduct` renders a retainage deduction in parentheses. */
function G702Line({ label, value, strong = false, deduct = false }: { label: string; value: number; strong?: boolean; deduct?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: '1px solid var(--bd-row)' }}>
      <span style={{ fontSize: 12, color: strong ? 'var(--tx-primary)' : 'var(--tx-secondary)', fontWeight: strong ? 650 : 400 }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 680 : 600, color: deduct ? tone.warn.c : 'var(--tx-primary)', whiteSpace: 'nowrap' }}>
        {deduct ? `(${formatMoney(value)})` : formatMoney(value)}
      </span>
    </div>
  )
}

export function InvoiceDrawer() {
  const { state, patch } = useApp()
  const invoice = state.invoice
  if (!invoice) return null
  return <InvoicePanel key={invoice.id} invoice={invoice} onClose={() => patch({ invoice: null })} />
}

function InvoicePanel({ invoice: inv, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { patch } = useApp()
  const { commitments, invoices } = useSiteData()
  const commitment = inv.commitmentId ? commitments.find((c) => c.id === inv.commitmentId) : undefined
  // The sub's full pay-app chain (current + past) — click one to switch the drawer.
  const history = invoiceHistoryFor(invoices, inv)

  const openCommitment = () => {
    if (commitment) patch({ invoice: null, commitment })
  }

  return (
    <Backdrop onClose={onClose}>
      <div
        onClick={(ev) => ev.stopPropagation()}
        className="scry"
        style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 452, maxWidth: '94vw', background: 'var(--card)', boxShadow: '-8px 0 40px rgba(20,25,35,.2)', display: 'flex', flexDirection: 'column' }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px', borderBottom: '1px solid var(--bd-2)', background: '#fff', flex: 'none' }}>
          <CodeBadge code={TOOLS.invoicing.code} style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5 }} />
          <span style={{ fontFamily: mono, fontSize: 12.5, fontWeight: 650, color: 'var(--tx-secondary)' }}>{inv.number}</span>
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
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 680, lineHeight: 1.3, letterSpacing: '-.2px' }}>{inv.vendor || inv.contract || 'Pay application'}</h2>
          {inv.contract && inv.vendor && <div style={{ fontSize: 12.5, color: 'var(--tx-tertiary)', marginTop: 3 }}>{inv.contract}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <StatusPill label={inv.status || '—'} tone={statusTone(inv.status, 'track')} />
            <ProjectTag project={inv.project} />
            {inv.final && <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--tx-faint)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 5px' }}>Final</span>}
          </div>

          {/* period + this-period + % */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e8ebee', border: '1px solid #e8ebee', borderRadius: 9, overflow: 'hidden', marginTop: 16 }}>
            <MetaCell label="This period due">
              <span style={{ ...money, color: 'var(--tx-primary)' }}>{formatMoney(inv.thisPeriod)}</span>
            </MetaCell>
            <MetaCell label="% complete">
              <span style={{ ...money, color: 'var(--tx-secondary)' }}>{Math.round(inv.pctComplete * 100)}%</span>
            </MetaCell>
            <MetaCell label="Billing period">
              <span style={{ fontSize: 12.5, color: '#3c434c' }}>{inv.period || '—'}</span>
            </MetaCell>
            <MetaCell label="Billing date">
              <span style={{ fontSize: 12.5, color: '#3c434c' }}>{formatShortDate(inv.billingDate) ?? '—'}</span>
            </MetaCell>
          </div>

          {/* AIA G702 cover sheet */}
          <div style={{ ...sectionLabel, margin: '18px 0 4px' }}>G702 summary</div>
          <div style={{ background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 9, padding: '4px 13px 8px' }}>
            <G702Line label="Original contract sum" value={inv.original} />
            <G702Line label="Net change by change orders" value={inv.netChangeByCOs} />
            <G702Line label="Contract sum to date" value={inv.revised} strong />
            <G702Line label="Completed & stored to date" value={inv.billedToDate} />
            <G702Line label="Retainage held" value={inv.retainage} deduct />
            <G702Line label="Total earned less retainage" value={inv.earnedLessRetainage} strong />
            <G702Line label="Balance to finish (incl. retainage)" value={inv.balanceToFinish} />
          </div>

          {/* billing history — the sub's current + past pay apps; click to switch */}
          {history.length > 1 && (
            <>
              <div style={{ ...sectionLabel, margin: '18px 0 9px' }}>Billing history ({history.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {history.map((h) => {
                  const viewing = h.id === inv.id
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => !viewing && patch({ invoice: h })}
                      style={{ textAlign: 'left', background: viewing ? tone.info.bg : '#fff', border: `1px solid ${viewing ? tone.info.bd : 'var(--bd-1)'}`, borderRadius: 9, padding: '9px 12px', cursor: viewing ? 'default' : 'pointer', fontFamily: 'inherit' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 650, color: 'var(--tx-secondary-2)', flex: 'none' }}>{h.number}</span>
                        <span style={{ fontSize: 12, color: 'var(--tx-tertiary)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.period || (formatShortDate(h.billingDate) ?? '—')}</span>
                        {viewing ? (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase', color: tone.info.c, flex: 'none' }}>Viewing</span>
                        ) : h.isLatest ? (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--tx-faint)', flex: 'none' }}>Current</span>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--tx-tertiary)' }}>This period</span>
                        <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--tx-secondary)' }}>{formatMoney(h.thisPeriod)}</span>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 11, color: 'var(--tx-tertiary)' }}>To date</span>
                        <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--tx-secondary)' }}>{formatMoney(h.billedToDate)}</span>
                      </div>
                      {h.status && <div style={{ marginTop: 5, fontSize: 10, fontWeight: 600, letterSpacing: '.2px', color: h.status === 'Under Review' ? tone.info.c : 'var(--tx-faint)' }}>{h.status}</div>}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* cross-link: the commitment this pay app bills against */}
          {inv.commitmentId && (
            <>
              <div style={{ ...sectionLabel, margin: '18px 0 7px' }}>Bills against</div>
              {commitment ? (
                <button
                  type="button"
                  className="sl-ce-sub"
                  onClick={openCommitment}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 9, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                  title={`Open ${commitment.number}`}
                >
                  <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: 'var(--tx-secondary-2)', background: 'var(--fill-3)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 6px', flex: 'none' }}>{commitment.number}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--tx-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{commitment.title || commitment.vendor}</span>
                  <span style={{ fontSize: 11, fontWeight: 650, color: tone.info.c, flex: 'none' }}>Open ↗</span>
                </button>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--tx-faint)' }}>Commitment {inv.commitmentId.replace('commitments:', '#')}</div>
              )}
            </>
          )}

          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--tx-faint)', lineHeight: 1.5 }}>
            Subcontractor pay application (money out). Owner billing is tracked separately in Procore.
          </div>
        </div>
      </div>
    </Backdrop>
  )
}
