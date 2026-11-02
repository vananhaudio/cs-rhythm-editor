// E2E Share Note V1 trên WebKit (Playwright) — cùng stack local (scripts/e2e-share-note.sh, chạy SAU run-share-note.mjs).
// WebKit ≠ Safari iOS thật: kiểm lớp khoanh trên engine WebKit (bố cục alphaTab, hệ số co SVG, toạ độ chạm). Cần playwright-core
// + trình duyệt webkit đã cài (PLAYWRIGHT_DIR = thư mục có node_modules/playwright-core).
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

const require = createRequire((process.env.PLAYWRIGHT_DIR || process.env.PUPPETEER_DIR) + '/')
const { webkit } = require('playwright-core')
const ORIGIN = `http://class.localhost:${process.env.VITE_PORT}`
const SESSION = `${ORIGIN}/me/classes/b1000000-0000-4000-8000-000000000001/sessions/1`
const SHOTS = process.env.SHOTS
const browser = await webkit.launch()
let pass = 0
const ok = m => { pass++; console.log('PASS: [webkit] ' + m) }
const errors = []
async function open(email, vp) {
  const ctx = await browser.newContext(vp)
  const page = await ctx.newPage()
  page.on('pageerror', e => errors.push(`${email} pageerror: ${e.message}`))
  await page.goto(`${ORIGIN}/me`, { waitUntil: 'networkidle' })
  await page.fill('#cs-login-email', email); await page.fill('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 20000 })
  return page
}
async function openScore(page, url = SESSION) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.lsn-score-wrap .at-surface svg', { timeout: 30000 })
  await page.waitForFunction(() => !document.querySelector('.lsn-score-msg')); await page.waitForTimeout(500)
}
// Toạ độ LAYOUT trong bề mặt (đưa vào giữa màn hình) → toạ độ VISUAL cho Playwright
async function pt(page, fx, y) {
  await page.evaluate(y => { const s = document.querySelector('.lsn-score-wrap .at-surface'); window.scrollBy(0, s.getBoundingClientRect().top + y - innerHeight / 2) }, y)
  await page.waitForTimeout(250)
  return page.evaluate(([fx, y]) => { const r = document.querySelector('.lsn-score-wrap .at-surface').getBoundingClientRect(); const v = visualViewport
    return { x: r.left + r.width * fx - v.offsetLeft, y: r.top + y - v.offsetTop, sx: r.width * fx, sy: y } }, [fx, y])
}
async function click(page, text) { const b = page.locator('button', { hasText: text }).first(); await b.scrollIntoViewIfNeeded(); await b.evaluate(e => e.scrollIntoView({ block: 'center' })); await b.click() }
const range = page => page.locator('.lsn-share-range').textContent()
const focus = page => page.evaluate(() => { const s = document.querySelector('.lsn-score-wrap .at-surface').getBoundingClientRect()
  return [...document.querySelectorAll('.lsn-share-hl.is-focus')].map(e => { const r = e.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top } }) })
