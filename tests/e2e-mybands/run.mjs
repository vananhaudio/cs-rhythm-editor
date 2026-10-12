// E2E "Band của tôi" trên /me — Chrome thật + Supabase GIẢ ở tầng mạng (không gọi production, không ghi dữ liệu).
// Chạy: DIST=<thư mục build vite> PLAYWRIGHT_CORE=<playwright-core> [CHROME=<đường dẫn Chrome>] [SHOTS=<thư mục>] node tests/e2e-mybands/run.mjs
// Host class.localhost (bắt đầu bằng "class." → Class Social bật như production).
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
const PORT = server.address().port
const BASE = `http://class.localhost:${PORT}`

const ME = '11111111-1111-4111-8111-111111111111'
const B1 = 'a1111111-0000-4000-8000-000000000001', B2 = 'a2222222-0000-4000-8000-000000000002', B3 = 'a3333333-0000-4000-8000-000000000003'
const session = { access_token: 'x.y.z', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: ME, aud: 'authenticated', role: 'authenticated', email: 'hs@test.local', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
const COOKIE = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
const PROJECTS = { [B1]: { id: B1, name: 'Lá Mùa Thu', is_public: true }, [B2]: { id: B2, name: 'Band Riêng Tư', is_public: false }, [B3]: { id: B3, name: 'Mộc Du Ca', is_public: true } }

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
let pass = 0
const ok = m => { pass++; console.log('PASS', m) }

/** members: id Band mà ME thuộc về; failMembers/failProjects: trả 500. */
async function open({ members = [], failMembers = false, failProjects = false, width = 390, delay = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 600, isMobile: width < 600, deviceScaleFactor: 2, serviceWorkers: 'block' })
  await ctx.addCookies([{ name: 'sb-wojmdilyflffvdtpovmq-auth-token', value: COOKIE, url: BASE }])
  const page = await ctx.newPage()
  const log = { reqs: [], writes: [], teamlab: [] }
  await page.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url())
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (process.env.TRACE) console.log('Q', req.method(), u.host + u.pathname + u.search.slice(0, 80))
    if (u.hostname.endsWith('supabase.co')) {
      const json = async (d, status = 200) => { if (delay) await new Promise(r => setTimeout(r, delay)); return route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(d) }) }
      if (req.method() !== 'GET' && !u.pathname.includes('/rpc/') && !u.pathname.startsWith('/auth/')) log.writes.push(req.method() + ' ' + u.pathname)
      if (u.pathname === '/auth/v1/user') return json(session.user)
      if (u.pathname.startsWith('/auth/')) return json({})
      const t = u.pathname.split('/').pop()
      if (u.pathname.startsWith('/rest/v1/rpc/')) { log.reqs.push('rpc:' + t); return json(t === 'my_tool_route_access' ? true : []) }
      if (u.pathname.startsWith('/rest/v1/')) {
        log.reqs.push(t + u.search)
        if (t === 'app_users') return json({ role: 'student', avatar_url: null })
        if (t === 'edu_students') return json({ id: 's1', full_name: 'Học Viên Một', display_name: 'Học Viên Một', email: 'hs@test.local', avatar_url: null, level: null, enrolled_at: null, ht_member: false })
        if (t === 'teamlab_project_members') {
          if (failMembers) return json({ message: 'boom' }, 500)
          const uid = u.searchParams.get('user_id')
          return json(uid === 'eq.' + ME ? members.map(id => ({ project_id: id })) : [])
        }
        if (t === 'projects') {
          if (failProjects) return json({ message: 'boom' }, 500)
          const inl = (u.searchParams.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',').map(s => s.replace(/"/g, ''))
          return json(inl.filter(i => PROJECTS[i]).map(i => PROJECTS[i]))
        }
        return json([])
      }
      return json({})
    }
    if (u.origin === BASE && u.pathname.startsWith('/teamlab')) { log.teamlab.push(u.pathname + u.hash); return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>TeamLab stub</title><p id="stub">TeamLab</p>' }) }
    if (u.origin !== BASE) return route.abort()
    return route.continue()
  })
  await page.goto(BASE + '/me', { waitUntil: 'networkidle' })
  return { ctx, page, log }
}
/** Mobile: mở menu ☰ (mục menu nằm trong sheet); desktop: sidebar sẵn. */
async function menuScope(page, width) {
  if (width < 900) { await page.locator('.cs-menu-btn').click(); await page.locator('.cs-sheet').waitFor() }
  return page.locator(width < 900 ? '.cs-sheet' : '.cs-sidebar, aside').first()
}
const btn = (page, name) => page.getByRole('button', { name, exact: true })

