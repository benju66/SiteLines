# Kickoff — Commitments, Phase 4: Budget↔Commitment cross-link + real inclusions/exclusions

## ▶ Launch prompt (paste this to start a fresh session)
> **⚙️ Run with: Opus 4.8 · effort xhigh** — net-new Supabase view + a cross-surface UI link (Budget → the subcontracts behind a cost code) + money-accurate joins that must not regress Phases 1–3. Correctness matters. (`/model claude-opus-4-8` first.) Escalate to `claude-fable-5` only if genuinely stuck.
>
> Implement **Phase 4 of Commitments** in Sitelines (`C:\Users\BUrness\Dev\Sitelines`): wire the
> Budget↔Commitment cross-link and surface the real inclusions/exclusions now that Phase 3's
> data is live. Read these in full, then follow them:
> - `Notes/kickoffs/2026-07-08 - Commitments Phase 4 Kickoff.md` (this file)
> - `Notes/plans/Commitments-Plan.md` § Phase 4 + `CLAUDE.md` + `design_handoff_sitelines/README.md` (§3 Financials)
>
> ⛔ **Present every Supabase view SQL and STOP for my sign-off before applying** (ref
> `jxesfirpghwpfmfjlfng`). No re-sync (Phase 3 already synced the data). Verify with
> typecheck + tests + build + a logged-in `:5175` click-through. Don't commit/push until I say so.

---

## What's already live (Phase 3 shipped 2026-07-08)
- **`procore_commitment_line_items_master`** — 479 SOV line items across all 51 real commitments
  (project 3051002). Each row: `line_item_id, project_id, raw jsonb, synced_at`. The `raw` holds
  the full Procore line item: `raw->'cost_code'->>'full_code'` (e.g. `"12-123530.000"`),
  `raw->>'amount'`, `raw->>'total_amount'`, `raw->>'description'`, `raw->>'commitment_id'`.
- **`procore_commitments_master.raw`** now also carries `inclusions`, `exclusions` (HTML-stripped),
  and `grand_total` (on 41 / 17 / 53 commitments).
- **Proven join:** the line item's `cost_code.full_code` (`"12-123530.000"`) matches the budget's
  cost code, which in `procore_budget_detail_rows_master` / `sitelines_budget_lines` is stored as
  `"12-123530.000 - Residential Casework"` (code + `" - "` + title). So join on the **code prefix**
  (split the budget `cost_code` on `" - "`, or `budget.cost_code LIKE lineitem.full_code || ' %'`).
  Casework PO-25-117-123 → 9 lines = $539,086.57 across `12-123530.000` / `6-64100.000`.

## Scope
1. ⛔ **`sitelines_commitment_line_items` view** (`security_invoker=true`) over
   `procore_commitment_line_items_master` for project 3051002 → one row per line item:
   `project ('opiii')`, `id` (`commitments:<commitment_id>:li:<line_item_id>`), `commitment_id`
   (`commitments:<id>`), `cost_code` (full_code), `cost_code_name`, `amount`, `description`.
   Present SQL, STOP, then apply. Mirror `sitelines_commitments.sql` style.
2. ⛔ **Extend `sitelines_commitments`** (`sync/views/sitelines_commitments.sql`) to emit
   `inclusions`, `exclusions`, `grand_total` from `raw` (now present). Present the CREATE OR
   REPLACE, STOP, then apply.
3. **Data seam** (mirror the `commitments` slice): add `CommitmentLineItem` type +
   `mapCommitmentLineItem`; a `commitmentLineItems: CommitmentLineItem[]` slice on `SiteData`
   (supabase read + seed fixture); and add `inclusions`/`exclusions`/`grandTotal` to the
   `Commitment` type + `mapCommitment`. Keep the seam dumb (selectors take `SiteData`).
4. **Selector + tests** — `commitmentsByCostCode(lineItems, commitments)` → for a budget cost code,
   the subcontract(s) behind it (vendor, number, amount), deterministic + co-located `.test.ts`.
5. **Budget↔Commitment cross-link UI** — in `BudgetView` a cost-code row that has commitments
   behind it shows an affordance (count/›) to reveal the subcontract(s); clicking one opens the
   existing `CommitmentDrawer` (set `state.commitment`). Reuse the drawer — don't build a new one.
6. **Drawer real fields** — in `CommitmentDrawer`, replace the Phase-2 "Contract summary & SOV"
   stub with the real `inclusions` / `exclusions` (render via the existing `parseScope`/prose
   helper), and optionally list the commitment's SOV line items (from the new slice).

## Guardrails / gates
- ⛔ Present all view SQL and STOP before applying (ref `jxesfirpghwpfmfjlfng`). No re-sync.
- One token source; no chart/table lib; keep the UI dumb; `Commitment`/`CommitmentLineItem` stay
  **reference** data (never enter My Court / `ballInCourt`).
- Don't regress Phases 1–3: billed rollup still $15,283,425; drawer CO log + billing still work;
  seed mode still renders.
- Don't commit/push until the owner says so.

## Exit criteria
- typecheck + tests + build green; live logged-in `:5175`: a Budget cost code (e.g. Casework
  `12-123530.000`) drills to its subcontract(s), and the commitment drawer shows real
  inclusions/exclusions; other views unchanged. Seed mode renders. Then STOP and report.

## Context notes (not action items)
- The scope narrative in the drawer is still the Phase-2 best-effort `parseScope` outline over the
  flattened `description`; inclusions/exclusions are now REAL (own fields), separate from that.
- Operational: the Phase-3 per-commitment detail GETs strained Procore's rate limit on a full run
  (~39-min cooldown; RFIs/submittals/punch/meetings skipped fail-safe that run, self-heal next
  nightly). Not a Phase-4 concern, but context if a re-sync is ever discussed.
