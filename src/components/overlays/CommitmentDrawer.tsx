// Commitment detail drawer (Commitments, Phase 2): a right drawer (452px,
// position:fixed sibling of the app card — the overlay guardrail) opened by a
// CommitmentsView row. The descriptive side (contract company, financial
// position, description, dates, privacy) reads straight off the Commitment; the
// CO log + billing history are lazily fetched via the data provider
// (getCommitmentDetail), like the drawing viewer's revisions. Contract summary /
// SOV inclusions-exclusions / additional info aren't synced yet — stubbed until
// Phase 3. Reference data; nothing here touches My Court. Dumb UI — formatting
// (money / %) happens here, ordering comes from pure selectors.

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { TOOLS } from '@/data/tools'
import { applyScopeOverride, computeOrdinals } from '@/lib/applyScopeOverride'
import { formatMoney, statusTone } from '@/lib/derive'
import { closePatch } from '@/lib/drawerNav'
import { hashText } from '@/lib/hashText'
import { canRedo, canUndo, initHistory, pushEdit, redo, undo } from '@/lib/history'
import type { ScopeBlock } from '@/lib/parseScope'
import { proseEmphasis } from '@/lib/proseEmphasis'
import { addNote, dropEmptyNotes, mergeUp, MAX_INDENT, partitionsSource, reindent, removeNote, seedEditorBlocks, setBoldWords, setKind, setList, setNoteText, splitBlock } from '@/lib/scopeEdit'
import { overrideKey } from '@/lib/userDataSource'
import { commitmentBillingsSorted, commitmentChangeOrdersSorted, commitmentSovByCostCode } from '@/selectors'
import { useApp } from '@/state/AppContext'
import { useData, useSiteData } from '@/state/DataContext'
import { useUserData } from '@/state/UserDataContext'
import { mono, tone } from '@/theme/tokens'
import type { Commitment, CommitmentDetail, ScopeBlockOverride, ScopeField, ScopeOverride } from '@/types'
import { ProjectTag, StatusPill } from '@/components/ui/primitives'
import { DrawerShell } from './DrawerShell'

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
  return <CommitmentPanel key={commitment.id} commitment={commitment} onClose={() => patch(closePatch())} />
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
    <DrawerShell code={TOOLS.commitments.code} number={c.number} onClose={onClose}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 680, lineHeight: 1.3, letterSpacing: '-.2px' }}>{c.title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <StatusPill label={c.status || '—'} tone={statusTone(c.status, 'track')} />
        <ProjectTag project={c.project} />
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--tx-faint)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 5px' }}>{c.type}</span>
        {c.private && <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.3px', textTransform: 'uppercase', color: 'var(--tx-faint)', border: '1px solid var(--bd-1)', borderRadius: 4, padding: '1px 5px' }}>Private</span>}
      </div>

      {/* deep link to the commitment in Procore (constructed in the view; null when absent) */}
      {c.procoreUrl && (
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <a href={c.procoreUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: '#2f5f8a', textDecoration: 'none' }}>
            Open in Procore ↗
          </a>
        </div>
      )}

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
    </DrawerShell>
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

// The scope editor a Ctrl+Z/Ctrl+Y targets: the one you last opened or interacted with.
// Undo/redo is bound on `window`, so if two scope editors are open at once this makes the
// shortcut act on the focused one only (not both). A plain token — no re-render needed.
let activeScopeEditor: object | null = null

/** The floating "Bold" chip's live target: which line + word indices the current text
 *  selection covers, whether the click should ADD bold (`on`, i.e. not all already bold),
 *  and where to draw it (viewport coords — the chip is position:fixed). */
interface ChipTarget {
  line: number
  words: number[]
  on: boolean
  left: number
  top: number
  above: boolean
}

