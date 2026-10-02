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
  // Home của Thầy có thể có nhiều lối vào cùng kiểu (vd "Đơn ứng tuyển Band") → bấm đúng hàng đợi Trả/Hỏi bài
  await (await page.waitForFunction(() => [...document.querySelectorAll('.cs-queue-entry')].find(b => /đang chờ phản hồi/.test(b.textContent)), { timeout: 15000 })).asElement().click()
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
  await page.waitForFunction(() => /Bạn chưa ở trong lớp nào\./.test(document.querySelector('.cs-sidebar')?.textContent ?? ''), { timeout: 15000 })   // danh sách lớp tải xong
  const navText = await page.$eval('.cs-sidebar', e => e.textContent)
  assert.ok(navText.indexOf('Trang chủ') < navText.indexOf('Bạn bè') && navText.indexOf('Bạn bè') < navText.indexOf('Lớp học')
            && navText.indexOf('Lớp học') < navText.indexOf('App học'), 'sidebar: CỘNG ĐỒNG → LỚP HỌC → HỌC TẬP')
  assert.match(navText, /Bạn chưa ở trong lớp nào\./); assert.match(navText, /Khám phá lớp khác/)
  assert.equal(/Đệm hát căn bản/.test(navText), false, 'sidebar không trộn lớp chưa tham gia')
  ok('Sidebar: Trang chủ đầu tiên · LỚP HỌC ngay sau CỘNG ĐỒNG · C chưa có lớp → chỉ một lối "Khám phá lớp khác"')
  await page.click('.cs-menu-btn')
  await page.waitForSelector('.cs-sheet')
  await clickText(page, 'Khám phá lớp khác')
  await page.waitForFunction(() => location.pathname === '/me/classes')
  await page.waitForSelector('.cs-class-tile', { timeout: 15000 })
  await page.evaluate(() => [...document.querySelectorAll('.cs-class-tile')].find(t => /Đệm hát căn bản/.test(t.textContent)).click())
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
  await page.waitForFunction(() => /Đệm hát căn bản/.test(document.querySelector('.cs-sidebar')?.textContent ?? ''), { timeout: 15000 })   // danh sách lớp tải xong
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
  await waitText(page, /Khám phá các lớp khác/, 15000)
  await page.waitForFunction(() => !document.querySelector('.cs-loading'), { timeout: 15000 })
  assert.equal(await page.$$eval('.cs-class-tile.is-mine', e => e.length), 0, 'Khám phá không có lớp của mình')
  assert.equal(/Đệm hát căn bản — KD18/.test(await page.$eval('.cs-classes-discover', e => e.textContent)), false)
  const activeAll = await page.$$eval('.cs-sidebar [aria-current="page"]', els => els.map(e => e.textContent.trim()))
  assert.deepEqual(activeAll, ['Khám phá lớp khác'], 'đúng MỘT mục sáng: Khám phá lớp khác')
  await noHorizontalOverflow(page, '/me/classes (390px)')
  await page.screenshot({ path: `${SHOTS}/15-classes.png`, fullPage: true })
  await clickText(page, 'Lớp của tôi', 'button.cs-profile-back')
  await page.waitForFunction(() => location.pathname === '/me' && location.search === '?feed=classes')
  ok('/me/classes = Khám phá các lớp khác (không có lớp của mình) · chỉ "Khám phá lớp khác" sáng · ← Lớp của tôi về /me?feed=classes')
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
    await clickText(pg, 'Khám phá lớp khác')
    await pg.waitForFunction(() => location.pathname === '/me/classes')
    assert.equal(await pg.$('.cs-sheet'), null, 'bấm mục lớp trong ☰ → menu đóng')
    await pg.waitForSelector('.cs-class-tile', { timeout: 15000 })
    await pg.evaluate(() => [...document.querySelectorAll('.cs-class-tile')].find(t => /Đệm hát căn bản/.test(t.textContent)).click())
    await pg.waitForFunction(() => location.pathname.startsWith('/me/classes/'))
    const cls = await pathNow(pg)
    await pg.waitForSelector('.lt-feed-open', { timeout: 15000 })
    await noRaw(pg, 'Trang lớp')
    await pg.$eval('.lt-feed-open', b => b.click())
    await pg.waitForSelector('.lt-head', { timeout: 15000 })
    await clickText(pg, 'Quay lại'); await pg.waitForFunction(p => location.pathname === p, {}, cls)
    await clickText(pg, 'Lớp của tôi', 'button.cs-profile-back'); await pg.waitForFunction(() => location.pathname === '/me' && location.search === '?feed=classes')
    await waitText(pg, /Bạn chưa ở trong lớp nào/, 15000)   // C chưa thuộc lớp nào: bảng trống + lối Khám phá
    await noRaw(pg, 'Lớp của tôi')
    await c.close()
    ok('Quay lại: Home→Profile→Home · Hành trình→cuộc trao đổi→Hành trình (giữ tab) · ☰→Khám phá lớp khác (menu đóng)→lớp→cuộc trao đổi→lớp→Lớp của tôi; không lộ enum')
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
    await p2.goto(ME + '/classes', { waitUntil: 'networkidle0' }); await waitText(p2, /Khám phá các lớp khác/, 15000)
    assert.deepEqual(await active(), ['Khám phá lớp khác'])
    await p2.evaluate(() => [...document.querySelectorAll('.cs-sidebar .cs-class-item')].find(b => /Đệm hát căn bản/.test(b.textContent)).click())
    await p2.waitForSelector('.cs-class-name')
    assert.deepEqual(await active(), ['Đệm hát căn bản'])
    await c2.close()
    ok('Link thẳng cuộc trao đổi → Quay lại về Trang chủ · desktop: đúng một mục menu sáng (Trang chủ / Bạn bè / Khám phá lớp khác / lớp)')
  }

  // ── FEED V1: Dành cho bạn | Lớp của tôi | Bạn bè ───────────────────────────────────────────
  {
    const pressedFeed = pg => pg.evaluate(() => document.querySelector('.cs-feed-tabs [aria-pressed="true"]')?.textContent ?? null)
    const cards = pg => pg.$$eval('.cs-feed .lt-feed-card, .cs-feed .cs-post', els => els.map(e => e.textContent))
    const settleFeed = pg => pg.waitForFunction(() => !document.querySelector('.cs-feed[aria-busy="true"]'), { timeout: 15000 })
    // A (thành viên KD18): Lớp của tôi có câu chuyện của chính A trong lớp; URL ?feed=classes
    const { c: ca, pg: a } = await loginAt('a@test.local', 390)
    await a.waitForSelector('.cs-feed-tabs', { timeout: 15000 })
    assert.equal(await pressedFeed(a), 'Dành cho bạn', 'mặc định Dành cho bạn')
    assert.deepEqual(await a.$$eval('.cs-feed-tabs button', b => b.map(x => x.textContent)), ['Dành cho bạn', 'Lớp của tôi', 'Bạn bè'])
    await clickText(a, 'Lớp của tôi'); await settleFeed(a)
    assert.equal(await a.evaluate(() => location.pathname + location.search), '/me?feed=classes')
    // UX V2: Lớp của tôi = BẢNG các lớp đang tham gia (mỗi lớp: Vào lớp + Hoạt động mới từ social_class_activity)
    await a.waitForSelector('.cs-myclass', { timeout: 15000 })
    await a.waitForFunction(() => /Bài 4\.3 — Bolero móc kiểu 1/.test(document.querySelector('.cs-myclass')?.textContent ?? ''), { timeout: 15000 })
    const board = await a.$eval('.cs-myclasses', e => e.textContent)
    assert.match(board, /Đệm hát căn bản — KD18/); assert.match(board, /Vào lớp/); assert.match(board, /Khám phá các lớp khác/)
    assert.equal(/Đang tập: Bolero móc kiểu 1 tối nay/.test(board), false, 'Lớp của tôi KHÔNG có bài tường (không có ngữ cảnh lớp)')
    await noRaw(a, 'Lớp của tôi')
    await noHorizontalOverflow(a, 'Lớp của tôi (390px)')
    // Reload giữ góc nhìn theo URL; Quay lại từ cuộc trao đổi về đúng góc nhìn
    await a.reload({ waitUntil: 'networkidle0' }); await a.waitForSelector('.cs-feed-tabs')
    assert.equal(await pressedFeed(a), 'Lớp của tôi', 'reload /me?feed=classes giữ góc nhìn')
    await a.waitForSelector('.cs-act-line', { timeout: 15000 }); await a.$eval('.cs-act-line', b => b.click())
    await a.waitForSelector('.lt-head', { timeout: 15000 })
    await clickText(a, 'Quay lại'); await a.waitForFunction(() => location.pathname === '/me' && location.search === '?feed=classes')
    await a.waitForSelector('.cs-feed-tabs'); assert.equal(await pressedFeed(a), 'Lớp của tôi', 'Quay lại về đúng góc nhìn')
    // A chưa có bạn → Bạn bè trống, có lối sang trang Bạn bè
    await clickText(a, 'Bạn bè'); await settleFeed(a)
    await waitText(a, /Chưa có hoạt động mới từ bạn bè\./)
    await noHorizontalOverflow(a, 'Feed Bạn bè (390px)')
    await a.screenshot({ path: `${SHOTS}/16-feed-friends-empty.png` })
    ok('Feed V1 (A): 3 tab, mặc định Dành cho bạn; Lớp của tôi = bảng lớp + hoạt động lớp (không bài tường); ?feed= giữ qua reload + Quay lại; Bạn bè trống có lối đi')

    // C (không thuộc lớp nào): Lớp của tôi trống → "Khám phá các lớp khác"
    const { c: cc, pg: c } = await loginAt('c@test.local', 320)
    await c.waitForSelector('.cs-feed-tabs', { timeout: 15000 })
    const tabBoxes = await c.$$eval('.cs-feed-tabs button', els => els.map(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth }))
    assert.ok(tabBoxes.every(Boolean), '320px: cả 3 tab nằm trọn trong màn hình')
    await noHorizontalOverflow(c, 'Feed tabs (320px)')
    await clickText(c, 'Lớp của tôi'); await settleFeed(c)
    await waitText(c, /Bạn chưa ở trong lớp nào/)
    await noHorizontalOverflow(c, 'Lớp của tôi trống (320px)')
    await clickText(c, 'Khám phá các lớp khác'); await c.waitForFunction(() => location.pathname === '/me/classes')
    ok('Feed V1 (C, 320px): 3 tab vừa màn hình; Lớp của tôi trống → "Khám phá các lớp khác" → /me/classes')

    // C ↔ A thành bạn (flow Bạn bè thật) → tab Bạn bè của C có hoạt động của A; B (không phải bạn) không có
    await c.goto(ME + '/u/aaaaaaaa-0000-4000-8000-00000000000a', { waitUntil: 'networkidle0' })
    await clickText(c, 'Kết bạn'); await waitText(c, /Đã gửi lời mời/)
    await a.goto(ME + '/friends', { waitUntil: 'networkidle0' })
    await clickText(a, 'Chấp nhận'); await waitText(a, /Tất cả bạn bè/)
    await c.goto(ME + '?feed=friends', { waitUntil: 'networkidle0' }); await c.waitForSelector('.cs-feed-tabs'); await settleFeed(c)
    assert.equal(await pressedFeed(c), 'Bạn bè')
    await c.waitForSelector('.cs-feed .cs-post-author', { timeout: 15000 })
    const fc = await cards(c)
    assert.ok(fc.length > 0 && fc.every(t => /An/.test(t)), 'Bạn bè của C: chỉ hoạt động của A')
    assert.ok(fc.some(t => /Đang tập: Bolero móc kiểu 1 tối nay/.test(t)), 'bài chỉ-bạn-bè của A hiện với C khi đã là bạn')
    assert.ok(fc.every(t => !/Bình/.test(t)), 'không có B (không phải bạn; thread "Chỉ Thầy")')
    await noRaw(c, 'Feed Bạn bè')
    ok('Feed V1: C–A thành bạn → tab Bạn bè của C có bài + câu chuyện của A; không có người không phải bạn / thread "Chỉ Thầy"')
    // Huỷ kết bạn → biến mất khỏi tab Bạn bè
    await c.goto(ME + '/u/aaaaaaaa-0000-4000-8000-00000000000a', { waitUntil: 'networkidle0' })
    await clickText(c, 'Huỷ kết bạn'); await waitText(c, /Kết bạn/)
    await c.goto(ME + '?feed=friends', { waitUntil: 'networkidle0' }); await c.waitForSelector('.cs-feed-tabs'); await settleFeed(c)
    await waitText(c, /Chưa có hoạt động mới từ bạn bè\./)
    ok('Feed V1: huỷ kết bạn → tab Bạn bè không còn hoạt động của người đó')
    await ca.close(); await cc.close()

    // Trang chủ / logo = Home MẶC ĐỊNH (/me · Dành cho bạn · đầu trang) từ mọi màn; deep link ?feed= vẫn giữ khi chủ động mở
    const where = pg => pg.evaluate(() => ({ url: location.pathname + location.search, y: Math.round(scrollY),
      tab: document.querySelector('.cs-feed-tabs [aria-pressed="true"]')?.textContent ?? null }))
    const homeDefault = async (pg, label) => {
      await pg.waitForFunction(() => location.pathname === '/me' && !location.search, { timeout: 10000 })
      await pg.waitForSelector('.cs-feed-tabs')
      const w = await where(pg)
      assert.deepEqual(w, { url: '/me', y: 0, tab: 'Dành cho bạn' }, `${label}: ${JSON.stringify(w)}`)
    }
    const longPage = pg => pg.evaluate(() => { document.body.style.minHeight = '3000px'; scrollTo(0, 600) })
    // Mobile 390: /me?feed=classes (deep link giữ) → ☰ Trang chủ → mặc định; Back → Lớp của tôi; Forward → mặc định
    const { c: cm, pg: m } = await loginAt('a@test.local', 390, '?feed=classes')
    await m.waitForSelector('.cs-feed-tabs', { timeout: 15000 })
    assert.equal((await where(m)).tab, 'Lớp của tôi', 'deep link /me?feed=classes mở đúng tab')
    await longPage(m)
    await m.click('.cs-menu-btn'); await m.waitForSelector('.cs-sheet'); await clickText(m, 'Trang chủ')
    await homeDefault(m, '☰ Trang chủ từ Lớp của tôi')
    assert.equal(await m.$('.cs-sheet'), null, 'menu đóng sau khi bấm')
    await m.goBack(); await m.waitForFunction(() => location.search === '?feed=classes')
    await m.waitForFunction(() => document.querySelector('.cs-feed-tabs [aria-pressed="true"]')?.textContent === 'Lớp của tôi')
    await m.goForward(); await homeDefault(m, 'Forward')
    // Logo từ tab Bạn bè
    await clickText(m, 'Bạn bè'); await m.waitForFunction(() => location.search === '?feed=friends')
    await longPage(m); await m.click('.cs-brand'); await homeDefault(m, 'Logo từ Bạn bè (390)')
    await noHorizontalOverflow(m, 'Home sau Trang chủ (390px)')
    await cm.close()
    // Desktop 1280: sidebar Trang chủ + logo từ route con (lớp, cuộc trao đổi, trang cá nhân) và từ /me?feed=friends
    const { c: cd, pg: d } = await loginAt('a@test.local', 1280, '?feed=friends')
    await d.waitForSelector('.cs-feed-tabs', { timeout: 15000 })
    const sidebarHome = () => d.evaluate(() => [...document.querySelectorAll('.cs-sidebar .cs-nav-item')].find(b => b.textContent.trim() === 'Trang chủ').click())
    await longPage(d); await sidebarHome(); await homeDefault(d, 'Sidebar Trang chủ từ Bạn bè (1280)')
    await d.waitForSelector('.cs-sidebar .cs-class-item', { timeout: 15000 }); await d.$eval('.cs-sidebar .cs-class-item', b => b.click()); await d.waitForSelector('.cs-class-name')
    await longPage(d); await sidebarHome(); await homeDefault(d, 'Sidebar Trang chủ từ trang lớp')
    await clickText(d, 'Lớp của tôi'); await d.waitForSelector('.cs-act-line', { timeout: 15000 }); await d.$eval('.cs-act-line', b => b.click())
    await d.waitForSelector('.lt-head', { timeout: 15000 }); await d.click('.cs-brand'); await homeDefault(d, 'Logo từ cuộc trao đổi')
    await d.goBack(); await d.waitForFunction(() => location.pathname.startsWith('/me/t/'))
    await d.goBack(); await d.waitForFunction(() => location.search === '?feed=classes')
    await d.waitForFunction(() => document.querySelector('.cs-feed-tabs [aria-pressed="true"]')?.textContent === 'Lớp của tôi')
    await d.goto(ME + '/u/aaaaaaaa-0000-4000-8000-00000000000a', { waitUntil: 'networkidle0' }); await d.waitForSelector('.lt-profile-tabs')
    await longPage(d); await d.click('.cs-brand'); await homeDefault(d, 'Logo từ trang cá nhân')
    assert.deepEqual(await d.$$eval('.cs-sidebar .cs-nav-item.is-active', e => e.map(x => x.textContent.trim())), ['Trang chủ'])
    await cd.close()
    ok('Trang chủ/logo (☰, sidebar, logo; từ Lớp của tôi, Bạn bè, lớp, cuộc trao đổi, trang cá nhân) → /me · Dành cho bạn · đầu trang; Back/Forward đúng tab; deep link ?feed= vẫn giữ')
  }

  // ── CHỈNH SỬA TRANG CÁ NHÂN V1: tên hiển thị + ảnh đại diện (cùng edu_students với App học) ───────────
  {
    const A_ID = 'aaaaaaaa-0000-4000-8000-00000000000a'
    const { c: ce, pg: e } = await loginAt('a@test.local', 390)
    await e.waitForSelector('.cs-share', { timeout: 15000 })   // khách vào /me/u/… được đưa về /me — đăng nhập xong mới mở trang cá nhân
    await e.goto(ME + '/u/' + A_ID, { waitUntil: 'networkidle0' })
    await e.waitForSelector('.cs-identity-name', { timeout: 15000 })
    const oldName = await e.$eval('.cs-identity-name', x => x.textContent)
    await clickText(e, 'Chỉnh sửa trang cá nhân')
    await e.waitForSelector('.cs-profile-edit')
    await noHorizontalOverflow(e, 'Chỉnh sửa trang cá nhân (390px)')
    // Tên rỗng → không lưu được
    const nameInput = await e.$('.cs-profile-edit input[type="text"]')
    await nameInput.click({ clickCount: 3 }); await e.keyboard.press('Backspace')
    assert.equal(await e.$eval('.cs-profile-edit button[type="submit"]', b => b.disabled), true, 'tên rỗng → Lưu bị khoá')
    // Tệp không phải ảnh → báo rõ, GIỮ tên đang nhập
    await nameInput.type('  Ánh   Dương  Lê  ')
    const dir = SHOTS + '/files'; mkdirSync(dir, { recursive: true })
    const { writeFileSync } = await import('node:fs')
    writeFileSync(dir + '/not-image.jpg', 'day khong phai anh')
    await (await e.$('.cs-profile-edit input[type="file"]')).uploadFile(dir + '/not-image.jpg')
    await e.waitForSelector('.cs-profile-edit .cs-form-error')
    assert.match(await e.$eval('.cs-profile-edit .cs-form-error', x => x.textContent), /ảnh/i)
    assert.equal(await e.$eval('.cs-profile-edit input[type="text"]', x => x.value), '  Ánh   Dương  Lê  ', 'lỗi ảnh không làm mất tên đang nhập')
    // Ảnh thật (PNG vẽ bằng canvas) → xem trước → Lưu
    const png = await e.evaluate(() => { const cv = document.createElement('canvas'); cv.width = cv.height = 96; const g = cv.getContext('2d'); g.fillStyle = '#6d28d9'; g.fillRect(0, 0, 96, 96); g.fillStyle = '#fbbf24'; g.fillRect(24, 24, 48, 48); return cv.toDataURL('image/png').split(',')[1] })
    writeFileSync(dir + '/avatar.png', Buffer.from(png, 'base64'))
    await (await e.$('.cs-profile-edit input[type="file"]')).uploadFile(dir + '/avatar.png')
    await e.waitForSelector('.cs-profile-edit img.cs-preview-avatar', { timeout: 10000 })
    await e.screenshot({ path: `${SHOTS}/17-profile-edit.png` })
    await clickText(e, 'Lưu thay đổi')
    await e.waitForFunction(() => !document.querySelector('.cs-profile-edit'), { timeout: 15000 })
    // Cập nhật NGAY (không đăng nhập lại): tên trang cá nhân, avatar trên top bar
    assert.equal(await e.$eval('.cs-identity-name', x => x.textContent), 'Ánh Dương Lê', 'tên gọn khoảng trắng, giữ nguyên hoa/thường + dấu')
    // Top bar đổi ngay (không đăng nhập lại). Ảnh: stack local phục vụ qua http:// mà safeImageUrl CHỈ nhận https
    // (production luôn https) → ở đây kiểm chữ cái đầu theo tên mới; việc lưu ảnh vào storage + edu_students.avatar_url
    // được script e2e-learning-thread.sh kiểm trên DB (A_profile … avatar storage).
    assert.equal(await e.$eval('.cs-account .cs-avatar', x => x.textContent), 'Á', 'avatar top bar theo tên mới')
    // Home: ô chia sẻ + Feed dùng danh tính mới (đọc hiện tại, không snapshot)
    await e.click('.cs-brand'); await e.waitForSelector('.cs-feed-tabs')
    await e.waitForFunction(() => [...document.querySelectorAll('.cs-feed .cs-post-author')].some(a => a.textContent === 'Ánh Dương Lê'), { timeout: 15000 })
    assert.ok(await e.$$eval('.cs-feed .cs-post-author', a => a.every(x => x.textContent !== 'An')), 'không còn tên cũ trên Feed')
    // Cuộc trao đổi cũ của A: cùng người, tên mới; danh tính lớp lịch sử giữ nguyên
    await clickText(e, 'Lớp của tôi'); await e.waitForSelector('.cs-act-line', { timeout: 15000 }); await e.$eval('.cs-act-line', b => b.click())
    await e.waitForSelector('.lt-head')
    assert.match(await e.$eval('.lt-head', x => x.textContent), /Ánh Dương Lê[\s\S]*DH2\.KD18 · Đệm hát 2/, 'thread: tên mới + snapshot lớp DH2.KD18 giữ nguyên')
    // Thành viên lớp
    await e.goto(ME + '?feed=classes', { waitUntil: 'networkidle0' }); await e.waitForSelector('.cs-myclass-enter', { timeout: 15000 }); await e.$eval('.cs-myclass-enter', b => b.click())
    await clickText(e, 'Thành viên'); await e.waitForSelector('.cs-member')
    assert.ok(await e.$$eval('.cs-member-name', a => a.some(x => x.textContent === 'Ánh Dương Lê')), 'danh sách thành viên lớp có tên mới')
    await ce.close()
    // Người khác: KHÔNG có nút chỉnh sửa; thấy tên mới
    const { c: co, pg: o } = await loginAt('c@test.local', 1280)
    await o.waitForSelector('.cs-share', { timeout: 15000 })
    await o.goto(ME + '/u/' + A_ID, { waitUntil: 'networkidle0' })
    await o.waitForSelector('.cs-identity-name', { timeout: 15000 })
    assert.equal(await o.$eval('.cs-identity-name', x => x.textContent), 'Ánh Dương Lê')
    assert.equal(/Chỉnh sửa trang cá nhân/.test(await text(o)), false, 'người khác không thấy "Chỉnh sửa trang cá nhân"')
    await co.close()
    // Thầy (không có hồ sơ học sinh) → không có nút (tên Thầy không nằm ở edu_students)
    const { c: ct, pg: tt } = await loginAt('t@test.local', 1280)
    await tt.waitForSelector('.cs-share', { timeout: 15000 })
    await tt.goto(ME + '/u/dddddddd-0000-4000-8000-00000000000d', { waitUntil: 'networkidle0' })
    await tt.waitForSelector('.cs-identity-name', { timeout: 15000 })
    assert.equal(/Chỉnh sửa trang cá nhân/.test(await text(tt)), false)
    await ct.close()
    ok(`Chỉnh sửa trang cá nhân: "${oldName}" → "Ánh Dương Lê" + ảnh mới; tên rỗng khoá Lưu; tệp không phải ảnh báo lỗi, giữ tên; cập nhật ngay top bar/trang cá nhân/Feed/thread (lớp lịch sử giữ)/thành viên lớp; người khác & Thầy không có nút`)
  }

  // ── DANH TÍNH HỌC TẬP V1 ───────────────────────────────────────────────────────────────────
  {
    const A_ID = 'aaaaaaaa-0000-4000-8000-00000000000a'
    const lids = (pg, sel) => pg.$$eval(sel, els => els.map(e => e.textContent.trim()))
    // C (390px) xem Feed: cạnh tên A có nhãn ĐANG HỌC, Hành trình trước; danh tính LỊCH SỬ của bài giữ nguyên
    const { c: cv, pg: v } = await loginAt('c@test.local', 390)
    await v.waitForSelector('.lt-feed-card .cs-lid', { timeout: 15000 })
    const cardBadges = await lids(v, '.lt-feed-card .cs-post-line .cs-lid')
    assert.deepEqual(cardBadges, ['◆Hành trình 2027', 'Đệm hát 2'], 'Feed: Hành trình (đặc biệt) trước, rồi Đệm hát 2 — không mã lớp: ' + JSON.stringify(cardBadges))
    assert.match(await v.$eval('.lt-feed-card', e => e.textContent), /DH2\.KD18 · Đệm hát 2/, 'thẻ vẫn có danh tính LỊCH SỬ của bài (tách khỏi nhãn người)')
    assert.equal((await lids(v, '.lt-feed-card .cs-lid')).some(t => /Tỉa nốt/.test(t)), false, 'đã tốt nghiệp không lên cạnh tên')
    await noHorizontalOverflow(v, 'Feed có nhãn danh tính (390px)')
    // Trang cá nhân A: khối Danh tính học tập đầy đủ
    await v.goto(ME + '/u/' + A_ID, { waitUntil: 'networkidle0' })
    await v.waitForSelector('.cs-lid-section', { timeout: 15000 })
    const sec = await v.$eval('.cs-lid-section', e => e.textContent)
    assert.match(sec, /Danh tính học tập[\s\S]*Đang học[\s\S]*Hành trình 2027[\s\S]*Đệm hát 2[\s\S]*Đã tốt nghiệp[\s\S]*Tỉa nốt 1/)
    assert.equal(/HT2027\.TH01|DH2\.KD18|TN1\.GL10/.test(sec), false, 'không mã lớp trong nội dung nhãn')
    await noHorizontalOverflow(v, 'Trang cá nhân + Danh tính học tập (390px)')
    await v.screenshot({ path: `${SHOTS}/18-learning-identity-profile.png`, fullPage: true })
    await cv.close()
    // A (1280) — trang lớp KD18 · Thành viên: không lặp "Đệm hát 2" (ngữ cảnh lớp), vẫn hiện chương trình KHÁC
    const { c: ca, pg: a } = await loginAt('a@test.local', 1280)
    await a.waitForSelector('.cs-share', { timeout: 15000 })
    await a.goto(ME + '?feed=classes', { waitUntil: 'networkidle0' }); await a.waitForSelector('.cs-myclass', { timeout: 15000 })
    await a.evaluate(() => [...document.querySelectorAll('.cs-myclass')].find(t => /KD18/.test(t.textContent)).querySelector('.cs-myclass-enter').click())
    await clickText(a, 'Thành viên'); await a.waitForSelector('.cs-member')
    await a.waitForSelector('.cs-member .cs-lid', { timeout: 15000 })
    const memberBadges = await lids(a, '.cs-member .cs-lid')
    assert.ok(memberBadges.includes('◆Hành trình 2027') && !memberBadges.includes('Đệm hát 2'), 'thành viên lớp DH2: bỏ nhãn trùng ngữ cảnh: ' + JSON.stringify(memberBadges))
    // Cuộc trao đổi: nhãn hiện tại cạnh tên người học + danh tính lịch sử riêng
    await a.goto(ME + '?feed=classes', { waitUntil: 'networkidle0' }); await a.waitForSelector('.cs-act-line', { timeout: 15000 })
    await a.$eval('.cs-act-line', b => b.click()); await a.waitForSelector('.lt-head .cs-lid', { timeout: 15000 })
    assert.match(await a.$eval('.lt-head', e => e.textContent), /Hành trình 2027[\s\S]*DH2\.KD18 · Đệm hát 2/)
    // Thầy: không nhãn học sinh (chỉ "Giáo viên"); không nhãn trên top bar
    assert.equal(await a.$('.cs-topbar .cs-lid'), null, 'không nhãn trên top bar')
    await ca.close()
    const { c: ct, pg: tt } = await loginAt('t@test.local', 1280)
    await tt.waitForSelector('.cs-share', { timeout: 15000 })
    await tt.goto(ME + '/u/dddddddd-0000-4000-8000-00000000000d', { waitUntil: 'networkidle0' }); await tt.waitForSelector('.cs-identity-name')
    await new Promise(r => setTimeout(r, 800))
    assert.equal(await tt.$('.cs-lid-section'), null, 'Thầy không có khối danh tính học sinh')
    await ct.close()
    ok('Danh tính học tập: Feed cạnh tên (◆ Hành trình 2027 · Đệm hát 2, không mã lớp, không nhãn đã tốt nghiệp) · thẻ giữ danh tính lịch sử · trang cá nhân Đang học / Đã tốt nghiệp · thành viên lớp bỏ nhãn trùng ngữ cảnh · cuộc trao đổi · Thầy không nhãn; 390 không tràn ngang')
  }

  // ── Tool Share V1: Metronome → phiên thật → Chia sẻ thành tích → Feed → "Thử ở 80 BPM" → Metronome đúng BPM ──
  {
    const loginAt = async (email, width) => {
      const { ctx: c, page: pg } = await ctxPage(width)
      // Đồng hồ giả CHỈ cho E2E: tua performance.now để phiên dài 10 phút mà không phải chờ thật
      await pg.evaluateOnNewDocument(() => {
        const real = performance.now.bind(performance); window.__tvaSkip = 0
        performance.now = () => real() + window.__tvaSkip
      })
      await pg.goto(ME, { waitUntil: 'networkidle0' })
      await pg.waitForSelector('#cs-login-email', { timeout: 15000 })
      await pg.type('#cs-login-email', email); await pg.type('#cs-login-pass', 'e2e'); await pg.click('.cs-guest-submit')
      await pg.waitForSelector('.cs-share', { timeout: 15000 })
      return { c, pg }
    }
    const MTR = `http://class.localhost:${V}/metronome`
    const shownBpm = pg => pg.$eval('input[type="range"]', e => Number(e.value))
    const { c: ca, pg: a } = await loginAt('a@test.local', 390)
    await a.goto(MTR + '?tempo=80', { waitUntil: 'networkidle0' })
    await clickText(a, 'Bắt đầu')
    assert.equal(await shownBpm(a), 80)
    await clickText(a, 'Dừng')   // phiên < 60 giây → không có gì để chia sẻ
    await new Promise(r => setTimeout(r, 300))
    assert.equal(/Chia sẻ thành tích/.test(await text(a)), false, 'phiên ngắn không có nút chia sẻ')
    await clickText(a, 'Bắt đầu')
    await a.evaluate(() => { window.__tvaSkip += 600_000 })
    await clickText(a, 'Dừng')
    await waitText(a, /Phiên luyện tập[\s\S]*80 BPM · 10 phút/)
    // Nút chính vẫn là Bắt đầu (to, cam); chia sẻ là nút phụ nhỏ hơn
    const [shareH, startH] = await a.evaluate(() => {
      const b = [...document.querySelectorAll('button')]
      return [b.find(x => x.textContent.trim() === 'Chia sẻ thành tích').offsetHeight, b.find(x => x.textContent.trim() === 'Bắt đầu').offsetHeight]
    })
    assert.ok(shareH < startH, `nút chia sẻ (${shareH}px) không lấn nút Bắt đầu (${startH}px)`)
    await noHorizontalOverflow(a, 'Metronome + kết quả phiên (390px)')
    await a.screenshot({ path: `${SHOTS}/19-metronome-result.png` })
    // Bấm đúp → vẫn MỘT bài
    await a.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Chia sẻ thành tích'); b.click(); b.click() })
    await waitText(a, /Đã chia sẻ lên cộng đồng/)
    await a.screenshot({ path: `${SHOTS}/20-metronome-shared.png` })
    // Trang chủ (Dành cho bạn): card kết quả + danh tính học tập hiện tại cạnh tên
    await a.goto(ME, { waitUntil: 'networkidle0' })
    await a.waitForSelector('.cs-tool-share-cta', { timeout: 15000 })
    const cards = await a.$$eval('.cs-post', els => els.filter(e => e.querySelector('.cs-tool-share')).map(e => e.textContent))
    assert.equal(cards.length, 1, 'bấm đúp chỉ tạo MỘT bài: ' + cards.length)
    assert.match(cards[0], /Metronome · Luyện tập[\s\S]*80 BPM · 10 phút[\s\S]*Hoàn thành một phiên luyện tập[\s\S]*Thử ở 80 BPM/)
    assert.equal(/client_key|practice_session|metronome\b|\{/.test(cards[0].replace('Metronome', '')), false, 'không lộ JSON / tool id')
    assert.ok(await a.$eval('.cs-post:has(.cs-tool-share) .cs-post-head', e => !!e.querySelector('.cs-lid')), 'danh tính học tập cạnh tên')
    await noHorizontalOverflow(a, 'Feed có card Metronome (390px)')
    await a.screenshot({ path: `${SHOTS}/21-feed-tool-share.png`, fullPage: true })
    // Không có ngữ cảnh lớp → không vào Lớp của tôi
    await a.goto(ME + '?feed=classes', { waitUntil: 'networkidle0' }); await new Promise(r => setTimeout(r, 1200))
    assert.equal(await a.$('.cs-tool-share'), null, 'không hiện ở Lớp của tôi')
    await ca.close()
    // B (1280) thấy card, bấm "Thử ở 80 BPM" → Metronome 80; tải lại vẫn 80
    const { c: cb, pg: b } = await loginAt('b@test.local', 1280)
    await b.waitForSelector('.cs-tool-share-cta', { timeout: 15000 })
    await b.screenshot({ path: `${SHOTS}/22-feed-tool-share-1280.png` })
    await Promise.all([b.waitForNavigation({ waitUntil: 'networkidle0' }), b.$eval('.cs-tool-share-cta', e => e.click())])
    assert.equal(await b.evaluate(() => location.pathname + location.search), '/metronome?tempo=80')
    await b.waitForSelector('input[type="range"]'); assert.equal(await shownBpm(b), 80)
    await b.reload({ waitUntil: 'networkidle0' }); await b.waitForSelector('input[type="range"]'); assert.equal(await shownBpm(b), 80)
    // Deep link lạ → mặc định an toàn (90)
    for (const q of ['?tempo=999', '?tempo=80abc', '?tempo=%3Cscript%3E']) {
      await b.goto(MTR + q, { waitUntil: 'networkidle0' }); await b.waitForSelector('input[type="range"]')
      assert.equal(await shownBpm(b), 90, q)
    }
    await cb.close()
    ok('Tool Share: Metronome 80 BPM · phiên 10 phút → Chia sẻ thành tích (bấm đúp vẫn 1 bài) → Dành cho bạn có card + danh tính → không ở Lớp của tôi → người khác "Thử ở 80 BPM" → /metronome?tempo=80, tải lại giữ 80; BPM lạ → 90; 390 không tràn ngang')
  }

  // ── BMS Artifact Share V1: nháp local → (không tự upload) → Chia sẻ → Feed → B "Luyện bài này" → chỉ luyện → A gỡ ──
  {
    const loginAt = async (email, width) => {
      const { ctx: c, page: pg } = await ctxPage(width)
      await pg.goto(ME, { waitUntil: 'domcontentloaded' })
      await pg.waitForSelector('#cs-login-email', { timeout: 15000 })
      await pg.type('#cs-login-email', email); await pg.type('#cs-login-pass', 'e2e'); await pg.click('.cs-guest-submit')
      await pg.waitForSelector('.cs-share', { timeout: 15000 })
      return { c, pg }
    }
    const SB = `http://class.localhost:${V}/song-builder`
    const serverCalls = []
    const { c: ca, pg: a } = await loginAt('a@test.local', 390)
    a.on('request', r => { if (/tool_artifacts|social_share_tool_result|social_delete_tool_artifact/.test(r.url())) serverCalls.push(r.url()) })
    // Nháp BMS hoàn chỉnh CHỈ trong máy (localStorage) — như người dùng vừa dựng xong
    await a.evaluate(() => {
      const anchor = (w, word, b) => ({ id: `anchor_${String(w).padStart(3, '0')}_b${b}`, wordIndex: w, word, beatIndex: b, tick: b * 480, source: 'anchor' })
      localStorage.setItem('csre-sb-scratch-v1', JSON.stringify({
        id: 'd_e2e1', title: 'Có Chàng Trai Viết Lên Cây', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ', thumbnail: null,
        lyricsText: 'Có chàng trai viết lên cây\nlời yêu thương cô gái ấy',
        fit: { ok: true, fitted: true, bpm: 76, beatDuration: 60 / 76, gridOffset: 1.2, validTaps: 12, rejected: 0, avgError: 0.01, maxError: 0.02, assign: [] },
        timeSignature: 4, downbeatPosition: 1, groupBeats: true,
        anchors: [anchor(0, 'Có', 0), anchor(6, 'lời', 8), anchor(11, 'ấy', 16)],
        chords: [{ wordIndex: 0, name: 'Am' }, { wordIndex: 3, name: 'F' }, { wordIndex: 6, name: 'C' }, { wordIndex: 9, name: 'G' }],
        step: 5, createdAt: Date.now(), updatedAt: Date.now(),
      }))
    })
    await a.goto(SB, { waitUntil: 'domcontentloaded' })
    await clickText(a, '▶ Tiếp tục')
    await waitText(a, /Chia sẻ lên cộng đồng/)
    await waitText(a, /Nháp của bạn vẫn chỉ ở máy/)
    await clickText(a, '💾 Lưu vào Bài hát của tôi')   // lưu thư viện LOCAL — không lên server
    await new Promise(r => setTimeout(r, 600))
    assert.deepEqual(serverCalls, [], 'dựng / tiếp tục / lưu nháp KHÔNG gọi server: ' + serverCalls.join(' '))
    await noHorizontalOverflow(a, 'BMS bước cuối + Chia sẻ (390px)')
    await new Promise(r => setTimeout(r, 2400))   // toast "Đã lưu" tắt rồi mới chụp
    await a.screenshot({ path: `${SHOTS}/23-bms-share.png` })
    // Bấm đúp Chia sẻ → vẫn MỘT bài
    await a.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Chia sẻ lên cộng đồng'); b.click(); b.click() })
    await waitText(a, /Đã chia sẻ lên cộng đồng/)
    const artHref = await a.$eval('a[href^="/song-builder?artifact="]', e => e.getAttribute('href'))
    assert.match(artHref, /^\/song-builder\?artifact=[0-9a-f-]{36}$/)
    await a.goto(ME, { waitUntil: 'domcontentloaded' })
    await a.waitForSelector('.cs-tool-share-thumb', { timeout: 15000 })
    const bmsCards = await a.$$eval('.cs-post', els => els.filter(e => /BMS · Dựng bài hát/.test(e.textContent)).map(e => ({ t: e.textContent, img: e.querySelector('.cs-tool-share-thumb')?.getAttribute('src'), cta: e.querySelector('.cs-tool-share-cta')?.getAttribute('href') })))
    assert.equal(bmsCards.length, 1, 'đúng MỘT thẻ BMS (bấm đúp)')
    assert.match(bmsCards[0].t, /BMS · Dựng bài hát[\s\S]*Có Chàng Trai Viết Lên Cây[\s\S]*76 BPM · 4\/4 · 4 hợp âm[\s\S]*Luyện bài này/)
    assert.equal(/yêu thương|cô gái/.test(bmsCards[0].t), false, 'thẻ Feed không lộ lời bài hát')
    assert.equal(bmsCards[0].img, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'); assert.equal(bmsCards[0].cta, artHref)
    await noHorizontalOverflow(a, 'Feed có thẻ BMS (390px)')
    await a.screenshot({ path: `${SHOTS}/24-feed-bms.png`, fullPage: true })
    // B: "Luyện bài này" → đúng bài, chỉ luyện; tải lại vẫn đúng; không có nút gỡ
    const { c: cb, pg: b } = await loginAt('b@test.local', 390)
    await b.waitForSelector('.cs-tool-share-thumb', { timeout: 15000 })
    await Promise.all([b.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      b.evaluate(() => [...document.querySelectorAll('.cs-post')].find(e => /BMS · Dựng bài hát/.test(e.textContent)).querySelector('.cs-tool-share-cta').click())])
    assert.equal(await b.evaluate(() => location.pathname + location.search), artHref)
    const checkPractice = async () => {
      await waitText(b, /chỉ luyện, không sửa bài gốc/, 15000)
      const t = await text(b)
      assert.match(t, /Có Chàng Trai Viết Lên Cây/); assert.match(t, /76·4\/4/)
      assert.match(t, /chàng[\s\S]*yêu[\s\S]*thương/, 'lời karaoke đúng bài')
      assert.match(t, /\bAm\b[\s\S]*\bG\b/, 'hợp âm đúng bài')
      assert.equal(/Gỡ chia sẻ|Lưu vào Bài hát|Chia sẻ lên cộng đồng/.test(t), false, 'người xem không lưu/sửa/gỡ')
    }
    await checkPractice()
    await noHorizontalOverflow(b, 'BMS chỉ luyện (390px)')
    await b.screenshot({ path: `${SHOTS}/25-bms-practice-b.png` })
    await b.reload({ waitUntil: 'domcontentloaded' }); await checkPractice()
    // Nháp của B không bị ghi bài của A
    assert.equal(await b.evaluate(() => localStorage.getItem('csre-sb-drafts-v1')), null, 'mở bài chia sẻ không ghi vào thư viện của B')
    // id lạ / không tồn tại → thông báo nhẹ, không crash
    await b.goto(SB + '?artifact=00000000-0000-4000-8000-000000000000', { waitUntil: 'domcontentloaded' }); await waitText(b, /không còn được chia sẻ/)
    await b.goto(SB + '?artifact=%3Cscript%3E', { waitUntil: 'domcontentloaded' }); await waitText(b, /không còn được chia sẻ/)
    // Khách chưa đăng nhập
    const { ctx: cg, page: g } = await ctxPage(390)
    await g.goto(`http://class.localhost:${V}${artHref}`, { waitUntil: 'domcontentloaded' }); await waitText(g, /Đăng nhập Class để luyện bài này/)
    await cg.close()
    // A (chủ bài) mở bài của mình → "Bài của bạn" → Gỡ chia sẻ (2 bước) → bài + thẻ biến mất
    const [ca2, a2] = [ca, a]   // cùng trình duyệt của A (nháp local ở đây)
    await a2.goto(`http://class.localhost:${V}${artHref}`, { waitUntil: 'domcontentloaded' })
    await waitText(a2, /Bài của bạn/)
    await clickText(a2, 'Gỡ chia sẻ'); await waitText(a2, /Nháp trong máy bạn vẫn giữ nguyên/)
    await a2.screenshot({ path: `${SHOTS}/26-bms-owner-remove.png` })
    await clickText(a2, 'Xác nhận gỡ'); await waitText(a2, /không còn được chia sẻ/)
    await a2.goto(ME, { waitUntil: 'domcontentloaded' }); await a2.waitForSelector('.cs-post', { timeout: 15000 }); await new Promise(r => setTimeout(r, 800))
    assert.equal(/BMS · Dựng bài hát/.test(await text(a2)), false, 'thẻ BMS đã gỡ khỏi Feed')
    assert.ok(await a2.evaluate(() => !!JSON.parse(localStorage.getItem('csre-sb-drafts-v1') || '{}').d_e2e1), 'nháp local của A vẫn còn')
    await ca2.close()
    // B tải lại link cũ → thông báo nhẹ, không dữ liệu chết
    await b.goto(`http://class.localhost:${V}${artHref}`, { waitUntil: 'domcontentloaded' }); await waitText(b, /không còn được chia sẻ/)
    await cb.close()
    ok('BMS Artifact: nháp local không tự lên server · Chia sẻ (bấm đúp vẫn 1 bài) → thẻ Feed (tên · 76 BPM · 4/4 · 4 hợp âm · thumbnail, không lời) → B "Luyện bài này" đúng bài (lời, hợp âm, lưới) chỉ luyện, tải lại giữ nguyên, không ghi thư viện B · id lạ/khách xử lý nhẹ · A gỡ → bài + thẻ biến mất, nháp local còn; 390 không tràn ngang')
  }

  // ── Nhịp & Phách → Tool Share: A dựng bản đánh số phách → Chia sẻ → Feed → B "Xem bản nhạc" → đúng bản, chỉ xem → A gỡ ──
  {
    const loginAt = async (email, width) => {
      const { ctx: c, page: pg } = await ctxPage(width)
      await pg.goto(ME, { waitUntil: 'networkidle0' })
      await pg.waitForSelector('#cs-login-email', { timeout: 15000 })
      await pg.type('#cs-login-email', email); await pg.type('#cs-login-pass', 'e2e'); await pg.click('.cs-guest-submit')
      await pg.waitForSelector('.cs-share', { timeout: 15000 })
      return { c, pg }
    }
    const NP = `http://class.localhost:${V}/nhipphach`
    const serverCalls = []
    const { c: ca, pg: a } = await loginAt('a@test.local', 390)
    a.on('request', r => { if (/tool_artifacts|social_share_tool_result|musicxml_library|nhipphach_score/.test(r.url())) serverCalls.push(r.method() + ' ' + r.url()) })
    await a.goto(NP, { waitUntil: 'networkidle0' })
    await clickText(a, 'Dùng file mẫu')
    await a.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Chia sẻ lên cộng đồng' && !b.disabled), { timeout: 60000 })
    assert.deepEqual(serverCalls, [], 'mở + dựng bản nhạc KHÔNG gửi gì lên server: ' + serverCalls.join(' '))
    await waitText(a, /Bản gốc của bạn không đổi/)
    await noHorizontalOverflow(a, 'Nhịp & Phách + nút chia sẻ (390px)')
    await a.evaluate(() => document.querySelector('.np-share').scrollIntoView({ block: 'center' }))
    await a.screenshot({ path: `${SHOTS}/27-nhipphach-share.png` })
    await a.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Chia sẻ lên cộng đồng'); b.click(); b.click() })
    await waitText(a, /Đã chia sẻ lên cộng đồng/, 20000)
    assert.ok(!serverCalls.some(u => /musicxml_library|nhipphach_score/.test(u)), 'không chạm kho master / kho Nhịp Phách: ' + serverCalls.join(' '))
    const npHref = await a.$eval('a[href^="/nhipphach?artifact="]', e => e.getAttribute('href'))
    assert.match(npHref, /^\/nhipphach\?artifact=[0-9a-f-]{36}$/)
    await a.goto(ME, { waitUntil: 'networkidle0' })
    await a.waitForFunction(() => /Nhịp & Phách · Bản nhạc/.test(document.body.innerText), { timeout: 15000 })
    const npCards = await a.$$eval('.cs-post', els => els.filter(e => /Nhịp & Phách · Bản nhạc/.test(e.textContent)).map(e => ({ t: e.textContent, lid: !!e.querySelector('.cs-post-head .cs-lid'), cta: e.querySelector('.cs-tool-share-cta')?.getAttribute('href') })))
    assert.equal(npCards.length, 1, 'đúng MỘT thẻ (bấm đúp)')
    assert.match(npCards[0].t, /Nhịp & Phách · Bản nhạc[\s\S]*bai mau[\s\S]*Nhịp 4\/4 · Đếm phách[\s\S]*Xem bản nhạc/)
    assert.ok(npCards[0].lid, 'danh tính học tập cạnh tên'); assert.equal(npCards[0].cta, npHref)
    assert.equal(/score-partwise|<\?xml/.test(npCards[0].t), false, 'thẻ không lộ MusicXML')
    await noHorizontalOverflow(a, 'Feed có thẻ Nhịp & Phách (390px)')
    await a.screenshot({ path: `${SHOTS}/28-feed-nhipphach.png` })
    // B: Xem bản nhạc → đúng bản (dựng lại), chỉ xem; tải lại vẫn đúng
    const { c: cb, pg: b } = await loginAt('b@test.local', 390)
    await b.waitForFunction(() => /Nhịp & Phách · Bản nhạc/.test(document.body.innerText), { timeout: 15000 })
    await Promise.all([b.waitForNavigation({ waitUntil: 'networkidle0' }),
      b.evaluate(() => [...document.querySelectorAll('.cs-post')].find(e => /Nhịp & Phách · Bản nhạc/.test(e.textContent)).querySelector('.cs-tool-share-cta').click())])
    assert.equal(await b.evaluate(() => location.pathname + location.search), npHref)
    const checkView = async () => {
      await b.waitForSelector('.np-shared-page img', { timeout: 60000 })
      const t = await text(b)
      assert.match(t, /bai mau[\s\S]*Nhịp 4\/4 · Đếm phách[\s\S]*chỉ xem, không sửa bản gốc/)
      assert.equal(/Gỡ chia sẻ|Chia sẻ lên cộng đồng|Xuất PDF|Lưu vào thư viện/.test(t), false, 'người xem không gỡ/lưu/xuất/sửa')
      const svg = await b.$eval('.np-shared-page img', async img => { const r = await fetch(img.src); return r.text() })
      assert.match(svg, /<svg/); assert.match(svg, /<text[^>]*>\s*1\s*<\/text>|>1</, 'bản khắc có số phách')
      assert.ok(await b.$eval('.np-shared-page img', i => i.naturalWidth > 0), 'trang bản nhạc hiển thị')
    }
    await checkView()
    await noHorizontalOverflow(b, 'Bản nhạc chia sẻ chỉ xem (390px)')
    await b.screenshot({ path: `${SHOTS}/29-nhipphach-view-b.png`, fullPage: true })
    await b.reload({ waitUntil: 'networkidle0' }); await checkView()
    await b.goto(NP + '?artifact=00000000-0000-4000-8000-000000000000', { waitUntil: 'networkidle0' }); await waitText(b, /không còn được chia sẻ/)
    await b.goto(NP + '?artifact=%3Cscript%3E', { waitUntil: 'networkidle0' }); await waitText(b, /không còn được chia sẻ/)
    const { ctx: cg, page: g } = await ctxPage(390)
    await g.goto(`http://class.localhost:${V}${npHref}`, { waitUntil: 'networkidle0' }); await waitText(g, /Đăng nhập Class để xem bản nhạc này/)
    await cg.close()
    // A gỡ → thẻ + bản biến mất; link cũ báo nhẹ
    await a.goto(`http://class.localhost:${V}${npHref}`, { waitUntil: 'networkidle0' })
    await waitText(a, /Bản của bạn/, 15000)
    await clickText(a, 'Gỡ chia sẻ'); await waitText(a, /Bản nhạc gốc của bạn không đổi/)
    await clickText(a, 'Xác nhận gỡ'); await waitText(a, /không còn được chia sẻ/)
    await a.goto(ME, { waitUntil: 'networkidle0' }); await a.waitForSelector('.cs-post', { timeout: 15000 }); await new Promise(r => setTimeout(r, 800))
    assert.equal(/Nhịp & Phách · Bản nhạc/.test(await text(a)), false, 'thẻ đã gỡ khỏi Feed')
    await ca.close()
    await b.goto(`http://class.localhost:${V}${npHref}`, { waitUntil: 'networkidle0' }); await waitText(b, /không còn được chia sẻ/)
    await cb.close()
    ok('Nhịp & Phách: dựng bản đánh số phách không gửi gì lên server · Chia sẻ (bấm đúp vẫn 1) → thẻ "Nhịp & Phách · Bản nhạc · bai mau · Nhịp 4/4 · Đếm phách" + danh tính, không MusicXML → B "Xem bản nhạc" dựng lại đúng bản (có số phách), chỉ xem, tải lại giữ nguyên · id lạ/khách báo nhẹ · A gỡ → thẻ + link xử lý đúng · không chạm kho master; 390 không tràn')
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
