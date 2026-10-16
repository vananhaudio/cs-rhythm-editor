// E2E khung Admin (/admin) — Chrome thật + Supabase GIẢ ở tầng mạng (không gọi production, không ghi dữ liệu).
// Chạy: DIST=<thư mục build vite> PLAYWRIGHT_CORE=<playwright-core> [CHROME=<Chrome>] [SHOTS=<thư mục>] node tests/e2e-admin-shell/run.mjs
// Phiên GIẢ có vai trò teacher do chính harness dựng; app không bị bypass auth. Kiểm KHUNG (menu/URL/header), không kiểm dữ liệu nghiệp vụ.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
const DIST = process.env.DIST
const SHOTS = process.env.SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let f = join(DIST, p)
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(DIST, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' })
  res.end(readFileSync(f))
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const BASE = `http://class.localhost:${server.address().port}`

const ME = '22222222-2222-4222-8222-222222222222'
const session = { access_token: 'x.y.z', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: ME, aud: 'authenticated', role: 'authenticated', email: 'thay@test.local', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
// Dữ liệu giả cho V2 (danh sách lớp / không gian lớp). Không phải dữ liệu thật.
const CLS_D = 'dddddddd-0000-4000-8000-00000000000d', CLS_E = 'eeeeeeee-0000-4000-8000-00000000000e'
const CLS_A = 'aaaaaaaa-0000-4000-8000-00000000000a', CLS_B = 'bbbbbbbb-0000-4000-8000-00000000000b', CLS_C = 'cccccccc-0000-4000-8000-00000000000c'
const FULL = { section: 'active', schedule: null, start_text: null, duration: null, price: null, course_ids: [], main_course_id: null, group_id: null,
  sort_order: 0, is_active: true, breaks_after: null, timezone: 'Asia/Ho_Chi_Minh', show_on_practice_schedule: false, stage: null, practice_type: null,
  metadata: {}, public_product: null, public_enroll: false, cover_url: null }
const future = d => new Date(Date.now() + d * 86400000).toISOString()
const CLASSES = [
  { id: CLS_A, code: 'GZ-01', name: 'Lớp Alpha', status: 'active', cohort_group_id: 'g-a', start_date: '2026-09-01', end_date: '2026-12-01', weekday: 2, start_time: '19:00', duration_minutes: 90, total_sessions: 8, zoom_url: null, program_code: null, ...FULL },
  { id: CLS_B, code: 'GZ-02', name: 'Lớp Beta', status: 'upcoming', cohort_group_id: null, start_date: null, end_date: null, weekday: null, start_time: null, duration_minutes: 90, total_sessions: 8, zoom_url: null, program_code: null, ...FULL },
  { id: CLS_C, code: 'GZ-00', name: 'Lớp Cũ Gamma', status: 'completed', cohort_group_id: 'g-c', start_date: '2026-01-01', end_date: '2026-03-01', weekday: 1, start_time: '20:00', duration_minutes: 90, total_sessions: 8, zoom_url: null, program_code: null, ...FULL },
]
const SESSIONS = [
  { id: 's1', class_id: CLS_A, session_number: 1, start_at: future(2), end_at: future(2), status: 'scheduled', event_type: 'lesson', title: 'Alpha buổi một' },
  { id: 's2', class_id: CLS_A, session_number: 2, start_at: future(9), end_at: future(9), status: 'scheduled', event_type: 'lesson', title: 'Alpha buổi hai' },
  { id: 's4', class_id: CLS_A, session_number: 3, start_at: future(16), end_at: future(16), status: 'completed', event_type: 'lesson', title: 'Alpha buổi ba' },
  { id: 's5', class_id: CLS_A, session_number: 4, start_at: future(23), end_at: future(23), status: 'holiday', event_type: 'lesson', title: 'Alpha buổi bốn' },
  { id: 's3', class_id: CLS_B, session_number: 1, start_at: future(5), end_at: future(5), status: 'scheduled', event_type: 'lesson', title: 'Beta buổi một' },
]
// Lớp 40 buổi / 5 chặng (kiểu HT2027) để kiểm danh sách dài trong Giáo trình
CLASSES.push({ id: CLS_D, code: 'HT-40', name: 'Lớp Bốn Mươi', status: 'active', cohort_group_id: 'g-d', start_date: '2026-09-01', end_date: '2027-06-01', weekday: 3, start_time: '19:00', duration_minutes: 90, total_sessions: 40, zoom_url: null, program_code: null, ...FULL })
for (let i = 1; i <= 40; i++) SESSIONS.push({ id: 'd' + i, class_id: CLS_D, session_number: i, start_at: future(i * 7), end_at: future(i * 7), status: 'scheduled', event_type: 'lesson', title: 'Buổi học số ' + i, stage_id: Math.ceil(i / 8) })
const STAGES = [1, 2, 3, 4, 5].map(n => ({ id: n, class_id: CLS_D, stage_no: n, public_title: 'Chặng thử ' + n, summary: null, from_session: (n - 1) * 8 + 1, to_session: n * 8, starts_on: null, ends_on: null }))
const LONG = 'Hành trình 2027 — 40 buổi thực hành guitar đệm hát cùng nhóm nhỏ, chặng một đến chặng năm'
CLASSES.push({ id: CLS_E, code: 'HT2027.TH01', name: LONG, status: 'upcoming', cohort_group_id: null, start_date: null, end_date: null, weekday: null, start_time: null, duration_minutes: 90, total_sessions: 40, zoom_url: null, program_code: null, ...FULL })
const SUMMARY = [{ class_id: CLS_A, group_name: 'Nhóm Alpha', group_id: 'g-a', member_count: 7, curriculum_access_count: 3 }]
// class_roster giống RPC thật: 7 thành viên active (khớp SUMMARY) hoặc lỗi/rỗng theo ROSTER_MODE
let ROSTER_MODE = 'ok'
const ROSTER = Array.from({ length: 7 }, (_, i) => ({ user_id: 'u' + i, status: 'active', source: 'admin', joined_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-02T00:00:00Z', student_id: 'st' + i, name: 'Học viên số ' + (i + 1), email: `hv${i}@example.test`, student_active: true, is_staff: false, curriculum: 'not_granted' }))
const COOKIE = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
let pass = 0
const ok = m => { pass++; console.log('PASS', m) }

const SECTIONS = [ // [đường dẫn, nhãn menu]
  ['/admin', 'Tổng quan'], ['/admin/lop', 'Danh sách lớp'], ['/admin/schedule', 'Lớp & lịch'], ['/admin/ht2027', 'Thực hành HT2027'],
  ['/admin/students', 'Học viên'], ['/admin/leads', 'Đăng ký'], ['/admin/community', 'Nhóm cộng đồng'],
  ['/admin/courses', 'Khoá học'], ['/admin/journey', 'Hành trình'], ['/admin/tools', 'Công cụ'], ['/admin/nhipphach', 'Nhịp phách'],
  ['/admin/newsfeed', 'Bản tin trong app'], ['/admin/articles', 'Bài viết tuyển sinh'], ['/admin/showcase', 'Trang Showcase'],
  ['/admin/daily-mail', 'Thư hàng ngày'], ['/admin/chat-mail', 'Chat Mail'],
  ['/admin/aichat', 'AI tuyển sinh'], ['/admin/assistant', 'Trợ lý quản trị'],
]

async function open(path, { width = 1440, height = 900, dark = false } = {}) {
  const ctx = await browser.newContext({ colorScheme: dark ? 'dark' : 'light', viewport: { width, height }, hasTouch: width < 600, isMobile: width < 600, serviceWorkers: 'block' })
  await ctx.addCookies([{ name: 'sb-wojmdilyflffvdtpovmq-auth-token', value: COOKIE, url: BASE }])
  const page = await ctx.newPage()
  const log = { writes: [], errors: [] }
  page.on('pageerror', e => log.errors.push(String(e).slice(0, 160)))
  await page.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url())
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (u.hostname.endsWith('supabase.co')) {
      const json = d => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(d) })
      if (req.method() !== 'GET' && req.method() !== 'HEAD' && !u.pathname.includes('/rpc/') && !u.pathname.startsWith('/auth/')) log.writes.push(req.method() + ' ' + u.pathname)
      if (u.pathname === '/auth/v1/user') return json(session.user)
      if (u.pathname.startsWith('/auth/')) return json({})
      const t = u.pathname.split('/').pop()
      if (t === 'class_roster') {
        if (ROSTER_MODE === 'error') return route.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ message: 'roster boom' }) })
        const body = JSON.parse(req.postData() || '{}')
        if (ROSTER_MODE === 'slow') await new Promise(r => setTimeout(r, 1500))
        return json((ROSTER_MODE === 'ok' || ROSTER_MODE === 'slow') && body.p_class === CLS_A ? ROSTER : [])
      }
      if (u.pathname.startsWith('/rest/v1/rpc/')) return json((t === 'is_teacher' || t === 'my_tool_route_access') ? true : t === 'admin_class_member_summary' ? SUMMARY : [])
      if (u.pathname.startsWith('/rest/v1/')) {
        if (t === 'app_users') return json({ role: 'teacher', status: 'active', avatar_url: null })
        const eq = k => { const v = u.searchParams.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null }
        const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
        if (t === 'class_schedule') {
          const id = eq('id'); const rows = id ? CLASSES.filter(c => c.id === id) : CLASSES
          return json(single ? (rows[0] ?? null) : rows)
        }
        if (t === 'class_stages') { const cid = eq('class_id'); return json(STAGES.filter(x => x.class_id === cid)) }
        if (t === 'class_sessions') {
          const cid = eq('class_id'); return json(cid ? SESSIONS.filter(x => x.class_id === cid) : SESSIONS)
        }
        return json([])
      }
      return json({})
    }
    if (u.origin !== BASE) return route.abort()
    return route.continue()
  })
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  return { ctx, page, log }
}
const cur = async page => { const r = await page.locator('a[aria-current="page"]').allInnerTexts(); if (!r.length && process.env.DBG) console.log("URL", page.url(), "\n", (await page.locator("body").innerText()).slice(0, 300)); return r }
const label = t => t.replace(/[^\p{L}\p{N}& ]/gu, '').trim()
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
const openMenu = async (page, w) => { if (w < 768) await page.getByLabel('Mở menu').click() }