/**
 * The inline "Edit scope" editor (Phase 5c, rebuilt in R1 to a Notion-feel surface).
 * Works on a local copy of the block list via the SAME pure ops in scopeEdit — WORDS
 * ARE LOCKED, only structure changes. New interactions, same safe engine: click the gap
 * between two words to break the line there; select words → a floating "Bold" chip
 * (`setBoldWords`); a hover "⠿" handle opens a labeled format menu (heading/paragraph ·
 * bullet · number · indent · outdent · join). Typing is allowed on your own notes only.
 * On save it asserts the unchanged partition invariant, then writes through the UserData
 * seam; "Reset to auto" deletes the override so the field falls back to the parser.
 */
function ScopeStructureEditor({ commitmentId, field, source, override, onClose }: { commitmentId: string; field: ScopeField; source: string; override?: ScopeOverride; onClose: () => void }) {
  const { saveOverride, deleteOverride } = useUserData()
  // Block list lives in an undo/redo history (Ctrl+Z / Ctrl+Y). `present` is the current
  // blocks; every edit records a step, and a burst of note typing coalesces into one.
  const [hist, setHist] = useState(() => initHistory(seedEditorBlocks(source, override)))
  const blocks = hist.present
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Which line's format menu is open (block index), or null. One at a time.
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  // The floating "Bold" chip target for the current selection, or null when hidden.
  const [chip, setChip] = useState<ChipTarget | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const editorId = useRef({}) // stable identity for the active-editor / undo scoping
  // The document-level selection handler reads the latest blocks without re-subscribing.
  const blocksRef = useRef(blocks)
  blocksRef.current = blocks

  // Record an edit through the history. `tag` coalesces consecutive same-tag edits into
  // one undo step (used for note typing) — omit it and each edit is its own step.
  const edit = (fn: (b: ScopeBlockOverride[]) => ScopeBlockOverride[], tag?: string) => setHist((h) => pushEdit(h, fn, tag ?? null))

  // Undo / redo also dismiss any open menu + chip, whose anchors may not survive the
  // block-list changing underneath them.
  const doUndo = useCallback(() => {
    setOpenMenu(null)
    setChip(null)
    setHist(undo)
  }, [])
  const doRedo = useCallback(() => {
    setOpenMenu(null)
    setChip(null)
    setHist(redo)
  }, [])

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
    // The safety assertion (UNCHANGED): the pure ops guarantee the CONTRACT blocks still
    // spell out the source (notes are excluded), so a failure means a bug — refuse the
    // save rather than let the rendered contract scope diverge from what was executed.
    if (!partitionsSource(cleaned, source)) {
      setError('Safety check failed: the structure no longer matches the contract words. Not saved.')
      return
    }
    void run(() => saveOverride({ commitmentId, field, blocks: cleaned, sourceHash: hashText(source) }))
  }

  // Selection → Bold chip. On any selection change inside THIS editor's contract text,
  // find the word spans the range intersects (a partial-word selection snaps to the whole
  // touched word — bold is word-indexed) and float a chip over the selection. Scoped via
  // rootRef so a second open editor doesn't react. Hidden on scroll (the chip is fixed).
  useEffect(() => {
    const onSelect = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setChip(null)
      const range = sel.getRangeAt(0)
      const anchor = range.commonAncestorContainer
      const el = anchor.nodeType === 3 ? anchor.parentElement : (anchor as Element)
      const textEl = el?.closest?.('.sl-pline-text') as HTMLElement | null
      if (!textEl || !rootRef.current?.contains(textEl)) return setChip(null)
      const line = Number(textEl.dataset.line)
      const b = blocksRef.current[line]
      // Headings are already bold and render via a separate path — no chip on them.
      if (!b || b.kind === 'heading') return setChip(null)
      const words: number[] = []
      textEl.querySelectorAll('.sl-word').forEach((sp) => {
        if (range.intersectsNode(sp)) words.push(Number((sp as HTMLElement).dataset.w))
      })
      if (words.length === 0) return setChip(null)
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return setChip(null)
      const allBold = words.every((w) => (b.bold ?? []).includes(w))
      // Clamp the (fixed) chip so it never overflows the viewport / 452px drawer.
      const HALF = 44
      const left = Math.max(HALF + 8, Math.min(window.innerWidth - HALF - 8, rect.left + rect.width / 2))
      const above = rect.top > 48 // flip below when the selection hugs the top edge
      setChip({ line, words, on: !allBold, left, top: above ? rect.top - 8 : rect.bottom + 8, above })
    }
    const onScroll = () => setChip(null)
    document.addEventListener('selectionchange', onSelect)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('selectionchange', onSelect)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [])

  // While a format menu is open: close it on an outside click, and let Escape close the
  // MENU first (a second Escape then closes the drawer, as usual). The app's drawer-close
  // Escape handler is a window bubble listener, so we intercept in the capture phase and
  // stop it — otherwise Escape would blow past the menu and close the whole drawer.
  useEffect(() => {
    if (openMenu === null) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (!t?.closest?.('.sl-pmenu') && !t?.closest?.('.sl-phandle')) setOpenMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        e.preventDefault()
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [openMenu])

  // This editor becomes the undo/redo target when it opens; opening or clicking into
  // another scope editor hands the target over (see `activeScopeEditor`).
  useEffect(() => {
    const id = editorId.current
    activeScopeEditor = id
    return () => {
      if (activeScopeEditor === id) activeScopeEditor = null
    }
  }, [])

  // Ctrl/⌘+Z = undo, Ctrl/⌘+Y or Ctrl/⌘+Shift+Z = redo — but only for the active editor,
  // and only when the event isn't the app's own shortcut. preventDefault stops the
  // browser's (broken, for a controlled textarea) native undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || activeScopeEditor !== editorId.current) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        doUndo()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        doRedo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doUndo, doRedo])

  const applyChip = () => {
    if (!chip) return
    edit((bl) => setBoldWords(bl, chip.line, chip.words, chip.on))
    window.getSelection()?.removeAllRanges()
    setChip(null)
  }

  // Live ordinals via the shared rule, so a numbered line previews its real number
  // (1·2·3) as you format — matching the saved outline exactly.
  const ordinals = computeOrdinals(blocks)

  const markActive = () => {
    activeScopeEditor = editorId.current
  }

  return (
    <div ref={rootRef} className="sl-scope-editor" onPointerDownCapture={markActive} onFocusCapture={markActive} style={{ border: '1px solid var(--bd-2)', borderRadius: 9, padding: 10, background: 'var(--fill-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', color: 'var(--tx-secondary)', textTransform: 'uppercase' }}>Edit scope</span>
        <div style={{ display: 'flex', gap: 3 }}>
          <HistoryBtn title="Undo (Ctrl+Z)" onClick={doUndo} disabled={!canUndo(hist)}>
            ↶
          </HistoryBtn>
          <HistoryBtn title="Redo (Ctrl+Y)" onClick={doRedo} disabled={!canRedo(hist)}>
            ↷
          </HistoryBtn>
        </div>
        <div style={{ flex: 1 }} />
        <EditorBtn onClick={save} disabled={busy} primary>
          {busy ? 'Saving…' : 'Save'}
        </EditorBtn>
        <EditorBtn onClick={onClose} disabled={busy}>
          Cancel
        </EditorBtn>
        <EditorBtn onClick={() => void run(() => deleteOverride(commitmentId, field))} disabled={busy} quiet>
          Reset to auto
        </EditorBtn>
      </div>
      <div style={{ fontSize: 11, color: 'var(--tx-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
        The words stay locked — you regroup and annotate them. <b style={strong}>Select words to bold</b>, click between two words to split a line, hover a line to open its format menu, and add your own notes below.
      </div>
      <div className="sl-plist">
        {blocks.map((b, i) => (
          <EditorLine
            key={i}
            block={b}
            index={i}
            ordinal={ordinals[i]}
            canMerge={i > 0 && blocks[i - 1].source === b.source}
            menuOpen={openMenu === i}
            onToggleMenu={() => setOpenMenu((m) => (m === i ? null : i))}
            onSplit={(wi) => {
              setChip(null)
              edit((bl) => splitBlock(bl, i, wi))
            }}
            onMerge={() => {
              setOpenMenu(null)
              edit((bl) => mergeUp(bl, i))
            }}
            onKind={(k) => {
              setOpenMenu(null)
              edit((bl) => setKind(bl, i, k))
            }}
            onIndent={(d) => {
              setOpenMenu(null)
              edit((bl) => reindent(bl, i, d))
            }}
            onList={(l) => {
              setOpenMenu(null)
              edit((bl) => setList(bl, i, l))
            }}
            onNoteText={(t) => edit((bl) => setNoteText(bl, i, t), `note:${i}`)}
            onDelete={() => {
              setOpenMenu(null)
              edit((bl) => removeNote(bl, i))
            }}
          />
        ))}
      </div>
      {/* Add note (Phase 6b): appends an empty note — the ONE place typing is allowed.
          The contract words stay locked; notes render clearly marked as your additions. */}
      <button
        type="button"
        onClick={() => {
          setOpenMenu(null)
          edit((bl) => addNote(bl, bl.length - 1))
          // Focus the fresh note so the owner can just start typing (view-layer nicety).
          setTimeout(() => {
            const tas = rootRef.current?.querySelectorAll('textarea')
            tas?.[tas.length - 1]?.focus()
          }, 0)
        }}
        className="sl-add-note"
        style={{ marginTop: 8, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 7, border: `1px solid ${tone.info.bd}`, background: tone.info.bg, color: tone.info.c, cursor: 'pointer' }}
      >
        <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add note
      </button>
      {error && <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.45, color: tone.danger.c }}>{error}</div>}
      {chip && <BoldChip left={chip.left} top={chip.top} above={chip.above} label={chip.on ? 'Bold' : 'Unbold'} onApply={applyChip} />}
    </div>
  )
}

