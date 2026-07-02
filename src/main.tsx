import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createSeedSource } from '@/data/seedSource'
import { AppProvider } from '@/state/AppContext'
import { DataProvider } from '@/state/DataContext'
import { App } from './App'
import './index.css'

// Seed source for now; Phase 3 swaps in the Supabase source here — the only
// place that knows which one is live. Dev helpers: ?slow exercises the loading
// state, ?fail the error state.
const params = new URLSearchParams(window.location.search)
const source = createSeedSource({
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
