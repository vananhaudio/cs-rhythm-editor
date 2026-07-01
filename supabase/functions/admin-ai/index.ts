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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const SYSTEM = `Bạn là trợ lý trong trang quản trị của hệ thống dạy guitar (thầy Văn Anh). Trả lời bằng tiếng Việt, ngắn gọn, thân thiện.
Bạn giúp THẦY ba việc:
1) TẠO TÀI KHOẢN học sinh — khi đủ thông tin (tối thiểu email mỗi em; tên suy từ email nếu thầy không cho), gọi công cụ propose_students.
2) GÁN HỌC SINH VÀO NHÓM (Zalo/Facebook) — khi thầy muốn thêm em vào nhóm, gọi công cụ propose_group_add với email học sinh + tên nhóm (khớp danh sách nhóm hiện có ở dưới).
3) ĐẶT LẠI (RESET) MẬT KHẨU — khi thầy muốn đổi/đặt lại mật khẩu cho học sinh (theo email), gọi công cụ propose_reset_password. Kèm mật khẩu mới nếu thầy chỉ định; bỏ trống để hệ thống tự sinh.
4) TẠO / XẾP LỊCH LỚP HỌC — khi thầy muốn mở lớp mới hoặc xếp lịch, gọi công cụ propose_schedule. Mỗi lớp gồm: tên lớp (bắt buộc), mã lớp (nếu có), khối (upcoming=sắp khai giảng / active=đang học / smallgroup / oneonone), lịch (vd "Thứ 3 · 19h00"), ngày khai giảng, thời lượng, học phí, và QUAN TRỌNG: chọn (các) KHOÁ HỌC lớp mở (courseNames) + 1 NHÓM ZALO (groupName) — dùng ĐÚNG tên trong danh sách ở dưới. Thiếu thông tin quan trọng thì hỏi thầy.
TUYỆT ĐỐI không nói "đã xong" — bạn chỉ ĐỀ XUẤT, chính thầy mới bấm xác nhận. Thiếu thông tin thì hỏi lại thầy.`

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
}, {
  name: 'propose_group_add',
  description: 'Đề xuất thêm (các) học sinh vào (các) nhóm để thầy duyệt rồi gán. KHÔNG gán ngay.',
  input_schema: {
    type: 'object',
    properties: {
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            studentEmail: { type: 'string', description: 'email học sinh ĐÃ có tài khoản' },
            groupName: { type: 'string', description: 'tên nhóm, khớp với danh sách nhóm hiện có' },
          },
          required: ['studentEmail', 'groupName'],
        },
      },
    },
    required: ['assignments'],
  },
}, {
  name: 'propose_reset_password',
  description: 'Đề xuất ĐẶT LẠI mật khẩu cho (các) học sinh để thầy duyệt rồi mới đổi. KHÔNG đổi ngay.',
  input_schema: {
    type: 'object',
    properties: {
      resets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            studentEmail: { type: 'string', description: 'email học sinh ĐÃ có tài khoản' },
            password: { type: 'string', description: 'mật khẩu mới nếu thầy chỉ định; bỏ trống để tự sinh' },
          },
          required: ['studentEmail'],
        },
      },
    },
    required: ['resets'],
  },
}, {
  name: 'propose_schedule',
  description: 'Đề xuất tạo/xếp (các) lớp vào lịch để thầy duyệt rồi mới tạo. KHÔNG tạo ngay.',
  input_schema: {
    type: 'object',
    properties: {
      classes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'mã lớp, vd KD11' },
            name: { type: 'string', description: 'tên lớp hiển thị' },
            section: { type: 'string', description: 'upcoming | active | smallgroup | oneonone' },
            schedule: { type: 'string', description: 'lịch, vd "Thứ 3 · 19h00"' },
            start: { type: 'string', description: 'ngày khai giảng, vd "07/07/2026"' },
            duration: { type: 'string', description: 'thời lượng, vd "8 buổi · 90 phút"' },
            price: { type: 'string', description: 'học phí, vd "990k" / "Combo"' },
            courseNames: { type: 'array', items: { type: 'string' }, description: 'tên (các) khoá lớp mở — khớp danh sách khoá' },
            groupName: { type: 'string', description: 'tên nhóm Zalo của lớp — khớp danh sách nhóm' },
          },
          required: ['name'],
        },
      },
    },
    required: ['classes'],
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

