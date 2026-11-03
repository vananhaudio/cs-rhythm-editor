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

  // Bấm Play → video phát NGAY TẠI khung ảnh bìa trong thẻ (không modal, không đổi trang, không mở YouTube ngoài), một thẻ phát tại một thời điểm
  const target = list.find(x => /CLIP-TH01-S1/.test(x.text)).href
  const cardJs = (page, re) => page.evaluateHandle(re => [...document.querySelectorAll('.cs-clip-card')].find(c => new RegExp(re).test(c.textContent)), re)
  const nIframes = page => page.evaluate(() => document.querySelectorAll('iframe').length)
  const scrollCardToCenter = page => page.evaluate(() => { for (const c of document.querySelectorAll('.cs-clip-card')) if (/CLIP-TH01-S1/.test(c.textContent)) c.querySelector('.cs-clip-frame').scrollIntoView({ block: 'center' }) })
  assert.equal(await nIframes(a.page), 0, 'cuộn/duyệt Feed KHÔNG tự phát: chưa có iframe nào')
  await scrollCardToCenter(a.page)
  // chờ cuộn + nạp thêm Feed ổn định (scrollY không đổi qua 2 lần đo cách 400ms)
  for (let i = 0, last = -1; i < 20; i++) { const y = await a.page.evaluate(() => scrollY); if (y === last) break; last = y; await new Promise(r => setTimeout(r, 400)) }
  // ảnh của bài khác trong Feed (404 trong DB tạm → thu gọn khi lỗi) có thể đổi chiều cao SAU lúc đo → chờ mọi ảnh xong rồi mới đo lại
  await a.page.waitForFunction(() => [...document.querySelectorAll('article.cs-post img')].every(i => i.complete), { timeout: 15000 })
  await new Promise(r => setTimeout(r, 600))
  await scrollCardToCenter(a.page)
  await new Promise(r => setTimeout(r, 300))
  const y0 = await a.page.evaluate(() => scrollY)
  const path0 = await a.page.evaluate(() => location.pathname + location.search)
  const pages0 = (await browser.pages()).length
  const frame0 = await (await cardJs(a.page, 'CLIP-TH01-S1')).evaluate(c => { const r = c.querySelector('.cs-clip-frame').getBoundingClientRect(); return { top: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) } })
  await (await (await cardJs(a.page, 'CLIP-TH01-S1')).$('.cs-clip-thumb')).click()
  await a.page.waitForSelector('.cs-clip-card iframe', { timeout: 20000 })
  const m = await (await cardJs(a.page, 'CLIP-TH01-S1')).evaluate(c => { const f = c.querySelector('.cs-clip-frame'), i = f.querySelector('iframe'), r = f.getBoundingClientRect()
    return { src: i?.getAttribute('src'), fs: i?.hasAttribute('allowfullscreen'), top: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), thumb: !!c.querySelector('.cs-clip-thumb'),
      btn: c.querySelector('button.cs-clip-open')?.textContent, lesson: c.querySelector('a.cs-clip-lesson')?.getAttribute('href'), ext: c.querySelectorAll('a[target=_blank], a[href*="youtu"]').length,
      dialog: document.querySelectorAll('[role=dialog], .cs-dialog, .cs-dialog-backdrop').length, over: document.documentElement.scrollWidth > innerWidth + 1 } })
  assert.match(m.src, /youtube\.com\/embed\/ZZfakeE2E01\?.*autoplay=1/, 'iframe phát ngay (autoplay do bấm Play) đúng clip của buổi: ' + m.src)
  assert.equal(m.fs, true, 'iframe cho phép toàn màn hình')
  assert.ok(Math.abs(m.top - frame0.top) <= 2 && m.w === frame0.w && Math.abs(m.h - frame0.h) <= 2, `player nằm ĐÚNG vị trí/kích thước ảnh bìa: ${JSON.stringify(frame0)} → ${JSON.stringify(m)}`)
  assert.equal(m.thumb, false, 'ảnh bìa đã chuyển thành player'); assert.equal(m.btn, 'Đóng video')
  assert.equal(m.lesson, target, 'liên kết "Xem bài học" vẫn còn, đúng Trang Buổi gốc'); assert.equal(m.ext, 0, 'không liên kết YouTube ngoài'); assert.equal(m.dialog, 0, 'không modal')
  assert.equal(m.over, false, 'không tràn ngang')
  assert.ok(Math.abs((await a.page.evaluate(() => scrollY)) - y0) <= 2, 'bấm Play không làm Feed nhảy vị trí cuộn')
  assert.equal(await a.page.evaluate(() => location.pathname + location.search), path0, 'không chuyển trang')
  assert.equal((await browser.pages()).length, pages0, 'không mở tab/cửa sổ mới')
  assert.equal(await a.page.evaluate(() => /NOTE_SENTINEL_E2E/.test(document.body.innerText)), false, 'ghi chú không lộ')
  assert.equal(await a.page.evaluate(() => document.fullscreenEnabled), true, 'trình duyệt cho phép toàn màn hình')
  ok('Bấm Play → video phát ngay tại khung ảnh bìa (cùng vị trí/kích thước), không modal, không đổi trang/tab, giữ cuộn; iframe cho phép toàn màn hình; "Xem bài học" còn')
  await a.page.screenshot({ path: `${SHOTS}/clip-390-inline.png` })
  // Chỉ một thẻ phát: bấm Play ở thẻ S2 → thẻ S1 dừng (iframe gỡ, ảnh bìa trở lại)
  await (await (await cardJs(a.page, 'CLIP-TH01-S2')).$('.cs-clip-thumb')).click()
  await a.page.waitForFunction(() => document.querySelectorAll('iframe').length === 1, { timeout: 10000 })
  const who = await a.page.evaluate(() => [...document.querySelectorAll('.cs-clip-card')].map(c => (/CLIP-TH01-S(\d)/.exec(c.textContent) || [])[1] + ':' + c.querySelectorAll('iframe').length + (c.querySelector('.cs-clip-thumb') ? 't' : '')).join(' '))
  assert.match(who, /1:0t/); assert.match(who, /2:1/)
  ok('Hai thẻ: bấm Play thẻ S2 → thẻ S1 tự dừng (gỡ iframe, ảnh bìa trở lại); luôn đúng 1 player (' + who + ')')
  // Đóng video bằng nút → ảnh bìa trở lại, focus về nút, vị trí cuộn giữ nguyên
  const y2 = await a.page.evaluate(() => scrollY)
  await (await (await cardJs(a.page, 'CLIP-TH01-S2')).$('button.cs-clip-open')).click()
  await a.page.waitForFunction(() => document.querySelectorAll('iframe').length === 0, { timeout: 5000 })
  assert.equal(await a.page.evaluate(() => document.activeElement?.classList.contains('cs-clip-open')), true, 'focus ở nút Xem clip')
  assert.ok(Math.abs((await a.page.evaluate(() => scrollY)) - y2) <= 2, 'đóng video giữ vị trí cuộn')
  ok('"Đóng video" → player được gỡ (0 iframe), ảnh bìa trở lại, focus ở nút, giữ cuộn')
  // Tháo thẻ khỏi giao diện (đổi tab Feed) khi đang phát → dừng & giải phóng player
  await scrollCardToCenter(a.page)
  await (await (await cardJs(a.page, 'CLIP-TH01-S1')).$('button.cs-clip-open')).click()
  await a.page.waitForSelector('.cs-clip-card iframe', { timeout: 20000 })
  await a.page.evaluate(() => scrollTo(0, 0))
  await a.page.evaluate(() => { const b = [...document.querySelectorAll('.cs-feed-tabs button')].find(x => /Lớp/.test(x.textContent)); b?.click() })
  await a.page.waitForFunction(() => document.querySelectorAll('.cs-clip-card').length === 0, { timeout: 15000 })
  assert.equal(await nIframes(a.page), 0, 'thẻ bị tháo → iframe đã gỡ')
  ok('Đổi tab Feed khi đang phát → thẻ bị tháo, player được gỡ (0 iframe)')
  await a.page.goto(BASE + '/me', { waitUntil: 'networkidle0' })
  await a.page.waitForSelector('.cs-clip-card', { timeout: 20000 })
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

  // Desktop 1280×800: video phát ngay trong thẻ, đúng khung 16:9, không modal
  await a.page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
  await a.page.goto(BASE + '/me', { waitUntil: 'networkidle0' })
  await a.page.waitForSelector('.cs-clip-card', { timeout: 20000 })
  await (await a.page.$('.cs-clip-card .cs-clip-thumb')).click()
  await a.page.waitForSelector('.cs-clip-card iframe', { timeout: 20000 })
  const dm = await a.page.$eval('.cs-clip-card', c => { const f = c.querySelector('.cs-clip-frame').getBoundingClientRect(), r = c.getBoundingClientRect(); return { ratio: +(f.width / f.height).toFixed(2), inCard: f.left >= r.left && f.right <= r.right, w: Math.round(f.width), dialog: document.querySelectorAll('[role=dialog], .cs-dialog').length } })
  assert.ok(Math.abs(dm.ratio - 16 / 9) < 0.03 && dm.inCard && dm.dialog === 0, 'desktop: player 16:9 nằm trong thẻ, không modal: ' + JSON.stringify(dm))
  await a.page.screenshot({ path: `${SHOTS}/clip-1280-inline.png` })
  await a.page.click('.cs-clip-card button.cs-clip-open')
  await a.page.waitForFunction(() => document.querySelectorAll('iframe').length === 0, { timeout: 5000 })
  ok('Desktop 1280px: video phát ngay trong thẻ (' + dm.w + 'px, 16:9), không modal; Đóng video gỡ player')

  // C (lớp TH02): chỉ thấy thẻ của TH02, cả hai góc nhìn
  const c = await meAs('c@test.local')
  list = await clips(c.page)
  assert.equal(list.length, 1, 'C thấy đúng 1 thẻ: ' + JSON.stringify(list.map(x => x.text)))
  assert.match(list[0].text, /CLIP-TH02-S1/); assert.doesNotMatch(list[0].text, /CLIP-TH01/)
  assert.ok(c.feedBodies.every(b => !/CLIP-TH01/.test(b)), 'phản hồi RPC cho C không chứa tiêu đề clip TH01')
  ok('C (lớp TH02): chỉ thấy thẻ lớp mình ở Feed chung; phản hồi RPC không chứa clip lớp TH01')
  await (await c.page.$('.cs-clip-card .cs-clip-thumb')).click()
  await c.page.waitForSelector('.cs-clip-card iframe', { timeout: 20000 })
  assert.match(await c.page.$eval('.cs-clip-card iframe', e => e.getAttribute('src')), /embed\/ZZfakeE2E03/, 'C phát đúng clip TH02, không phải clip TH01')
  ok('C bấm Play → phát đúng clip lớp TH02 (RLS giáo trình cấp đúng khối cho đúng người)')

  // B bị thu hồi quyền giáo trình (thao tác DB) sẽ được kiểm ở test DB; E2E kiểm hiển thị thật theo người
  assert.deepEqual(errors, [], 'không lỗi console/page: ' + errors.join(' | '))
  ok('Không có lỗi console/pageerror')
  console.log('══ E2E Ôn nhanh (G3): TẤT CẢ PASS')
} catch (e) {
  console.error('FAIL:', e.message); process.exitCode = 1
} finally { await browser.close() }
