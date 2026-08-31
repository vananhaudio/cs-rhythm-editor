// Edge function: send-mail
// Gửi email qua Resend API — dùng chung RESEND_API_KEY có sẵn trong Supabase.
// v2: thêm X-ChatMail-Thread-Id header để nhận diện reply.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
if (!SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY env var')

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function buildHtml(content: string, subject: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:24px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><tr><td style="background:#0068ff;padding:24px 32px;text-align:center"><h1 style="color:#fff;margin:0;font-size:20px">🎵 Văn Anh Audio</h1></td></tr><tr><td style="padding:24px 32px"><h2 style="margin:0 0 16px;font-size:18px;color:#1a1a1a">${subject}</h2>${content.replace(/\n/g, '<br>')}</td></tr><tr><td style="background:#FAFAFA;padding:16px 32px;border-top:1px solid #E4E4E7"><p style="font-size:12px;color:#71717A;margin:0;text-align:center">© Văn Anh Audio</p></td></tr></table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // HARDEN v9: KHÔNG còn public-sendable — phải có x-internal-secret đúng (server-side only)
  const INTERNAL_SECRET = Deno.env.get('MAIL_INTERNAL_SECRET') ?? ''
  if (!INTERNAL_SECRET || req.headers.get('x-internal-secret') !== INTERNAL_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  try {
    const body = await req.json()
    const { subject, content, recipients, from_email, thread_id } = body as {
      subject: string
      content: string
      recipients: string[]
      from_email?: string
      thread_id?: string
    }

    if (!subject || !content || !recipients?.length) {
      return new Response(JSON.stringify({ error: 'Thiếu subject, content hoặc recipients' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const from = from_email || 'Văn Anh Audio <info@vananhaudio.com>'
    const html = buildHtml(content, subject)
    const results: { email: string; ok: boolean; error?: string; resend_id?: string }[] = []

    // Build headers — include thread_id for reply tracking
    const headers: Record<string, string> = {}
    if (thread_id) {
      headers['X-ChatMail-Thread-Id'] = thread_id
    }

    // Gửi từng email
    for (const to of recipients) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from, to: to.trim(), subject, html, headers }),
        })
        const data = await res.json()
        if (res.ok) {
          results.push({ email: to, ok: true, resend_id: data.id })
        } else {
          results.push({ email: to, ok: false, error: data.message || `HTTP ${res.status}` })
        }
      } catch (err: any) {
        results.push({ email: to, ok: false, error: err.message })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
