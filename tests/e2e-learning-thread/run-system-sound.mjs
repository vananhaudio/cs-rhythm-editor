// E2E System Chat Sound V1 — xem scripts/e2e-class-system-sound.sh. AudioContext được GIẢ (đếm số tiếng thật sự được lên lịch).
// B mở Trò chuyện (im lặng) → Thầy chấm → B nghe ĐÚNG MỘT tiếng; polling/focus lặp, đọc thông báo, chuyển trang không kêu lại; Tắt → bền sau tải lại.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const ME = `http://class.localhost:${process.env.VITE_PORT}/me`
const TH01 = 'b1000000-0000-4000-8000-000000000001'
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
})
let pass = 0
const ok = m => { pass++; console.log('PASS: ' + m) }
const errors = []
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function meAs(email, path = '', width = 390) {
  let ctx
  for (let i = 0; !ctx; i++) { try { ctx = await browser.createBrowserContext() } catch (e) { if (i > 3) throw e; await sleep(400) } }
  const page = await ctx.newPage()
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push(`${email} pageerror: ` + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource/.test(m.text())) errors.push(`${email} console: ` + m.text()) })
  await page.evaluateOnNewDocument(() => {
    window.__pings = 0
    class FakeAC {
      constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {} }
      resume() { this.state = 'running'; return Promise.resolve() }
      createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } } }
      createOscillator() { return { connect() {}, frequency: { value: 0 }, type: '', start: () => { window.__pings++ }, stop() {} } }
    }
    window.AudioContext = FakeAC
  })
  await page.goto(ME, { waitUntil: 'networkidle0' })   // đăng nhập ở /me (khách ở màn khác bị đưa về trang chủ), rồi mới tới đích
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', email); await page.type('#cs-login-pass', 'e2e')
  await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  if (path) await page.goto(ME + path, { waitUntil: 'networkidle0' })
  return { ctx, page }
}
const waitText = (page, re, timeout = 15000) => page.waitForFunction(r => new RegExp(r, 'u').test(document.body.textContent), { timeout }, re.source)
async function clickText(page, label, scope = 'button', within = 'body') {
  const h = await page.waitForFunction((l, s, w) => [...document.querySelectorAll(`${w} ${s}`)].find(b => b.textContent.trim() === l && !b.disabled && b.offsetParent !== null),
    { timeout: 15000 }, label, scope, within)
  await h.asElement().click()
}
const noHScroll = async (page, label) => {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  assert.ok(sw <= iw + 1, `${label}: tràn ngang ${sw} > ${iw}`); ok(`${label}: không tràn ngang`)
}
// Trạng thái hàng Class 2.0 trong danh sách
const sysRow = page => page.evaluate(() => {
  const b = document.querySelector('.cs-chat-item-system'); if (!b) return null
  return { name: b.querySelector('.cs-chat-item-name')?.textContent.trim(), preview: b.querySelector('.cs-chat-item-preview')?.textContent.trim(), badge: b.querySelector('.cs-nav-badge')?.textContent.trim() ?? null }
})
const navChatBadge = page => page.evaluate(() => {
  const el = [...document.querySelectorAll('.cs-sidebar a, .cs-sidebar button, nav a, nav button')].find(e => /Trò chuyện/.test(e.textContent) && e.querySelector('.cs-nav-badge'))
  return el ? el.querySelector('.cs-nav-badge').textContent.trim() : null
})
const openList = async (page) => { await page.goto(`${ME}/chat`, { waitUntil: 'networkidle0' }); await page.waitForSelector('.cs-chat-list', { timeout: 15000 }); await page.waitForSelector('.cs-chat-item-system', { timeout: 20000 }) }


const pings = page => page.evaluate(() => window.__pings)   // mỗi tiếng = 2 nốt (oscillator.start × 2)
let ctx, page, threadId, tctx, tpage

