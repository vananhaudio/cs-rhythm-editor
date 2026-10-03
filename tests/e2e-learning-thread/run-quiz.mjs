// E2E QUIZ CHECKPOINT V1 trong Chrome thật — chạy bởi scripts/e2e-quiz-checkpoint.sh (stack LOCAL, không production).
// Buổi 02 thật của SOLO01 nạp vào Buổi 2 của SOLO01.TH01 fixture; B đã xong Buổi 1. ĐÁP ÁN đọc từ file PRIVATE
// (E2E_QUIZ_ANSWERS) — file này không chứa đáp án nào.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ME = `http://class.localhost:${V}/me`
const TH01 = 'b1000000-0000-4000-8000-000000000001'
const SHOTS = process.env.SHOTS
const ANSWERS = JSON.parse(readFileSync(process.env.E2E_QUIZ_ANSWERS, 'utf8'))   // { "2.1": [...], "2.2": [...] }
mkdirSync(SHOTS, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
})
let pass = 0
const ok = msg => { pass++; console.log('PASS: ' + msg) }
const errors = []
async function ctxPage(width = 390) {
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
async function meAs(email, path = '', width = 390) {
  const { ctx, page } = await ctxPage(width)
  await page.goto(ME + path, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', email)
  await page.type('#cs-login-pass', 'e2e')
  await page.click('.cs-guest-submit')
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
const cp = id => `#bai-tra-${id.replace('.', '\\.')}`
const cpText = (page, id) => page.$eval(cp(id), e => e.textContent)
const optionIds = (page, id) => page.$$eval(`${cp(id)} .cs-quiz-opt input`, xs => xs.map(x => x.value))
async function choose(page, id, ids) {
  for (const v of ids) await page.click(`${cp(id)} .cs-quiz-opt input[value="${v}"]`)
}
async function check(page, id) {
  await clickText(page, 'Kiểm tra', 'button', cp(id))
  await page.waitForFunction(s => { const t = document.querySelector(s)?.textContent ?? ''; return /Chưa đúng — thử lại\.|Đạt/.test(t) }, { timeout: 15000 }, cp(id))
  return /Chưa đúng — thử lại\./.test(await cpText(page, id)) ? 'wrong' : 'right'
}
async function retry(page, id) { await clickText(page, 'Thử lại', 'button', cp(id)) }

let page = null, ctx = null
try {
  // ── 1. B mở Trang Buổi 02: 2.1 một đáp án (radio) · 2.2 nhiều đáp án (checkbox) · 2.3 video + chữ (TRẢ BÀI) ──
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}/sessions/2`))
  await page.waitForSelector(`${cp('2.1')} .cs-quiz`, { timeout: 20000 })
  assert.match(await cpText(page, '2.1'), /Khi luyện ép ngón i–m, cách nào đúng\?/)
  assert.equal((await page.$$(`${cp('2.1')} input[type="radio"]`)).length, 4)
  assert.equal((await page.$$(`${cp('2.2')} input[type="checkbox"]`)).length, 5)
  assert.match(await cpText(page, '2.2'), /Chọn tất cả đáp án đúng/)
  assert.match(await cpText(page, '2.3'), /TRẢ BÀI/)
  assert.equal(await page.$eval(`${cp('2.1')} .lt-actions button`, b => b.disabled), true, 'chưa chọn → Kiểm tra khoá')
  const videoCps = await page.$$eval('.lsn-cp .lsn-cp-meta', ps => ps.filter(p => /link video/.test(p.textContent)).length)
  assert.equal(videoCps, 1, 'Buổi 02 chỉ MỘT bài trả có video')
  assert.match(await page.$eval('.cs-learn-status', e => e.textContent), /0\/3 bài trả bắt buộc đã Đạt/)
  ok('Trang Buổi 02 (390): 2.1 trắc nghiệm 4 lựa chọn (radio) · 2.2 5 lựa chọn (checkbox) · 2.3 TRẢ BÀI video · chỉ 1 video · 0/3 Đạt')
  await noHorizontalOverflow(page, 'Trang Buổi 02 có trắc nghiệm 390px')

  // ── 2. 2.1: sai → "Chưa đúng — thử lại" + gợi ý → Thử lại → đúng → ✓ Đạt ──
  const o21 = await optionIds(page, '2.1')
  const wrong21 = o21.find(x => !ANSWERS['2.1'].includes(x))
  await choose(page, '2.1', [wrong21])
  assert.equal(await check(page, '2.1'), 'wrong')
  assert.match(await cpText(page, '2.1'), /Hãy nhớ nguyên tắc nền của Buổi 02/)
  await page.screenshot({ path: `${SHOTS}/quiz-21-wrong-390.png`, fullPage: false })
  ok('2.1 chọn sai → "Chưa đúng — thử lại." + gợi ý, không Đạt')
  await retry(page, '2.1')
  assert.equal(await page.$$eval(`${cp('2.1')} input:checked`, x => x.length), 0, 'Thử lại → bỏ chọn')
  await choose(page, '2.1', ANSWERS['2.1'])
  assert.equal(await check(page, '2.1'), 'right')
  assert.equal((await page.$$(`${cp('2.1')} input[type="radio"]`)).length, 0, 'Đạt → không còn lựa chọn')
  ok('2.1 Thử lại → chọn đúng → ✓ Đạt ngay')

  // ── 3. 2.2: thiếu → sai · thừa → sai · đúng cả tập → ✓ Đạt ──
  const o22 = await optionIds(page, '2.2')
  const extra22 = o22.find(x => !ANSWERS['2.2'].includes(x))
  await choose(page, '2.2', ANSWERS['2.2'].slice(0, -1))
  assert.equal(await check(page, '2.2'), 'wrong'); await retry(page, '2.2')
  ok('2.2 thiếu một lựa chọn → sai')
  await choose(page, '2.2', [...ANSWERS['2.2'], extra22])
  assert.equal(await check(page, '2.2'), 'wrong'); await retry(page, '2.2')
  ok('2.2 thừa một lựa chọn → sai')
  await choose(page, '2.2', ANSWERS['2.2'])
  assert.equal(await check(page, '2.2'), 'right')
  ok('2.2 đúng cả tập → ✓ Đạt')
  await page.waitForFunction(() => /2\/3 bài trả bắt buộc đã Đạt/.test(document.querySelector('.cs-learn-status')?.textContent ?? ''), { timeout: 15000 })
  ok('Trạng thái buổi: 2/3 bài trả bắt buộc đã Đạt (chờ 2.3)')

  // ── 4. Tải lại → vẫn ✓ Đạt (server nhớ, không phải trạng thái tạm) ──
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector(`${cp('2.1')} .cs-quiz.is-passed`, { timeout: 15000 })
  await page.waitForSelector(`${cp('2.2')} .cs-quiz.is-passed`, { timeout: 15000 })
  ok('Tải lại Trang Buổi 02: 2.1 + 2.2 vẫn ✓ Đạt')
  await page.screenshot({ path: `${SHOTS}/quiz-passed-390.png`, fullPage: true })
  await ctx.close()

  // ── 5. Trang lớp (1280, master-detail): Bài trả của tôi = 2/3 Đạt · 2.1 Đạt · 2.2 Đạt · 2.3 Chưa trả (không "Chờ Thầy") ──
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`, 1280))
  await page.waitForSelector('.cs-learnmap.is-split .cs-subs-panel', { timeout: 15000 })
  await page.waitForFunction(() => /Buổi 02/.test(document.querySelector('.cs-subs-panel')?.textContent ?? ''), { timeout: 15000 })
  const panel = await page.$eval('.cs-subs-panel', e => e.textContent)
  assert.match(panel, /2\/3 Đạt/)
  const items = await page.$$eval('.cs-subs-panel .cs-map-cp', bs => bs.map(b => b.textContent))
  assert.ok(/2\.1[\s\S]*Đạt/.test(items[0]) && /2\.2[\s\S]*Đạt/.test(items[1]) && /2\.3[\s\S]*Chưa trả/.test(items[2]), JSON.stringify(items))
  assert.doesNotMatch(items.slice(0, 2).join('|'), /Chờ Thầy/)
  assert.match(await page.$eval('#buoi-02 .cs-map-meta', e => e.textContent), /2\/3 bài trả Đạt/)
  ok('Trang lớp 1280: mục lục "2/3 bài trả Đạt" · panel Bài trả của tôi: 2.1 Đạt · 2.2 Đạt · 2.3 Chưa trả')
  await page.$$eval('.cs-subs-panel .cs-map-cp', bs => bs[0].click())
  await page.waitForFunction(id => location.pathname === `/me/classes/${id}/sessions/2`, {}, TH01)
  ok('Bấm trắc nghiệm đã Đạt trong panel → Trang Buổi tại đúng bài trả (không có cuộc trao đổi)')
  await page.goto(`${ME}/classes/${TH01}/space`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-classspace', { timeout: 15000 })
  await new Promise(r => setTimeout(r, 800))
  assert.doesNotMatch(await page.$eval('.cs-classspace', e => e.textContent), /Bài trả 2\.1|Bài trả 2\.2/)
  ok('Không gian lớp: KHÔNG có trắc nghiệm 2.1 / 2.2')
  await ctx.close()

  // ── 6. 2.3: B trả video + chữ → Chờ Thầy ──
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}/sessions/2`))
  await page.waitForSelector(cp('2.3'), { timeout: 20000 })
  await clickText(page, 'TRẢ BÀI', 'button', cp('2.3'))
  await page.waitForSelector(`${cp('2.3')} .lt-compose`)
  await page.type(`${cp('2.3')} input[type="url"]`, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await page.type(`${cp('2.3')} textarea`, '3 chỗ Bass còn làm đứt câu: ô 3, ô 7, ô 12.')
  await clickText(page, 'Gửi bài', 'button', cp('2.3'))
  await page.waitForFunction(s => /Đã trả · Chờ chấm/.test(document.querySelector(s)?.textContent ?? ''), { timeout: 15000 }, cp('2.3'))
  ok('2.3 trả video + chữ → "Đã trả · Chờ chấm"')
  await ctx.close()

  // ── 7. Thầy: Hàng đợi chỉ có 2.3 (không trắc nghiệm) → chấm Đạt ──
  ;({ ctx, page } = await meAs('t@test.local', '', 1280))
  await page.waitForSelector('.cs-share', { timeout: 15000 })
  await page.goto(`${ME}/queue`, { waitUntil: 'networkidle0' })
  await waitText(page, /Bài trả 2\.3/)
  const queue = await page.evaluate(() => document.body.textContent)
  assert.doesNotMatch(queue, /Bài trả 2\.1|Bài trả 2\.2/)
  ok('Hàng đợi Thầy: có Bài trả 2.3, KHÔNG có trắc nghiệm 2.1 / 2.2')
  const link = await page.evaluateHandle(() => [...document.querySelectorAll('a, button')].find(e => /Bài trả 2\.3/.test(e.textContent ?? '')))
  await link.asElement().click()
  await page.waitForFunction(() => location.pathname.startsWith('/me/t/'), { timeout: 15000 })
  await page.waitForSelector('.lt-compose[aria-label="Thầy phản hồi"] textarea', { timeout: 15000 })
  await page.type('.lt-compose[aria-label="Thầy phản hồi"] textarea', 'Bass đã không làm đứt câu. Đạt.')
  await clickText(page, 'Đạt')
  await waitText(page, /Đã đạt/)
  ok('Thầy chấm 2.3 Đạt')
  await ctx.close()

  // ── 8. 3/3 Đạt → Buổi 02 Hoàn thành → Buổi 03 MỞ ──
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`, 1280))
  await page.waitForSelector('.cs-map', { timeout: 15000 })
  for (const b of await page.$$('.cs-map-stage-toggle[aria-expanded="false"]')) await b.click()
  await page.waitForFunction(() => /Hoàn thành/.test(document.querySelector('#buoi-02 .cs-map-meta')?.textContent ?? ''), { timeout: 15000 })
  assert.match(await page.$eval('#buoi-02 .cs-map-meta', e => e.textContent), /3\/3 bài trả Đạt/)
  assert.equal(await page.$eval('#buoi-03', e => e.classList.contains('is-locked')), false, 'Buổi 03 đã mở')
  ok('3/3 Đạt (2 trắc nghiệm + video) → Buổi 02 Hoàn thành · Buổi 03 MỞ')
  await page.screenshot({ path: `${SHOTS}/quiz-class-1280.png`, fullPage: false })
  await noHorizontalOverflow(page, 'Trang lớp sau Buổi 02 1280px')
  await ctx.close()

  assert.deepEqual(errors, [], 'lỗi JS: ' + errors.join(' | '))
  ok('Không lỗi JavaScript')
  console.log(`\nALL QUIZ E2E PASS (${pass})`)
} catch (e) {
  console.log('FAIL: ' + e.message)
  if (page) await page.screenshot({ path: `${SHOTS}/quiz-FAIL.png`, fullPage: true }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
