// Invoice (pay-app) detail drawer (Invoicing, Phase 2): a right drawer (452px,
// position:fixed sibling of the app card — the overlay guardrail) opened by an
// InvoicingView row. Everything reads off the Invoice (the sitelines_invoices view
// already carries the G702 fields — Phase 2 needs no new SQL). Shows the pay app's
// AIA G702 cover sheet (original → net change by COs → revised; completed & stored;
// retainage; earned less retainage; this period; balance to finish) and a
// cross-link to the commitment it bills against (click → opens the existing
// CommitmentDrawer). Reference data; nothing here touches My Court. Dumb UI —
// formatting happens here.

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { TOOLS } from '@/data/tools'
import { formatMoney, formatShortDate, statusTone } from '@/lib/derive'
import { closePatch, navigatePatch } from '@/lib/drawerNav'
import { invoiceHistoryFor, invoiceLinesFor } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useSiteData } from '@/state/DataContext'
import { mono, projectMeta, tone } from '@/theme/tokens'
import type { Invoice, InvoiceLineItem } from '@/types'
import { ProjectTag, StatusPill } from '@/components/ui/primitives'
import { DrawerShell } from './DrawerShell'

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

/** A labeled money figure in a G703 line (label above, mono amount below). */
function SovFig({ label, v, strong = false }: { label: string; v: number; strong?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', minWidth: 0 }}>
      <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.3px', color: 'var(--tx-faint)' }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 680 : 600, color: strong ? 'var(--tx-primary)' : 'var(--tx-secondary)' }}>{formatMoney(v)}</span>
    </span>
  )
}

/** The G703 schedule of values for one pay app — the line-by-line billing, rendered
 *  inline when a pay app is expanded. Each line: description + % bar + this period /
 *  to date + scheduled · retainage · balance. */
