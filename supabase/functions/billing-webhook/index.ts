// =====================================================================
// billing-webhook — điểm nhận event từ payment provider (BƯỚC 8A)
// ---------------------------------------------------------------------
// TRẠNG THÁI HIỆN TẠI: provider CHƯA chốt → mọi request bị TỪ CHỐI an toàn
// (503 billing_provider_not_configured). KHÔNG giả signature algorithm.
// KHÔNG có đường nào cho phép caller gửi PAYMENT_SUCCEEDED/TRIAL_STARTED/
// ACTIVE rồi được hệ thống tin tưởng.
//
// KHI CÓ PROVIDER (bước tiếp theo — cần duyệt riêng):
//   1. const adapter = getProviderAdapter() — trả adapter thật khi có env
//   2. if (!(await adapter.verifyWebhookSignature(req))) return 401
//   3. const event = await adapter.parseWebhookEvent(await req.text())
//   4. if (!event?.businessEvent) return 200 { received: true } (event lạ: nhận, không xử lý)
//   5. rpc billing_ingest_event(...) bằng SERVICE ROLE (qua service key env)
//   6. return 200 { received: true, processed: <kết quả> }
//
// DEPLOY: Supabase Dashboard → Edge Functions → billing-webhook → Verify JWT: TẮT.
// (Webhook đến từ provider, không phải user; xác thực = chữ ký provider.)
// =====================================================================

// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProviderAdapter } from '../_shared/billing/provider.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const adapter = getProviderAdapter()
  if (!adapter) {
    // Provider chưa chốt — từ chối xử lý an toàn. Không nhận sự kiện nào.
    return json({ error: 'billing_provider_not_configured' }, 503)
  }

  // ── Các bước 2→6 ở trên sẽ được bổ sung khi có adapter thật ──
  return json({ error: 'billing_webhook_adapter_missing' }, 503)
})
