// ⚠️ TEMPORARY — Commitments Phase 5a write-proof scaffold. REMOVE IN 5c.
//
// This is NOT the editor (5c) or the drawer render (5b). It exists only to prove
// the UserData write seam end-to-end: write an override, re-read it, and confirm it
// survives a page refresh (Supabase row live, localStorage in seed). It is gated
// behind the `?scopeproof` query param, so it never appears in normal use, and it
// deliberately lives outside the drawer (Phase 5a ships no drawer/editor UI). When
// 5c lands the real inline editor, delete this file and its mount in App.tsx.
//
// It targets the FIRST commitment in the snapshot and its `description` field, and
// writes a single trivial block (the whole normalized source as one paragraph) —
// enough to exercise save / read / delete without standing up any real editing.

import { useState } from 'react'
import { hashText, normalizeScope } from '@/lib/hashText'
import { overrideKey } from '@/lib/userDataSource'
import { useSiteData } from '@/state/DataContext'
import { useUserData } from '@/state/UserDataContext'
import type { ScopeField } from '@/types'

const FIELD: ScopeField = 'description'

const panel: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 9999,
  width: 340,
  padding: 12,
  borderRadius: 10,
  border: '1px dashed #b45309',
  background: '#fffbeb',
  color: '#1a1d21',
  font: '11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
  boxShadow: '0 8px 30px rgba(20,25,35,.18)',
}
const btn: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 600,
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
}

export function ScopeOverrideProof() {
  if (!new URLSearchParams(window.location.search).has('scopeproof')) return null
  return <ScopeOverrideProofPanel />
}

function ScopeOverrideProofPanel() {
  const { commitments } = useSiteData()
  const { status, error, overrides, saveOverride, deleteOverride, reload } = useUserData()
  const [busy, setBusy] = useState(false)
  const [opError, setOpError] = useState<string | null>(null)

  const commitment = commitments[0]
  if (!commitment) {
    return (
      <div style={panel}>
        <Title />
        <div>No commitments in snapshot — nothing to target.</div>
      </div>
    )
  }

  const key = overrideKey(commitment.id, FIELD)
  const current = overrides[key]
  const liveHash = hashText(commitment.description)

  async function run(op: () => Promise<void>) {
    setBusy(true)
    setOpError(null)
    try {
      await op()
    } catch (e) {
      setOpError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const write = () =>
    run(() =>
      saveOverride({
        commitmentId: commitment.id,
        field: FIELD,
        blocks: [{ kind: 'para', indent: 0, text: normalizeScope(commitment.description) }],
        sourceHash: liveHash,
      }),
    )
  const remove = () => run(() => deleteOverride(commitment.id, FIELD))

  return (
    <div style={panel}>
      <Title />
      <div style={{ marginBottom: 6 }}>
        seam status: <b>{status}</b>
        {error ? <span style={{ color: '#b91c1c' }}> — {error}</span> : null}
      </div>
      <div style={{ marginBottom: 2 }}>
        target: <b>{commitment.number || commitment.id}</b> · field <b>{FIELD}</b>
      </div>
      <div style={{ marginBottom: 8, color: '#6b7280' }}>source hash: {liveHash}</div>

      <div style={{ marginBottom: 8, padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #f3e8c8' }}>
        {current ? (
          <>
            <div>
              override: <b>{current.blocks.length}</b> block(s)
            </div>
            <div>
              saved hash: {current.sourceHash}{' '}
              {current.sourceHash === liveHash ? (
                <span style={{ color: '#15803d' }}>(matches)</span>
              ) : (
                <span style={{ color: '#b45309' }}>(STALE — source changed)</span>
              )}
            </div>
            <div style={{ color: '#6b7280' }}>at: {current.updatedAt}</div>
          </>
        ) : (
          <div style={{ color: '#6b7280' }}>no override stored — write one, then refresh to prove persistence.</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={btn} onClick={write} disabled={busy}>
          Write test override
        </button>
        <button type="button" style={btn} onClick={remove} disabled={busy || !current}>
          Delete
        </button>
        <button type="button" style={btn} onClick={reload} disabled={busy}>
          Reload
        </button>
      </div>
      {opError ? <div style={{ marginTop: 6, color: '#b91c1c' }}>op failed: {opError}</div> : null}
    </div>
  )
}

function Title() {
  return (
    <div style={{ fontWeight: 700, marginBottom: 6, color: '#b45309' }}>⚠ Phase 5a write proof (temporary)</div>
  )
}
