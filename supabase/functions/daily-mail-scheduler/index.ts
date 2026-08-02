// Edge function: daily-mail-scheduler
// Được pg_cron gọi định kỳ. Tìm daily mail đến giờ → gọi sender.
// V2: mandatory internal secret (bỏ fallback)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
if (!SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

const INTERNAL_SECRET = Deno.env.get('DAILY_MAIL_INTERNAL_SECRET')
if (!INTERNAL_SECRET) throw new Error('Missing DAILY_MAIL_INTERNAL_SECRET env var')

const SENDER_URL = `${SUPABASE_URL}/functions/v1/daily-mail-sender`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY)
    const startedAt = Date.now()

    // ── 1. Xử lý mail bị kẹt ở processing > 60 phút → reset về scheduled ──
    //    Lý do: sender có thể crash sau khi Resend nhận request nhưng trước khi
    //    DB update → recipient vẫn pending. Nhờ Idempotency-Key của Resend,
    //    gửi lại không tạo duplicate email thực tế.
    const { error: resetErr } = await db
      .from('daily_mail')
      .update({ status: 'scheduled', updated_at: new Date().toISOString() })
      .eq('status', 'processing')
      .lt('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

    if (resetErr) console.error('⚠️  Lỗi reset stuck mails:', resetErr.message)

    // ── 2. Tìm daily mail đến giờ (idempotent: FOR UPDATE SKIP LOCKED) ──
    const { data: dueMails, error: findErr } = await db.rpc('find_due_daily_mails')

    if (findErr) throw new Error(`Lỗi tìm due mails: ${findErr.message}`)

    if (!dueMails || dueMails.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'Không có mail nào đến giờ' }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    console.log(`🔍 Tìm thấy ${dueMails.length} daily mail đến giờ`)

    const results: any[] = []

    // ── 3. Với mỗi mail → đánh dấu processing → gọi sender ──
    for (const mail of dueMails) {
      console.log(`⏳ Bắt đầu xử lý: ${mail.subject} (${mail.id})`)

      // Đánh dấu processing (idempotent — chỉ khi status=scheduled)
      await db.rpc('mark_daily_mail_processing', { p_id: mail.id })

      // Gọi sender edge function với internal secret
      try {
        const senderRes = await fetch(SENDER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          body: JSON.stringify({ daily_mail_id: mail.id }),
        })

        const senderBody = await senderRes.json()

        if (senderRes.ok) {
          results.push({ id: mail.id, subject: mail.subject, status: 'success', ...senderBody })
          console.log(`   ✅ ${mail.subject}: ${senderBody.sent || 0} sent`)
        } else {
          results.push({ id: mail.id, subject: mail.subject, status: 'sender_error', error: senderBody.error })
          console.error(`   ❌ ${mail.subject}: sender error — ${senderBody.error}`)
        }
      } catch (fetchErr: any) {
        results.push({ id: mail.id, subject: mail.subject, status: 'fetch_error', error: fetchErr.message })
        console.error(`   ❌ ${mail.subject}: fetch error — ${fetchErr.message}`)
      }
    }

    const elapsed = Date.now() - startedAt
    console.log(`🏁 Hoàn tất scheduler trong ${elapsed}ms — ${results.length} mail đã xử lý`)

    return new Response(JSON.stringify({
      processed: results.length,
      elapsed_ms: elapsed,
      results,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('❌ daily-mail-scheduler error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