function SovLines({ lines }: { lines: InvoiceLineItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 9 }}>
      {lines.map((l) => (
        <div key={l.id} style={{ background: 'var(--fill-1)', border: '1px solid var(--bd-row)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: 'var(--tx-secondary-2)', background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '0 5px', flex: 'none' }}>{l.itemNumber || '—'}</span>
            <span style={{ fontSize: 12, color: 'var(--tx-primary)', lineHeight: 1.35, flex: 1, minWidth: 0 }}>{l.description || '—'}</span>
            <span style={{ fontSize: 10.5, fontFamily: mono, color: 'var(--tx-faint)', flex: 'none' }}>{Math.round(l.pctComplete * 100)}%</span>
          </div>
          <div style={{ marginTop: 6, height: 5, borderRadius: 3, background: 'var(--bd-3)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, Math.max(0, l.pctComplete * 100))}%`, height: '100%', background: projectMeta.opiii.color }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 7 }}>
            <SovFig label="This period" v={l.thisPeriod} strong />
            <div style={{ flex: 1 }} />
            <SovFig label="To date" v={l.billedToDate} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 5, fontSize: 10.5, color: 'var(--tx-faint)' }}>
            <span>Scheduled <span style={{ fontFamily: mono, color: 'var(--tx-tertiary)' }}>{formatMoney(l.scheduledValue)}</span></span>
            <span>Retainage <span style={{ fontFamily: mono, color: 'var(--tx-tertiary)' }}>{formatMoney(l.retainage)}</span></span>
            <span>Balance <span style={{ fontFamily: mono, color: 'var(--tx-tertiary)' }}>{formatMoney(l.balanceToFinish)}</span></span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** One pay-app row in the accordion: number · period · this-period/to-date · status.
 *  Expandable (a rotating ▸ + a "view schedule of values" hint) when it has an SOV;
 *  a plain summary otherwise. The expanded SOV renders as a sibling, below this row. */
function SummaryRow({ h, hasSov, isOpen, isLatest, onToggle }: { h: Invoice; hasSov: boolean; isOpen: boolean; isLatest: boolean; onToggle?: () => void }) {
  const pad = hasSov ? 17 : 0
  const inner = (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {hasSov && (
          <span aria-hidden style={{ display: 'inline-block', width: 9, fontSize: 10, color: 'var(--tx-faint)', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .12s ease', flex: 'none' }}>▸</span>
        )}
        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 650, color: 'var(--tx-secondary-2)', flex: 'none' }}>{h.number}</span>
        <span style={{ fontSize: 12, color: 'var(--tx-tertiary)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.period || (formatShortDate(h.billingDate) ?? '—')}</span>
        {isLatest && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--tx-faint)', flex: 'none' }}>Current</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6, paddingLeft: pad }}>
        <span style={{ fontSize: 11, color: 'var(--tx-tertiary)' }}>This period</span>
        <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--tx-secondary)' }}>{formatMoney(h.thisPeriod)}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--tx-tertiary)' }}>To date</span>
        <span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--tx-secondary)' }}>{formatMoney(h.billedToDate)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, paddingLeft: pad }}>
        {h.status && <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.2px', color: h.status === 'Under Review' ? tone.info.c : 'var(--tx-faint)' }}>{h.status}</span>}
        {hasSov && <span style={{ fontSize: 10, color: 'var(--tx-faint)' }}>· {isOpen ? 'hide' : 'view'} schedule of values</span>}
      </div>
    </>
  )
  if (!onToggle) return <div style={{ padding: '9px 12px' }}>{inner}</div>
  return (
    <button type="button" onClick={onToggle} aria-expanded={isOpen} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
      {inner}
    </button>
  )
}

export function InvoiceDrawer() {
  const { state, patch } = useApp()
  const invoice = state.invoice
  if (!invoice) return null
  return <InvoicePanel key={invoice.id} invoice={invoice} onClose={() => patch(closePatch())} />
}

function InvoicePanel({ invoice: inv, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { patch } = useApp()
  const { commitments, invoices, invoiceLineItems } = useSiteData()
  const commitment = inv.commitmentId ? commitments.find((c) => c.id === inv.commitmentId) : undefined
  // The sub's pay-app chain (current + past), newest first. Each pay app expands to its
  // own G703 schedule of values inline (accordion). SOV is synced for the latest pay app
  // per sub, so a past pay app may have none — those rows aren't expandable.
  const history = invoiceHistoryFor(invoices, inv)
  // Auto-expand the pay app the drawer opened on (if it has an SOV).
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    invoiceLinesFor(invoiceLineItems, inv).length > 0 ? new Set([inv.id]) : new Set(),
  )
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const openCommitment = () => {
    if (commitment) patch((s) => navigatePatch(s, { kind: 'commitment', value: commitment }))
  }

  return (
    <DrawerShell code={TOOLS.invoicing.code} number={inv.number} onClose={onClose}>
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

      {/* pay applications — each one expands to its own G703 schedule of values
          inline; the pay app the drawer opened on is expanded by default */}
      <div style={{ ...sectionLabel, margin: '18px 0 9px' }}>
        {history.length > 1 ? `Pay applications (${history.length})` : 'Schedule of values'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {history.map((h) => {
          const hLines = invoiceLinesFor(invoiceLineItems, h)
          const hasSov = hLines.length > 0
          const isOpen = expanded.has(h.id)
          const opened = h.id === inv.id
          const sovTotal = hLines.reduce((s, l) => s + l.billedToDate, 0)
          return (
            <div key={h.id} style={{ background: opened ? tone.info.bg : '#fff', border: `1px solid ${opened ? tone.info.bd : 'var(--bd-1)'}`, borderRadius: 9, overflow: 'hidden' }}>
              <SummaryRow
                h={h}
                hasSov={hasSov}
                isOpen={isOpen}
                isLatest={h.isLatest}
                onToggle={hasSov ? () => toggle(h.id) : undefined}
              />
              {hasSov && isOpen && (
                <div style={{ padding: '0 12px 11px' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--tx-faint)', margin: '2px 0 0' }}>
                    Schedule of values · {hLines.length} lines · {formatMoney(sovTotal)} to date
                  </div>
                  <SovLines lines={hLines} />
                </div>
              )}
            </div>
          )
        })}
      </div>

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
    </DrawerShell>
  )
}
