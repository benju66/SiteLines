// User-data provider (Commitments, Phase 5a). The write-side companion to
// DataProvider: it loads the user-authored scope overrides on mount and exposes
// read + write operations over the UserData seam. Separate from DataProvider on
// purpose — the read path is a pure Procore mirror; this is the user's layer, with
// its own lifecycle. Overrides are keyed by overrideKey(commitmentId, field) so a
// consumer (5b's drawer render) can look one up in O(1).
//
// The provider owns the one clock read in this seam: it stamps `updatedAt` at save
// (the pure lib/selector layer never reads the clock), builds the full ScopeOverride,
// hands it to the source to persist verbatim, then optimistically updates its map so
// the UI reflects the write without a round-trip.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { overrideKey, type UserDataSource } from '@/lib/userDataSource'
import type { ScopeField, ScopeOverride, ScopeOverrideInput } from '@/types'

export type UserDataStatus = 'loading' | 'ready' | 'error'

/** Overrides keyed by overrideKey(commitmentId, field). */
export type OverrideMap = Record<string, ScopeOverride>

interface UserDataContextValue {
  status: UserDataStatus
  error: string | null
  /** All loaded overrides, keyed by overrideKey(commitmentId, field). */
  overrides: OverrideMap
  /** Re-read every override from the source. */
  reload: () => void
  /** Upsert an override (provider stamps `updatedAt`). Resolves once persisted. */
  saveOverride: (input: ScopeOverrideInput) => Promise<void>
  /** Delete an override. Resolves once persisted. */
  deleteOverride: (commitmentId: string, field: ScopeField) => Promise<void>
}

const UserDataContext = createContext<UserDataContextValue | null>(null)

export function UserDataProvider({ source, children }: { source: UserDataSource; children: ReactNode }) {
  const [status, setStatus] = useState<UserDataStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<OverrideMap>({})
  // Guards against a stale load resolving after a newer one (rapid reloads).
  const loadSeq = useRef(0)

  const reload = useCallback(() => {
    const seq = ++loadSeq.current
    setStatus('loading')
    setError(null)
    source
      .getScopeOverrides()
      .then((list) => {
        if (seq !== loadSeq.current) return
        const map: OverrideMap = {}
        for (const o of list) map[overrideKey(o.commitmentId, o.field)] = o
        setOverrides(map)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (seq !== loadSeq.current) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
  }, [source])

  useEffect(() => {
    reload()
  }, [reload])

  const saveOverride = useCallback(
    async (input: ScopeOverrideInput) => {
      const override: ScopeOverride = { ...input, updatedAt: new Date().toISOString() }
      await source.saveScopeOverride(override)
      setOverrides((prev) => ({ ...prev, [overrideKey(override.commitmentId, override.field)]: override }))
    },
    [source],
  )

  const deleteOverride = useCallback(
    async (commitmentId: string, field: ScopeField) => {
      await source.deleteScopeOverride(commitmentId, field)
      setOverrides((prev) => {
        const next = { ...prev }
        delete next[overrideKey(commitmentId, field)]
        return next
      })
    },
    [source],
  )

  const value = useMemo(
    () => ({ status, error, overrides, reload, saveOverride, deleteOverride }),
    [status, error, overrides, reload, saveOverride, deleteOverride],
  )
  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>
}

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext)
  if (!ctx) throw new Error('useUserData must be used within <UserDataProvider>')
  return ctx
}
