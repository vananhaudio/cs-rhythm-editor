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
const COOKIE = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
let pass = 0
const ok = m => { pass++; console.log('PASS', m) }

const SECTIONS = [ // [đường dẫn, nhãn menu]
  ['/admin', 'Tổng quan'], ['/admin/schedule', 'Lớp & lịch'], ['/admin/classes', 'Giáo trình lớp'], ['/admin/ht2027', 'Thực hành HT2027'],
  ['/admin/students', 'Học viên'], ['/admin/leads', 'Đăng ký'], ['/admin/community', 'Nhóm cộng đồng'],
  ['/admin/courses', 'Khoá học'], ['/admin/journey', 'Hành trình'], ['/admin/tools', 'Công cụ'], ['/admin/nhipphach', 'Nhịp phách'],
  ['/admin/newsfeed', 'Bản tin trong app'], ['/admin/articles', 'Bài viết tuyển sinh'], ['/admin/showcase', 'Trang Showcase'],
  ['/admin/daily-mail', 'Thư hàng ngày'], ['/admin/chat-mail', 'Chat Mail'],
  ['/admin/aichat', 'AI tuyển sinh'], ['/admin/assistant', 'Trợ lý quản trị'],
]

async function open(path, { width = 1440, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 600, isMobile: width < 600, serviceWorkers: 'block' })
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
      if (u.pathname.startsWith('/rest/v1/rpc/')) return json((t === 'is_teacher' || t === 'my_tool_route_access') ? true : [])
      if (u.pathname.startsWith('/rest/v1/')) {
        if (t === 'app_users') return json({ role: 'teacher', status: 'active', avatar_url: null })
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
  ok('18 URL + 2 slug cũ vào đúng mục, một sidebar, không "← Admin" trùng, không ghi dữ liệu')
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

// 3. Tổng quan: không số hardcode; lối tắt đổi URL; Ht2027 → Lớp & lịch đổi URL
{
  const { ctx, page } = await open('/admin')
  const txt = await page.locator('body').innerText()
  assert.ok(!/577|\b13\b|đang hoạt động|đã tạo|đang cập nhật/.test(txt), 'không còn số liệu hardcode')
  for (const [name, re] of [['Đăng ký', /leads$/], ['Lớp & lịch', /schedule$/], ['Học viên', /students$/], ['Giáo trình lớp', /classes$/]]) {
    await page.goto(BASE + '/admin', { waitUntil: 'networkidle' })
    await page.getByRole('main').or(page.locator('body')).getByRole('link', { name: new RegExp(name.replace('&', '&') + ' →') }).click()
    assert.match(page.url(), re, `lối tắt ${name}`)
  }
  await page.goto(BASE + '/admin/ht2027', { waitUntil: 'networkidle' })
  const btnOpen = page.getByRole('button', { name: /Mở Lịch lớp/ })
  if (await btnOpen.count()) { await btnOpen.first().click(); assert.match(page.url(), /schedule$/, 'nút trong trang đồng bộ URL') }
  await ctx.close()
  ok('Tổng quan không số cứng; 4 lối tắt cập nhật URL; nút nội bộ Ht2027 đồng bộ URL')
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

await browser.close(); server.close()
console.log(`\n${pass} nhóm kiểm PASS`)
