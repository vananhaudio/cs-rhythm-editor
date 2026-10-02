// Kịch bản E2E LỚP CỦA TÔI V1 (checkpoint + tiến độ buổi) trong Chrome thật — chạy bởi scripts/e2e-learning-thread.sh
// khi E2E_CHECKPOINTS=1 (DB đã có fixture SOLO01.TH01/TH02 + migration class_checkpoints_v1_setup.sql).
// A, B: lớp SOLO01.TH01 (có quyền giáo trình) · C: SOLO01.TH02 · T: thầy.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ME = `http://class.localhost:${V}/me`
const TH01 = 'b1000000-0000-4000-8000-000000000001'
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
})
let pass = 0
const ok = msg => { pass++; console.log('PASS: ' + msg) }
const errors = []

async function ctxPage(width = 390) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|404|400 \(Bad Request\)/.test(m.text())) errors.push('console: ' + m.text()) })
  return { ctx, page }
}
async function waitText(page, re, timeout = 15000) {
  await page.waitForFunction(r => new RegExp(r, 'u').test(document.body.textContent), { timeout }, re.source)
}
async function clickText(page, label, scope = 'button', within = 'body') {
  const h = await page.waitForFunction((l, s, w) => [...document.querySelectorAll(`${w} ${s}`)].find(b => b.textContent.trim() === l && !b.disabled && b.offsetParent !== null),
    { timeout: 15000 }, label, scope, within)
  await h.asElement().click()
}
async function noHorizontalOverflow(page, label) {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  assert.ok(sw <= iw + 1, `${label}: tràn ngang ${sw} > ${iw}`)
  ok(`${label}: không tràn ngang (${sw} ≤ ${iw}px)`)
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
const rows = page => page.$$eval('.cs-learn-row', els => els.map(e => ({
  title: e.querySelector('.cs-learn-row-title')?.textContent ?? '', current: e.getAttribute('aria-current') === 'step',
  disabled: e.disabled, cls: e.className })))
// Trang Lớp (bản đồ) vs Trang Buổi (phòng học)
const onClassPage = async page => { await page.waitForSelector('.cs-learn-map', { timeout: 15000 }); assert.equal(await page.$$eval('.lsn-paper', e => e.length), 0, 'Trang Lớp KHÔNG render giáo án') }
async function openSessionFromMap(page, no) {
  await page.click(`#buoi-${String(no).padStart(2, '0')}`)
  await page.waitForFunction(n => new RegExp(`/sessions/${n}$`).test(location.pathname), { timeout: 15000 }, no)
  assert.equal(await page.$$eval('.cs-learn-map, .cs-learn-recent', e => e.length), 0, 'Trang Buổi: không bản đồ, không feed lớp')
}
// Trang Lớp UX V2: giáo trình TÓM TẮT mặc định → bung toàn bộ (mọi chặng) khi cần xem đủ buổi
async function expandAll(page) {
  if (await page.$('.cs-learn-all[aria-expanded="false"]')) await page.click('.cs-learn-all')
  await page.waitForSelector('.cs-learn-stages')
  for (const b of await page.$$('.cs-learn-stage-toggle[aria-expanded="false"]')) await b.click()
}
const inViewport = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight })
// Vị trí giáo án sau khi bấm buổi: đầu #giao-an phải nằm ngay dưới thanh trên dính (52px) — không bị che, không xuống đáy
async function lessonPos(page) {
  await page.waitForFunction(() => { const y = scrollY; return new Promise(r => setTimeout(() => r(scrollY === y), 250)) }, { timeout: 10000 })
  return page.evaluate(() => ({ top: Math.round(document.getElementById('giao-an').getBoundingClientRect().top), y: Math.round(scrollY),
    max: document.documentElement.scrollHeight - innerHeight, bar: Math.round(document.querySelector('.cs-topbar')?.getBoundingClientRect().bottom ?? 0) }))
}
const cpText = (page, id) => page.$eval(`#bai-tra-${id.replace('.', '\\.')}`, e => e.textContent)

