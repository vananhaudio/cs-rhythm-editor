// E2E "Đăng nhập quay về đúng điểm đến" — Chrome thật + Supabase GIẢ ở tầng mạng (không gọi production).
// Chạy: DIST=<thư mục build vite> PLAYWRIGHT_CORE=<playwright-core> [CHROME=<Chrome>] node tests/e2e-login-return/run.mjs
// Host class.localhost (bắt đầu bằng "class." → cùng cấu hình như production Class).
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core')
const DIST = process.env.DIST
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' }
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let f = join(DIST, p)
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(DIST, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' })
  res.end(readFileSync(f))
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const BASE = `http://class.localhost:${server.address().port}`

const ME = '11111111-1111-4111-8111-111111111111'
const VID = '22222222-2222-4222-8222-222222222222'
const session = () => ({ access_token: 'x.y.z', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: ME, aud: 'authenticated', role: 'authenticated', email: 'hs@test.local', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } })
const COOKIE = 'base64-' + Buffer.from(JSON.stringify(session())).toString('base64url')

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
let pass = 0
const ok = m => { pass++; console.log('PASS', m) }

async function open({ signedIn = false, goto = '/start', role = 'student', status = 'active', hasStudent = true, width = 390 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' })
  if (signedIn) await ctx.addCookies([{ name: 'sb-wojmdilyflffvdtpovmq-auth-token', value: COOKIE, url: BASE }])
  const page = await ctx.newPage()
  const log = { external: [], nav: [], logins: 0 }
  page.on('framenavigated', f => { if (f === page.mainFrame()) log.nav.push(new URL(f.url()).pathname + new URL(f.url()).search + new URL(f.url()).hash) })
  await page.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url())
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (u.hostname.endsWith('supabase.co')) {
      const json = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(d) })
      if (u.pathname === '/auth/v1/token') {
        log.logins++
        const body = JSON.parse(req.postData() || '{}')
        if (body.password !== 'dung') return json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400)
        return json(session())
      }
      if (u.pathname === '/auth/v1/user') return json(session().user)
      if (u.pathname.startsWith('/auth/')) return json({})
      const t = u.pathname.split('/').pop()
      if (u.pathname.startsWith('/rest/v1/rpc/')) return json(t === 'my_tool_route_access' ? true : [])
      if (u.pathname.startsWith('/rest/v1/')) {
        if (t === 'app_users') return json({ id: ME, role, status, name: 'HS', avatar_url: null })
        if (t === 'edu_students') return json(hasStudent ? { id: 's1', full_name: 'Học Viên Một', display_name: 'Học Viên Một', email: 'hs@test.local', avatar_url: null, level: 'beginner', is_active: true, enrolled_at: null } : null)
        return json([])
      }
      return json({})
    }
    if (/^fonts.g/.test(u.hostname)) return route.abort()
    if (u.origin !== BASE) { log.external.push(req.url()); return route.abort() }
    return route.continue()
  })
  await page.goto(BASE + goto, { waitUntil: 'networkidle' })
  return { ctx, page, log }
}
const here = page => { const u = new URL(page.url()); return u.pathname + u.search + u.hash }
async function settle(page, ms = 1500) { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(ms) }
/** Mở form đăng nhập trong cổng học (khách) rồi điền. */
async function login(page, password = 'dung') {
  await page.getByText('Đăng nhập', { exact: false }).first().click()
  await page.locator('input[type=email]').waitFor({ timeout: 8000 })
  await page.locator('input[type=email]').fill('hs@test.local')
  await page.locator('input[type=password]').fill(password)
  await page.getByRole('button', { name: /Đăng nhập →/ }).click()
}
const DEST = `/hopam/${VID}?tab=2&x=a%20b#m3`

