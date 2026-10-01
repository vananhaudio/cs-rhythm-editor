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
  title: e.querySelector('.cs-learn-row-title')?.textContent ?? '', expanded: e.getAttribute('aria-expanded') === 'true',
  cls: e.className })))
const cpText = (page, id) => page.$eval(`#bai-tra-${id.replace('.', '\\.')}`, e => e.textContent)

let threadId = null
let page = null, ctx = null
try {
  // ── 1. B vào lớp: chọn lớp là HỌC NGAY — sơ đồ dọc, Buổi 01 tự mở, buổi sau khoá ──────────────
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`))
  await page.waitForSelector('.cs-learn-map', { timeout: 15000 })
  await page.waitForSelector('.lsn-paper', { timeout: 15000 })
  let r = await rows(page)
  assert.deepEqual(r.map(x => x.title), ['Buổi 01 · Bản đồ nốt C–Am', 'Buổi 02 · Ép ngón & Bass', 'Buổi 03 · Slide', 'Buổi 04 · Xếp ngón'])
  assert.ok(r[0].expanded && /is-current/.test(r[0].cls), 'Buổi 01 tự mở + là buổi hiện tại')
  assert.equal(r.filter(x => x.expanded).length, 1, 'chỉ MỘT buổi mở')
  assert.ok(/is-locked/.test(r[1].cls) && /is-locked/.test(r[2].cls), 'Buổi 02/03 khoá')
  assert.equal(await page.$$eval('.cs-learn-map .lt-profile-tabs', e => e.length), 0, 'không thêm tab trong phần học')
  ok('B: /me/classes/<SOLO01> → sơ đồ dọc 4 buổi, Buổi 01 tự mở (một buổi), Buổi 02–03 khoá, không tab thừa')
  assert.match(await cpText(page, '1.1'), /Bài trả 1\.1/)
  assert.match(await cpText(page, '1.1'), /TRẢ BÀI/)
  assert.match(await cpText(page, '1.2'), /Không bắt buộc/)
  const order = await page.evaluate(() => {
    const t = document.querySelector('.lsn-paper').textContent
    return [t.indexOf('Bài trả 1.1'), t.indexOf('giữa'), t.indexOf('Bài trả 1.2')]
  })
  assert.ok(order[0] < order[1] && order[1] < order[2], 'checkpoint nằm đúng vị trí trong mạch buổi')
  ok('Buổi 01 render bằng LessonDocument: bài trả 1.1 (TRẢ BÀI) · nội dung giữa · bài trả 1.2 (không bắt buộc) đúng thứ tự')
  await noHorizontalOverflow(page, 'màn học 390px')
  await page.screenshot({ path: `${SHOTS}/cp-1-learn-390.png`, fullPage: true })

  // Buổi khoá: bấm vẫn thấy tiêu đề + copy ngắn, không nội dung; mở buổi khác → buổi trước thu lại
  await page.click('#buoi-02')
  await waitText(page, /Hoàn thành Buổi 01 để mở/)
  r = await rows(page)
  assert.ok(r[1].expanded && !r[0].expanded, 'bấm Buổi 02 → Buổi 02 mở, Buổi 01 thu lại')
  assert.equal(await page.$$eval('.lsn-paper', e => e.length), 0, 'buổi khoá KHÔNG có nội dung')
  ok('Buổi khoá: "Hoàn thành Buổi 01 để mở", không nội dung; chỉ một buổi mở một lúc')
  await page.click('#buoi-01'); await page.waitForSelector('.lsn-paper')

  // ── 2. Trả bài NGAY tại checkpoint 1.1 (không rời giáo trình) ─────────────────────────────────
  const urlBefore = await page.evaluate(() => location.pathname)
  await clickText(page, 'TRẢ BÀI', 'button', '#bai-tra-1\\.1')
  await page.waitForSelector('#bai-tra-1\\.1 .lt-compose')
  assert.match(await cpText(page, '1.1'), /Các bạn cùng lớp/)
  assert.doesNotMatch(await cpText(page, '1.1'), /Cộng đồng học tập/)
  await page.type('#bai-tra-1\\.1 textarea', 'Em gửi âm giai C–Am, đoạn chuyển vùng còn vấp.')
  await clickText(page, 'Gửi bài', 'button', '#bai-tra-1\\.1')
  await page.waitForFunction(() => /Đã trả · Chờ chấm/.test(document.querySelector('#bai-tra-1\\.1')?.textContent ?? ''), { timeout: 15000 })
  assert.equal(await page.$$eval('#bai-tra-1\\.1 .lt-compose', e => e.length), 0, 'composer đóng sau khi gửi')
  assert.equal(await page.evaluate(() => location.pathname), urlBefore, 'vẫn ở đúng trang giáo trình')
  assert.ok((await rows(page))[0].expanded, 'Buổi 01 vẫn đang mở')
  assert.match(await cpText(page, '1.1'), /Xem cuộc trao đổi/)
  ok('B trả bài 1.1 tại chỗ (mặc định "Các bạn cùng lớp") → composer đóng → "Đã trả · Chờ chấm" ngay tại checkpoint, không rời giáo trình')
  await waitText(page, /Các bạn vừa trả bài/)
  await page.waitForFunction(() => /Bài trả 1\.1 · Âm giai C–Am/.test(document.querySelector('.cs-learn-recent')?.textContent ?? ''), { timeout: 15000 })
  ok('"Các bạn vừa trả bài" ngay dưới phần học có bài vừa trả')
  await page.screenshot({ path: `${SHOTS}/cp-2-submitted-390.png`, fullPage: true })
  await clickText(page, 'Xem cuộc trao đổi', 'button', '#bai-tra-1\\.1')
  await page.waitForFunction(() => location.pathname.startsWith('/me/t/'))
  threadId = await page.evaluate(() => location.pathname.split('/').pop())
  await waitText(page, /Bài trả 1\.1 · Âm giai C–Am/)
  await waitText(page, /SOLO01 · Buổi 01/)
  await waitText(page, /Mở giáo trình Buổi 01/)
  ok('Xem cuộc trao đổi → /me/t/<id>: "Bài trả 1.1 · …", "SOLO01 · Buổi 01", nút Mở giáo trình')
  await ctx.close()

  // ── 3. Quyền xem: A (cùng lớp) xem được qua feed lớp; C (lớp TH02) không ───────────────────────
  ;({ ctx, page } = await meAs('a@test.local', `/classes/${TH01}`))
  await page.waitForSelector('.cs-learn-map', { timeout: 15000 })
  await page.waitForFunction(() => /Bài trả 1\.1/.test(document.querySelector('.cs-learn-recent')?.textContent ?? ''), { timeout: 15000 })
  ok('A (cùng lớp) thấy bài trả của B trong "Các bạn vừa trả bài"')
  await clickText(page, 'Xem thêm về lớp')
  await page.waitForSelector('.lt-profile-tabs')
  await waitText(page, /Hoạt động/)
  await waitText(page, /Bài trả 1\.1/)
  assert.equal(await page.$$eval('.cs-learn-map', e => e.length), 0)
  ok('"Xem thêm về lớp" → trang cộng đồng lớp hiện có (Hoạt động | Thành viên), có bài trả của B')
  await clickText(page, 'Vào học'); await page.waitForSelector('.cs-learn-map')
  ok('"Vào học" → về màn học')
  await ctx.close()
  ;({ ctx, page } = await meAs('c@test.local', `/t/${threadId}`))
  await waitText(page, /không có quyền xem|Không tìm thấy/)
  ok('C (lớp TH02) mở link bài trả của B → không xem được')
  await ctx.close()

  // ── 4. Thầy: hàng đợi có ngữ cảnh → chấm ĐẠT → Buổi 01 xong, Buổi 02 mở ───────────────────────
  ;({ ctx, page } = await meAs('t@test.local', '', 1280))
  await page.waitForSelector('.cs-share', { timeout: 15000 })
  await page.goto(`${ME}/queue`, { waitUntil: 'networkidle0' })
  await waitText(page, /Bài trả 1\.1 · Âm giai C–Am/)
  await waitText(page, /SOLO01 · Buổi 01/)
  ok('Hàng đợi Thầy (/me/queue): có "Bài trả 1.1 · Âm giai C–Am" + "SOLO01 · Buổi 01"')
  await page.goto(`${ME}/t/${threadId}`, { waitUntil: 'networkidle0' })
  await waitText(page, /Khi mọi bài trả bắt buộc của buổi đã Đạt/)
  await page.type('.lt-compose[aria-label="Thầy phản hồi"] textarea', 'Âm giai đều, chuyển vùng ổn. Đạt.')
  await clickText(page, 'Đạt')
  await waitText(page, /nhận xét · Đạt/); await waitText(page, /Đã đạt/)
  ok('Thầy chấm Đạt tại /me/t/<id> (ghi chú đúng: Đạt đủ bài bắt buộc → mở buổi tiếp)')
  await page.goto(`${ME}/classes/${TH01}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-learn-map')
  await waitText(page, /vai trò giáo viên/)
  assert.equal(await page.$$eval('.lsn-paper button', bs => bs.filter(b => /TRẢ BÀI/.test(b.textContent)).length), 0, 'Thầy không có nút TRẢ BÀI')
  ok('Thầy mở lớp: xem trước mọi buổi, không có nút TRẢ BÀI')
  await page.screenshot({ path: `${SHOTS}/cp-3-teacher-1280.png`, fullPage: true })
  await ctx.close()

  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`))
  await page.waitForSelector('.cs-learn-map', { timeout: 15000 })
  await page.waitForSelector('.lsn-paper', { timeout: 15000 })
  r = await rows(page)
  assert.ok(/is-done/.test(r[0].cls), 'Buổi 01 hoàn thành')
  assert.ok(r[1].expanded && /is-current/.test(r[1].cls), 'Buổi 02 tự mở + là buổi hiện tại')
  assert.ok(/is-locked/.test(r[2].cls), 'Buổi 03 vẫn khoá')
  assert.match(await cpText(page, '2.1'), /TRẢ BÀI/)
  assert.match(await page.$eval('.cs-learn-status', e => e.textContent), /0\/2 bài trả bắt buộc đã Đạt/)
  ok('B vào lại: Buổi 01 ✓ · Buổi 02 tự mở (bài trả 2.1, 2.2) · Buổi 03 khoá · dòng "0/2 bài trả bắt buộc đã Đạt"')
  await page.click('#buoi-01'); await page.waitForSelector('.lsn-paper')
  assert.match(await cpText(page, '1.1'), /Đạt/)
  assert.doesNotMatch(await cpText(page, '1.1'), /TRẢ BÀI|TRẢ LẠI/)
  ok('Buổi 01: checkpoint 1.1 hiện "Đạt" tại chỗ')
  await page.screenshot({ path: `${SHOTS}/cp-4-next-session-390.png`, fullPage: true })
  await ctx.close()

  // ── 5. Desktop + trang công khai SOLO01 không đổi (route cũ, không đăng nhập, không nút trả bài) ──
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`, 1280))
  await page.waitForSelector('.lsn-paper', { timeout: 15000 })
  await noHorizontalOverflow(page, 'màn học 1280px')
  await page.screenshot({ path: `${SHOTS}/cp-5-learn-1280.png`, fullPage: true })
  await ctx.close()
  ;({ ctx, page } = await ctxPage(390))
  await page.goto(`http://127.0.0.1:${V}/solo01/buoi-01?xem`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.lsn-paper', { timeout: 15000 })
  assert.equal(await page.$$eval('.lsn-cp-slot', e => e.length), 0)
  ok('Trang công khai /solo01/buoi-01 vẫn chạy (route cũ), không có nút trả bài')
  await ctx.close()

  // ── 6. Chế độ GIÁO TRÌNH: lớp có giáo trình nhưng CHƯA có bài trả (như SOLO01 production hiện nay) ──────────
  const CUR = 'b1000000-0000-4000-8000-000000000004'
  ;({ ctx, page } = await meAs('a@test.local', `/classes/${CUR}`))
  await page.waitForSelector('.cs-learn-map', { timeout: 15000 })
  await page.waitForSelector('.lsn-paper', { timeout: 15000 })
  r = await rows(page)
  assert.deepEqual(r.map(x => x.title), ['Buổi 01 · Mở đầu', 'Buổi 02 · Tuần này', 'Buổi 03 · Đang soạn', 'Buổi 04 · Chưa có'])
  assert.ok(r[1].expanded && /is-current/.test(r[1].cls), 'buổi hiện tại theo lịch (Buổi 02) tự mở')
  assert.equal(r.filter(x => x.expanded).length, 1)
  assert.ok(r.every(x => !/is-locked/.test(x.cls)), 'không khoá buổi nào (chưa có bài trả → không khoá chết)')
  assert.equal(await page.$$eval('.cs-learn-row-badge', e => e.length), 0, 'dòng thu gọn chỉ Buổi + tiêu đề')
  assert.match(await page.$eval('.lsn-paper', e => e.textContent), /Nội dung thật buổi 2/)
  assert.equal(await page.$$eval('.cs-learn-break', e => e.map(x => x.textContent)).then(t => t.join('|')), 'Nghỉ giữa chặng – thời gian tự luyện')
  assert.equal(await page.$$eval('button', bs => bs.filter(b => /TRẢ BÀI|TRẢ LẠI/.test(b.textContent)).length), 0, 'không nút trả bài')
  assert.equal(await page.$$eval('.cs-learn-status', e => e.length), 0, 'không dòng tiến độ / màu giả')
  ok('Chế độ giáo trình (A): sơ đồ 4 buổi gọn · Buổi 02 (theo lịch) tự mở · không khoá · dòng nghỉ là vạch ngăn · không nút trả bài · không màu giả')
  await page.click('#buoi-01'); await waitText(page, /Nội dung thật buổi 1/)
  r = await rows(page); assert.ok(r[0].expanded && !r[1].expanded, 'một chạm mở Buổi 01, Buổi 02 thu lại')
  await page.click('#buoi-03'); await waitText(page, /Nội dung buổi này đang được cập nhật/)
  assert.equal(await page.$$eval('.lsn-paper', e => e.length), 0, 'buổi nháp: không lộ nháp')
  await page.click('#buoi-04'); await waitText(page, /Nội dung buổi này đang được cập nhật/)
  ok('Một chạm mở/đóng; Buổi 03 (nháp) và Buổi 04 (chưa có) → "Nội dung buổi này đang được cập nhật."')
  await waitText(page, /Các bạn vừa trả bài/); await waitText(page, /Chưa có bài trả nào/)
  ok('Bên dưới: "Các bạn vừa trả bài" (trống gọn) + Xem thêm về lớp')
  await noHorizontalOverflow(page, 'chế độ giáo trình 390px')
  await page.screenshot({ path: `${SHOTS}/cur-1-learner-390.png`, fullPage: true })
  await ctx.close()
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${CUR}`))
  await page.waitForSelector('.lt-profile-tabs', { timeout: 15000 })
  assert.equal(await page.$$eval('.cs-learn-map', e => e.length), 0)
  ok('B (thành viên nhưng KHÔNG có quyền giáo trình) → trang lớp cũ (không nới quyền)')
  await ctx.close()
  ;({ ctx, page } = await meAs('t@test.local', '', 1280))
  await page.waitForSelector('.cs-share', { timeout: 15000 })
  await page.goto(`${ME}/classes/${CUR}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-learn-map', { timeout: 15000 })
  await waitText(page, /vai trò giáo viên/)
  await page.$eval('#buoi-01', b => b.click()); await waitText(page, /Nội dung thật buổi 1/)
  await noHorizontalOverflow(page, 'Thầy xem chế độ giáo trình 1280px')
  await page.screenshot({ path: `${SHOTS}/cur-2-teacher-1280.png`, fullPage: true })
  ok('Thầy/admin (không là học viên lớp) xem trước màn học + mở giáo án')
  await ctx.close()

  assert.deepEqual(errors, [], 'không có lỗi JS / console')
  ok('không có lỗi JS / console trong toàn bộ kịch bản checkpoint')
  console.log(`ALL CHECKPOINT E2E PASS (${pass})`)
} catch (e) {
  console.error('FAIL:', e.message)
  try { await page?.screenshot({ path: `${SHOTS}/cp-FAIL.png`, fullPage: true }); console.error('URL:', page?.url(), '\n', (await page?.evaluate(() => document.body.innerText))?.slice(-1800)) } catch { /* bỏ qua */ }
  if (errors.length) console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
