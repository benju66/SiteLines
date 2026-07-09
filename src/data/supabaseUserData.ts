// Live UserDataSource (Commitments, Phase 5a) — the app's first WRITE-back impl.
// Reads and writes sitelines_scope_overrides over the same authenticated Supabase
// client the read seam uses (createSupabaseClient / AuthGate). The table's RLS
// grants the `authenticated` role SELECT + INSERT/UPDATE/DELETE, so the logged-in
// owner's session is what admits the write — no service-role key ever reaches the
// browser bundle.

import type { SupabaseClient } from '@supabase/supabase-js'
import { mapScopeOverride, toScopeOverrideRow, type ScopeOverrideRow } from '@/lib/mapScopeOverride'
import type { UserDataSource } from '@/lib/userDataSource'
import type { ScopeField, ScopeOverride } from '@/types'

const TABLE = 'sitelines_scope_overrides'

export function createSupabaseUserData(client: SupabaseClient): UserDataSource {
  return {
    name: 'supabase-user',

    async getScopeOverrides(): Promise<ScopeOverride[]> {
      // The whole table is tiny (≤ one override per scope field per commitment),
      // so a single unpaged read is fine — no fetchAll paging needed.
      const { data, error } = await client.from(TABLE).select('*')
      if (error) throw new Error(`Supabase read failed (${TABLE}): ${error.message}`)
      return ((data ?? []) as ScopeOverrideRow[]).map(mapScopeOverride)
    },

    async saveScopeOverride(override: ScopeOverride): Promise<void> {
      // Upsert on the composite PK: a re-edit of the same (commitment, field)
      // replaces its row rather than erroring. `updated_by` is omitted so the
      // DB default (auth.uid()) stamps the writer on insert.
      const { error } = await client
        .from(TABLE)
        .upsert(toScopeOverrideRow(override), { onConflict: 'commitment_id,field' })
      if (error) throw new Error(`Supabase write failed (${TABLE}): ${error.message}`)
    },

    async deleteScopeOverride(commitmentId: string, field: ScopeField): Promise<void> {
      const { error } = await client.from(TABLE).delete().eq('commitment_id', commitmentId).eq('field', field)
      if (error) throw new Error(`Supabase delete failed (${TABLE}): ${error.message}`)
    },
  }
}
