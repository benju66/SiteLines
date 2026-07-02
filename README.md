# Sitelines

A personal command console for a commercial construction Project Manager — a
"single pane of glass" that collapses scattered Procore views into one screen
scannable in under 30 seconds each morning.

The organizing idea is **Ball-in-Court**: a home inbox ("My Court") surfacing
every *live* item across all tools where the ball is in your court or you're
tracking someone else's clock. From there, drill into any Procore tool (RFIs,
Submittals, Budget, …), scoped by project, toggling between "In My Court" and
the full register.

Desktop-only, single-user (v1). Currently runs on in-file seed data; the
production path feeds it from a Procore-integration service (see
[the data seam plan](Notes/plans/Procore-Data-Seam-Plan.md)).

## Stack

- **Vite + React 18 + TypeScript (strict)** — no UI framework; the design is
  hand-built to match the handoff's tokens exactly (a dense, Linear-style ops
  tool).
- **Vitest** for the pure logic layer (selectors, ball-in-court rule, derive fns).
- Path alias `@/*` → `src/*`.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc -b (primary gate)
npm test           # vitest
npm run build      # production build
```

Dev flags: `?slow` simulates a slow data load, `?fail` a failed one (exercises
the loading/error states).

## Project structure

```
src/
  types.ts            domain types (mirror the data contract)
  theme/tokens.ts     design tokens (single color source, with index.css vars)
  data/               seed data + the seed DataSource
  lib/                ballInCourt (the inbox rule) · dataSource seam · derive · party
  selectors/          pure view-model derivation (data + state in, view out)
  state/              AppContext (flat UI state) · DataContext (data lifecycle)
  components/
    layout/           Sidebar · Header · MainContent (view router)
    views/            MyCourt · ToolRegister · Directory · …
    overlays/         RecordDetail drawer · Activity drawer · Command palette (⌘K)
```

## Documentation

| Doc | What |
|---|---|
| [`design_handoff_sitelines/`](design_handoff_sitelines/README.md) | The design handoff: full spec, tokens, interactions, reference screenshots, HTML prototype |
| [`design_handoff_sitelines/DATA_CONTRACT.md`](design_handoff_sitelines/DATA_CONTRACT.md) | The normalized data shapes + ball-in-court rule (the UI ↔ Procore seam) |
| [`PLAN.md`](PLAN.md) | Build plan-of-record: ordered phases, status, sequencing rationale |
| [`Notes/plans/`](Notes/plans/Procore-Data-Seam-Plan.md) | Workstream plans (Procore data seam: FP-Analytics → Supabase → app) |
| [`CLAUDE.md`](CLAUDE.md) | Working agreements for AI-assisted development |
