// E2E Feed "Dành cho bạn": thẻ "Bài mới phát hành" của Band (TeamLab) — xem scripts/e2e-learning-thread.sh
// (E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_EXTRA_SQL=<fixture+migration+seed> E2E_EXTRA_RUNNER=<file này>).
// Seed: 2 bài published (một có Band + bìa, một không Band), 1 bài đã gỡ.
import { createRequire } from 'node:module'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const ME = `http://class.localhost:${process.env.VITE_PORT}/me`
const SHOTS = process.env.SHOTS
// Bản build TeamLab (nhánh feat/public-embed) phục vụ dưới /teamlab/ của origin Class (giống production: cùng origin qua proxy).
const TL_DIST = process.env.TEAMLAB_DIST
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2' }
mkdirSync(SHOTS, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
})
let pass = 0
const ok = m => { pass++; console.log('PASS: ' + m) }
const errors = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64')

async function meAs(email, path = '', width = 390) {
  let ctx
  for (let i = 0; !ctx; i++) { try { ctx = await browser.createBrowserContext() } catch (e) { if (i > 3) throw e; await sleep(400) } }
  const page = await ctx.newPage()
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  await page.setBypassServiceWorker(true)   // sw.js (network-first) sẽ đi vòng qua interception → iframe /teamlab nhận app Class của Vite
  await page.setRequestInterception(true)
  page.on('request', r => {
    const u = new URL(r.url())
    if (/\/storage\/v1\/object\/public\/teamlab-team-avatars\//.test(r.url())) r.respond({ status: 200, contentType: 'image/jpeg', body: JPG })
    else if (TL_DIST && u.hostname === 'class.localhost' && u.pathname.startsWith('/teamlab/')) {
      let f = join(TL_DIST, u.pathname)
      if (!existsSync(f) || !extname(f)) f = join(TL_DIST, 'teamlab', 'index.html')
      r.respond({ status: 200, contentType: MIME[extname(f)] ?? 'application/octet-stream', body: readFileSync(f) })
    } else r.continue()
  })
  page.on('pageerror', e => errors.push(`${email} pageerror: ` + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource|^WebSocket connection to 'ws:\/\/class\.localhost|^%o$/.test(m.text())) errors.push(`${email} console: ` + m.text()) })
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', email); await page.type('#cs-login-pass', 'e2e')
  await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  if (path) await page.goto(ME + path, { waitUntil: 'networkidle0' })
  return { ctx, page }
}
const noHScroll = async (page, label) => {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  assert.ok(sw <= iw + 1, `${label}: tràn ngang ${sw} > ${iw}`); ok(`${label}: không tràn ngang`)
}

try {
  // 1. Feed mặc định "Dành cho bạn"
  let { ctx, page } = await meAs('b@test.local')
  await page.waitForSelector('.cs-pub-card', { timeout: 20000 })
  const cards = await page.$$eval('.cs-pub-card', els => els.map(e => ({
    text: e.textContent, href: e.querySelector('a.cs-pub-open')?.getAttribute('href'), band: e.querySelector('a.cs-pub-band')?.getAttribute('href') ?? null, iframes: e.querySelectorAll('iframe').length, cover: !!e.querySelector('img.cs-pub-cover'),
    author: e.querySelector('.cs-post-author')?.textContent,
  })))
  assert.equal(cards.length, 3, 'đúng 3 thẻ: mỗi publication đang published một thẻ, bài đã gỡ không có')
  assert.equal(cards[0].author, 'Mưa Thu Band'); assert.match(cards[0].text, /Đêm nàng giả bạn/); assert.match(cards[0].text, /Bài mới phát hành/)
  assert.equal(cards[0].href, '/teamlab/song/dem-nang-gia-ban'); assert.equal(cards[0].cover, true, 'có ảnh bìa hợp lệ của đúng project')
  assert.equal(cards[1].author, 'Team Gió', 'không có Band → tên project'); assert.equal(cards[1].href, '/teamlab/song/bai-cua-gio'); assert.equal(cards[1].cover, false)
  assert.equal(cards.some(c => /Bài đã gỡ/.test(c.text)), false, 'bài unpublished không hiện')
  ok('Dành cho bạn: 3 thẻ phát hành (mới nhất trước), tên Band/Project, bìa, link /teamlab/song/<slug>; bài đã gỡ không hiện')
  assert.equal(await page.$$eval('.cs-pub-card [class*="take"], .cs-pub-card [class*="track"]', e => e.length), 0)
  await noHScroll(page, 'Feed + thẻ phát hành 390px')
  await page.screenshot({ path: `${SHOTS}/pub-390.png`, fullPage: false })
  assert.equal(cards.every(c => c.iframes === 0), true, 'chưa bấm Nghe ngay → KHÔNG iframe/âm thanh nào được nạp khi cuộn Feed')
  assert.equal(cards[0].band, '/teamlab/band/mua-thu-band-1a2b3', 'Khám phá Band = slug Team từ server'); assert.equal(cards[1].band, null, 'Team không có slug → không nút Band')
  ok('Chưa bấm: 0 iframe; "Khám phá Band" chỉ khi có slug Team từ server')

  // Nghe ngay: nhúng nguyên Published Player công khai (bài thật trên production, chỉ đọc), mỗi lúc một bài
  const realIdx = cards.findIndex(c => c.href === '/teamlab/song/mua-thu-cho-em-1a093')
  assert.ok(realIdx >= 0, 'có thẻ bài thật')
  const handles = await page.$$('.cs-pub-card')
  const realCard = handles[realIdx]
  await (await realCard.$('button.cs-pub-listen')).click()
  await page.waitForSelector('.cs-pub-card iframe.cs-pub-frame', { timeout: 15000 })
  const frameEl = await realCard.$('iframe.cs-pub-frame')
  assert.match(await frameEl.evaluate(e => e.getAttribute('src')), /^\/teamlab\/song\/mua-thu-cho-em-1a093\?embed=1$/)
  const frame = await frameEl.contentFrame()
  const playSel = 'button[aria-label="Phát Mùa thu cho em"]:not([disabled])'
  await frame.waitForSelector(playSel, { timeout: 30000 }).catch(async e => { throw new Error(e.message + ' | frame: ' + (await frame.evaluate(() => location.href + ' :: ' + document.body.innerText.slice(0, 300)).catch(x => 'ERR ' + x.message)) + ' | errors: ' + errors.join(' ; ')) })
  assert.equal(await frame.evaluate(() => !!document.querySelector('header,footer,[data-testid=public-home-login]')), false, 'iframe chỉ có player, không khung TeamLab')
  await frame.click(playSel)
  await frame.waitForSelector('button[aria-label^="Tạm dừng"]', { timeout: 20000 })
  const clock = () => frame.evaluate(() => document.body.innerText.match(/(\d+):(\d\d)\s*\/\s*(\d+):(\d\d)/)?.slice(1, 3).map(Number))
  await sleep(1500); const c1 = await clock(); await sleep(2500); const c2 = await clock()
  assert.ok(c2[0] * 60 + c2[1] > c1[0] * 60 + c1[1], `đồng hồ chạy ${c1} → ${c2}`)
  ok('Nghe ngay: nhúng Published Player thật, Play → đồng hồ chạy ' + c1.join(':') + ' → ' + c2.join(':'))
  await frame.click('button[aria-label^="Tạm dừng"]')
  await sleep(1000); const p1 = await clock(); await sleep(1500); const p2 = await clock()
  assert.deepEqual(p1, p2, 'Pause: đồng hồ đứng yên')
  ok('Pause hoạt động trong iframe')
  const fh = await frameEl.evaluate(e => e.getBoundingClientRect().height)
  assert.ok(fh >= 96 && fh <= 640, 'chiều cao iframe theo nội dung (' + fh + ')')
  await noHScroll(page, 'Feed + player nhúng 390px')
  await page.screenshot({ path: `${SHOTS}/pub-embed-390.png`, fullPage: false })
  // mở bài khác → bài cũ đóng (mỗi lúc một bài)
  await (await handles[0].$('button.cs-pub-listen')).click()
  await page.waitForFunction(() => document.querySelectorAll('.cs-pub-card iframe').length === 1, { timeout: 10000 })
  assert.equal(await page.$$eval('.cs-pub-card', els => els.map(e => e.querySelectorAll('iframe').length)).then(a => a.join()), '1,0,0')
  ok('Mở bài khác → iframe bài cũ bị gỡ (một bài tại một thời điểm)')
  await (await handles[0].$('button.cs-pub-close')).click()
  await page.waitForFunction(() => document.querySelectorAll('.cs-pub-card iframe').length === 0, { timeout: 5000 })
  ok('Đóng trình phát → iframe gỡ, nút Nghe ngay quay lại')
  assert.ok(await handles[0].$('button.cs-pub-listen'))

  // Chia sẻ: dùng Web Share nếu có (bản sao liên kết công khai đúng slug), không tạo bài đăng
  await page.evaluate(() => { window.__shared = null; navigator.share = async d => { window.__shared = d } })
  await (await handles[0].$('button.cs-pub-share')).click()
  await sleep(300)
  const shared = await page.evaluate(() => window.__shared)
  assert.equal(shared.url, 'https://class.vananhaudio.com/teamlab/song/dem-nang-gia-ban')
  ok('Chia sẻ: đúng liên kết công khai của bài')

  // "Xem bài hát" → đi tới đúng đường dẫn công khai
  await (await handles[0].$('a.cs-pub-open')).click()
  await page.waitForFunction(() => location.pathname === '/teamlab/song/dem-nang-gia-ban', { timeout: 10000 })
  ok('Bấm "Xem bài hát" → điều hướng đúng /teamlab/song/dem-nang-gia-ban')
  await ctx.close()

  // 2. Chỉ ở "Dành cho bạn": tab Lớp / Bạn bè không có thẻ
  ;({ ctx, page } = await meAs('b@test.local', '?feed=friends'))
  await page.waitForSelector('.cs-feed', { timeout: 15000 })
  await sleep(800)
  assert.equal(await page.$$eval('.cs-pub-card', e => e.length), 0, 'Bạn bè: không thẻ phát hành')
  await page.goto(`${ME}?feed=classes`, { waitUntil: 'networkidle0' }); await sleep(800)
  assert.equal(await page.$$eval('.cs-pub-card', e => e.length), 0, 'Lớp: không thẻ phát hành')
  ok('Tab Bạn bè / Lớp không có thẻ phát hành (chỉ Dành cho bạn)')
  await ctx.close()

  // 3. Responsive
  for (const w of [320, 768, 1280, 1600]) {
    ;({ ctx, page } = await meAs('b@test.local', '', w))
    await page.waitForSelector('.cs-pub-card', { timeout: 20000 })
    await noHScroll(page, `Feed + thẻ phát hành ${w}px`)
    if (w === 1280) await page.screenshot({ path: `${SHOTS}/pub-1280.png`, fullPage: false })
    await ctx.close()
  }
  assert.deepEqual(errors, [], 'không pageerror/console error: ' + errors.join(' | '))
  ok('0 pageerror / console error')
  console.log(`E2E TEAMLAB PUBLICATIONS: ${pass} PASS`)
} catch (e) {
  console.error('FAIL: ' + e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
