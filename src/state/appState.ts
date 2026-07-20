// App state (README "State Management"). A single flat object; every view is
// derived from it via selectors — no view owns state. Ports cleanly to the
// prototype's `state` object.

import type { ChangeEvent, Commitment, Drawing, DrawerTarget, Invoice, Item, ToolKey } from '@/types'

export type ProjectScope = 'all' | 'mckenna' | 'opiii'
export type TypeFilter = 'all' | 'rfi' | 'submittal' | 'co' | 'punch'
export type CourtToggle = 'all' | 'court'
export type SavedView = 'all' | 'overdue' | 'week' | 'mine' | 'others'

export interface AppState {
  tool: ToolKey // active tool key
  project: ProjectScope // global scope
  type: TypeFilter // My Court type filter
  court: CourtToggle // per-tool Ball-in-Court toggle
  savedView: SavedView // quick filter
  detail: { tool: ToolKey; record: Item } | null // open record drawer
  commitment: Commitment | null // open commitment detail drawer (the clicked register row)
  changeEvent: ChangeEvent | null // open change-event detail drawer (the clicked register row)
  invoice: Invoice | null // open invoice (pay-app) G702 detail drawer (the clicked register row)
  // Detail-drawer chrome (shared by all four drawers, so it survives a cross-drawer
  // swap): a drag-resizable width + a full-width toggle (both sticky across opens),
  // and the cross-link back-stack that powers the drawer's Back button.
  drawerWidth: number // px width of the detail drawer (drag-resizable; default 452)
  drawerFull: boolean // detail drawer expanded to near-full width (toggle)
  drawerHistory: DrawerTarget[] // back-stack: targets to restore when Back is pressed
  viewer: Drawing | null // open drawing-sheet viewer overlay (the clicked current sheet)
  submittalViewer: { id: string; name: string; downloadUrl?: string; procoreUrl?: string } | null // open Final-reviewed-submittal PDF viewer (id = "submittals:<id>")
  specViewer: { revisionId: string; title: string; procoreUrl: string | null } | null // open spec-section PDF viewer (revisionId = current_revision_id)
  activity: boolean // activity drawer
  settingsOpen: boolean // settings menu overlay
  palette: boolean // command palette
  query: string // palette search text
  dirFocus: string | null // contact id to highlight in Directory
  collapsedDisciplines: Set<string> // discipline names collapsed in the Drawings log (default: all expanded)
  collapsedDivisions: Set<string> // CSI division codes collapsed in the Specs log (default: all expanded)
  expandedBudgetDivisions: Set<string> // division names expanded in the Budget drill-down (default: all collapsed → rollup first)
  budgetKpisCollapsed: boolean // Budget "Key figures" cards collapsed to a one-line summary
  budgetAnalysisCollapsed: boolean // Budget "Risk & cost-type mix" panels collapsed to a one-line summary
  budgetForecastCollapsed: boolean // Budget "Pending changes" forecast collapsed to a one-line summary
  sidebarCollapsed: boolean // sidebar pinned to a 64px icon rail (hover peeks it open)
}

export const initialState: AppState = {
  tool: 'home',
  project: 'all',
  type: 'all',
  court: 'all',
  savedView: 'all',
  detail: null,
  commitment: null,
  changeEvent: null,
  invoice: null,
  drawerWidth: 452,
  drawerFull: false,
  drawerHistory: [],
  viewer: null,
  submittalViewer: null,
  specViewer: null,
  activity: false,
  settingsOpen: false,
  palette: false,
  query: '',
  dirFocus: null,
  collapsedDisciplines: new Set(),
  collapsedDivisions: new Set(),
  expandedBudgetDivisions: new Set(),
  budgetKpisCollapsed: false,
  budgetAnalysisCollapsed: false,
  budgetForecastCollapsed: false,
  sidebarCollapsed: false,
}
