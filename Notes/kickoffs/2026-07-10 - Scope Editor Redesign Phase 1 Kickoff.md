# Kickoff — Scope-Editor Redesign, Phase R1: the Notion-feel rebuild

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — a well-specified UI rebuild, but with correctness-critical seams: mapping a text selection to word indices for bold, positioning floating UI inside a 452px fixed drawer, and keeping the words-locked safety engine untouched. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` mid-session (`/model claude-fable-5`) only if genuinely stuck.
>
> Implement **Phase R1 of the Scope-Editor Redesign** (replace the dense, mode-heavy scope editor with a Notion-feel one — plain text, gap-click split, select-to-bold, a hover handle menu, and notes — on the SAME safe engine). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-10 - Scope Editor Redesign Phase 1 Kickoff.md` (this file)
> - `Notes/plans/Scope-Editor-Redesign-Plan.md` (the plan-of-record) + `PLAN.md` (Phase 6 row) + `CLAUDE.md`
> - `Notes/mockups/scope-editor-redesign.html` — **open it in a browser; it's the clickable visual + interaction spec.** Match the "Proposed" side's feel.
> - `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase R1** (no drag-to-reorder — that's R2). **Hard guardrail: this is a UI reskin, not a rewrite — the words-locked safety engine is REUSED unchanged. Do NOT change the data model or the pure ops' behavior; contract words stay reshuffle-only; typing is allowed ONLY on `source:'user'` notes; `partitionsSource` still asserts on every save.** No SQL/data change. Verify with typecheck + tests + build + a logged-in `:5175` (and seed `:5174`) click-through. Don't commit or push until I say "Approved."

---

## Why this workstream exists
Phases 5c/6a/6b/6c built a **safe, powerful** scope editor — but its UX accreted into a power-user tool:
per-word buttons, a "bold mode" toggle that silently changes what a click does, and a cluster of five
20px unlabeled glyphs per row. The owner (a non-developer, occasional user) found it un-intuitive. A
design critique + an interactive mockup produced a validated direction: **the feel of Notion/Linear on
the exact same safe engine.** R1 is that rebuild. **Nothing about the safety model changes** — this is
presentation + interaction only.

## What R1 replaces (and what it keeps)
**KEEP, untouched (reused):** the data model (`ScopeBlockOverride`), every pure op in
`src/lib/scopeEdit.ts`, `applyScopeOverride`/`computeOrdinals`, `proseEmphasis`, `coerceBlocks`, and their
~200 tests. The on-save `partitionsSource` assertion. The `UserData` save seam. The auto-parser seed.

**REPLACE (in `src/components/overlays/CommitmentDrawer.tsx` + `src/index.css`):**
- `EditorBlockRow` — from a glyph cluster + word-buttons → a **plain-text line** with hover **gap-split**
  zones + a hover **"⠿" handle** opening a **labeled menu**.
- `ScopeStructureEditor` — remove **bold mode**; add a **selection → floating "Bold" chip**; wire the
  handle menu to the existing ops; keep "+ Add note" (notes as a `<textarea>` row).
- `BoldToggle` — **delete it** (no more mode).
- `ScopeOutline` note rendering (from 6b) — keep; light polish only.

## Read fresh before editing (don't trust line numbers in any doc)
- `src/components/overlays/CommitmentDrawer.tsx` — the whole scope-editing region: `ScopeFieldSection`,
  `ScopeStructureEditor`, `EditorBlockRow`, `BoldToggle`, `IconBtn`, `EditorBtn`, `ScopeOutline`,
  `ListMarker`, `renderProse`, `indentPx`. This is the rebuild surface.
- `src/lib/scopeEdit.ts` — the pure ops you'll wire (REUSE): `splitBlock`, `mergeUp`, `toggleBold`,
  `setKind`, `setList`, `reindent`, `addNote`, `setNoteText`, `removeNote`, `dropEmptyNotes`,
  `partitionsSource`, `seedEditorBlocks`. **Add one new pure op: `setBoldWords(blocks, i, indices, on)`**
  (set/clear bold on a range of word indices at once; keep the sorted-unique invariant), co-located test.
- `src/lib/applyScopeOverride.ts` — `computeOrdinals` for the live numbered-list preview.
- `src/index.css` — where the affordance classes live (see `.sl-splitword`/`.sl-boldword` from 5c/6c).
  Add the new gap-caret / handle / menu / bold-chip classes here. One token source, no ad-hoc hex.
- `src/theme/tokens.ts` — `tone.info` (notes), `accent`, the neutrals. Reuse; don't invent hex.

## The load-bearing parts (get these right)
1. **Selection → word indices (bold).** Render each word as a `<span data-w="i">`. On `mouseup`/
   `selectionchange` inside a contract line, find the spans the selection range intersects
   (`Range.intersectsNode`), map to their `data-w` indices, and show a floating chip positioned from the
   selection's `getBoundingClientRect()`. Clicking the chip calls `setBoldWords(blocks, i, indices, on)`
   where `on` = "not all already bold". Partial-word selections bold the whole touched word (bold is
   word-indexed — snap to touched words). The chip must not overflow the 452px drawer / viewport.
2. **Gap-click split.** Between adjacent words render a thin hoverable gap; hovering shows a caret; a
   click calls `splitBlock(blocks, i, gapIndex+1)`. Words themselves are NOT clickable anymore.
3. **The hover handle menu** wires ONLY existing ops — heading⇄para (`setKind`), bullet/number
   (`setList` cycle or explicit items), indent/outdent (`reindent`), join-with-above (`mergeUp`). Labeled
   text items, revealed on hover — not a permanent glyph row.
4. **Notes stay the only typing path.** The note row is a `<textarea>` wired to `setNoteText`; `save()`
   runs `dropEmptyNotes` then asserts `partitionsSource` (unchanged). Contract lines never accept typing.
5. **The save contract is unchanged.** `save()` still: `dropEmptyNotes` → `partitionsSource` guard →
   `saveOverride`. Do not weaken or reorder this. A safety-check failure still refuses the save.

## Scope (Phase R1)
1. **Pure op (tested):** `setBoldWords` in `scopeEdit.ts` + co-located test (range bold, sorted-unique,
   no-op off a note is N/A — bold is contract-and-note-agnostic; matches `toggleBold`'s guards).
2. **Editor rebuild** (`CommitmentDrawer.tsx`): plain-text lines · gap-split · selection→Bold chip
   (delete bold-mode/`BoldToggle`) · hover "⠿" handle → labeled menu (heading/para · bullet · number ·
   indent · outdent · join-up) · "+ Add note" with a `<textarea>` note row (delete/indent/list).
3. **Accessibility:** interactive targets ≥24px; helper/label text ≥4.5:1 contrast (today's helper is
   ~2.9:1 — fix via tokens/size). Keyboard-operable handle menu.
4. **CSS:** new affordance classes in `index.css` (gap caret, handle, menu, bold chip) from the one token
   source; reuse `tone.info` + `<strong>`.
5. **Keep** the rendered `ScopeOutline` (incl. the 6b "Your note" tint) working; polish only if needed.

## Guardrails / gates
- **UI reskin, not a rewrite.** Do NOT change `scopeEdit.ts` op *behavior* (only ADD `setBoldWords`), the
  data model, `coerceBlocks`, or `partitionsSource`. If a test in `scopeEdit.test.ts`/`mapScopeOverride.test.ts`
  needs changing, stop — that's a signal you're altering the engine, which R1 must not do.
- **Words locked / one typing path.** Contract lines reshuffle-only; typing only on `source:'user'` notes.
- **No drag-to-reorder** — that's R2. No new capabilities beyond today's + the new interactions.
- **No SQL/data change.** `blocks` jsonb unchanged.
- Standard Sitelines invariants: overlays stay `position:fixed` siblings of the card (the drawer already
  is — don't move it); one token source, no ad-hoc hex; `ScopeOverride` never enters My Court /
  `ballInCourt`; pure logic in `src/lib` with co-located tests, no clock inside.
- Seed → live parity: both `:5174` and `:5175` must exercise the new editor.
- Don't commit or push until the owner says "Approved."

## Exit criteria
typecheck + tests + build green; `setBoldWords` unit-tested; seed (`:5174`) and live logged-in (`:5175`)
click-through — **split** a line by clicking a gap, **select words → bold** via the floating chip, use
the **handle menu** to make a heading / bullet / a 1·2·3 numbered run / indent, **add a note and type**
into it, **save, refresh** → structure + bold + note all persist and render, the **contract words read
verbatim** (`partitionsSource` still passes on save), and the old word-button + bold-mode UI is gone.
Confirm it fits the 452px drawer (chip + menu don't overflow) and targets are comfortable. Then STOP and
report.

## Not this phase (R2)
- **Drag-to-reorder** lines (`moveBlock` pure op + drag handle + keyboard Move up/down), with the reorder
  safety rule confirmed at the R2 kickoff (recommend notes-only reorder for v1). Its own kickoff.
