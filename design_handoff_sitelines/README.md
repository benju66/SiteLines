# Handoff: Sitelines — Construction PM "Single Pane of Glass"

## Overview
Sitelines is a personal command console for a commercial construction Project Manager (Ben) who juggles multiple active Procore projects (currently **McKenna Crossing** — senior-living expansion, Prior Lake MN; and **OP_III** — Orchard Path Phase III). It collapses scattered Procore views into one screen he can scan in under 30 seconds each morning.

The organizing idea is **Ball-in-Court**: a single home inbox ("My Court") that surfaces every *live* item across all tools where the ball is in Ben's court **or** he's tracking someone else's clock. From there he can drill into any individual Procore tool (RFIs, Submittals, Budget, etc.), scoped to a project, toggling between "In My Court" and the full register.

This is a **desktop tool** used at a desk or on a jobsite laptop. Mobile is explicitly out of scope for v1.

> There is **no real backend** in the prototype — all data is seeded in-file. The intended production path is to feed it from a service that pulls the **Procore API**. See `DATA_CONTRACT.md` for the exact normalized shape that replaces the seed data; it is the most important part of this handoff.

## About the Design Files
The file in this bundle (`Sitelines.dc.html`) is a **design reference created in HTML** — a working prototype showing the intended look, layout, and interaction behavior. It is **not production code to copy directly**.

The task is to **recreate this design in the target codebase's environment** using its established patterns and libraries. If no environment exists yet, **React** is the natural choice (the prototype is structured as a single stateful component with derived view-models — see "State Management"). The prototype is authored in a lightweight in-house component format; treat it as a spec, not a source of importable code.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, density, and interactions are all intentional. Recreate the UI to match — exact hex values, mono/sans split, and the compact row density are given below in "Design Tokens." Match it closely; this is a dense, utilitarian ops tool in the spirit of Linear, deliberately avoiding card-shadow/whitespace bloat.

---

## Global Layout

```
┌──────────────┬───────────────────────────────────────────────┐
│  SIDEBAR     │  HEADER (title · count · scope · Search · Act.) │
│  248px fixed │───────────────────────────────────────────────│
│              │  CONTROLS ROW (contextual: type / view chips,  │
│  · brand     │   Ball-in-Court⇄All toggle)                    │
│  · project   │───────────────────────────────────────────────│
│    scope     │                                                │
│  · Overview  │  CONTENT (scrolls)                             │
│  · My Court  │   one of: list table · financial · photos ·   │
│  · tool nav  │   daily log · directory · overview             │
│    groups    │                                                │
│  · overdue   │                                                │
│    footer    │                                                │
└──────────────┴───────────────────────────────────────────────┘
Overlays (position:fixed, above everything): Command Palette (⌘K),
Activity drawer (right), Record-Detail drawer (right).
```

- Outer app: full-viewport, centered card, `max-width:1440px`, `height:100vh`, 16px padding around the card.
- Card: `background:#fbfbfc`, `border:1px solid #d4d8dd`, `border-radius:12px`, shadow `0 1px 2px rgba(20,25,35,.05), 0 12px 40px rgba(20,25,35,.08)`, `overflow:hidden`, `display:flex`.
- **Overlays must render OUTSIDE any `overflow:hidden`/transformed ancestor** (they are siblings of the card, `position:fixed`). This bit us in the prototype — a fixed overlay clipped by the card's `overflow:hidden` is invisible.

### Sidebar (248px, `background:#f5f6f8`, right border `#e2e5e9`, scrolls independently)
1. **Brand:** 28px dark rounded square (`#1a1d21`) containing a 12px circle with a 2.5px `#e8590c` ring; "Sitelines" (14px/700, `-.3px`) + "Ben Ostrander · PM" (10.5px `#8a919b`).
2. **Project scope** — label "PROJECT", then three full-width buttons: **All Projects / McKenna Crossing / OP_III**. Active button is filled `#3c434c` white text; inactive is white with `#dde1e6` border. Each has a leading 8px rounded square swatch (McKenna `#2f5f8a`, OP_III `#2f7d76`; "All" uses a split McKenna/OP_III gradient chip).
3. **Overview** (pinned) and **My Court** (pinned, with an orange count badge = number of live court items in scope).
4. **Tool nav groups** — "Core" (Directory), "Project Management", "Financial Management". Each item: a 34px monospace **code badge** (e.g. `RFI`, `SUB`, `BUD`), the label, and (for court-bearing tools) a gray count badge = items in *your* court. Active item = white bg, `#e2e5e9` border, subtle shadow, code badge turns blue (`#2f5f8a` on `#eaf1f8`).
5. **Footer card:** overdue count with an orange dot.

