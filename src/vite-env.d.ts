/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'live' reads Supabase; anything else uses the in-file seed. */
  readonly VITE_DATA_SOURCE?: 'live' | 'seed'
  readonly VITE_SUPABASE_URL?: string
  /** Publishable (public-in-bundle) key; RLS governs what it can read. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
