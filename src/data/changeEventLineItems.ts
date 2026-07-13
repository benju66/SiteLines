// Seed fixture: change-event line items (Change Events, Phase 2). A deterministic
// slice shaped like the live sitelines_change_event_line_items view after
// mapChangeEventLineItem — the priced lines behind the seed change events. Each
// event's line amounts sum to its `estCost` (in CHANGE_EVENTS), so the drawer's
// per-cost-code subtotals reconcile. `commitmentId` points at the seed commitments
// (COMMITMENTS) so the Change-Event → Commitment cross-link resolves offline; one
// line carries no cost code to exercise the 'Unassigned' grouping. The two
// zero-value / Void events (8107, 8108) have no lines. Raw dollars (negative =
// de-scope credit).

import type { ChangeEventLineItem } from '@/types'

export const CHANGE_EVENT_LINE_ITEMS: ChangeEventLineItem[] = [
  // CE #14 — Unforeseen ledge (42,500; all on SC-25-117-220); li:3 has no cost code.
  { project: 'opiii', id: 'changeEvents:8101:li:1', changeEventId: 'changeEvents:8101', costCode: '2-22000.000', costCodeName: 'Rock Excavation', amount: 30_000, description: 'Rock excavation below east footing', commitmentNumber: 'SC-25-117-220', commitmentId: 'commitments:9001' },
  { project: 'opiii', id: 'changeEvents:8101:li:2', changeEventId: 'changeEvents:8101', costCode: '2-22100.000', costCodeName: 'Blasting', amount: 8_000, description: 'Controlled blasting', commitmentNumber: 'SC-25-117-220', commitmentId: 'commitments:9001' },
  { project: 'opiii', id: 'changeEvents:8101:li:3', changeEventId: 'changeEvents:8101', costCode: '', costCodeName: '', amount: 4_500, description: 'Export & haul-off (cost code TBD)', commitmentNumber: 'SC-25-117-220', commitmentId: 'commitments:9001' },

  // CE #15 — Added GFCI circuits (8,750; on SC-25-117-260 Electrical).
  { project: 'opiii', id: 'changeEvents:8102:li:1', changeEventId: 'changeEvents:8102', costCode: '26-26000.000', costCodeName: 'Branch Wiring', amount: 6_250, description: 'GFCI-protected circuits, amenity kitchens', commitmentNumber: 'SC-25-117-260', commitmentId: 'commitments:9003' },
  { project: 'opiii', id: 'changeEvents:8102:li:2', changeEventId: 'changeEvents:8102', costCode: '26-26100.000', costCodeName: 'Devices & Trim', amount: 2_500, description: 'Devices, plates, and trim', commitmentNumber: 'SC-25-117-260', commitmentId: 'commitments:9003' },

  // CE #11 — Storefront glazing upgrade (63,200; 2 commitments: 9001 + 9003).
  { project: 'opiii', id: 'changeEvents:8103:li:1', changeEventId: 'changeEvents:8103', costCode: '8-84000.000', costCodeName: 'Storefront Glazing', amount: 40_000, description: 'Lobby storefront, Low-E insulated units', commitmentNumber: 'SC-25-117-220', commitmentId: 'commitments:9001' },
  { project: 'opiii', id: 'changeEvents:8103:li:2', changeEventId: 'changeEvents:8103', costCode: '8-84000.000', costCodeName: 'Storefront Glazing', amount: 12_000, description: 'Low-E upgrade differential', commitmentNumber: 'SC-25-117-220', commitmentId: 'commitments:9001' },
  { project: 'opiii', id: 'changeEvents:8103:li:3', changeEventId: 'changeEvents:8103', costCode: '26-26200.000', costCodeName: 'Lighting', amount: 7_200, description: 'Lobby lighting revision at new glazing', commitmentNumber: 'SC-25-117-260', commitmentId: 'commitments:9003' },
  { project: 'opiii', id: 'changeEvents:8103:li:4', changeEventId: 'changeEvents:8103', costCode: '8-84100.000', costCodeName: 'Sealants', amount: 4_000, description: 'Perimeter sealants', commitmentNumber: 'SC-25-117-220', commitmentId: 'commitments:9001' },

  // CE #07 — Buyout savings, structural steel (−18,400; credit on SC-25-117-220).
  { project: 'opiii', id: 'changeEvents:8104:li:1', changeEventId: 'changeEvents:8104', costCode: '5-51000.000', costCodeName: 'Structural Steel', amount: -18_400, description: 'Steel package awarded under estimate', commitmentNumber: 'SC-25-117-220', commitmentId: 'commitments:9001' },

  // CE #09 — Allowance reconciliation, door hardware (−6,900; credit on SC-25-117-092).
  { project: 'opiii', id: 'changeEvents:8105:li:1', changeEventId: 'changeEvents:8105', costCode: '8-87100.000', costCodeName: 'Door Hardware', amount: -5_000, description: 'Hardware selections under allowance', commitmentNumber: 'SC-25-117-092', commitmentId: 'commitments:9002' },
  { project: 'opiii', id: 'changeEvents:8105:li:2', changeEventId: 'changeEvents:8105', costCode: '8-87100.000', costCodeName: 'Door Hardware', amount: -1_900, description: 'Finish reconciliation', commitmentNumber: 'SC-25-117-092', commitmentId: 'commitments:9002' },

  // CE #12 — Corridor layout revision (21,050; 2 commitments: 9002 + 9003).
  { project: 'opiii', id: 'changeEvents:8106:li:1', changeEventId: 'changeEvents:8106', costCode: '9-92116.000', costCodeName: 'Gypsum Board Assemblies', amount: 12_000, description: 'Revised Level 3 corridor partitions', commitmentNumber: 'SC-25-117-092', commitmentId: 'commitments:9002' },
  { project: 'opiii', id: 'changeEvents:8106:li:2', changeEventId: 'changeEvents:8106', costCode: '9-92900.000', costCodeName: 'Painting', amount: 3_050, description: 'Paint revised corridor walls', commitmentNumber: 'SC-25-117-092', commitmentId: 'commitments:9002' },
  { project: 'opiii', id: 'changeEvents:8106:li:3', changeEventId: 'changeEvents:8106', costCode: '26-26100.000', costCodeName: 'Devices & Trim', amount: 6_000, description: 'Relocate devices at revised layout', commitmentNumber: 'SC-25-117-260', commitmentId: 'commitments:9003' },
]
