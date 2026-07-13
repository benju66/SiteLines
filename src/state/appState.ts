// App state (README "State Management"). A single flat object; every view is
// derived from it via selectors — no view owns state. Ports cleanly to the
// prototype's `state` object.

import type { ChangeEvent, Commitment, Drawing, Item, ToolKey } from '@/types'

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
  viewer: Drawing | null // open drawing-sheet viewer overlay (the clicked current sheet)
  submittalViewer: { id: string; name: string; downloadUrl?: string; procoreUrl?: string } | null // open Final-reviewed-submittal PDF viewer (id = "submittals:<id>")
  activity: boolean // activity drawer
  palette: boolean // command palette
  query: string // palette search text
  dirFocus: string | null // contact id to highlight in Directory
  collapsedDisciplines: Set<string> // discipline names collapsed in the Drawings log (default: all expanded)
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
  viewer: null,
  submittalViewer: null,
  activity: false,
  palette: false,
  query: '',
  dirFocus: null,
  collapsedDisciplines: new Set(),
  expandedBudgetDivisions: new Set(),
  budgetKpisCollapsed: false,
  budgetAnalysisCollapsed: false,
  budgetForecastCollapsed: false,
  sidebarCollapsed: false,
}