// 1. Mở trực tiếp từng URL (cả URL cũ) → đúng mục; chỉ một khung
{
  const { ctx, page, log } = await open('/admin')
  for (const [path, name] of SECTIONS) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    const c = await cur(page)
    assert.equal(c.length, 1, `${path}: một mục đang chọn (${c})`)
    assert.equal(label(c[0]), label(name), `${path}: mục đang chọn`)
    assert.equal(await page.locator('nav[aria-label="Menu Admin"]').count(), 1, `${path}: chỉ một khung Admin`)
    assert.equal(await page.getByText('← Admin').count(), 0, `${path}: không còn nút "← Admin" trùng`)
  }
  for (const [legacy, name] of [['/admin/dailymail', 'Thư hàng ngày'], ['/admin/chatmail', 'Chat Mail']]) {
    await page.goto(BASE + legacy, { waitUntil: 'networkidle' })
    assert.equal(label((await cur(page))[0]), label(name), legacy)
  }
  // ToolsManager (có sẵn từ trước, không đổi) tự seed edu_tools khi bảng trống — harness trả bảng trống; DB giả nên vô hại.
  const other = log.writes.filter(w => w !== 'POST /rest/v1/edu_tools')
  assert.equal(other.length, 0, 'không ghi gì ngoài seed edu_tools có sẵn: ' + other)
  await ctx.close()
  ok('19 URL + 2 slug cũ vào đúng mục, một sidebar, không "← Admin" trùng, không ghi dữ liệu')
}

