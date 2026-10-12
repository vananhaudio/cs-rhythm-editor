// E2E System Chat Sound V1 — xem scripts/e2e-class-system-sound.sh. AudioContext được GIẢ (đếm số tiếng thật sự được lên lịch).
// B mở Trò chuyện (im lặng) → Thầy chấm → B nghe ĐÚNG MỘT tiếng; polling/focus lặp, đọc thông báo, chuyển trang không kêu lại; Tắt → bền sau tải lại.
// V1.1: iOS ngắt AudioContext → chờ rồi kêu sau lần chạm; tab ẩn → kêu khi quay lại; Tắt không phát bù; bố cục danh sách Chat 390/1280.
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
    window.__gesture = false
    for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, () => { window.__gesture = true; setTimeout(() => { window.__gesture = false }, 150) }, true)
    class FakeAC {
      constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.onstatechange = null; window.__ac = this }
      // như iOS Safari: chỉ resume được khi đang trong thao tác người dùng
      resume() { if (!window.__gesture) return Promise.reject(new Error('NotAllowedError')); this.state = 'running'; if (this.onstatechange) this.onstatechange(); return Promise.resolve() }
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

// ── 5. Bố cục danh sách Chat (V1.1): không khoảng trống dưới Class 2.0, không cắt hàng cuối, cuộn tới hết ──
for (const [w, hh] of [[390, 844], [390, 520], [1280, 800], [1280, 560]]) {
  ;({ ctx, page } = await meAs('b@test.local', '/chat', w))
  await page.setViewport({ width: w, height: hh, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600 })
  await page.waitForSelector('.cs-chat-item-system', { timeout: 20000 })
  await page.waitForFunction(() => document.querySelectorAll('.cs-chat-item').length >= 3, { timeout: 20000 })
  await sleep(500)
  const geo = () => page.evaluate(() => {
    const items = [...document.querySelectorAll('.cs-chat-item')]
    const last = items.at(-1).getBoundingClientRect()
    const chat = document.querySelector('.cs-chat').getBoundingClientRect()
    const ul = document.querySelector('.cs-chat-items-system').getBoundingClientRect()
    const row = document.querySelector('.cs-chat-item-system').getBoundingClientRect()
    return { n: items.length, lastTop: last.top, lastBottom: last.bottom, chatBottom: chat.bottom, gap: ul.height - row.height, innerH: innerHeight }
  })
  let g0 = await geo()
  assert.ok(g0.gap <= 16, `${w}x${hh}: khoảng trống dưới Class 2.0 = ${g0.gap}px`)
  // cuộn tới hết (trang + vùng danh sách) rồi hàng cuối phải nằm trọn trong khung và trong tầm nhìn
  await page.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); document.querySelectorAll('.cs-chat-items').forEach(e => { e.scrollTop = e.scrollHeight }) })
  await sleep(300)
  const g1 = await geo()
  assert.ok(g1.lastBottom <= g1.chatBottom + 1, `${w}x${hh}: hàng cuối bị cắt (bottom ${g1.lastBottom} > khung ${g1.chatBottom})`)
  assert.ok(g1.lastTop >= 0 && g1.lastBottom <= g1.innerH + 1, `${w}x${hh}: hàng cuối ngoài tầm nhìn sau khi cuộn`)
  ok(`${w}x${hh}: Class 2.0 không trống thừa (${Math.round(g0.gap)}px) · ${g0.n} hàng · hàng cuối trọn trong khung và tới được bằng cuộn`)
  await page.screenshot({ path: `${SHOTS}/layout-${w}x${hh}.png` })
  await ctx.close()
}

