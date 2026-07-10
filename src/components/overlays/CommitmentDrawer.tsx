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
import { applyScopeOverride, computeOrdinals } from '@/lib/applyScopeOverride'
import { formatMoney, statusTone } from '@/lib/derive'
import { hashText } from '@/lib/hashText'
import type { ScopeBlock } from '@/lib/parseScope'
import { proseEmphasis } from '@/lib/proseEmphasis'
import { addNote, dropEmptyNotes, mergeUp, partitionsSource, reindent, removeNote, seedEditorBlocks, setKind, setList, setNoteText, splitBlock, toggleBold } from '@/lib/scopeEdit'
import { overrideKey } from '@/lib/userDataSource'
import { commitmentBillingsSorted, commitmentChangeOrdersSorted, commitmentSovByCostCode } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useData, useSiteData } from '@/state/DataContext'
import { useUserData } from '@/state/UserDataContext'
import { mono, tone } from '@/theme/tokens'
import type { Commitment, CommitmentDetail, ScopeBlockOverride, ScopeField, ScopeOverride } from '@/types'
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
// The one emphasis style, shared by the auto-bolded sub-labels AND manual word-level
// bold (Phase 6c) so both render identically — one token source, no ad-hoc hex.
const strong: CSSProperties = { fontWeight: 650, color: 'var(--tx-primary)' }

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
  const { overrides } = useUserData()
  const [detail, setDetail] = useState<CommitmentDetail | null>(null) // null = still loading
  const [failed, setFailed] = useState(false)

  // The user-authored structure override for a scope field (Phase 5b), if any.
  const overrideFor = (field: ScopeField): ScopeOverride | undefined => overrides[overrideKey(c.id, field)]

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

          {/* scope of work — a saved structure override if present + fresh, else the
              parser outline; a stale override falls back to the parser with a banner.
              "Edit structure" (Phase 5c) opens the inline editor. */}
          <ScopeFieldSection commitmentId={c.id} field="description" label="Scope of work" source={c.description} override={overrideFor('description')} />

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

          {/* inclusions / exclusions — real scope fields from the commitment detail
              sync (Phase 4), each with its own optional structure override (Phase 5b/5c) */}
          <ScopeFieldSection commitmentId={c.id} field="inclusions" label="Inclusions" source={c.inclusions} override={overrideFor('inclusions')} />
          <ScopeFieldSection commitmentId={c.id} field="exclusions" label="Exclusions" source={c.exclusions} override={overrideFor('exclusions')} />

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

// One indent level, in px — used for override blocks that carry an explicit
// `indent` (Phase 5b). Clamped so a malformed depth can't push text off-panel.
const INDENT_STEP = 16
const indentPx = (indent?: number) => Math.min(Math.max(indent ?? 0, 0), 6) * INDENT_STEP

/**
 * The presentation-only list marker (Phase 6a): a `•` for a bullet, the computed
 * ordinal for a numbered block. Shared by the rendered outline AND the editor's live
 * preview so the two never diverge. `minWidth` fits a two-digit ordinal ("10.").
 */
function ListMarker({ list, ordinal }: { list: 'bullet' | 'number'; ordinal?: number }) {
  const isNum = list === 'number'
  return (
    <span
      aria-hidden={!isNum}
      style={{
        flex: 'none',
        textAlign: isNum ? 'right' : 'left',
        minWidth: isNum ? 20 : 10,
        fontFamily: isNum ? mono : undefined,
        fontSize: isNum ? 11.5 : 12.5,
        fontWeight: isNum ? 650 : 400,
        lineHeight: 1.55,
        color: isNum ? 'var(--tx-tertiary)' : 'var(--tx-faint)',
      }}
    >
      {isNum ? `${ordinal ?? ''}.` : '•'}
    </span>
  )
}

/**
 * A commitment scope field: a saved structure override when present + fresh, else
 * the parser outline (Phase 5b). A stale override (its source text changed in
 * Procore since it was saved) falls back to the parser and shows a banner. Renders
 * nothing when the source field is empty. "Edit structure" opens the inline editor
 * (Phase 5c).
 */
