import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGate } from '@/components/AuthGate'
import { createLocalSettings } from '@/data/localSettings'
import { createLocalUserData } from '@/data/localUserData'
import { createSeedSource } from '@/data/seedSource'
import { createSupabaseSource } from '@/data/supabaseSource'
import { createSupabaseUserData } from '@/data/supabaseUserData'
import { createSupabaseClient } from '@/lib/supabaseClient'
import { AppProvider } from '@/state/AppContext'
import { DataProvider } from '@/state/DataContext'
import { SettingsProvider } from '@/state/SettingsContext'
import { UserDataProvider } from '@/state/UserDataContext'
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
  // SettingsProvider is OUTERMOST in both branches: localStorage needs no auth/data,
  // and the whole tree (including AppProvider's boot hydrate) reads settings. Its
  // source is localStorage for v1 regardless of the data source (a per-user Supabase
  // settings source is a later phase).
  const settings = createLocalSettings()
  if (import.meta.env.VITE_DATA_SOURCE === 'live') {
    const client = createSupabaseClient()
    // UserData writes go to Supabase behind the same authenticated session; nesting
    // it under AuthGate ensures overrides load only once the owner is signed in.
    return (
      <SettingsProvider source={settings}>
        <AuthGate client={client}>
          <DataProvider source={createSupabaseSource(client)}>
            <UserDataProvider source={createSupabaseUserData(client)}>{app}</UserDataProvider>
          </DataProvider>
        </AuthGate>
      </SettingsProvider>
    )
  }
  const seed = createSeedSource({ delayMs: params.has('slow') ? 1500 : 0, fail: params.has('fail') })
  // Seed mode still exercises the write path — localUserData persists to localStorage.
  return (
    <SettingsProvider source={settings}>
      <DataProvider source={seed}>
        <UserDataProvider source={createLocalUserData()}>{app}</UserDataProvider>
      </DataProvider>
    </SettingsProvider>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode>{tree()}</StrictMode>)
