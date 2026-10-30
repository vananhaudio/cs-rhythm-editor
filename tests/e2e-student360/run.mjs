// E2E Student 360° — Chrome thật + Supabase GIẢ ở tầng mạng (không gọi production, không dữ liệu thật).
// Máy chủ giả mô phỏng đúng hợp đồng RPC student_360_* (xem db/student_360_p1_setup.sql, p2_setup.sql).
// Chạy: DIST=<thư mục build vite> PLAYWRIGHT_CORE=<playwright-core> [CHROME=<Chrome>] [SHOTS=<thư mục ảnh>] node tests/e2e-student360/run.mjs
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
const DIST = process.env.DIST, SHOTS = process.env.SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let f = join(DIST, p)
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(DIST, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f))
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const BASE = `http://class.localhost:${server.address().port}`

const TEACHER = '33333333-3333-4333-8333-333333333333', STUDENT_UID = 'aaaaaaaa-0000-4000-8000-00000000000a', SID = 'bbbbbbbb-0000-4000-8000-0000000000b1'
const session = { access_token: 'x.y.z', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: TEACHER, aud: 'authenticated', role: 'authenticated', email: 'teacher@test.local', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
const COOKIE = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
let pass = 0
const ok = m => { pass++; console.log('PASS', m) }

// ── Kho giả (mô phỏng server) ──
function makeStore(opts = {}) {
  const facts = [], log = []; let n = 0; const now = () => new Date(Date.now() + n * 1000).toISOString()
  const calls = []
  const j = f => ({ ...f })
  const act = (id, action, before, after) => log.push({ at: now(), action, actor: TEACHER, before, after })
  const rpc = (name, a) => {
    calls.push(name)
    if (opts.failRpc === name) return { error: { message: 'forbidden', code: '42501' } }
    n++
    if (name === 'student_360_get') {
      assert.equal(a.p_user, STUDENT_UID, 'chỉ gửi user_id của học viên đang mở')
      return { data: { user_id: a.p_user, profile: null, learning_sources: [], generated_at: now(),
        facts: facts.filter(f => a.p_include_revoked || f.status === 'active').map(j) } }
    }
    if (name === 'student_360_add_fact') {
      const f = { id: 'f' + (facts.length + 1), category: a.p_category, content: a.p_content, origin: a.p_origin, verification: 'unverified', source_kind: a.p_source_kind,
        visibility: a.p_visibility || (a.p_origin === 'inferred' ? 'teacher' : 'student_and_teacher'), status: 'active', created_at: now(), updated_at: now(), source_ref: 'crm-link:SECRET' }
      facts.push(f); act(f.id, 'create', null, j(f)); return { data: j(f) }
    }
    const f = facts.find(x => x.id === a.p_fact); if (!f) return { error: { message: 'not_found', code: 'P0002' } }
    const before = j(f)
    if (name === 'student_360_edit_fact') { f.content = a.p_content; f.verification = 'unverified'; f.updated_at = now(); act(f.id, 'edit', before, j(f)) }
    else if (name === 'student_360_set_verification') { f.verification = a.p_level; f.updated_at = now(); act(f.id, 'verify:' + a.p_level, before, j(f)) }
    else if (name === 'student_360_set_visibility') { f.visibility = a.p_visibility; f.updated_at = now(); act(f.id, 'visibility:' + a.p_visibility, before, j(f)) }
    else if (name === 'student_360_revoke_fact') { f.status = 'revoked'; f.revoke_reason = a.p_reason ?? undefined; f.updated_at = now(); act(f.id, 'revoke', before, j(f)) }
    else if (name === 'student_360_fact_history') return { data: log.filter(l => l.after?.id === f.id || l.before?.id === f.id) }
    else return { data: [] }
    return { data: j(f) }
  }
  return { facts, log, calls, rpc }
}

async function open(store, viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', hasTouch: viewport.width < 700, isMobile: viewport.width < 700 })
  await ctx.addCookies([{ name: 'sb-wojmdilyflffvdtpovmq-auth-token', value: COOKIE, url: BASE }])
  const page = await ctx.newPage()
  const writes = [], tableReads = []
  await page.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url())
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (u.hostname.endsWith('supabase.co')) {
      const json = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(d) })
      if (u.pathname === '/auth/v1/user') return json(session.user)
      if (u.pathname.startsWith('/auth/')) return json({})
      const t = u.pathname.split('/').pop()
      if (u.pathname.startsWith('/rest/v1/rpc/')) {
        if (t.startsWith('student_360_')) {
          const r = store.rpc(t, JSON.parse(req.postData() || '{}'))
          return r.error ? json(r.error, 403) : json(r.data)
        }
        return json(t === 'my_tool_route_access' ? true : [])
      }
      if (u.pathname.startsWith('/rest/v1/')) {
        if (req.method() !== 'GET' && req.method() !== 'HEAD') writes.push(req.method() + ' ' + t)
        if (t.startsWith('student_360_')) tableReads.push(t)
        const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
        if (t === 'app_users') return json({ id: TEACHER, role: 'teacher', status: 'active', name: 'Thầy', avatar_url: null })
        if (t === 'edu_students') {
          const s = { id: SID, user_id: STUDENT_UID, full_name: 'Nguyễn An', email: 'an@test.local', phone: null, age: 30, level: 'beginner', goals: 'Đệm hát',
            learning_style: null, instruments: 'Guitar', enrolled_at: '2026-01-02T00:00:00Z', is_active: true, ht_member: false }
          return single ? json(s) : json([s])
        }
        return single ? json(null, 406) : json([])
      }
      return json({})
    }
    if (u.origin !== BASE) return route.abort()
    return route.continue()
  })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  return { ctx, page, writes, tableReads, errors }
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, name + '.png'), fullPage: true }) }
const gotoTab = async page => {
  await page.goto(`${BASE}/student?id=${SID}`)
  await page.getByRole('button', { name: /Thấu hiểu/ }).click({ timeout: 15000 })
}

