// Edge Function: admin-ai
// Trợ lý AI trong admin: THẦY chat → AI ĐỀ XUẤT tài khoản học sinh → THẦY DUYỆT → mới tạo.
// Giữ khoá Claude + service_role ở server (không bao giờ lộ ra client).
// Chỉ teacher/admin gọi được (verify JWT + role). AI không tự tạo — luôn qua bước thầy xác nhận.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL = 'claude-haiku-4-5' // việc nhẹ + có bước thầy duyệt nên dùng model rẻ; đổi sang sonnet/opus nếu cần

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const SYSTEM = `Bạn là trợ lý trong trang quản trị của hệ thống dạy guitar (thầy Văn Anh).
Việc của bạn: giúp THẦY tạo tài khoản cho HỌC SINH. Trả lời bằng tiếng Việt, ngắn gọn, thân thiện.
Khi đã đủ thông tin (tối thiểu là email mỗi học sinh; tên có thể suy từ email nếu thầy không cho), hãy gọi công cụ propose_students để ĐỀ XUẤT danh sách.
TUYỆT ĐỐI không nói "đã tạo xong" — bạn chỉ ĐỀ XUẤT, chính thầy mới bấm xác nhận để tạo. Thiếu thông tin thì hỏi lại thầy.`

const TOOLS = [{
  name: 'propose_students',
  description: 'Đề xuất danh sách học sinh để thầy duyệt rồi tạo tài khoản. KHÔNG tạo ngay.',
  input_schema: {
    type: 'object',
    properties: {
      students: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'email đăng nhập của học sinh' },
            full_name: { type: 'string', description: 'họ tên; nếu thầy không cho thì suy từ email' },
            password: { type: 'string', description: 'mật khẩu nếu thầy chỉ định; bỏ trống để hệ thống tự sinh' },
          },
          required: ['email'],
        },
      },
    },
    required: ['students'],
  },
}]

async function requireTeacher(req: Request) {
  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  if (!jwt) return { error: json({ error: 'Chưa đăng nhập' }, 401) }
  // uid LẤY TỪ JWT đã verify chữ ký — không tin uid/role do client gửi
  const anon = createClient(SUPABASE_URL, ANON_KEY)
  const { data: { user }, error } = await anon.auth.getUser(jwt)
  if (error || !user) return { error: json({ error: 'Phiên không hợp lệ' }, 401) }
  // role luôn query bằng service_role (bỏ qua RLS) để chắc chắn
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: au } = await admin.from('app_users').select('role').eq('id', user.id).single()
  if (!au || !['teacher', 'admin'].includes(au.role)) return { error: json({ error: 'Không có quyền' }, 403) }
  return { user, admin }
}

function genPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = new Uint32Array(10); crypto.getRandomValues(arr)
  return Array.from(arr, (n) => chars[n % chars.length]).join('')
}

async function chat(messages: unknown[]) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, tools: TOOLS, messages }),
  })
  if (!res.ok) return { reply: 'Lỗi gọi AI: ' + (await res.text()), proposal: null }
  const data = await res.json()
  let reply = '', proposal = null
  for (const block of data.content ?? []) {
    if (block.type === 'text') reply += block.text
    if (block.type === 'tool_use' && block.name === 'propose_students') proposal = block.input.students
  }
  return { reply: reply.trim(), proposal }
}

// Tạo tài khoản học sinh — TÁI HIỆN đúng flow StudentOnboarding (KHÔNG ghi app_users)
async function createStudents(admin: ReturnType<typeof createClient>, students: any[]) {
  const { data: courses } = await admin.from('edu_courses').select('id')
  const courseIds = (courses ?? []).map((c: any) => c.id)
  const results: any[] = []
  for (const s of students) {
    const email = (s.email || '').trim().toLowerCase()
    if (!email) { results.push({ email: s.email, ok: false, error: 'thiếu email' }); continue }
    const password = (s.password || '').trim() || genPassword()
    const full_name = (s.full_name || '').trim() || email.split('@')[0]
    try {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (cErr || !created?.user) throw new Error(cErr?.message || 'không tạo được tài khoản đăng nhập')
      const uid = created.user.id
      const { data: st, error: sErr } = await admin.from('edu_students')
        .upsert({ user_id: uid, full_name, email, is_active: true, level: 'beginner', enrolled_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .select('id').single()
      if (sErr) throw new Error('tạo hồ sơ học sinh lỗi: ' + sErr.message)
      if (courseIds.length) {
        const rows = courseIds.map((cid: string) => ({ student_id: st.id, course_id: cid, enrolled_by: uid, is_active: true }))
        await admin.from('edu_enrollments').upsert(rows, { onConflict: 'student_id,course_id', ignoreDuplicates: true })
      }
      results.push({ email, full_name, password, ok: true })
    } catch (e) {
      results.push({ email, ok: false, error: String((e as Error)?.message || e) })
    }
  }
  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Chỉ chấp nhận POST' }, 405)

  const gate = await requireTeacher(req)
  if ('error' in gate) return gate.error

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Body không hợp lệ' }, 400) }

  if (body.action === 'chat') {
    if (!Array.isArray(body.messages)) return json({ error: 'Thiếu messages' }, 400)
    return json(await chat(body.messages))
  }
  if (body.action === 'create') {
    if (!Array.isArray(body.students) || !body.students.length) return json({ error: 'Thiếu danh sách học sinh' }, 400)
    return json({ results: await createStudents(gate.admin, body.students) })
  }
  return json({ error: "action phải là 'chat' hoặc 'create'" }, 400)
})