// 2. Bấm menu → URL; bấm lại không thêm history; Back/Forward; reload; mục sai
{
  const { ctx, page } = await open('/admin')
  const nav = page.getByRole('navigation', { name: 'Menu Admin' })
  const len0 = await page.evaluate(() => history.length)
  await nav.getByRole('link', { name: 'Học viên' }).click()
  assert.match(page.url(), /\/admin\/students$/)
  const len1 = await page.evaluate(() => history.length)
  assert.equal(len1, len0 + 1)
  await nav.getByRole('link', { name: 'Học viên' }).click()
  assert.equal(await page.evaluate(() => history.length), len1, 'bấm lại mục hiện tại không thêm history')
  await nav.getByRole('link', { name: 'Thư hàng ngày' }).click()
  assert.match(page.url(), /\/admin\/daily-mail$/)
  await page.goBack()
  assert.match(page.url(), /\/admin\/students$/)
  assert.equal(label((await cur(page))[0]), 'Học viên')
  await page.goBack()
  assert.match(page.url(), /\/admin$/)
  assert.equal(label((await cur(page))[0]), 'Tổng quan')
  await page.goForward()
  assert.equal(label((await cur(page))[0]), 'Học viên')
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(label((await cur(page))[0]), 'Học viên')
  await page.goto(BASE + '/admin/khong-co', { waitUntil: 'networkidle' })
  assert.match(page.url(), /\/admin$/)
  assert.equal(label((await cur(page))[0]), 'Tổng quan')
  await ctx.close()
  ok('click → URL; click lại không thêm history; Back/Forward; reload giữ mục; URL sai → /admin')
}

