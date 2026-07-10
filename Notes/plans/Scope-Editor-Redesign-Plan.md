# Scope-Editor Redesign — a Notion-feel editor on the existing safe engine (self-contained build plan)
> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: PLAN.md (repo root) + the design handoff (design_handoff_sitelines/).
> Visual spec (the validated target): `Notes/mockups/scope-editor-redesign.html` — open it in a
> browser; it's clickable. This plan is the engineering path to make the real editor feel like the
> "Proposed" side of that mockup.

## Goal
Rebuild the **presentation/interaction layer** of the commitment scope-structure editor so it feels
like tools the owner already uses (Notion / Linear): plain selectable text, no modes, controls that
appear when needed. It does the **same jobs as today** — fix line breaks, format lines (heading /
bullet / number / indent), bold words, add your own notes — but replaces today's dense, mode-heavy UI
(per-word buttons, a "bold mode" toggle, five 20px glyphs per row) with:
1. **Plain text lines** — words are text, not buttons.
2. **Split by clicking the gap between words** (a caret appears on hover), not by clicking a word.
3. **Bold by selecting words → a floating "Bold" chip** appears. **No bold mode.**
4. **Format via a hover "⠿" handle → a small labeled menu** (Heading/Paragraph · Bullet · Number ·
   Indent · Outdent · Join with line above), not a permanent glyph cluster.
