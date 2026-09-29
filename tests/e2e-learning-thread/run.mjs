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
  const h = await page.waitForFunction((l, s) => [...document.querySelectorAll(s)].find(b => b.textContent.trim() === l && !b.disabled), { timeout: 10000 }, label, scope)
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
  await waitText(page, /Hàng đợi Trả bài \/ Hỏi bài/, 15000)
  await (await page.waitForSelector('section[aria-label="Hàng đợi Trả bài / Hỏi bài"] button')).click()
  await page.waitForFunction(() => location.pathname === '/me/queue')
  await waitText(page, /An · DH2\.KD18 · Đệm hát 2/)
  await waitText(page, /Trả bài: Em nộp bài Bolero/)
  ok('Thầy: /me/queue thấy An · DH2.KD18 · bài · diễn biến cuối')
  await page.screenshot({ path: `${SHOTS}/4-queue.png`, fullPage: true })
  await page.$eval('.lt-row', b => b.click())
  await page.waitForFunction(id => location.pathname === '/me/t/' + id, {}, threadId)
  await waitText(page, /Thầy phản hồi/)
  await page.type('.lt-compose textarea', 'Tay phải móc chưa đều, em tập chậm lại rồi quay lại nhé.')
  await clickText(page, 'Cần làm lại')
  await waitText(page, /Thầy nhận xét · Cần làm lại/)
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
  await waitText(page, /Thầy nhận xét · ĐẠT/)
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
  await waitText(page, /Trả bài \/ Hỏi bài của tôi/, 15000)
  await page.$eval('[aria-labelledby="lt-mine-title"] .lt-row', b => b.click())
  await page.waitForFunction(() => location.pathname.startsWith('/me/t/'))
  await waitText(page, /Em tự học, nhờ Thầy xem giúp/)
  ok('/me của B: khối "Trả bài / Hỏi bài của tôi" → mở đúng thread')
  await page.screenshot({ path: `${SHOTS}/7-me-home-b.png`, fullPage: true })
  await ctx.close()

  // ── 10. Desktop /me/t (1280px) không vỡ ─────────────────────────────────
  ;({ ctx, page } = await ctxPage(1280))
  await page.goto(ME + '/t/' + threadId, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email')
  await page.type('#cs-login-email', 't@test.local'); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await waitText(page, /Thầy nhận xét · ĐẠT/, 15000)
  await noHorizontalOverflow(page, '/me/t/<id> desktop 1280px')
  await page.screenshot({ path: `${SHOTS}/8-desktop-thread.png`, fullPage: true })
  await ctx.close()

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
