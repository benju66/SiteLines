---
name: plan-phases
description: Generate a phased implementation plan-of-record for a new feature or workstream in Sitelines (the construction-PM "single pane of glass" app). Use whenever the user asks to plan a feature, break work into phases or slices, start a new workstream, or describes a multi-session feature to build — even if they never say the word "plan" (e.g. "how should we approach X", "next I want the app to do Y"). This skill produces the plan + a fresh-session kickoff prompt only; it never implements code.
---

# Phased Implementation Plan (plan-of-record) — Sitelines

Produce a plan that lets each phase run in its own focused Claude Code session.
The user (Ben) is the **product owner and domain expert, not a developer** — lead
with a 1–2 sentence plain-English summary, explain jargon in passing, keep it
short, and frame technical choices as **decisions with trade-offs**. Never bury a
decision inside implementation detail.

**This skill only plans. It must never implement code.** It opens a phase; the
phase's own **exit-criteria gate** (typecheck + build + click-through, see below)
closes it.

## Session model (the one standing choice)

Default: **plan and implement in separate sessions** — each phase starts with a
cold, focused context, which is how a multi-view build like this stays correct.
**Escape hatch:** for a genuinely small phase (one leaf view, no overlay, no data
seam), planning-then-building in the same session is fine — say so explicitly and
skip the kickoff file, going straight to the work. When in doubt, split.

## Ground truth for this repo (there is no AGENTS.md)

The sources of architectural truth, in order:
1. **`PLAN.md`** (repo root) — the workstream plan-of-record: the ordered phase
   list, status table, and sequencing rationale. **This is the living roadmap.**
2. **`design_handoff_sitelines/README.md`** — the design handoff: every view, overlay, token, and interaction.
3. **`design_handoff_sitelines/DATA_CONTRACT.md`** — the normalized data shapes (the UI ↔ Procore seam) and
   the ball-in-court rule.

## Step 1 — Investigate (read-only)

Before proposing anything, understand the ground truth. Make **no file
modifications** in this step.

- Read `PLAN.md`, `design_handoff_sitelines/README.md`, and `design_handoff_sitelines/DATA_CONTRACT.md` in full. Note where the new
  work sits in the existing phase order and which invariants it touches (see
  "Hard guardrails" below).
- Read the relevant source fresh — the components/selectors/state/data the feature
  touches, plus `src/types.ts` if the data model is involved. **Do not trust line
  numbers in prior docs — re-read the real files.**
- Check whether the phase is a new *view surface* (reuse the shell + `ListTable` +
  primitives) or a new *workstream* (e.g. wiring the Procore service behind
  `src/data/`). A new workstream may warrant its own plan doc (Step 3); a view
  surface is usually just a new phase entry in `PLAN.md`.

## Step 2 — Surface open decisions BEFORE writing the plan

Identify the design choices the owner must make (data model, UI placement — new
view vs. tab, what ships in v1 vs. what's deferred, seed-data-only vs. wiring a
real source). For each:

- Present it as a plain-language question with concrete options.
- Mark exactly one option **(Recommended)** with a one-line reason.
- For fuzzy or exploratory forks, discuss conversationally first to sharpen the
  question rather than firing a multiple-choice picker cold.

Do not write the plan until the load-bearing decisions are settled — a plan built
on guessed decisions gets rewritten.

## Step 3 — Record the plan-of-record

**Default: update `PLAN.md`.** Sitelines is one workstream (recreate the design),
so the phase belongs in the existing status table + ordered plan there — add or
refine its entry (scope, why-here, files touched, exit criteria) and flip status
boxes as reality changes. Keep PLAN.md's "sequencing principle" and through-line intact.

**For a genuinely distinct new workstream** (e.g. "Procore integration",
"persistence & auth"), write a self-contained doc to
`Notes/plans/<Feature>-Plan.md` (descriptive slug, **no date prefix**; superseded
plans move to `Notes/plans/archive/`) and link it from PLAN.md. Structure:

```markdown
# <Feature> — <one-line> (self-contained build plan)
> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: PLAN.md (repo root) + the design handoff (design_handoff_sitelines/).

## Goal
One paragraph: what exists when this is done, in user-visible terms.

## Out of scope / deferred
Explicit list — what this plan deliberately does NOT do, and which later phase owns it.

## Locked product decisions (from the owner)
Decisions already made, one line each, with the why.

## Data model (if touched)
Which DATA_CONTRACT shapes the feature reads/writes; keep the UI dumb — formatting
and derivation live in the selector layer, not the components.

## Build-on inventory (read these fresh before using)
Existing shell / selectors / primitives / ListTable / tokens to REUSE — and what
NOT to fork (e.g. the centralized ball-in-court rule, the token source).

## Pure logic to extract + unit-test
Framework-free, deterministic functions in `src/selectors/` or `src/lib/` (+ a
`.test.ts`) — this is where load-bearing correctness lives. Pass timestamps/data
IN; never derive "today" inside a pure fn (keeps tests deterministic).

## Sub-phasing (ship + verify each)
### Phase N — <name>
- **Scope:** files/areas touched, small enough for one session.
- **Approval gates:** ⛔ flag any step needing explicit owner sign-off before
  execution (schema/data-seam changes, anything that would touch a real Procore
  connection or credentials, pushes to a shared branch).
- **Exit criteria:** typecheck + build green (commands below) · pure logic
  unit-tested if any was added · live `:5173` click-through if UI changed · stop
  at the phase boundary; do not commit/push until the owner says "Approved."

## Hard guardrails (do not violate)
The specific invariants this feature must not break (see the standing list below).

## Open decisions
Anything still unresolved, and which phase resolves it.
```

### Verification commands (the exit-criteria gate)

Bash cwd persists across calls and a stray `cd` can trigger a prompt, so run npm
with an **absolute prefix**:

```
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck   # tsc -b (primary gate)
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run build       # tsc -b && vite build
```

- **UI/interaction verification** is a live click-through: start the dev server
  (port **5173**) via the preview tooling or `npm run dev`, and drive it with
  Playwright. Read DOM state in a **separate** call after a click — React
  re-renders after the current tick, so a same-tick read sees stale state.
- **Tests:** **vitest** is configured (`npm test`). When a phase adds
  load-bearing pure logic (selectors, ball-in-court, financial aggregation),
  extract it to a pure function with a co-located `foo.test.ts` (import
  `{ describe, it, expect }` from `'vitest'`; pass `today`/`now` in). Typecheck
  + test + build are the gate.

## Step 4 — Write the kickoff (skip only for a same-session small phase)

Write the detailed kickoff to `Notes/kickoffs/<YYYY-MM-DD> - <Feature> Phase <N> Kickoff.md`.
It is a ready-to-paste prompt for a fresh session that names the plan, states the
phase scope + exit criteria, points at the ground-truth docs, reminds the session
to re-read files fresh and verify with the absolute-prefix commands, and says to
stop at the phase boundary.

**REQUIRED — the kickoff MUST open with a small paste-ready launch prompt.** This
is the owner's standing rule: the launch prompt lives at the **very top of the
doc**, not in chat — the owner pastes this top block verbatim and will not hunt
for it. Make it the first thing under the H1, as a `## ▶ Launch prompt (paste
this to start a fresh session)` block, ~3–6 lines, naming:
- the phase + feature — "Implement **Phase N of <Feature>** (<one-line>)";
- the exact **documents to read in full** — this kickoff file (full path), the
  plan-of-record (`PLAN.md` or the `Notes/plans/` doc), `design_handoff_sitelines/README.md`, and
  `design_handoff_sitelines/DATA_CONTRACT.md`;
- the one hard guardrail / ⛔ gate for this phase; "don't commit or push until I
  say Approved."

All the depth (required reading, scope, guardrails, exit criteria) follows BELOW
this block. Template:

```markdown
# Kickoff — <Feature>, Phase <N>: <one-line>

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: <Model> · effort <level>** — <why>. (`/model <model-id>` first.)
>
> Implement **Phase <N> of <Feature>** (<one-line>). Read these in full, then follow them:
> - `Notes/kickoffs/<YYYY-MM-DD> - <Feature> Phase <N> Kickoff.md` (this file)
> - `PLAN.md` (Phase <N>) + `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase <N>**. <one hard guardrail / ⛔ gate.> Verify with typecheck + build + a `:5173` click-through. Don't commit or push until I say "Approved."

---