/** A menu item in the hover "⠿" format menu (Phase R1). */
interface MenuItemDef {
  key: string
  icon: string
  label: string
  on?: boolean
  disabled?: boolean
  sepBefore?: boolean
  onClick: () => void
}

/** Format-menu items for a CONTRACT line: heading⇄para, bullet/number (paragraphs only),
 *  indent/outdent, and join-with-above (only when the line above is joinable). Every item
 *  wires an EXISTING pure op — no new capabilities. */
function contractMenuItems(block: ScopeBlockOverride, canMerge: boolean, h: { onKind: (k: ScopeBlockOverride['kind']) => void; onList: (l: ScopeBlockOverride['list']) => void; onIndent: (d: number) => void; onMerge: () => void }): MenuItemDef[] {
  const isHeading = block.kind === 'heading'
  const items: MenuItemDef[] = [{ key: 'kind', icon: 'H', label: isHeading ? 'Paragraph' : 'Heading', on: isHeading, onClick: () => h.onKind(isHeading ? 'para' : 'heading') }]
  if (!isHeading) {
    items.push({ key: 'bullet', icon: '•', label: 'Bullet list', on: block.list === 'bullet', onClick: () => h.onList(block.list === 'bullet' ? undefined : 'bullet') })
    items.push({ key: 'number', icon: '1.', label: 'Numbered list', on: block.list === 'number', onClick: () => h.onList(block.list === 'number' ? undefined : 'number') })
  }
  items.push({ key: 'indent', icon: '→', label: 'Indent', sepBefore: true, disabled: block.indent >= MAX_INDENT, onClick: () => h.onIndent(1) })
  items.push({ key: 'outdent', icon: '←', label: 'Outdent', disabled: block.indent <= 0, onClick: () => h.onIndent(-1) })
  if (canMerge) items.push({ key: 'merge', icon: '⤴', label: 'Join with line above', sepBefore: true, onClick: h.onMerge })
  return items
}

