// App state (README "State Management"). A single flat object; every view is
// derived from it via selectors — no view owns state. Ports cleanly to the
// prototype's `state` object.

import type { Item, ToolKey } from '@/types'

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
  activity: boolean // activity drawer
  palette: boolean // command palette
  query: string // palette search text
  dirFocus: string | null // contact id to highlight in Directory
  collapsedDisciplines: Set<string> // discipline names collapsed in the Drawings log (default: all expanded)
}

export const initialState: AppState = {
  tool: 'home',
  project: 'all',
  type: 'all',
  court: 'all',
  savedView: 'all',
  detail: null,
  activity: false,
  palette: false,
  query: '',
  dirFocus: null,
  collapsedDisciplines: new Set(),
}
