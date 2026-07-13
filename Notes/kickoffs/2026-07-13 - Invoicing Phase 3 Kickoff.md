# Kickoff — Invoicing, Phase 3: billing-period navigation + per-sub invoice history

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · high** — pattern-following UI work on a shipped, well-specified
> surface; no new data seam, no SQL. (`/model claude-opus-4-8` first.)
>
> Implement **Phase 3 of Invoicing** (a billing-period selector on the register + a billing-history
> section in the invoice drawer). Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-13 - Invoicing Phase 3 Kickoff.md` (this file)
> - `Notes/plans/Invoicing-Plan.md` (§ v2, Phase 3) + `PLAN.md` (Invoicing) + `design_handoff_sitelines/README.md` + `design_handoff_sitelines/DATA_CONTRACT.md`
>
> Build **only Phase 3**. **No re-sync, no SQL** — everything comes from the existing `invoices`
> slice. Keep the seed→Supabase swap zero-view-change; put all filtering/grouping in pure tested
> selectors. Verify with typecheck + tests + build + a `:5173` click-through. Don't commit or push until I say "Approved."

---

> Context for the session (the detail the launch prompt points at).

## What you're building
**Plain-English:** the Invoicing tool today lists every pay app flat and opens one invoice's G702
cover sheet. A GC PM works by **billing period** and expects to see a sub's **current + past
invoices**. Phase 3 adds (1) a **period dropdown** that filters the register, and (2) a **billing
history** section in the invoice drawer showing that subcontractor's other pay apps (click to
switch). **No new data** — all 200 pay apps + their periods are already in the `invoices` slice.

## Required reading (in order, fresh — don't trust line numbers)
1. `Notes/plans/Invoicing-Plan.md` — § "v2 — deeper billing detail", Phase 3 (+ the data facts).
2. `src/components/views/InvoicingView.tsx` — the register + `TableSearch` + sort headers you extend.
3. `src/components/overlays/InvoiceDrawer.tsx` — the drawer you add the history section to.
4. `src/components/overlays/CommitmentDrawer.tsx` — its "Billing history" section is the exact
   pattern to mirror (per-pay-app cards).
5. `src/selectors/index.ts` — `invoiceRollup` / `invoicesSorted` / `InvoiceSort` (add the period
   helpers alongside); `src/selectors/invoicing.test.ts` — add tests here.
6. `src/types.ts` (`Invoice`), `src/lib/derive.ts` (`formatShortDate`).

## Scope — Phase 3 only (three bullets)
- **Period selector:** a pure `invoicePeriods(invoices)` selector → the distinct `period` strings,
  newest-first (period strings are `MM/DD/YY - MM/DD/YY`; sort by the parsed start date, not the
  string). A dropdown on `InvoicingView` (default: the latest period; plus an **"All periods"**
  option) that filters the register to the chosen period. The rollup KPIs recompute for the shown
  set (like the search already does). Keep the existing search + sort working alongside it.
- **Billing history in the drawer:** a pure `invoiceHistoryFor(invoices, invoice)` → the pay apps
  for the SAME `commitmentId`, recency-sorted (newest first). A "Billing history" section in
  `InvoiceDrawer` listing them (period · this-period · billed-to-date · status; mark the current /
  `isLatest` one), each a button that switches the drawer to that pay app (`patch({ invoice: x })`).
  Mirror `CommitmentDrawer`'s billing-history cards.
- **Tests:** `invoicePeriods` (distinct, newest-first, chronological not lexical) and
  `invoiceHistoryFor` (same commitment only, recency order, the clicked invoice included).

## Hard guardrails (this phase)
- **No re-sync, no SQL, no new data seam** — read the existing `invoices` slice only. If you find
  yourself adding a view or a Procore call, STOP: that's Phase 4/5.
- Overlays stay `position:fixed` siblings of the card (the drawer already is). `ballInCourt.ts`
  untouched. One token source; no ad-hoc hex. Domain atom stays `Item`.
- All filtering/grouping/period logic lives in pure, tested selectors — the view stays dumb; keep
  the seed→Supabase swap zero-view-change.

## Exit criteria (the gate)
```
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run typecheck
npm --prefix "C:/Users/BUrness/Dev/Sitelines" test
npm --prefix "C:/Users/BUrness/Dev/Sitelines" run build
```
Plus a live `:5173` click-through: pick a period → the register filters and KPIs recompute; open an
invoice → its billing history lists the sub's other pay apps and clicking one switches the drawer;
seed renders the same. Then **STOP at the phase boundary — don't start Phase 4, don't commit/push
until I say "Approved."**

## What comes next (do NOT build now)
- **Phase 4** ⛔ — the Procore sync change to pull per-requisition SOV line items (G703). Backend +
  rate-limit gate; its own owner sign-off.
- **Phase 5** — render the G703 SOV in the drawer (needs Phase 4's data).
