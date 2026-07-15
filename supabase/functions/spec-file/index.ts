// Sitelines — Specifications Phase 3. Server-side spec-section PDF byte-streaming
// proxy. The sibling of `submittal-file`, trimmed to the spec case.
//
// A spec section's synced PDF url (procore_specification_sections_master →
// sitelines_specs.pdf_url) is a pre-signed storage.procore.com link that (a) carries
// an expiring `sig` and (b) the browser can't embed (attachment header + no CORS). So
// the app never loads it directly. This function makes the spec PDF viewable in-app:
// it verifies the caller is a logged-in Sitelines user (`verify_jwt` at the gateway +
// an `authenticated`-role check in-function, since verify_jwt alone also admits the
// public publishable key), mints a Procore token via the same Client-Credentials + DMSA
// flow the sync pipeline uses, GETs the CURRENT REVISION
// (`/specification_section_revisions/{id}`) — which returns a FRESH `url` each call —
// fetches those bytes, and STREAMS them back inline. The viewer fetches this via
// supabase-js `functions.invoke` (parses `application/pdf` as a Blob) → object URL →
// <iframe>.
//
// SSRF: the file URL is derived from Procore's own API response, never supplied by the
// browser; we additionally allowlist the upstream host before fetching. The Procore
// secret lives ONLY as an edge-function secret; it is never in the bundle.
//
// Compliance: per-view, authenticated, pass-through — stores nothing, no mirror, no
// bulk export. It reproduces the pipeline's per-revision call (procore_pipeline.py:
// enrich_specs_with_detail fallback), but per view instead of in bulk.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// --- Procore endpoints (match sync/procore_pipeline.py) ---
const AUTH_URL = 'https://login.procore.com/oauth/token'
const BASE_API_URL = 'https://api.procore.com'

// Orchard Path III — the only project synced (the sitelines_* views hardcode this same
// project id). Overridable via env for a future multi-project setup.
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

// In-process token cache: Deno keeps module state across warm invocations, so a single
// minted token (90-min TTL) is reused until it nears expiry. Identical to submittal-file.
let cachedToken: { value: string; expiresAt: number } | null = null

async function getProcoreToken(forceFresh = false): Promise<string> {
  const now = Date.now()
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

// Role claim of the caller's bearer token, or null. `verify_jwt` at the gateway has
// already validated the signature; decoding here just reads the (trusted) `role`. A
// non-JWT bearer — notably the public `sb_publishable_…` key — has no three-part shape
// and returns null; a real logged-in user carries role `authenticated`. verify_jwt alone
// ALSO admits the publishable key, so this in-function check is what gates to logged-in.
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

// The numeric current-revision id (`sitelines_specs.revision_id`), or a bare number.
// Rejects anything that isn't a positive integer, so a malformed id never reaches Procore.
function revisionId(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const s = String(raw).trim()
  return /^[0-9]+$/.test(s) ? s : null
}

// SSRF defense-in-depth: even though the URL comes from Procore's trusted API response
// (not the client), only fetch https URLs on Procore's own domains / its storage host.
function isAllowedFileUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  return (
    host === 'procore.com' ||
    host.endsWith('.procore.com') ||
    host.endsWith('.amazonaws.com') // Procore storage redirects/serves from S3
  )
}

function safeFilename(name: string | null): string {
  const cleaned = (name ?? '').replace(/[\r\n"\\]/g, '').trim()
  return cleaned.length > 0 ? cleaned : 'specification-section.pdf'
}

async function fetchRevision(id: string, token: string): Promise<Response> {
  return await fetch(
    `${BASE_API_URL}/rest/v1.0/specification_section_revisions/${id}?project_id=${PROJECT_ID}`,
    { headers: { Authorization: `Bearer ${token}`, 'Procore-Company-Id': COMPANY_ID! } },
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // Authenticated callers only (see jwtRole): the public publishable key and anon role
  // are both rejected. The DMSA's permitted-projects list is the platform backstop.
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
    // 1. Fetch the current revision (carries a fresh `url`), retrying once on a 401 in
    //    case a cached token was revoked / clock-skewed.
    let token = await getProcoreToken()
    let revRes = await fetchRevision(id, token)
    if (revRes.status === 401) {
      cachedToken = null
      token = await getProcoreToken(true)
      revRes = await fetchRevision(id, token)
    }
    if (!revRes.ok) return json({ error: 'procore_fetch_failed', status: revRes.status }, 502)

    const rev = await revRes.json()
    const url = (rev as { url?: unknown })?.url
    if (typeof url !== 'string' || !url) return json({ error: 'no_pdf' }, 404)
    if (!isAllowedFileUrl(url)) return json({ error: 'disallowed_host' }, 502)
    const name = typeof (rev as { name?: unknown }).name === 'string' ? (rev as { name: string }).name : null

    // 2. Fetch the file bytes and stream them back inline. `Authorization` is NOT sent to
    //    the storage host — the url is pre-signed (carries its own token); a bearer can
    //    make S3 reject it.
    const fileRes = await fetch(url)
    if (!fileRes.ok || !fileRes.body) {
      return json({ error: 'file_fetch_failed', status: fileRes.status }, 502)
    }
    const contentType = fileRes.headers.get('Content-Type') || 'application/pdf'
    return new Response(fileRes.body, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${safeFilename(name)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return json({ error: 'proxy_failed', message: e instanceof Error ? e.message : String(e) }, 502)
  }
})