// ── 6. Sound V1.1: iOS ngắt AudioContext / tab ẩn / Tắt (tóm tắt Class 2.0 được GIẢ ở tầng mạng — chỉ stack cô lập) ──
{
  let sum = { last_seq: 500, last_body: 'Bài trả Buổi 01 của bạn đã được chấm.', last_at: new Date().toISOString(), unread: 0 }
  const bump = (seq, unread) => { sum = { ...sum, last_seq: seq, unread, last_at: new Date().toISOString() } }
  ;({ ctx, page } = await meAs('b@test.local', '', 1280))
  await page.setRequestInterception(true)
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/rpc/class_system_notice_summary'))
      req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([sum]) })
    else req.continue()
  })
  await page.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-chat-sound [role=switch]', { timeout: 20000 })
  const poll = async () => { await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await sleep(1300) }
  const state = () => page.evaluate(() => window.__ac?.state ?? null)
  await page.mouse.click(700, 500); await sleep(400)
  assert.equal(await state(), 'running'); assert.equal(await pings(page), 0)
  await poll(); assert.equal(await pings(page), 0)
  ok('V1.1 nền: sau chạm, AudioContext running; thông báo cũ (đã có từ trước) im lặng')

  // A1: iOS ngắt context → thông báo mới CHỜ; chạm lại → resume → đúng một tiếng
  await page.evaluate(() => { window.__ac.state = 'interrupted' })
  bump(501, 1); await poll()
  assert.equal(await pings(page), 0, 'context bị ngắt: chưa kêu')
  await poll(); await poll()
  assert.equal(await pings(page), 0)
  await page.mouse.click(700, 500)
  await page.waitForFunction(() => window.__pings >= 2, { timeout: 5000 }); await sleep(800)
  assert.equal(await state(), 'running'); assert.equal(await pings(page), 2)
  ok('A1: iOS ngắt AudioContext → thông báo mới chờ (không mất) → chạm lại → resume → đúng MỘT tiếng')
  await poll(); await page.mouse.click(700, 500); await poll()
  assert.equal(await pings(page), 2); ok('A1: polling/chạm lặp: không kêu lại')

  // A2: tab ẩn khi có thông báo → quay lại tab → kêu một lần
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
  bump(502, 1); await poll()
  assert.equal(await pings(page), 2, 'tab ẩn: không kêu')
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForFunction(() => window.__pings >= 4, { timeout: 8000 }); await sleep(800)
  assert.equal(await pings(page), 4); ok('A2: tab ẩn → quay lại → đúng MỘT tiếng cho thông báo mới')
  await poll(); await poll()
  assert.equal(await pings(page), 4); ok('A2: không kêu lại sau khi đã bù')

  // Đã đọc trong lúc chờ → không bù
  await page.evaluate(() => { window.__ac.state = 'interrupted' })
  bump(503, 1); await poll()
  bump(503, 0); await poll()
  await page.mouse.click(700, 500); await sleep(800)
  assert.equal(await pings(page), 4); ok('Đã đọc trong lúc chờ → không phát bù')

  // Tắt: im lặng + không giữ chờ; Bật lại không phát bù; thông báo kế tiếp kêu được
  await page.click('.cs-chat-sound [role=switch]')
  assert.equal(await page.$eval('.cs-chat-sound [role=switch]', e => e.getAttribute('aria-checked')), 'false')
  await page.evaluate(() => { window.__ac.state = 'interrupted' })
  bump(504, 1); await poll()
  await page.mouse.click(700, 500); await sleep(800)
  assert.equal(await pings(page), 4, 'Tắt: im lặng')
  await page.click('.cs-chat-sound [role=switch]')
  await sleep(800); await poll()
  assert.equal(await pings(page), 4, 'Bật lại: không phát bù thông báo cũ')
  bump(505, 1); await poll()
  await page.waitForFunction(() => window.__pings >= 6, { timeout: 5000 }); await sleep(600)
  assert.equal(await pings(page), 6); ok('Tắt → im lặng, không giữ chờ; Bật lại không bù; thông báo mới kế tiếp kêu đúng một tiếng')
  await ctx.close()
}

assert.deepEqual(errors, [], 'không có lỗi console/pageerror: ' + errors.join(' | '))
ok('Không có lỗi console / pageerror')
await browser.close()
console.log(`ALL SYSTEM SOUND E2E PASS (${pass})`)
