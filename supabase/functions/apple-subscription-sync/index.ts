// =====================================================================
// apple-subscription-sync
// ---------------------------------------------------------------------
// Client StoreKit success is NOT source of truth. This function verifies
// the transaction with App Store Server API, maps product id -> tier, then
// writes student_entitlements idempotently with service role.
//
// Required secrets:
//   APPLE_ISSUER_ID
//   APPLE_KEY_ID
//   APPLE_BUNDLE_ID=com.vananhaudio.guitar
//   APPLE_PRIVATE_KEY   (App Store Connect API .p8 content)
// DEPLOY: Verify JWT BAT (client must be logged in).
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APPLE_ISSUER_ID = Deno.env.get('APPLE_ISSUER_ID')
const APPLE_KEY_ID = Deno.env.get('APPLE_KEY_ID')
const APPLE_BUNDLE_ID = Deno.env.get('APPLE_BUNDLE_ID') ?? 'com.vananhaudio.guitar'
const APPLE_PRIVATE_KEY = Deno.env.get('APPLE_PRIVATE_KEY')

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const PRODUCT_TIER: Record<string, string> = {
  'com.vananhaudio.guitar.subscription.khoi_dau': 'khoi_dau_99',
  'com.vananhaudio.guitar.subscription.can_ban': 'can_ban_396',
  'com.vananhaudio.guitar.monthly': 'nang_cao_499',
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type AppleTransactionPayload = {
  transactionId?: string
  originalTransactionId?: string
  bundleId?: string
  productId?: string
  purchaseDate?: number
  expiresDate?: number
  revocationDate?: number
  environment?: string
  offerType?: number
  signedDate?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'login_required' }, 401)

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'invalid_session' }, 401)

  if (!APPLE_ISSUER_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
    return json({ error: 'apple_server_api_not_configured' }, 503)
  }

  let body: { signedTransactionInfo?: string; transactionId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const clientPayload = body.signedTransactionInfo
    ? decodeJwtPayload<AppleTransactionPayload>(body.signedTransactionInfo)
    : null
  const transactionId = body.transactionId || clientPayload?.transactionId
  if (!transactionId) return json({ error: 'missing_transaction_id' }, 400)

  const appleJwt = await createAppleJwt()
  const verified = await fetchTransactionFromApple(transactionId, appleJwt)
  if (!verified.ok) return json({ error: 'apple_verification_failed', reason: verified.reason }, 402)

  const signedTransactionInfo = verified.signedTransactionInfo
  const tx = decodeJwtPayload<AppleTransactionPayload>(signedTransactionInfo)

  if (!tx.productId || !PRODUCT_TIER[tx.productId]) return json({ error: 'unknown_product_id' }, 400)
  if (tx.bundleId !== APPLE_BUNDLE_ID) return json({ error: 'bundle_mismatch' }, 400)
  if (clientPayload?.productId && clientPayload.productId !== tx.productId) {
    return json({ error: 'transaction_payload_mismatch' }, 400)
  }

  const { data: student, error: studentError } = await admin
    .from('edu_students')
    .select('id')
    .eq('user_id', userData.user.id)
    .single()
  if (studentError || !student?.id) return json({ error: 'student_not_found' }, 404)

  const nowMs = Date.now()
  const expiresAt = tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null
  const startsAt = tx.purchaseDate ? new Date(tx.purchaseDate).toISOString() : new Date().toISOString()
  const status = tx.revocationDate
    ? 'revoked'
    : tx.expiresDate && tx.expiresDate <= nowMs
      ? 'expired'
      : 'active'
  const sourceRef = `apple:${tx.originalTransactionId || tx.transactionId}`
  const tier = PRODUCT_TIER[tx.productId]
  const metadata = {
    provider: 'apple',
    product_id: tx.productId,
    transaction_id: tx.transactionId,
    original_transaction_id: tx.originalTransactionId,
    environment: tx.environment ?? verified.environment,
    offer_type: tx.offerType ?? null,
    signed_date: tx.signedDate ?? null,
    synced_at: new Date().toISOString(),
  }

  const { data: existing, error: existingError } = await admin
    .from('student_entitlements')
    .select('id')
    .eq('source', 'apple_subscription')
    .eq('source_ref', sourceRef)
    .maybeSingle()
  if (existingError) return json({ error: 'entitlement_lookup_failed' }, 500)

  const row = {
    student_id: student.id,
    tier,
    source: 'apple_subscription',
    source_ref: sourceRef,
    starts_at: startsAt,
    ends_at: expiresAt,
    is_lifetime: false,
    status,
    metadata,
  }

  const write = existing?.id
    ? await admin.from('student_entitlements').update(row).eq('id', existing.id).select('id').single()
    : await admin.from('student_entitlements').insert(row).select('id').single()

  if (write.error || !write.data) return json({ error: 'entitlement_write_failed' }, 500)

  const { data: effective, error: effectiveError } = await admin.rpc('get_effective_student_entitlement', {
    p_student_id: student.id,
  })
  if (effectiveError) return json({ error: 'effective_entitlement_failed' }, 500)

  return json({
    ok: true,
    entitlement_id: write.data.id,
    status,
    tier,
    effective: Array.isArray(effective) ? effective[0] : effective,
  })
})

async function fetchTransactionFromApple(transactionId: string, token: string): Promise<
  | { ok: true; signedTransactionInfo: string; environment: 'Production' | 'Sandbox' }
  | { ok: false; reason: string }
> {
  const endpoints = [
    { env: 'Production' as const, url: `https://api.storekit.itunes.apple.com/inApps/v1/transactions/${transactionId}` },
    { env: 'Sandbox' as const, url: `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/transactions/${transactionId}` },
  ]

  for (const endpoint of endpoints) {
    const res = await fetch(endpoint.url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data = await res.json() as { signedTransactionInfo?: string }
      if (data.signedTransactionInfo) {
        return { ok: true, signedTransactionInfo: data.signedTransactionInfo, environment: endpoint.env }
      }
    }
    if (res.status !== 404) {
      const text = await res.text().catch(() => '')
      return { ok: false, reason: `${endpoint.env}:${res.status}:${text.slice(0, 120)}` }
    }
  }

  return { ok: false, reason: 'transaction_not_found' }
}

async function createAppleJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'ES256', kid: APPLE_KEY_ID, typ: 'JWT' }
  const claims = {
    iss: APPLE_ISSUER_ID,
    iat: now,
    exp: now + 15 * 60,
    aud: 'appstoreconnect-v1',
    bid: APPLE_BUNDLE_ID,
  }
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(claims)}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(APPLE_PRIVATE_KEY!),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned))
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`
}

function decodeJwtPayload<T>(jws: string): T {
  const part = jws.split('.')[1]
  if (!part) throw new Error('invalid_jws')
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
  return JSON.parse(atob(normalized))
}

function base64UrlJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)))
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
