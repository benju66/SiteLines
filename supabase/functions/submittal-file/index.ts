// Sitelines — Submittal Viewer Phase 1. Server-side "final reviewed submittal"
// byte-streaming proxy.
//
// The record drawer's "Final reviewed submittal" row links to Procore's pre-signed
// file URL, which the browser DOWNLOADS (Procore serves it with an attachment
// header) and cannot embed (the storage host sends no CORS header). This edge
// function makes the PDF viewable in-app: it verifies the caller is a logged-in
// Sitelines user (`verify_jwt` at the gateway + an `authenticated`-role check
// in-function, since verify_jwt alone also admits the public publishable key),
// mints a Procore token via the same Client-Credentials + DMSA flow the sync
// pipeline uses, GETs the submittal DETAIL (the only endpoint carrying
// `distributed_submittals[].final_attachments[]`), re-mints a fresh attachment URL
// server-side, fetches those bytes, and STREAMS them back inline. The Phase-2
// viewer fetches this via supabase-js `functions.invoke` (which parses an
// `application/pdf` response as a Blob) → object URL → <iframe>.
//
// SSRF: the file URL is derived from Procore's own API response, never supplied by
// the browser; we additionally allowlist the upstream host before fetching it. The
// Procore secret lives ONLY as an edge-function secret; it is never in the bundle.
//
// Compliance: per-view, authenticated, pass-through — stores nothing, no mirror,
// no bulk export. It reproduces exactly the pipeline's submittal-detail call
// (procore_pipeline.py:enrich_submittals_with_final / _latest_final_attachments),
// but per view instead of in bulk. Bytes stream through (unlike drawing-file's
// zero-byte JSON), so there is modest egress; negligible for a single-user app.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// --- Procore endpoints (match sync/procore_pipeline.py) ---
const AUTH_URL = 'https://login.procore.com/oauth/token'
const BASE_API_URL = 'https://api.procore.com'

// Orchard Path III — the only project synced (the sitelines_* views hardcode this
// same project id). Overridable via env for a future multi-project setup.
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
// single minted token (90-min TTL) is reused until it nears expiry rather than
// hitting the token endpoint on every call. Identical to drawing-file.
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
// non-JWT bearer — notably the public `sb_publishable_…` key — has no three-part
// shape and returns null; a real logged-in user carries role `authenticated`. This
// is what makes the function "logged-in users only": verify_jwt alone ALSO admits
// the publishable key, so it is not sufficient on its own.
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

// Extract the numeric Procore submittal id from the seam id ("submittals:<id>", the
// shape the items/detail views emit) or a bare number. Rejects anything that isn't a
// positive integer, so a malformed id never reaches Procore.
function submittalId(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const s = String(raw).trim().replace(/^submittals:/, '')
  return /^[0-9]+$/.test(s) ? s : null
}

interface FinalAttachment {
  url: string
  name: string | null
  contentType: string | null
}

// The reviewed/stamped doc from the most recent distribution — the exact analog of
// the pipeline's _latest_final_attachments. `distributed_submittals[]` records each
// time a reviewed submittal was distributed back; each carries `final_attachments[]`.
// Pick the latest distribution that actually has finals (by `sent_at`), then its
// first attachment with a URL. Returns null when never distributed (no final yet).
function latestFinalAttachment(detail: unknown): FinalAttachment | null {
  const dists = (detail as { distributed_submittals?: unknown })?.distributed_submittals
  if (!Array.isArray(dists)) return null
  const withFinals = dists.filter(
    (d): d is Record<string, unknown> =>
      !!d && typeof d === 'object' && Array.isArray((d as { final_attachments?: unknown }).final_attachments) &&
      ((d as { final_attachments: unknown[] }).final_attachments).length > 0,
  )
  if (withFinals.length === 0) return null
  const latest = withFinals.reduce((best, d) =>
    String(d.sent_at ?? '') > String(best.sent_at ?? '') ? d : best,
  )
  const atts = (latest.final_attachments as unknown[]) ?? []
  for (const att of atts) {
    if (att && typeof att === 'object') {
      const a = att as Record<string, unknown>
      if (typeof a.url === 'string' && a.url) {
        const name = typeof a.name === 'string' ? a.name : typeof a.filename === 'string' ? a.filename : null
        const contentType = typeof a.content_type === 'string' ? a.content_type : null
        return { url: a.url, name, contentType }
      }
    }
  }
  return null
}

// SSRF defense-in-depth: even though the URL comes from Procore's trusted API
// response (not the client), only fetch https URLs on Procore's own domains / its
// storage host. A stray/unexpected host is refused rather than fetched.
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

// Strip anything that could break the Content-Disposition header; keep a safe
// filename (default to a generic one).
function safeFilename(name: string | null): string {
  const cleaned = (name ?? '').replace(/[\r\n"\\]/g, '').trim()
  return cleaned.length > 0 ? cleaned : 'final-reviewed-submittal.pdf'
}

async function fetchSubmittalDetail(id: string, token: string): Promise<Response> {
  return await fetch(`${BASE_API_URL}/rest/v1.1/projects/${PROJECT_ID}/submittals/${id}`, {
    headers: { Authorization: `Bearer ${token}`, 'Procore-Company-Id': COMPANY_ID! },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // Authenticated callers only. `verify_jwt` at the gateway validates the token's
  // signature, but with the new key model it also admits the PUBLIC publishable key
  // — so require the `authenticated` role here (publishable key and anon role are
  // both rejected). The DMSA's permitted-projects list is the platform backstop.
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
  const id = submittalId(body.id)
  if (!id) return json({ error: 'invalid_id' }, 400)

  try {
    // 1. Fetch the submittal detail (carries distributed_submittals), retrying once
    //    on a 401 in case a cached token was revoked / clock-skewed.
    let token = await getProcoreToken()
    let detailRes = await fetchSubmittalDetail(id, token)
    if (detailRes.status === 401) {
      cachedToken = null
      token = await getProcoreToken(true)
      detailRes = await fetchSubmittalDetail(id, token)
    }
    if (!detailRes.ok) return json({ error: 'procore_fetch_failed', status: detailRes.status }, 502)

    const detail = await detailRes.json()
    const final = latestFinalAttachment(detail)
    if (!final) return json({ error: 'no_final' }, 404)
    if (!isAllowedFileUrl(final.url)) return json({ error: 'disallowed_host' }, 502)

    // 2. Fetch the file bytes and stream them back inline. `Authorization` is NOT
    //    sent to the storage host — the attachment URL is pre-signed (carries its
    //    own token); adding a bearer can make S3 reject it.
    const fileRes = await fetch(final.url)
    if (!fileRes.ok || !fileRes.body) {
      return json({ error: 'file_fetch_failed', status: fileRes.status }, 502)
    }
    const contentType = final.contentType || fileRes.headers.get('Content-Type') || 'application/pdf'
    return new Response(fileRes.body, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${safeFilename(final.name)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return json({ error: 'proxy_failed', message: e instanceof Error ? e.message : String(e) }, 502)
  }
})
