# Commitments — enrich the tool into a subcontract cost surface (self-contained build plan)

> Audience: a fresh Claude Code session with no memory of the chat that produced this.
> Read this top-to-bottom, then re-read the actual current files before editing.
> Parent: `PLAN.md` (repo root) + the design handoff (`design_handoff_sitelines/`).
> Sibling done: the **Budget Insights** workstream (`Notes/plans/Budget-Insights-Plan.md`)
> — reuse its data-seam pattern (per-tool Supabase view → mapper → `SiteData` slice →
> own view) and its hand-rolled, dependency-free philosophy. The commitment financials
> reconcile to Budget (total billed = Budget's "Invoiced to Date").

## Goal
Turn **Commitments** from a bare register (number + title + status; **no vendor, no
value** today) into a real **subcontract cost surface**: its own view (like Budget)
showing a rollup (committed · billed · retainage · % complete) and an enriched register
(contract company, type, revised value, billed, retainage, % complete, status), **plus a
detail drawer** for the descriptive side of each commitment (description, contract
summary, SOV inclusions/exclusions, dates, privacy, additional info) and its change-order
log + billing history. Then wire the **Budget ↔ Commitment cross-link** so a Budget cost
code drills to the subcontract(s) behind it.

## Where the data actually lives (verified 2026-07-08, OP III / 3051002)
The commitments master is **header-only** — the money is elsewhere:
- **`procore_commitments_master`** (~53; 2 are `_`-prefixed templates → exclude): `number`,
  `title`, `vendor` (an `{id}` — **name needs a `procore_vendors_master` join**),
  `status` (Draft/Approved), `executed`, `description`, `delivery_date`, `private`.
  **No contract value / SOV / billed / retainage.**
- **`procore_requisitions_master`** (199 subcontractor pay apps; link `commitment_id`):
  the **latest requisition per commitment** carries a full **AIA G702 `summary`** object —
  `original_contract_sum`, `net_change_by_change_orders`, `contract_sum_to_date` (= revised),
  `total_completed_and_stored_to_date` (= billed), `total_retainage`, `balance_to_finish…`
  — plus `percent_complete`. **This is the commitment's financials.** Coverage: **49 of 51**
  real commitments have a requisition (2 new ones have no value yet → show "—").
- **`procore_commitment_change_orders_master`** (~100; link `contract_id` = commitment id):
  `grand_total`, `status`, `executed`, `title`, `number` — the **CO log**.
- **`procore_vendors_master`** (~75): `name` — the contract company.

Verified rollup: original $16,147,644 → revised $16,608,012 → billed **$15,283,425**
(= Budget's Invoiced-to-Date, exact) → retainage $622,877.

**Not synced (the constraint):** commitment **SOV line items with cost codes**, and the
commitment **detail fields** (contract summary, SOV inclusions/exclusions, additional
information). Both need a **sync change in the sibling `FP-Analytics` repo** (Phase 3).

## Out of scope / deferred
- **Budget ↔ Commitment cost-code cross-link** — needs SOV line items (cost code →
  commitment) synced. Owner chose to **pursue the sync change** → Phase 3 (⛔ FP-Analytics)
  then Phase 4 (app). Not in v1 (Phases 1–2).
- **Richer drawer fields** (contract summary, SOV inclusions/exclusions, additional info) —
  not in the synced master; ride along on the Phase 3 sync change.
- **Writing back to Procore** — never. All read-only.
- **Prime contract / owner billings** (payment applications, prime COs) — a different tool
  (Prime Contract / Invoicing), not this workstream.

## Locked product decisions (owner, 2026-07-08)
1. **Own view (like Budget) for the financial side + contract company**, **and a detail
   drawer** for the descriptive side (description, contract summary, SOV inclusions/
   exclusions, contract dates, privacy, additional info).
2. **Pursue the FP-Analytics sync change** to unlock the Budget↔Commitment cross-link
   (and the richer drawer fields).
3. Reuse Budget's seam + hand-rolled philosophy (no chart lib; one token source).
4. **OP III only** for v1 (only 3051002 is synced), consistent with Budget.

## Data model (DATA_CONTRACT — keep the UI dumb)
Add to `src/types.ts` (reference data, like `Drawing`/`BudgetLine`; **never** enters My
Court / `ballInCourt`). Raw **dollars**; the selector layer formats and derives (%/rollup):
```ts
export interface Commitment {
  project: Project          // 'opiii' for v1
  id: string                // "commitments:<procore id>"
  number: string            // "PO-25-117-061" / "SC-…"
  title: string
  vendor: string            // contract company (vendors_master.name; '' when unknown)
  type: 'PO' | 'SC' | 'Other' // from the number prefix (or a type field)
  status: string            // "Draft" | "Approved" | …
  executed: boolean
  original: number          // original_contract_sum (0 when no requisition yet)
  revised: number           // contract_sum_to_date (original + executed COs)
  billed: number            // total_completed_and_stored_to_date
  retainage: number         // total_retainage
  pctComplete: number       // 0..1 (billed / revised, or the requisition's percent_complete)
  coCount: number           // # commitment change orders
  coTotal: number           // Σ commitment CO grand_total (executed)
  // descriptive (for the drawer; available now): description, deliveryDate, private
  description: string
  deliveryDate: string | null
  private: boolean
}
```
- **Seam:** add `commitments: Commitment[]` to `SiteData`, loaded in `fetch()` (51 rows).
  Mapper `mapCommitment` mirrors `mapBudgetLine`. The CO log + billing history are
  per-commitment lists → a **lazy `getCommitmentDetail(id)`** seam (Phase 2), like
  `getDrawingRevisions`, so the snapshot stays light.

## Pure logic to extract + unit-test (`src/selectors/` + `.test.ts`)
Deterministic; pass data in, no clock:
- `commitmentRollup(commitments)` → totals (original, revised, billed, retainage,
  overall % complete) for the KPI cards.
- `commitmentsSorted(commitments, sort)` → the register order (by value / % complete /
  vendor / status); default by revised desc. Reuse the Budget sort pattern.
- buyout/complete helpers as needed (billed/revised, retainage %).

## Build-on inventory (read these fresh before using)
REUSE, do not fork:
- `Notes/plans/Budget-Insights-Plan.md` + `src/components/views/BudgetView.tsx` — the own-view
  pattern (collapsible KPIs, resizable/sortable register, hand-rolled). Mirror for Commitments.
- `src/lib/mapBudgetLine.ts` — the view-row → contract-shape mapper pattern (guarded `num()`).
- `sync/views/sitelines_budget_lines.sql` — the `security_invoker` view + primary-view CTE style.
- `src/data/supabaseSource.ts` `fetchAll` + slice; `src/data/seedSource.ts` fixture;
  `src/state/DataContext.tsx`; `src/lib/dataSource.ts` (`SiteData` + the lazy `getDetail`/
  `getDrawingRevisions` seam pattern for `getCommitmentDetail`).
- `src/components/overlays/RecordDetailDrawer.tsx` — the drawer shell (backdrop, 452px,
  meta grid, sections) to reuse/extend for the commitment detail drawer.
- `src/data/tools.ts` (`commitments` meta), `src/components/layout/MainContent.tsx`
  (view routing — add a `commitments` ViewType like `budget`).
- `src/theme/tokens.ts` + `src/index.css` — the only color source.

## Sub-phasing (ship + verify each)

### Phase 1 — Commitments own view (financial register + rollup + contract company)
- **Scope:** (a) ⛔ a `sitelines_commitments` view — one row per real commitment:
  header (number, title, vendor via vendors join, type, status, executed, description,
  delivery_date, private) + financials from the **latest requisition's G702 summary**
  (original, revised, billed, retainage, pct_complete) + CO summary (co_count, co_total).
  (b) `Commitment` type + `mapCommitment` + `commitments` slice (seed + supabase). (c)
  `commitmentRollup` + `commitmentsSorted` selectors + tests. (d) a `CommitmentsView`
  (own view; route Commitments to it): rollup KPI cards + an enriched, sortable register
  (Contract Company · Type · Revised · Billed · Retainage · % Complete · Status).
- **Approval gates:** ⛔ Supabase view SQL (present, STOP for sign-off, then apply) ·
  no re-sync · never touch the Procore app registration.
- **Exit criteria:** typecheck + build + tests green; live `:5173` — real vendors + values;
  rollup ties to Procore (billed $15,283,425 = Budget's Invoiced-to-Date); seed renders;
  other views unchanged.

### Phase 2 — Commitment detail drawer (available fields + CO log + billing history)
- **Scope:** a detail drawer opened from a `CommitmentsView` row: Description · Contract
  Dates · Privacy (from the slice) + the **CO log** (`commitment_change_orders`) + **billing
  history** (`requisitions` for the commitment), via a lazy `getCommitmentDetail(id)` seam.
  Reuse/extend `RecordDetailDrawer` (or a commitment-specific drawer mounted in `App.tsx`'s
  overlay slot). Contract Summary / SOV inclusions-exclusions / additional info are **stubbed
  "from Procore" until Phase 3** (not synced yet).
- **Approval gates:** none new (read-only, existing data). Overlay = `position:fixed` sibling
  of the card (guardrail).
- **Exit criteria:** typecheck + build + tests; live — drawer opens, CO log + billing tie to
  Procore; seed renders.

### Phase 3 — commitment SOV line items + detail fields (✅ DONE + SYNCED + VERIFIED 2026-07-08)
> **Step-0 correction:** the real Procore→Supabase sync is **in-repo at `sync/procore_pipeline.py`**
> (moved from the standalone FP-Analytics folder in Data Seam Phase 1.5; that sibling copy is a
> retired, flat-column ancestor). So Phase 3 was an **in-repo** change, not cross-repo. The live
> masters are `{<key>, project_id, raw jsonb, synced_at}` via upsert + scoped purge (not
> drop-and-recreate). The [kickoff](../kickoffs/2026-07-08%20-%20Commitments%20Phase%203%20Kickoff.md)
> is superseded by this implementation.

- **Why (proven):** the synced commitment `description` is a lossy, flattened scope blob —
  Procore strips the SOV line items, the priced breakdown, inclusions/exclusions, and the list
  numbering during sync. The structured data lives on the commitment **detail (show)** endpoint.
  The Casework PO's SOV lines map to budget cost codes **`12-123530.000`** and **`6-64100.000`**
  verbatim (verified against `procore_budget_detail_rows_master`), so the Budget↔Commitment link
  (Phase 4) is real. **Join is via `cost_code.full_code`** — each line item carries a `cost_code`
  object; there is **no** top-level `budget_line_item_id` on the line item (an earlier assumption
  the live probe corrected).
- **What was built (in `sync/`):**
  - `migrations/0009_commitment_line_items.sql` — new **`procore_commitment_line_items_master`**
    (`line_item_id, project_id, raw jsonb, synced_at`, PK + project index + deny-all RLS +
    `authenticated_read`), mirroring `procore_change_event_line_items_master`. **Applied to Supabase.**
  - `procore_pipeline.py` — `enrich_commitments_with_detail()` does a per-commitment
    `GET /rest/v1.0/commitments/{id}?project_id={pid}` (the `project_id` param is REQUIRED —
    without it Procore returns 400; the generic show works for both SC/work-order and PO
    /purchase-order commitments, so no type branch), flattens each `line_items[]` entry (the full
    item as `raw`, tagged with `line_item_id` + `commitment_id`), and merges the detail-only scope
    fields (`inclusions`, `exclusions`, `grand_total`, …) onto the commitment's `raw`. The
    commitment LIST still upserts unconditionally (Phase 1/2 depend on it); only the new
    line-items table is gated on full enrichment success (purge safety). Fail-safe: a failed
    detail fetch → skip the line-items upsert (no purge), commitments unaffected.
- **✅ Ran + verified (2026-07-08, live sync):** `procore_commitment_line_items_master` =
  **479 line items across all 51 real commitments**, every one carrying a `cost_code`. The
  Casework PO (PO-25-117-123) → **9 lines summing to $539,086.57 = its `grand_total`** across
  `12-123530.000` / `6-64100.000` (the PDF's 4-row SOV was a grouped summary of the same total).
  `inclusions` on 41 / `exclusions` on 17 / `grand_total` on all 53 commitments.
- **⚠️ Operational finding — rate limit:** the added ~1 GET per commitment pushed the run over
  Procore's rate budget and it slept **~39 min** to recover; in the aftermath RFIs / submittals /
  punch / meetings were rate-limited out and **skipped this run (fail-safe — no purge, existing
  rows preserved)**. They self-heal on the next normal nightly run. If the nightly job runs near
  the rate ceiling, consider spacing the commitment detail GETs or gating enrichment to
  changed commitments.

### Phase 4 — Budget↔Commitment cross-link + richer drawer (✅ DONE + APPLIED + VERIFIED 2026-07-09)
> **Shipped:** `sitelines_commitment_line_items` view (479 rows) + `sitelines_commitments` extended
> with `inclusions`/`exclusions`/`grand_total` — both applied to Supabase (`security_invoker`,
> additive/read-only, no re-sync). Data seam: `CommitmentLineItem` type + `mapCommitmentLineItem` +
> `commitmentLineItems` slice (supabase + seed) + `inclusions`/`exclusions`/`grandTotal` on
> `Commitment`. Selectors `commitmentsByCostCode` / `commitmentSovByCostCode` / `costCodeKey` (+ tests).
> Budget drill-down: a cost code with commitment(s) behind it shows a teal "N sub(s)" badge (once per
> code even when split Material+Subcontract) that reveals the subcontract(s) → opens the existing
> `CommitmentDrawer`. Drawer: Phase-2 stub replaced with real inclusions/exclusions (via `parseScope`;
> HTML entities decoded) + a Schedule-of-Values section (SOV line items grouped by cost code, subtotals
> reconciling to `grand_total`). Verified: app + 121 tests + build green; live `:5173` — Casework
> `12-123530.000` → PO-25-117-123 (Alpine Cabinetry) $500,000; SOV + inclusions/exclusions render.
> **Money note:** commitments billed = $15,285,899 (each commitment's LATEST requisition, incl. one
> Under-Review pay app — PO-25-117-085 #3, $2,474.04); Budget's Invoiced-to-Date counts approved-only
> ($15,283,425). Owner confirmed "billed to date" = cumulative through the latest invoice (incl. the
> current one), so this is correct-as-is; the two reconverge when the pending pay app is approved.

- **Scope:** ⛔ a `sitelines_commitment_line_items` view (cost code → commitment). Budget
  cost codes drill to the subcontract(s) behind them; Commitments ↔ Budget cross-links;
  fill in the drawer's real inclusions/exclusions + contract-summary from the Phase-3
  commitment `raw`, and replace the Phase-2 scope-text parser's cost-code guesses with the
  synced SOV line items. Join `procore_commitment_line_items_master.raw->'cost_code'->>'full_code'`
  to the budget's `cost_code` (proven on the Casework PO: `12-123530.000` / `6-64100.000`).
- **Approval gates:** ⛔ Supabase view SQL. No re-sync (Phase 3 did it).
- **Exit criteria:** typecheck + build + tests; live — a Budget cost code opens its
  commitment(s); seed renders. Then STOP.

> Phase-2 note (2026-07-08): the drawer already renders the flattened `description` as a
> best-effort scope outline (numbered GENERAL REQUIREMENTS clauses + SOV cost-code dividers
> parsed from the text + bolded sub-labels — see `src/lib/parseScope.ts`). That's a stopgap
> over the lossy blob; Phase 3's structured SOV supersedes the parsed cost codes.

### Phase 5 — manual scope-structure cleanup (✅ DONE — 5a + 5b + 5c shipped + verified 2026-07-09)
**The Phase-5 condition is confirmed:** Phase 3 established that Procore syncs the scope as
flat, HTML-stripped text with list numbering/bullets stripped — the structure the parser
needs isn't in the text, so the un-numbered prose walls (e.g. the SCOPE CLARIFICATIONS block)
can't be auto-structured. The only fix is a manual layer. Owner elected to build it (2026-07-09).

- **Problem:** `parseScope` recovers ALL-CAPS headings + numbered clauses + SOV cost-code
  dividers, but the un-numbered prose can't be auto-structured (no marker to key on). The owner
  wants to hand-fix those residual walls so the drawer reads like the executed contract.
- **Why it's viable (owner domain input):** an executed subcontract's scope **language never
  changes** — a change order carries its own scope, it does not rewrite the original. So the
  scope text is effectively **immutable**, which makes a one-time manual cleanup **persist across
  re-syncs** (the sync rewrites the row byte-identical). A source-text hash guards the rare
  exception (a still-draft commitment, a re-execution).

**Locked product decisions (owner, 2026-07-09):**
1. **Coverage:** all three scope fields — `description` + `inclusions` + `exclusions`.
2. **Editing power:** the fuller set — **split** a wall into blocks · mark a block a **heading** ·
   **indent/outdent** (nesting) · **merge** blocks.
3. **Placement:** **inline in the `CommitmentDrawer`** — an "Edit structure" toggle on the scope
   section (keeps contract context; matches the dense tool), not a separate overlay.

**Design (safe + faithful — the load-bearing invariant):**
- **Words are LOCKED.** The editor performs only *structural* ops (split at a word boundary ·
  heading/para · indent/outdent · merge). It never accepts typed text. Therefore the stored
  blocks are always a **partition of the source text** — the invariant
  `normalize(blocks.map(b => b.text).join(' ')) === normalize(sourceText)` holds and is
  **asserted on save**, so the rendered scope can never diverge from the executed contract.
- **Parser-first, override-as-fallback-superseding:** the editor opens from the current render
  (a stored override if present, else `parseScope` output); the user nudges the residue.
- **App's first user-authored data layer** — a **write path**, distinct from the read-only
  Procore mirror. A `UserData` seam (its own provider + source) sits alongside `SiteData`; the
  live impl writes a new Supabase table, the seed impl writes `localStorage` so seed mode still
  exercises the editor. Overrides are keyed `(commitment_id, field)` and carry a `source_hash`;
  on load, a hash mismatch → **fall back to the parser output + flag "source changed — re-check
  your structure"** rather than silently show stale formatting.

**Block shape (the override model):** a flat, ordered list — `{ kind: 'para' | 'heading',
indent: number, text: string }[]` — rendered by the existing `ScopeOutline`. Flat+indent (not a
tree) keeps the editor and the invariant simple. A pure `applyScopeOverride(source, override,
hash)` selector returns `ScopeBlock[]` (override when hash matches, else parser) + a `stale`
flag; a pure, tested `hashText()` in `src/lib/`.

**Gate:** ⛔ **new Supabase base table** `sitelines_scope_overrides` (writable — SELECT **and**
INSERT/UPDATE/DELETE RLS for `authenticated`), the app's first write target. Present the DDL and
STOP for sign-off before applying (ref `jxesfirpghwpfmfjlfng`).

**Sub-phasing (one focused session each):**

#### Phase 5a — the write seam (⛔ table + `UserData` provider) — ✅ DONE + APPLIED + VERIFIED 2026-07-09
> **Shipped:** the app's first **write** path. New writable base table `sitelines_scope_overrides`
> ([migration 0010](../../sync/migrations/0010_scope_overrides.sql)) with SELECT + write RLS for
> `authenticated`; hardened by [0011](../../sync/migrations/0011_scope_overrides_owner_writes.sql)
> so writes are scoped to `updated_by = auth.uid()` (clears the "RLS Policy Always True" advisor;
> single-user-identical). A **separate** `UserDataSource` seam ([userDataSource.ts](../../src/lib/userDataSource.ts))
> — Supabase impl ([supabaseUserData.ts](../../src/data/supabaseUserData.ts), upsert on the composite PK)
> + `localStorage` impl ([localUserData.ts](../../src/data/localUserData.ts)) — behind a
> `UserDataProvider` ([UserDataContext.tsx](../../src/state/UserDataContext.tsx)) mounted alongside
> `DataProvider` in [main.tsx](../../src/main.tsx). `ScopeOverride`/`ScopeBlockOverride` types; pure
> tested [hashText.ts](../../src/lib/hashText.ts) + [mapScopeOverride.ts](../../src/lib/mapScopeOverride.ts).
> **Verified:** typecheck + **135 tests** + build green; live (`:5175`, logged-in) write → refresh →
> re-read → delete round-trips through the real table (authenticated RLS admits it; `updated_by`
> auto-stamped); seed (`:5174`) does the same via `localStorage`; `get_advisors` shows no
> table-level warnings. ⚠️ The write-proof scaffold ([ScopeOverrideProof.tsx](../../src/components/dev/ScopeOverrideProof.tsx),
> behind `?scopeproof`, mounted in [App.tsx](../../src/App.tsx)) is **temporary — remove in 5c**.
- **Scope:** ⛔ `sitelines_scope_overrides` table + RLS (present DDL, STOP, apply). A
  `UserDataSource` interface (`getScopeOverrides()` · `saveScopeOverride()` ·
  `deleteScopeOverride()`) with a Supabase impl (live) + a `localStorage` impl (seed), a
  `UserDataProvider` context alongside `DataProvider`, and the **read** path loading overrides
  into context. Prove the round-trip end-to-end with a **minimal write** (e.g. a temporary
  "reset structure" no-op button that writes+reads a row) — no editor UI yet. Pure `hashText()`
  + `.test.ts`.
- **Exit criteria:** typecheck + tests + build; live `:5175` — a written override persists across
  a refresh (RLS admits the authenticated write); seed mode writes to `localStorage`. ✅ met.

#### Phase 5b — render overrides in the drawer + staleness guard — ✅ DONE + VERIFIED 2026-07-09
> **Shipped:** the override **read/render** path. Pure [applyScopeOverride.ts](../../src/lib/applyScopeOverride.ts)
> (`(source, override) → { blocks, source: 'override'|'parser', stale }`): a fresh override's blocks
> win, an empty/absent override → parser, a hash mismatch → parser **+ `stale`**. `ScopeBlock` gained
> an optional `indent`; `ScopeOutline` honors it on para/heading (16px/level, clamped). The drawer's
> three scope sections (description · inclusions · exclusions) now route through a `ScopeFieldSection`
> that reads the override from `useUserData()` (keyed by `overrideKey(id, field)`) and shows a
> `tone.warn` "source changed" banner when stale. Co-located tests (+5, 140 total). The temporary
> `?scopeproof` panel now writes a realistic 3-block structure (heading + para + indented para,
> concatenation-preserving) to exercise the render. **Verified:** typecheck + tests + build; seed
> (`:5174`) — override renders (3 blocks, indent = 16px), tampered hash → banner + parser fallback,
> and the open drawer re-renders live on a context write; live (`:5175`, logged-in) — a Supabase
> override renders in the SC-25-117-220 drawer. No editor yet (5c).
- **Scope:** the pure `applyScopeOverride` selector (+ tests) and its wiring into the drawer's
  three scope sections (description · inclusions · exclusions) via `ScopeOutline`; the
  source-hash staleness banner + parser fallback. Overrides seeded via fixture/manual row (the
  editor lands in 5c), so this phase is the **read/render** path only.
- **Exit criteria:** typecheck + tests + build; live — a seeded override renders; a hash mismatch
  shows the "source changed" banner and falls back to the parser. ✅ met.

#### Phase 5c — the inline structure editor (the fuller ops) — ✅ DONE + VERIFIED 2026-07-09
> **Shipped:** the inline "Edit structure" editor. Pure ops in [scopeEdit.ts](../../src/lib/scopeEdit.ts)
> — `splitBlock` (at a word boundary) · `setKind` (heading/para) · `reindent` (indent/outdent,
> clamped) · `mergeUp` (into the previous block) · `segmentSource` (the initial seed) ·
> `seedEditorBlocks` (fresh override, else segment) · `partitionsSource` (the save-time assertion).
> Every op only regroups words, so the block list stays a partition of the source; **words are
> locked** (no typed text). The editor lives inline in `CommitmentDrawer` per scope field: click a
> word to break the line before it, per-block heading/indent/outdent/merge controls, and a toolbar
> — **Save** (asserts `partitionsSource` then writes via the 5a seam), **Cancel**, **Reset to auto**
> (deletes the override → back to the parser). Busy/error states on the write path. Co-located tests
> (+18, 158 total). **The temporary `?scopeproof` scaffold + its App.tsx mount were removed.**
> **Verified:** typecheck + tests + build; seed (`:5174`) — split→heading→indent→Save→refresh
> persists as a structured outline reading the contract's words verbatim, Reset-to-auto reverts to
> the parser; live (`:5175`, logged-in) — restructured SC-25-117-220's scope, saved (the partition
> assertion passed), refreshed → persists in the real table, Reset-to-auto deleted the row.
> **Seed heuristic (improved 2026-07-09):** `segmentSource` now breaks *before* structure — a run of
> ≥2 ALL-CAPS words → a `heading`; a numbered section/decimal clause starts its own block LED by its
> number (indented by depth); free prose in between is sentence-split; numbered clauses stay whole.
> The number now leads its clause instead of trailing the previous line. Verified live: SC-25-117-220's
> scope opens at 34 clean blocks (was 56) — "GENERAL REQUIREMENTS" a heading, `1.`/`1.1.`… leading &
> indented. Still a heuristic (a mid-clause caps phrase or a sentence-ending number can mis-split), but
> always a partition, so the invariant is untouched and the user can merge/split freely.
- **Scope:** the "Edit structure" mode inside the drawer scope section — split (at word
  boundaries) · heading/para · indent/outdent · merge — operating on the block list and saving
  through the 5a seam, with the concatenation invariant asserted on save. Empty/loading/error
  states for the write path; a "reset to parser" affordance.
- **Exit criteria:** typecheck + tests + build; live — restructure a real commitment's wall,
  save, refresh → the structure persists and still reads the contract's words. ✅ met.

### Phase 6 — scope list formatting + your-own-notes (🚧 6a DONE 2026-07-10 · 6b PLANNED)
**Plain-English:** make a formatted scope read like a real list — bullet points and (opt-in)
numbered items — and let the owner pin their **own** notes into a commitment's scope, shown clearly
marked as additions, while the executed contract's words stay locked and exact. Extends the Phase-5
editor; no Procore/read-path change.

**Why now:** Phase 5 shipped structure (headings/indent/split/merge) but the owner expected true
list formatting (bullets, numbers) and the ability to add clarifications. The mockup shown 2026-07-09
is the target.

**Locked product decisions (owner, 2026-07-09):**
1. **Bullets** — any block can be a bulleted item; sub-bullets via indent. **Presentation only** —
   the `•` is drawn at render, never stored in `text`, so the words-locked partition invariant holds.
2. **Numbers — opt-in per block**, NOT automatic. These scopes already carry their own `1.`/`1.1.`
   in the contract text; auto-numbering everything would double them. A block the owner marks
   "numbered" shows a computed ordinal; consecutive numbered blocks at the same indent count 1·2·3.
   Also presentation only.
3. **Your-own-notes** — the owner may **type their own** new list items (clarifications, reminders)
   that render clearly marked as additions (a tinted "Your note" row). The **contract words stay
   verbatim and locked** — the owner explicitly chose "add my own items, contract locked" over a
   fully-editable rewrite. Typing is allowed **only** on note blocks.

**Data model (extend `ScopeBlockOverride`; no SQL change — `blocks` is already `jsonb`, and the only
CHECK is on `field`):**
```ts
interface ScopeBlockOverride {
  kind: 'para' | 'heading'
  indent: number
  text: string
  list?: 'bullet' | 'number'   // NEW — render style; absent = plain. Decoration, not stored words.
  source?: 'user'              // NEW — present = a user-authored note (free text); absent = contract words
}
```
- **Safety invariant changes shape, not spirit:** `partitionsSource` (the save-time assertion) now
  filters to **contract blocks** (`source !== 'user'`) before checking `normalize(join) === normalize(source)`.
  User-note blocks are free text, excluded from the check, stored, and rendered as marked additions.
  The drawer can therefore still never show altered *contract* language.
- `ScopeBlock` (parser render type) gains optional `list?`/`source?` (like `indent?` did) so
  `ScopeOutline` renders them; `coerceBlocks` (in `mapScopeOverride`) must validate the new optional
  fields and drop a `source:'user'` block only if its `text` is missing.
- Ordinal numbering is a **pure, tested** render-time computation (counter per indent level; a
  non-number block breaks the run) — put it alongside `applyScopeOverride`/`scopeEdit`, not in the view.

**Sub-phasing (one focused session each):**

#### Phase 6a — list styling (bullets + opt-in numbers), presentation-only — ✅ DONE + VERIFIED 2026-07-10
> **Shipped:** presentation-only list styling on override blocks. `ScopeBlockOverride` + `ScopeBlock`
> gained `list?: 'bullet' | 'number'` (and `ScopeBlock` an `ordinal?` for the computed number). A pure,
> tested [annotateOrdinals](../../src/lib/applyScopeOverride.ts) assigns each `list:'number'` block its
> display ordinal — a counter per indent level: consecutive numbers count 1·2·3, a numbered block
> restarts any deeper runs (nested lists restart under each parent), and any non-number block (prose,
> heading, bullet) breaks + resets the run at its level; it runs inside `overrideToBlocks`, so parser
> output is untouched. `ScopeOutline` draws a leading `•` for `list:'bullet'` and the ordinal (mono) for
> `list:'number'` on **para** blocks only (headings unaffected), respecting `indent`, using the one token
> source (`--tx-faint` / `--tx-tertiary`). [scopeEdit](../../src/lib/scopeEdit.ts) added a `setList` op
> (clearing drops the key); the editor's `EditorBlockRow` got a single plain→bullet→number **cycle**
> button (owner-picked over two toggles), disabled on headings. `coerceBlocks` validates `list` (drops an
> invalid value to undefined) — the single read boundary for both Supabase jsonb + localStorage.
> **Presentation-only guardrail held:** the marker is drawn at render, never stored in `text`, so
> `partitionsSource` and the save flow are byte-for-byte unchanged (a co-located test proves applying a
> list style leaves the partition invariant true). **Verified:** typecheck + **169 tests** (+11) + build
> green; seed (`:5174`) — bullet + a 1·2·3 numbered run save → refresh → persist, words verbatim;
> live (`:5175`, existing authenticated session) — wrote to the real `sitelines_scope_overrides` table
> (`updated_by` = the user's `auth.uid()`, so the RLS-scoped write path, not a service-role bypass), the
> stored blocks reconstruct to the complete verbatim contract prose (no marker glyphs in `text`), styles
> persist across refresh, ordinals compute 1·2·3, and Reset-to-auto deleted the row (table left clean;
> `get_advisors` shows no table/RLS findings). **No SQL change** (`blocks` is already `jsonb`).
- **Scope:** add `list?: 'bullet' | 'number'` to the block model + `ScopeBlock`; render bullets and
  computed ordinals in `ScopeOutline`; a pure tested ordinal helper; editor controls to toggle a
  block's list style (per `EditorBlockRow`). **No safety-model change** — `partitionsSource` is
  untouched (list is pure decoration). Co-located tests.
- **Approval gates:** none (no SQL; `blocks` jsonb already accepts the new optional field). Confirm
  `coerceBlocks` accepts+validates `list`.
- **Exit criteria:** typecheck + tests + build; seed (`:5174`) + live (`:5175`) — mark blocks as
  bullet/number, save, refresh → styles persist and render; contract words unchanged. STOP. ✅ met.

#### Phase 6b — your-own-notes (the typing path + the one safety-model change)
- **Scope:** add `source?: 'user'` note blocks — an "Add note" action creating an editable note block,
  a **text input** in the editor (the ONLY place typing is allowed; contract blocks stay read-only),
  note delete/indent/list-style; `partitionsSource` filters out `source:'user'` before asserting;
  `ScopeOutline` renders notes with the tinted "Your note" treatment. Co-located tests (partition
  ignores notes; a note round-trips; contract-only blocks still assert).
- **Approval gates:** ⚠️ This is the one change to the words-locked safety model — the hard guardrail
  below. No SQL gate.
- **Exit criteria:** typecheck + tests + build; live (`:5175`) — add a note to a real commitment,
  save, refresh → the note persists marked as yours and the contract words remain verbatim; a save
  still fails if a contract block's words were somehow altered. STOP.

**Phase-6 guardrails (in addition to the standing list below):**
- **Contract words stay locked.** Typing is permitted ONLY on `source:'user'` blocks. Contract blocks
  (`source` absent) remain restructure-only. `partitionsSource` must still pass for the contract
  blocks on every save.
- **Notes are always visibly the owner's** — distinct styling + a "Your note" marker; never rendered
  as if they were the subcontractor's committed scope.
- Presentation styles (`list`, the note tint) use the one token source (`tokens.ts`/`index.css`),
  reusing `tone.warn`-style tokens (e.g. `--bg-accent`/`--text-accent`) — no ad-hoc hex.

**Open decisions (confirm at kickoff):**
- **Note placement** — freestanding note block anywhere in the list (recommended: simplest, most
  flexible) vs. only as an indented child of a contract block.
- **Number toggle UX** — a single cycle button (none → bullet → number → none) vs. two separate
  toggles. Recommend the cycle button (fewer controls in a dense row).

## Hard guardrails (do not violate)
- Overlays (the detail drawer) render `position:fixed` OUTSIDE the card's `overflow:hidden`
  (mount in `App.tsx`'s overlay slot).
- **One token source** (`src/theme/tokens.ts` + `src/index.css`); no ad-hoc hex; **no chart
  library** — hand-rolled only.
- Domain atom stays `Item`; `Commitment` is additive **reference** data — the ball-in-court
  rule (`src/lib/ballInCourt.ts`) is **untouched**; commitments must NOT enter My Court.
- Views derived from flat `AppState` + `patch()`; grouping/formatting live in `src/selectors/`
  (pure, tested); the UI reads via the provider; `supabaseSource` keeps `fetchAll` paging.
  Keep the seed → Supabase swap zero-view-change.
- **Compliance:** read-only Supabase views over the existing `procore_*_master` tables (per
  view, `security_invoker=true`). ⛔ Present all Supabase DDL/view SQL and STOP before
  applying (ref `jxesfirpghwpfmfjlfng`); don't commit/push until the owner says "Approved."

## Open decisions
- **Drawer host** — extend the shared `RecordDetailDrawer` (adds a commitment branch) vs. a
  dedicated `CommitmentDrawer` overlay. Recommend a dedicated overlay (commitment detail is
  financial/SOV, not the request/response shape `RecordDetailDrawer` is built around);
  confirm at Phase 2 kickoff.
- **`type` derivation** — PO/SC from the `number` prefix vs. a Procore field; confirm in Phase 1.
