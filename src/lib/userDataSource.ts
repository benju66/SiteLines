// The UserData seam (Commitments, Phase 5a). A PARALLEL seam to the read-only
// DataSource: where DataSource is a pure Procore mirror the browser only reads,
// UserDataSource is the user-authored layer the browser both reads AND writes.
// Kept deliberately separate — do not overload DataSource with writes — so the
// read path stays a clean mirror and this seam owns persistence of overrides.
//
// Two implementations, chosen in main.tsx exactly like the read seam:
//   • supabaseUserData (live)  — the sitelines_scope_overrides table, authenticated
//                                RLS admits the write.
//   • localUserData   (seed)   — localStorage, so seed mode still exercises writes
//                                offline with no live dependency.
// The seed → live swap needs zero component changes (the UserDataProvider is the
// only consumer).

import type { ScopeField, ScopeOverride } from '@/types'

/** Stable key for an override in the provider's map (and localStorage). One
 *  override per (commitment, scope field). */
export function overrideKey(commitmentId: string, field: ScopeField): string {
  return `${commitmentId}|${field}`
}

export interface UserDataSource {
  /** Short label for diagnostics, e.g. 'supabase-user' | 'local-user'. */
  name: string
  /** Read every override (small — at most one per scope field per commitment).
   *  Rejects on an actual read error; the provider surfaces the error state. */
  getScopeOverrides(): Promise<ScopeOverride[]>
  /** Upsert one override (keyed by commitmentId + field). `updatedAt` is already
   *  stamped by the provider; the source persists it verbatim. Rejects on error. */
  saveScopeOverride(override: ScopeOverride): Promise<void>
  /** Delete one override (a no-op when absent). Rejects on error. */
  deleteScopeOverride(commitmentId: string, field: ScopeField): Promise<void>
}
