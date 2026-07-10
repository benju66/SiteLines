# Kickoff — Commitments, Phase 6b: your-own-notes (the typing path + the one safety-model change)

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — this is the ONE change to the words-locked safety model (the invariant that has protected every scope save since Phase 5). Getting `partitionsSource`'s new "contract blocks only" filter exactly right — and never letting a typed note leak into the contract partition — is correctness-critical. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` mid-session (`/model claude-fable-5`) only if genuinely stuck on the safety reasoning.
>
> Implement **Phase 6b of Commitments** (your-own-notes — the owner can type their *own* clarifying list items into a commitment's scope, shown clearly marked as additions, while the executed contract's words stay verbatim and locked). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-10 - Commitments Phase 6b Kickoff.md` (this file)
> - `Notes/plans/Commitments-Plan.md` § Phase 6 (+ 6b) + `PLAN.md` (Phase 6 row) + `CLAUDE.md`
> - `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase 6b**. **Hard guardrail: contract words stay locked. Typing is permitted ONLY on `source:'user'` note blocks; contract blocks (`source` absent) remain restructure-only. `partitionsSource` must still pass for the CONTRACT blocks on every save — the new filter excludes `source:'user'` blocks BEFORE the assertion, and nothing else about the check changes.** No SQL/table change (`blocks` is already `jsonb`; the only CHECK is on `field`). Notes are always visibly the owner's (a tinted "Your note" treatment) — never rendered as if they were the subcontractor's committed scope. Verify with typecheck + tests + build + a logged-in `:5175` (and seed `:5174`) round-trip. Don't commit or push until I say "Approved."

---

