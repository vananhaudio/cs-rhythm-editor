// Edge function: daily-mail-sender
// Gửi email hàng loạt qua Resend API với batch processing
//
// V5: TEST AUDIENCE SAFETY + 409 classification + HMAC-SHA-256 + mandatory secrets
//
// Resend Idempotency-Key (verified against official docs 2026-08-02):
//   - Supported on POST /emails and POST /emails/batch
//   - Key retention: 24 hours (source: resend.com/docs/dashboard/emails/idempotency-keys)
//   - Max key length: 256 chars
//   - Same key + different payload → 409 invalid_idempotent_request → FAILED (invariant violation)
//   - Concurrent same-key requests → 409 concurrent_idempotent_requests → KEEP PENDING (retry)
//   - Our retry window: 60 min (scheduler resets processing→scheduled) << 24h → SAFE
//   - Key format: dm_{daily_mail_id}_{student_id} (~70 chars, well within 256 limit)
//
// 409 State Machine:
//   pending ──┬── Resend 200 ──────────► sent (+ resend_id)
//             ├── Resend 409 concurrent ─► pending (giữ nguyên, retry lần sau)
//             ├── Resend 409 invalid ────► failed [INVARIANT] payload mismatch
//             └── Network/other error ───► failed
//
// Payload immutability:
//   Daily mail content MUST NOT change after status → 'processing'.
//   UI locks editing for non-draft status.
//
// TEST AUDIENCE SAFETY:
//   audience_type = 'test'      → backend CHỈ gửi tới test_emails (max 10)
//   audience_type = 'all_active' → backend gọi get_daily_mail_recipients()
//   NULL / invalid              → FAIL CLOSED, gửi 0 email
//   test_emails rỗng            → FAIL SAFE, gửi 0 email

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
if (!SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY env var')

const FROM_EMAIL = Deno.env.get('DAILY_MAIL_FROM_EMAIL') || 'mail@vananhaudio.com'
const FROM_NAME = Deno.env.get('DAILY_MAIL_FROM_NAME') || 'TVA Guitar'

const INTERNAL_SECRET = Deno.env.get('DAILY_MAIL_INTERNAL_SECRET')
if (!INTERNAL_SECRET) throw new Error('Missing DAILY_MAIL_INTERNAL_SECRET env var')

const BATCH_SIZE = 10
const BASE_URL = Deno.env.get('DAILY_MAIL_BASE_URL') || 'https://class.vananhaudio.com'
const MAX_TEST_EMAILS = 10  // hard limit for test audience

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── HMAC-SHA-256 unsubscribe token ──
async function generateUnsubscribeToken(dailyMailId: string, studentId: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(INTERNAL_SECRET)
  const message = encoder.encode(`${dailyMailId}:${studentId}`)
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message)
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── HTML email template ──
function buildEmailHtml(content: string, ctaText?: string, ctaUrl?: string, unsubscribeToken?: string | null): string {
  const ctaBlock = ctaText && ctaUrl
    ? `<div style="text-align:center;margin:24px 0"><a href="${ctaUrl}" target="_blank" style="display:inline-block;background:#4F46E5;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600">${ctaText}</a></div>`
    : ''
  const unsubBlock = unsubscribeToken
    ? `<p style="font-size:12px;color:#999;margin-top:32px;text-align:center">Bạn nhận email này vì là học viên của TVA Guitar.<br><a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color:#999;text-decoration:underline">Huỷ nhận Daily Mail</a></p>`
    : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:24px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><tr><td style="background:#4F46E5;padding:24px 32px;text-align:center"><h1 style="color:#fff;margin:0;font-size:20px">🎸 TVA Guitar</h1></td></tr><tr><td style="padding:32px">${content}${ctaBlock}</td></tr><tr><td style="background:#FAFAFA;padding:16px 32px;border-top:1px solid #E4E4E7"><p style="font-size:12px;color:#71717A;margin:0;text-align:center">© TVA Guitar — Học · Tập · Sống cùng Âm nhạc</p>${unsubBlock}</td></tr></table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const secret = req.headers.get('x-internal-secret')
  if (secret !== INTERNAL_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  try {
    const { daily_mail_id } = await req.json()
    if (!daily_mail_id) throw new Error('Thiếu daily_mail_id')

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── 1. Lấy daily_mail ──
    const { data: mail, error: mailErr } = await db.from('daily_mail').select('*').eq('id', daily_mail_id).single()
    if (mailErr || !mail) throw new Error(`Không tìm thấy daily_mail: ${mailErr?.message}`)

    if (mail.status !== 'processing') {
      return new Response(JSON.stringify({ skipped: true, reason: `Status is "${mail.status}", not processing` }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    console.log(`📨 Daily Mail: ${mail.subject} (${mail.id}) · audience_type=${mail.audience_type}`)

    // ═══════════════════════════════════════════════════════════
    // 2. AUDIENCE RESOLUTION — BACKEND ENFORCEMENT
    //    FAIL CLOSED: NULL/invalid → 0 emails
    //    TEST: only test_emails whitelist (max 10)
    //    ALL_ACTIVE: full edu_students query
    // ═══════════════════════════════════════════════════════════
    const VALID_TYPES = ['test', 'all_active']
    if (!mail.audience_type || !VALID_TYPES.includes(mail.audience_type)) {
      console.error(`❌ FAIL CLOSED: invalid audience_type="${mail.audience_type}"`)
      await db.rpc('mark_daily_mail_failed', { p_id: daily_mail_id })
      return new Response(JSON.stringify({ sent: 0, total: 0, error: `Invalid audience_type: "${mail.audience_type}". Must be "test" or "all_active".` }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    let students: { student_id: string | null; email: string; student_name: string }[] = []

    if (mail.audience_type === 'test') {
      // ── TEST MODE: backend-enforced whitelist ──
      const testList: string[] = (mail.test_emails || []).filter((e: string) => e && e.includes('@'))
      if (testList.length === 0) {
        console.warn('⚠️  TEST mode: test_emails empty, sending 0')
        await db.rpc('mark_daily_mail_sent', { p_id: daily_mail_id })
        return new Response(JSON.stringify({ sent: 0, total: 0, message: 'TEST mode: test_emails is empty. 0 emails sent.' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
      }
      if (testList.length > MAX_TEST_EMAILS) {
        console.error(`❌ TEST mode: ${testList.length} emails exceeds max ${MAX_TEST_EMAILS}`)
        await db.rpc('mark_daily_mail_failed', { p_id: daily_mail_id })
        return new Response(JSON.stringify({ sent: 0, total: 0, error: `TEST mode limited to ${MAX_TEST_EMAILS} emails. Got ${testList.length}.` }), { headers: { ...cors, 'Content-Type': 'application/json' } })
      }
      students = testList.map((email: string) => ({ student_id: null, email: email.trim().toLowerCase(), student_name: email.trim() }))
      console.log(`🧪 TEST mode: ${students.length} recipients from whitelist`)

      // Xoá test recipients cũ (không upsert được vì student_id=NULL → unique constraint không hoạt động)
      await db.from('daily_mail_recipient').delete().eq('daily_mail_id', daily_mail_id).is('student_id', null)
    } else {
      // ── ALL_ACTIVE MODE: toàn bộ học sinh active ──
      const { data: active, error: stuErr } = await db.rpc('get_daily_mail_recipients', { p_daily_mail_id: daily_mail_id })
      if (stuErr) throw new Error(`Lỗi lấy học sinh: ${stuErr.message}`)
      students = (active || []).map((s: any) => ({ student_id: s.student_id, email: s.email, student_name: s.student_name }))
      console.log(`📢 ALL_ACTIVE mode: ${students.length} students`)
    }

    if (students.length === 0) {
      await db.rpc('mark_daily_mail_sent', { p_id: daily_mail_id })
      return new Response(JSON.stringify({ sent: 0, total: 0, message: `audience_type=${mail.audience_type}: 0 recipients.` }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ── 3. Tạo recipient records ──
    const recipientRows: any[] = []
    for (const s of students) {
      const token = s.student_id ? await generateUnsubscribeToken(daily_mail_id, s.student_id) : null
      recipientRows.push({ daily_mail_id, student_id: s.student_id, email: s.email, student_name: s.student_name, unsubscribe_token: token, status: 'pending' })
    }

    if (mail.audience_type === 'all_active') {
      for (let i = 0; i < recipientRows.length; i += 100) {
        const batch = recipientRows.slice(i, i + 100)
        const { error: insErr } = await db.from('daily_mail_recipient').upsert(batch, { onConflict: 'daily_mail_id,student_id', ignoreDuplicates: true })
        if (insErr) console.error(`Lỗi upsert batch ${i}:`, insErr.message)
      }
    } else {
      for (let i = 0; i < recipientRows.length; i += 100) {
        const batch = recipientRows.slice(i, i + 100)
        const { error: insErr } = await db.from('daily_mail_recipient').insert(batch)
        if (insErr) console.error(`Lỗi insert test batch ${i}:`, insErr.message)
      }
    }

    // ── 4. Lấy pending recipients ──
    const { data: pendingList, error: pendErr } = await db.from('daily_mail_recipient').select('id,email,student_id,student_name,unsubscribe_token').eq('daily_mail_id', daily_mail_id).eq('status', 'pending')
    if (pendErr) throw new Error(`Lỗi lấy pending: ${pendErr.message}`)
    if (!pendingList || pendingList.length === 0) {
      await db.rpc('mark_daily_mail_sent', { p_id: daily_mail_id })
      return new Response(JSON.stringify({ sent: 0, total: students.length, message: 'Tất cả đã gửi trước đó' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const totalPending = pendingList.length
    let sentCount = 0
    let failCount = 0
    console.log(`✉️  Gửi ${totalPending} email (batch ${BATCH_SIZE})`)

    // ── 5. Gửi batch với Idempotency-Key ──
    const from = `${FROM_NAME} <${FROM_EMAIL}>`

    for (let i = 0; i < pendingList.length; i += BATCH_SIZE) {
      const batch = pendingList.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(batch.map(async (rec: any) => {
        const idempotencyKey = `dm_${daily_mail_id}_${rec.student_id || rec.id}`
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
            body: JSON.stringify({
              from, to: rec.email, subject: mail.subject,
              html: buildEmailHtml(mail.content, mail.cta_text, mail.cta_url, rec.unsubscribe_token),
              headers: rec.unsubscribe_token ? { 'List-Unsubscribe': `<${BASE_URL}/unsubscribe?token=${rec.unsubscribe_token}>` } : undefined,
            }),
          })
          const body = await res.json()
          if (!res.ok) {
            const errorName = body.name || ''
            const errorMsg = body.message || `HTTP ${res.status}`
            if (res.status === 409) {
              if (errorName === 'concurrent_idempotent_requests') {
                console.warn(`   🔄 concurrent for ${rec.email}, keeping pending`)
                return { recipient_id: rec.id, retry: true, ok: false, error: errorMsg }
              }
              if (errorName === 'invalid_idempotent_request') {
                console.error(`   ❌ invalid_idempotent_request for ${rec.email}: payload mismatch`)
                return { recipient_id: rec.id, retry: false, ok: false, error: `[INVARIANT] ${errorMsg}` }
              }
            }
            return { recipient_id: rec.id, retry: false, ok: false, error: errorMsg }
          }
          return { recipient_id: rec.id, resend_id: body.id, ok: true }
        } catch (err: any) {
          return { recipient_id: rec.id, retry: false, ok: false, error: err.message }
        }
      }))

      // ── 6. Update status ──
      const successUpdates: any[] = []
      const failUpdates: any[] = []
      let retryCount = 0

      results.forEach((r) => {
        const val = r.status === 'fulfilled' ? r.value : null
        const err = r.status === 'rejected' ? r.reason : null
        if (val?.ok) {
          successUpdates.push({ id: val.recipient_id, status: 'sent', resend_id: val.resend_id, sent_at: new Date().toISOString() })
          sentCount++
        } else if (val?.retry) {
          retryCount++
        } else {
          const errMsg = val?.error || err?.message || 'Unknown error'
          const recId = val?.recipient_id || err?.recipient_id || ''
          failUpdates.push({ id: recId, status: 'failed', error: errMsg })
          if (recId) failCount++
        }
      })

      for (const u of successUpdates) {
        await db.from('daily_mail_recipient').update({ status: u.status, resend_id: u.resend_id, sent_at: u.sent_at }).eq('id', u.id)
      }
      for (const u of failUpdates) {
        if (u.id) await db.from('daily_mail_recipient').update({ status: u.status, error: u.error }).eq('id', u.id)
      }
      console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${successUpdates.length} sent, ${retryCount} retry, ${failUpdates.length} failed`)
    }

    await db.rpc('mark_daily_mail_sent', { p_id: daily_mail_id })
    const result = { daily_mail_id, subject: mail.subject, audience_type: mail.audience_type, total: students.length, sent: sentCount, failed: failCount, pending_remaining: totalPending - sentCount - failCount }
    console.log(`✅ ${sentCount} sent, ${failCount} failed`)
    return new Response(JSON.stringify(result), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('❌ sender error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