async function chat(messages: unknown[], groups: any[], courses: any[]) {
  const groupList = groups.length
    ? groups.map((g) => '• ' + g.name + ' (' + g.group_type + ')').join('\n')
    : '(chưa có nhóm nào — thầy tạo nhóm ở admin → Cộng đồng trước)'
  const courseList = courses.length
    ? courses.map((c) => '• ' + c.name).join('\n')
    : '(chưa có khoá nào)'
  const system = SYSTEM
    + '\n\nCÁC NHÓM HIỆN CÓ (dùng để gán học sinh / gắn vào lịch lớp):\n' + groupList
    + '\n\nCÁC KHOÁ HỌC HIỆN CÓ (dùng để gắn vào lịch lớp):\n' + courseList
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, tools: TOOLS, messages }),
  })
  if (!res.ok) return { reply: 'Lỗi gọi AI: ' + (await res.text()), proposal: null }
  const data = await res.json()
  let reply = '', proposal: any = null
  for (const block of data.content ?? []) {
    if (block.type === 'text') reply += block.text
    if (block.type === 'tool_use' && block.name === 'propose_students') proposal = { type: 'students', students: block.input.students }
    if (block.type === 'tool_use' && block.name === 'propose_group_add') proposal = { type: 'group', assignments: block.input.assignments }
    if (block.type === 'tool_use' && block.name === 'propose_reset_password') proposal = { type: 'reset', resets: block.input.resets }
    if (block.type === 'tool_use' && block.name === 'propose_schedule') proposal = { type: 'schedule', classes: block.input.classes }
  }
  return { reply: reply.trim(), proposal }
}

// Tạo tài khoản học sinh — TÁI HIỆN đúng flow StudentOnboarding (KHÔNG ghi app_users)
async function createStudents(admin: ReturnType<typeof createClient>, students: any[]) {
  const results: any[] = []
  for (const s of students) {
    const email = (s.email || '').trim().toLowerCase()
    if (!email) { results.push({ email: s.email, ok: false, error: 'thiếu email' }); continue }
    const password = (s.password || '').trim() || genPassword()
    const full_name = (s.full_name || '').trim() || email.split('@')[0]
    try {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (cErr || !created?.user) {
        const m = cErr?.message || 'không tạo được tài khoản đăng nhập'
        throw new Error(/already been registered|already exists/i.test(m) ? 'email này đã có tài khoản' : m)
      }
      const uid = created.user.id
      // INSERT thẳng — auth user vừa tạo nên user_id chắc chắn mới. KHÔNG tự gán khoá (thầy gán sau ở /admin → Học viên).
      const { error: sErr } = await admin.from('edu_students')
        .insert({ user_id: uid, full_name, email, is_active: true, level: 'beginner', enrolled_at: new Date().toISOString() })
      if (sErr) {
        // rollback: xoá auth user vừa tạo để email được giải phóng, tránh tài khoản mồ côi
        await admin.auth.admin.deleteUser(uid).catch(() => {})
        throw new Error('tạo hồ sơ học sinh lỗi: ' + sErr.message)
      }
      results.push({ email, full_name, password, ok: true })
    } catch (e) {
      results.push({ email, ok: false, error: String((e as Error)?.message || e) })
    }
  }
  return results
}

// Gán học sinh vào nhóm — ghi edu_group_members (có unique(user_id,group_id) → upsert an toàn)
async function addToGroups(admin: ReturnType<typeof createClient>, assignments: any[]) {
  const results: any[] = []
  for (const a of assignments) {
    const email = (a.studentEmail || a.email || '').trim().toLowerCase()
    const groupName = (a.groupName || a.group || '').trim()
    try {
      if (!email || !groupName) throw new Error('thiếu email hoặc tên nhóm')
      const { data: stuRows } = await admin.from('edu_students').select('user_id,full_name').eq('email', email).limit(1)
      const stu = stuRows?.[0]
      if (!stu?.user_id) throw new Error('chưa có tài khoản học sinh với email này')
      const { data: grpRows } = await admin.from('edu_groups').select('id,name').ilike('name', '%' + groupName + '%').limit(1)
      const grp = grpRows?.[0]
      if (!grp?.id) throw new Error('không tìm thấy nhóm "' + groupName + '"')
      const { error: mErr } = await admin.from('edu_group_members')
        .upsert({ user_id: stu.user_id, group_id: grp.id, source: 'admin', status: 'active' }, { onConflict: 'user_id,group_id' })
      if (mErr) throw new Error(mErr.message)
      results.push({ email, student: stu.full_name, group: grp.name, ok: true })
    } catch (e) {
      results.push({ email, group: groupName, ok: false, error: String((e as Error)?.message || e) })
    }
  }
  return results
}