## Why this phase exists
Phases 6a (lists) and 6c (bold) shipped **presentation-only** styling — decoration layered on the
contract's own words, no safety-model change. 6b is different: it's the one place the owner can **type
new text**. The owner often needs to pin a clarification or reminder into a scope ("Note: confirm crane
availability before mobilizing") without altering the executed subcontract language. The locked decision
(owner, 2026-07-09) is **"add my own items, contract locked"** — not a fully-editable rewrite. So notes
are free-text blocks marked `source:'user'`, rendered as clearly-marked additions, and **excluded** from
the words-locked partition assertion — while every contract block still must reconstruct the source
verbatim. This is the single, deliberate change to the safety model; it lands last (after 6a/6c) by design.

## Locked decisions (owner) — see `Commitments-Plan.md` § Phase 6
- **Your-own-notes** (2026-07-09): the owner may type their own new list items; they render clearly
  marked (a tinted "Your note" row). Contract words stay verbatim + locked. Typing is allowed **only** on
  note blocks.
- **Note placement** (locked 2026-07-10): a **freestanding** note block — addable **anywhere** in the
  list at **any indent** (not restricted to being a child of a contract block). Simplest data model +
  editor, most flexible. A note is just a block with `source:'user'`.
- **Safety invariant changes shape, not spirit:** `partitionsSource` filters to **contract blocks**
  (`source !== 'user'`) before checking `normalize(join) === normalize(source)`. Notes are free text,
  excluded from the check, stored, and rendered as additions — so the drawer can still never show altered
  *contract* language.

## Read fresh before editing (don't trust line numbers in any doc)
- `src/types.ts` — `ScopeBlockOverride` (`{ kind, indent, text, list?, bold? }`) — add `source?: 'user'`
  (present = a user-authored note; absent = contract words). Document that `text` is free on a note and
  verbatim-slice-of-source on a contract block.
- `src/lib/parseScope.ts` — `ScopeBlock` (render type) — add `source?: 'user'` (like `indent?`/`list?`/
  `bold?` were added) so `ScopeOutline` can render a note distinctly. Parser blocks leave it unset.
- `src/lib/scopeEdit.ts` — **the load-bearing change is here.** `partitionsSource` must filter to contract
  blocks before joining (see "The load-bearing part"). Add the note ops: `addNote(blocks, index)` (insert
  a fresh `{ kind:'para', indent:0, text:'', source:'user' }` after `index`) and `setNoteText(blocks,
  index, text)` (typing — the ONLY op that writes `text`, and ONLY on a `source:'user'` block; a no-op /
  refusal on a contract block). Confirm the existing structural ops behave sanely on notes: `mergeUp` must
  **not** merge a note into a contract block or vice-versa (that would either drop a note into the contract
  partition or splice contract words into a note — decide: disallow cross-`source` merge). `splitBlock`/
  `toggleBold` are meaningless on an empty note — keep them harmless. `setList`/`reindent`/`setKind` may
  apply to notes (notes support indent + list style per plan). Add a `removeBlock`/`deleteNote` op if one
  doesn't already exist.
- `src/lib/applyScopeOverride.ts` — `overrideToBlocks` maps `ScopeBlockOverride` → `ScopeBlock`; carry
  `source` through (exactly like it carries `list`/`bold`).
- `src/lib/mapScopeOverride.ts` — `coerceBlocks` must accept + validate `source`: keep it only when it's
  the literal `'user'` (drop any other value). A `source:'user'` block still needs a string `text` (may be
  empty) — do NOT require the text to be a slice of source (notes are free text; `coerceBlocks` never
  checks the partition anyway). The single read boundary for Supabase jsonb + localStorage.
- `src/components/overlays/CommitmentDrawer.tsx` —
  - `ScopeStructureEditor`: an **"Add note"** action (button) that inserts a note block and focuses it;
    the save flow already calls `partitionsSource` — with the filter change it now ignores notes.
  - `EditorBlockRow`: when `block.source === 'user'`, render a **text `<input>`/`<textarea>`** (the ONLY
    place typing is allowed) wired to `setNoteText`, plus a delete control — NOT the word-split/bold
    targets a contract block shows. A contract row is unchanged.
  - `ScopeOutline`: render a `source:'user'` block with a **tinted "Your note" treatment** (a small
    "Your note" label + a tinted background/left-rule), visually distinct from contract prose. Reuse a
    `tone` token — `tone.info` is the recommended tint (`tone.warn` is already the stale banner). No ad-hoc hex.
- `src/index.css` — only if a note affordance/hover class is needed; one token source, no ad-hoc hex.
- Decide the **empty-note-on-save** behavior: recommend **dropping empty (whitespace-only) notes on save**
  so a stray "Add note" click can't persist a blank row. Do it in `save()` (filter before writing), keep
  it pure/testable.

## The load-bearing part — the one safety-model change
`partitionsSource` is the assertion that has guaranteed, on every save since Phase 5, that the rendered
scope still spells out the exact contract source. Today (verify by reading it fresh):

```ts
export function partitionsSource(blocks, source) {
  return normalizeScope(blocks.map((b) => b.text).join(' ')) === normalizeScope(source)
}
```

For 6b it must exclude notes **before** joining — nothing else changes:

```ts
export function partitionsSource(blocks, source) {
  const contract = blocks.filter((b) => b.source !== 'user')
  return normalizeScope(contract.map((b) => b.text).join(' ')) === normalizeScope(source)
}
```

This is the correctness core. Co-locate tests that prove:
- a save with a note added still passes (the note's text is ignored by the assertion);
- a note round-trips (typed text persists as `source:'user'`, contract blocks reconstruct verbatim);
- the check STILL FAILS if a **contract** block's words were altered (so the guarantee for contract
  language is intact — a note must not become an escape hatch for editing the contract);
- `setNoteText` refuses to write a contract block (only `source:'user'` text is mutable);
- cross-`source` `mergeUp` is disallowed (a note never merges into contract words or vice-versa).

## Scope (Phase 6b)
1. **Data model:** `source?: 'user'` on `ScopeBlockOverride` + `ScopeBlock` (absent = contract words).
2. **Safety model:** `partitionsSource` filters to contract blocks before asserting (above).
3. **Pure ops (tested):** `addNote`, `setNoteText` (the only typing path), delete; guard cross-`source`
   merges; carry `source` through the existing spread ops. Drop empty notes on save.
4. **coerceBlocks:** accept + validate `source` on read (Supabase jsonb + localStorage).
5. **Render:** `ScopeOutline` shows notes with a distinct, tinted "Your note" treatment (a `tone` token).
6. **Editor:** an "Add note" action + a text input on note rows (typing allowed only here) + note delete;
   contract rows unchanged.
7. **Tests:** the pure ops + `partitionsSource` filter + `coerceBlocks`; the safety proofs above.

## Guardrails / gates
- **⚠️ This is the one change to the words-locked safety model.** Contract blocks (`source` absent) stay
  restructure-only; `partitionsSource` must still pass for them on every save. Never let typed text enter
  the contract partition.
- **No typing on contract blocks** — `setNoteText` is the only text-writing op, and only on `source:'user'`.
- **Notes are always visibly the owner's** — distinct tinted styling + a "Your note" marker; never
  rendered as if they were the subcontractor's committed scope.
- **No SQL/table change** — `blocks` is already `jsonb`; the only CHECK is on `field`. No ⛔ SQL gate.
- Standard Sitelines invariants: one token source (`tokens.ts`/`index.css`, reuse a `tone` token +
  the existing `<strong>` style — no ad-hoc hex); overlays stay `position:fixed` siblings of the card;
  domain atom stays `Item`; `ScopeOverride` is user/reference data and **never** enters My Court /
  `ballInCourt`; pure logic in `src/lib` with co-located tests, no clock inside.
- Seed → live parity: the seam is unchanged; both `:5174` and `:5175` must exercise notes.
- Don't commit or push until the owner says "Approved."

## Exit criteria
typecheck + tests + build green; live logged-in (`:5175`) and seed (`:5174`) — add a note to a real
commitment's scope, type into it, save, refresh → the **note persists marked as yours** (tinted "Your
note"), the **contract words remain verbatim** (a saved override still reconstructs the source exactly),
and a save still **fails** if a contract block's words were somehow altered. Confirm notes can be placed
freestanding anywhere at any indent, and an empty note doesn't persist. Then STOP and report.

## Not this phase
- **6a (lists) + 6c (bold)** are shipped — presentation-only decoration. Don't revisit them.
- No fully-editable contract text, no rich-text, no Procore write-back. Notes are the ONLY typing path,
  and they never touch the contract partition.
