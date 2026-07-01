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
// Lịch khai giảng — đọc từ bảng class_schedule (thầy quản lý trong /admin → Lịch lớp). Lỗi → rỗng.
async function fetchScheduleText(): Promise<string> {
  try {
    const [{ data: rows }, { data: cs }] = await Promise.all([
      db.from('class_schedule').select('code,name,section,schedule,start_text,price,course_ids,main_course_id').eq('is_active', true).order('sort_order'),
      db.from('edu_courses').select('id,name,code,track'),
    ])
    const byId: Record<string, any> = {}; (cs ?? []).forEach((c: any) => { byId[c.id] = c })
    const all = (rows ?? []) as any[]
    const label = (r: any): string => {
      const linked = (r.course_ids ?? []).map((id: string) => byId[id]).filter(Boolean)
      const coded = linked.filter((c: any) => c.code && c.code !== 'NM')
      const main = byId[r.main_course_id] ?? coded[0]
      const nl = main?.code ? (TEN_NANG_LUC[main.code] ?? main.code) : (TRACK_VI[main?.track] ?? 'Guitar')
      return `- ${main?.name ?? r.name} (${nl})${r.schedule ? ' · ' + r.schedule : ''}${r.start_text ? ' · khai giảng ' + r.start_text : ''}${r.price ? ' · ' + r.price : ''}`
    }
    const upcoming = all.filter((r) => r.section === 'upcoming').map(label)
    const activeCount = all.filter((r) => r.section === 'active' || r.section === 'smallgroup' || r.section === 'oneonone').length
    const lines: string[] = []
    if (upcoming.length) lines.push(`LỚP SẮP KHAI GIẢNG (lịch thật, được phép tư vấn):\n${upcoming.join('\n')}`)
    if (activeCount) lines.push(`Hiện có khoảng ${activeCount} lớp đang hoạt động — bằng chứng lớp học sôi nổi.`)
    if (!lines.length) return ''
    return `\n\n========== LỊCH KHAI GIẢNG THẬT (cập nhật trực tiếp) ==========\n${lines.join('\n\n')}\n\nĐược phép tư vấn khách về các lớp SẮP KHAI GIẢNG ở trên. Lớp/lịch không có trong danh sách này, hoặc cần chốt chỗ → mời khách nhắn Zalo thầy Văn Anh (zalo.me/vananhguitarist).`
  } catch { return '' }
}

// ── MỨC 1: Danh mục khoá học THẬT (công khai) — để Mira tư vấn đúng khoá/lộ trình ──
const TRACK_VI: Record<string, string> = { dem_hat: 'Đệm hát', tia_not: 'Tỉa nốt', nhac_ly: 'Nhạc lý', nhap_mon: 'Nhập môn', solo: 'Solo', cam_am: 'Cảm âm' }
const TEN_NANG_LUC: Record<string, string> = {
  NM: 'Nhập môn', DH1: 'Đệm hát 1', DH2: 'Đệm hát 2', DH3: 'Đệm hát 3', DHNC: 'Đệm hát nâng cao',
  TN1: 'Tỉa nốt 1', TN2: 'Tỉa nốt 2', TN3: 'Tỉa nốt 3', NL1: 'Nhạc lý 1', NL2: 'Nhạc lý 2', NL3: 'Nhạc lý 3', SOLO: 'Solo Guitar',
}
// Luật Hành trình 2027 (gọn) — để Mira tư vấn đúng lộ trình cho khách.
const HANHTRINH_RULES = `\n\n========== LỘ TRÌNH HÀNH TRÌNH 2027 (dùng để tư vấn lộ trình học) ==========
Bản đồ: NHẬP MÔN (free) → 3 nhánh ngang hàng: ĐỆM HÁT (1→2→3) · TỈA NỐT (1→2→3) · NHẠC LÝ (1→2→3) → ĐỆM HÁT NÂNG CAO → SOLO GUITAR.
Điều kiện học: học Đệm hát 2 cần xong Đệm hát 1 + Nhạc lý 1; Đệm hát 3 cần Đệm hát 2 + Nhạc lý 2; Tỉa nốt 2 cần Tỉa nốt 1 + Nhạc lý 1; Tỉa nốt 3 cần Tỉa nốt 2 + Nhạc lý 2. Nâng cao cần đủ Đệm 1-3 + Tỉa 1-3 + Nhạc lý 1-2. Solo cần Nâng cao.
Ai mới bắt đầu → khuyên học Nhập môn (miễn phí) trước, rồi chọn nhánh Đệm hát / Tỉa nốt (kèm Nhạc lý 1 làm nền).`
async function fetchCatalogText(): Promise<string> {
  try {
    const { data } = await db.from('edu_courses')
      .select('name,code,type,track,is_free,sort_order,status').order('sort_order')
    const cs = (data ?? []).filter((c: any) => (c.status ?? 'on') !== 'off')
    if (!cs.length) return ''
    const lines = cs.map((c: any) => {
      const nl = c.code && TEN_NANG_LUC[c.code] ? ` (${TEN_NANG_LUC[c.code]})` : ` [${TRACK_VI[c.track] ?? c.track ?? '—'}]`
      return `- ${c.code ? '[' + c.code + '] ' : ''}${c.name}${nl}${c.is_free ? ' · miễn phí' : ' · trả phí'}`
    })
    return `\n\n========== DANH MỤC KHOÁ HỌC THẬT (mã năng lực + tên) ==========\n${lines.join('\n')}\n\nDùng để tư vấn khoá/cấp độ theo lộ trình. Không bịa khoá ngoài danh sách.`
  } catch { return '' }
}

