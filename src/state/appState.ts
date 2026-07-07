// App state (README "State Management"). A single flat object; every view is
// derived from it via selectors — no view owns state. Ports cleanly to the
// prototype's `state` object.

import type { Drawing, Item, ToolKey } from '@/types'

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
  viewer: Drawing | null // open drawing-sheet viewer overlay (the clicked current sheet)
  activity: boolean // activity drawer
  palette: boolean // command palette
  query: string // palette search text
  dirFocus: string | null // contact id to highlight in Directory
  collapsedDisciplines: Set<string> // discipline names collapsed in the Drawings log (default: all expanded)
  expandedBudgetDivisions: Set<string> // division names expanded in the Budget drill-down (default: all collapsed → rollup first)
  budgetKpisCollapsed: boolean // Budget "Key figures" cards collapsed to a one-line summary
}

export const initialState: AppState = {
  tool: 'home',
  project: 'all',
  type: 'all',
  court: 'all',
  savedView: 'all',
  detail: null,
  viewer: null,
  activity: false,
  palette: false,
  query: '',
  dirFocus: null,
  collapsedDisciplines: new Set(),
  expandedBudgetDivisions: new Set(),
  budgetKpisCollapsed: false,
}
