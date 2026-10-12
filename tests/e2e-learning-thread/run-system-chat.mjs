// E2E System Chat V1 (Class 2.0) trong Chrome thật — xem scripts/e2e-class-system-chat.sh.
// B (học viên TH01, có giáo trình) nộp bài 1.1 → T (Thầy) chấm Đạt qua UI (lt_respond thật) → B thấy thông báo trong Trò chuyện → "Xem kết quả".
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

let ctx, page, threadId

// ── 1. B nộp bài 1.1 (chưa chấm): Class 2.0 có nhưng chưa có thông báo ──
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
await openList(page)
let row = await sysRow(page)
assert.equal(row.name, 'Class 2.0'); assert.equal(row.preview, 'Chưa có thông báo'); assert.equal(row.badge, null)
assert.equal(await navChatBadge(page), null)
ok('B đã nộp bài, CHƯA chấm: mục "Class 2.0" có trong Trò chuyện, "Chưa có thông báo", không badge (nộp bài không phát thông báo)')
await ctx.close()

// ── 2. Thầy chấm Đạt qua UI (lt_respond thật) ──
;({ ctx, page } = await meAs('t@test.local', `/t/${threadId}`, 1280))
await waitText(page, /Khi mọi bài trả bắt buộc của buổi đã Đạt/)
await page.type('.lt-compose[aria-label="Thầy phản hồi"] textarea', 'Âm giai đều, chuyển vùng ổn. Đạt.')
await clickText(page, 'Đạt')
await waitText(page, /nhận xét · Đạt/); await waitText(page, /Đã đạt/)
ok('Thầy chấm Đạt (lt_respond thật, qua giao diện)')
await openList(page)
row = await sysRow(page)
assert.equal(row.badge, null, 'Thầy không nhận thông báo chấm bài của học viên')
ok('Thầy: kênh Class 2.0 không có thông báo (không gửi nhầm cho giáo viên)')
await ctx.close()

// ── 3. B nhận thông báo: danh sách → màn Class 2.0 → Xem kết quả ──
;({ ctx, page } = await meAs('b@test.local', '/chat', 1280))
await page.waitForSelector('.cs-chat-item-system', { timeout: 20000 })
await page.waitForFunction(() => document.querySelector('.cs-chat-item-system .cs-nav-badge'), { timeout: 20000 })
row = await sysRow(page)
assert.equal(row.preview, 'Bài trả Buổi 01 của bạn đã được chấm.'); assert.equal(row.badge, '1')
assert.equal(await navChatBadge(page), '1', 'badge menu Trò chuyện = 1')
assert.ok(!/Đạt|Âm giai đều/.test(row.preview), 'thông báo không chứa kết quả/nhận xét')
ok('B: Trò chuyện có badge 1 · hàng Class 2.0 "Bài trả Buổi 01 của bạn đã được chấm." (ngắn, không nêu kết quả/nhận xét)')
await page.screenshot({ path: `${SHOTS}/sc-1280-list.png` })
// mở danh sách KHÔNG tự đánh dấu đã đọc
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => document.querySelector('.cs-chat-item-system .cs-nav-badge'), { timeout: 20000 })
assert.equal((await sysRow(page)).badge, '1'); ok('Tải lại danh sách: vẫn chưa đọc (chỉ mở danh sách không đánh dấu đã đọc)')

await page.click('.cs-chat-item-system')
await page.waitForFunction(() => location.pathname === '/me/chat/system')
await page.waitForSelector('.cs-sys-notice', { timeout: 15000 })
const view = await page.evaluate(() => ({
  notices: [...document.querySelectorAll('.cs-sys-notice')].map(n => n.querySelector('.cs-sys-body').textContent.trim()),
  action: document.querySelector('.cs-sys-action')?.textContent.replace(/\s+/g, ' ').trim(),
  inputs: document.querySelectorAll('.cs-chat-pane textarea, .cs-chat-pane input').length,
  foot: document.querySelector('.cs-chat-locked')?.textContent.trim(),
}))
assert.deepEqual(view.notices, ['Bài trả Buổi 01 của bạn đã được chấm.'])
assert.match(view.action, /Xem kết quả/); assert.equal(view.inputs, 0, 'không có ô nhập'); assert.match(view.foot, /thông báo chính thức từ Class 2\.0/)
ok('Màn Class 2.0: đúng 1 thông báo · nút "Xem kết quả →" · không ô nhập · "Đây là thông báo chính thức từ Class 2.0."')
await page.screenshot({ path: `${SHOTS}/sc-1280-system.png` })
await page.waitForFunction(() => !document.querySelector('.cs-chat-item-system .cs-nav-badge'), { timeout: 15000 })
assert.equal(await navChatBadge(page), null)
ok('Mở Class 2.0 → đánh dấu đã đọc: badge hàng + badge menu về 0')
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForSelector('.cs-sys-notice')
await page.goto(`${ME}/chat`, { waitUntil: 'networkidle0' }); await page.waitForSelector('.cs-chat-item-system')
await sleep(1200)
assert.equal((await sysRow(page)).badge, null); ok('Tải lại: không bật lại chưa đọc (không vòng lặp đánh dấu)')

