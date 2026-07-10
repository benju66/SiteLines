# Kickoff — Commitments, Phase 6a: scope list styling (bullets + opt-in numbers, presentation-only)

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — extends the block model + the drawer editor/renderer with correctness in the ordinal-numbering logic and the words-locked invariant; well-specified but touches shared scope code. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` mid-session only if genuinely stuck.
>
> Implement **Phase 6a of Commitments** (scope **list styling** — bullets + opt-in numbered items, presentation-only; no typing, no notes yet). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-09 - Commitments Phase 6a Kickoff.md` (this file)
> - `Notes/plans/Commitments-Plan.md` § Phase 6 (+ 6a) + `PLAN.md` (Phase 6 row) + `CLAUDE.md`
> - `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase 6a**. **Hard guardrail: this is presentation-only — the list style (`•` / ordinal) is drawn at render and NEVER stored in a block's `text`; do NOT touch `partitionsSource` or the safety model, and do NOT add note/typing (that's 6b).** No SQL/table change. Verify with typecheck + tests + build + a logged-in `:5175` (and seed `:5174`) round-trip. Don't commit or push until I say "Approved."

---

## Why this phase exists
Phase 5 shipped the scope-structure editor (headings, indent, split, merge) with the words locked.
The owner expected true **list formatting** too — bullet points and numbered items. Phase 6a adds
that as a pure **render style** on the existing blocks: it changes how a block looks, never its
words, so the Phase-5 safety invariant is completely untouched. (Typing your own notes — the one
change that touches the safety model — is **Phase 6b**, not this phase.)

The target look is the mockup the owner approved (2026-07-09): headings, a numbered list, bullets.

## Locked decisions (owner, 2026-07-09) — see `Commitments-Plan.md` § Phase 6
- **Bullets:** any block can be a bulleted item; sub-bullets via `indent`. The `•` is decoration.
- **Numbers: opt-in per block, NOT automatic** — these scopes already carry `1.`/`1.1.` in the
  contract text, so auto-numbering everything would double them. A block the owner marks "numbered"
  shows a **computed ordinal**; consecutive numbered blocks at the same `indent` count 1·2·3.
- Presentation only — never stored in `text`.

## Read fresh before editing (don't trust line numbers in any doc)
- `src/types.ts` — `ScopeBlockOverride` (`{ kind:'para'|'heading', indent, text }`) — add `list?`.
- `src/lib/parseScope.ts` — `ScopeBlock` (the render type; already has optional `indent?`) — add
  optional `list?` and, later (6b), `source?`, exactly the way `indent?` was added.
- `src/lib/applyScopeOverride.ts` — `overrideToBlocks` maps `ScopeBlockOverride` → `ScopeBlock`;
  carry `list` through. This is where a **pure, tested ordinal pass** fits (annotate number blocks
  with their display ordinal), or put it in `scopeEdit`.
- `src/lib/scopeEdit.ts` — the pure ops; add a `setList(blocks, index, list)` op (+ test). Do NOT
  change `partitionsSource` (list isn't stored text).
- `src/lib/mapScopeOverride.ts` — `coerceBlocks` must accept + validate the new optional `list`
  (drop an invalid value to `undefined`; never crash).
- `src/components/overlays/CommitmentDrawer.tsx` — `ScopeOutline` (render the bullet glyph / ordinal
  on para blocks) + `EditorBlockRow` (add a control to set a block's list style) + `IconBtn`.
- `src/index.css` — any hover/affordance class, using the one token source.

## Scope (Phase 6a)
1. **Data model:** `ScopeBlockOverride.list?: 'bullet' | 'number'` (absent = plain). `ScopeBlock`
   gains the same optional field so `ScopeOutline` can render it.
2. **Ordinal numbering (pure + tested):** a deterministic pass that assigns each `list:'number'`
   block its display ordinal — a counter per `indent` level, reset when a non-number block breaks
   the run at that level. Co-located `.test.ts` (1·2·3 for a run; nested restarts; a gap resets).
3. **Render:** `ScopeOutline` draws a leading `•` for `list:'bullet'` and the computed ordinal for
   `list:'number'`, on `para` blocks, respecting `indent`. Headings unaffected.
4. **Editor control:** in `EditorBlockRow`, a control to cycle a block's list style
   (none → bullet → number → none is the recommended UX — confirm; fewer buttons in the dense row).
5. **coerceBlocks:** validate `list` on read (from Supabase jsonb and localStorage).
6. **Tests:** the ordinal pass + `setList` op (pure). `partitionsSource` unchanged — a test proving
   applying a list style does NOT change the partition result is worthwhile.

## Guardrails / gates
- **Presentation-only.** The `list` value is the ONLY new thing stored; the glyph/ordinal is drawn
  at render and never enters `text`. `partitionsSource` and the save flow are unchanged.
- **No typing, no notes** — that's 6b. Don't add `source:'user'` or any text input here.
- **No SQL/table change** — `blocks` is already `jsonb`; the only CHECK is on `field`. Nothing to
  present for sign-off. (No ⛔ gate this phase.)
- Standard Sitelines invariants: one token source (no ad-hoc hex — reuse `tokens.ts`/`index.css`);
  overlays stay `position:fixed` siblings of the card; domain atom stays `Item`; `ScopeOverride` is
  user/reference data and **never** enters My Court / `ballInCourt`; pure logic in `src/lib` with
  co-located tests, no clock inside.
- Seed → live parity: the seam is unchanged; both `:5174` and `:5175` must exercise the styles.
- Don't commit or push until the owner says "Approved."

## Exit criteria
typecheck + tests + build green; seed (`:5174`) and live logged-in (`:5175`) — mark blocks as
bullet / number in the editor, save, refresh → the styles **persist and render** (bullets show `•`,
numbered blocks show 1·2·3), and the **contract words are unchanged** (a saved override still reads
verbatim). Then STOP and report.

## Not this phase (6b)
- 6b — **your-own-notes:** a `source:'user'` block kind, a text input in the editor (the only place
  typing is allowed), `partitionsSource` filtering out user blocks before the assertion, and the
  tinted "Your note" rendering. That's the one change to the words-locked safety model; it gets its
  own kickoff after 6a ships.
