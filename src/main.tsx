import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createSeedSource } from '@/data/seedSource'
import { createSupabaseSource } from '@/data/supabaseSource'
import { createSupabaseClient } from '@/lib/supabaseClient'
import { AppProvider } from '@/state/AppContext'
import { DataProvider } from '@/state/DataContext'
import { App } from './App'
import './index.css'

// The one place that picks the data source. VITE_DATA_SOURCE=live reads Supabase;
// anything else uses the in-file seed. Dev helpers (seed only): ?slow exercises the
// loading state, ?fail the error state.
const params = new URLSearchParams(window.location.search)
const source =
  import.meta.env.VITE_DATA_SOURCE === 'live'
    ? createSupabaseSource(createSupabaseClient())
    : createSeedSource({
        delayMs: params.has('slow') ? 1500 : 0,
        fail: params.has('fail'),
      })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider source={source}>
      <AppProvider>
        <App />
      </AppProvider>
    </DataProvider>
  </StrictMode>,
)