function ScopeFieldSection({ commitmentId, field, label, source, override }: { commitmentId: string; field: ScopeField; label: string; source: string; override?: ScopeOverride }) {
  const [editing, setEditing] = useState(false)
  if (!source.trim()) return null
  const render = applyScopeOverride(source, override)
  return (
    <>
      <div style={{ ...sectionLabel, margin: '18px 0 7px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span>{label}</span>
        {!editing && (
          <button
            type="button"
            className="sl-scope-edit"
            onClick={() => setEditing(true)}
            style={{ fontFamily: 'inherit', fontSize: 10, fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: 'var(--tx-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Edit structure
          </button>
        )}
      </div>
      {editing ? (
        <ScopeStructureEditor commitmentId={commitmentId} field={field} source={source} override={override} onClose={() => setEditing(false)} />
      ) : (
        <>
          {render.stale && <StaleBanner />}
          <ScopeOutline blocks={render.blocks} />
        </>
      )}
    </>
  )
}

/**
 * The inline "Edit structure" editor (Phase 5c). Works on a local copy of the block
 * list via the pure ops in scopeEdit — WORDS ARE LOCKED, only structure changes:
 * click a word to break the line before it, toggle heading/para, indent/outdent,
 * merge into the previous line. On save it asserts the partition invariant, then
 * writes through the UserData seam; "Reset to auto" deletes the override so the
 * field falls back to the parser. Seeds from a fresh override, else a sentence
 * segmentation of the source.
 */
function ScopeStructureEditor({ commitmentId, field, source, override, onClose }: { commitmentId: string; field: ScopeField; source: string; override?: ScopeOverride; onClose: () => void }) {
  const { saveOverride, deleteOverride } = useUserData()
  const [blocks, setBlocks] = useState<ScopeBlockOverride[]>(() => seedEditorBlocks(source, override))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bold mode (Phase 6c): while on, a word-click toggles that word's bold instead of
  // splitting the line. Presentation only — bold marks EXISTING words, never typed text.
  const [boldMode, setBoldMode] = useState(false)

  const edit = (fn: (b: ScopeBlockOverride[]) => ScopeBlockOverride[]) => setBlocks((b) => fn(b))

  const run = async (op: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await op()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    // Drop blank notes (a stray "Add note" click) before saving so they never persist.
    const cleaned = dropEmptyNotes(blocks)
    // The safety assertion: the pure ops guarantee the CONTRACT blocks still spell out
    // the source (notes are excluded), so a failure means a bug — refuse the save rather
    // than let the rendered contract scope diverge from what was executed.
    if (!partitionsSource(cleaned, source)) {
      setError('Safety check failed: the structure no longer matches the contract words. Not saved.')
      return
    }
    void run(() => saveOverride({ commitmentId, field, blocks: cleaned, sourceHash: hashText(source) }))
  }

  return (
    <div style={{ border: '1px solid var(--bd-2)', borderRadius: 9, padding: 10, background: 'var(--fill-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', color: boldMode ? 'var(--accent)' : 'var(--tx-tertiary)', textTransform: 'uppercase' }}>
          {boldMode ? 'Bold mode' : 'Editing structure'}
        </span>
        <BoldToggle active={boldMode} onClick={() => setBoldMode((m) => !m)} />
        <div style={{ flex: 1 }} />
        <EditorBtn onClick={save} disabled={busy} primary>
          {busy ? 'Saving…' : 'Save'}
        </EditorBtn>
        <EditorBtn onClick={onClose} disabled={busy}>
          Cancel
        </EditorBtn>
        <EditorBtn onClick={() => void run(() => deleteOverride(commitmentId, field))} disabled={busy}>
          Reset to auto
        </EditorBtn>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--tx-faint)', lineHeight: 1.5, marginBottom: 8 }}>
        {boldMode
          ? 'Click any word to bold or unbold it — the words stay locked. Click B again to go back to restructuring.'
          : 'The words are locked — you only restructure. Click a word to break the line before it. Add your own notes below.'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(() => {
          // Live ordinals via the shared rule, so a numbered block previews its real
          // number (1·2·3) as you toggle — matching the saved outline exactly.
          const ordinals = computeOrdinals(blocks)
          return blocks.map((b, i) => (
            <EditorBlockRow
              key={i}
              block={b}
              ordinal={ordinals[i]}
              canMerge={i > 0}
              boldMode={boldMode}
              onSplit={(wi) => edit((bl) => splitBlock(bl, i, wi))}
              onMerge={() => edit((bl) => mergeUp(bl, i))}
              onKind={(k) => edit((bl) => setKind(bl, i, k))}
              onIndent={(d) => edit((bl) => reindent(bl, i, d))}
              onList={(l) => edit((bl) => setList(bl, i, l))}
              onBold={(wi) => edit((bl) => toggleBold(bl, i, wi))}
              onNoteText={(t) => edit((bl) => setNoteText(bl, i, t))}
              onDelete={() => edit((bl) => removeNote(bl, i))}
            />
          ))
        })()}
      </div>
      {/* Add note (Phase 6b): appends an empty note — the ONE place typing is allowed.
          The contract words stay locked; notes render clearly marked as your additions. */}
      <button
        type="button"
        onClick={() => edit((bl) => addNote(bl, bl.length - 1))}
        className="sl-add-note"
        style={{ marginTop: 6, width: '100%', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 6, border: `1px dashed ${tone.info.bd}`, background: tone.info.bg, color: tone.info.c, cursor: 'pointer' }}
      >
        + Add note
      </button>
      {error && <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.45, color: tone.danger.c }}>{error}</div>}
    </div>
  )
}

/** One editable block: a control cluster + the block's words. Out of bold mode a
 *  word-click splits the line before it (Phase 5c); in bold mode a word-click toggles
 *  that word's bold (Phase 6c). Bold words preview bold live on paragraphs. A user note
 *  (Phase 6b, `source:'user'`) renders instead as a tinted, labelled text input — the
 *  ONE place typing is allowed — with indent / list / delete but no split/heading/bold. */
function EditorBlockRow({ block, ordinal, canMerge, boldMode, onSplit, onMerge, onKind, onIndent, onList, onBold, onNoteText, onDelete }: { block: ScopeBlockOverride; ordinal?: number; canMerge: boolean; boldMode: boolean; onSplit: (wordIndex: number) => void; onMerge: () => void; onKind: (kind: ScopeBlockOverride['kind']) => void; onIndent: (delta: number) => void; onList: (list: ScopeBlockOverride['list']) => void; onBold: (wordIndex: number) => void; onNoteText: (text: string) => void; onDelete: () => void }) {
  const isHeading = block.kind === 'heading'
  // The list-style cycle (Phase 6a): plain → bullet → number → plain. Presentation
  // only, and rendered on paragraphs — disabled on a heading (unaffected by lists).
  const nextList: ScopeBlockOverride['list'] = block.list === 'bullet' ? 'number' : block.list === 'number' ? undefined : 'bullet'

  if (block.source === 'user') {
    const noteListTitle = block.list === 'bullet' ? 'Bulleted — click to number' : block.list === 'number' ? 'Numbered — click to remove' : 'No list — click to bullet'
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: tone.info.bg, border: `1px solid ${tone.info.bd}`, borderRadius: 7, paddingTop: 6, paddingBottom: 6, paddingRight: 8, paddingLeft: 8 + indentPx(block.indent) }}>
        <div style={{ display: 'flex', gap: 3, flex: 'none' }}>
          <IconBtn title="Remove note" onClick={onDelete}>
            ×
          </IconBtn>
          <IconBtn title={noteListTitle} onClick={() => onList(nextList)} active={block.list != null}>
            {block.list === 'number' ? '1.' : '•'}
          </IconBtn>
          <IconBtn title="Outdent" onClick={() => onIndent(-1)} disabled={block.indent <= 0}>
            ‹
          </IconBtn>
          <IconBtn title="Indent" onClick={() => onIndent(1)}>
            ›
          </IconBtn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: tone.info.c }}>Your note</span>
          <textarea
            value={block.text}
            onChange={(e) => onNoteText(e.target.value)}
            placeholder="Type your note…"
            rows={2}
            style={{ font: 'inherit', fontSize: 12.5, lineHeight: 1.5, color: '#3c434c', background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 5, padding: '5px 7px', resize: 'vertical', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
          />
        </div>
      </div>
    )
  }

  const words = block.text.split(' ')
  const boldSet = new Set(block.bold ?? [])
  const listTitle = isHeading ? 'List style applies to paragraphs' : block.list === 'bullet' ? 'Bulleted — click to number' : block.list === 'number' ? 'Numbered — click to remove' : 'No list — click to bullet'
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fff', border: '1px solid var(--bd-1)', borderRadius: 7, paddingTop: 6, paddingBottom: 6, paddingRight: 8, paddingLeft: 8 + indentPx(block.indent) }}>
      <div style={{ display: 'flex', gap: 3, flex: 'none' }}>
        <IconBtn title="Merge into previous line" onClick={onMerge} disabled={!canMerge}>
          ⤴
        </IconBtn>
        <IconBtn title={isHeading ? 'Make a paragraph' : 'Make a heading'} onClick={() => onKind(isHeading ? 'para' : 'heading')} active={isHeading}>
          H
        </IconBtn>
        <IconBtn title={listTitle} onClick={() => onList(nextList)} active={!isHeading && block.list != null} disabled={isHeading}>
          {block.list === 'number' ? '1.' : '•'}
        </IconBtn>
        <IconBtn title="Outdent" onClick={() => onIndent(-1)} disabled={block.indent <= 0}>
          ‹
        </IconBtn>
        <IconBtn title="Indent" onClick={() => onIndent(1)}>
          ›
        </IconBtn>
      </div>
      {/* Live list marker (Phase 6a) — mirrors the saved outline; headings ignore lists. */}
      {!isHeading && block.list && <ListMarker list={block.list} ordinal={ordinal} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: isHeading ? 11 : 12.5, fontWeight: isHeading ? 700 : 400, lineHeight: 1.55, color: isHeading ? 'var(--tx-tertiary)' : '#3c434c', minWidth: 0 }}>
        {words.map((w, wi) => {
          const isBold = boldSet.has(wi)
          // In bold mode every word toggles bold; otherwise word 0 is inert and words
          // 1+ split the line before them (Phase 5c behavior, unchanged).
          const clickable = boldMode || wi > 0
          const handleClick = boldMode ? () => onBold(wi) : wi > 0 ? () => onSplit(wi) : undefined
          const title = boldMode ? (isBold ? 'Click to unbold this word' : 'Click to bold this word') : wi > 0 ? 'Break line before this word' : undefined
          return (
            <button
              key={wi}
              type="button"
              className={boldMode ? 'sl-boldword' : wi > 0 ? 'sl-splitword' : undefined}
              title={title}
              onClick={handleClick}
              // Bold previews live on paragraphs (headings are already bold; a lighter
              // 650 would fight their 700 weight, so leave headings alone).
              style={{ font: 'inherit', color: 'inherit', background: 'none', border: 'none', padding: '0 2px', margin: 0, cursor: clickable ? 'pointer' : 'default', borderRadius: 3, fontWeight: isBold && !isHeading ? 650 : undefined }}
            >
              {w}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Small square control button used in an editor block row. */
function IconBtn({ title, onClick, disabled, active, children }: { title: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{ width: 20, height: 20, fontSize: 11, fontWeight: 700, borderRadius: 5, border: '1px solid var(--bd-1)', background: active ? 'var(--fill-3)' : '#fff', color: disabled ? 'var(--tx-faint-2)' : 'var(--tx-secondary)', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', padding: 0, lineHeight: 1 }}
    >
      {children}
    </button>
  )
}

/**
 * The bold-mode toggle (Phase 6c): a serif "B" in the editor header. Active (dark)
 * = bold mode on, so a word-click bolds instead of splitting. A mode switch, not a
 * per-block control, so it lives in the toolbar and drives every row.
 */
function BoldToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? 'Bold mode on — click words to bold; click to restructure again' : 'Bold mode — click to bold individual words'}
      style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 12.5,
        fontWeight: 700,
        fontStyle: 'italic',
        width: 22,
        height: 22,
        borderRadius: 6,
        border: active ? 'none' : '1px solid var(--bd-1)',
        background: active ? 'var(--accent)' : '#fff',
        color: active ? '#fff' : 'var(--tx-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        lineHeight: 1,
      }}
    >
      B
    </button>
  )
}

