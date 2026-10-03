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
  headless: true, args: ['--no-first-run', '--no-default-browser-check'], dumpio: !!process.env.E2E_DUMPIO,
})
let pass = 0
const ok = msg => { pass++; console.log('PASS: ' + msg) }
const errors = []

async function ctxPage(width = 390) {
  // Chrome đôi khi trả "Session with given id not found" ngay sau khi đóng context cũ → thử lại ngắn (hạ tầng test)
  let ctx = null
  for (let i = 0; !ctx; i++) {
    try { ctx = await browser.createBrowserContext() } catch (e) {
      if (i >= 4 || !/Session with given id not found/.test(e.message)) throw e
      await new Promise(r => setTimeout(r, 500))
    }
  }
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
// Class Page V2: MỤC LỤC SỐNG — dòng buổi = TÊN (nút → Trang Buổi) + dòng phụ (trạng thái · bài trả của tôi)
const rows = page => page.$$eval('.cs-map-row', els => els.map(e => ({
  // V3: cột số riêng + tên buổi (bỏ chữ ẩn cho trình đọc màn hình) → "01 · Tên"
  title: (e.querySelector('.cs-map-no')?.textContent ?? '') + ' · ' + [...(e.querySelector('.cs-map-title')?.childNodes ?? [])]
    .filter(n => !(n.nodeType === 1 && (n.classList.contains('cs-sr-only') || n.tagName.toLowerCase() === 'svg'))).map(n => n.textContent).join('').trim(),
  current: e.getAttribute('aria-current') === 'step',
  disabled: e.classList.contains('is-locked'), meta: e.querySelector('.cs-map-meta')?.textContent ?? '', cls: e.className })))
// Trang Lớp (bản đồ) vs Trang Buổi (phòng học)
const onClassPage = async page => { await page.waitForSelector('.cs-map', { timeout: 15000 }); assert.equal(await page.$$eval('.lsn-paper', e => e.length), 0, 'Trang Lớp KHÔNG render giáo án') }
async function openSessionFromMap(page, no) {
  await page.click(`#buoi-${String(no).padStart(2, '0')} .cs-map-title`)
  await page.waitForFunction(n => new RegExp(`/sessions/${n}$`).test(location.pathname), { timeout: 15000 }, no)
  assert.equal(await page.$$eval('.cs-map, .cs-classv2-feed, .cs-subs-panel', e => e.length), 0, 'Trang Buổi: không bản đồ, không feed lớp')
}
// Mục lục: chặng thu gọn → bung hết khi cần xem đủ buổi
async function expandAll(page) {
  for (const b of await page.$$('.cs-map-stage-toggle[aria-expanded="false"]')) await b.click()
}
const feedText = page => page.$eval('.cs-classv2', e => e.querySelector('.cs-classv2-feed')?.textContent ?? '')
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
  // Class UX V3: trang HỌC — Tên lớp → Mục lục → cánh cửa Không gian lớp; KHÔNG feed / thành viên / Tiếp tục học / tab
  const top = await page.evaluate(() => { const t = document.querySelector('.cs-classv3').textContent
    return [t.indexOf('Solo Guitar'), t.indexOf('Mục lục'), t.indexOf('Không gian lớp')] })
  assert.ok(top.every((x, i) => x >= 0 && (i === 0 || x > top[i - 1])), 'thứ tự: Tên lớp → Mục lục → Không gian lớp ' + top)
  assert.equal(await page.evaluate(() => /Tiếp tục học|Hoạt động gần đây|Xem toàn bộ giáo trình|Vào học|Lớp mình đang học/.test(document.querySelector('.cs-classv3').textContent)), false)
  assert.equal(await page.$$eval('.cs-classv3 .lt-profile-tabs, .cs-now-go, .cs-classv3 .cs-classv2-feed, .cs-classv3 .cs-member-list, .cs-subs-panel', e => e.length), 0, '390: một cột, không feed/thành viên/panel')
  assert.ok(await page.evaluate(() => scrollY) <= 10, 'vào lớp không tự cuộn')
  let r = await rows(page)
  assert.deepEqual(r.map(x => x.title), ['01 · Bản đồ nốt C–Am', '02 · Ép ngón & Bass', '03 · Slide', '04 · Xếp ngón'])
  assert.ok(r[0].current && /is-current/.test(r[0].cls), 'Buổi 01 là buổi hiện tại (tô nhẹ)')
  assert.match(r[0].meta, /^0\/2 bài trả Đạt/)
  assert.equal(await page.$eval('#buoi-01 .cs-map-no', e => e.textContent), '01', 'cột số buổi riêng')   // không nhãn vị trí "Đang học" — vị trí do bản đồ tự nói
  assert.equal(/Đang học|Chưa học/.test(r.map(x => x.meta).join('|')), false)
  assert.ok(r[1].disabled && r[2].disabled && r[1].meta === '' && r[2].meta === '', 'Buổi 02/03 khoá: thấy TÊN + ổ khoá; danh sách không lặp gợi ý mở khoá')
  assert.equal(await page.$$eval('.cs-map-row.is-locked .cs-map-lock', e => e.length), 3, 'ổ khoá trên mỗi buổi khoá (chữ "Chưa mở" cho trình đọc màn hình)')
  assert.equal(await page.$$eval('#buoi-02 button.cs-map-title', e => e.length), 0)
  ok('B (390): Trang học V3 = Tên lớp → Mục lục (cột số · 01 0/2 bài trả Đạt · 02–04 khoá, ổ khoá + muted) → cánh cửa Không gian lớp; không feed/thành viên')
  await page.screenshot({ path: `${SHOTS}/cp-0-class-v2-390.png`, fullPage: false })
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
  assert.ok(await page.evaluate(() => scrollY) <= 10, 'về lớp: không tự cuộn — vẫn thấy mục lục từ đầu')
  // bung "0/2 bài trả Đạt" ngay tại Buổi 01 → 1.1 Chờ Thầy (thread thật) · 1.2 Chưa trả
  await page.click('#buoi-01 .cs-map-subs')
  await page.waitForSelector('#buoi-01 .cs-map-cps')
  const cps = await page.$$eval('#buoi-01 .cs-map-cp', bs => bs.map(b => b.textContent))
  assert.ok(/Bài trả 1\.1[\s\S]*Chờ Thầy/.test(cps[0]) && /Bài trả 1\.2[\s\S]*Chưa trả/.test(cps[1]), JSON.stringify(cps))
  ok('← Về lớp: mục lục từ đầu · bung Buổi 01 tại chỗ (390): 1.1 Chờ Thầy · 1.2 Chưa trả')
  // bài chưa trả → Trang Buổi tại ĐÚNG bài trả 1.2
  await page.$$eval('#buoi-01 .cs-map-cp', bs => bs[1].click())
  await page.waitForFunction(id => location.pathname === `/me/classes/${id}/sessions/1`, {}, TH01)
  await page.waitForSelector('#bai-tra-1\\.2')
  await page.waitForFunction(() => { const r = document.getElementById('bai-tra-1.2').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight }, { timeout: 10000 })
  ok('Bấm bài trả CHƯA trả (1.2) → Trang Buổi 01, khối Bài trả 1.2 nằm trong màn hình')
  // bài đã có thread → đúng cuộc trao đổi
  await page.click('.cs-session-back'); await onClassPage(page)
  await page.click('#buoi-01 .cs-map-subs'); await page.waitForSelector('#buoi-01 .cs-map-cp')
  await page.$$eval('#buoi-01 .cs-map-cp', bs => bs[0].click())
  await page.waitForFunction(() => location.pathname.startsWith('/me/t/'))
  ok('Bấm bài trả ĐÃ trả (1.1) → đúng cuộc trao đổi /me/t/<id>')

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
  await openSessionFromMap(page, 1)
  await page.waitForSelector('.lsn-paper', { timeout: 15000 })
  ok('Bấm TÊN Buổi 01 → đúng Trang Buổi (/sessions/1)')
  await page.click('.cs-session-back'); await onClassPage(page)
  await page.click('.cs-space-door-go')
  await page.waitForFunction(id => location.pathname === `/me/classes/${id}/space`, {}, TH01)
  await page.waitForFunction(() => /Bài trả 1\.1/.test(document.querySelector('.cs-classv2-feed')?.textContent ?? ''), { timeout: 15000 })
  assert.equal(await page.evaluate(() => /Solo Guitar Căn Bản/.test(document.querySelector('.cs-classv2-feed').textContent)), false, 'feed không lặp tên lớp')
  await page.waitForSelector('.cs-member-list', { timeout: 15000 })
  ok('A (cùng lớp) → Không gian lớp: thấy bài trả của B (không lặp tên lớp) + danh sách thành viên sẵn có')
  await page.click('.cs-classspace-back'); await page.waitForFunction(id => location.pathname === `/me/classes/${id}`, {}, TH01); await onClassPage(page)
  ok('Không gian lớp "←" → đúng trang học của lớp')
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
  await onClassPage(page); await waitText(page, /Giáo viên xem trước/)
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
  await expandAll(page)
  r = await rows(page)
  assert.ok(/Hoàn thành\s*·\s*✓\s*1\/2 bài trả Đạt/.test(r[0].meta) && r[1].current && !r[1].disabled && r[2].disabled, JSON.stringify(r))
  await openSessionFromMap(page, 2)
  await page.waitForSelector('#bai-tra-2\\.1'); assert.match(await cpText(page, '2.1'), /TRẢ BÀI/)
  assert.match(await page.$eval('.cs-learn-status', e => e.textContent), /0\/2 bài trả bắt buộc đã Đạt/)
  await page.click('.cs-session-nav button')   // ← Buổi 01
  await page.waitForFunction(id => location.pathname === `/me/classes/${id}/sessions/1`, {}, TH01)
  await page.waitForSelector('#bai-tra-1\\.1'); assert.match(await cpText(page, '1.1'), /Đạt/); assert.doesNotMatch(await cpText(page, '1.1'), /TRẢ BÀI|TRẢ LẠI/)
  ok('B vào lại: Buổi 01 Hoàn thành · ✓ 1/2 bài trả Đạt · Buổi 02 hiện tại (mở) · Buổi 03 khoá · Trang Buổi 02 có 2.1 + "0/2 bài trả bắt buộc" · "← Buổi 01" → 1.1 "Đạt"')
  await ctx.close()

  // ── 4b. Class UX V3 — DESKTOP master-detail: Mục lục trái ↔ Bài trả của tôi phải; 768 = một cột ──────────────
  for (const w of [1280, 1440]) {
    ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`, w))
    await onClassPage(page)
    await page.waitForSelector('.cs-learnmap.is-split .cs-subs-panel', { timeout: 15000 })
    const g = await page.evaluate(() => {
      const m = document.querySelector('.cs-learnmap-main').getBoundingClientRect(), p = document.querySelector('.cs-learnmap-side').getBoundingClientRect()
      const root = document.querySelector('.cs-classv3').getBoundingClientRect()
      return { mw: m.width, pw: p.width, sameRow: Math.abs(m.top - p.top) < 4, left: p.left > m.right, root: root.width }
    })
    assert.ok(g.sameRow && g.left && g.mw > g.pw * 1.3 && g.root > 900, `${w}: hai cột, mục lục rộng hơn panel ${JSON.stringify(g)}`)
    // mặc định panel diễn giải buổi hiện tại (Buổi 02) — chỉ chọn, không cuộn, không nhảy trang
    assert.match(await page.$eval('.cs-subs-panel', e => e.textContent), /Bài trả của tôi[\s\S]*Buổi 02 · Ép ngón & Bass[\s\S]*0\/\d Đạt/)
    assert.equal(await page.$eval('#buoi-02 .cs-map-subs', b => b.getAttribute('aria-pressed')), 'true', 'buổi đang diễn giải')
    await page.click('#buoi-01 .cs-map-subs')
    await page.waitForFunction(() => /Buổi 01 · Bản đồ nốt C–Am[\s\S]*1\/2 Đạt/.test(document.querySelector('.cs-subs-panel').textContent))
    assert.equal(await page.$$eval('.cs-map .cs-map-cps', e => e.length), 0, 'desktop: không bung trong mục lục')
    assert.equal(await page.evaluate(() => location.pathname.endsWith('/sessions/1')), false, 'chọn buổi KHÔNG điều hướng')
    assert.ok(await page.evaluate(() => scrollY) <= 10, 'không tự cuộn')
    assert.equal(await page.evaluate(() => /Tiếp tục học|Lớp mình đang học/.test(document.body.textContent)), false)
    await noHorizontalOverflow(page, `Trang học V3 ${w}px`)
    await page.screenshot({ path: `${SHOTS}/v3-desktop-${w}.png`, fullPage: true })
    ok(`${w}px: master-detail — Mục lục trái (${Math.round(g.mw)}px) ↔ Bài trả của tôi phải (${Math.round(g.pw)}px): mặc định Buổi 02 hiện tại · chọn Buổi 01 → ✓ 1/2 Đạt`)
    if (w === 1280) {
      // Buổi 02 → panel đổi; bài chưa trả → Trang Buổi đúng bài trả; tên buổi vẫn là đường vào Trang Buổi
      await page.click('#buoi-02 .cs-map-subs')
      await page.waitForFunction(() => /Buổi 02/.test(document.querySelector('.cs-subs-panel').textContent))
      assert.equal(await page.$eval('#buoi-02', e => e.classList.contains('is-selected')), true)
      const cps = await page.$$eval('.cs-subs-panel .cs-map-cp', bs => bs.map(b => b.textContent))
      assert.ok(cps.length >= 1 && cps.every(t => /Chưa trả/.test(t)), JSON.stringify(cps))
      await page.$$eval('.cs-subs-panel .cs-map-cp', bs => bs[0].click())
      await page.waitForFunction(id => location.pathname === `/me/classes/${id}/sessions/2`, {}, TH01)
      await page.waitForSelector('#bai-tra-2\\.1', { timeout: 15000 })
      ok('1280: chọn Buổi 02 → panel đổi; bài chưa trả trong panel → Trang Buổi 02 đúng bài trả')
      await page.click('.cs-session-back'); await onClassPage(page)
      await page.click('#buoi-01 .cs-map-subs')
      await page.waitForFunction(() => /Buổi 01/.test(document.querySelector('.cs-subs-panel').textContent))
      await page.$$eval('.cs-subs-panel .cs-map-cp', bs => bs[0].click())
      await page.waitForFunction(() => location.pathname.startsWith('/me/t/'))
      ok('1280: bài đã trả (1.1 Đạt) trong panel → đúng cuộc trao đổi')
      await page.goto(`${ME}/classes/${TH01}`, { waitUntil: 'networkidle0' }); await onClassPage(page)
      await page.click('#buoi-01 .cs-map-title')
      await page.waitForFunction(id => location.pathname === `/me/classes/${id}/sessions/1`, {}, TH01)
      ok('1280: TÊN buổi vẫn là đường vào Trang Buổi (con đường mòn không đổi)')
    }
    await ctx.close()
  }
  {
    ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`, 768))
    await onClassPage(page)
    await new Promise(r => setTimeout(r, 800))
    assert.equal(await page.$$eval('.cs-learnmap.is-split, .cs-subs-panel', e => e.length), 0, '768: một cột')
    await page.click('#buoi-01 .cs-map-subs'); await page.waitForSelector('#buoi-01 .cs-map-cps')
    await noHorizontalOverflow(page, 'Trang học V3 768px')
    ok('768px: một cột — bấm số bài trả bung tại chỗ (không ép master-detail)')
    await ctx.close()
  }
  // /ME VISUAL SYSTEM V1 — quét bề rộng: không tràn ngang · ≤ 1 nút tím chính trong viewport · trang rộng không là "cột mobile giữa biển trắng"
  for (const w of [320, 390, 768, 1280, 1440, 1600]) {
    ;({ ctx, page } = await meAs('b@test.local', '', w))
    for (const [name, path, sel] of [['home', '', '.cs-home-feedfirst'], ['classes', '/classes', '.cs-myclasses-page'], ['class', `/classes/${TH01}`, '.cs-map-row'],
      ['space', `/classes/${TH01}/space`, '.cs-classspace .cs-act-line'], ['friends', '/friends', '.cs-friends-page'],
      ['tabclass', '?feed=classes', '.cs-home-classes .cs-classrow'], ['thread', `/t/${threadId}`, '.lt-page'],
      ['profile', '/u/bbbbbbbb-0000-4000-8000-00000000000b', '.cs-profile-page']]) {
      await page.goto('about:blank'); await page.goto(`${ME}${path}`, { waitUntil: 'networkidle0' })
      await page.waitForSelector(sel, { timeout: 15000 })
      await noHorizontalOverflow(page, `${name} ${w}px`)
      const prim = await page.$$eval('.cs-btn-primary', bs => bs.filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight }).length)
      assert.ok(prim <= 1, `${name} ${w}px: ${prim} nút tím chính trong viewport`)
      if (w >= 1280 && (name === 'class' || name === 'space')) {
        const cw = await page.$eval('.cs-main > *:not(.cs-topbar)', e => e.getBoundingClientRect().width).catch(() => 0)
        const root = await page.$eval(name === 'class' ? '.cs-classv3' : '.cs-classspace', e => e.getBoundingClientRect().width)
        assert.ok(root >= 860, `${name} ${w}px: nội dung chỉ ${Math.round(root)}px (main ${Math.round(cw)})`)
      }
      if (name === 'space') {
        assert.ok(await page.$$eval('.cs-classspace .cs-act-line > .cs-avatar', e => e.length) > 0, 'Không gian lớp: dòng hoạt động có avatar (người trước)')
      }
      await page.screenshot({ path: `${SHOTS}/vs-${name}-${w}.png`, fullPage: false })
    }
    ok(`Visual ${w}px: Home · tab Lớp · Lớp của tôi · Trang lớp · Không gian lớp · Bạn bè · Thread · Trang cá nhân — không tràn ngang, ≤ 1 nút tím chính/viewport`)
    await ctx.close()
  }
  {
    ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`, 320))
    await onClassPage(page)
    await page.click('#buoi-01 .cs-map-subs'); await page.waitForSelector('#buoi-01 .cs-map-cps')
    await noHorizontalOverflow(page, 'Trang học V3 320px')
    await page.screenshot({ path: `${SHOTS}/v3-mobile-320.png`, fullPage: true })
    ok('320px: mục lục một cột + bung bài trả tại chỗ, không tràn ngang')
    await ctx.close()
  }

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
  assert.deepEqual(r.map(x => x.title), ['01 · Mở đầu', '02 · Tuần này', '03 · Đang soạn', '04 · Chưa có'])
  assert.ok(r[1].current && r.every(x => !x.disabled), 'buổi hiện tại theo lịch (02); không khoá buổi nào')
  assert.ok(r.every(x => !/bài trả|Đang học|Chưa học/.test(x.meta)), 'chế độ giáo trình: không giả tiến độ / bài trả')
  assert.equal(await page.$$eval('.cs-learn-break', e => e.map(x => x.textContent).join('|')), 'Nghỉ giữa chặng – thời gian tự luyện')
  await waitText(page, /Không gian lớp/)
  assert.equal(await page.$$eval('.cs-subs-panel, .cs-learnmap.is-split', e => e.length), 0, 'chế độ giáo trình: không master-detail giả')
  ok('Chế độ giáo trình: Trang Lớp gọn — 4 buổi, Buổi 02 hiện tại, vạch nghỉ, không khoá, không giáo án, cánh cửa Không gian lớp')
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
  assert.ok(await page.evaluate(() => scrollY) <= 10, 'về lớp: mục lục từ đầu')
  ok('Buổi 02 → "Buổi 03 →" → ← Về lớp: về Trang Lớp (không quay lại Buổi 02), mục lục từ đầu')
  await page.goto(`${ME}/classes/${CUR}/sessions/1`, { waitUntil: 'networkidle0' })   // mở THẲNG bằng link
  await page.waitForSelector('.lsn-paper'); await clickText(page, 'Buổi 02'); await page.waitForFunction(() => /\/sessions\/2$/.test(location.pathname))
  await page.click('.cs-session-back'); await page.waitForFunction(id => location.pathname === `/me/classes/${id}`, {}, CUR)
  await onClassPage(page)
  ok('Mở thẳng link Buổi 01 → "Buổi 02 →" → ← Về lớp: mở Trang Lớp (không rời site)')
  await noHorizontalOverflow(page, 'Trang Lớp chế độ giáo trình 390px')
  await page.screenshot({ path: `${SHOTS}/cur-1-class-390.png`, fullPage: true })
  await ctx.close()
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${CUR}`))
  await waitText(page, /Giáo trình lớp chưa bật cho bạn/)
  assert.equal(await page.$$eval('.cs-map', e => e.length), 0)
  await page.goto(`${ME}/classes/${CUR}/sessions/1`, { waitUntil: 'networkidle0' })
  await waitText(page, /chưa xem được giáo trình/)
  assert.equal(await page.$$eval('.lsn-paper', e => e.length), 0)
  ok('B (thành viên, KHÔNG quyền giáo trình): Trang Lớp nói rõ "Giáo trình lớp chưa bật cho bạn" · vào thẳng URL buổi → không lộ giáo án')
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