### Header (`padding:16px 22px 14px`, white, bottom border `#e4e7eb`)
- Left: **title** (19px/700, `-.4px`), **count** (12.5px `#8a919b`, e.g. "25 open items"), and a **scope tag** (project-colored pill or gray "All Projects").
- Right cluster: a **Search button** styled like an input (`#f1f3f5`, ~186px, leading 11px ring "search" glyph, "Search…", trailing `⌘K` kbd) and an **Activity button** (white, "Activity" + orange count badge).
- **Controls row** (only on My Court / list / photos / daily log): Type chips (My Court only), a divider, saved-view chips ("Views"), a spacer, then the **In My Court / All** segmented toggle (right-aligned; list/photos/daily-log only).

---

## Screens / Views

### 1. My Court (home)
- **Purpose:** the morning scan — every *live* ball-in-court item across all court-bearing tools, both Ben's court and others' clocks.
- **Layout:** sticky column header + rows. Grid: `12px 46px minmax(120px,1fr) 104px 132px 98px`, `gap:12px`, row `padding:11px 22px`, bottom border `#eef0f2`, hover `#f6f7f9`, `cursor:pointer`.
- **Columns:** (1) urgency dot (9px, colored, 3px ring); (2) mono type badge; (3) title (13px/530, ellipsis) + item number (10.5px mono `#9298a1`); (4) project tag (clickable → sets scope); (5) waiting-on — either a black **YOU** pill or the party name (12.5px `#4b525c`); (6) right-aligned age/due (mono, urgency-colored).
- **Controls:** Type chips (All / RFIs / Submittals / Change Orders / Punch) + Views chips. Sorted by urgency (overdue → due-this-week → on-track).
- Empty state: centered muted message.

### 2. Tool register (list) — RFIs, Submittals, Drawings, Specs, Change Events, Punch, Meetings, Schedule, Documents, Commitments, Change Orders, Invoicing
- **Purpose:** full register for one tool, project-scoped, with **In My Court / All** toggle.
- **Layout:** same grid/columns as My Court, but the last column shows a **status pill** + a date/amount subline (mono). Column headers labeled per tool (e.g. "Waiting on"/"Revision"/"Owner"; "Age"/"Status"/"Issued"/"Value").
- Row click → Record-Detail drawer. Sorted by urgency.

### 3. Financials — Prime Contract, Budget
- **Purpose:** contract value / cost control by division.
- **Layout:** a row of six **KPI cards** (`repeat(3,1fr)` grid, white, `#e4e7eb` border, radius 9, label 10.5px uppercase + 22px mono value), then a **division table** (header + rows + bold total row). Budget columns: Division / Budget / Committed / Uncommitted. Prime Contract columns: Division / Scheduled Value / Invoiced / % Billed. Values re-aggregate with project scope (single project vs. summed).
- No toggle, no view chips.

### 4. Photos
- **Purpose:** jobsite documentation gallery; toggle filters to Ben's **flagged** photos.
- **Layout:** `repeat(4,1fr)` grid of cards. Each: a 118px striped placeholder (diagonal `#e9ecef`/`#eef1f4` stripes, "JOBSITE PHOTO" mono caption) with a project tag bottom-left and an orange "FLAGGED" chip top-right when applicable; caption (12px) + date (10px mono) below.

### 5. Daily Log
- **Purpose:** field-report feed; toggle filters to entries needing Ben's sign-off.
- **Layout:** stacked cards. Header: date (mono) + project tag + a "NEEDS SIGN-OFF" (amber) or "SIGNED" (green) pill. A row of Weather / Temp / Manpower stats. A notes paragraph (12.5px/1.5 `#3c434c`).

