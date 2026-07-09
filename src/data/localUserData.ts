// Seed/local UserDataSource (Commitments, Phase 5a). Backs the UserData seam with
// localStorage so seed mode (no login, no Supabase) still exercises the write path
// end-to-end: an override written here survives a page refresh exactly as the live
// Supabase row does. Mirrors createSupabaseUserData's interface so the seed → live
// swap in main.tsx needs zero component changes.
//
// Storage shape: a single JSON object under one key, mapping overrideKey() →
// ScopeOverride. One key (not one-per-override) keeps reads/writes trivial and the
// whole set is tiny. Reads are defensive: a malformed/absent blob → no overrides,
// coerced clean by mapScopeOverride at the boundary (same as the live rows).

import { coerceBlocks } from '@/lib/mapScopeOverride'
import { overrideKey, type UserDataSource } from '@/lib/userDataSource'
import type { ScopeField, ScopeOverride } from '@/types'

const STORAGE_KEY = 'sitelines:scopeOverrides:v1'

type OverrideMap = Record<string, ScopeOverride>

function readMap(): OverrideMap {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return {} // localStorage unavailable (private mode / no DOM) → behave as empty
  }
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: OverrideMap = {}
    for (const [key, v] of Object.entries(parsed ?? {})) {
      if (!v || typeof v !== 'object') continue
      const o = v as Partial<ScopeOverride>
      if (typeof o.commitmentId !== 'string' || typeof o.field !== 'string') continue
      out[key] = {
        commitmentId: o.commitmentId,
        field: o.field as ScopeField,
        blocks: coerceBlocks(o.blocks),
        sourceHash: typeof o.sourceHash === 'string' ? o.sourceHash : '',
        updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : '',
      }
    }
    return out
  } catch {
    return {} // corrupt blob → start clean rather than crash
  }
}

function writeMap(map: OverrideMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Quota/availability failures are non-fatal for a dev-mode seam; the in-memory
    // provider state still reflects the write for this session.
  }
}

export function createLocalUserData(): UserDataSource {
  return {
    name: 'local-user',

    async getScopeOverrides(): Promise<ScopeOverride[]> {
      return Object.values(readMap())
    },

    async saveScopeOverride(override: ScopeOverride): Promise<void> {
      const map = readMap()
      map[overrideKey(override.commitmentId, override.field)] = override
      writeMap(map)
    },

    async deleteScopeOverride(commitmentId: string, field: ScopeField): Promise<void> {
      const map = readMap()
      delete map[overrideKey(commitmentId, field)]
      writeMap(map)
    },
  }
}
