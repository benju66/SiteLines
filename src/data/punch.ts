// Seed punch items (Punch List workstream, Phase 1). A fixture so seed mode
// (VITE_DATA_SOURCE=seed) renders the closeout dashboard offline. In live mode these
// come from the `sitelines_punch` view via mapPunchItem().
//
// Spread across all lifecycle stages (initiated → work_required → ready_for_review →
// closed) and several assignees so the rollup, the Stage/Assignee grouping, the
// overdue-first sort, and the photo/open-response indicators are all exercised. The
// first three ids match the seed COURT punch items (src/data/records.ts) so a row →
// record-drawer round-trip resolves a real Item; the rest are dashboard-only (PunchView
// falls back to a minimal Item for those).

import type { PunchItem } from '@/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "2026-07-04" → "Jul 4, 2026" (seed-only; live uses mapPunchItem's formatResponseDate). */
function displayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
}

/** Compact fixture builder. `dueIso` is the raw ISO (drives dueSort + a simple display
 *  date); flags default off; project defaults to opiii. */
function pi(
  id: string,
  number: string,
  name: string,
  assignee: string,
  status: string,
  workflowStatus: string,
  dueIso: string,
  flags: { photos?: boolean; resp?: boolean } = {},
  project: PunchItem['project'] = 'opiii',
): PunchItem {
  return {
    id,
    project,
    number,
    name,
    assignee,
    status,
    workflowStatus,
    dueDate: displayDate(dueIso),
    dueSort: dueIso,
    hasPhotos: !!flags.photos,
    hasOpenResponse: !!flags.resp,
    manager: 'Travis Paddock',
  }
}

export const PUNCH: PunchItem[] = [
  // aligned with the seed court items (open the real Item)
  pi('punch:#012', '#012', 'Corridor finish touch-up, Wing B', 'Summit Drywall', 'Open', 'work_required', '2026-07-04', { photos: true, resp: true }),
  pi('punch:#015', '#015', 'Touch-up paint, stair 2', 'Metro Painting', 'Open', 'ready_for_review', '2026-07-02', { photos: true }),
  pi('punch:#008', '#008', 'Sealant at storefront jambs', 'Twin City Glass', 'Overdue', 'work_required', '2026-06-20', { photos: true, resp: true }, 'mckenna'),
  // dashboard-only spread
  pi('punch:seed-201', '#201', 'Dented fridge door, Unit 4110', 'Northland Appliance', 'Overdue', 'work_required', '2026-05-05', { photos: true, resp: true }),
  pi('punch:seed-202', '#202', 'Re-caulk countertop backsplash', 'Twin City Tile', 'Overdue', 'work_required', '2025-11-21', { photos: true }),
  pi('punch:seed-203', '#203', 'Door doesn’t latch, Unit 1119', 'Summit Drywall', 'Open', 'ready_for_review', '2026-07-10', { photos: true }),
  pi('punch:seed-204', '#204', 'Missing outlet cover, corridor', 'Gephart Electric', 'Open', 'ready_for_review', '2026-07-12', {}),
  pi('punch:seed-205', '#205', 'Final cleaning, lobby', '', 'Open', 'initiated', '2026-07-20', {}),
  pi('punch:seed-206', '#206', 'Cracked tile at entry', 'Twin City Tile', 'Closed', 'closed', '2026-04-10', { photos: true }),
  pi('punch:seed-207', '#207', 'Paint scuff, stairwell B', 'Metro Painting', 'Closed', 'closed', '2026-04-13', { photos: true }),
  pi('punch:seed-208', '#208', 'Adjust door closer, Unit 2101', 'Summit Drywall', 'Closed', 'closed', '2026-04-15', {}),
  pi('punch:seed-209', '#209', 'Replace scratched glass, Unit 3110', 'Twin City Glass', 'Closed', 'closed', '2026-05-01', { photos: true }),
]
