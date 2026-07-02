# Sitelines — Data Contract (Procore integration)

This is the seam between the UI and Procore. In the prototype, every view reads from in-file seed objects. In production, a service that pulls the **Procore API** must produce the **same normalized shapes** described here. Get these right and the UI needs no logic changes.

> Principle the client agreed on: **an item only feeds "My Court" while it has a live ball-in-court.** Terminal/closed items and tools that have no court concept never appear in the inbox.

---

## 1. Record (the atom)

Every actionable record across tools normalizes to this shape:

```ts
type Project = 'mckenna' | 'opiii';           // extend as projects are added
type Urgency = 'over' | 'week' | 'track' | 'muted';
type Tone    = 'danger' | 'warn' | 'ok' | 'info' | 'muted';

interface Record {
  id: string;            // stable Procore id (used for links + navigation)
  tool: ToolKey;         // 'rfis' | 'submittals' | ... (see §3)
  project: Project;
  num: string;           // display number, e.g. "#042", "CO #007", "A-201", "08 71 00", "App 08"
  title: string;         // subject / description line
  who: string;           // party who currently holds the ball; "You" == Ben. e.g. "Structural EOR"
  mine: boolean;         // true when who === Ben (drives the YOU pill + "In My Court")
  date: string;          // human due/status string, e.g. "due Jun 24", "overdue", "$186,400", "Jul 2, 9:00a"
  urgency: Urgency;      // drives the status dot + colored age
  status: { label: string; tone: Tone } | null;  // register status pill, e.g. {label:'Under Review', tone:'info'}
  links?: string[];      // ids of related records in other tools (see §5)
}
```

**Mapping notes from Procore:**
- `who` / `mine` come from the ball-in-court / responsible-party + assignee fields per tool. If the responsible party is the current user (Ben), `mine = true`.
- `urgency` is derived from due date vs. today: past due → `over`; within 7 days → `week`; otherwise `track`. Use `muted` for informational/closed records that should read as inactive.
- `status.label` should match Procore's status vocabulary (see the terminal list in §2) so the ball-in-court rule works without special-casing.
- `date` is a preformatted display string — do formatting server-side so the UI stays dumb, or format in the selector layer.

---

## 2. The Ball-in-Court rule (what feeds "My Court")

```ts
const TERMINAL = new Set([
  'Closed','Approved','Current','Superseded','Void',
  'Final','Issued','Executed','Answered','Scheduled'
]);

const COURT_TOOLS = new Set([
  'rfis','submittals','changeEvents','changeOrders','punch',
  'commitments','invoicing','meetings','drawings','specs','documents'
]);

function isBallInCourt(rec: Record): boolean {
  return COURT_TOOLS.has(rec.tool) && !(rec.status && TERMINAL.has(rec.status.label));
}
```