/** A text button in the editor toolbar (Save / Cancel / Reset to auto). */
function EditorBtn({ onClick, disabled, primary, children }: { onClick: () => void; disabled?: boolean; primary?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ fontFamily: 'inherit', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: primary ? 'none' : '1px solid var(--bd-1)', background: primary ? '#1a1d21' : '#fff', color: primary ? '#fff' : 'var(--tx-secondary)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}
    >
      {children}
    </button>
  )
}

/** Warns that a saved structure was built on scope text Procore has since changed. */
function StaleBanner() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 7,
        alignItems: 'flex-start',
        background: tone.warn.bg,
        border: `1px solid ${tone.warn.bd}`,
        borderRadius: 8,
        padding: '8px 10px',
        marginBottom: 8,
        fontSize: 11,
        lineHeight: 1.45,
        color: tone.warn.c,
      }}
    >
      <span aria-hidden style={{ flex: 'none', fontSize: 12 }}>
        ⚠
      </span>
      <span>The scope text changed in Procore since this structure was saved — showing the auto-parsed version. Re-check your saved structure.</span>
    </div>
  )
}

/**
 * Render the scope outline: ALL-CAPS headings, numbered sections and clauses
 * (indented), best-effort sub-bullets, and any unstructured prose as plain
 * paragraphs. The parser degrades a marker-less description to a single 'para', so
 * this reads as the old flat paragraph when there's no structure. Override blocks
 * (Phase 5b) arrive as para/heading carrying an explicit `indent`.
 */