### 6. Directory (Core)
- **Purpose:** project contacts (owner, design team, subs, agencies). Reference data; **has no ball-in-court**, so it never feeds My Court and has no toggle.
- **Layout:** sticky header + rows. Grid: `minmax(140px,1.3fr) 128px 92px 62px minmax(0,1fr) 54px`, `gap:12px`, row `padding:11px 22px`.
- **Columns:** Name (13px/600) + company (11px `#9298a1`); Role; Trade; Projects (colored 9px square dots); Contact (email + phone, mono 11px); **Open** — an orange count pill = live court items involving that contact (cross-link person → their work).
- **Focus highlight:** when reached from a record's "Waiting on" link, the matching row gets `background:#fdf6ee` + `inset 3px 0 0 #e8590c`.

### 7. Overview (dashboard placeholder)
- **Purpose:** portfolio health. **Explicitly a placeholder** — a blue info banner states metrics populate live from Procore; sample data locks the layout.
- **Layout:** 4 KPI tiles (Open Items / Overdue / In Your Court / Due This Week); per-project cards (name, % complete bar, mini stats: Open RFIs / Submittals / Overdue); a "Trends · from Procore" section with three **chart placeholders** (striped, dashed-border panels labeled RESPONSE-TIME CHART / YOURS vs. OTHERS TREND / STACKED BAR BY PROJECT). Real charts are intentionally not built.

### Overlays

**Record-Detail drawer** (right, 452px, `background:#fbfbfc`, shadow `-8px 0 40px rgba(20,25,35,.2)`; backdrop `rgba(20,25,35,.3)`, z-index 55):
- Header: mono code badge + number + close (×).
- Title (17px/680), status pill + project tag.
- 2×2 meta grid (hairline-separated white cells): Waiting on (YOU pill, **linked party →**, or plain name) · Due/status (mono, urgency-colored) · Project · Tool.
- Description paragraph.
- **Linked records** (cross-tool): clickable rows (dot + code + title/number + project tag + ›) → open that record's detail.
- **Ball-in-court history**: a vertical timeline (dot + connector) of 3 events.
- **Attachments**: placeholder file chips.
- Sticky footer: **Respond** (black), Forward, Resolve.

**Command Palette** (⌘K / Ctrl+K; center-top modal, 580px, radius 13, shadow `0 24px 64px rgba(20,25,35,.35)`; backdrop z-index 60):
- Search input (autofocus) + `esc` kbd. Results = matching records across all list tools (code badge + title + "Project · Tool"); empty query lists all tools to jump to. Clicking a record opens its detail; clicking a tool navigates. Footer hint row.

**Activity drawer** (right, 400px; z-index 55): reverse-chron feed of events (colored dot by tone + text + project tag + subline + relative time).

---

## Interactions & Behavior
- **Nav click** → `tool`. **Scope button** → `project` (filters every view). **Project tag on a My Court row** → sets scope.
- **Row click** → opens Record-Detail drawer (`detail = {tool, r}`). The project-tag button inside a row calls `stopPropagation` so it doesn't also open the drawer.
- **Toggle** In My Court / All → `court`. **Type chips** → `type` (My Court). **View chips** → `savedView` (My Court + lists): Everything / Overdue / Due this week / In my court / Waiting on others.
- **Linked record** click → replaces drawer contents with the linked item's detail. **Waiting-on party** link → navigates to Directory and highlights that contact (`dirFocus`), closing the drawer.
- **Keyboard:** ⌘K/Ctrl+K toggles the palette (clears query); **Esc** closes palette + detail + activity. (Recommended additions, not yet built: j/k row navigation, Enter to open.)
- **No entrance animations** on overlays — they were removed because opacity-based keyframes didn't settle in the prototype runtime; overlays render solid. Reintroduce transitions in the real app if desired, but verify final opacity.
- **Sort:** urgency rank overdue(0) → week(1) → track(2) → muted(3).

## State Management
Single component; all state is a flat object, and every view is *derived* from it (no view owns state). Ports cleanly to React `useState` + a `renderVals()`-style selector.

| Variable | Type | Notes |
|---|---|---|
| `tool` | string | active tool key (`home`, `overview`, `directory`, `rfis`, …) |
| `project` | `'all' \| 'mckenna' \| 'opiii'` | global scope |
| `type` | `'all' \| 'rfi' \| 'submittal' \| 'co' \| 'punch'` | My Court type filter |
| `court` | `'all' \| 'court'` | per-tool Ball-in-Court toggle |
| `savedView` | `'all' \| 'overdue' \| 'week' \| 'mine' \| 'others'` | quick filter |
| `detail` | `{tool, r} \| null` | open record drawer |
| `activity` | bool | activity drawer |
| `palette` | bool | command palette |
| `query` | string | palette search text |
| `dirFocus` | string \| null | contact id to highlight in Directory |

