import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { type AppState, initialState } from './appState'

type Patch = Partial<AppState> | ((prev: AppState) => Partial<AppState>)

interface AppContextValue {
  state: AppState
  /** Shallow-merge a patch into state (mirrors the prototype's setState). */
  patch: (p: Patch) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)

  const patch = useCallback((p: Patch) => {
    setState((prev) => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p) }))
  }, [])

  const value = useMemo(() => ({ state, patch }), [state, patch])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within <AppProvider>')
  return ctx
}
