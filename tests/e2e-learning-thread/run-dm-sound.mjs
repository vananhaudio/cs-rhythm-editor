// E2E Sound V1.2 (DM) — xem scripts/e2e-class-dm-sound.sh. Hai tài khoản test cô lập gửi tin THẬT qua UI + dm_send; AudioContext được GIẢ.
// (cũ)  AudioContext được GIẢ (đếm số tiếng thật sự được lên lịch).
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
const navChatBadge = page => page.evaluate(() => {
  const el = [...document.querySelectorAll('.cs-sidebar a, .cs-sidebar button, nav a, nav button')].find(e => /Trò chuyện/.test(e.textContent) && e.querySelector('.cs-nav-badge'))
  return el ? el.querySelector('.cs-nav-badge').textContent.trim() : null
})

const pings = page => page.evaluate(() => window.__pings)   // mỗi tiếng = 2 nốt
const poll = async page => { await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await sleep(1500) }
const setHidden = (page, h) => page.evaluate(v => { Object.defineProperty(document, 'visibilityState', { get: () => v, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) }, h ? 'hidden' : 'visible')
// người gửi: mở hội thoại với B rồi gửi tin
async function openWithB(email) {
  const r = await meAs(email, '/chat', 1280)
  await r.page.waitForSelector('.cs-chat-item:not(.cs-chat-item-system)', { timeout: 20000 })
  await r.page.click('.cs-chat-item:not(.cs-chat-item-system)')
  await r.page.waitForSelector('.cs-chat-input', { timeout: 15000 })
  return r
}
let n = 0
async function say(page, text) {
  await page.click('.cs-chat-input'); await page.type('.cs-chat-input', text)
  await page.click('.cs-chat-send')
  await page.waitForFunction(t => [...document.querySelectorAll('.cs-msg-bubble')].some(e => e.textContent === t), { timeout: 15000 }, text)
  await page.waitForFunction(() => !document.querySelector('.cs-msg-row.is-pending, .cs-msg-row.is-sending'), { timeout: 10000 }).catch(() => {})
  n++
}

const A = await openWithB('a@test.local')
const C = await openWithB('c@test.local')

// ── 1. Tin cũ chưa đọc có sẵn trước khi B tải trang → im lặng (mốc) ──
await say(A.page, 'Tin cũ trước khi B mở trang')
let { ctx: bctx, page: B } = await meAs('b@test.local', '/me', 1280)      // ở TRANG KHÁC (không phải Chat)
await B.mouse.click(700, 500); await sleep(500)
await poll(B)
assert.equal(await pings(B), 0); ok('B tải trang với tin cũ chưa đọc: im lặng (chỉ lập mốc)')
await B.waitForFunction(() => /Trò chuyện/.test(document.body.textContent))
assert.equal(await navChatBadge(B), '1'); ok('Badge = số HỘI THOẠI chưa đọc (1), giống dm_unread_count')

// ── 2. Tin mới khi B ở trang khác → một tiếng (hội thoại ĐÃ ở trạng thái chưa đọc) ──
await say(A.page, 'Tin thứ hai')
await poll(B)
assert.equal(await pings(B), 2); ok('Tin mới trong hội thoại ĐANG chưa đọc → đúng MỘT tiếng (phương án B)')
assert.equal(await navChatBadge(B), '1'); ok('Badge không đổi (vẫn 1 hội thoại) — ngữ nghĩa giữ nguyên')
for (let i = 0; i < 3; i++) await poll(B)
assert.equal(await pings(B), 2); ok('Polling lặp: không kêu lại')

// ── 3. Nhiều tin từ hai hội thoại trong một lượt → tối đa MỘT tiếng ──
await say(A.page, 'Tin ba'); await say(A.page, 'Tin bốn'); await say(C.page, 'Chào từ C')
await poll(B)
assert.equal(await pings(B), 4); ok('3 tin / 2 hội thoại trong một lượt poll → đúng MỘT tiếng')
assert.equal(await navChatBadge(B), '2'); ok('Badge = 2 hội thoại chưa đọc')

// ── 4. Tải lại với tin chưa đọc → im lặng; tin tự gửi → không kêu (mỗi lần goto = tải trang mới, bộ đếm tiếng về 0) ──
await B.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
await B.waitForSelector('.cs-chat-item:not(.cs-chat-item-system)', { timeout: 20000 })
await B.mouse.click(700, 500); await sleep(400); await poll(B)
assert.equal(await pings(B), 0); ok('Tải lại trang khi còn 2 hội thoại chưa đọc: im lặng (mốc mới)')
await B.click('.cs-chat-item:not(.cs-chat-item-system)')
await B.waitForSelector('.cs-chat-input')
await say(B, 'B trả lời')
await poll(B); await poll(B)
assert.equal(await pings(B), 0); ok('Tin do chính B gửi: không kêu')

// ── 5. Tab ẩn: không phát nền; quay lại → đúng một tiếng (B ở trang khác, không mở hội thoại) ──
await B.goto(`${ME}`, { waitUntil: 'networkidle0' })
await B.mouse.click(700, 500); await sleep(500); await poll(B)
assert.equal(await pings(B), 0)
await setHidden(B, true)
await say(A.page, 'Tin khi B ẩn tab')
await sleep(2000)
assert.equal(await pings(B), 0); ok('Tab ẩn: không phát nền')
await setHidden(B, false)
await B.waitForFunction(() => window.__pings >= 2, { timeout: 40000 }); await sleep(800)
assert.equal(await pings(B), 2); ok('Quay lại tab → đúng MỘT tiếng cho tin đến lúc ẩn')
await poll(B); await poll(B)
assert.equal(await pings(B), 2); ok('Không kêu lại sau khi đã bù')

// ── 6. Tắt âm thanh → DM im lặng; Bật lại không bù ──
await B.goto(`${ME}/chat`, { waitUntil: 'networkidle0' }); await B.waitForSelector('.cs-chat-sound [role=switch]')
await B.mouse.click(700, 500); await sleep(300)
await B.click('.cs-chat-sound [role=switch]')
assert.equal(await B.$eval('.cs-chat-sound [role=switch]', e => e.getAttribute('aria-checked')), 'false')
await say(A.page, 'Tin khi B tắt tiếng'); await poll(B)
assert.equal(await pings(B), 0); ok('Tắt âm thanh: tin DM mới im lặng')
await B.click('.cs-chat-sound [role=switch]'); await sleep(500); await poll(B)
assert.equal(await pings(B), 0); ok('Bật lại: không phát bù tin cũ')
await say(A.page, 'Tin sau khi bật lại'); await poll(B)
await B.waitForFunction(() => window.__pings >= 2, { timeout: 5000 }); await sleep(500)
assert.equal(await pings(B), 2); ok('Tin kế tiếp sau khi Bật lại → đúng MỘT tiếng')

// ── 7. Bố cục không đổi (hàng DM, công tắc) ở 390/1280 ──
await bctx.close()
for (const w of [390, 1280]) {
  const r = await meAs('b@test.local', '/chat', w)
  await r.page.waitForSelector('.cs-chat-item', { timeout: 20000 })
  const [sw, iw] = await r.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
  assert.ok(sw <= iw + 1, `${w}: tràn ngang`)
  const fit = await r.page.$$eval('.cs-chat-item', es => es.every(e => e.scrollWidth <= e.clientWidth + 1))
  assert.ok(fit, `${w}: hàng bị tràn`)
  ok(`${w}px: danh sách Chat không tràn ngang, hàng DM vừa khung`)
  await r.ctx.close()
}
await A.ctx.close(); await C.ctx.close()
assert.deepEqual(errors, [], 'không có lỗi console/pageerror: ' + errors.join(' | '))
ok('Không có lỗi console / pageerror')
await browser.close()
console.log(`ALL DM SOUND E2E PASS (${pass})`)