Data fetching: none in the prototype. In production, the seed objects (`DATA`, `PROJ`, `DIRECTORY`, financial `DIV`/`CHG`/`OU`, `ACTIVITY`, `LINKS`) are replaced by data fetched from the Procore-integration service. **See `DATA_CONTRACT.md`.**

## Design Tokens

**Colors — surfaces & text**
- App bg `#dfe2e6` · card `#fbfbfc` · sidebar `#f5f6f8` · panels/white `#ffffff` · subtle fill `#f4f5f7` / `#f6f7f9` / `#eef0f3`
- Borders `#d4d8dd` (card) · `#e2e5e9` · `#e4e7eb` · `#eef0f2` (row) · `#dde1e6`
- Text: primary `#1a1d21` · secondary `#4b525c` / `#5b626c` · tertiary `#7b828c` / `#8a919b` · faint `#9298a1` / `#a2a8b0`

**Colors — brand & semantic**
- Accent / safety-orange (overdue, "your court", flags) `#e8590c`
- Project — McKenna `#2f5f8a` (bg `#eaf1f8`) · OP_III `#2f7d76` (bg `#e7f2f1`)
- Urgency dot / text / ring — overdue `#e8590c` / `#b23c0e` / `#e8590c22`; due-this-week `#d99400` / `#8a6300` / `#d9940026`; on-track `#3fa06a` / `#2c7a4f` / `#3fa06a22`; muted `#c4c9cf` / `#9298a1`
- Status-pill tones (text / bg / border): danger `#b23c0e`/`#fbe9e0`/`#f2c9b6` · warn `#8a6300`/`#fbf1d8`/`#efd89a` · ok `#2c7a4f`/`#e7f4ec`/`#bfe3cd` · info `#2f5f8a`/`#eaf1f8`/`#c3d5e8` · muted `#6b727b`/`#eef0f3`/`#dde1e6`

**Typography**
- UI sans: `system-ui, -apple-system, "Segoe UI", sans-serif`
- Numerals / dates / codes / IDs: `ui-monospace, SFMono-Regular, Menlo, monospace`
- Scale: h1 19px/700 (`-.4px`); section titles 15–17px/680; body 12.5–13px/530–540; secondary 11–12px; uppercase labels 9.5–10.5px/600, letter-spacing .5–.6px; mono values 10–22px

**Spacing / radius / shadow**
- Header pad `16px 22px 14px`; row pad `11px 22px`; content pads `18–22px`; grid gap `12px`
- Radius: cards 9–12px · chips/buttons 6–8px · code badges 4–5px · pills 20px
- Shadows: card `0 1px 2px rgba(20,25,35,.05), 0 12px 40px rgba(20,25,35,.08)`; drawer `-8px 0 40px rgba(20,25,35,.2)`; palette `0 24px 64px rgba(20,25,35,.35)`
- List-row grid `12px 46px minmax(120px,1fr) 104px 132px 98px`; sidebar width `248px`

## Assets
No real image or icon assets. All "icons" are CSS primitives (circles, rounded squares, split-gradient chips) and monospace code badges — reproduce with the codebase's icon system or keep as-is. Photos are **striped CSS placeholders**; wire to Procore photo thumbnails in production. If the target app has a brand/design system, map these tokens onto it rather than hardcoding.

## Files
- `Sitelines.dc.html` — the full interactive prototype (all views + overlays + seed data). Open in a browser to explore.
- `DATA_CONTRACT.md` — the normalized data shape, the ball-in-court rule, and cross-link/party mapping that must be produced from the Procore API. **Read this before wiring data.**
- `screens/` — reference screenshots of the key surfaces:
  - `01-my-court.png` — home ball-in-court inbox (type + view chips, urgency-coded rows)
  - `02-overview.png` — dashboard placeholder (KPIs, project cards, chart placeholders)
  - `03-rfis-register.png` — a tool register with the In My Court / All toggle + status pills
  - `04-budget.png` — financial view (KPI cards + by-division table)
  - `05-directory.png` — contacts with per-contact open-item counts
  - `06-detail-drawer.png` — record detail with Linked Records + linked "Waiting on" party
