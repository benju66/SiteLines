# CLAUDE.md — working agreements for Sitelines

## Read first
1. `PLAN.md` — the build plan-of-record (phase order, status, rationale). Update
   its status table as surfaces land.
2. `design_handoff_sitelines/README.md` — the design spec (tokens, layouts,
   interactions). This is a **high-fidelity** recreation; match it exactly.
3. `design_handoff_sitelines/DATA_CONTRACT.md` — the normalized shapes and the
   ball-in-court rule. The seam between UI and Procore.

Owner is the product owner / domain expert, not a developer: lead with a 1–2
sentence plain-English summary, explain jargon in passing, frame technical
choices as decisions with trade-offs.

## Verification gate (run before calling anything done)

```bash
npm run typecheck   # tsc -b — primary gate
npm test            # vitest
npm run build
```

UI changes also get a live click-through on `:5173` (drive with Playwright; read
DOM state in a SEPARATE call after a click — React re-renders after the tick).
Lint is not configured; typecheck + test + build are the gate.

## Hard guardrails (do not violate)

- **Overlays render as `position:fixed` siblings of the app card**, outside its
  `overflow:hidden` (mount them in `App.tsx`'s overlay slot). A fixed overlay
  inside the card is silently clipped.
- **The ball-in-court rule stays centralized** in `src/lib/ballInCourt.ts`
  (`TERMINAL` / `COURT_TOOLS` / `isBallInCourt`) — the single place governing
  My Court. Never re-implement it in a view or duplicate `TERMINAL` in SQL.
- **The domain atom is `Item`, not `Record`** (shadows TS's `Record<K,V>`).
- **One token source**: `src/theme/tokens.ts` + `src/index.css` CSS variables.
  No ad-hoc hex beyond what the handoff defines.
- **Views stay derived from state**: flat `AppState` + `patch()`; view-models
  live in `src/selectors/` as pure functions taking (data, state).
- **Keep the UI dumb / respect the data seam**: components read data via
  `useSiteData()` (DataProvider); selectors take `itemsByTool`/`SiteData` as
  parameters and never import data modules. The seed → Supabase swap must need
  zero view changes.
- **Pure logic gets tests**: deterministic fns in `src/lib/` / `src/selectors/`
  with co-located `.test.ts`; pass `today`/`now` in — never read the clock inside.
- Non-clickable `ProjectTag` renders a `<span>` (nested-button DOM fix) — keep it.

## Planning

New features/workstreams go through the `plan-phases` skill
(`.claude/skills/plan-phases/SKILL.md`): investigate → surface decisions →
plan → kickoff. Workstream plans live in `Notes/plans/`, kickoffs in
`Notes/kickoffs/` (archive superseded ones). Phases with ⛔ gates (SQL, keys,
credentials) stop for explicit owner approval.

## Data backend context

The sibling repo `C:/Users/BUrness/Dev/FP-Analytics` is a Python ETL that syncs
Procore → Supabase (`procore_*_master` tables). The wiring plan is
`Notes/plans/Procore-Data-Seam-Plan.md` (Supabase SQL views → contract shapes →
`supabase-js` DataSource). Don't ship service-role keys in the browser bundle.
