// E2E Feed Likes V1 — xem scripts/e2e-feed-likes.sh. iPhone 390px, Light Mode.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const ME = `http://class.localhost:${process.env.VITE_PORT}/me`
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run'] })
const ok = m => console.log('PASS: ' + m)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const errors = []

async function meAs(email, width = 390) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: width < 600, hasTouch: width < 600 })
  await page.setBypassServiceWorker(true)
  page.on('pageerror', e => errors.push(`${email} pageerror: ` + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource|^WebSocket/.test(m.text())) errors.push(`${email} console: ` + m.text()) })
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', email); await page.type('#cs-login-pass', 'e2e')
  await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  await page.waitForSelector('.cs-likebar-btn', { timeout: 20000 })
  return { ctx, page }
}
const bars = page => page.$$eval('.cs-likebar', els => els.map(e => ({
  kind: e.getAttribute('data-kind'), on: e.querySelector('.cs-likebar-btn').getAttribute('aria-pressed') === 'true',
  label: e.querySelector('.cs-likebar-btn').textContent.trim(), count: e.querySelector('.cs-likebar-count')?.textContent ?? '',
  h: Math.round(e.querySelector('.cs-likebar-btn').getBoundingClientRect().height),
})))

try {
  const b = await meAs('b@test.local')
  let list = await bars(b.page)
  const kinds = new Set(list.map(x => x.kind))
  assert.ok(kinds.has('post') && kinds.has('teamlab_publication'), 'thanh Thích có trên bài Social và bài TeamLab: ' + [...kinds])
  assert.ok(list.every(x => x.h >= 44), 'nút Thích cao ≥ 44px (iOS HIG)')
  assert.ok(list.every(x => !x.on && x.count === ''), 'ban đầu chưa ai thích')
  ok('Feed 390px: thanh Thích trên ' + [...kinds].join(' / ') + '; nút ≥44px; chưa ai thích')
  const [sw, iw] = await b.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(sw <= iw + 1); ok('không tràn ngang')
  assert.equal(await b.page.evaluate(() => /Bình luận\b.*Chia sẻ\s*$/.test([...document.querySelectorAll('.cs-likebar')].map(e => e.textContent).join(''))), false)

  // Thích bài TeamLab (không loại trừ tài nguyên chia sẻ) — bấm liên tiếp 3 lần (thích → bỏ → thích): kết quả cuối = đã thích, đúng 1 lượt
  const pubBtn = '.cs-pub-card .cs-likebar-btn'
  await b.page.waitForSelector(pubBtn)
  for (let i = 0; i < 3; i++) await b.page.click(pubBtn)
  await b.page.waitForFunction(() => document.querySelector('.cs-pub-card .cs-likebar-count')?.textContent === '1 lượt thích', { timeout: 10000, polling: 200 })
  assert.equal(await b.page.$eval(pubBtn, e => e.getAttribute('aria-pressed')), 'true')
  assert.equal(await b.page.$eval(pubBtn, e => e.textContent.trim()), 'Đã thích')
  ok('Thích thẻ TeamLab bấm liên tiếp 3 lần → Đã thích, 1 lượt thích')
  await b.page.screenshot({ path: `${SHOTS}/like-390-on.png` })

  // Thích bài Social
  await b.page.click('article.cs-post:not(.cs-pub-card) .cs-likebar-btn')
  await b.page.waitForFunction(() => /1 lượt thích/.test(document.querySelector('article.cs-post:not(.cs-pub-card) .cs-likebar')?.textContent ?? ''), { timeout: 10000, polling: 200 })
  ok('Thích bài Social → 1 lượt thích')

  // Tải lại trang: trạng thái còn nguyên từ DB (đồng bộ thiết bị/app khác dùng cùng DB)
  await b.page.reload({ waitUntil: 'networkidle0' }); await b.page.waitForSelector('.cs-likebar-btn')
  await b.page.waitForFunction(() => document.querySelector('.cs-pub-card .cs-likebar-btn')?.getAttribute('aria-pressed') === 'true', { timeout: 10000, polling: 200 })
  ok('Tải lại: lượt thích còn nguyên (đọc từ DB)')

  // Người thứ hai: thấy 1 lượt, chưa thích; thích → 2; không thể trùng
  const c = await meAs('c@test.local')
  await c.page.waitForFunction(() => document.querySelector('.cs-pub-card .cs-likebar-count')?.textContent === '1 lượt thích', { timeout: 10000, polling: 200 })
  assert.equal(await c.page.$eval(pubBtn, e => e.getAttribute('aria-pressed')), 'false')
  await c.page.click(pubBtn)
  await c.page.waitForFunction(() => document.querySelector('.cs-pub-card .cs-likebar-count')?.textContent === '2 lượt thích', { timeout: 10000, polling: 200 })
  ok('Người thứ hai thấy 1 lượt (chưa thích), thích → 2 lượt')

  // Lỗi mạng: tắt mạng → bấm → báo lỗi, hoàn về trạng thái cũ
  await c.page.setOfflineMode(true)
  await c.page.click(pubBtn)
  await c.page.waitForSelector('.cs-likebar-err', { timeout: 10000, polling: 200 })
  assert.equal(await c.page.$eval(pubBtn, e => e.getAttribute('aria-pressed')), 'true', 'giữ trạng thái đã xác nhận')
  assert.match(await c.page.$eval('.cs-likebar-err', e => e.textContent), /mạng|Chưa lưu/)
  ok('Mất mạng: báo lỗi ngắn, trạng thái đã xác nhận không đổi')
  await c.page.setOfflineMode(false)
  await c.page.screenshot({ path: `${SHOTS}/like-390-err.png` })

  // Ngoài Class: không có thanh Thích (và không lỗi)
  assert.deepEqual(errors, [], 'không lỗi console/page: ' + errors.join(' | '))
  ok('Không có lỗi console/pageerror')
  console.log('══ E2E Feed Likes: TẤT CẢ PASS')
} catch (e) {
  console.error('FAIL:', e.message); process.exitCode = 1
} finally { await browser.close() }
