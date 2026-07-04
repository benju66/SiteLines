// Login screen (Data Seam Phase 3). Shown by AuthGate when live data is enabled
// and no session exists. Single-user email/password sign-in via Supabase Auth.

import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await client.auth.signInWithPassword({ email, password })
    // On success, AuthGate's onAuthStateChange swaps this screen for the app.
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  const field: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: 'var(--font-sans)',
    color: 'var(--tx-primary)',
    background: 'var(--white)',
    border: '1px solid var(--bd-card)',
    borderRadius: 8,
    outline: 'none',
  }

  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: 'var(--app-bg)' }}>
      <form
        onSubmit={submit}
        style={{
          width: 320,
          padding: 28,
          background: 'var(--card)',
          border: '1px solid var(--bd-card)',
          borderRadius: 14,
          boxShadow: '0 1px 2px rgba(0,0,0,.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 650, color: 'var(--tx-primary)' }}>Sitelines</div>
          <div style={{ fontSize: 13, color: 'var(--tx-tertiary)', marginTop: 2 }}>Sign in to view live project data</div>
        </div>
        <label style={{ fontSize: 12, color: 'var(--tx-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          Email
          <input style={field} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label style={{ fontSize: 12, color: 'var(--tx-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          Password
          <input style={field} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div style={{ fontSize: 12, color: '#c0392b' }}>{error}</div>}
        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 4,
            padding: '10px 12px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--white)',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
