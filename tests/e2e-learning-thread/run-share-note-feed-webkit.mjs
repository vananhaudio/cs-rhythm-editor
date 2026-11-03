// E2E Share Note FEED PREVIEW V1 trên WebKit (Playwright) — chạy SAU run-share-note-feed.mjs (dùng 6 bài Feed đã đăng). WebKit ≠ Safari iOS thật.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

const require = createRequire((process.env.PLAYWRIGHT_DIR || process.env.PUPPETEER_DIR) + '/')
const { webkit } = require('playwright-core')
const ORIGIN = `http://class.localhost:${process.env.VITE_PORT}`, ME = `${ORIGIN}/me`
const SHOTS = process.env.SHOTS
const browser = await webkit.launch()
let pass = 0
const ok = m => { pass++; console.log('PASS: [webkit feed] ' + m) }
const errors = []
async function open(email, vp) {
  const ctx = await browser.newContext(vp); const page = await ctx.newPage()
  page.reqs = []; page.on('request', r => page.reqs.push(r.url()))
  page.on('pageerror', e => errors.push(`${email} pageerror: ${e.message}`))
  await page.goto(ME, { waitUntil: 'networkidle' })
  await page.fill('#cs-login-email', email); await page.fill('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 20000 })
  await page.goto(ME, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="share-note-post"]').length >= 6, null, { timeout: 40000 })
  return page
}
const surfaces = p => p.evaluate(() => ({ live: document.querySelectorAll('[data-testid="share-note-preview"][data-live="1"]').length, surfaces: document.querySelectorAll('.at-surface').length }))
const printed = p => p.evaluate(() => { const i = [...document.querySelectorAll('[data-testid="share-note-post"]')].findIndex(e => e.querySelector('[data-live="1"] .at-surface svg'))
  return { i, bars: i < 0 ? [] : [...document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelectorAll('svg text')].filter(t => /^\d+$/.test(t.textContent.trim()) && /c80000|rgb\(200, ?0, ?0\)/i.test(t.getAttribute('fill') || '')).map(t => Number(t.textContent.trim())),
    q: i < 0 ? '' : document.querySelectorAll('[data-testid="share-note-post"]')[i].textContent, sw: document.documentElement.scrollWidth <= innerWidth + 1 } })

for (const [name, vp] of [['iPhone 390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['desktop 1280', { viewport: { width: 1280, height: 900 } }]]) {
  const B = await open('b@test.local', vp)
  await B.evaluate(() => document.querySelector('[data-testid="share-note-post"]').scrollIntoView({ block: 'center' }))
  await B.waitForSelector('[data-testid="share-note-preview"][data-live="1"] .at-surface svg', { timeout: 40000 }); await B.waitForTimeout(900)
  const p = await printed(B)
  const m = p.q.match(/FEED-(\d) Ô (\d+)–(\d+)/); assert.ok(m, p.q.slice(0, 80))
  assert.ok(p.bars.length > 0 && Math.min(...p.bars) === Number(m[2]), `số ô in ra bắt đầu ĐÚNG ô ${m[2]}: ${p.bars}`)
  assert.ok(p.sw, 'không tràn ngang')
  let maxLive = 0, maxSurf = 0
  const total = await B.evaluate(() => document.querySelectorAll('[data-testid="share-note-post"]').length)
  for (let k = 0; k < 2; k++) for (let i = 0; i < total; i++) { await B.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), i); await B.waitForTimeout(800); const s = await surfaces(B); maxLive = Math.max(maxLive, s.live); maxSurf = Math.max(maxSurf, s.surfaces) }
  assert.ok(maxLive <= 2 && maxSurf <= 2, `renderer sống tối đa 2: ${maxLive}/${maxSurf}`)
  await B.screenshot({ path: `${SHOTS}/fp-wk-${name.startsWith('iPhone') ? 'iphone' : 'desktop'}-feed.png` })
  await B.evaluate(() => { const els = [...document.querySelectorAll('[data-testid="share-note-post"]')]; els.find(e => e.querySelector('.cs-sn-preview'))?.scrollIntoView({ block: 'center' }) }); await B.waitForTimeout(700)
  await Promise.all([B.waitForURL(/note=/, { timeout: 30000 }), B.locator('.cs-sn-preview').first().click()])
  await B.waitForSelector('.lsn-share-hl.is-focus', { timeout: 40000 })
  ok(`${name}: trích đoạn từ ô ${m[2]} (in ra ${p.bars}), không tràn ngang; cuộn 6 thẻ × 2: sống tối đa ${maxLive}, bề mặt tối đa ${maxSurf}; bấm → mở đúng đoạn (vùng tô)`)
}
const C = await open('c@test.local', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
for (let i = 0; i < 6; i++) { await C.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), i); await C.waitForTimeout(500) }
await C.waitForFunction(() => [...document.querySelectorAll('[data-testid="share-note-post"]')].filter(e => /chưa có quyền xem bản nhạc/.test(e.textContent)).length >= 6, null, { timeout: 40000 })
assert.equal((await surfaces(C)).surfaces, 0)
assert.equal(C.reqs.filter(u => /class_lesson_content|class_sessions/.test(u)).length, 0, 'Chi không đọc giáo trình')
ok('Chi (lớp khác): 6 thẻ chỉ câu hỏi + "chưa có quyền"; 0 bản nhạc; 0 yêu cầu đọc giáo trình')
// WebKit báo request bị HUỶ khi test chuyển trang (goto / bấm xem trước) giữa chừng thành pageerror "… due to access control checks" / "Importing a module script failed"
// (chunk lazy bị huỷ); Chrome không báo. Chỉ lọc ĐÚNG hai mẫu này (như run-share-note-webkit.mjs); còn lại là lỗi thật.
const noise = errors.filter(m => / due to access control checks\.$|Importing a module script failed/.test(m))
const real = errors.filter(m => !noise.includes(m))
assert.deepEqual(real, [], real.join('\n'))
console.log(`(bỏ qua ${noise.length} thông báo huỷ request do chuyển trang của WebKit)`)
console.log(`E2E SHARE NOTE FEED PREVIEW WEBKIT: ${pass} PASS`)
await browser.close()