// 2b. Mục "Giáo trình lớp" đã gỡ; đường cũ /admin/classes → /admin/lop (không thêm history); Giáo trình nằm trong lớp
{
  const { ctx, page } = await open('/admin')
  assert.equal(await page.locator('nav[aria-label="Menu Admin"]').getByText('Giáo trình lớp').count(), 0, 'menu không còn Giáo trình lớp')
  assert.equal(await page.locator('nav[aria-label="Menu Admin"]').getByText('Khoá học').count(), 1, 'Khoá học còn nguyên')
  await page.goto(BASE + '/admin/schedule', { waitUntil: 'networkidle' })
  await page.goto(BASE + '/admin/classes', { waitUntil: 'networkidle' })
  assert.equal(new URL(page.url()).pathname, '/admin/lop', '/admin/classes → /admin/lop')
  assert.equal(label((await cur(page))[0]), label('Danh sách lớp'), 'mục đang chọn sau chuyển hướng')
  await page.goBack({ waitUntil: 'networkidle' })
  assert.equal(new URL(page.url()).pathname, '/admin/schedule', 'Back không quay lại /admin/classes (không thêm history)')
  await page.goto(BASE + '/admin/lop/' + CLS_A + '/giao-trinh', { waitUntil: 'networkidle' })
  assert.equal(await page.locator('.ac-tab[aria-current="page"]').innerText(), 'Giáo trình', 'tab Giáo trình trong lớp mở được')
  await ctx.close()
  ok('menu bỏ Giáo trình lớp; /admin/classes chuyển sang /admin/lop; tab Giáo trình trong lớp còn')
}

// 2c. Tạo lớp chỉ ở Lớp & lịch: màn Học viên không còn "Thêm lớp"; "Tạo lớp mới" ở Danh sách lớp → Lớp & lịch có form tạo
{
  const { ctx, page, log } = await open('/admin/students')
  assert.equal(await page.getByRole('button', { name: /Thêm lớp/ }).count(), 0, 'Học viên không còn nút Thêm lớp')
  assert.equal(await page.getByRole('button', { name: /Thêm học sinh/ }).count(), 1, 'Thêm học sinh còn nguyên')
  await page.goto(BASE + '/students', { waitUntil: 'networkidle' })
  assert.equal(await page.getByRole('button', { name: /Thêm lớp/ }).count(), 0, '/students cũng không còn Thêm lớp')
  await page.goto(BASE + '/admin/lop', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Tạo lớp mới/ }).click()
  assert.equal(new URL(page.url()).pathname, '/admin/schedule', 'Tạo lớp mới → Lớp & lịch')
  assert.equal(await page.getByRole('button', { name: /Thêm lớp/ }).count(), 1, 'Lớp & lịch còn nút Thêm lớp (form tạo lớp)')
  assert.deepEqual(log.writes, [], 'không ghi dữ liệu')
  await ctx.close()
  ok('Học viên không còn Thêm lớp (cả /admin/students và /students); Tạo lớp mới → Lớp & lịch còn form tạo lớp')
}

// 3. Tổng quan: không số hardcode; lối tắt đổi URL; Ht2027 → Lớp & lịch đổi URL
{
  const { ctx, page } = await open('/admin')
  const txt = await page.locator('body').innerText()
  assert.ok(!/577|\b13\b|đang hoạt động|đã tạo|đang cập nhật/.test(txt), 'không còn số liệu hardcode')
  for (const [name, re] of [['Đăng ký', /leads$/], ['Lớp & lịch', /schedule$/], ['Học viên', /students$/]]) {
    await page.goto(BASE + '/admin', { waitUntil: 'networkidle' })
    await page.getByRole('main').or(page.locator('body')).getByRole('link', { name: new RegExp(name.replace('&', '&') + ' →') }).click()
    assert.match(page.url(), re, `lối tắt ${name}`)
  }
  await page.goto(BASE + '/admin/ht2027', { waitUntil: 'networkidle' })
  const btnOpen = page.getByRole('button', { name: /Mở Lịch lớp/ })
  if (await btnOpen.count()) { await btnOpen.first().click(); assert.match(page.url(), /schedule$/, 'nút trong trang đồng bộ URL') }
  await ctx.close()
  ok('Tổng quan không số cứng; 3 lối tắt cập nhật URL (không còn lối tắt Giáo trình lớp); nút nội bộ Ht2027 đồng bộ URL')
}