> Context for the session (the detail the launch prompt points at). …
```

**Archive the prior phase's kickoff first.** Before writing a new kickoff for a
feature, move any existing kickoff file(s) for it from `Notes/kickoffs/` to
`Notes/kickoffs/archive/`, so `Notes/kickoffs/` only holds the CURRENT live
kickoff(s). This applies to every phase hand-off, not just this skill.

This file is the **detailed, self-contained kickoff the fresh session actually
reads** — NOT what you paste into chat (Step 5). Keep all the depth here so the
chat hand-off stays short.

## Model & effort recommendation (REQUIRED on every launch prompt)

Every launch prompt — the top block of a kickoff file AND the short chat
hand-off — must open with a one-line **Run with:** header naming the model and
effort the implementing session should use, with a ~5-word reason. The owner
acts on it via `/model` before pasting the prompt (Claude Code cannot switch
its own model). Format:

> **⚙️ Run with: <Model> · effort <level>** — <why, in a few words>. Escalate
> to `claude-fable-5` mid-session (`/model claude-fable-5`) if genuinely stuck.

Decision rule (derive, don't guess):

| Work profile | Recommend |
|---|---|
| Implementation of a well-specified plan; coding/agentic; correctness-critical spots | **Opus 4.8 · xhigh** (the default for phases produced by this skill) |
| Mechanical / repetitive / pattern-following (wiring, per-tool extension, doc passes) | **Opus 4.8 · high** |
| Ambiguous or hardest-tier reasoning; architecture from scratch; long AUTONOMOUS runs; escalation after 4.8 hits a wall | **Fable 5 · high** (2× price; thinking always on; slower turns — don't default to it) |

Rationale: spend capability where ambiguity lives. This skill's whole job is to
remove ambiguity before implementation, so phases it produces rarely need
Fable 5. Note model guidance drifts — if the current model lineup differs from
this table, check via the claude-api skill and update this section.

## Phase sizing rule

Each phase must be completable in **one fresh session**: roughly one vertical
slice or one view surface. If a phase needs a data-seam change AND a new view AND
an overlay, split it. A phase that can't be described in three bullet points is
too big. When in doubt, make phases smaller — an extra kickoff is cheap; a phase
that overruns its context window is not.

## Step 5 — Present, hand off with a SHORT chat prompt, and stop

Summarize the plan in chat (goal, phase list, where the approval gates are), note
any decisions still open, and wait for approval. **Do not begin Phase 1 in this
session** unless it's the declared same-session small-phase escape hatch.

Hand off the phase with a **short, ready-to-paste launch prompt in chat — NOT the
full kickoff text.** The detail lives in the `Notes/kickoffs/` file; the chat
prompt just tells a fresh session to go read that file and start, so the owner
never has to open it. Keep it to ~3–6 lines, containing only:

- the **⚙️ Run with:** model/effort header (see "Model & effort recommendation");
- the phase to implement and the feature name;
- "Read `Notes/kickoffs/<YYYY-MM-DD> - <Feature> Phase <N> Kickoff.md` in full and
  follow it" — the file carries the required reading + guardrails, so do NOT repeat them;
- the ONE thing the session must not blow past before reading anything: any ⛔
  approval gate / hard stop for this phase.

## Hard guardrails (Sitelines invariants — do not violate)

Bake these into every plan's guardrails section:

- **Overlays render as `position:fixed` siblings of the card**, OUTSIDE its
  `overflow:hidden` (README "Global Layout") — a fixed overlay clipped by the card
  is invisible.
- **The ball-in-court rule stays centralized** in `src/lib/ballInCourt.ts`
  (`TERMINAL` / `COURT_TOOLS` / `isBallInCourt`) — the single place governing the
  inbox. Extend it there; never re-implement the rule in a view.
- **The domain atom is `Item`, not `Record`** — never re-introduce a type named
  `Record` (it shadows TS's `Record<K,V>` utility).
- **Design tokens have one source** — `src/theme/tokens.ts` (JS) + `src/index.css`
  CSS variables. No ad-hoc hex in components beyond what the tokens define; match
  the README's exact values.
- **Views stay derived from state** — the flat `AppState` + `patch()` in
  `src/state/AppContext.tsx`; new view-models go in `src/selectors/`, no view owns
  state.
- **Keep the UI dumb** — the `DATA_CONTRACT` normalized shapes are the Procore
  seam; formatting/derivation lives in the selector layer, so seed data swaps for
  the real service with no view changes. Seed data lives in `src/data/`.
```