// 1. Khách mở link cần tài khoản → /start?return → đăng nhập → quay đúng link (path+query+hash)
{
  const { ctx, page, log } = await open({ goto: DEST })
  await settle(page)
  const u = new URL(page.url())
  assert.equal(u.pathname, '/start', 'khách bị đưa tới /start')
  assert.equal(u.searchParams.get('return'), DEST)
  await login(page)
  await page.waitForURL(x => new URL(x).pathname.startsWith('/hopam'), { timeout: 10000 })
  assert.equal(here(page), DEST)
  assert.deepEqual(log.external, [])
  await ctx.close(); ok('khách → link cần tài khoản → /start → đăng nhập → đúng link, giữ query + hash')
}
// 2. Sai mật khẩu → báo lỗi, vẫn ở /start giữ return; thử lại đúng → quay về
{
  const { ctx, page } = await open({ goto: DEST })
  await settle(page)
  await login(page, 'sai')
  await page.getByText('Sai mật khẩu').waitFor({ timeout: 8000 })
  assert.equal(new URL(page.url()).searchParams.get('return'), DEST)
  await page.locator('input[type=password]').fill('dung')
  await page.getByRole('button', { name: /Đăng nhập →/ }).click()
  await page.waitForURL(x => new URL(x).pathname.startsWith('/hopam'), { timeout: 10000 })
  assert.equal(here(page), DEST)
  await ctx.close(); ok('đăng nhập lỗi → thử lại vẫn về đúng điểm đến')
}
// 3. F5 giữa chừng (reload) trên /start?return → vẫn giữ điểm đến
{
  const { ctx, page } = await open({ goto: DEST })
  await settle(page)
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(new URL(page.url()).searchParams.get('return'), DEST)
  await login(page)
  await page.waitForURL(x => new URL(x).pathname.startsWith('/hopam'), { timeout: 10000 })
  assert.equal(here(page), DEST)
  await ctx.close(); ok('reload trang đăng nhập vẫn giữ điểm đến')
}
// 4. Đã đăng nhập → mở link → vào thẳng, không qua /start
{
  const { ctx, page, log } = await open({ signedIn: true, goto: DEST })
  await settle(page)
  assert.equal(here(page), DEST)
  assert.ok(!log.nav.some(p => p.startsWith('/start')), 'không đi qua /start')
  await ctx.close(); ok('đã đăng nhập → vào thẳng nội dung')
}
// 5. Đã có phiên mở /start?return=… → chuyển tới điểm đến
{
  const { ctx, page } = await open({ signedIn: true, goto: '/start?return=' + encodeURIComponent(DEST) })
  await page.waitForURL(x => new URL(x).pathname.startsWith('/hopam'), { timeout: 10000 })
  assert.equal(here(page), DEST)
  await ctx.close(); ok('đã có phiên + /start?return → tới điểm đến')
}
// 6. Vào /start trực tiếp → đăng nhập → ở cổng học mặc định
{
  const { ctx, page } = await open({ goto: '/start' })
  await settle(page)
  await login(page)
  await settle(page, 2500)
  assert.equal(new URL(page.url()).pathname, '/start')
  assert.equal(new URL(page.url()).search, '')
  await ctx.close(); ok('/start trực tiếp → đăng nhập → trang mặc định, không điểm đến thừa')
}
// 7. Điểm đến độc hại / trỏ lại /start → bị bỏ, ở cổng học, không rời site, không lặp
for (const bad of ['https://evil.example/x', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/start', '/start?tab=me']) {
  const { ctx, page, log } = await open({ goto: '/start?return=' + encodeURIComponent(bad) })
  await settle(page)
  await login(page)
  await settle(page, 2000)
  assert.equal(new URL(page.url()).origin, BASE, `${bad}: không rời site`)
  assert.ok(new URL(page.url()).pathname.startsWith('/start'), `${bad}: ở cổng học (${page.url()})`)
  assert.deepEqual(log.external, [], `${bad}: không gọi ra ngoài`)
  assert.ok(log.nav.length <= 3, `${bad}: không lặp (${log.nav.join(' > ')})`)
  await ctx.close()
}
ok('return ngoài site / lẫn ký tự / chính /start → bị bỏ, không rời site, không lặp')
// 8. Đã đăng nhập nhưng thiếu quyền (/thuvien: không phải Biên tập) → /start TRẦN, không vòng lặp
{
  const { ctx, page, log } = await open({ signedIn: true, goto: '/thuvien' })
  await settle(page, 3000)
  assert.equal(new URL(page.url()).pathname, '/start')
  assert.equal(new URL(page.url()).search, '', 'thiếu quyền → /start trần')
  assert.ok(log.nav.filter(p => p.startsWith('/start')).length <= 2, `không lặp (${log.nav.join(' > ')})`)
  await ctx.close(); ok('đã đăng nhập thiếu quyền → /start trần, không lặp')
}
// 9. Khách mở trang giáo viên → /start?return; đăng nhập học sinh → tới trang đó → thiếu quyền → /start trần (không mở rộng quyền)
{
  const { ctx, page, log } = await open({ goto: '/admin' })
  await settle(page)
  const dest = new URL(page.url()).searchParams.get('return')
  assert.equal(dest, '/admin')
  await login(page)
  await page.waitForTimeout(3000)
  assert.equal(new URL(page.url()).pathname, '/start')
  assert.equal(new URL(page.url()).search, '')
  await ctx.close(); ok('học sinh đăng nhập từ link /admin → quyền vẫn kiểm như cũ, về /start trần')
}
// 10. Link công khai không bị bắt đăng nhập
for (const p of ['/', '/solo01', '/tempo', '/ytplayer']) {
  const { ctx, page } = await open({ goto: p })
  await settle(page, 1500)
  assert.ok(!new URL(page.url()).pathname.startsWith('/start'), `${p} công khai (${page.url()})`)
  await ctx.close()
}
ok('link công khai (/, /solo01, /tempo, /ytplayer) không bị chuyển sang /start')

await browser.close(); server.close()
console.log(`\n${pass} nhóm PASS`)