const covers = (rs, p) => rs.some(r => p.sx >= r.l - 1 && p.sx <= r.r + 1 && p.sy >= r.t - 1 && p.sy <= r.b + 1)
async function postAndLink(page, note) {
  await click(page, 'Hỏi / Chia sẻ')
  await page.fill('#share-note-text', note)
  await page.locator('[role=dialog] button', { hasText: 'Đăng lên Feed' }).click()
  await page.waitForFunction(() => document.querySelector('[role=dialog] [role=status]')?.textContent === 'Đã đăng lên Feed')
  await page.goto(`${ORIGIN}/me`, { waitUntil: 'networkidle' })
  await page.waitForFunction(t => [...document.querySelectorAll('.cs-tool-share')].some(e => e.textContent.includes(t)), note)
  return page.evaluate(t => [...document.querySelectorAll('.cs-tool-share')].find(e => e.textContent.includes(t)).querySelector('a').getAttribute('href'), note)
}
try {
  const IPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
  const DESK = { viewport: { width: 1280, height: 900 } }
  // 1. iPhone 390 (WebKit): chạm một ô bằng touch → Đăng Feed → người nhận cùng khổ: tô phủ đúng điểm chạm
  const A = await open('a@test.local', IPHONE)
  await openScore(A)
  assert.ok(await A.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'không tràn ngang')
  await click(A, 'Khoanh để hỏi')
  const p = await pt(A, 0.7, 90)
  await A.touchscreen.tap(p.x, p.y); await A.waitForTimeout(200)
  const r1 = await range(A)
  assert.match(r1 ?? '', /^Ô \d+$/)
  const href1 = await postAndLink(A, `WK iPhone ${r1}`)
  const B = await open('b@test.local', IPHONE)
  await openScore(B, ORIGIN + href1)
  await B.waitForSelector('.lsn-share-hl.is-focus', { timeout: 30000 }); await B.waitForTimeout(400)
  const f1 = await focus(B)
  assert.ok(covers(f1, p), `vùng tô phủ điểm chạm: ${JSON.stringify({ p, f1 })}`)
  await B.screenshot({ path: `${SHOTS}/sn-wk-iphone-nguoi-nhan.png` })
  ok(`iPhone 390: chạm (touch) → "${r1}" → Đăng Feed → người nhận cùng khổ: vùng tô phủ ĐÚNG điểm chạm, không tràn ngang`)

  // 2. Desktop 1280 (WebKit): kéo chuột qua nhiều ô → người nhận desktop: tô phủ hai đầu
  const AD = await open('a@test.local', DESK)
  await openScore(AD)
  await click(AD, 'Khoanh để hỏi')
  const a0 = await pt(AD, 0.15, 90), a1 = await pt(AD, 0.9, 90)
  await AD.mouse.move(a0.x, a0.y); await AD.mouse.down(); await AD.mouse.move(a1.x, a1.y, { steps: 8 }); await AD.mouse.up(); await AD.waitForTimeout(200)
  const r2 = await range(AD)
  assert.match(r2 ?? '', /^Ô \d+–\d+$/)
  const href2 = await postAndLink(AD, `WK desktop ${r2}`)
  const BD = await open('b@test.local', DESK)
  await openScore(BD, ORIGIN + href2)
  await BD.waitForSelector('.lsn-share-hl.is-focus', { timeout: 30000 }); await BD.waitForTimeout(400)
  const f2 = await focus(BD)
  assert.ok(covers(f2, a0) && covers(f2, a1), `vùng tô phủ hai đầu kéo: ${JSON.stringify({ a0, a1, f2 })}`)
  ok(`desktop 1280: kéo chuột → "${r2}" → người nhận: vùng tô phủ ĐÚNG hai đầu`)

  // 3. Mở link desktop trên iPhone (khổ khác): vẫn tô, trong màn hình
  await openScore(B, ORIGIN + href2)
  await B.waitForSelector('.lsn-share-hl.is-focus', { timeout: 30000 }); await B.waitForTimeout(400)
  assert.ok(await B.evaluate(() => [...document.querySelectorAll('.lsn-share-hl.is-focus')].some(e => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight })))
  ok('khổ khác (desktop → iPhone): vẫn tô đúng dải, vùng tô trong màn hình')

  // WebKit báo request bị HUỶ khi test chuyển trang (page.goto) giữa chừng thành pageerror "… due to access control checks" /
  // "Importing a module script failed" (chunk lazy bị huỷ). Chrome không báo. Chỉ lọc ĐÚNG hai mẫu này; còn lại là lỗi thật.
  const noise = errors.filter(m => / due to access control checks\.$|Importing a module script failed/.test(m))
  assert.deepEqual(errors.filter(m => !noise.includes(m)), [])
  ok(`không có pageerror (bỏ qua ${noise.length} thông báo huỷ request do chuyển trang của WebKit)`)
  console.log(`\nE2E SHARE NOTE WEBKIT: ${pass} PASS`)
} catch (e) {
  console.error('FAIL: [webkit]', e?.message ?? e); if (errors.length) console.error(errors.slice(0, 5))
  await browser.close(); process.exit(1)
}
await browser.close()
