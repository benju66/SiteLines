// Sitelines — Drawings Phase 3. Server-side "fresh sheet URL" minter.
//
// The drawing viewer normally loads Procore's pre-signed png/pdf URLs captured
// at sync time; the `sig=` token eventually expires and the sheet stops loading.
// This edge function re-mints a fresh URL on demand: it verifies the caller is a
// logged-in Sitelines user (`verify_jwt` at the gateway + an `authenticated`-role
// check in-function, since verify_jwt alone also admits the public publishable
// key), mints a Procore token via the same Client-Credentials + DMSA flow the
// sync pipeline uses, GETs the
// single drawing revision, and returns fresh `{ pngUrl, pdfUrl }` JSON. The image
// bytes are fetched by the browser straight from Procore storage — none pass
// through here (no egress, no mirror). The Procore secret lives ONLY as an
// edge-function secret; it is never in the browser bundle.
//
// Compliance (research §4): per-view, authenticated, pass-through — stores
// nothing, builds no mirror, no bulk export. It reproduces exactly one call the
// sync pipeline already makes (procore_pipeline.py:get_access_token / get_json /
// the drawing_revisions pull), but per view instead of in bulk.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// --- Procore endpoints (match sync/procore_pipeline.py) ---
const AUTH_URL = 'https://login.procore.com/oauth/token'
const BASE_API_URL = 'https://api.procore.com'

// Orchard Path III — the only project with drawings synced (the sitelines_drawings
// / sitelines_drawing_revisions views hardcode this same project id). Overridable
// via env for a future multi-project setup; not one of the required secrets.
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// In-process token cache: Deno keeps module state across warm invocations, so a
// single minted token (90-min TTL) is reused until it nears expiry, rather than
// hitting the token endpoint on every call. A cold start just mints a new one —
// an optional optimization over strict per-invocation minting (locked decision 3).
let cachedToken: { value: string; expiresAt: number } | null = null

async function getProcoreToken(forceFresh = false): Promise<string> {
  const now = Date.now()
  // Refresh a minute early to stay clear of the expiry boundary / clock skew.
  if (!forceFresh && cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.value
  }
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`Procore token request failed (${res.status})`)
  const data = await res.json()
  const token = data.access_token as string
  if (!token) throw new Error('Procore token response missing access_token')
  const ttl = typeof data.expires_in === 'number' ? data.expires_in : 5400 // 90 min default
  cachedToken = { value: token, expiresAt: now + ttl * 1000 }
  return token
}

// Role claim of the caller's bearer token, or null. `verify_jwt` at the gateway
// has already validated the signature before we run, so decoding here just reads
// the (trusted) `role`. A non-JWT bearer — notably the public `sb_publishable_…`
// key — has no three-part shape and returns null; a real logged-in user carries
// role `authenticated`. This is what makes the function "logged-in users only":
// verify_jwt alone ALSO admits the public publishable key, so it is not
// sufficient on its own (see the header note / locked decision 4's intent).
function jwtRole(authHeader: string | null): string | null {
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const parts = token.split('.')
  if (parts.length !== 3) return null // not a JWT (e.g. the publishable key)
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(b64))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

// Extract the numeric Procore revision id from the seam id ("drawings:<id>", the
// shape the views emit) or a bare number. Rejects anything that isn't a positive
// integer, so a malformed id never reaches Procore.
function revisionId(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const s = String(raw).trim().replace(/^drawings:/, '')
  return /^[0-9]+$/.test(s) ? s : null
}

async function fetchRevision(id: string, token: string): Promise<Response> {
  return await fetch(`${BASE_API_URL}/rest/v1.0/projects/${PROJECT_ID}/drawing_revisions/${id}`, {
    headers: { Authorization: `Bearer ${token}`, 'Procore-Company-Id': COMPANY_ID! },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // Authenticated callers only (locked decision 4 / scope: "authenticated callers
  // only"). `verify_jwt` at the gateway validates the token's signature, but with
  // the new key model it also admits the PUBLIC `sb_publishable_…` key — so it is
  // not "logged-in users only" by itself. Require the `authenticated` role: the
  // publishable key (not a JWT) and the anon role are both rejected here. The
  // DMSA's permitted-projects list remains the platform-level backstop.
  if (jwtRole(req.headers.get('Authorization')) !== 'authenticated') {
    return json({ error: 'unauthorized' }, 401)
  }

  if (!CLIENT_ID || !CLIENT_SECRET || !COMPANY_ID) {
    return json({ error: 'server_misconfigured' }, 500)
  }

  let body: { id?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  const id = revisionId(body.id)
  if (!id) return json({ error: 'invalid_id' }, 400)

  try {
    let token = await getProcoreToken()
    let res = await fetchRevision(id, token)
    // A cached token can still be rejected (revoked / skew): drop it and retry once.
    if (res.status === 401) {
      cachedToken = null
      token = await getProcoreToken(true)
      res = await fetchRevision(id, token)
    }
    if (!res.ok) return json({ error: 'procore_fetch_failed', status: res.status }, 502)
    const rev = await res.json()
    return json({
      pngUrl: typeof rev?.png_url === 'string' ? rev.png_url : null,
      pdfUrl: typeof rev?.pdf_url === 'string' ? rev.pdf_url : null,
    })
  } catch (e) {
    return json({ error: 'mint_failed', message: e instanceof Error ? e.message : String(e) }, 502)
  }
})