5. **Notes that feel like normal typing** (free-text textarea, tinted "Your note") — the ONLY typing path.
6. **Drag-to-reorder lines** (owner-requested).
7. **Comfortable targets + readable contrast** (today's are 20px targets and ~2.9:1 helper text).

**Crucial framing — this is a UI reskin, not a rewrite.** The whole safe engine stays and is reused
unchanged: the data model (`ScopeBlockOverride` = `kind/indent/text/list/bold/source`), every pure op
in `src/lib/scopeEdit.ts`, `applyScopeOverride`/`computeOrdinals`, `proseEmphasis`, `coerceBlocks`, and
their ~200 co-located tests. Only `src/components/overlays/CommitmentDrawer.tsx` (the editor +
rendered note treatment) is rebuilt, plus **two small new pure ops** (reorder + range-bold) added to
`scopeEdit.ts` with tests. The words-locked safety guarantee is therefore **structurally unchanged**.

## Out of scope / deferred
- **No new capabilities beyond today's** except drag-to-reorder — same heading/list/indent/bold/note
  powers, new interactions only.
- **No rich text, no free-text editing of contract lines, no Procore write-back** — contract words stay
  reshuffle-only; typing lives only in `source:'user'` notes.
- **No data-model or SQL change** — `blocks` jsonb is unchanged; `coerceBlocks` already validates all fields.
- **No touch/tablet-specific UI** — desktop-first (owner confirmed desktop-only use). Keyboard fallbacks
  for a11y are in; a dedicated touch mode is explicitly deferred.
- **The auto-parser (`segmentSource`/`parseScope`) is unchanged** — same starting structure; this is
  about editing it, not detecting it better.

## Locked product decisions (owner, 2026-07-10)
- **Replace the current editor outright** — no flag/side-by-side. The engine + tests are unchanged and we
  verify live before committing, so risk is contained; a parallel editor would just be double maintenance.
- **Include drag-to-reorder** lines (owner overrode the "defer" recommendation — they want it).
- **Desktop only** — optimize for mouse + keyboard; hover handles and select-to-bold are the primary
  interactions. Keyboard-accessible move/format is the a11y path, not a separate touch design.
- **Direction is locked to the mockup** (`Notes/mockups/scope-editor-redesign.html`, "Proposed" side).
  It's the visual + interaction spec; match its feel.

## Data model (unchanged — reused)
No shape changes. The editor reads/writes `ScopeBlockOverride[]` exactly as today and persists via the
`UserData` seam (`saveOverride`/`deleteOverride`). The on-save safety assertion `partitionsSource`
(contract blocks reconstruct the source; notes excluded) is unchanged and still gates every save.

## Pure logic to extract + unit-test (the only engine additions)
Add to `src/lib/scopeEdit.ts` with co-located tests in `scopeEdit.test.ts`:
- **`moveBlock(blocks, from, to)`** — reorder a block; returns a new array. Pure + deterministic.
  **Safety note:** reordering *contract* blocks changes the word order, so `partitionsSource` (which
  joins in array order) would then compare a re-ordered contract to the source and **fail the save**.
  Decide + test the rule: EITHER (a) `partitionsSource` compares as a multiset/normalized set so order
  doesn't matter — NO, that weakens the guarantee; OR **(b, recommended)** reordering is constrained so
  it never reorders contract lines relative to each other in a way that breaks the partition — simplest
  safe framing: **only notes are freely reorderable; contract lines keep their contract order.** Confirm
  this with the owner at kickoff (see Open decisions). Whichever rule, it must be a *tested pure fn*, and
  a save that would violate the contract partition must still be refused.
- **`setBoldWords(blocks, i, indices, on)`** — set/clear bold on a *range* of word indices at once
  (selection → bold). Keeps the sorted-unique invariant `toggleBold` guarantees. (Selection→bold could
  also loop `toggleBold`, but a range op is cleaner to test.)

Everything else (`splitBlock`, `mergeUp`, `toggleBold`, `addNote`, `setNoteText`, `removeNote`,
`dropEmptyNotes`, `partitionsSource`, `seedEditorBlocks`) is reused as-is.

## Build-on inventory (read these fresh before using)
- `src/lib/scopeEdit.ts` — the pure ops (REUSE; add the two above). Do not change the words-locked model.
- `src/lib/applyScopeOverride.ts` — `overrideToBlocks` + `computeOrdinals` (live ordinal preview).
- `src/lib/proseEmphasis.ts` — the bold/auto-bold segmentation for the rendered outline (REUSE).
- `src/lib/mapScopeOverride.ts` — `coerceBlocks` (REUSE; already validates every field).
- `src/components/overlays/CommitmentDrawer.tsx` — **the rebuild target**: `ScopeStructureEditor`,
  `EditorBlockRow`, `BoldToggle` (delete it — no more mode), `IconBtn`/`EditorBtn`, and the `ScopeOutline`
  note rendering (keep, light polish). `ListMarker`/`indentPx`/`renderProse` are reused.
- `src/theme/tokens.ts` + `src/index.css` — the ONE token source. Notes reuse `tone.info`; bold reuses
  the existing `<strong>` style. Add hover/handle/gap/chip affordance classes here (like `.sl-splitword`
  was), no ad-hoc hex.

## Sub-phasing (ship + verify each)

### Phase R1 — the Notion-feel rebuild (replaces word-buttons + bold-mode together)
- **Status: ✅ Shipped (2026-07-10).** Editor rebuilt in `CommitmentDrawer.tsx` (plain-text lines ·
  gap-split · selection→Bold chip · hover `⠿` handle menu · tinted note textareas; `BoldToggle`/bold-mode
  + word-buttons deleted); new pure `setBoldWords` in `scopeEdit.ts` (+ tests); affordance classes in
  `index.css`. **Follow-up shipped same day (owner-requested): undo/redo** — `Ctrl+Z` / `Ctrl+Y` /
  `Ctrl+Shift+Z` + toolbar `↶ ↷`, backed by a pure tested `src/lib/history.ts` (no-op edits record
  nothing; note-typing bursts coalesce to one step). 216 tests green; typecheck + build green. Verified
  live on seed (`:5174`) — split · select→bold (+unbold) · handle menu (heading/bullet/number/indent) ·
  add-note + type · save → refresh persists · contract words verbatim (`partitionsSource` passes) · undo/
  redo incl. coalescing. **Live logged-in `:5175` left to the owner** (Supabase password not stored; the
  save seam is unchanged from Phase 6a, which was live-verified). Committed to `main`.
- **Scope:** `src/components/overlays/CommitmentDrawer.tsx` (+ `src/index.css`, + `setBoldWords` in
  `scopeEdit.ts` with a test). Rebuild the editor: (1) each block renders as **plain text** with hoverable
  **gap-split** zones between words (click a gap → `splitBlock`); (2) **selection → floating "Bold" chip**
  → `setBoldWords` (delete `BoldToggle` and bold-mode entirely); (3) a hover **"⠿" handle → labeled menu**
  wiring the existing ops (heading⇄para `setKind`, bullet/number `setList`, indent/outdent `reindent`,
  join-with-above `mergeUp`); (4) **notes** as a tinted `<textarea>` row with delete/indent/list
  (`addNote`/`setNoteText`/`removeNote`, `dropEmptyNotes` on save) — the only typing path; (5) **a11y**:
  targets ≥24px, helper/label contrast ≥4.5:1. Reorder is NOT in R1.
- **Approval gates:** none (no SQL/data change). It DOES rewrite the editor UI — verify live before commit.
- **Exit criteria:** typecheck + tests + build green; `setBoldWords` unit-tested; live `:5174` (seed) +
  `:5175` (live) — split a line by gap-click, select words → bold via the chip, use the handle menu to
  make a heading / bullet / number / indent, add a note and type, save, refresh → structure + bold +
  note persist and render, contract words verbatim (`partitionsSource` still passes), and the old
  word-button/bold-mode UI is gone. Stop; don't commit/push until the owner says "Approved."

### Phase R2 — drag-to-reorder
- **Scope:** add `moveBlock` (pure + tested, with the contract-order safety rule from "Pure logic"
  above) and drag-to-reorder in the editor (drag the "⠿" handle to move a line), plus a
  keyboard-accessible **Move up / Move down** in the handle menu as the a11y path. Re-run `partitionsSource`
  on save so a reorder that would break the contract partition is refused.
- **Approval gates:** ⚠️ confirm the reorder safety rule (notes-only reorder vs. constrained contract
  reorder) at kickoff before building — it's the one spot that touches the safety guarantee.
- **Exit criteria:** typecheck + tests + build; live — reorder notes (and contract lines per the agreed
  rule), save, refresh → order persists and the contract partition still holds. Stop.

## Hard guardrails (do not violate)
- **The words-locked safety guarantee is unchanged.** Contract blocks (`source` absent) are
  reshuffle-only; typing is permitted ONLY on `source:'user'` notes; `partitionsSource` asserts on every
  save (notes excluded). Reorder must not become a way to alter the contract partition (see R2 rule).
- **Overlays stay `position:fixed` siblings of the app card**, outside its `overflow:hidden` — the editor
  lives inside the existing `CommitmentDrawer`, so this is already satisfied; don't move it.
- **One token source** — `src/theme/tokens.ts` + `src/index.css`. Reuse `tone.info` (notes) + the
  existing `<strong>` style; no ad-hoc hex. New affordance classes go in `index.css`.
- **Domain atom stays `Item`**; `ScopeOverride` is user/reference data — never a court `Item`, never in
  `ballInCourt`.
- **Pure logic stays in `src/lib` with co-located tests**, no clock inside. The new `moveBlock` /
  `setBoldWords` are pure and tested; the view stays dumb.
- **Fits the 452px `position:fixed` drawer.** The floating Bold chip + handle menu must be positioned so
  they never overflow the drawer or the viewport.

## Open decisions (resolve at the relevant kickoff)
- **R2 reorder safety rule** (load-bearing): notes-only reorder (simplest, keeps the contract partition
  trivially safe) vs. allowing contract-line reorder with a partition rule that still guarantees the
  contract text. **Recommend notes-only reorder for v1**; revisit if the owner needs to reorder contract
  lines. Confirm at the R2 kickoff.
- **"Reset to auto" prominence** (minor): keep it, but make it a quiet/secondary control (it discards the
  whole structure) and consider a confirm. Recommend: quiet secondary button, no modal. Decide in R1.
- **Selection→bold snap** (minor): a partial-word selection bolds the whole word(s) it touches (bold is
  word-indexed). Recommend: snap to touched words. Decide in R1.