/** Format-menu items for a NOTE: bullet/number + indent/outdent (delete lives on the
 *  note's own × button). */
function noteMenuItems(block: ScopeBlockOverride, h: { onList: (l: ScopeBlockOverride['list']) => void; onIndent: (d: number) => void }): MenuItemDef[] {
  return [
    { key: 'bullet', icon: '•', label: 'Bullet list', on: block.list === 'bullet', onClick: () => h.onList(block.list === 'bullet' ? undefined : 'bullet') },
    { key: 'number', icon: '1.', label: 'Numbered list', on: block.list === 'number', onClick: () => h.onList(block.list === 'number' ? undefined : 'number') },
    { key: 'indent', icon: '→', label: 'Indent', sepBefore: true, disabled: block.indent >= MAX_INDENT, onClick: () => h.onIndent(1) },
    { key: 'outdent', icon: '←', label: 'Outdent', disabled: block.indent <= 0, onClick: () => h.onIndent(-1) },
  ]
}

/**
 * One editable line (Phase R1). A CONTRACT line renders as PLAIN TEXT (words are text,
 * not buttons) with a thin split-gap between each pair of words and select-to-bold
 * (handled by the parent's chip). A user note (`source:'user'`) renders as a tinted
 * "Your note" textarea — the ONE place typing is allowed. Every line has a hover "⠿"
 * handle opening a labeled format menu; the menu's items differ by line type. All wiring
 * goes through the existing pure ops — no new capabilities, only new interactions.
 */