// 4. Mở nhanh: liên kết đúng, quyền để trang đích
{
  const { ctx, page } = await open('/admin')
  const want = { 'Thư viện nhạc': '/thuvien', 'Quản lý Band': '/me/bands', 'Hàng đợi trả bài': '/me/queue', 'Báo cáo nội dung': '/story/reports', 'Kho Tri Thức ↗': 'https://khotrithuc.netlify.app', 'TeamLab ↗': 'https://class.vananhaudio.com/teamlab', 'Trang học sinh': '/start' }
  for (const [name, href] of Object.entries(want)) {
    const a = page.getByRole('navigation', { name: 'Menu Admin' }).getByRole('link', { name })
    assert.equal(await a.getAttribute('href'), href, name)
  }
  await ctx.close()
  ok('Mở nhanh: 7 liên kết đúng đích')
}

// 5. Responsive: không tràn ngang; sidebar cuộn tới mục cuối; drawer; vùng chạm
for (const width of [1440, 768, 390, 360]) {
  const height = width >= 768 ? 560 : 640   // thấp để buộc cuộn
  const { ctx, page } = await open('/admin/showcase', { width, height })
  assert.ok(await overflow(page) <= 1, `${width}: không tràn ngang (${await overflow(page)})`)
  await openMenu(page, width)
  const last = page.getByRole('navigation', { name: 'Menu Admin' }).getByRole('link', { name: 'Trang học sinh' })
  await last.scrollIntoViewIfNeeded()
  const bb = await last.boundingBox()
  assert.ok(bb && bb.y + bb.height <= height + 1 && bb.y >= 0, `${width}: mục cuối tiếp cận được (${JSON.stringify(bb)})`)
  if (width < 768) {
    assert.ok(bb.height >= 44, `${width}: vùng chạm ≥44 (${bb.height})`)
    await page.getByRole('navigation', { name: 'Menu Admin' }).getByRole('link', { name: 'Bài viết tuyển sinh' }).scrollIntoViewIfNeeded()
    await page.getByRole('navigation', { name: 'Menu Admin' }).getByRole('link', { name: 'Bài viết tuyển sinh' }).click()
    assert.match(page.url(), /articles$/)
    await page.waitForTimeout(450)   // transition 0.25s của drawer
    const x = await page.locator('aside').first().evaluate(e => e.getBoundingClientRect().right)
    assert.ok(x <= 1, `${width}: chọn mục xong drawer đóng (${x})`)
    assert.ok(await overflow(page) <= 1, `${width}: sau khi chọn không tràn`)
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/admin-${width}.png` })
  await ctx.close()
  ok(`${width}px: không tràn ngang, cuộn tới mục cuối${width < 768 ? ', chạm ≥44, drawer đóng sau khi chọn' : ''}`)
}

// 6. V2: Danh sách lớp → tìm/lọc → chọn lớp → các mục giữ đúng lớp → Back/Forward/reload
{
  const { ctx, page, log } = await open('/admin/lop')
  const body = () => page.locator('.ac-root').innerText()
  let t = await body()
  assert.ok(t.includes('Lớp Alpha') && t.includes('Lớp Beta'), 'hiện lớp đang hoạt động')
  assert.ok(!t.includes('Lớp Cũ Gamma'), 'mặc định ẩn lớp đã kết thúc')
  assert.ok(t.includes('7 học viên'), 'số học viên từ RPC canonical')
  assert.ok(t.includes('Chưa có nhóm'), 'lớp không có dòng tóm tắt → "Chưa có nhóm", không phải số 0')
  await page.getByLabel('Lọc theo trạng thái').selectOption('all')
  assert.ok((await body()).includes('Lớp Cũ Gamma'), 'lọc Tất cả hiện lớp đã kết thúc')
  await page.getByLabel('Tìm lớp').fill('beta')
  t = await body(); assert.ok(t.includes('Lớp Beta') && !t.includes('Lớp Alpha'), 'tìm theo tên')
  await page.getByLabel('Tìm lớp').fill('gz-01')
  t = await body(); assert.ok(t.includes('Lớp Alpha') && !t.includes('Lớp Beta'), 'tìm theo mã')
  await page.getByLabel('Tìm lớp').fill('khong-ton-tai')
  assert.ok((await body()).includes('Không có lớp nào khớp'), 'trạng thái rỗng khi tìm')
  await page.getByLabel('Tìm lớp').fill('')
  await page.getByLabel('Lọc theo trạng thái').selectOption('open')
  assert.equal(label((await cur(page))[0]), 'Danh sách lớp')

  await page.getByRole('link', { name: /Lớp Alpha/ }).click()
  assert.ok(page.url().endsWith('/admin/lop/' + CLS_A), 'URL lớp: ' + page.url())
  assert.equal(await page.locator('.ac-root h1').innerText(), 'Lớp Alpha')
  assert.equal(await page.locator('nav[aria-label="Menu Admin"]').count(), 1, 'một sidebar')
  assert.equal(label((await cur(page))[0]), 'Danh sách lớp', 'sidebar giữ mục Danh sách lớp')
  assert.ok((await body()).includes('7 học viên'), 'tổng quan: số học viên')
  assert.equal(await page.locator('.ac-back').count(), 1, 'đúng một nút quay lại')

  const tabs = page.getByRole('navigation', { name: 'Mục của lớp' })
  await tabs.getByRole('link', { name: 'Lịch học' }).click()
  assert.ok(page.url().endsWith(`/admin/lop/${CLS_A}/lich`))
  t = await body()
  assert.ok(t.includes('Alpha buổi một') && t.includes('Alpha buổi hai'), 'lịch có buổi của lớp')
  assert.ok(!t.includes('Beta buổi một'), 'lịch KHÔNG lẫn buổi lớp khác')
  for (const raw of ['scheduled', 'completed', 'holiday']) assert.ok(!t.includes(raw), `không còn mã kỹ thuật "${raw}"`)
  for (const vi of ['Dự kiến', 'Đã hoàn thành', 'Nghỉ']) assert.ok(t.includes(vi), `nhãn "${vi}"`)
  await tabs.getByRole('link', { name: 'Học viên' }).click()
  assert.ok(page.url().endsWith(`/admin/lop/${CLS_A}/hoc-vien`))
  await page.getByText('Học sinh trong lớp').waitFor()
  assert.equal(await page.locator('.ac-root').getByText('Giáo trình lớp').count(), 0, 'không còn tiêu đề/bộ chọn lớp riêng của màn cũ')
  assert.equal(await page.getByRole('tab').count(), 0, 'không còn tab nội bộ của màn cũ')
  await tabs.getByRole('link', { name: 'Giáo trình' }).click()
  assert.ok(page.url().endsWith(`/admin/lop/${CLS_A}/giao-trinh`))
  await tabs.getByRole('link', { name: 'Thiết lập' }).click()
  assert.ok((await body()).includes('Mở Lớp & lịch'))
  await page.goBack(); assert.ok(page.url().endsWith('/giao-trinh'))
  await page.goBack(); assert.ok(page.url().endsWith('/hoc-vien'))
  await page.goForward(); assert.ok(page.url().endsWith('/giao-trinh'))
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.locator('.ac-root h1').innerText(), 'Lớp Alpha', 'reload giữ lớp + tab')
  assert.ok(page.url().endsWith('/giao-trinh'))

  await page.goto(BASE + `/admin/lop/${CLS_A}/khong-co`, { waitUntil: 'networkidle' })
  assert.ok(page.url().endsWith('/admin/lop/' + CLS_A), 'tab sai → tổng quan')
  await page.goto(BASE + '/admin/lop/khong-co-lop', { waitUntil: 'networkidle' })
  assert.ok((await body()).includes('Không tìm thấy lớp'), 'lớp không tồn tại')
  await page.getByRole('link', { name: /Danh sách lớp/ }).first().click()
  await page.getByRole('link', { name: /Lớp Beta/ }).click()
  assert.ok(page.url().endsWith('/admin/lop/' + CLS_B), 'chuyển sang lớp khác')
  await page.getByRole('navigation', { name: 'Mục của lớp' }).getByRole('link', { name: 'Lịch học' }).click()
  t = await body(); assert.ok(t.includes('Beta buổi một') && !t.includes('Alpha buổi một'), 'đổi lớp → lịch đổi theo')
  const writes = log.writes.filter(w => w !== 'POST /rest/v1/edu_tools')
  assert.equal(writes.length, 0, 'V2 không ghi dữ liệu: ' + writes)
  assert.deepEqual(log.errors, [], 'không lỗi JS')
  await ctx.close()
  ok('V2: danh sách lớp (tìm/lọc/rỗng), vào lớp, các mục giữ đúng lớp, lịch chỉ buổi của lớp, Back/Forward/reload, tab sai, lớp không có, đổi lớp, không ghi')
}

// 6b. Giáo trình lớp 40 buổi: đủ 5 chặng + 40 buổi, thao tác Soạn còn, không tràn ngang, input sáng
for (const width of [1440, 390]) {
  const { ctx, page } = await open(`/admin/lop/${CLS_D}/giao-trinh`, { width, height: 900 })
  await page.getByText('Chặng 5 · Chặng thử 5').waitFor()
  const root = page.locator('.ac-root')
  assert.equal(await root.getByRole('button', { name: 'Soạn giáo trình' }).count(), 40, `${width}: đủ 40 buổi`)
  assert.equal(await root.locator('.cu-stage').count(), 5, `${width}: 5 chặng`)
  assert.ok(!(await root.innerText()).includes('scheduled'), `${width}: Giáo trình không còn "scheduled"`)
  assert.ok((await root.innerText()).includes('Dự kiến'), `${width}: Giáo trình có "Dự kiến"`)
  assert.ok(await overflow(page) <= 1, `${width}: giáo trình không tràn (${await overflow(page)})`)
  assert.equal(await page.locator('.ac-root h1').innerText(), 'Lớp Bốn Mươi')
  const bg = await root.locator('select').first().evaluate(e => getComputedStyle(e).backgroundColor)
  assert.equal(bg, 'rgb(255, 255, 255)', `${width}: select nền sáng (${bg})`)
  if (width === 390) {
    const bb = await root.getByRole('button', { name: 'Soạn giáo trình' }).first().boundingBox()
    assert.ok(bb.height >= 40, `${width}: nút Soạn ≥40 (${bb.height})`)
  } else {
    // header lớp dính khi cuộn: tên lớp vẫn thấy sau khi cuộn tới chặng cuối
    await root.getByText('Chặng 5 · Chặng thử 5').scrollIntoViewIfNeeded()
    const hb = await page.locator('.ac-root h1').boundingBox()
    assert.ok(hb && hb.y >= 0 && hb.y < 200, `${width}: tên lớp còn thấy khi cuộn (${JSON.stringify(hb)})`)
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/giaotrinh-${width}.png` })
  await ctx.close()
  ok(`V2 Giáo trình ${width}px: 5 chặng/40 buổi, không tràn, input nền sáng${width === 1440 ? ', header lớp dính' : ', nút ≥40'}`)
}

