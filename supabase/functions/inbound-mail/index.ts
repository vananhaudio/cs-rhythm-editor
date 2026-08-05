// Edge function: inbound-mail
// Nhận webhook từ Resend Inbound khi có mail reply → lưu vào chat_mail_messages.
// Cấu hình Resend: Domains → chọn domain → Inbound → Forward Webhook → URL function này.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
if (!SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Resend Inbound webhook payload type
interface InboundEmail {
  from: string
  to: string[]
  subject: string
  html?: string
  text?: string
  headers?: Record<string, string>
  reply_to?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const email: InboundEmail = await req.json()
    console.log('📥 Inbound mail:', email.subject, 'from:', email.from)

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // Lấy thread_id từ custom header
    const threadId = email.headers?.['x-chatmail-thread-id'] || email.headers?.['X-ChatMail-Thread-Id']

    if (!threadId) {
      console.log('⚠️ No X-ChatMail-Thread-Id header — không lưu (mail từ nguồn khác)')
      return new Response(JSON.stringify({ saved: false, reason: 'no thread id' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Kiểm tra thread tồn tại
    const { data: thread, error: threadErr } = await db
      .from('chat_mails')
      .select('id')
      .eq('id', threadId)
      .single()

    if (threadErr || !thread) {
      console.log(`⚠️ Thread ${threadId} không tồn tại`)
      return new Response(JSON.stringify({ saved: false, reason: 'thread not found' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Lấy nội dung text (ưu tiên text, fallback html stripped)
    const content = email.text || (email.html || '').replace(/<[^>]*>/g, '').trim()

    // Lưu reply vào chat_mail_messages
    const { error: insertErr } = await db.from('chat_mail_messages').insert({
      thread_id: threadId,
      to_email: email.from, // người reply
      subject: email.subject || '',
      content: content,
      status: 'sent', // reply đã nhận được = thành công
      direction: 'inbound',
    })

    if (insertErr) {
      console.error('❌ Lỗi lưu reply:', insertErr.message)
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Cập nhật last_at của thread
    await db.from('chat_mails').update({ last_at: new Date().toISOString() }).eq('id', threadId)

    console.log(`✅ Đã lưu reply vào thread ${threadId} từ ${email.from}`)
    return new Response(JSON.stringify({ saved: true, thread_id: threadId }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('❌ inbound-mail error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
