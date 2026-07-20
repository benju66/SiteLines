// Sitelines — Punch List Phase 2. Server-side punch-item detail proxy (JSON).
//
// A punch item's response thread (its assignment workflow) and PHOTOS are not in the
// synced list payload — only has_*_responses / has_attachments FLAGS. The photo urls are
// pre-signed storage.procore.com links that EXPIRE, so we never store them. This function
// fetches the item's DETAIL (`/punch_items/{id}`) live when the record drawer opens and
// returns a trimmed JSON payload with the assignment thread + FRESH photo urls. It verifies
// the caller is a logged-in Sitelines user (`verify_jwt` at the gateway + an
// `authenticated`-role check in-function, since verify_jwt alone also admits the public
// publishable key), mints a Procore token via the same Client-Credentials + DMSA flow the
// sync pipeline uses, and returns the subset the app's mapPunchDetail() consumes.
//
// Compliance: per-view, authenticated, read-only, no storage/mirror. The Procore secret
// lives ONLY as an edge-function secret; it never reaches the browser. Thumbnails render
// directly in <img> (image display needs no CORS); the returned urls are Procore's own.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const AUTH_URL = 'https://login.procore.com/oauth/token'
const BASE_API_URL = 'https://api.procore.com'
const PROJECT_ID = Deno.env.get('PROCORE_PROJECT_ID') ?? '3051002'

const CLIENT_ID = Deno.env.get('PROCORE_CLIENT_ID')
const CLIENT_SECRET = Deno.env.get('PROCORE_CLIENT_SECRET')
const COMPANY_ID = Deno.env.get('PROCORE_COMPANY_ID')

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// In-process token cache (warm invocations reuse a minted token). Identical to spec-file.
let cachedToken: { value: string; expiresAt: number } | null = null

async function getProcoreToken(forceFresh = false): Promise<string> {
  const now = Date.now()
  if (!forceFresh && cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.value
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID!, client_secret: CLIENT_SECRET! }),
  })
  if (!res.ok) throw new Error(`Procore token request failed (${res.status})`)
  const data = await res.json()
  const token = data.access_token as string
  if (!token) throw new Error('Procore token response missing access_token')
  const ttl = typeof data.expires_in === 'number' ? data.expires_in : 5400
  cachedToken = { value: token, expiresAt: now + ttl * 1000 }
  return token
}

// Role claim of the caller's bearer, or null. A non-JWT bearer (the public publishable key)
// returns null; a logged-in user carries role `authenticated`. verify_jwt alone also admits
// the publishable key, so this in-function check is what gates to logged-in.
function jwtRole(authHeader: string | null): string | null {
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(b64))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

// Numeric punch id from the seam id ("punch:<id>") or a bare number. Rejects anything else
// so a malformed id never reaches Procore.
function punchId(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const s = String(raw).trim().replace(/^punch:/, '')
  return /^[0-9]+$/.test(s) ? s : null
}

async function fetchDetail(id: string, token: string): Promise<Response> {
  return await fetch(`${BASE_API_URL}/rest/v1.1/punch_items/${id}?project_id=${PROJECT_ID}`, {
    headers: { Authorization: `Bearer ${token}`, 'Procore-Company-Id': COMPANY_ID! },
  })
}

// Trim Procore's punch detail to just what mapPunchDetail() reads — smaller payload, no
// over-sharing. Arrays are passed through as-is (the app maps assignment/photo fields).
function trim(detail: Record<string, unknown>) {
  const arr = (v: unknown) => (Array.isArray(v) ? v : [])
  return {
    description: detail.description ?? null,
    rich_text_description: detail.rich_text_description ?? null,
    closed_at: detail.closed_at ?? null,
    position: detail.position ?? null,
    assignments: arr(detail.assignments),
    web_images: arr(detail.web_images),
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  if (jwtRole(req.headers.get('Authorization')) !== 'authenticated') return json({ error: 'unauthorized' }, 401)
  if (!CLIENT_ID || !CLIENT_SECRET || !COMPANY_ID) return json({ error: 'server_misconfigured' }, 500)

  let body: { id?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  const id = punchId(body.id)
  if (!id) return json({ error: 'invalid_id' }, 400)

  try {
    let token = await getProcoreToken()
    let res = await fetchDetail(id, token)
    if (res.status === 401) {
      cachedToken = null
      token = await getProcoreToken(true)
      res = await fetchDetail(id, token)
    }
    if (!res.ok) return json({ error: 'procore_fetch_failed', status: res.status }, 502)
    const detail = await res.json()
    return json(trim(detail as Record<string, unknown>))
  } catch (e) {
    return json({ error: 'proxy_failed', message: e instanceof Error ? e.message : String(e) }, 502)
  }
})