// Đặt lại mật khẩu học sinh — updateUserById (service_role). Trả mật khẩu mới để thầy đưa học sinh.
async function resetPasswords(admin: ReturnType<typeof createClient>, resets: any[]) {
  const results: any[] = []
  for (const r of resets) {
    const email = (r.studentEmail || r.email || '').trim().toLowerCase()
    try {
      if (!email) throw new Error('thiếu email')
      const password = (r.password || '').trim() || genPassword()
      const { data: stuRows } = await admin.from('edu_students').select('user_id,full_name').eq('email', email).limit(1)
      const stu = stuRows?.[0]
      if (!stu?.user_id) throw new Error('không tìm thấy học sinh với email này')
      const { error: uErr } = await admin.auth.admin.updateUserById(stu.user_id, { password })
      if (uErr) throw new Error(uErr.message)
      results.push({ email, full_name: stu.full_name, password, ok: true })
    } catch (e) {
      results.push({ email, ok: false, error: String((e as Error)?.message || e) })
    }
  }
  return results
}

// Tạo lịch lớp — resolve tên khoá/nhóm → id, insert class_schedule.
async function createSchedule(admin: ReturnType<typeof createClient>, classes: any[]) {
  const [{ data: allCourses }, { data: allGroups }] = await Promise.all([
    admin.from('edu_courses').select('id,name'),
    admin.from('edu_groups').select('id,name'),
  ])
  const norm = (s: string) => (s || '').trim().toLowerCase()
  const findCourse = (nm: string) => (allCourses ?? []).find((c: any) => norm(c.name).includes(norm(nm)) || norm(nm).includes(norm(c.name)))
  const findGroup = (nm: string) => nm ? (allGroups ?? []).find((g: any) => norm(g.name).includes(norm(nm)) || norm(nm).includes(norm(g.name))) : null
  const results: any[] = []
  for (const c of classes) {
    try {
      if (!(c.name || '').trim()) throw new Error('thiếu tên lớp')
      const courseIds = (c.courseNames ?? []).map(findCourse).filter(Boolean).map((x: any) => x.id)
      const grp = findGroup(c.groupName || '')
      const rec = {
        code: (c.code || '').trim() || null, name: c.name.trim(), section: c.section || 'upcoming',
        schedule: (c.schedule || '').trim() || null, start_text: (c.start || '').trim() || null,
        duration: (c.duration || '').trim() || null, price: (c.price || '').trim() || null,
        course_ids: courseIds, group_id: grp?.id || null,
      }
      const { error } = await admin.from('class_schedule').insert(rec)
      if (error) throw new Error(error.message)
      results.push({ email: c.name.trim(), ok: true, group: (grp?.name ? '💬 ' + grp.name + ' · ' : '') + courseIds.length + ' khoá' })
    } catch (e) {
      results.push({ email: c.name || '(lớp)', ok: false, error: String((e as Error)?.message || e) })
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
    const [{ data: groups }, { data: courses }] = await Promise.all([
      gate.admin.from('edu_groups').select('id,name,group_type'),
      gate.admin.from('edu_courses').select('id,name').order('sort_order'),
    ])
    return json(await chat(body.messages, groups ?? [], courses ?? []))
  }
  if (body.action === 'create') {
    if (!Array.isArray(body.students) || !body.students.length) return json({ error: 'Thiếu danh sách học sinh' }, 400)
    return json({ results: await createStudents(gate.admin, body.students) })
  }
  if (body.action === 'add_group') {
    if (!Array.isArray(body.assignments) || !body.assignments.length) return json({ error: 'Thiếu danh sách gán nhóm' }, 400)
    return json({ results: await addToGroups(gate.admin, body.assignments) })
  }
  if (body.action === 'reset_password') {
    if (!Array.isArray(body.resets) || !body.resets.length) return json({ error: 'Thiếu danh sách đặt lại mật khẩu' }, 400)
    return json({ results: await resetPasswords(gate.admin, body.resets) })
  }
  if (body.action === 'create_schedule') {
    if (!Array.isArray(body.classes) || !body.classes.length) return json({ error: 'Thiếu danh sách lớp' }, 400)
    return json({ results: await createSchedule(gate.admin, body.classes) })
  }
  return json({ error: 'action không hợp lệ' }, 400)
})
