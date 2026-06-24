// Edge Function: signup-free
// Tạo TÀI KHOẢN MIỄN PHÍ cho khách từ trang /class (web). Anon gọi được.
// Tạo auth user + edu_students (beginner) + ghi danh CHỈ các khoá miễn phí (is_free=true, đang hiện).
// DEPLOY: Supabase Dashboard → Edge Functions → signup-free → Verify JWT = TẮT.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let body: { name?: string; email?: string; password?: string }
  try { body = await req.json() } catch { return json({ error: 'Dữ liệu không hợp lệ' }, 400) }

  const email = (body.email || '').trim().toLowerCase()
  const password = (body.password || '').trim()
  const name = (body.name || '').trim() || email.split('@')[0]

  if (!emailOk(email)) return json({ error: 'Email không hợp lệ' }, 400)
  if (password.length < 6) return json({ error: 'Mật khẩu cần ít nhất 6 ký tự' }, 400)

  // Đã có tài khoản với email này?
  const { data: existed } = await admin.from('edu_students').select('id').eq('email', email).limit(1)
  if (existed && existed.length) {
    return json({ error: 'Email này đã có tài khoản. Bạn hãy đăng nhập trên app nhé.', code: 'exists' }, 409)
  }

  // 1) Tạo auth user
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (cErr || !created?.user?.id) {
    const dup = (cErr?.message || '').toLowerCase().includes('already')
    return json({ error: dup ? 'Email này đã có tài khoản. Hãy đăng nhập nhé.' : ('Không tạo được tài khoản: ' + (cErr?.message || '')), code: dup ? 'exists' : 'err' }, dup ? 409 : 500)
  }
  const uid = created.user.id

  // 2) Hồ sơ học viên (beginner = gói miễn phí)
  const { data: stu, error: sErr } = await admin.from('edu_students')
    .insert({ user_id: uid, full_name: name, email, is_active: true, level: 'beginner', enrolled_at: new Date().toISOString() })
    .select('id').single()
  if (sErr || !stu) {
    await admin.auth.admin.deleteUser(uid).catch(() => {})
    return json({ error: 'Không tạo được hồ sơ học viên: ' + (sErr?.message || '') }, 500)
  }

  // 3) Ghi danh CHỈ các khoá miễn phí đang hiển thị
  const { data: freeCourses } = await admin.from('edu_courses')
    .select('id,status').eq('is_free', true).neq('status', 'off')
  const rows = (freeCourses ?? []).map((c: { id: string }) => ({ student_id: stu.id, course_id: c.id, enrolled_by: uid, is_active: true }))
  if (rows.length) await admin.from('edu_enrollments').insert(rows)

  return json({ ok: true, enrolled: rows.length, message: 'Tạo tài khoản thành công' })
})
