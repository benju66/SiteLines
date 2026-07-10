# Kickoff — Commitments, Phase 6c: bold word-level emphasis (presentation-only)

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — well-specified, but the bold-index re-mapping through split/merge and the "your bold wins" render precedence are correctness-critical over shared scope code. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` mid-session (`/model claude-fable-5`) only if genuinely stuck.
>
> Implement **Phase 6c of Commitments** (scope **bold** — word-level emphasis in the structure editor, presentation-only). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-10 - Commitments Phase 6c Kickoff.md` (this file)
> - `Notes/plans/Commitments-Plan.md` § Phase 6 (+ 6c) + `PLAN.md` (Phase 6 row) + `CLAUDE.md`
> - `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase 6c**. **Hard guardrail: presentation-only — bold is stored as which words are bold (word indices), NEVER as markup in a block's `text`; do NOT touch `partitionsSource` or the words-locked safety model, and do NOT add note/typing (that's 6b).** No SQL/table change. Verify with typecheck + tests + build + a logged-in `:5175` (and seed `:5174`) round-trip. Don't commit or push until I say "Approved."

---

## Why this phase exists
Phase 6a shipped list styling (bullets + opt-in numbers). The owner also wants **bold** — the ability
to emphasize the words that matter in a scope block (a key obligation, a deadline, a dollar figure).
Like lists, bold is a pure **render style** layered on the existing blocks: it changes how words *look*,
never what they *say*, so the Phase-5 words-locked invariant is completely untouched. Bold selects
**existing** words only (no typing), so — unlike your-own-notes (6b) — it needs **no** safety-model
change. 6c is independent of 6b; build it first so the one risky (words-locked) change lands last.

## Locked decisions (owner, 2026-07-10) — see `Commitments-Plan.md` § Phase 6, decision 4
- **Word-level bold**, stored as word indices into the block's space-split `text` — never markup in `text`.
- **Input = a bold-mode toggle** in the editor: flip it on, then click words to bold/unbold; with bold
  mode off, a word-click still splits the line (the Phase-5 behavior, unchanged).
- **Precedence = your bold wins per block:** once a block has any manual bold, the automatic bolding of
  Title-case sub-labels (`renderProse` / `SUBHEADER_LABEL`) is **suppressed for that block**; blocks with
  no manual bold keep auto-bolding exactly as today.
- Presentation only — never stored in `text`; `partitionsSource` stays untouched.

## Read fresh before editing (don't trust line numbers in any doc)
- `src/types.ts` — `ScopeBlockOverride` (`{ kind, indent, text, list? }`) — add `bold?: number[]`.
- `src/lib/parseScope.ts` — `ScopeBlock` (render type; has `indent?`, `list?`, `ordinal?`) — add `bold?:
  number[]`, exactly the way `list?` was added.
- `src/lib/applyScopeOverride.ts` — `overrideToBlocks` maps `ScopeBlockOverride` → `ScopeBlock`; carry
  `bold` through (like it carries `list`). No ordinal-style computation needed for bold.
- `src/lib/scopeEdit.ts` — the pure ops. Add `toggleBold(blocks, index, wordIndex)`. **Make `splitBlock`
  and `mergeUp` bold-index-aware** (see "The load-bearing part" below). `setKind`/`reindent`/`setList`
  spread `{ ...b }`, so they already carry `bold` through untouched — confirm, don't change. Do NOT touch
  `partitionsSource` (bold isn't stored text).
- `src/lib/mapScopeOverride.ts` — `coerceBlocks` must accept + validate `bold` (clean array of unique,
  in-range, non-negative integers; drop the field otherwise; never crash).
- `src/components/overlays/CommitmentDrawer.tsx` — `renderProse` (honor manual `bold`; suppress
  auto-bold on manually-bolded blocks) + `ScopeStructureEditor` (a `boldMode` state + a "B" toggle + a
  "bold mode" header indicator) + `EditorBlockRow` (in bold mode, word-click toggles bold and bold words
  render bold live; out of bold mode, word-click splits as today). Reuse the existing `<strong>` style.
- `src/index.css` — only if a bold-mode affordance/hover class is needed; one token source, no ad-hoc hex.

## The load-bearing part — bold indices must survive split & merge
Bold is a set of word indices into `text.split(' ')`. Structural ops move words between blocks, so the
indices must move with them or bold will land on the wrong words:
- **`splitBlock(blocks, index, wordIndex)`** — the new first block keeps bold indices `< wordIndex`; the
  new second block keeps indices `>= wordIndex`, each **offset by `− wordIndex`**.
- **`mergeUp(blocks, index)`** — the merged block keeps `prev`'s bold indices, then appends `cur`'s bold
  indices each **offset by `+ prev.text.split(' ').length`**.
- `setKind` / `reindent` / `setList` don't move words → `bold` rides through unchanged (verify).
This is the correctness core — co-locate tests: toggle add/remove (sorted, in range); a split re-maps
bold to the two halves; a split-then-merge round-trips the bold set; `partitionsSource` stays true after
each op (bold never changes the words).

## Scope (Phase 6c)
1. **Data model:** `bold?: number[]` on `ScopeBlockOverride` + `ScopeBlock` (absent/empty = no manual bold).
2. **Pure ops (tested):** `toggleBold`; bold-aware `splitBlock`/`mergeUp` re-mapping (above).
3. **Render:** `renderProse` wraps the bold-index words of a block in `<strong>` (existing style) on para
   blocks (headings are already bold); when a block has manual bold, suppress the `SUBHEADER_LABEL`
   auto-bold for that block only.
4. **Editor:** a `boldMode` toggle (a "B" control + a clear header indicator). In bold mode, word-click
   toggles that word's bold and bold words show bold live; out of bold mode, word-click splits (unchanged).
5. **coerceBlocks:** validate `bold` on read (Supabase jsonb + localStorage).
6. **Tests:** the pure ops + `coerceBlocks`; a test proving a bold edit does NOT change the partition result.

## Guardrails / gates
- **Presentation-only.** `bold` (word indices) is the only new stored thing; the emphasis is applied at
  render and never enters `text`. `partitionsSource` and the save flow are unchanged.
- **No typing, no notes** — that's 6b. Bold only marks EXISTING words; don't add `source:'user'` or any
  text input here.
- **No SQL/table change** — `blocks` is already `jsonb`; the only CHECK is on `field`. No ⛔ gate this phase.
- Standard Sitelines invariants: one token source (reuse the existing `<strong>` style / `tokens.ts` —
  no ad-hoc hex); overlays stay `position:fixed` siblings of the card; domain atom stays `Item`;
  `ScopeOverride` is user/reference data and **never** enters My Court / `ballInCourt`; pure logic in
  `src/lib` with co-located tests, no clock inside.
- Seed → live parity: the seam is unchanged; both `:5174` and `:5175` must exercise bold.
- Don't commit or push until the owner says "Approved."

## Exit criteria
typecheck + tests + build green; seed (`:5174`) and live logged-in (`:5175`) — enter bold mode, bold a
few words in a block, save, refresh → the **bold persists and renders**, auto-bold is **suppressed** on
manually-bolded blocks (still on elsewhere), the **contract words are unchanged** (a saved override still
reads verbatim), and splitting/merging a bolded block keeps the **right words** bold. Then STOP and report.

## Not this phase
- **6b — your-own-notes:** `source:'user'` note blocks, a text input in the editor (the only place typing
  is allowed), `partitionsSource` filtering out user blocks before the assertion, and the tinted "Your
  note" rendering. That's the one change to the words-locked safety model; it has its own kickoff.