await page.click('.cs-chat-item-system'); await page.waitForSelector('.cs-sys-notice')
await clickText(page, 'Xem kết quả →', 'button', '.cs-sys-notice').catch(async () => { await page.click('.cs-sys-action') })
await page.waitForFunction(id => location.pathname === `/me/t/${id}` && location.search === '?focus=ket-qua', { timeout: 15000 }, threadId)
await waitText(page, /Bài trả 1\.1 · Âm giai C–Am/); await waitText(page, /nhận xét · Đạt/)
await page.waitForSelector('.lt-ev.is-teacher.is-focus', { timeout: 10000 })
const inView = await page.$eval('.lt-ev.is-teacher.is-focus', e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight })
assert.ok(inView, 'phản hồi chấm bài nằm trong tầm nhìn')
ok('"Xem kết quả" → đúng /me/t/<bài trả> · hiện nhận xét/kết quả mới nhất từ hệ thống gốc · phản hồi của Thầy được đưa vào tầm nhìn')
await ctx.close()

// ── 4. Cách ly: A (cùng lớp, không phải chủ bài) không thấy; vào thẳng /me/chat/system → rỗng ──
;({ ctx, page } = await meAs('a@test.local', '/chat/system', 390))
await page.waitForSelector('.cs-sys-empty, .cs-sys-notice', { timeout: 20000 })
assert.equal(await page.$$eval('.cs-sys-notice', e => e.length), 0)
await waitText(page, /Chưa có thông báo nào/)
ok('A (không phải chủ bài) vào thẳng /me/chat/system: 0 thông báo (không thấy thông báo của B)')
await ctx.close()

// ── 5. Đích không còn / không có quyền → không trắng trang ──
;({ ctx, page } = await meAs('b@test.local', '/t/99999999-aaaa-4aaa-8aaa-999999999999?focus=ket-qua', 390))
await waitText(page, /Không tìm thấy|không có quyền|không xem được/i)
assert.ok(await page.evaluate(() => document.body.textContent.trim().length > 50), 'không trắng trang')
ok('Thread đích không tồn tại / không quyền: hiện thông báo nhẹ, không trắng trang, không lỗi')
await ctx.close()

// ── 6. Responsive: danh sách + màn Class 2.0 ──
for (const w of [320, 390, 768, 1280, 1440]) {
  ;({ ctx, page } = await meAs('b@test.local', '/chat', w))
  await page.waitForSelector('.cs-chat-item-system', { timeout: 20000 })
  await noHScroll(page, `Trò chuyện ${w}px`)
  await page.click('.cs-chat-item-system'); await page.waitForSelector('.cs-sys-notice')
  await noHScroll(page, `Class 2.0 ${w}px`)
  const act = await page.$eval('.cs-sys-action', e => { const r = e.getBoundingClientRect(); return r.height >= 32 && r.left >= 0 && r.right <= innerWidth })
  assert.ok(act, `${w}px: nút "Xem kết quả" nằm trong màn và đủ cao`)
  if (w === 390 || w === 320) await page.screenshot({ path: `${SHOTS}/sc-${w}-system.png` })
  await ctx.close()
}
ok('Responsive 320/390/768/1280/1440: danh sách + Class 2.0 không tràn ngang, nút bấm được')

await browser.close()
assert.deepEqual(errors, [], 'console/page errors: ' + errors.join(' | '))
ok('không có lỗi console/pageerror')
console.log(`ALL SYSTEM CHAT E2E PASS (${pass})`)
