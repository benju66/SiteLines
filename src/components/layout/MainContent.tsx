// Content router — picks the surface for the active tool's view type.

import { TOOLS } from '@/data/tools'
import { useApp } from '@/state/AppContext'
import { DailyLogView } from '@/components/views/DailyLogView'
import { DirectoryView } from '@/components/views/DirectoryView'
import { BudgetView } from '@/components/views/BudgetView'
import { DrawingsView } from '@/components/views/DrawingsView'
import { FinancialView } from '@/components/views/FinancialView'
import { MyCourtView } from '@/components/views/MyCourtView'
import { OverviewView } from '@/components/views/OverviewView'
import { PhotosView } from '@/components/views/PhotosView'
import { ToolRegisterView } from '@/components/views/ToolRegisterView'
import type { ViewType } from '@/types'
import type { ComponentType } from 'react'

const VIEWS: Record<ViewType, ComponentType> = {
  home: MyCourtView,
  list: ToolRegisterView,
  directory: DirectoryView,
  financial: FinancialView,
  budget: BudgetView,
  photos: PhotosView,
  dailyLog: DailyLogView,
  overview: OverviewView,
  drawings: DrawingsView,
}

export function MainContent() {
  const { state } = useApp()
  const View = VIEWS[TOOLS[state.tool].view]

  return (
    <div className="scry" style={{ flex: 1, overflowY: 'auto' }}>
      <View />
    </div>
  )
}