// ── 1. B nộp bài 1.1 ──
;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}/sessions/1`, 1280))
await page.waitForSelector('#bai-tra-1\\.1', { timeout: 15000 })
await clickText(page, 'TRẢ BÀI', 'button', '#bai-tra-1\\.1')
await page.waitForSelector('#bai-tra-1\\.1 textarea')
await page.type('#bai-tra-1\\.1 textarea', 'Em gửi bài âm giai C–Am.')
await clickText(page, 'Gửi bài', 'button', '#bai-tra-1\\.1')
await page.waitForFunction(() => /Đã trả · Chờ chấm/.test(document.querySelector('#bai-tra-1\\.1')?.textContent ?? ''), { timeout: 15000 })
await clickText(page, 'Xem cuộc trao đổi', 'button', '#bai-tra-1\\.1')
await page.waitForFunction(() => location.pathname.startsWith('/me/t/'))
threadId = await page.evaluate(() => location.pathname.split('/').pop())
assert.equal(await pings(page), 0); ok('Nộp bài + chuyển trang: không có tiếng')
await ctx.close()

// ── 2. B mở Trò chuyện và ở lại (có một thao tác người dùng để mở khoá âm thanh) ──
;({ ctx, page } = await meAs('b@test.local', '/chat', 1280))
await page.waitForSelector('.cs-chat-item-system', { timeout: 20000 })
await page.waitForSelector('.cs-chat-sound [role=switch]')
assert.equal(await page.$eval('.cs-chat-sound [role=switch]', e => e.getAttribute('aria-checked')), 'true')
assert.match(await page.$eval('.cs-chat-sound', e => e.textContent), /Âm thanh thông báo/)
ok('Trò chuyện có công tắc "Âm thanh thông báo", mặc định Bật')
await page.mouse.click(700, 500)           // thao tác hợp lệ
await sleep(500)
assert.equal(await pings(page), 0); ok('Tải trang + thao tác: im lặng (chưa có thông báo mới)')

// ── 3. Thầy chấm Đạt → B nghe đúng MỘT tiếng ──
;({ ctx: tctx, page: tpage } = await meAs('t@test.local', `/t/${threadId}`, 1280))
await waitText(tpage, /Khi mọi bài trả bắt buộc của buổi đã Đạt/)
await tpage.type('.lt-compose[aria-label="Thầy phản hồi"] textarea', 'Âm giai đều. Đạt.')
await clickText(tpage, 'Đạt')
await waitText(tpage, /Đã đạt/)
await tctx.close()
ok('Thầy chấm Đạt (lt_respond thật)')
await page.waitForFunction(() => window.__pings >= 2, { timeout: 45000 })   // polling tự nhiên (≤30 s)
await sleep(800)
assert.equal(await pings(page), 2, 'đúng một tiếng (2 nốt)')
ok('B đang ở Trò chuyện: polling phát hiện thông báo mới → đúng MỘT tiếng "ting"')
// polling / focus lặp không kêu lại
for (let i = 0; i < 3; i++) { await page.evaluate(() => { window.dispatchEvent(new Event('focus')) }); await sleep(1500) }
assert.equal(await pings(page), 2); ok('Polling/focus lặp 3 lần: không kêu lại')
// chuyển sang màn Class 2.0 + đọc: không kêu
await page.click('.cs-chat-item-system')
await page.waitForSelector('.cs-sys-notice', { timeout: 15000 })
await page.waitForFunction(() => !document.querySelector('.cs-chat-item-system .cs-nav-badge'), { timeout: 15000 })
await sleep(1500)
assert.equal(await pings(page), 2); ok('Mở & đọc thông báo: không kêu')
// Tắt: bền sau khi tải lại
await page.goto(`${ME}/chat`, { waitUntil: 'networkidle0' }); await page.waitForSelector('.cs-chat-sound [role=switch]')
await page.click('.cs-chat-sound [role=switch]')
assert.equal(await page.$eval('.cs-chat-sound [role=switch]', e => e.getAttribute('aria-checked')), 'false')
await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('.cs-chat-sound [role=switch]')
assert.equal(await page.$eval('.cs-chat-sound [role=switch]', e => e.getAttribute('aria-checked')), 'false')
assert.equal(await pings(page), 0, 'trang tải lại: im lặng')
ok('Tắt → lưu trên thiết bị, giữ nguyên sau khi tải lại, không kêu')
await page.screenshot({ path: `${SHOTS}/sound-1280.png` })
await ctx.close()

// ── 4. iPhone 390px: công tắc không tràn ngang, đủ vùng chạm ──
;({ ctx, page } = await meAs('b@test.local', '/chat', 390))
await page.waitForSelector('.cs-chat-sound [role=switch]')
await noHScroll(page, 'iPhone 390 /me/chat')
const h = await page.$eval('.cs-chat-sound [role=switch]', e => e.getBoundingClientRect().height)
assert.ok(h >= 44, 'vùng chạm ≥ 44px'); ok('iPhone: công tắc vùng chạm ≥ 44px')
await page.screenshot({ path: `${SHOTS}/sound-390.png` })
await ctx.close()

assert.deepEqual(errors, [], 'không có lỗi console/pageerror: ' + errors.join(' | '))
ok('Không có lỗi console / pageerror')
await browser.close()
console.log(`ALL SYSTEM SOUND E2E PASS (${pass})`)