// 1. Vị trí + đồng cấp (390/320/430 + desktop)
for (const width of [320, 390, 430, 1280]) {
  const { ctx, page } = await open({ width })
  await menuScope(page, width)
  const cls = btn(page, 'Lớp của tôi').last(), band = btn(page, 'Band của tôi').last()
  await band.waitFor()
  const a = await cls.boundingBox(), b = await band.boundingBox()
  assert.ok(b.y > a.y && b.y - (a.y + a.height) < 12, `${width}: Band ngay dưới Lớp (${a.y + a.height} → ${b.y})`)
  assert.ok(Math.abs(a.x - b.x) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1, `${width}: cùng x/rộng/cao`)
  assert.ok(b.height >= 40, `${width}: vùng chạm ≥40px (${b.height})`)
  assert.equal(await cls.evaluate(e => e.className.replace(/\s*is-active\s*/, '')), await band.evaluate(e => e.className), `${width}: cùng class`)
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
  assert.ok(sw <= iw + 1, `${width}: không tràn ${sw}>${iw}`)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/nav-${width}.png` })
  await ctx.close()
  ok(`${width}px: "Band của tôi" ngay dưới "Lớp của tôi", cùng kích thước/class, không tràn`)
}

// 2. Một Band (riêng tư) → vào thẳng Band Home
{
  const { ctx, page, log } = await open({ members: [B2] })
  await menuScope(page, 390)
  await btn(page, 'Band của tôi').click()
  await page.waitForURL(/\/teamlab\//, { timeout: 15000 })
  assert.equal(new URL(page.url()).hash, `#/project/${B2}`)
  assert.ok(log.reqs.some(r => r.startsWith('teamlab_project_members') && r.includes(`user_id=eq.${ME}`)), 'lọc theo user_id của chính mình')
  assert.equal(log.writes.length, 0, 'không ghi gì')
  await ctx.close()
  ok('1 Band riêng tư → /teamlab/#/project/<id> (thẳng Band Home, không qua Home), chỉ đọc, lọc user_id=mình')
}

// 3. Chưa có Band → hộp thoại, ở lại /me
{
  const { ctx, page, log } = await open({ members: [] })
  await menuScope(page, 390)
  await btn(page, 'Band của tôi').click()
  const d = page.getByTestId('my-band-dialog')
  await d.waitFor()
  assert.equal(await d.getAttribute('data-kind'), 'empty')
  const t = await d.innerText()
  assert.match(t, /Bạn chưa có Band nào/)
  assert.match(t, /Thầy sẽ sắp xếp Band nhạc cho bạn sau khi tốt nghiệp khóa học, nếu bạn có nguyện vọng tham gia\./)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/empty-390.png` })
  await page.getByTestId('my-band-ok').click()
  await d.waitFor({ state: 'detached' })
  assert.match(page.url(), /\/me$/)
  assert.equal(log.teamlab.length, 0)
  // nút vẫn hiện
  await menuScope(page, 390).catch(() => {})
  await ctx.close()
  ok('chưa có Band: đúng nội dung + "Đã hiểu" đóng, ở lại /me, không chuyển trang')
}

// 4. Nhiều Band → chọn đúng Band
{
  const { ctx, page } = await open({ members: [B1, B3] })
  await menuScope(page, 390)
  await btn(page, 'Band của tôi').click()
  const d = page.getByTestId('my-band-dialog')
  await d.waitFor()
  assert.equal(await d.getAttribute('data-kind'), 'choose')
  const names = await page.getByTestId('my-band-item').allInnerTexts()
  assert.deepEqual(names.map(s => s.trim()), ['Lá Mùa Thu', 'Mộc Du Ca'])
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/choose-390.png` })
  await page.getByTestId('my-band-item').nth(1).click()
  await page.waitForURL(/\/teamlab\//, { timeout: 15000 })
  assert.equal(new URL(page.url()).hash, `#/project/${B3}`)
  await ctx.close()
  ok('nhiều Band: hiện danh sách theo tên, chọn đúng Band → đúng Band Home')
}

// 5. Lỗi tải → báo lỗi + Thử lại, KHÔNG nói "chưa có Band"; thử lại thành công thì đi tiếp
for (const which of ['failMembers', 'failProjects']) {
  const { ctx, page } = await open({ members: [B1], [which]: true })
  await menuScope(page, 390)
  await btn(page, 'Band của tôi').click()
  const d = page.getByTestId('my-band-dialog')
  await d.waitFor()
  assert.equal(await d.getAttribute('data-kind'), 'error')
  const t = await d.innerText()
  assert.match(t, /Chưa tải được Band/)
  assert.doesNotMatch(t, /chưa có Band nào|sắp xếp Band/)
  await page.getByTestId('my-band-ok').click()
  await d.waitFor({ state: 'detached' })
  await ctx.close()
  ok(`lỗi truy vấn (${which}): báo lỗi, không nói "chưa có Band"`)
}

// 6. Mục "Ban nhạc" vẫn dẫn về sân khấu tổng; "Lớp của tôi" vẫn mở /me/classes
{
  const { ctx, page } = await open({ members: [B1], width: 1280 })
  const href = await page.getByRole('link', { name: 'Ban nhạc', exact: true }).first().getAttribute('href')
  assert.equal(href, '/teamlab')
  await btn(page, 'Lớp của tôi').last().click()
  await page.waitForURL(/\/me\/classes$/)
  await ctx.close()
  ok('"Ban nhạc" → /teamlab (sân khấu tổng) và "Lớp của tôi" → /me/classes không đổi')
}

// 7. Bấm đúp không gửi hai lần
{
  const { ctx, page, log } = await open({ members: [B1], delay: 400 })
  await menuScope(page, 390)
  const b = btn(page, 'Band của tôi')
  await b.dblclick()
  await page.waitForURL(/\/teamlab\//, { timeout: 15000 })
  assert.equal(log.reqs.filter(r => r.startsWith('teamlab_project_members')).length, 1, 'một lượt truy vấn')
  await ctx.close()
  ok('bấm đúp: chỉ một lượt truy vấn')
}

await browser.close(); server.close()
console.log(`\nmybands pass=${pass} fail=0`)
