# Kickoff — Procore Data Seam, Phase 1: App data provider + states

## ▶ Launch prompt (paste this to start a fresh session)
> Implement **Phase 1 of the Procore Data Seam** (app-side data provider + loading/stale/refresh states — Sitelines only, NO backend). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-01 - Procore Data Seam Phase 1 Kickoff.md` (this file)
> - `Notes/plans/Procore-Data-Seam-Plan.md` (Phase 1) + `README.md` + `DATA_CONTRACT.md`
>
> Build **only Phase 1**. It is a pure client refactor — the app must still run identically on the in-file **seed** data through the new provider; do NOT wire Supabase or Procore yet. Verify with `npm run typecheck` + `npm run build` + a `:5173` click-through. Don't commit or push until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What this phase is
Decouple the UI from its data source *now*, while only one view (My Court) exists —
so the remaining ~10 surfaces are all live-data-ready by construction. No Procore,
no Supabase, no network. Success = the app looks and behaves exactly as it does
today, but every view reads through a `DataProvider` instead of static `src/data/*`
imports, and the plumbing for loading / error / stale / refresh is in place.

## Required reading (fresh — don't trust line numbers)
- `Notes/plans/Procore-Data-Seam-Plan.md` — Phase 1 scope + the "Pure logic" and
  "Data model" sections.
- `README.md` (design tokens, states in DATA_CONTRACT §8) + `DATA_CONTRACT.md` (§1 urgency, §8 states).
- `src/selectors/index.ts` — these currently import `DATA` statically; that import is what you invert.
- `src/state/AppContext.tsx` — the context pattern to mirror (the data provider is a SEPARATE context, not merged into AppState).
- `src/data/records.ts` / `directory.ts` / `activity.ts` — become the seed `DataSource`.
- `src/components/layout/Header.tsx` (imports `ACTIVITY` directly) and `src/components/layout/Sidebar.tsx` (uses selectors).

## Scope (build)
1. **`DataSource` interface** + a `seedDataSource` wrapping today's `src/data/*`
   (`getItems / getContacts / getFinancials / getActivity`, plus a `lastSyncedAt`).
2. **`DataProvider` context** exposing `{ data, status: 'loading'|'ready'|'error', lastSyncedAt, refresh() }`.
   Seed source resolves instantly; still model it as async so the live source drops in unchanged.
3. **Repoint consumers** — selectors take the provided record set (keep their
   signatures otherwise); Header/Sidebar/etc. read activity/directory/financials from the provider.
4. **States UI** (DATA_CONTRACT §8): loading skeleton, empty, error, a "last synced N ago"
   indicator, and a manual refresh button in the header cluster.
5. **Pure logic + tests** (add vitest): `deriveUrgency(dueDateISO, today)`,
   `statusTone(rawLabel)`, `formatDueDate(...)`. Pass `today` IN — never `new Date()` inside.
   (Seed data can keep its precomputed fields for now; these fns exist so Phase 3's
   live rows can be completed to full `Item`s.)

## Guardrails / ⛔ gates
- **No backend this phase.** If you find yourself importing `supabase-js` or hitting
  a URL, stop — that's Phase 3.
- Ball-in-court rule stays in `src/lib/ballInCourt.ts`; don't move it.
- `Item` not `Record`; one token source; provider is a separate context from `AppState`.
- Don't commit or push until the owner says "Approved."

## Exit criteria (the gate)
- App runs identically on the seed source through the provider (My Court + nav + filters unchanged).
- Loading / empty / error / "last synced" / refresh all render and behave (fake a
  slow/failed load to prove the states).
- Pure logic unit-tested and green.
- `npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck` and `... run build` green.
- `:5173` click-through (start dev server, drive with Playwright; read DOM in a
  SEPARATE call after a click — React re-renders after the tick).
- Then STOP and report; do not start Phase 2.
