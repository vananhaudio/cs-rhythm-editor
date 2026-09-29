// Kịch bản E2E Learning Thread P1 trong Chrome thật (puppeteer-core) trên stack local — xem scripts/e2e-learning-thread.sh.
// App (harness gắn LessonThreadPanel như MobileStudentPortal) ↔ Social (/me thật trên host class.localhost).
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const APP = `http://127.0.0.1:${V}/tests/e2e-learning-thread/app.html`
const ME = `http://class.localhost:${V}/me`
const L1 = 'e0000000-0000-4000-8000-000000000001'   // Trả bài + Hỏi bài
const L2 = 'e0000000-0000-4000-8000-000000000002'   // chưa cấu hình → không CTA
const L3 = 'e0000000-0000-4000-8000-000000000003'   // chỉ Hỏi bài
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
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_/.test(m.text())) errors.push('console: ' + m.text() + ' @ ' + (m.location()?.url ?? '')) })
  return { ctx, page }
}
const text = page => page.evaluate(() => document.body.innerText)
async function waitText(page, re, timeout = 10000) {
  await page.waitForFunction(r => new RegExp(r, "u").test(document.body.textContent), { timeout }, re.source)
}
async function clickText(page, label, scope = 'button') {
  const h = await page.waitForFunction((l, s) => [...document.querySelectorAll(s)].find(b => b.textContent.trim() === l && !b.disabled && b.offsetParent !== null), { timeout: 10000 }, label, scope)
  await h.asElement().click()
}
async function noHorizontalOverflow(page, label) {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  assert.ok(sw <= iw + 1, `${label}: tràn ngang ${sw} > ${iw}`)
  ok(`${label}: không tràn ngang (${sw} ≤ ${iw}px)`)
}
async function appAs(email, lessons = [L1, L2, L3]) {
  const { ctx, page } = await ctxPage()
  await page.goto(`${APP}?as=${email}&lessons=${lessons.join(',')}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#ready')
  return { ctx, page }
}
async function meAs(email, path = '') {
  const { ctx, page } = await ctxPage()
  await page.goto(ME + path, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', email)
  await page.type('#cs-login-pass', 'e2e')
  await page.click('.cs-guest-submit')
  return { ctx, page }
}
const rpc = (page, fn, args) => page.evaluate(async (f, a) => {
  const sb = window.__sb
  if (sb) { const { data, error } = await sb.rpc(f, a); return { data, error: error?.message ?? null } }
  return { data: null, error: 'no client' }
}, fn, args)

try {
  // ── 1. Học sinh A (lớp DH2.KD18) trong App: CTA theo cấu hình bài ──────────
  let { ctx, page } = await appAs('a@test.local')
  await waitText(page, /Trả bài \/ Hỏi bài/)
  const panels = await page.$$eval('[data-lesson]', els => els.map(e => ({ id: e.getAttribute('data-lesson'), cta: !!e.querySelector('.lt-panel'), text: e.textContent })))
  assert.ok(panels.find(p => p.id === L1).cta, 'bài 1 có CTA')
  assert.equal(panels.find(p => p.id === L2).cta, false, 'bài 2 (chưa cấu hình) KHÔNG có CTA')
  const p3 = panels.find(p => p.id === L3)
  assert.ok(p3.cta && /Hỏi bài/.test(p3.text) && !/Trả bài/.test(p3.text), 'bài 3 chỉ Hỏi bài')
  assert.match(panels.find(p => p.id === L1).text, /Bạn có thể gửi phần thực hành/)
  ok('App: bài bật → CTA "Trả bài / Hỏi bài" + lời dặn; bài chưa cấu hình → không CTA; bài chỉ Hỏi bài → chỉ "Hỏi bài"')
  await page.screenshot({ path: `${SHOTS}/1-app-cta.png`, fullPage: true })

  await page.$eval(`[data-lesson="${L1}"] .lt-btn.is-primary`, b => b.click())
  await page.waitForSelector('.lt-sheet')
  await waitText(page, /Ai được xem cuộc trao đổi này/)
  assert.equal(await page.$eval('input[value="community"]', i => i.checked), true)
  ok('Sheet Trả bài: không chọn khoá/bài/lớp; mặc định "Cộng đồng học tập"')
  await page.type('.lt-sheet input[type="url"]', 'https://youtu.be/aaaaaaaaaaa')
  await page.type('.lt-sheet textarea', 'Em nộp bài Bolero móc kiểu 1 ạ')
  await noHorizontalOverflow(page, 'App sheet (390px)')
  await page.screenshot({ path: `${SHOTS}/2-app-compose.png` })
  await clickText(page, 'Gửi bài')
  await waitText(page, /Đã gửi · Chờ Thầy phản hồi/)
  await waitText(page, /DH2\.KD18 · Đệm hát 2/)
  ok('A gửi → ở lại App, thấy ngay "Đã gửi · Chờ Thầy phản hồi" + danh tính DH2.KD18 · Đệm hát 2 (server đóng dấu)')
  await page.screenshot({ path: `${SHOTS}/3-app-waiting.png` })
  const mine = await rpc(page, 'lt_my_threads', {})
  const threadId = mine.data?.[0]?.id
  assert.ok(threadId, 'có thread id')
  await clickText(page, '‹')
  await waitText(page, /Đã gửi · Chờ Thầy phản hồi/)
  ok('Đóng sheet → chip trạng thái ngay tại bài')
  await ctx.close()

  // ── 2. Thầy: hàng đợi → mở thread → Cần làm lại ────────────────────────────
  ;({ ctx, page } = await meAs('t@test.local'))
  await (await page.waitForSelector('.cs-queue-entry', { timeout: 15000 })).click()
  await page.waitForFunction(() => location.pathname === '/me/queue')
  await waitText(page, /An · DH2\.KD18 · Đệm hát 2/)
  await waitText(page, /Trả bài: Em nộp bài Bolero/)
  ok('Thầy: dòng nhỏ "1 bài đang chờ phản hồi ›" trên Home → /me/queue thấy An · DH2.KD18 · bài · diễn biến cuối')
  await page.screenshot({ path: `${SHOTS}/4-queue.png`, fullPage: true })
  await page.$eval('.lt-row', b => b.click())
  await page.waitForFunction(id => location.pathname === '/me/t/' + id, {}, threadId)
  await waitText(page, /Thầy phản hồi/)
  await page.type('.lt-compose textarea', 'Tay phải móc chưa đều, em tập chậm lại rồi quay lại nhé.')
  await clickText(page, 'Cần làm lại')
  await waitText(page, /Thầy· nhận xét · Cần làm lại/)
  await waitText(page, /Cần làm lại/)
  ok('Thầy mở /me/t/<id> → phản hồi "Cần làm lại" → timeline cập nhật')
  await ctx.close()

  // ── 3. A thấy Cần làm lại trong App → Trả lại ─────────────────────────────
  ;({ ctx, page } = await appAs('a@test.local', [L1]))
  await waitText(page, /Cần làm lại/)
  ok('App: A thấy chip "Cần làm lại"')
  await clickText(page, 'Trả lại')
  await page.waitForSelector('.lt-sheet .lt-compose')
  await waitText(page, /Tay phải móc chưa đều/)
  assert.equal(await page.$('input[value="community"]'), null, 'lần sau không hỏi lại ai được xem')
  await page.type('.lt-sheet textarea', 'Em quay lại lần 2, chậm hơn ạ')
  await clickText(page, 'Gửi bài')
  await waitText(page, /Đã gửi · Chờ Thầy phản hồi/)
  await waitText(page, /Trả lại/)
  ok('A Trả lại trong CÙNG thread → Chờ Thầy phản hồi')
  await ctx.close()

  // ── 4. Thầy PASS ─────────────────────────────────────────────────────────
  ;({ ctx, page } = await meAs('t@test.local', '/t/' + threadId))
  await waitText(page, /Thầy phản hồi/, 15000)
  assert.equal(await page.evaluate(() => location.pathname), '/me/t/' + threadId)
  ok('Link /me/t/<id> giữ nguyên qua bước đăng nhập')
  await page.type('.lt-compose textarea', 'Lần này đều rồi. Đạt!')
  await clickText(page, 'Đạt')
  await waitText(page, /Thầy· nhận xét · Đạt/)
  await waitText(page, /Đã đạt/)
  ok('Thầy chấm ĐẠT → Đã đạt')
  await page.screenshot({ path: `${SHOTS}/5-thread-passed.png`, fullPage: true })
  await ctx.close()

  // ── 5. A thấy Đã đạt; hỏi tiếp vẫn được ───────────────────────────────────
  ;({ ctx, page } = await appAs('a@test.local', [L1]))
  await waitText(page, /Đã đạt/)
  const acts = await page.$$eval(`[data-lesson="${L1}"] .lt-btn`, bs => bs.map(b => b.textContent.trim()))
  assert.deepEqual(acts, ['Xem cuộc trao đổi', 'Hỏi tiếp'])
  ok('App: A thấy "Đã đạt" + [Xem cuộc trao đổi] [Hỏi tiếp]')
  const prog = await page.evaluate(async () => (await window.__sb.from('edu_lesson_progress').select('id')).data?.length ?? -1)
  assert.equal(prog, 0)
  ok('ĐẠT không ghi edu_lesson_progress')
  await ctx.close()

  // ── 6. C (thành viên Class khác lớp) xem được community; không có ô soạn ───
  ;({ ctx, page } = await meAs('c@test.local', '/t/' + threadId))
  await waitText(page, /Lần này đều rồi\. Đạt!/, 15000)
  assert.equal(await page.$('.lt-compose'), null, 'C không có ô soạn')
  await noHorizontalOverflow(page, '/me/t/<id> (390px)')
  ok('C xem thread community qua /me/t/<id> (không thể phản hồi)')
  await page.screenshot({ path: `${SHOTS}/6-community-viewer.png`, fullPage: true })

  // ── 7. A chuyển "Chỉ Thầy" → C mất quyền ──────────────────────────────────
  const { ctx: ctxA, page: pA } = await meAs('a@test.local', '/t/' + threadId)
  await waitText(pA, /Đang chia sẻ/, 15000)
  await clickText(pA, 'Chuyển sang "Chỉ Thầy"')
  await waitText(pA, /Chuyển sang "Cộng đồng học tập"/)
  ok('Chính chủ đổi sang "Chỉ Thầy" tại /me/t/<id>')
  await ctxA.close()
  await page.reload({ waitUntil: 'networkidle0' })
  await waitText(page, /không có quyền xem/, 15000)
  ok('C reload → "không tìm thấy / không có quyền" (server chặn, không chỉ ẩn giao diện)')
  await ctx.close()

  // ── 8. Tài khoản ngoài Class + khách ────────────────────────────────────
  ;({ ctx, page } = await meAs('n@test.local', '/t/' + threadId))
  await waitText(page, /Đăng xuất/, 15000)
  assert.equal(/Lần này đều rồi/.test(await text(page)), false)
  ok('Tài khoản ngoài Class: không vào được thread')
  await ctx.close()
  ;({ ctx, page } = await appAs('n@test.local', [L1]))
  const nRes = await rpc(page, 'lt_detail', { p_thread_id: threadId })
  assert.match(nRes.error ?? '', /LT_NOT_FOUND/)
  await ctx.close()
  ;({ ctx, page } = await appAs('', [L1]))
  const anon = await rpc(page, 'lt_detail', { p_thread_id: threadId })
  assert.match(anon.error ?? '', /permission denied/)
  assert.equal(await page.$('.lt-panel'), null)
  ok('Gọi thẳng API: ngoài Class → LT_NOT_FOUND; khách → permission denied; khách không thấy CTA')
  await ctx.close()

  // ── 9. B tự học (không lớp) → thread "Tự học"; mở /me thấy "Trả bài của tôi" ─
  ;({ ctx, page } = await appAs('b@test.local', [L1]))
  await page.$eval(`[data-lesson="${L1}"] .lt-btn`, b => b.click())
  await page.waitForSelector('.lt-sheet .lt-compose')
  await page.click('input[value="private"]')
  await page.type('.lt-sheet textarea', 'Em tự học, nhờ Thầy xem giúp')
  await clickText(page, 'Gửi bài')
  await waitText(page, /Tự học · DH2/)
  await waitText(page, /Chỉ Thầy/)
  ok('B tự học: tạo thread được, danh tính "Tự học · DH2", chọn "Chỉ Thầy" ngay khi gửi')
  await ctx.close()
  ;({ ctx, page } = await meAs('b@test.local'))
  await page.waitForSelector('.cs-share', { timeout: 15000 })
  assert.equal(await page.$('.cs-identity'), null, 'Home không lặp ảnh bìa/hồ sơ lớn')
  assert.equal(await page.$('.cs-cta-card'), null, 'không còn nút Trả bài hero trên Home')
  await page.$eval('.cs-share .cs-person-link', b => b.click())
  await page.waitForFunction(() => location.pathname.startsWith('/me/u/'))
  await clickText(page, 'Hành trình')
  await page.waitForSelector('.lt-ms-btn', { timeout: 15000 })
  await page.$eval('.lt-ms-btn', b => b.click())
  await page.waitForFunction(() => location.pathname.startsWith('/me/t/'))
  await waitText(page, /Em tự học, nhờ Thầy xem giúp/)
  ok('/me của B: Home gọn (ô chia sẻ → Feed); bấm avatar → trang cá nhân → Hành trình → mở đúng thread')
  await ctx.close()

  // ── 10. Desktop /me/t (1280px) không vỡ ─────────────────────────────────
  ;({ ctx, page } = await ctxPage(1280))
  await page.goto(ME + '/t/' + threadId, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email')
  await page.type('#cs-login-email', 't@test.local'); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await waitText(page, /Thầy· nhận xét · Đạt/, 15000)
  await noHorizontalOverflow(page, '/me/t/<id> desktop 1280px')
  await page.screenshot({ path: `${SHOTS}/8-desktop-thread.png`, fullPage: true })
  await ctx.close()

  // ── P2: Feed · Hành trình ───────────────────────────────────────────────
  ;({ ctx, page } = await appAs('a@test.local', [L1]))
  const vis = await rpc(page, 'lt_set_visibility', { p_thread_id: threadId, p_visibility: 'community' })
  assert.equal(vis.error, null)
  await ctx.close()
  ;({ ctx, page } = await meAs('c@test.local'))
  await page.waitForSelector('.lt-feed-card', { timeout: 15000 })
  const cards = await page.$$eval('.lt-feed-card', els => els.map(e => e.textContent))
  assert.equal(cards.length, 1, 'chỉ 1 thẻ: thread community của A (thread private của B KHÔNG lên Feed)')
  assert.match(cards[0], /An/); assert.match(cards[0], /DH2\.KD18 · Đệm hát 2/)
  assert.match(cards[0], /Bài 4\.3 — Bolero móc kiểu 1/); assert.match(cards[0], /vừa nhận xét · Đạt/); assert.match(cards[0], /Đã đạt/)
  ok('Feed /me của C: MỘT thẻ câu chuyện (An · DH2.KD18 · Bài 4.3 · Thầy vừa nhận xét · Đạt); thread private của B không có')
  await noHorizontalOverflow(page, 'Feed /me có thẻ thread (390px)')
  await page.screenshot({ path: `${SHOTS}/9-feed-thread-card.png`, fullPage: true })
  await page.$eval('.lt-feed-card .lt-feed-open', b => b.click())
  await page.waitForFunction(id => location.pathname === '/me/t/' + id, {}, threadId)
  ok('Bấm "Xem cuộc trao đổi" trên Feed → mở đúng /me/t/<id>')
  await page.goto(`${ME}/u/aaaaaaaa-0000-4000-8000-00000000000a`, { waitUntil: 'networkidle0' })
  await clickText(page, 'Hành trình')
  await waitText(page, /Hành trình âm nhạc của An/, 15000)
  await waitText(page, /DH2\.KD18 · Đệm hát 2/)
  const steps = await page.$eval('.lt-ms-steps', e => e.textContent)
  assert.match(steps, /Trả bài/); assert.match(steps, /Cần làm lại/); assert.match(steps, /Trả lại/); assert.match(steps, /Đạt/)
  ok('Hành trình của An (C xem): chặng DH2.KD18 · mốc Bài 4.3 tóm tắt Trả bài → Cần làm lại → Trả lại → Đạt')
  await noHorizontalOverflow(page, 'Hành trình (390px)')
  await page.screenshot({ path: `${SHOTS}/10-journey.png`, fullPage: true })
  await page.$eval('.lt-ms-btn', b => b.click())
  await page.waitForFunction(id => location.pathname === '/me/t/' + id, {}, threadId)
  ok('Bấm mốc Hành trình → mở đúng /me/t/<id>')
  await page.goto(`${ME}/u/bbbbbbbb-0000-4000-8000-00000000000b`, { waitUntil: 'networkidle0' })
  await clickText(page, 'Hành trình')
  await waitText(page, /Chưa có dấu mốc học tập\./, 15000)
  ok('C xem Hành trình của B: thread "Chỉ Thầy" KHÔNG lộ (server lọc)')
  await ctx.close()
  ;({ ctx, page } = await meAs('b@test.local'))
  await page.waitForSelector('.cs-share', { timeout: 15000 })
  await page.goto(`${ME}/u/bbbbbbbb-0000-4000-8000-00000000000b`, { waitUntil: 'networkidle0' })
  await clickText(page, 'Hành trình')
  await waitText(page, /Tự học · DH2/, 15000)
  await waitText(page, /Chỉ Thầy/)
  ok('B tự xem Hành trình: chặng "Tự học · DH2" có mốc "Chỉ Thầy" của mình')
  await page.screenshot({ path: `${SHOTS}/11-journey-self.png`, fullPage: true })
  await ctx.close()

  // ── Social UX + Lớp học V1 ─────────────────────────────────────────────
  ;({ ctx, page } = await meAs('c@test.local'))
  await page.waitForSelector('.cs-share', { timeout: 15000 })
  const navText = await page.$eval('.cs-sidebar', e => e.textContent)
  assert.ok(navText.indexOf('Trang chủ') < navText.indexOf('Bạn bè') && navText.indexOf('Bạn bè') < navText.indexOf('Lớp học')
            && navText.indexOf('Lớp học') < navText.indexOf('App học'), 'sidebar: CỘNG ĐỒNG → LỚP HỌC → HỌC TẬP')
  assert.match(navText, /Bạn chưa ở trong lớp nào\./); assert.match(navText, /Khám phá/)
  ok('Sidebar: Trang chủ đầu tiên · LỚP HỌC ngay sau CỘNG ĐỒNG · C chưa có lớp → mục Khám phá')
  await page.click('.cs-menu-btn')
  await page.waitForSelector('.cs-sheet')
  await clickText(page, 'Đệm hát căn bản')
  await page.waitForFunction(() => location.pathname.startsWith('/me/classes/'))
  await waitText(page, /Bạn đang xem lớp này — bạn chưa tham gia\./, 15000)
  await page.waitForSelector('.lt-feed-card')
  assert.match(await page.$eval('.lt-feed-card', e => e.textContent), /An/)
  assert.equal(await page.$('.lt-feed-card .lt-feed-identity'), null, 'trong trang lớp không lặp nhãn lớp trên thẻ')
  assert.match(await page.$eval('.cs-class-name', e => e.textContent), /Đệm hát căn bản — KD18/, 'trang lớp giữ TÊN ĐẦY ĐỦ')
  await clickText(page, 'Thành viên')
  await waitText(page, /Danh sách thành viên chỉ hiện với thành viên của lớp\./)
  ok('C (ngoài lớp) xem lớp KD18: nhãn "đang xem lớp… chưa tham gia" · thấy câu chuyện học tập community · danh sách thành viên bị server chặn')
  await noHorizontalOverflow(page, 'Trang lớp (390px)')
  await page.screenshot({ path: `${SHOTS}/12-class-outsider.png`, fullPage: true })
  const classUrl = await page.evaluate(() => location.pathname)
  // "Quay lại" như mạng xã hội: lớp → hoạt động → trang cá nhân → Quay lại = về đúng trang lớp (không nhảy về Bạn bè/Trang chủ)
  await clickText(page, 'Hoạt động')
  await page.waitForSelector('.lt-feed-card .cs-post-author')
  await page.$eval('.lt-feed-card .cs-post-author', b => b.click())
  await page.waitForFunction(() => location.pathname.startsWith('/me/u/'))
  await clickText(page, 'Quay lại')
  await page.waitForFunction(u => location.pathname === u, { timeout: 10000 }, classUrl)
  await page.waitForSelector('.cs-class-name')
  ok('Trang cá nhân mở từ trang lớp → "Quay lại" về đúng trang lớp')
  await ctx.close()

  ;({ ctx, page } = await meAs('a@test.local'))
  await page.waitForSelector('.cs-share', { timeout: 15000 })
  const side = await page.$eval('.cs-sidebar', e => e.textContent)
  assert.match(side, /Đệm hát căn bản/); assert.equal(/DH2\.KD18/.test(side), false, 'menu không hiện mã lớp')
  await page.click('.cs-share-input')
  await clickText(page, '🎸 Đang tập')
  await page.type('.cs-share-input', 'Bolero móc kiểu 1 tối nay')
  await clickText(page, 'Đăng')
  await waitText(page, /🎸 Đang tập: Bolero móc kiểu 1 tối nay/, 15000)
  ok('A chia sẻ "🎸 Đang tập…" từ Home → bài hiện ngay trong Feed của mình (bài status có sẵn, không hệ mới)')
  await page.screenshot({ path: `${SHOTS}/13-home.png`, fullPage: true })
  await page.goto(`http://class.localhost:${V}${classUrl}`, { waitUntil: 'networkidle0' })
  await waitText(page, /Bạn là thành viên lớp này/, 15000)
  await clickText(page, 'Thành viên')
  await page.waitForSelector('.cs-member')
  const members = await page.$$eval('.cs-member-name', els => els.map(e => e.textContent))
  assert.ok(members.includes('An'))
  ok('A (thành viên) mở lớp KD18 từ sidebar: "Bạn là thành viên" · tab Thành viên có danh sách')
  await page.click('.cs-menu-btn')
  await page.waitForSelector('.cs-sheet')
  await clickText(page, 'Trang chủ')
  await page.waitForFunction(() => location.pathname === '/me')
  ok('Mục "Trang chủ" trong menu đưa về /me')
  await page.goto(`http://class.localhost:${V}/me/classes`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-class-tile.is-mine', { timeout: 15000 })
  assert.match(await page.$eval('.cs-classes-mine', e => e.textContent), /Bạn đang tham gia/)
  const activeAll = await page.$$eval('.cs-sidebar [aria-current="page"]', els => els.map(e => e.textContent.trim()))
  assert.deepEqual(activeAll, ['Tất cả lớp'], 'đúng MỘT mục sáng: Tất cả lớp')
  await noHorizontalOverflow(page, '/me/classes (390px)')
  await page.screenshot({ path: `${SHOTS}/15-classes.png`, fullPage: true })
  ok('/me/classes: "Lớp của tôi" nổi bật (Bạn đang tham gia) · Khám phá tách riêng · chỉ "Tất cả lớp" sáng')
  await ctx.close()

  ;({ ctx, page } = await meAs('c@test.local'))
  await page.waitForSelector('.cs-share', { timeout: 15000 })
  assert.equal(/Bolero móc kiểu 1 tối nay/.test(await text(page)), false, 'C (chưa là bạn) không thấy bài tường của A')
  await page.click('.cs-menu-btn')
  await page.waitForSelector('.cs-sheet')
  const sheet = await page.$eval('.cs-sheet', e => e.textContent)
  assert.ok(sheet.indexOf('Trang chủ') >= 0 && sheet.indexOf('Trang chủ') < sheet.indexOf('Lớp học'))
  ok('Mobile ☰: Trang chủ đầu tiên, có nhóm Lớp học · C (không phải bạn) không thấy bài tường của A')
  await noHorizontalOverflow(page, 'Home /me (390px)')
  await page.screenshot({ path: `${SHOTS}/14-mobile-menu.png` })
  await ctx.close()

  // ── UX polish 2: composer, Quay lại, mục menu sáng, không lộ enum thô ────────────────────────
  const RAW = /\b(waiting_teacher|teacher_responded|needs_retry|passed|archived|community|private|ending_soon|ready_to_open|scheduled|upcoming|recruiting|active)\b/
  const noRaw = async (pg, label) => { const t = await text(pg); const m = RAW.exec(t); assert.equal(m, null, `${label}: lộ giá trị kỹ thuật "${m?.[0]}"`) }
  const loginAt = async (email, width, path = '') => {
    const { ctx: c, page: pg } = await ctxPage(width)
    await pg.goto(ME + path, { waitUntil: 'networkidle0' })
    await pg.waitForSelector('#cs-login-email', { timeout: 15000 })
    await pg.type('#cs-login-email', email); await pg.type('#cs-login-pass', 'e2e'); await pg.click('.cs-guest-submit')
    return { c, pg }
  }
  const pathNow = pg => pg.evaluate(() => location.pathname)
  const pressedTab = pg => pg.evaluate(() => document.querySelector('.lt-profile-tabs [aria-pressed="true"]')?.textContent ?? null)
  for (const w of [320, 360, 390]) {
    const { c, pg } = await loginAt('c@test.local', w)
    await pg.waitForSelector('.cs-share-chip', { timeout: 15000 })
    const chips = await pg.$$eval('.cs-share-chip', els => els.map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), inside: r.left >= 0 && r.right <= innerWidth && r.width > 0 } }))
    assert.deepEqual(chips.map(x => x.t.replace(/^\S+\s/, '')), ['Đang tập', 'Vừa đàn', 'Nhờ góp ý', 'Chia sẻ'])
    assert.ok(chips.every(x => x.inside), `${w}px: một gợi ý chia sẻ bị cắt ${JSON.stringify(chips)}`)
    await noHorizontalOverflow(pg, `Home ${w}px`)
    await c.close()
  }
  ok('Composer 320/360/390px: đủ 4 gợi ý "Đang tập · Vừa đàn · Nhờ góp ý · Chia sẻ", không cái nào bị cắt')

  {
    const { c, pg } = await loginAt('c@test.local', 390)
    await pg.waitForSelector('.lt-feed-card .cs-post-author', { timeout: 15000 })
    await noRaw(pg, 'Home')
    // Home → trang cá nhân → Quay lại = Home
    await pg.$eval('.lt-feed-card .cs-post-author', b => b.click())
    await pg.waitForFunction(() => location.pathname.startsWith('/me/u/'))
    const profilePath = await pathNow(pg)
    await clickText(pg, 'Quay lại'); await pg.waitForFunction(() => location.pathname === '/me')
    // Home → Hành trình → mốc → cuộc trao đổi → Quay lại = đúng trang cá nhân, VẪN ở tab Hành trình
    await pg.waitForSelector('.lt-feed-card .cs-post-author', { timeout: 15000 })
    await pg.$eval('.lt-feed-card .cs-post-author', b => b.click())
    await pg.waitForFunction(p => location.pathname === p, {}, profilePath)
    await clickText(pg, 'Hành trình'); await pg.waitForSelector('.lt-ms-btn', { timeout: 15000 })
    await noRaw(pg, 'Hành trình')
    await pg.$eval('.lt-ms-btn', b => b.click())
    await pg.waitForSelector('.lt-head', { timeout: 15000 })
    await noRaw(pg, 'Cuộc trao đổi')
    await clickText(pg, 'Quay lại')
    await pg.waitForFunction(p => location.pathname === p, {}, profilePath)
    await pg.waitForSelector('.lt-ms-btn', { timeout: 15000 })
    assert.equal(await pressedTab(pg), 'Hành trình', 'Quay lại từ cuộc trao đổi giữ tab Hành trình')
    // ☰ → lớp (menu đóng) → Hoạt động → cuộc trao đổi → Quay lại = lớp
    await pg.goto(ME, { waitUntil: 'networkidle0' })
    await pg.click('.cs-menu-btn'); await pg.waitForSelector('.cs-sheet')
    await clickText(pg, 'Đệm hát căn bản')
    await pg.waitForFunction(() => location.pathname.startsWith('/me/classes/'))
    assert.equal(await pg.$('.cs-sheet'), null, 'bấm lớp trong ☰ → menu đóng')
    const cls = await pathNow(pg)
    await pg.waitForSelector('.lt-feed-open', { timeout: 15000 })
    await noRaw(pg, 'Trang lớp')
    await pg.$eval('.lt-feed-open', b => b.click())
    await pg.waitForSelector('.lt-head', { timeout: 15000 })
    await clickText(pg, 'Quay lại'); await pg.waitForFunction(p => location.pathname === p, {}, cls)
    await clickText(pg, 'Lớp học'); await pg.waitForFunction(() => location.pathname === '/me/classes')
    await noRaw(pg, '/me/classes')
    await c.close()
    ok('Quay lại: Home→Profile→Home · Hành trình→cuộc trao đổi→Hành trình (giữ tab) · ☰→lớp (menu đóng)→cuộc trao đổi→lớp→Tất cả lớp; không lộ enum')
  }
  {
    // Link thẳng tới cuộc trao đổi (qua đăng nhập) → Quay lại = Trang chủ
    const { c, pg } = await loginAt('t@test.local', 390, '/t/' + threadId)
    await pg.waitForSelector('.lt-head', { timeout: 15000 })
    await clickText(pg, 'Quay lại'); await pg.waitForFunction(() => location.pathname === '/me')
    await c.close()
    // Desktop: đúng MỘT mục menu sáng ở từng màn
    const { c: c2, pg: p2 } = await loginAt('a@test.local', 1280)
    await p2.waitForSelector('.cs-share', { timeout: 15000 })
    const active = () => p2.$$eval('.cs-sidebar .cs-nav-item.is-active', els => els.map(e => e.textContent.trim()))
    assert.deepEqual(await active(), ['Trang chủ'])
    await p2.goto(ME + '/friends', { waitUntil: 'networkidle0' }); await p2.waitForSelector('.cs-page-title')
    assert.deepEqual(await active(), ['Bạn bè'])
    await p2.goto(ME + '/classes', { waitUntil: 'networkidle0' }); await p2.waitForSelector('.cs-class-tile')
    assert.deepEqual(await active(), ['Tất cả lớp'])
    await p2.$eval('.cs-class-tile', b => b.click()); await p2.waitForSelector('.cs-class-name')
    assert.deepEqual(await active(), ['Đệm hát căn bản'])
    await c2.close()
    ok('Link thẳng cuộc trao đổi → Quay lại về Trang chủ · desktop: đúng một mục menu sáng (Trang chủ / Bạn bè / Tất cả lớp / lớp)')
  }

  const real = errors.filter(e => !/401|Failed to load resource/.test(e))
  assert.deepEqual(real, [], 'không có lỗi JS trên trang')
  ok('Không có lỗi JavaScript trong suốt kịch bản')
  console.log(`E2E LEARNING THREAD: ${pass} PASS · ảnh: ${SHOTS}`)
} catch (e) {
  console.error('E2E FAIL:', e.message)
  console.error('Lỗi trang:', errors.slice(0, 10))
  const pages = await browser.pages()
  for (const [i, pg] of pages.entries()) {
    try {
      await pg.screenshot({ path: `${SHOTS}/fail-${i}.png`, fullPage: true })
      console.error(`— trang ${i} ${pg.url()}:\n` + (await pg.evaluate(() => document.body.innerText)).slice(0, 600))
    } catch { /* trang đã đóng */ }
  }
  process.exitCode = 1
} finally {
  await browser.close()
}