// 6c. Tên lớp dài: tiêu đề chính là TÊN, mã + trạng thái là thông tin phụ; không tràn ở mọi cỡ
for (const width of [1440, 768, 390, 360]) {
  const { ctx, page } = await open(`/admin/lop/${CLS_E}/giao-trinh`, { width, height: 800 })
  await page.locator('.ac-root h1').waitFor()
  assert.equal(await page.locator('.ac-root h1').innerText(), LONG, `${width}: tiêu đề = tên lớp đầy đủ`)
  const meta = await page.locator('.ac-meta').innerText()
  assert.ok(meta.includes('HT2027.TH01'), `${width}: mã lớp ở dòng phụ`)
  const h = await page.locator('.ac-root h1').boundingBox(), m = await page.locator('.ac-meta').boundingBox()
  assert.ok(m.y >= h.y + h.height - 1, `${width}: dòng phụ nằm dưới tiêu đề`)
  assert.ok(await overflow(page) <= 1, `${width}: tên dài không tràn (${await overflow(page)})`)
  const right = h.x + h.width
  assert.ok(right <= width + 1, `${width}: tiêu đề nằm trong màn hình`)
  await ctx.close()
  ok(`V2 tên lớp dài ${width}px: tiêu đề là tên, mã/trạng thái phụ, không tràn`)
}

