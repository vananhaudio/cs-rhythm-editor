// E2E CLASS MEMBERSHIP CANONICAL V1 + JOIN BY CODE V1 trong Chrome thật — chạy bởi scripts/e2e-class-canonical.sh
// (DB tạm: kịch bản cũ + Lớp của tôi V1 + canonical + join code + lớp Zalo cũ ZZ.T9 có C + lớp JOIN.T1 có mã K7PM-QXD3).
// C: học sinh lớp Zalo cũ → Social thấy lớp · App thấy lớp · Admin đếm. B: nhập mã → vào lớp, sidebar/App cập nhật ngay.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ME = `http://class.localhost:${V}/me`
const APP = `http://127.0.0.1:${V}/tests/e2e-learning-thread/app.html`
const D2 = 'c0000000-0000-4000-8000-0000000000d2'
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
})
let pass = 0
const ok = msg => { pass++; console.log('PASS: ' + msg) }
const errors = []
let current = null
async function ctxPage(width = 390) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  current = page
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|404|400 \(Bad Request\)/.test(m.text())) errors.push('console: ' + m.text()) })
  return { ctx, page }
}
const waitText = (page, re, timeout = 15000) =>
  page.waitForFunction(r => new RegExp(r, 'u').test(document.body.textContent), { timeout }, re.source)
