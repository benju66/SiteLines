// Auth gate (Data Seam Phase 3). Only used for the live Supabase source. Renders
// the Login screen until a session exists, then mounts its children (which include
// the DataProvider — so live data is only fetched once the user is authenticated).

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { Login } from '@/components/Login'

export function AuthGate({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let active = true
    client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setChecked(true)
    })
    const { data: sub } = client.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [client])

  if (!checked) return null // brief blank while the stored session is restored
  if (!session) return <Login client={client} />
  return <>{children}</>
}