let threadId = null
let page = null, ctx = null
try {
  // ── 1. B vào lớp: TRANG LỚP = BẢN ĐỒ (không giáo án) · buổi sau khoá ──────────────────────────
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`))
  await onClassPage(page)
  // UX V2: đầu trang = Tên lớp → Đang học (Tiếp tục học) → Hoạt động gần đây → Giáo trình TÓM TẮT (không bung mọi buổi)
  const top = await page.evaluate(() => { const t = document.querySelector('.cs-learn').textContent
    return [t.indexOf('Đang học'), t.indexOf('Tiếp tục học'), t.indexOf('Hoạt động gần đây'), t.indexOf('Giáo trình')] })
  assert.ok(top.every((x, i) => x >= 0 && (i === 0 || x > top[i - 1])), 'thứ tự: Đang học → Tiếp tục học → Hoạt động → Giáo trình ' + top)
  let r = await rows(page)
  assert.deepEqual(r.map(x => x.title), ['Buổi 01 · Bản đồ nốt C–Am', 'Buổi 02 · Ép ngón & Bass'], 'tóm tắt: buổi hiện tại + buổi kế')
  assert.ok(await inViewport(page, '.cs-now-go'), 'Tiếp tục học trong màn hình đầu')
  await page.screenshot({ path: `${SHOTS}/cp-0-class-summary-390.png`, fullPage: false })
  await expandAll(page)
  r = await rows(page)
  assert.deepEqual(r.map(x => x.title), ['Buổi 01 · Bản đồ nốt C–Am', 'Buổi 02 · Ép ngón & Bass', 'Buổi 03 · Slide', 'Buổi 04 · Xếp ngón'])
  assert.ok(r[0].current && /is-current/.test(r[0].cls), 'Buổi 01 là buổi hiện tại')
  assert.ok(r[1].disabled && r[2].disabled && /is-locked/.test(r[1].cls), 'Buổi 02/03 khoá: thấy trên bản đồ, không bấm vào được')
  assert.equal(await page.$$eval('.cs-learn-map .lt-profile-tabs', e => e.length), 0, 'không thêm tab')
  ok('B: Trang Lớp = Đang học + Hoạt động + giáo trình tóm tắt (2 dòng) → "Xem toàn bộ" 4 buổi · Buổi 01 hiện tại · Buổi 02–03 khoá')
  await noHorizontalOverflow(page, 'Trang Lớp 390px')
  await page.screenshot({ path: `${SHOTS}/cp-1-class-390.png`, fullPage: true })

  // Một chạm → Trang Buổi riêng; checkpoint nằm đúng vị trí trong mạch buổi
  await openSessionFromMap(page, 1)
  await page.waitForSelector('.lsn-paper', { timeout: 15000 })
  assert.match(await cpText(page, '1.1'), /Bài trả 1\.1/); assert.match(await cpText(page, '1.1'), /TRẢ BÀI/)
  assert.match(await cpText(page, '1.2'), /Không bắt buộc/)
  const order = await page.evaluate(() => { const t = document.querySelector('.lsn-paper').textContent; return [t.indexOf('Bài trả 1.1'), t.indexOf('giữa'), t.indexOf('Bài trả 1.2')] })
  assert.ok(order[0] < order[1] && order[1] < order[2], 'checkpoint đúng vị trí')
  assert.equal(await page.$eval('.cs-session-nav', e => [...e.querySelectorAll('button')].map(b => b.textContent.trim() + ':' + b.disabled).join('|')), 'Buổi 02:true')
  ok('Bấm Buổi 01 → /me/classes/<id>/sessions/1: chỉ giáo án (không bản đồ/feed) · bài trả 1.1, 1.2 đúng vị trí · "Buổi 02 →" bị khoá')
  await noHorizontalOverflow(page, 'Trang Buổi 390px')

  // ── 2. Trả bài NGAY tại checkpoint 1.1 trên Trang Buổi ─────────────────────────────────────────
  const urlBefore = await page.evaluate(() => location.pathname)
  await clickText(page, 'TRẢ BÀI', 'button', '#bai-tra-1\\.1')
  await page.waitForSelector('#bai-tra-1\\.1 .lt-compose')
  assert.match(await cpText(page, '1.1'), /Các bạn cùng lớp/); assert.doesNotMatch(await cpText(page, '1.1'), /Cộng đồng học tập/)
  await page.type('#bai-tra-1\\.1 textarea', 'Em gửi âm giai C–Am, đoạn chuyển vùng còn vấp.')
  await clickText(page, 'Gửi bài', 'button', '#bai-tra-1\\.1')
  await page.waitForFunction(() => /Đã trả · Chờ chấm/.test(document.querySelector('#bai-tra-1\\.1')?.textContent ?? ''), { timeout: 15000 })
  assert.equal(await page.$$eval('#bai-tra-1\\.1 .lt-compose', e => e.length), 0)
  assert.equal(await page.evaluate(() => location.pathname), urlBefore, 'vẫn ở Trang Buổi')
  assert.match(await cpText(page, '1.1'), /Xem cuộc trao đổi/)
  ok('B trả bài 1.1 tại chỗ trên Trang Buổi → "Đã trả · Chờ chấm" ngay tại checkpoint, không rời giáo án')
  await page.screenshot({ path: `${SHOTS}/cp-2-session-submitted-390.png`, fullPage: true })

  // ← Về lớp: Trang Lớp, dòng Buổi 01 trong màn hình; "Các bạn vừa trả bài" có bài vừa trả (Trang Lớp, không ở Trang Buổi)
  await page.click('.cs-session-back')
  await page.waitForFunction(id => location.pathname === `/me/classes/${id}`, {}, TH01)
  await onClassPage(page)
  assert.ok(await inViewport(page, '#buoi-01'), 'Buổi 01 trong màn hình sau khi về lớp')
  await page.waitForFunction(() => /Bài trả 1\.1 · Âm giai C–Am/.test(document.querySelector('.cs-learn-recent')?.textContent ?? ''), { timeout: 15000 })
  ok('← Về lớp: Trang Lớp, dòng Buổi 01 nằm trong màn hình · "Hoạt động gần đây" có bài vừa trả')

  // Deep link + reload buổi khoá: không vượt bằng URL
  await page.goto(`${ME}/classes/${TH01}/sessions/2`, { waitUntil: 'networkidle0' })
  await waitText(page, /Hoàn thành Buổi 01 để mở/)
  assert.equal(await page.$$eval('.lsn-paper', e => e.length), 0, 'buổi khoá: KHÔNG nội dung dù vào thẳng URL')
  ok('Vào thẳng URL Buổi 02 (khoá) → "Hoàn thành Buổi 01 để mở", không lộ giáo án')
  await page.goto(`${ME}/classes/${TH01}/sessions/1`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#bai-tra-1\\.1')
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('#bai-tra-1\\.1')
  await clickText(page, 'Xem cuộc trao đổi', 'button', '#bai-tra-1\\.1')
  await page.waitForFunction(() => location.pathname.startsWith('/me/t/'))
  threadId = await page.evaluate(() => location.pathname.split('/').pop())
  await waitText(page, /Bài trả 1\.1 · Âm giai C–Am/); await waitText(page, /SOLO01 · Buổi 01/)
  await clickText(page, 'Mở giáo trình Buổi 01')
  await page.waitForFunction(id => location.pathname === `/me/classes/${id}/sessions/1`, {}, TH01)
  ok('Deep link + reload Trang Buổi 01 OK · "Xem cuộc trao đổi" → /me/t/<id> → "Mở giáo trình Buổi 01" về đúng Trang Buổi')
  await ctx.close()

  // ── 3. Quyền xem: A (cùng lớp) thấy bài; C (lớp TH02) không — kể cả vào thẳng URL buổi ─────────
  ;({ ctx, page } = await meAs('a@test.local', `/classes/${TH01}`))
  await onClassPage(page)
  await page.waitForFunction(() => /Bài trả 1\.1/.test(document.querySelector('.cs-learn-recent')?.textContent ?? ''), { timeout: 15000 })
  ok('A (cùng lớp) thấy bài trả của B trong "Hoạt động gần đây" (Trang Lớp)')
  await clickText(page, 'Tiếp tục học')
  await page.waitForFunction(id => location.pathname === `/me/classes/${id}/sessions/1`, {}, TH01)
  await page.waitForSelector('.lsn-paper', { timeout: 15000 })
  ok('Tiếp tục học → đúng Trang Buổi hiện tại (/sessions/1)')
  await page.click('.cs-session-back'); await onClassPage(page)
  await clickText(page, 'Xem tất cả hoạt động')
  await page.waitForSelector('.lt-profile-tabs'); await waitText(page, /Bài trả 1\.1/)
  assert.equal(await page.$$eval('.cs-learn-map', e => e.length), 0)
  ok('"Xem tất cả hoạt động" → trang cộng đồng lớp (Hoạt động | Thành viên)')
  await clickText(page, 'Vào học'); await page.waitForSelector('.cs-learn-map')
  ok('"Vào học" → về Trang Lớp')
  await ctx.close()
  ;({ ctx, page } = await meAs('c@test.local', `/t/${threadId}`))
  await waitText(page, /không có quyền xem|Không tìm thấy/)
  await page.goto(`${ME}/classes/${TH01}/sessions/1`, { waitUntil: 'networkidle0' })
  await waitText(page, /chưa xem được giáo trình/)
  assert.equal(await page.$$eval('.lsn-paper', e => e.length), 0)
  ok('C (lớp TH02): không xem bài trả của B · vào thẳng URL Buổi 01 của TH01 → "chưa xem được giáo trình", không lộ nội dung')
  await ctx.close()

  // ── 4. Thầy: hàng đợi → chấm ĐẠT → Buổi 01 xong, Buổi 02 mở ────────────────────────────────────
  ;({ ctx, page } = await meAs('t@test.local', '', 1280))
  await page.waitForSelector('.cs-share', { timeout: 15000 })
  await page.goto(`${ME}/queue`, { waitUntil: 'networkidle0' })
  await waitText(page, /Bài trả 1\.1 · Âm giai C–Am/); await waitText(page, /SOLO01 · Buổi 01/)
  ok('Hàng đợi Thầy: "Bài trả 1.1 · Âm giai C–Am" + "SOLO01 · Buổi 01"')
  await page.goto(`${ME}/t/${threadId}`, { waitUntil: 'networkidle0' })
  await waitText(page, /Khi mọi bài trả bắt buộc của buổi đã Đạt/)
  await page.type('.lt-compose[aria-label="Thầy phản hồi"] textarea', 'Âm giai đều, chuyển vùng ổn. Đạt.')
  await clickText(page, 'Đạt')
  await waitText(page, /nhận xét · Đạt/); await waitText(page, /Đã đạt/)
  ok('Thầy chấm Đạt')
  await page.goto(`${ME}/classes/${TH01}`, { waitUntil: 'networkidle0' })
  await onClassPage(page); await waitText(page, /vai trò giáo viên/)
  assert.ok((await rows(page)).every(x => !x.disabled), 'Thầy: mọi buổi bấm được')
  await openSessionFromMap(page, 2)
  await page.waitForSelector('.lsn-paper')
  assert.equal(await page.$$eval('.lsn-paper button', bs => bs.filter(b => /TRẢ BÀI/.test(b.textContent)).length), 0, 'Thầy không có nút TRẢ BÀI')
  await noHorizontalOverflow(page, 'Trang Buổi Thầy 1280px')
  await page.screenshot({ path: `${SHOTS}/cp-3-teacher-session-1280.png`, fullPage: true })
  ok('Thầy: Trang Lớp mọi buổi mở · Trang Buổi 02 xem trước, không nút TRẢ BÀI')
  await ctx.close()

  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`))
  await onClassPage(page)
  await waitText(page, /Buổi 02 · Ép ngón & Bass[\s\S]*Tiếp tục học/)
  await expandAll(page)
  r = await rows(page)
  assert.ok(/is-done/.test(r[0].cls) && r[1].current && !r[1].disabled && r[2].disabled, JSON.stringify(r))
  await openSessionFromMap(page, 2)
  await page.waitForSelector('#bai-tra-2\\.1'); assert.match(await cpText(page, '2.1'), /TRẢ BÀI/)
  assert.match(await page.$eval('.cs-learn-status', e => e.textContent), /0\/2 bài trả bắt buộc đã Đạt/)
  await page.click('.cs-session-nav button')   // ← Buổi 01
  await page.waitForFunction(id => location.pathname === `/me/classes/${id}/sessions/1`, {}, TH01)
  await page.waitForSelector('#bai-tra-1\\.1'); assert.match(await cpText(page, '1.1'), /Đạt/); assert.doesNotMatch(await cpText(page, '1.1'), /TRẢ BÀI|TRẢ LẠI/)
  ok('B vào lại: Buổi 01 ✓ · Buổi 02 hiện tại (mở) · Buổi 03 khoá · Trang Buổi 02 có 2.1 + "0/2 bài trả bắt buộc" · "← Buổi 01" → 1.1 "Đạt"')
  await ctx.close()

  // ── 5. Desktop + trang công khai SOLO01 không đổi ──────────────────────────────────────────────
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}/sessions/1`, 1280))
  await page.waitForSelector('.lsn-paper', { timeout: 15000 })
  await noHorizontalOverflow(page, 'Trang Buổi 1280px (deep link qua đăng nhập)')
  await page.screenshot({ path: `${SHOTS}/cp-5-session-1280.png`, fullPage: false })
  await ctx.close()
  ;({ ctx, page } = await ctxPage(390))
  await page.goto(`http://127.0.0.1:${V}/solo01/buoi-01?xem`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.lsn-paper', { timeout: 15000 })
  assert.equal(await page.$$eval('.lsn-cp-slot', e => e.length), 0)
  ok('Trang công khai /solo01/buoi-01 vẫn chạy, không nút trả bài')
  await ctx.close()

  // ── 6. Chế độ GIÁO TRÌNH (có giáo trình, chưa bài trả) — như SOLO01 production ──────────────────
  const CUR = 'b1000000-0000-4000-8000-000000000004'
  ;({ ctx, page } = await meAs('a@test.local', `/classes/${CUR}`))
  await onClassPage(page)
  assert.ok(await page.evaluate(() => scrollY) <= 10, 'vào lớp không tự cuộn')
  await expandAll(page)
  r = await rows(page)
  assert.deepEqual(r.map(x => x.title), ['Buổi 01 · Mở đầu', 'Buổi 02 · Tuần này', 'Buổi 03 · Đang soạn', 'Buổi 04 · Chưa có'])
  assert.ok(r[1].current && r.every(x => !x.disabled), 'buổi hiện tại theo lịch (02); không khoá buổi nào')
  assert.equal(await page.$$eval('.cs-learn-row-badge', e => e.length), 0, 'dòng gọn')
  assert.equal(await page.$$eval('.cs-learn-break', e => e.map(x => x.textContent).join('|')), 'Nghỉ giữa chặng – thời gian tự luyện')
  await waitText(page, /Hoạt động gần đây/); await waitText(page, /Chưa có hoạt động nào/)
  ok('Chế độ giáo trình: Trang Lớp gọn — 4 buổi, Buổi 02 hiện tại, vạch nghỉ, không khoá, không giáo án, feed trống gọn')
  await openSessionFromMap(page, 2)
  await waitText(page, /Nội dung thật buổi 2/)
  assert.equal(await page.$$eval('button', bs => bs.filter(b => /TRẢ BÀI|TRẢ LẠI/.test(b.textContent)).length), 0, 'học viên: không nút trả bài')
  assert.equal(await page.$$eval('.lsn-cp.is-preview, .cs-learn-status', e => e.length), 0, 'không khung giả, không tiến độ giả')
  await clickText(page, 'Buổi 03'); await page.waitForFunction(() => /\/sessions\/3$/.test(location.pathname))
  await waitText(page, /Nội dung buổi này đang được cập nhật/)
  assert.equal(await page.$$eval('.lsn-paper', e => e.length), 0, 'buổi nháp: không lộ nháp')
  await page.reload({ waitUntil: 'networkidle0' }); await waitText(page, /Nội dung buổi này đang được cập nhật/)
  ok('Trang Buổi 02: giáo án thật, không nút/khung giả · "Buổi 03 →" (nháp) → "đang được cập nhật" · reload giữ đúng buổi')
  await page.click('.cs-session-back')
  await page.waitForFunction(id => location.pathname === `/me/classes/${id}`, {}, CUR)
  await onClassPage(page)
  assert.ok(await inViewport(page, '#buoi-03'), 'Buổi 03 trong màn hình sau khi về lớp')
  ok('Buổi 02 → "Buổi 03 →" → ← Về lớp: về Trang Lớp (không quay lại Buổi 02), dòng Buổi 03 trong màn hình')
  await page.goto(`${ME}/classes/${CUR}/sessions/1`, { waitUntil: 'networkidle0' })   // mở THẲNG bằng link
  await page.waitForSelector('.lsn-paper'); await clickText(page, 'Buổi 02'); await page.waitForFunction(() => /\/sessions\/2$/.test(location.pathname))
  await page.click('.cs-session-back'); await page.waitForFunction(id => location.pathname === `/me/classes/${id}`, {}, CUR)
  await onClassPage(page)
  ok('Mở thẳng link Buổi 01 → "Buổi 02 →" → ← Về lớp: mở Trang Lớp (không rời site)')
  await noHorizontalOverflow(page, 'Trang Lớp chế độ giáo trình 390px')
  await page.screenshot({ path: `${SHOTS}/cur-1-class-390.png`, fullPage: true })
  await ctx.close()
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${CUR}`))
  await page.waitForSelector('.lt-profile-tabs', { timeout: 15000 })
  assert.equal(await page.$$eval('.cs-learn-map', e => e.length), 0)
  await page.goto(`${ME}/classes/${CUR}/sessions/1`, { waitUntil: 'networkidle0' })
  await waitText(page, /chưa xem được giáo trình/)
  assert.equal(await page.$$eval('.lsn-paper', e => e.length), 0)
  ok('B (thành viên, KHÔNG quyền giáo trình): trang lớp cũ · vào thẳng URL buổi → không lộ giáo án')
  await ctx.close()
  ;({ ctx, page } = await meAs('t@test.local', '', 1280))
  await page.waitForSelector('.cs-share', { timeout: 15000 })
  await page.goto(`${ME}/classes/${CUR}/sessions/1`, { waitUntil: 'networkidle0' })
  await waitText(page, /Nội dung thật buổi 1/)
  await page.waitForSelector('.lsn-cp.is-preview')
  assert.equal(await page.$eval('.lsn-cp.is-preview button', b => b.disabled), true)
  await noHorizontalOverflow(page, 'Thầy Trang Buổi chế độ giáo trình 1280px')
  await page.screenshot({ path: `${SHOTS}/cur-2-teacher-session-1280.png`, fullPage: true })
  ok('Thầy/admin (không là học viên): Trang Buổi deep link + khung "Trả bài · Xem trước" (vô hiệu)')
  await ctx.close()

  assert.deepEqual(errors, [], 'không có lỗi JS / console')
  ok('không có lỗi JS / console trong toàn bộ kịch bản')
  console.log(`ALL CHECKPOINT E2E PASS (${pass})`)
} catch (e) {
  console.error('FAIL:', e.message)
  try { await page?.screenshot({ path: `${SHOTS}/cp-FAIL.png`, fullPage: true }); console.error('URL:', page?.url(), '\n', (await page?.evaluate(() => document.body.innerText))?.slice(-1800)) } catch { /* bỏ qua */ }
  if (errors.length) console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