function ScopeOutline({ blocks }: { blocks: ScopeBlock[] }) {
  return (
    <div>
      {blocks.map((b, i) => {
        if (b.source === 'user') {
          // A user-authored note (Phase 6b): a tinted, clearly-labelled "Your note" row
          // so it never reads as the subcontractor's committed scope. Honors indent + any
          // list marker; `renderProse` still bolds the note's own words. Not contract text.
          return (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: i === 0 ? 0 : '6px 0 0', paddingLeft: indentPx(b.indent) }}>
              {b.list && <ListMarker list={b.list} ordinal={b.ordinal} />}
              <div style={{ flex: 1, minWidth: 0, background: tone.info.bg, border: `1px solid ${tone.info.bd}`, borderRadius: 6, padding: '5px 8px' }}>
                <span style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: tone.info.c, marginBottom: 2 }}>Your note</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: '#3c434c' }}>{renderProse(b.text, b.bold)}</span>
              </div>
            </div>
          )
        }
        if (b.kind === 'para') {
          // A presentation-only list marker (Phase 6a): a leading `•` for a bullet,
          // the computed ordinal for a numbered block — drawn here, never in `text`.
          if (b.list) {
            return (
              <div key={i} style={{ display: 'flex', gap: 8, margin: i === 0 ? 0 : '5px 0 0', paddingLeft: indentPx(b.indent) }}>
                <ListMarker list={b.list} ordinal={b.ordinal} />
                <span style={{ minWidth: 0, fontSize: 12.5, lineHeight: 1.55, color: '#3c434c' }}>{renderProse(b.text, b.bold)}</span>
              </div>
            )
          }
          return (
            <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0', paddingLeft: indentPx(b.indent), fontSize: 12.5, lineHeight: 1.55, color: '#3c434c' }}>
              {renderProse(b.text, b.bold)}
            </p>
          )
        }
        if (b.kind === 'heading') {
          return (
            <div key={i} style={{ margin: '14px 0 5px', paddingLeft: indentPx(b.indent), fontSize: 10.5, fontWeight: 700, letterSpacing: '.5px', color: 'var(--tx-tertiary)' }}>
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
 * Render a prose block's emphasis (Phase 6c). The bold decision — manual word-level
 * bold wins per block and suppresses the automatic Title-case sub-label bolding —
 * lives in the pure, tested `proseEmphasis`; here we just map its segments to nodes,
 * wrapping strong runs in the shared `<strong>` style. Applied to prose blocks only
 * (numbered GENERAL REQUIREMENTS clauses render elsewhere; headings are already bold).
 */
function renderProse(text: string, bold?: number[]): ReactNode[] {
  return proseEmphasis(text, bold).map((seg, i) => (seg.strong ? <strong key={i} style={strong}>{seg.text}</strong> : seg.text))
}

/** Loading / error / empty wrapper for a lazily-loaded drawer section. */
function Section({ loading, failed, empty, emptyText, children }: { loading: boolean; failed: boolean; empty: boolean; emptyText: string; children: ReactNode }) {
  if (loading) return <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-faint)' }}>Loading…</p>
  if (failed) return <p style={{ margin: 0, fontSize: 12, color: '#b23c0e' }}>Couldn’t load — try reopening.</p>
  if (empty) return <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx-faint)' }}>{emptyText}</p>
  return <>{children}</>
}
