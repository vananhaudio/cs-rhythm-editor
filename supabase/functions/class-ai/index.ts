// Edge Function: class-ai
// Trợ lý AI tư vấn tuyển sinh cho khách (ẩn danh) trên trang /class.
// Giữ khoá Anthropic + service_role ở server. Ghi toàn bộ hội thoại để thầy xem/huấn luyện.
// DEPLOY: Supabase Dashboard → Edge Functions → class-ai → BẬT "Verify JWT" = TẮT (anon gọi được).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const MAX_MSG_LEN = 1200        // chặn tin nhắn quá dài
const MAX_SESSION_MSGS = 60     // chặn 1 phiên spam quá nhiều
const HISTORY = 20              // số tin gần nhất đưa vào ngữ cảnh

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const db = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Lịch khai giảng THẬT từ Google Sheet (cùng nguồn với trang /class) ──
const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/17x2Uhw6iDqS13mbOPRVNGyh8D8clmYHIjAKyO4ShOe8/gviz/tq?tqx=out:csv&gid=602951409&headers=0'
function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else { if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = '' } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' } else if (c === '\r') { /* skip */ } else cur += c }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row) }
  return rows
}
// Trả về đoạn text mô tả lịch khai giảng + số lớp đang học (bằng chứng xã hội). Lỗi → chuỗi rỗng.
async function fetchScheduleText(): Promise<string> {
  try {
    const res = await fetch(SHEET_CSV, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return ''
    const rows = parseCSV(await res.text())
    const up = (s: string) => (s || '').trim().toUpperCase()
    const norm = (s: string) => (s || '').trim()
    const upcoming: string[] = []
    let activeCount = 0, oneOnOne = 0
    let section: 'active' | 'upcoming' | 'oneonone' | 'smallgroup' = 'active'
    for (let r = 0; r < rows.length; r++) {
      const a = norm(rows[r][0]); if (!a) continue
      const A = up(a)
      if (r === 0 && A === 'LỚP') continue
      if (A.includes('SẮP KHAI GIẢNG')) { section = 'upcoming'; continue }
      if (A.includes('KÈM 1')) { section = 'oneonone'; continue }
      if (A.includes('NHÓM NHỎ')) { section = 'smallgroup'; continue }
      if (A === 'LỚP' || A === 'MÃ SỐ LỚP HỌC') continue
      const schedule = norm(rows[r][2]); const start = norm(rows[r][3])
      if (section === 'oneonone') { oneOnOne++; continue }
      if (section === 'smallgroup') { activeCount++; continue }
      if (section === 'upcoming') upcoming.push(`- ${a}${schedule ? ` · lịch: ${schedule}` : ''}${start ? ` · khai giảng: ${start}` : ''}`)
      else activeCount++
    }
    const lines: string[] = []
    if (upcoming.length) lines.push(`LỚP SẮP KHAI GIẢNG (lịch thật, được phép dùng để tư vấn):\n${upcoming.join('\n')}`)
    const totalActive = activeCount + oneOnOne
    if (totalActive) lines.push(`Hiện có khoảng ${totalActive} lớp đang hoạt động (gồm lớp nhóm và lớp 1 kèm 1) — bằng chứng lớp học sôi nổi. KHÔNG tiết lộ tên học viên lớp 1 kèm 1.`)
    if (!lines.length) return ''
    return `\n\n========== LỊCH KHAI GIẢNG THẬT (cập nhật trực tiếp hôm nay) ==========\n${lines.join('\n\n')}\n\nQuy tắc dùng lịch: được phép trả lời khách về các lớp SẮP KHAI GIẢNG ở trên. Nếu khách hỏi lớp/lịch KHÔNG có trong danh sách này, hoặc cần chốt chỗ, mời khách nhắn Zalo thầy Văn Anh (zalo.me/vananhguitarist).`
  } catch { return '' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let body: { sessionId?: string; message?: string }
  try { body = await req.json() } catch { return json({ error: 'Body không hợp lệ' }, 400) }

  const message = (body.message || '').trim()
  if (!message) return json({ error: 'Thiếu nội dung' }, 400)
  if (message.length > MAX_MSG_LEN) return json({ error: 'Tin nhắn quá dài' }, 400)

  // Cấu hình AI
  const { data: cfg } = await db.from('class_ai_config').select('*').eq('id', 1).single()
  if (cfg && cfg.enabled === false) {
    return json({ reply: 'Hiện trợ lý đang tạm nghỉ. Bạn vui lòng nhắn Zalo thầy Văn Anh (zalo.me/vananhguitarist) để được hỗ trợ nhé.', sessionId: body.sessionId ?? null })
  }
  const model = cfg?.model || 'claude-sonnet-4-6'
  const persona = cfg?.persona || 'Bạn là trợ lý tư vấn tuyển sinh lớp guitar của thầy Văn Anh. Trả lời tiếng Việt, ngắn gọn, thân thiện. Không chắc thì mời khách nhắn Zalo thầy.'

  // Phiên: tạo mới nếu chưa có
  let sessionId = body.sessionId || ''
  if (!sessionId) {
    const { data: s } = await db.from('class_chat_sessions').insert({}).select('id').single()
    sessionId = s?.id
  }
  if (!sessionId) return json({ error: 'Không tạo được phiên' }, 500)

  // Lịch sử + chặn spam
  const { data: hist, count } = await db.from('class_chat_messages')
    .select('role,content', { count: 'exact' })
    .eq('session_id', sessionId).order('created_at', { ascending: true })
  if ((count ?? 0) > MAX_SESSION_MSGS) {
    return json({ reply: 'Cuộc trò chuyện đã khá dài. Để được hỗ trợ kỹ hơn, bạn nhắn Zalo thầy Văn Anh (zalo.me/vananhguitarist) nhé!', sessionId })
  }

  // Ghi tin của khách
  await db.from('class_chat_messages').insert({ session_id: sessionId, role: 'user', content: message })

  // Kiến thức huấn luyện (thầy nạp)
  const { data: kn } = await db.from('class_ai_knowledge').select('title,content').eq('enabled', true).order('order_index')
  const knowledge = (kn ?? []).map((k) => `### ${k.title}\n${k.content}`).join('\n\n')
  const scheduleText = await fetchScheduleText()  // lịch khai giảng thật (rỗng nếu lỗi)
  const system = persona
    + (knowledge ? `\n\n========== KIẾN THỨC THAM KHẢO (dùng để trả lời, không bịa ngoài đây) ==========\n${knowledge}` : '')
    + scheduleText

  // Dựng messages cho Anthropic (role: user / assistant)
  const recent = (hist ?? []).slice(-HISTORY)
  const aiMessages = [...recent.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    { role: 'user', content: message }]

  let reply = ''
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 700, system, messages: aiMessages }),
    })
    if (!res.ok) {
      const t = await res.text()
      console.error('Anthropic error', res.status, t)
      reply = 'Xin lỗi, trợ lý đang bận một chút. Bạn thử lại hoặc nhắn Zalo thầy Văn Anh (zalo.me/vananhguitarist) nhé.'
    } else {
      const data = await res.json()
      reply = (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
        || 'Bạn có thể nói rõ hơn một chút không?'
    }
  } catch (e) {
    console.error('class-ai exception', e)
    reply = 'Xin lỗi, có lỗi kết nối. Bạn nhắn Zalo thầy Văn Anh (zalo.me/vananhguitarist) giúp mình nhé.'
  }

  // Ghi tin của AI + cập nhật phiên
  await db.from('class_chat_messages').insert({ session_id: sessionId, role: 'ai', content: reply })
  await db.from('class_chat_sessions').update({ last_at: new Date().toISOString() }).eq('id', sessionId)

  return json({ reply, sessionId })
})
