// Edge function: daily-mail-sender
// Gửi email hàng loạt qua Resend API với batch processing
//
// V3: HMAC-SHA-256 token + Idempotency-Key verified + mandatory secrets
//
// Resend Idempotency-Key (verified against official docs 2026-08-02):
//   - Supported on POST /emails and POST /emails/batch
//   - Key retention: 24 hours (source: resend.com/docs/dashboard/emails/idempotency-keys)
//   - Max key length: 256 chars
//   - Same key + different payload → 409 invalid_idempotent_request
//   - Concurrent same-key requests → 409 concurrent_idempotent_requests
//   - Our retry window: 60 min (scheduler resets processing→scheduled) << 24h → SAFE
//   - Key format: dm_{daily_mail_id}_{student_id} (~70 chars, well within 256 limit)

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

const BATCH_SIZE = 10   // gửi đồng thời 10 email/lượt
const BASE_URL = Deno.env.get('DAILY_MAIL_BASE_URL') || 'https://class.vananhaudio.com'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Sinh unsubscribe token: HMAC-SHA-256(key=INTERNAL_SECRET, msg=daily_mail_id:student_id) ──
//     Dùng HMAC thay vì SHA-256 thuần để chống length-extension attack.
//     Output: 64 ký tự hex. Token ổn định cho mỗi cặp (daily_mail_id, student_id).
async function generateUnsubscribeToken(dailyMailId: string, studentId: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(INTERNAL_SECRET)
  const message = encoder.encode(`${dailyMailId}:${studentId}`)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message)
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── HTML template cho email ──
function buildEmailHtml(content: string, ctaText?: string, ctaUrl?: string, unsubscribeToken?: string): string {
  const ctaBlock = ctaText && ctaUrl
    ? `<div style="text-align:center;margin:24px 0">
         <a href="${ctaUrl}" target="_blank" style="display:inline-block;background:#4F46E5;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600">${ctaText}</a>
       </div>`
    : ''

  const unsubBlock = unsubscribeToken
    ? `<p style="font-size:12px;color:#999;margin-top:32px;text-align:center">
         Bạn nhận email này vì là học viên của TVA Guitar.<br>
         <a href="${BASE_URL}/unsubscribe?token=${unsubscribeToken}" style="color:#999;text-decoration:underline">Huỷ nhận Daily Mail</a>
       </p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
  <!-- Header -->
  <tr><td style="background:#4F46E5;padding:24px 32px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:20px">🎸 TVA Guitar</h1>
  </td></tr>
  <!-- Content -->
  <tr><td style="padding:32px">
    ${content}
    ${ctaBlock}
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#FAFAFA;padding:16px 32px;border-top:1px solid #E4E4E7">
    <p style="font-size:12px;color:#71717A;margin:0;text-align:center">© TVA Guitar — Học · Tập · Sống cùng Âm nhạc</p>
    ${unsubBlock}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Auth check — phải có internal secret
  const secret = req.headers.get('x-internal-secret')
  if (secret !== INTERNAL_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { daily_mail_id } = await req.json()
    if (!daily_mail_id) throw new Error('Thiếu daily_mail_id')

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── 1. Lấy thông tin daily_mail ──
    const { data: mail, error: mailErr } = await db
      .from('daily_mail')
      .select('*')
      .eq('id', daily_mail_id)
      .single()

    if (mailErr || !mail) throw new Error(`Không tìm thấy daily_mail: ${mailErr?.message}`)

    // Kiểm tra trạng thái — chỉ gửi khi đang processing
    if (mail.status !== 'processing') {
      return new Response(JSON.stringify({ skipped: true, reason: `Status is "${mail.status}", not processing` }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📨 Bắt đầu gửi Daily Mail: ${mail.subject} (${mail.id})`)

    // ── 2. Lấy danh sách học sinh active có bật email ──
    const { data: students, error: stuErr } = await db.rpc('get_daily_mail_recipients', {
      p_daily_mail_id: daily_mail_id
    })

    if (stuErr) throw new Error(`Lỗi lấy danh sách học sinh: ${stuErr.message}`)
    if (!students || students.length === 0) {
      await db.rpc('mark_daily_mail_sent', { p_id: daily_mail_id })
      return new Response(JSON.stringify({ sent: 0, total: 0, message: 'Không có học sinh nào active' }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    console.log(`👥 ${students.length} học sinh sẽ nhận mail`)

    // ── 3. Tạo recipient records + generate unsubscribe tokens (idempotent — upsert) ──
    const recipientRows: any[] = []
    for (const s of students) {
      const token = await generateUnsubscribeToken(daily_mail_id, s.student_id)
      recipientRows.push({
        daily_mail_id,
        student_id: s.student_id,
        email: s.email,
        student_name: s.student_name,
        unsubscribe_token: token,
        status: 'pending',
      })
    }

    // Upsert từng batch 100 để tránh payload quá lớn
    for (let i = 0; i < recipientRows.length; i += 100) {
      const batch = recipientRows.slice(i, i + 100)
      const { error: insErr } = await db
        .from('daily_mail_recipient')
        .upsert(batch, { onConflict: 'daily_mail_id,student_id', ignoreDuplicates: true })

      if (insErr) console.error(`Lỗi upsert recipients batch ${i}:`, insErr.message)
    }

    // ── 4. Lấy tất cả recipients đang pending ──
    const { data: pendingList, error: pendErr } = await db
      .from('daily_mail_recipient')
      .select('id,email,student_id,student_name,unsubscribe_token')
      .eq('daily_mail_id', daily_mail_id)
      .eq('status', 'pending')

    if (pendErr) throw new Error(`Lỗi lấy pending recipients: ${pendErr.message}`)
    if (!pendingList || pendingList.length === 0) {
      await db.rpc('mark_daily_mail_sent', { p_id: daily_mail_id })
      return new Response(JSON.stringify({ sent: 0, total: students.length, message: 'Tất cả đã được gửi trước đó' }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const totalPending = pendingList.length
    let sentCount = 0
    let failCount = 0

    console.log(`✉️  Bắt đầu gửi ${totalPending} email (batch ${BATCH_SIZE})`)

    // ── 5. Gửi theo batch với Idempotency-Key ──
    //     Resend giữ key trong 24h. Nếu crash → retry (60 phút) vẫn trong window an toàn.
    //     Key dm_{daily_mail_id}_{student_id}: ổn định, unique, <256 chars.
    const from = `${FROM_NAME} <${FROM_EMAIL}>`

    for (let i = 0; i < pendingList.length; i += BATCH_SIZE) {
      const batch = pendingList.slice(i, i + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(async (rec: any) => {
          const idempotencyKey = `dm_${daily_mail_id}_${rec.student_id}`

          try {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': idempotencyKey,
              },
              body: JSON.stringify({
                from,
                to: rec.email,
                subject: mail.subject,
                html: buildEmailHtml(mail.content, mail.cta_text, mail.cta_url, rec.unsubscribe_token),
                headers: {
                  'List-Unsubscribe': `<${BASE_URL}/unsubscribe?token=${rec.unsubscribe_token}>`,
                },
              }),
            })

            const body = await res.json()

            // 409 = idempotency conflict — key đã dùng với payload khác
            // hoặc request gốc đang xử lý. Đều coi là đã gửi (key tồn tại = email đã
            // hoặc đang được xử lý bởi Resend).
            if (!res.ok) {
              if (res.status === 409) {
                console.warn(`   ⚠️  Idempotency conflict for ${rec.email}, treating as sent`)
                return { recipient_id: rec.id, resend_id: idempotencyKey, ok: true }
              }
              throw new Error(body.message || `HTTP ${res.status}`)
            }

            return { recipient_id: rec.id, resend_id: body.id, ok: true }
          } catch (err: any) {
            return { recipient_id: rec.id, error: err.message, ok: false }
          }
        })
      )

      // ── 6. Cập nhật trạng thái NGAY SAU mỗi batch ──
      const successUpdates: any[] = []
      const failUpdates: any[] = []

      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value.ok) {
          successUpdates.push({
            id: r.value.recipient_id,
            status: 'sent',
            resend_id: r.value.resend_id,
            sent_at: new Date().toISOString(),
          })
          sentCount++
        } else {
          const errMsg = r.status === 'fulfilled' ? r.value.error : (r.reason?.message || 'Unknown error')
          failUpdates.push({
            id: r.status === 'fulfilled' ? r.value.recipient_id : (r.reason?.recipient_id || ''),
            status: 'failed',
            error: errMsg,
          })
          failCount++
        }
      })

      // Update success
      if (successUpdates.length > 0) {
        for (const u of successUpdates) {
          await db.from('daily_mail_recipient').update({
            status: u.status,
            resend_id: u.resend_id,
            sent_at: u.sent_at,
          }).eq('id', u.id)
        }
      }

      // Update failures
      if (failUpdates.length > 0) {
        for (const u of failUpdates) {
          if (u.id) {
            await db.from('daily_mail_recipient').update({
              status: u.status,
              error: u.error,
            }).eq('id', u.id)
          }
        }
      }

      console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${successUpdates.length} sent, ${failUpdates.length} failed`)
    }

    // ── 7. Đánh dấu daily_mail hoàn tất ──
    await db.rpc('mark_daily_mail_sent', { p_id: daily_mail_id })

    const result = {
      daily_mail_id,
      subject: mail.subject,
      total: students.length,
      sent: sentCount,
      failed: failCount,
      pending_remaining: totalPending - sentCount - failCount,
    }

    console.log(`✅ Hoàn tất: ${sentCount} sent, ${failCount} failed`)
    return new Response(JSON.stringify(result), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('❌ daily-mail-sender error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