// ── MỨC 2: Hồ sơ RIÊNG của học sinh ĐANG ĐĂNG NHẬP — xác thực token, chỉ đọc dữ liệu của chính họ ──
async function fetchStudentText(authHeader: string): Promise<string> {
  try {
    const token = (authHeader || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return ''
    const { data: ures } = await db.auth.getUser(token)   // xác thực: token giả → null
    const uid = ures?.user?.id
    if (!uid) return ''                                   // không đăng nhập → bỏ qua (chỉ mức 1)
    const { data: stu } = await db.from('edu_students')
      .select('id,full_name,display_name,level').eq('user_id', uid).maybeSingle()
    if (!stu) return ''
    const sid = (stu as any).id
    const [{ data: enr }, { data: acc }, { data: xp }] = await Promise.all([
      db.from('edu_enrollments').select('course:edu_courses(id,name,is_free,sort_order)').eq('student_id', sid).eq('is_active', true),
      db.from('edu_course_access').select('course_id').eq('student_id', sid).eq('active', true),
      db.from('student_xp_log').select('xp').eq('student_id', sid),
    ])
    const accSet = new Set((acc ?? []).map((a: any) => a.course_id))
    const courses = (enr ?? []).map((e: any) => e.course).filter(Boolean)
      .sort((a: any, b: any) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
    const opened = courses.filter((c: any) => c.is_free !== false || accSet.has(c.id)).map((c: any) => c.name)
    const locked = courses.filter((c: any) => c.is_free === false && !accSet.has(c.id)).map((c: any) => c.name)
    const totalXP = (xp ?? []).reduce((s: number, r: any) => s + (r.xp ?? 0), 0)
    const nm = (stu as any).display_name || (stu as any).full_name || 'bạn'
    return `\n\n========== HỒ SƠ HỌC SINH ĐANG ĐĂNG NHẬP (CHỈ của người này) ==========\n`
      + `- Tên: ${nm}\n- Trình độ: ${(stu as any).level ?? 'mới bắt đầu'}\n`
      + `- Khoá ĐÃ MỞ: ${opened.join(', ') || '(chưa có)'}\n`
      + `- Khoá CHƯA MỞ (cần đăng ký để mở): ${locked.join(', ') || '(không)'}\n`
      + `- Tổng điểm XP: ${totalXP}\n`
      + `QUY TẮC: Dùng hồ sơ này để đồng hành cá nhân — gọi tên, khen tiến độ, gợi ý khoá/bài KẾ TIẾP theo lộ trình, nhắc khoá chưa mở thì đăng ký ở mục Lịch để thầy duyệt. TUYỆT ĐỐI không bịa, không nói về học sinh khác.`
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
  // Dữ liệu sống: lịch (sheet) + danh mục khoá (mức 1) + hồ sơ người đang đăng nhập (mức 2, xác thực token)
  const [scheduleText, catalogText, studentText] = await Promise.all([
    fetchScheduleText(),
    fetchCatalogText(),
    fetchStudentText(req.headers.get('Authorization') || ''),
  ])
  const system = persona
    + (knowledge ? `\n\n========== KIẾN THỨC THAM KHẢO (dùng để trả lời, không bịa ngoài đây) ==========\n${knowledge}` : '')
    + HANHTRINH_RULES + catalogText + scheduleText + studentText

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