- **My Court** = all records (in the current project scope) where `isBallInCourt(rec)` — includes items in Ben's court *and* items where he's tracking someone else's clock (`mine` false). Sorted by urgency.
- **Sidebar count badge** per tool = records where `isBallInCourt(rec) && rec.mine` (items needing *Ben's* action).
- Tools **not** in `COURT_TOOLS` (`photos`, `dailyLog`, `schedule`, `directory`, `primeContract`, `budget`, `overview`) never contribute to My Court and show no count badge.
- Extend `TERMINAL` / `COURT_TOOLS` as you add tools. This is the single place that governs the inbox — keep it centralized.

> ⚠️ Validate the `TERMINAL` list against real Procore statuses per tool during integration — status label spelling must match exactly, or a closed item will leak into My Court.

---

## 3. Tool registry

Each tool key maps to a label, a short mono **code** (badge), a **view type**, and column labels. View types: `list`, `financial`, `photos`, `dailyLog`, `directory`, `overview`, `home`.

| key | label | code | view | in COURT_TOOLS |
|---|---|---|---|---|
| overview | Overview | — | overview | no |
| home | My Court | — | home | (aggregate) |
| directory | Directory | DIR | directory | no |
| rfis | RFIs | RFI | list | ✅ |
| submittals | Submittals | SUB | list | ✅ |
| drawings | Drawings | DWG | list | ✅ |
| specs | Specifications | SPEC | list | ✅ |
| changeEvents | Change Events | CE | list | ✅ |
| punch | Punch List | PUN | list | ✅ |
| dailyLog | Daily Log | LOG | dailyLog | no |
| photos | Photos | IMG | photos | no |
| meetings | Meetings | MTG | list | ✅ |
| schedule | Schedule | TASK | list | no* |
| documents | Documents | DOC | list | ✅ |
| primeContract | Prime Contract | PC | financial | no |
| budget | Budget | BUD | financial | no |
| commitments | Commitments | COM | list | ✅ |
| changeOrders | Change Orders | CO | list | ✅ |
| invoicing | Invoicing | INV | list | ✅ |

\* Schedule renders as a list but is intentionally excluded from the ball-in-court aggregate (milestones have no assignee "court"). Revisit if the client wants schedule tasks in My Court.

**My Court type filter** maps chip → tool: `rfi→rfis`, `submittal→submittals`, `co→changeOrders`, `punch→punch`. Records from other court tools appear only under the "All" chip.

**Recommended next tools** (per the client, all generate ball-in-court items): keep the list architecture and add `inspections`, `observations`, `tasks`, `correspondence`, `transmittals` as `list` view + `COURT_TOOLS` members.

---

## 4. Directory (contacts)

```ts
interface Contact {
  id: string;            // e.g. 'eor', 'arch', 'owner'
  name: string;
  company: string;
  role: string;          // "Structural EOR", "Architect of Record", ...
  trade: string;
  email: string;
  phone: string;
  projects: Project[];
  match?: string;        // optional keyword to associate records by title (e.g. "Harmon")
}
```

**Open-items count** per contact (the orange pill) = count of records where `isBallInCourt(rec)` **and** (`whoToContactId(rec.who) === contact.id` **or** `rec.title` contains `contact.match`).

`whoToContactId` maps the free-text `who` to a contact id. In Procore, prefer resolving by the actual party/company id on the record rather than string matching — the prototype's `WHO2ID` map (`"Structural EOR"→eor`, `"Architect"→arch`, `"Owner"→owner`, `"Braun Intertec"→braun`, `"Sub"→finishes`, `"You"→self`) is a stand-in for that resolution.

---

## 5. Cross-tool links

The detail drawer shows **Linked records** and lets the user jump between related items. In the prototype this is a static map keyed `"tool:num"`; in production it comes from Procore's related-items associations.

- A record's `links` is a list of related record **ids**. Resolve each id to its record to render the row (code, title, number, project, urgency dot) and to open its detail on click.
- Relationships are typically bidirectional (RFI ↔ Drawing, Submittal ↔ Spec, Commitment ↔ Invoice) — populate both directions.
- The **"Waiting on" party** in the drawer links to the Directory contact resolved from `who` (see §4), highlighting that contact.

---

## 6. Financial data

Financial views (`budget`, `primeContract`) aggregate per-division numbers, summed across projects when scope is "All".

```ts
// division rows: [name, budget, committed, invoiced] in $millions
interface FinancialSource {
  divisions: Record<Project, [string, number, number, number][]>;
  approvedChanges: Record<Project, number>;   // approved COs, $M
  projectedOverUnder: Record<Project, number>; // +over / -under, $M
}
```

- **Budget KPIs:** Original (revised − approvedChanges), Approved Changes, Revised (Σ budget), Committed (Σ committed), Invoiced (Σ invoiced), Projected Over/Under. Table: Division / Budget / Committed / Uncommitted(=budget−committed) + total.
- **Prime Contract KPIs:** Contract Sum, Approved COs, Revised Contract, Invoiced to Date, Balance to Finish (=revised−invoiced), Retainage Held (≈5% of invoiced). Table: Division / Scheduled Value / Invoiced / % Billed + total.
- Map these to Procore Budget + Prime Contract + Commitments/Direct-Costs endpoints. `%` and derived KPIs are computed in the selector, not stored.

---

## 7. Activity feed

```ts
interface Activity {
  id: string;
  project: Project;
  text: string;        // "Structural EOR has not responded to RFI #042"
  sub: string;         // context line
  tone: Tone;          // dot color
  when: string;        // relative time, "2h ago"
}
```

Define, with the client, what events generate activity and how "unread" (the header count) is computed — likely Procore webhooks / change events. Filtered by project scope.

---

## 8. What to build around the data

- **Empty / loading / error / stale states** — not in the prototype. Add a loading skeleton, a "no connection to Procore" state, and a "last synced Nm ago" indicator. These are design decisions worth making early.
- **Persistence** — remember `project`, `tool`, and `savedView` between sessions (localStorage or user prefs).
- **Auth / permissions** — single-user tool for now; wire to Procore OAuth. No in-app settings/admin in v1.
- **Refresh cadence** — decide poll vs. webhook-driven updates for the ball-in-court set.
