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
  text: e.textContent, href: e.querySelector('a.cs-clip-open')?.getAttribute('href'), h: Math.round(e.querySelector('a.cs-clip-open')?.getBoundingClientRect().height ?? 0),
  likebar: e.querySelectorAll('.cs-likebar').length,
})))

try {
  // A (TH01, có quyền giáo trình): Feed chung
  const a = await meAs('a@test.local')
  let list = await clips(a.page)
  assert.equal(list.length, 2, 'A thấy đúng 2 thẻ (CLIP-TH01-S1, S2): ' + JSON.stringify(list.map(x => x.text)))
  assert.ok(list.some(x => /CLIP-TH01-S1/.test(x.text) && /2:07/.test(x.text)) && list.some(x => /CLIP-TH01-S2/.test(x.text)), 'tiêu đề + thời lượng')
  assert.ok(list.every(x => !/CLIP-TH02|CLIP-NOADDED/.test(x.text)), 'không thẻ lớp khác / khối thiếu added_at')
  ok('A / Feed chung 390px: 2 thẻ Ôn nhanh đúng lớp; khối lớp TH02 và khối thiếu added_at KHÔNG hiện')
  assert.ok(list.every(x => x.href && new RegExp(`^/me/classes/${TH01}/sessions/[12]$`).test(x.href)), 'liên kết = trang Buổi gốc: ' + list.map(x => x.href))
  assert.ok(list.every(x => x.h >= 44), 'nút "Xem clip" cao ≥ 44px: ' + list.map(x => x.h))
  assert.ok(list.every(x => x.likebar === 0), 'thẻ không có Thích/Bình luận')
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

  // Bấm "Xem clip" → Trang Buổi gốc, nơi khối video hiển thị theo quyền giáo trình
  const target = list.find(x => /CLIP-TH01-S1/.test(x.text)).href
  await a.page.click(`.cs-clip-card a.cs-clip-open[href="${target}"]`)
  await a.page.waitForFunction(p => location.pathname === p, { timeout: 15000 }, target)
  await a.page.waitForFunction(() => /CLIP-TH01-S1/.test(document.body.innerText), { timeout: 20000, polling: 300 })
  ok('Bấm "Xem clip" → ' + target + ' và Trang Buổi hiển thị khối video "CLIP-TH01-S1" (quyền do giáo trình quyết)')
  await a.page.screenshot({ path: `${SHOTS}/clip-390-session.png` })

  // Tab "Lớp": FE hiện ghép social_class_activity theo từng lớp (KHÔNG gọi social_feed_scoped('my_classes')) → G3 không đổi hành vi tab này.
  // (Muốn thẻ Ôn nhanh ở tab Lớp cần thêm nguồn vào social_class_activity — thay đổi riêng, chưa nằm trong phạm vi được duyệt.)
  await a.page.goto(BASE + '/me?feed=classes', { waitUntil: 'networkidle0' })
  await a.page.waitForFunction(() => /Hoạt động từ các lớp/.test(document.body.innerText), { timeout: 20000, polling: 300 })
  assert.equal((await clips(a.page)).length, 0, 'tab Lớp: không thẻ Ôn nhanh (nguồn riêng, không đổi)')
  ok('Tab "Lớp" KHÔNG đổi hành vi (nguồn social_class_activity): không thẻ, không lỗi')
  await a.page.screenshot({ path: `${SHOTS}/clip-390-classes.png` })

  // C (lớp TH02): chỉ thấy thẻ của TH02, cả hai góc nhìn
  const c = await meAs('c@test.local')
  list = await clips(c.page)
  assert.equal(list.length, 1, 'C thấy đúng 1 thẻ: ' + JSON.stringify(list.map(x => x.text)))
  assert.match(list[0].text, /CLIP-TH02-S1/); assert.doesNotMatch(list[0].text, /CLIP-TH01/)
  assert.ok(c.feedBodies.every(b => !/CLIP-TH01/.test(b)), 'phản hồi RPC cho C không chứa tiêu đề clip TH01')
  ok('C (lớp TH02): chỉ thấy thẻ lớp mình ở Feed chung; phản hồi RPC không chứa clip lớp TH01')

  // B bị thu hồi quyền giáo trình (thao tác DB) sẽ được kiểm ở test DB; E2E kiểm hiển thị thật theo người
  assert.deepEqual(errors, [], 'không lỗi console/page: ' + errors.join(' | '))
  ok('Không có lỗi console/pageerror')
  console.log('══ E2E Ôn nhanh (G3): TẤT CẢ PASS')
} catch (e) {
  console.error('FAIL:', e.message); process.exitCode = 1
} finally { await browser.close() }
