// E2E Feed "Dành cho bạn": thẻ "Bài mới phát hành" của Band (TeamLab) — xem scripts/e2e-learning-thread.sh
// (E2E_CHECKPOINTS=1 E2E_SKIP_BASE=1 E2E_EXTRA_SQL=<fixture+migration+seed> E2E_EXTRA_RUNNER=<file này>).
// Seed: 2 bài published (một có Band + bìa, một không Band), 1 bài đã gỡ.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const ME = `http://class.localhost:${process.env.VITE_PORT}/me`
const SHOTS = process.env.SHOTS
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
  await page.setRequestInterception(true)
  page.on('request', r => {
    if (/\/storage\/v1\/object\/public\/teamlab-team-avatars\//.test(r.url())) r.respond({ status: 200, contentType: 'image/jpeg', body: JPG })
    else r.continue()
  })
  page.on('pageerror', e => errors.push(`${email} pageerror: ` + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource/.test(m.text())) errors.push(`${email} console: ` + m.text()) })
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
    text: e.textContent, href: e.querySelector('a.cs-pub-open')?.getAttribute('href'), cover: !!e.querySelector('img.cs-pub-cover'),
    author: e.querySelector('.cs-post-author')?.textContent,
  })))
  assert.equal(cards.length, 2, 'đúng 2 thẻ: mỗi publication đang published một thẻ, bài đã gỡ không có')
  assert.equal(cards[0].author, 'Mưa Thu Band'); assert.match(cards[0].text, /Đêm nàng giả bạn/); assert.match(cards[0].text, /Bài mới phát hành/)
  assert.equal(cards[0].href, '/teamlab/song/dem-nang-gia-ban'); assert.equal(cards[0].cover, true, 'có ảnh bìa hợp lệ của đúng project')
  assert.equal(cards[1].author, 'Team Gió', 'không có Band → tên project'); assert.equal(cards[1].href, '/teamlab/song/bai-cua-gio'); assert.equal(cards[1].cover, false)
  assert.equal(cards.some(c => /Bài đã gỡ/.test(c.text)), false, 'bài unpublished không hiện')
  ok('Dành cho bạn: 2 thẻ phát hành (mới nhất trước), tên Band/Project, bìa, link /teamlab/song/<slug>; bài đã gỡ không hiện')
  assert.equal(await page.$$eval('.cs-pub-card [class*="take"], .cs-pub-card [class*="track"]', e => e.length), 0)
  await noHScroll(page, 'Feed + thẻ phát hành 390px')
  await page.screenshot({ path: `${SHOTS}/pub-390.png`, fullPage: false })
  // bấm "Nghe bài" → đi tới đúng đường dẫn công khai
  await page.click('.cs-pub-card a.cs-pub-open')
  await page.waitForFunction(() => location.pathname === '/teamlab/song/dem-nang-gia-ban', { timeout: 10000 })
  ok('Bấm "Nghe bài" → điều hướng đúng /teamlab/song/dem-nang-gia-ban')
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