// 6d. Hệ thống ở chế độ TỐI: tiêu đề lớp và tiêu đề phần phải đủ tương phản trên nền sáng của Admin
//     (lỗi thật: index.css đặt h1/h2 = --text-h gần trắng → tên lớp "biến mất")
{
  const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }); return .2126 * r + .7152 * g + .0722 * b }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) }
  for (const [tab, sel] of [['', '.ac-root h1'], ['/lich', '.ac-root h2'], ['/hoc-vien', '.ac-root h2'], ['', '.ac-root h2']]) {
    const { ctx, page } = await open(`/admin/lop/${CLS_A}${tab}`, { width: 1440, height: 800, dark: true })
    await page.locator('.ac-root h1').waitFor()
    await page.locator(sel).first().waitFor()
    const { fg, bg } = await page.locator(sel).first().evaluate(e => {
      let n = e, bgc = 'rgba(0, 0, 0, 0)'
      while (n && /rgba\(0, 0, 0, 0\)|transparent/.test(bgc)) { bgc = getComputedStyle(n).backgroundColor; n = n.parentElement }
      return { fg: getComputedStyle(e).color, bg: bgc }
    })
    const r = ratio(fg, bg)
    assert.ok(r >= 4.5, `tối ${tab || '/'} ${sel}: tương phản ${r.toFixed(1)} (${fg} trên ${bg})`)
    await ctx.close()
  }
  ok('V2 chế độ tối của hệ thống: tên lớp và tiêu đề phần đủ tương phản (≥4.5:1)')
}

