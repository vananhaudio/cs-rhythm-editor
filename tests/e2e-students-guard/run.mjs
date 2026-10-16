// E2E route guard /students — Chrome thật + Supabase GIẢ ở tầng mạng (không gọi production, không ghi dữ liệu).
// Chạy: DIST=<thư mục build vite> PLAYWRIGHT_CORE=<playwright-core> [CHROME=<Chrome>] node tests/e2e-students-guard/run.mjs
// Phiên và vai trò (student/teacher/admin) do harness dựng; app không bị bypass auth.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
const DIST = process.env.DIST
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

const ME = '33333333-3333-4333-8333-333333333333'
const session = { access_token: 'x.y.z', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: ME, aud: 'authenticated', role: 'authenticated', email: 'test@test.local', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
const COOKIE = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
let pass = 0
const ok = m => { pass++; console.log('PASS', m) }
const MARK = 'đang học'   // chữ chỉ có trong màn StudentList đã tải

// role: null = chưa đăng nhập. delay: làm chậm app_users để kiểm trạng thái đang tải.
async function ctxFor(role, delay = 0) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
  if (role) await ctx.addCookies([{ name: 'sb-wojmdilyflffvdtpovmq-auth-token', value: COOKIE, url: BASE }])
  const page = await ctx.newPage()
  const log = { dataReads: [], writes: [] }
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
      if (u.pathname.startsWith('/rest/v1/rpc/')) return json(t === 'my_tool_route_access' ? true : [])
      if (u.pathname.startsWith('/rest/v1/')) {
        if (t === 'app_users') { if (delay) await new Promise(r => setTimeout(r, delay)); return json({ id: ME, role, status: 'active', name: 'T', avatar_url: null }) }
        // Đọc theo danh sách (không lọc theo chính chủ) = hành vi của StudentList. Đọc hồ sơ của chính mình (user_id=eq.) ở trang đích là hợp lệ.
        if (['edu_students', 'edu_groups', 'edu_group_members'].includes(t) && !/(^|&)(user_id|id)=eq\./.test(decodeURIComponent(u.search.slice(1)))) log.dataReads.push(t)
        return json([])
      }
      return json({})
    }
    if (u.origin !== BASE) return route.abort()
    return route.continue()
  })
  return { ctx, page, log }
}
const text = page => page.locator('body').innerText()
const onStudents = page => new URL(page.url()).pathname === '/students'
async function expectBlocked(page, log, who) {
  await page.waitForFunction(() => location.pathname !== '/students', null, { timeout: 8000 })
  await page.waitForLoadState('networkidle')
  assert.ok(!(await text(page)).includes(MARK), who + ': không được thấy danh sách học viên')
  assert.deepEqual(log.dataReads, [], who + ': không được đọc dữ liệu học viên: ' + log.dataReads)
}
async function expectAllowed(page, who) {
  await page.waitForFunction(m => document.body.innerText.includes(m), MARK, { timeout: 8000 })
  assert.ok(onStudents(page), who + ': phải ở lại /students')
}

for (const [role, who] of [[null, 'chưa đăng nhập'], ['student', 'học viên']]) {
  const { ctx, page, log } = await ctxFor(role)
  await page.goto(BASE + '/students')                       // điều hướng trực tiếp
  await expectBlocked(page, log, who)
  await page.goto(BASE + '/students'); await page.reload()  // quay lại rồi tải lại trang
  await expectBlocked(page, log, who + ' (tải lại)')
  assert.deepEqual(log.writes, [], 'không ghi dữ liệu')
  ok(`${who} → bị chặn (trực tiếp + tải lại), không đọc bảng học viên`)
  await ctx.close()
}
for (const role of ['teacher', 'admin']) {
  const { ctx, page, log } = await ctxFor(role)
  await page.goto(BASE + '/students')
  await expectAllowed(page, role)
  await page.reload()
  await expectAllowed(page, role + ' (tải lại)')
  assert.deepEqual(log.writes, [], 'không ghi dữ liệu')
  ok(`${role} → vào được /students (trực tiếp + tải lại)`)
  await ctx.close()
}
// Trạng thái đang tải: vai trò chưa về thì KHÔNG hiện danh sách, KHÔNG đá đi sớm, KHÔNG đọc dữ liệu.
{
  const { ctx, page, log } = await ctxFor('teacher', 2500)
  await page.goto(BASE + '/students', { waitUntil: 'commit' })
  await page.waitForTimeout(800)
  assert.ok(onStudents(page), 'đang tải: chưa được đá đi')
  assert.ok(!(await text(page)).includes(MARK), 'đang tải: chưa hiện danh sách')
  assert.deepEqual(log.dataReads, [], 'đang tải: chưa đọc dữ liệu')
  await expectAllowed(page, 'teacher sau khi tải xong')
  ok('đang tải (giáo viên) → không hiện/không đọc sớm, rồi vào được')
  await ctx.close()
}
{
  const { ctx, page, log } = await ctxFor('student', 2500)
  await page.goto(BASE + '/students', { waitUntil: 'commit' })
  await page.waitForTimeout(800)
  assert.ok(!(await text(page)).includes(MARK), 'đang tải: học viên chưa thấy danh sách')
  assert.deepEqual(log.dataReads, [], 'đang tải: học viên chưa đọc dữ liệu')
  await expectBlocked(page, log, 'học viên sau khi tải xong')
  ok('đang tải (học viên) → không lộ danh sách, rồi bị chặn')
  await ctx.close()
}
await browser.close(); server.close()
console.log(`\n${pass} nhóm kiểm PASS`)
