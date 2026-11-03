// E2E G3 thẻ "Ôn nhanh" — xem scripts/e2e-lesson-clip.sh. iPhone 390px, Light Mode. ID video trong dữ liệu là GIẢ.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const BASE = `http://class.localhost:${process.env.VITE_PORT}`
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run'] })
const ok = m => console.log('PASS: ' + m)
const errors = []
const TH01 = 'b1000000-0000-4000-8000-000000000001'

async function meAs(email, path = '/me') {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.setBypassServiceWorker(true)
  const feedBodies = []
  page.on('pageerror', e => errors.push(`${email} pageerror: ` + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource|^WebSocket/.test(m.text())) errors.push(`${email} console: ` + m.text()) })
  page.on('response', async r => { if (/rpc\/social_feed/.test(r.url())) { try { const b = await r.text(); feedBodies.push(b); if (process.env.E2E_DEBUG) console.log('[rpc]', r.status(), r.url().split('/rpc/')[1], b.slice(0, 200)) } catch { /* trang đóng */ } } })
  await page.goto(BASE + '/me', { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', email); await page.type('#cs-login-pass', 'e2e')
  await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  if (path !== '/me') await page.goto(BASE + path, { waitUntil: 'networkidle0' })
  await page.waitForSelector('article.cs-post', { timeout: 20000 })
  return { ctx, page, feedBodies }
}
const clips = page => page.$$eval('.cs-clip-card', els => els.map(e => ({
  text: e.textContent, href: e.querySelector('a.cs-clip-lesson')?.getAttribute('href'), h: Math.round(e.querySelector('button.cs-clip-open')?.getBoundingClientRect().height ?? 0),
  h2: Math.round(e.querySelector('a.cs-clip-lesson')?.getBoundingClientRect().height ?? 0), anchorOpen: e.querySelectorAll('a.cs-clip-open').length,
  likebar: e.querySelectorAll('.cs-likebar').length,
  ratio: (r => r ? +(r.width / r.height).toFixed(2) : 0)(e.querySelector('.cs-clip-thumb')?.getBoundingClientRect()),
  play: !!e.querySelector('.cs-clip-thumb .cs-clip-play'), iframes: e.querySelectorAll('iframe').length,
})))

try {
  // A (TH01, có quyền giáo trình): Feed chung
  const a = await meAs('a@test.local')
  let list = await clips(a.page)
  assert.equal(list.length, 2, 'A thấy đúng 2 thẻ (CLIP-TH01-S1, S2): ' + JSON.stringify(list.map(x => x.text)))
  assert.ok(list.some(x => /CLIP-TH01-S1/.test(x.text) && /2:07/.test(x.text)) && list.some(x => /CLIP-TH01-S2/.test(x.text)), 'tiêu đề + thời lượng')
  assert.ok(list.every(x => !/CLIP-TH02|CLIP-NOADDED/.test(x.text)), 'không thẻ lớp khác / khối thiếu added_at')
  ok('A / Feed chung 390px: 2 thẻ Ôn nhanh đúng lớp; khối lớp TH02 và khối thiếu added_at KHÔNG hiện')
  assert.ok(list.every(x => x.href && new RegExp(`^/me/classes/${TH01}/sessions/[12]$`).test(x.href)), 'liên kết phụ "Xem bài học" = trang Buổi gốc: ' + list.map(x => x.href))
  assert.ok(list.every(x => x.h >= 44 && x.h2 >= 44), 'nút "Xem clip" và liên kết "Xem bài học" cao ≥ 44px: ' + list.map(x => x.h + '/' + x.h2))
  assert.ok(list.every(x => x.anchorOpen === 0), '"Xem clip" là nút, không còn liên kết điều hướng')
  assert.ok(list.every(x => x.likebar === 0), 'thẻ không có Thích/Bình luận')
  assert.ok(list.every(x => Math.abs(x.ratio - 16 / 9) < 0.03 && x.play), 'khung ảnh bìa 16:9 có nút Play: ' + list.map(x => x.ratio))
  assert.ok(list.every(x => x.iframes === 0), 'cuộn qua Feed KHÔNG tự phát (không iframe)')
  ok('ảnh bìa 16:9 + nút Play; không tự phát khi cuộn')
  ok('liên kết đúng Trang Buổi gốc; nút ≥ 44px; không có Thích/Bình luận')
  const html = await a.page.content()
  // video id GIẢ + ghi chú: không được có ở BẤT KỲ đâu trong DOM; "youtu" (head tĩnh của trang có thể nhắc nguồn nhúng) kiểm trong vùng Feed
  const hit = /ZZfake|NOTE_SENTINEL_E2E/i.exec(html)
  assert.equal(hit, null, 'DOM không chứa video id / ghi chú: ' + (hit ? html.slice(Math.max(0, hit.index - 120), hit.index + 80) : ''))
  const feedHtml = await a.page.$$eval('article.cs-post', els => els.map(e => e.outerHTML).join('\n'))
  assert.doesNotMatch(feedHtml, /youtu|https?:\/\/[^"' ]*v=/i, 'vùng Feed không chứa URL YouTube')
  assert.ok(a.feedBodies.length > 0 && a.feedBodies.every(b => !/youtu|ZZfake|NOTE_SENTINEL_E2E/i.test(b)), 'phản hồi RPC social_feed* KHÔNG chứa URL/ID/ghi chú (' + a.feedBodies.length + ' phản hồi)')
  ok('DOM và mọi phản hồi RPC Feed không chứa URL YouTube / video id / ghi chú')
  const [sw, iw] = await a.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(sw <= iw + 1, `không tràn ngang ${sw}>${iw}`)
  ok('không tràn ngang ở 390px')
  await a.page.$eval('.cs-clip-card', e => e.scrollIntoView({ block: 'center' }))
  await a.page.screenshot({ path: `${SHOTS}/clip-390-foryou.png` })

  // Bấm "Xem clip" → trình phát NGAY TRONG Class (không chuyển trang, không mở YouTube ngoài), đóng được, giữ vị trí cuộn
  const target = list.find(x => /CLIP-TH01-S1/.test(x.text)).href
  const openClip = async () => {
    const cards = await a.page.$$('.cs-clip-card')
    for (const c of cards) { if (/CLIP-TH01-S1/.test(await c.evaluate(e => e.textContent))) { await (await c.$('button.cs-clip-open')).click(); return } }
    throw new Error('không thấy thẻ CLIP-TH01-S1')
  }
  await a.page.evaluate(() => { for (const c of document.querySelectorAll('.cs-clip-card')) if (/CLIP-TH01-S1/.test(c.textContent)) c.querySelector('button.cs-clip-open').scrollIntoView({ block: 'center' }) })
  // chờ cuộn + nạp thêm Feed ổn định (scrollY không đổi qua 2 lần đo cách 400ms)
  for (let i = 0, last = -1; i < 20; i++) { const y = await a.page.evaluate(() => scrollY); if (y === last) break; last = y; await new Promise(r => setTimeout(r, 400)) }
  // ảnh của bài khác trong Feed (404 trong DB tạm → thu gọn khi lỗi) có thể đổi chiều cao SAU lúc đo → chờ mọi ảnh xong rồi mới đo lại
  await a.page.waitForFunction(() => [...document.querySelectorAll('article.cs-post img')].every(i => i.complete), { timeout: 15000 })
  await new Promise(r => setTimeout(r, 600))
  await a.page.evaluate(() => { for (const c of document.querySelectorAll('.cs-clip-card')) if (/CLIP-TH01-S1/.test(c.textContent)) c.querySelector('button.cs-clip-open').scrollIntoView({ block: 'center' }) })
  await new Promise(r => setTimeout(r, 300))
  const y0 = await a.page.evaluate(() => scrollY)
  const dbg0 = await a.page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, cards: document.querySelectorAll('article.cs-post').length, hs: [...document.querySelectorAll('article.cs-post')].map(e => Math.round(e.getBoundingClientRect().height) + (e.classList.contains('cs-clip-card') ? 'c' : '')).join(',') }))
  const path0 = await a.page.evaluate(() => location.pathname + location.search)
  const pages0 = (await browser.pages()).length
  await openClip()
  await a.page.waitForSelector('.cs-clip-modal iframe', { timeout: 20000 })
  const m = await a.page.$eval('.cs-clip-modal', e => ({ src: e.querySelector('iframe').getAttribute('src'), role: e.getAttribute('role'), modal: e.getAttribute('aria-modal'),
    lesson: e.querySelector('a.cs-clip-lesson')?.getAttribute('href'), ext: e.querySelectorAll('a[target=_blank], a[href*="youtu"]').length, w: Math.round(e.getBoundingClientRect().width), x: Math.round(e.getBoundingClientRect().left),
    closeH: Math.round(e.querySelector('.cs-clip-close').getBoundingClientRect().height) }))
  assert.match(m.src, /youtube\.com\/embed\/ZZfakeE2E01/, 'iframe phát đúng clip của buổi: ' + m.src)
  assert.equal(m.role, 'dialog'); assert.equal(m.modal, 'true'); assert.equal(m.lesson, target, 'liên kết phụ Xem bài học = trang Buổi gốc'); assert.equal(m.ext, 0, 'không liên kết YouTube ngoài')
  assert.ok(m.closeH >= 44, 'nút Đóng ≥ 44px: ' + m.closeH); assert.ok(m.x >= 0 && m.x + m.w <= 391, `hộp phát không tràn ngang (x=${m.x}, w=${m.w})`)
  assert.equal(await a.page.evaluate(() => location.pathname + location.search), path0, 'không chuyển trang khi mở player')
  assert.equal((await browser.pages()).length, pages0, 'không mở tab/cửa sổ mới')
  assert.equal(await a.page.$eval('.cs-clip-modal', e => /NOTE_SENTINEL_E2E/.test(document.body.innerText)), false, 'ghi chú không lộ trong hộp phát')
  ok('Bấm "Xem clip" → hộp phát trong Class (iframe đúng clip), không đổi trang, không tab mới, không liên kết YouTube ngoài; nút Đóng ≥ 44px; không tràn ngang')
  await a.page.screenshot({ path: `${SHOTS}/clip-390-player.png` })
  await a.page.click('.cs-clip-modal .cs-clip-close')
  await a.page.waitForFunction(() => !document.querySelector('.cs-clip-modal'), { timeout: 5000 })
  const y1 = await a.page.evaluate(() => scrollY)
  assert.ok(Math.abs(y1 - y0) <= 2, `giữ vị trí cuộn Feed (${y0} → ${y1}) ${JSON.stringify(dbg0)} sau=${JSON.stringify(await a.page.evaluate(() => ({ sh: document.documentElement.scrollHeight, hs: [...document.querySelectorAll('article.cs-post')].map(e => Math.round(e.getBoundingClientRect().height) + (e.classList.contains('cs-clip-card') ? 'c' : '')).join(',') })))}`)
  assert.equal(await a.page.evaluate(() => location.pathname + location.search), path0)
  assert.equal(await a.page.evaluate(() => document.activeElement?.classList.contains('cs-clip-open')), true, 'focus trả về nút Xem clip')
  ok('Đóng bằng nút → về Feed đúng vị trí cuộn, URL không đổi, focus trả về nút Xem clip')
  await openClip(); await a.page.waitForSelector('.cs-clip-modal')
  await a.page.keyboard.press('Escape')
  await a.page.waitForFunction(() => !document.querySelector('.cs-clip-modal'), { timeout: 5000 })
  await openClip(); await a.page.waitForSelector('.cs-clip-modal')
  await a.page.mouse.click(5, 5)   // bấm nền
  await a.page.waitForFunction(() => !document.querySelector('.cs-clip-modal'), { timeout: 5000 })
  assert.ok(Math.abs((await a.page.evaluate(() => scrollY)) - y0) <= 2, 'vẫn giữ vị trí cuộn sau Esc / bấm nền')
  ok('Đóng bằng Esc và bấm nền đều hoạt động; vị trí cuộn giữ nguyên')
  // Liên kết phụ "Xem bài học" → Trang Buổi gốc, khối video hiển thị theo quyền giáo trình
  await a.page.click(`.cs-clip-card a.cs-clip-lesson[href="${target}"]`)
  await a.page.waitForFunction(p => location.pathname === p, { timeout: 15000 }, target)
  await a.page.waitForFunction(() => /CLIP-TH01-S1/.test(document.body.innerText), { timeout: 20000, polling: 300 })
  ok('"Xem bài học" → ' + target + ' và Trang Buổi hiển thị khối video "CLIP-TH01-S1" (quyền do giáo trình quyết)')
  await a.page.screenshot({ path: `${SHOTS}/clip-390-session.png` })

  // Tab "Lớp": FE hiện ghép social_class_activity theo từng lớp (KHÔNG gọi social_feed_scoped('my_classes')) → G3 không đổi hành vi tab này.
  // (Muốn thẻ Ôn nhanh ở tab Lớp cần thêm nguồn vào social_class_activity — thay đổi riêng, chưa nằm trong phạm vi được duyệt.)
  await a.page.goto(BASE + '/me?feed=classes', { waitUntil: 'networkidle0' })
  await a.page.waitForFunction(() => /Hoạt động từ các lớp/.test(document.body.innerText), { timeout: 20000, polling: 300 })
  assert.equal((await clips(a.page)).length, 0, 'tab Lớp: không thẻ Ôn nhanh (nguồn riêng, không đổi)')
  ok('Tab "Lớp" KHÔNG đổi hành vi (nguồn social_class_activity): không thẻ, không lỗi')
  await a.page.screenshot({ path: `${SHOTS}/clip-390-classes.png` })

  // Desktop 1280×800: hộp phát căn giữa, rộng ≤ 760px, đóng được
  await a.page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  await a.page.goto(BASE + '/me', { waitUntil: 'networkidle0' })
  await a.page.waitForSelector('.cs-clip-card', { timeout: 20000 })
  await (await a.page.$('.cs-clip-card button.cs-clip-open')).click()
  await a.page.waitForSelector('.cs-clip-modal iframe', { timeout: 20000 })
  const dm = await a.page.$eval('.cs-clip-modal', e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), cx: Math.round(r.left + r.width / 2), top: Math.round(r.top), bottom: Math.round(r.bottom) } })
  assert.ok(dm.w <= 760 && dm.w >= 600, 'desktop: hộp phát rộng 600–760px: ' + dm.w); assert.ok(Math.abs(dm.cx - 640) <= 2, 'căn giữa: ' + dm.cx); assert.ok(dm.top >= 0 && dm.bottom <= 800, 'nằm trong khung nhìn')
  await a.page.screenshot({ path: `${SHOTS}/clip-1280-player.png` })
  await a.page.keyboard.press('Escape')
  await a.page.waitForFunction(() => !document.querySelector('.cs-clip-modal'), { timeout: 5000 })
  ok('Desktop 1280px: hộp phát căn giữa, ' + dm.w + 'px, nằm trong khung nhìn; Esc đóng được')

  // C (lớp TH02): chỉ thấy thẻ của TH02, cả hai góc nhìn
  const c = await meAs('c@test.local')
  list = await clips(c.page)
  assert.equal(list.length, 1, 'C thấy đúng 1 thẻ: ' + JSON.stringify(list.map(x => x.text)))
  assert.match(list[0].text, /CLIP-TH02-S1/); assert.doesNotMatch(list[0].text, /CLIP-TH01/)
  assert.ok(c.feedBodies.every(b => !/CLIP-TH01/.test(b)), 'phản hồi RPC cho C không chứa tiêu đề clip TH01')
  ok('C (lớp TH02): chỉ thấy thẻ lớp mình ở Feed chung; phản hồi RPC không chứa clip lớp TH01')
  await (await c.page.$('.cs-clip-card button.cs-clip-open')).click()
  await c.page.waitForSelector('.cs-clip-modal iframe', { timeout: 20000 })
  assert.match(await c.page.$eval('.cs-clip-modal iframe', e => e.getAttribute('src')), /embed\/ZZfakeE2E03/, 'C phát đúng clip TH02, không phải clip TH01')
  ok('C bấm Xem clip → phát đúng clip lớp TH02 (RLS giáo trình cấp đúng khối cho đúng người)')

  // B bị thu hồi quyền giáo trình (thao tác DB) sẽ được kiểm ở test DB; E2E kiểm hiển thị thật theo người
  assert.deepEqual(errors, [], 'không lỗi console/page: ' + errors.join(' | '))
  ok('Không có lỗi console/pageerror')
  console.log('══ E2E Ôn nhanh (G3): TẤT CẢ PASS')
} catch (e) {
  console.error('FAIL:', e.message); process.exitCode = 1
} finally { await browser.close() }