async function clickText(page, label, scope = 'button') {
  const h = await page.waitForFunction((l, s) => [...document.querySelectorAll(s)].find(b => b.textContent.trim() === l && !b.disabled && b.offsetParent !== null),
    { timeout: 15000 }, label, scope)
  await h.asElement().click()
}
async function meAs(email, path = '', width = 390) {
  const { ctx, page } = await ctxPage(width)
  await page.goto(ME + path, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', email)
  await page.type('#cs-login-pass', 'e2e')
  await page.click('.cs-guest-submit')
  return { ctx, page }
}
async function noOverflow(page, label) {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  assert.ok(sw <= iw + 1, `${label}: tràn ngang ${sw} > ${iw}`)
  ok(`${label}: không tràn ngang (${sw} ≤ ${iw}px)`)
}

try {
  // ── 1) C — học sinh lớp Zalo cũ: Social "Lớp của tôi" ──
  {
    // UX V2: Lớp của tôi = bảng các lớp đang tham gia ở /me?feed=classes (/me/classes = Khám phá các lớp khác)
    const { ctx, page } = await meAs('c@test.local', '?feed=classes')
    await page.waitForSelector('.cs-myclass-name', { timeout: 15000 })
    const mine = await page.$$eval('.cs-myclass-name', e => e.map(x => x.textContent))
    assert.ok(mine.includes('Lớp Zalo cũ'), 'Lớp của tôi: ' + mine.join(' | '))
    ok('Social: C (lớp Zalo cũ) thấy "Lớp Zalo cũ" trong Lớp của tôi')
    await noOverflow(page, '/me?feed=classes 390px')
    await page.screenshot({ path: `${SHOTS}/canonical-c-classes.png`, fullPage: true })
    await page.evaluate(() => [...document.querySelectorAll('.cs-myclass')].find(e => /Lớp Zalo cũ/.test(e.textContent)).querySelector('.cs-myclass-enter').click())
    await page.waitForSelector('.cs-map-nomap a.cs-map-title', { timeout: 15000 })
    const href = await page.$eval('.cs-map-nomap a.cs-map-title', a => a.getAttribute('href'))
    assert.equal(href, `/course?id=${D2}`)
    assert.equal(await page.evaluate(() => /Tiếp tục học/.test(document.body.textContent)), false, 'không CTA Tiếp tục học')
    ok('Trang lớp V2 (lớp không có giáo trình lớp): Mục lục = khoá học của lớp → route học SẴN CÓ /course?id=, không CTA')
    await waitText(page, /Lớp mình đang học/)
    await waitText(page, /Lớp mình · 1 thành viên/)
    ok('Trang lớp V2: "Lớp mình đang học" + "Lớp mình · 1 thành viên" (canonical) ở cuối')
    await page.screenshot({ path: `${SHOTS}/canonical-c-class.png`, fullPage: true })
    await ctx.close()
  }
  // ── 2) C — App "Lớp đang học" (component thật) ──
  {
    const { ctx, page } = await ctxPage()
    await page.goto(`${APP}?as=c@test.local&classes=1`, { waitUntil: 'networkidle0' })
    await waitText(page, /LỚP ĐANG HỌC/)
    await waitText(page, /Lớp Zalo cũ/)
    ok('App "Lớp đang học": C thấy "Lớp Zalo cũ" (trước V1 App chỉ đọc cohort → không thấy)')
    await ctx.close()
  }
  // ── 3) Thầy — Admin Lớp học + Lịch lớp: cùng con số; lấy mã tham gia ──
  {
    const { ctx, page } = await ctxPage(1280)
    await page.goto(`${APP}?as=t@test.local&admin=classes`, { waitUntil: 'networkidle0' })
    await clickText(page, 'Lớp Zalo cũ · ZZ.T9')
    await waitText(page, /Nhóm thành viên: Nhóm Zalo ZZ · 1 học sinh/)
    await waitText(page, /Chi[\s\S]*c@test\.local/)
    ok('Admin → Lớp học: lớp Zalo cũ hiện nhóm canonical "Nhóm Zalo ZZ" · 1 học sinh (Chi · c@test.local)')
    await clickText(page, 'Lấy mã')
    await page.waitForFunction(() => /[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}/.test(document.body.textContent), { timeout: 15000 })
    ok('Admin: Mã tham gia hiện dạng XXXX-XXXX + Sao chép / Đổi mã')
    await page.screenshot({ path: `${SHOTS}/canonical-admin-classes.png`, fullPage: true })
    await page.goto(`${APP}?as=t@test.local&admin=schedule`, { waitUntil: 'networkidle0' })
    await waitText(page, /Nhóm thành viên: Nhóm Zalo ZZ · 1 học sinh/)
    await waitText(page, /Nhóm thành viên 0 học sinh/)
    ok('Admin → Lịch lớp: cùng nhóm canonical + sĩ số; cảnh báo lớp còn sống có nhóm 0 học sinh')
    await page.screenshot({ path: `${SHOTS}/canonical-admin-schedule.png`, fullPage: true })
    await ctx.close()
  }
  // ── 4) B — Nhập mã lớp → Tham gia → lớp/sidebar/App cập nhật ngay ──
  {
    const { ctx, page } = await meAs('b@test.local', '/classes')
    await page.waitForSelector('input[aria-label="Mã lớp"]', { timeout: 15000 })
    await page.type('input[aria-label="Mã lớp"]', 'abcd-efgh')
    await clickText(page, 'Xem lớp')
    await waitText(page, /Mã lớp không đúng/)
    ok('Mã sai → thông báo thân thiện')
    await page.click('input[aria-label="Mã lớp"]', { clickCount: 3 })
    await page.type('input[aria-label="Mã lớp"]', 'k7pm-qxd3')
    await clickText(page, 'Xem lớp')
    await waitText(page, /Lớp mở bằng mã/)
    ok('Mã đúng (gõ thường + gạch nối) → xem trước đúng lớp')
    await clickText(page, 'Tham gia lớp')
    await page.waitForFunction(() => /\/me\/classes\/[0-9a-f-]{36}/.test(location.pathname), { timeout: 15000 })
    ok('Tham gia → mở ngay trang lớp')
    await page.goto(ME + '?feed=classes', { waitUntil: 'networkidle0' })
    await page.waitForSelector('.cs-myclass-name', { timeout: 15000 })
    const mine = await page.$$eval('.cs-myclass-name', e => e.map(x => x.textContent))
    assert.ok(mine.includes('Lớp mở bằng mã'), 'Lớp của tôi B: ' + mine.join(' | '))
    ok('Lớp của tôi của B có lớp vừa tham gia')
    await ctx.close()
    const w = await meAs('b@test.local', '/classes', 1280)
    await w.page.waitForSelector('.cs-nav-group[aria-label="Lớp học"] .cs-class-item', { timeout: 15000 })
    const nav = await w.page.$$eval('.cs-nav-group[aria-label="Lớp học"] .cs-nav-text', e => e.map(x => x.textContent))
    assert.ok(nav.some(t => /Lớp mở bằng mã/.test(t)), 'sidebar: ' + nav.join(' | '))
    ok('Sidebar (desktop) có lớp vừa tham gia')
    await w.ctx.close()
    const a = await ctxPage()
    await a.page.goto(`${APP}?as=b@test.local&classes=1`, { waitUntil: 'networkidle0' })
    await waitText(a.page, /Lớp mở bằng mã/)
    ok('App "Lớp đang học" của B có lớp vừa tham gia')
    await a.ctx.close()
  }
  assert.deepEqual(errors, [], 'lỗi trang/console')
  ok('không có lỗi trang/console')
  console.log(`E2E CANONICAL + JOIN CODE: ${pass} PASS`)
} catch (e) {
  console.error('FAIL:', e.message); console.error(errors.join('\n')); process.exitCode = 1
  if (current) {
    await current.screenshot({ path: `${SHOTS}/canonical-FAIL.png`, fullPage: true }).catch(() => {})
    console.error('URL:', current.url(), '\nTEXT:', (await current.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 1500))
  }
} finally {
  await browser.close()
}