function EditorLine({ block, index, ordinal, canMerge, menuOpen, onToggleMenu, onSplit, onMerge, onKind, onIndent, onList, onNoteText, onDelete }: {
  block: ScopeBlockOverride
  index: number
  ordinal?: number
  canMerge: boolean
  menuOpen: boolean
  onToggleMenu: () => void
  onSplit: (wordIndex: number) => void
  onMerge: () => void
  onKind: (kind: ScopeBlockOverride['kind']) => void
  onIndent: (delta: number) => void
  onList: (list: ScopeBlockOverride['list']) => void
  onNoteText: (text: string) => void
  onDelete: () => void
}) {
  const isNote = block.source === 'user'
  const items = isNote ? noteMenuItems(block, { onList, onIndent }) : contractMenuItems(block, canMerge, { onKind, onList, onIndent, onMerge })
  return (
    <div className="sl-pline">
      <button type="button" className={`sl-phandle${menuOpen ? ' is-open' : ''}`} title="Format this line" aria-haspopup="menu" aria-expanded={menuOpen} onClick={onToggleMenu}>
        ⠿
      </button>
      <div className="sl-pbody" style={{ paddingLeft: indentPx(block.indent) }}>
        {isNote ? <NoteBody block={block} ordinal={ordinal} onNoteText={onNoteText} onDelete={onDelete} /> : <ContractText block={block} index={index} ordinal={ordinal} onSplit={onSplit} />}
      </div>
      {menuOpen && <LineMenu items={items} />}
    </div>
  )
}

/** A contract line as plain, selectable text (Phase R1): an optional list marker, then
 *  each word as an inert `<span data-w>` with a thin hoverable split-gap before words
 *  1+. Words are NOT clickable; the gap splits and a text selection drives the Bold chip. */
function ContractText({ block, index, ordinal, onSplit }: { block: ScopeBlockOverride; index: number; ordinal?: number; onSplit: (wordIndex: number) => void }) {
  const isHeading = block.kind === 'heading'
  const words = block.text.split(' ')
  const boldSet = new Set(block.bold ?? [])
  return (
    <div className={`sl-pline-text${isHeading ? ' heading' : ''}`} data-line={index} style={isHeading ? undefined : { color: '#3c434c' }}>
      {!isHeading && block.list && (
        <span className="sl-pmarker" aria-hidden>
          {block.list === 'number' ? `${ordinal ?? ''}.` : '•'}
        </span>
      )}
      {words.map((w, wi) => (
        <Fragment key={wi}>
          {wi > 0 && (
            <span className="sl-gap" title="Split line here" onClick={() => onSplit(wi)}>
              {' '}
            </span>
          )}
          <span className={`sl-word${boldSet.has(wi) && !isHeading ? ' is-bold' : ''}`} data-w={wi}>
            {w}
          </span>
        </Fragment>
      ))}
    </div>
  )
}

