// Data provider (Procore-Data-Seam-Plan, Phase 1). Loads a DataSource snapshot
// on mount, exposes { status, data, syncedAt, refresh }. A separate context
// from AppState on purpose — UI state and data lifecycle change for different
// reasons.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DataSource, SiteData } from '@/lib/dataSource'
import type { Item, ItemDetail } from '@/types'

export type DataStatus = 'loading' | 'ready' | 'error'

interface DataContextValue {
  status: DataStatus
  data: SiteData | null
  syncedAt: Date | null
  error: string | null
  /** Re-fetch from the source (the header's manual refresh). */
  refresh: () => void
  /** Lazily fetch a record's detail thread (the drawer calls this on open). */
  getDetail: (item: Item) => Promise<ItemDetail | null>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ source, children }: { source: DataSource; children: ReactNode }) {
  const [status, setStatus] = useState<DataStatus>('loading')
  const [data, setData] = useState<SiteData | null>(null)
  const [syncedAt, setSyncedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Guards against a stale fetch resolving after a newer one (e.g. rapid refresh clicks).
  const fetchSeq = useRef(0)

  const refresh = useCallback(() => {
    const seq = ++fetchSeq.current
    setStatus('loading')
    setError(null)
    source
      .fetch()
      .then((snap) => {
        if (seq !== fetchSeq.current) return
        setData(snap.data)
        setSyncedAt(snap.syncedAt)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (seq !== fetchSeq.current) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
  }, [source])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Reads through the source, keeping components off the raw client (data seam).
  const getDetail = useCallback((item: Item) => source.getDetail(item), [source])

  const value = useMemo(
    () => ({ status, data, syncedAt, error, refresh, getDetail }),
    [status, data, syncedAt, error, refresh, getDetail],
  )
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within <DataProvider>')
  return ctx
}

/**
 * Non-null data accessor for components rendered under the ready gate (App only
 * mounts the main UI once status === 'ready').
 */
export function useSiteData(): SiteData {
  const { data } = useData()
  if (!data) throw new Error('useSiteData called before data is ready')
  return data
}