// 7. V2 responsive + bàn phím
for (const width of [1440, 768, 390, 360]) {
  const { ctx, page } = await open('/admin/lop', { width, height: 800 })
  assert.ok(await overflow(page) <= 1, `${width}: danh sách không tràn (${await overflow(page)})`)
  await page.goto(BASE + `/admin/lop/${CLS_A}`, { waitUntil: 'networkidle' })
  assert.ok(await overflow(page) <= 1, `${width}: tổng quan lớp không tràn`)
  if (width >= 768) {
    assert.ok(await page.locator('.ac-tabs').isVisible() && !(await page.locator('.ac-tabs-select').isVisible()), `${width}: segmented`)
  } else {
    const sel = page.locator('.ac-tabs-select')
    assert.ok(await sel.isVisible() && !(await page.locator('.ac-tabs').isVisible()), `${width}: menu chọn mục thay 5 tab`)
    assert.ok((await sel.boundingBox()).height >= 44, `${width}: chọn mục ≥44`)
    await sel.selectOption('schedule')
    assert.ok(page.url().endsWith('/lich'), `${width}: chọn mục đổi URL`)
    const back = await page.locator('.ac-back').boundingBox()
    assert.ok(back.height >= 44, `${width}: nút quay lại ≥44`)
  }
  await page.goto(BASE + `/admin/lop/${CLS_A}/lich`, { waitUntil: 'networkidle' })
  assert.ok(await overflow(page) <= 1, `${width}: lịch không tràn`)
  await page.goto(BASE + `/admin/lop/${CLS_A}/hoc-vien`, { waitUntil: 'networkidle' })
  assert.ok(await overflow(page) <= 1, `${width}: học viên không tràn (${await overflow(page)})`)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lop-${width}.png` })
  await ctx.close()
  ok(`V2 ${width}px: không tràn ngang; ${width >= 768 ? 'segmented' : 'menu chọn mục ≥44, back ≥44'}`)
}
{
  const { ctx, page } = await open('/admin/lop')
  await page.getByLabel('Tìm lớp').focus()
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab')   // bộ lọc → liên kết lớp đầu tiên
  const focused = await page.evaluate(() => document.activeElement?.className ?? '')
  assert.ok(String(focused).includes('ac-row'), 'Tab tới hàng lớp: ' + focused)
  await page.keyboard.press('Enter')
  assert.ok(/\/admin\/lop\/[0-9a-f-]{36}$/.test(page.url()), 'Enter mở lớp: ' + page.url())
  await ctx.close()
  ok('V2: bàn phím Tab/Enter mở lớp')
}

{ // Tổng quan 7 thành viên ⇔ tab Học viên liệt kê đúng 7; lỗi tải không bị coi là "Chưa có học sinh"
  ROSTER_MODE = 'ok'
  let { ctx, page } = await open(`/admin/lop/${CLS_A}/hoc-vien`)
  await page.getByText('Học viên số 1', { exact: true }).waitFor({ timeout: 5000 })
  assert.equal(await page.getByText(/^Học viên số \d$/).count(), 7, 'liệt kê đủ 7')
  assert.equal(await page.getByText('Chưa có học sinh.').count(), 0)
  await ctx.close()
  ROSTER_MODE = 'error'
  ;({ ctx, page } = await open(`/admin/lop/${CLS_A}/hoc-vien`))
  assert.equal(await page.getByText('Chưa có học sinh.').count(), 0, 'lỗi tải không hiện "Chưa có học sinh"')
  assert.ok((await page.locator('.ac-root').innerText()).includes('roster boom'), 'hiện lỗi tải')
  await ctx.close()
  ROSTER_MODE = 'slow'
  ;({ ctx, page } = await open(`/admin/lop/${CLS_A}/hoc-vien`, { }))
  await page.getByText('Học sinh trong lớp').waitFor()
  assert.equal(await page.getByText('Chưa có học sinh.').count(), 0, 'đang tải roster không hiện "Chưa có học sinh"')
  await page.getByText('Học viên số 1', { exact: true }).waitFor({ timeout: 6000 })
  await ctx.close()
  ROSTER_MODE = 'empty'
  ;({ ctx, page } = await open(`/admin/lop/${CLS_C}/hoc-vien`))
  await page.getByText('Chưa có học sinh.').waitFor({ timeout: 5000 })
  await ctx.close(); ROSTER_MODE = 'ok'
  ok('V2: Học viên ⇔ roster (7), lỗi tải ≠ rỗng, lớp rỗng thật')
}
await browser.close(); server.close()
console.log(`\n${pass} nhóm kiểm PASS`)