/** A user note (Phase 6b) as a tinted "Your note" textarea — the ONE place typing is
 *  allowed. Honors indent (applied by the parent) + an optional list marker; delete is
 *  the ×. The words-locked contract partition is untouched (notes are excluded on save). */
function NoteBody({ block, ordinal, onNoteText, onDelete }: { block: ScopeBlockOverride; ordinal?: number; onNoteText: (text: string) => void; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {block.list && <ListMarker list={block.list} ordinal={ordinal} />}
      <div style={{ flex: 1, minWidth: 0, background: tone.info.bg, border: `1px solid ${tone.info.bd}`, borderRadius: 8, padding: '7px 9px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: tone.info.c }}>✎ Your note</span>
          <button type="button" className="sl-note-x" title="Remove note" onClick={onDelete} style={{ background: 'none', border: 'none', color: tone.info.c, cursor: 'pointer', fontSize: 15, lineHeight: 1, minWidth: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            ×
          </button>
        </div>
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

/** The hover "⠿" handle's labeled format menu (Phase R1): text items revealed on demand,
 *  not a permanent glyph row. Keyboard-operable — focuses the first item on open (Escape /
 *  outside-click close is owned by the parent). Anchored under the handle, left-aligned so
 *  it never overflows the 452px drawer. */
function LineMenu({ items }: { items: MenuItemDef[] }) {
  const firstRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    firstRef.current?.focus()
  }, [])
  return (
    <div className="sl-pmenu" role="menu">
      {items.map((it, idx) => (
        <Fragment key={it.key}>
          {it.sepBefore && <div className="sl-pmenu-sep" aria-hidden />}
          <button type="button" role="menuitem" ref={idx === 0 ? firstRef : undefined} className={it.on ? 'is-on' : undefined} disabled={it.disabled} onClick={(e) => { e.stopPropagation(); it.onClick() }}>
            <span className="mi" aria-hidden>{it.icon}</span>
            {it.label}
          </button>
        </Fragment>
      ))}
    </div>
  )
}

/** The floating "Bold" chip shown over a text selection (Phase R1). position:fixed, so
 *  the parent clamps it to the viewport; mousedown (not click) + preventDefault so the
 *  selection survives long enough for the parent to read the touched words. */
function BoldChip({ left, top, above, label, onApply }: { left: number; top: number; above: boolean; label: string; onApply: () => void }) {
  return (
    <button type="button" className="sl-boldchip" style={{ left, top, transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }} onMouseDown={(e) => { e.preventDefault(); onApply() }}>
      <b>B</b> {label}
    </button>
  )
}

/** A text button in the editor toolbar. `primary` = the dark Save; `quiet` = a
 *  borderless, muted secondary (Reset to auto — it discards the whole structure, so it
 *  stays low-key, no modal); default = the bordered Cancel. */
function EditorBtn({ onClick, disabled, primary, quiet, children }: { onClick: () => void; disabled?: boolean; primary?: boolean; quiet?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ fontFamily: 'inherit', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: primary || quiet ? 'none' : '1px solid var(--bd-1)', background: primary ? '#1a1d21' : quiet ? 'transparent' : '#fff', color: primary ? '#fff' : quiet ? 'var(--tx-secondary-2)' : 'var(--tx-secondary)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}
    >
      {children}
    </button>
  )
}

/** A compact icon button for the editor's undo / redo (↶ ↷); greys out at the ends of
 *  the history. 24px tall for a comfortable target; the Ctrl+Z / Ctrl+Y shortcuts do the
 *  same thing for keyboard users. */
function HistoryBtn({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{ width: 26, height: 24, fontSize: 14, lineHeight: 1, borderRadius: 6, border: '1px solid var(--bd-1)', background: '#fff', color: disabled ? 'var(--tx-faint-2)' : 'var(--tx-secondary)', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
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
