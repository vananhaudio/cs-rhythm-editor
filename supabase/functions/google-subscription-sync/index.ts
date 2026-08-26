// =====================================================================
// google-subscription-sync — verify Google Play subscription SERVER-SIDE
// rồi upsert student_entitlements (source='google_subscription').
// ---------------------------------------------------------------------
// Mirror của apple-subscription-sync:
//   1. Bắt buộc user đăng nhập (Bearer token Supabase).
//   2. Client chỉ gửi purchaseToken + productId — KHÔNG được tin client.
//   3. Verify với Google Play Developer API (subscriptionsv2) bằng
//      service account (env). Kiểm package/product/state/expiry.
//   4. Map product → tier, upsert idempotent theo (source, source_ref).
//      Expired/cancelled-hết-hạn KHÔNG được cấp active.
//   5. Không đụng legacy entitlement; effective tier vẫn qua resolver
//      get_effective_student_entitlement.
// ENV cần: GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY (PKCS8 PEM),
//          GOOGLE_PLAY_PACKAGE (mặc định com.vananhaudio.guitar).
// KHÔNG log purchaseToken/access token đầy đủ.
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_SA_EMAIL = Deno.env.get('GOOGLE_SA_EMAIL')
const GOOGLE_SA_PRIVATE_KEY = Deno.env.get('GOOGLE_SA_PRIVATE_KEY')
const PACKAGE_NAME = Deno.env.get('GOOGLE_PLAY_PACKAGE') ?? 'com.vananhaudio.guitar'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

// Cùng map với client (src/iap.ts) — Nâng cao KHÔNG có ở đây (chưa bán).
const PRODUCT_TIER: Record<string, string> = {
  'com.vananhaudio.guitar.subscription.khoi_dau': 'khoi_dau_99',
  'com.vananhaudio.guitar.subscription.can_ban': 'can_ban_396',
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const tokenHint = (t: string) => `${t.slice(0, 6)}…(${t.length})` // log an toàn

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID()
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'login_required' }, 401)
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'invalid_session' }, 401)

  if (!GOOGLE_SA_EMAIL || !GOOGLE_SA_PRIVATE_KEY) {
    return json({ error: 'google_server_api_not_configured' }, 503)
  }

  let body: { purchaseToken?: string; productId?: string; clientRequestId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  const logId = body.clientRequestId || requestId
  const purchaseToken = (body.purchaseToken ?? '').trim()
  if (!purchaseToken) return json({ error: 'missing_purchase_token' }, 400)

  console.info('google_subscription_sync_requested', {
    request_id: logId,
    token_hint: tokenHint(purchaseToken),
    client_product_id: body.productId ?? null,
  })

  // ── Verify với Google (subscriptionsv2) ──
  const accessToken = await googleAccessToken()
  if (!accessToken) return json({ error: 'google_auth_failed' }, 502)

  const res = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.info('google_subscription_sync_rejected', {
      request_id: logId,
      stage: 'google_verification',
      status: res.status,
      reason: text.slice(0, 160),
    })
    return json({ error: 'google_verification_failed', reason: `google:${res.status}` }, 402)
  }
  const sub = await res.json() as {
    subscriptionState?: string
    startTime?: string
    latestOrderId?: string
    acknowledgementState?: string
    lineItems?: { productId?: string; expiryTime?: string }[]
    testPurchase?: unknown
  }

  const line = sub.lineItems?.[0]
  const productId = line?.productId ?? ''
  const tier = PRODUCT_TIER[productId]
  if (!tier) return json({ error: 'unknown_product_id' }, 400)
  if (body.productId && body.productId !== productId) {
    return json({ error: 'purchase_payload_mismatch' }, 400)
  }

  const nowMs = Date.now()
  const expiryMs = line?.expiryTime ? Date.parse(line.expiryTime) : NaN
  const state = sub.subscriptionState ?? ''
  // Fail closed: chỉ active khi Google nói còn hạn và state hợp lệ.
  const activeStates = new Set([
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    'SUBSCRIPTION_STATE_CANCELED', // đã hủy nhưng còn hạn đến expiry
  ])
  const status = state === 'SUBSCRIPTION_STATE_ON_HOLD' || state === 'SUBSCRIPTION_STATE_PAUSED'
    ? 'past_due'
    : Number.isFinite(expiryMs) && expiryMs > nowMs && activeStates.has(state)
      ? 'active'
      : 'expired'

  const { data: student, error: studentError } = await admin
    .from('edu_students')
    .select('id')
    .eq('user_id', userData.user.id)
    .single()
  if (studentError || !student?.id) return json({ error: 'student_not_found' }, 404)

  const sourceRef = `google:${purchaseToken}` // idempotent — retry không cấp trùng
  const metadata = {
    provider: 'google',
    product_id: productId,
    order_id: sub.latestOrderId ?? null,
    subscription_state: state,
    package_name: PACKAGE_NAME,
    is_test_purchase: Boolean(sub.testPurchase),
    synced_at: new Date().toISOString(),
  }
  const row = {
    student_id: student.id,
    tier,
    source: 'google_subscription',
    source_ref: sourceRef,
    starts_at: sub.startTime ?? new Date().toISOString(),
    ends_at: Number.isFinite(expiryMs) ? new Date(expiryMs).toISOString() : null,
    is_lifetime: false,
    status,
    metadata,
  }

  const { data: existing, error: existingError } = await admin
    .from('student_entitlements')
    .select('id')
    .eq('source', 'google_subscription')
    .eq('source_ref', sourceRef)
    .maybeSingle()
  if (existingError) return json({ error: 'entitlement_lookup_failed' }, 500)

  const write = existing?.id
    ? await admin.from('student_entitlements').update(row).eq('id', existing.id).select('id').single()
    : await admin.from('student_entitlements').insert(row).select('id').single()
  if (write.error || !write.data) return json({ error: 'entitlement_write_failed' }, 500)

  // Acknowledge server-side (best-effort) nếu Google báo chưa ack.
  if (sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && status === 'active') {
    await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}' },
    ).catch(() => {})
  }

  // Effective tier qua resolver canonical, bằng token CỦA USER (RLS đúng vai).
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: effective, error: effectiveError } = await userClient.rpc('get_effective_student_entitlement', {
    p_student_id: student.id,
  })
  if (effectiveError) return json({ error: 'effective_entitlement_failed' }, 500)

  console.info('google_subscription_sync_granted', {
    request_id: logId,
    entitlement_id: write.data.id,
    student_id: student.id,
    tier,
    product_id: productId,
    status,
    updated_existing: Boolean(existing?.id),
  })

  return json({
    ok: true,
    entitlement_id: write.data.id,
    tier,
    status,
    effective: Array.isArray(effective) ? effective[0] : effective,
  })
})

// ── OAuth service account: JWT RS256 → access token (scope androidpublisher) ──
async function googleAccessToken(): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000)
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claims = b64url(JSON.stringify({
      iss: GOOGLE_SA_EMAIL,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }))
    const input = `${header}.${claims}`
    const key = await importPkcs8(GOOGLE_SA_PRIVATE_KEY!)
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input))
    const jwt = `${input}.${b64urlBytes(new Uint8Array(sig))}`

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })
    if (!res.ok) {
      console.error('google_oauth_failed', res.status)
      return null
    }
    const data = await res.json()
    return data.access_token ?? null
  } catch (e) {
    console.error('google_oauth_error', e instanceof Error ? e.message : 'unknown')
    return null
  }
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

const b64url = (s: string) => b64urlBytes(new TextEncoder().encode(s))
function b64urlBytes(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
