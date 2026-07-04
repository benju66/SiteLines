import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGate } from '@/components/AuthGate'
import { createSeedSource } from '@/data/seedSource'
import { createSupabaseSource } from '@/data/supabaseSource'
import { createSupabaseClient } from '@/lib/supabaseClient'
import { AppProvider } from '@/state/AppContext'
import { DataProvider } from '@/state/DataContext'
import { App } from './App'
import './index.css'

// The one place that picks the data source. VITE_DATA_SOURCE=live reads Supabase
// (behind a login); anything else uses the in-file seed. Dev helpers (seed only):
// ?slow exercises the loading state, ?fail the error state.
const params = new URLSearchParams(window.location.search)

function tree(): ReactNode {
  const app = (
    <AppProvider>
      <App />
    </AppProvider>
  )
  if (import.meta.env.VITE_DATA_SOURCE === 'live') {
    const client = createSupabaseClient()
    return (
      <AuthGate client={client}>
        <DataProvider source={createSupabaseSource(client)}>{app}</DataProvider>
      </AuthGate>
    )
  }
  const seed = createSeedSource({ delayMs: params.has('slow') ? 1500 : 0, fail: params.has('fail') })
  return <DataProvider source={seed}>{app}</DataProvider>
}

createRoot(document.getElementById('root')!).render(<StrictMode>{tree()}</StrictMode>)