// ── 1) Máy tính: luồng đầy đủ ──
{
  const store = makeStore()
  const { ctx, page, writes, tableReads, errors } = await open(store, { width: 1280, height: 900 })
  await gotoTab(page)
  await page.getByText(/Chưa có thông tin nào được ghi nhận/).waitFor()
  assert.ok(await page.getByText('Guitar').first().isVisible(), 'tổng quan lấy từ hồ sơ Class')
  assert.ok(await page.getByText('02/01/2026').first().isVisible(), 'ngày nhập học đúng định dạng')
  const align = await page.getByLabel('Tổng quan học viên').evaluate(el => getComputedStyle(el).textAlign)
  assert.ok(['left', 'start'].includes(align), 'panel căn lề trái, không thừa hưởng căn giữa: ' + align)
  ok('mở tab Thấu hiểu: hồ sơ chưa có mục → trạng thái rỗng + tổng quan từ hồ sơ Class')
  await shot(page, 'desktop-1-empty')

  await page.getByLabel('Nguồn thông tin').selectOption('guess')
  await page.getByLabel('Nhóm thông tin').selectOption('difficulty')
  await page.getByLabel('Nội dung').fill('Hay đau tay khi bấm barre')
  await page.getByRole('button', { name: 'Thêm', exact: true }).click()
  await page.getByText('Đã thêm thông tin.').waitFor()
  await page.getByText('Suy luận · Chưa xác minh').waitFor()
  assert.ok(await page.getByText('Chỉ giáo viên thấy', { exact: true }).isVisible(), 'suy luận mặc định chỉ giáo viên thấy')
  assert.ok(!(await page.locator('body').innerText()).includes('SECRET'), 'không lộ source_ref')
  ok('thêm mục "Thầy suy đoán" → nhãn "Suy luận · Chưa xác minh", chỉ giáo viên thấy, không lộ source_ref')

  await page.getByRole('button', { name: 'Cho học viên xem' }).click()
  await page.getByRole('group', { name: 'Xác nhận cho học viên xem' }).waitFor()
  await page.getByRole('button', { name: 'Hủy', exact: true }).click()
  assert.ok(await page.getByText('Chỉ giáo viên thấy', { exact: true }).isVisible(), 'Hủy giữ nguyên chỉ giáo viên thấy')
  await page.getByRole('button', { name: 'Cho học viên xem' }).click()
  await page.getByRole('button', { name: 'Vẫn cho học viên xem' }).click()
  await page.getByText('Học viên đã có thể xem mục này.').waitFor()
  await page.getByText('Học viên cũng thấy', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Xác minh', exact: true }).click()
  await page.getByText('Suy luận · Thầy đã xác minh').waitFor()
  ok('Thầy chủ động cho học viên xem + xác minh → vẫn ghi "Suy luận · Thầy đã xác minh" (không thành sự thật Class)')

  await page.getByRole('button', { name: 'Sửa', exact: true }).click()
  await page.getByLabel('Sửa nội dung').fill('Đau tay khi bấm barre F')
  await page.getByRole('button', { name: 'Lưu' }).click()
  await page.getByText('Suy luận · Chưa xác minh').waitFor()
  ok('sửa → mức xác minh về "Chưa xác minh"')

  await page.getByRole('button', { name: 'Lịch sử' }).click()
  const hist = page.getByRole('region', { name: 'Lịch sử thay đổi' })
  await hist.getByText('Sửa nội dung').waitFor()
  const ht = await hist.innerText()
  for (const s of ['Tạo mục', 'Cho học viên xem', 'Thầy xác minh', 'Sửa nội dung', 'Trước: Hay đau tay khi bấm barre', 'Sau: Đau tay khi bấm barre F']) assert.ok(ht.includes(s), 'lịch sử thiếu: ' + s)
  await shot(page, 'desktop-2-history')
  ok('lịch sử hiển thị đủ hành động + nội dung trước/sau')

  await page.getByRole('button', { name: 'Thu hồi', exact: true }).click()
  await page.getByRole('group', { name: 'Xác nhận thu hồi' }).waitFor()
  assert.equal(store.facts[0].status, 'active', 'chưa thu hồi trước khi xác nhận')
  await page.getByLabel('Lý do thu hồi (không bắt buộc)').fill('nhầm học viên')
  await page.getByRole('button', { name: 'Xác nhận thu hồi' }).click()
  await page.getByText(/Đã thu hồi\. Lịch sử vẫn được lưu/).waitFor()
  await page.getByText(/Chưa có thông tin nào được ghi nhận/).waitFor()
  assert.equal(store.facts.length, 1, 'không xoá cứng')
  assert.equal(store.facts[0].status, 'revoked')
  await page.getByLabel(/Hiện cả mục đã thu hồi/).check()
  await page.getByText('Đã thu hồi: nhầm học viên').waitFor()
  await shot(page, 'desktop-3-revoked')
  ok('thu hồi có xác nhận + lý do → mục ẩn, không xoá cứng, xem lại được khi bật công tắc')

  assert.deepEqual(writes, [], 'không ghi trực tiếp bảng nào')
  assert.deepEqual(tableReads, [], 'không đọc trực tiếp bảng student_360_*')
  assert.deepEqual(errors, [], 'không có lỗi JS: ' + errors)
  ok('chỉ đi qua RPC: 0 ghi bảng trực tiếp, 0 đọc bảng student_360_*, 0 lỗi JS')
  await ctx.close()
}

// ── 2) Điện thoại 390px: không tràn ngang, nút đủ lớn, thao tác được ──
{
  const store = makeStore()
  store.rpc('student_360_add_fact', { p_category: 'goal', p_content: 'Muốn tự đệm hát vài bài Bolero rất dài để kiểm tra việc xuống dòng trên màn hình điện thoại nhỏ', p_origin: 'self_reported', p_source_kind: 'teacher' })
  store.rpc('student_360_add_fact', { p_category: 'difficulty', p_content: 'Hay đau tay', p_origin: 'inferred', p_source_kind: 'crm_zalo' })
  const { ctx, page, errors } = await open(store, { width: 390, height: 844 })
  await gotoTab(page)
  await page.getByText('Muốn tự đệm hát vài bài Bolero', { exact: false }).waitFor()
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  assert.ok(m.sw <= m.cw + 1, `không tràn ngang trên 390px (scrollWidth ${m.sw} > ${m.cw})`)
  const small = await page.evaluate(() => [...document.querySelectorAll('[aria-label="Thấu hiểu học viên"] button, [aria-label="Thêm thông tin"] button')]
    .map(b => ({ t: b.textContent, h: b.getBoundingClientRect().height })).filter(x => x.h < 43.5))
  assert.deepEqual(small, [], 'nút tối thiểu 44px: ' + JSON.stringify(small))
  await shot(page, 'mobile-1-list')
  ok('điện thoại 390px: không tràn ngang, mọi nút ≥ 44px')

  await page.getByRole('button', { name: 'Xác minh', exact: true }).first().click()
  await page.getByText('Đã xác minh.').waitFor()
  await page.getByLabel('Nội dung').fill('Cần bài tập chậm')
  assert.ok(await page.getByRole('button', { name: 'Thêm', exact: true }).isDisabled(), 'chưa chọn nguồn thì chưa thêm được')
  await page.getByLabel('Nguồn thông tin').selectOption('observed')
  await page.getByRole('button', { name: 'Thêm', exact: true }).click()
  await page.getByText('Cần bài tập chậm').waitFor()
  assert.equal(store.facts.at(-1).visibility, 'teacher', 'mục thêm từ giao diện mặc định chỉ giáo viên thấy')
  await shot(page, 'mobile-2-after')
  assert.deepEqual(errors, [])
  ok('điện thoại: xác minh + thêm mục hoạt động')
  await ctx.close()
}

// ── 3) Lỗi quyền từ server: báo tiếng Việt, hồ sơ không đổi ──
{
  const store = makeStore({ failRpc: 'student_360_add_fact' })
  const { ctx, page } = await open(store, { width: 1280, height: 900 })
  await gotoTab(page)
  await page.getByLabel('Nội dung').fill('thử nghiệm')
  await page.getByLabel('Nguồn thông tin').selectOption('observed')
  await page.getByRole('button', { name: 'Thêm', exact: true }).click()
  await page.getByRole('alert').getByText('Bạn không có quyền thực hiện thao tác này.').waitFor()
  assert.equal(store.facts.length, 0)
  ok('server từ chối (forbidden) → thông báo lỗi tiếng Việt, không tạo mục')
  await ctx.close()
}

// ── 4) Các tab cũ của hồ sơ vẫn mở được ──
{
  const store = makeStore()
  const { ctx, page, errors } = await open(store, { width: 1280, height: 900 })
  await page.goto(`${BASE}/student?id=${SID}`)
  for (const name of [/Tổng quan/, /Hoạt động app/, /Buổi học/, /Bài tập/, /Timeline AI/, /Khoá học/, /Thấu hiểu/]) {
    await page.getByRole('button', { name }).first().click({ timeout: 15000 })
  }
  assert.deepEqual(errors, [], 'không lỗi JS khi duyệt các tab: ' + errors)
  ok('hồ sơ cũ: cả 6 tab cũ + tab mới mở được, không lỗi JS')
  await ctx.close()
}
await browser.close(); server.close()
console.log(`\n${pass} nhóm kiểm PASS`)
