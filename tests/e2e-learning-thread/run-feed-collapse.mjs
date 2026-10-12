// E2E Facebook-style Expand/Collapse trong Chrome thật — xem scripts/e2e-feed-collapse.sh.
// A = học sinh (xem feed /me). Dữ liệu: 5 bài (0/1/2/10/35 bình luận; 1 bài rất dài; 1 bài có "từ" dài không dấu cách).
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

async function openAs(width) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push(`${width} pageerror: ` + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource/.test(m.text())) errors.push(`${width} console: ` + m.text()) })
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', 'a@test.local'); await page.type('#cs-login-pass', 'e2e')
  await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  await page.waitForFunction(() => document.body.innerText.includes('FCSHORT'), { timeout: 20000 })
  await page.waitForFunction(() => document.body.innerText.includes('FCT'), { timeout: 20000 })   // bình luận tải theo lô
  return page
}
// Thông tin một bài theo nhãn nội dung
const post = (page, marker) => page.evaluate(m => {
  const art = [...document.querySelectorAll('article.cs-post')].find(a => a.innerText.includes(m))
  if (!art) return null
  const body = art.querySelector('.cs-post-body')
  const tg = art.querySelector('.cs-post-note .cs-clamp-toggle')
  return {
    clampedNow: !!body?.classList.contains('is-clamped'), bodyH: body?.clientHeight ?? 0, bodyScrollH: body?.scrollHeight ?? 0,
    toggle: tg?.textContent.trim() ?? null, expanded: tg?.getAttribute('aria-expanded') ?? null,
    cmts: [...art.querySelectorAll('.cs-cmt')].map(c => c.querySelector('.cs-cmt-body')?.textContent.trim().slice(0, 12)),
    more: art.querySelector('.cs-cmts-more')?.textContent.trim() ?? null,
    cmtToggles: [...art.querySelectorAll('.cs-cmt .cs-clamp-toggle')].map(b => b.textContent.trim()),
  }
}, marker)
const noHScroll = (page, label) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1).then(v => { assert.ok(v, `${label}: tràn ngang`); ok(`${label}: không tràn ngang`) })
const clickIn = async (page, marker, sel, text) => {
  const h = await page.evaluateHandle((m, s, t) => {
    const art = [...document.querySelectorAll('article.cs-post')].find(a => a.innerText.includes(m))
    return [...art.querySelectorAll(s)].find(b => !t || b.textContent.trim().startsWith(t))
  }, marker, sel, text)
  await h.asElement().click()
}

let round = 0   // lượt 2 chạy trên DB đã có bình luận mới gửi ở lượt 1 → số bình luận nền cộng thêm
for (const width of [390, 1280]) {
  const base = round++
  const W = `[${width}px]`
  const page = await openAs(width)

  // 1. Bài ngắn: không nút, không cắt
  let p = await post(page, 'FCSHORT')
  assert.equal(p.toggle, null); assert.equal(p.cmts.length, base); assert.equal(p.more, null)
  ok(`${W} bài ngắn ${base} bình luận: không "Xem thêm" (bài), không "Xem thêm bình luận"`)

  // 2. Bài dài: thu gọn + Xem thêm; mở → đủ nội dung; Thu gọn → lại gọn; vị trí đầu bài không nhảy
  p = await post(page, 'FCLONG')
  assert.equal(p.toggle, 'Xem thêm'); assert.ok(p.clampedNow && p.bodyScrollH > p.bodyH + 20, `bài dài phải bị cắt (${p.bodyH}/${p.bodyScrollH})`)
  assert.ok(p.bodyH < 220, `bài dài thu gọn phải ≤ ~6 dòng (${p.bodyH}px)`)
  ok(`${W} bài dài mặc định thu gọn (${p.bodyH}px / ${p.bodyScrollH}px) có "Xem thêm"`)
  assert.equal(p.cmts.length, 1)
  const top = () => page.evaluate(() => [...document.querySelectorAll('article.cs-post')].find(a => a.innerText.includes('FCLONG')).getBoundingClientRect().top + window.scrollY)   // toạ độ tuyệt đối trong trang (Puppeteer tự cuộn tới nút khi bấm)
  const t0 = await top()
  await clickIn(page, 'FCLONG', '.cs-post-note .cs-clamp-toggle')
  await sleep(150)
  p = await post(page, 'FCLONG')
  assert.equal(p.toggle, 'Thu gọn'); assert.equal(p.expanded, 'true'); assert.ok(!p.clampedNow && p.bodyH >= p.bodyScrollH - 1, 'mở phải thấy toàn bộ')
  const t1 = await top()
  const sy = await page.evaluate(() => [window.scrollY, document.scrollingElement.scrollTop, document.scrollingElement.scrollHeight])
  assert.ok(Math.abs(t1 - t0) <= 2, `đầu bài (toạ độ trang) nhảy ${t0}→${t1}, scroll ${sy}`)
  ok(`${W} "Xem thêm" mở toàn bộ nội dung; đầu bài không nhảy`)
  await page.screenshot({ path: `${SHOTS}/fc-${width}-expanded.png` })
  await clickIn(page, 'FCLONG', '.cs-post-note .cs-clamp-toggle')
  await sleep(150)
  p = await post(page, 'FCLONG')
  assert.equal(p.toggle, 'Xem thêm'); assert.ok(p.clampedNow); ok(`${W} "Thu gọn" quay lại dạng gọn`)

  // 3. Bài 2 bình luận: hiện cả 2, không "Xem thêm bình luận"; bình luận dài thu gọn + mở được
  p = await post(page, 'FCTWO')
  assert.equal(p.cmts.length, Math.min(3, 2 + base)); assert.equal(p.more, 2 + base > 3 ? `Xem thêm bình luận (${2 + base - 3})` : null); assert.deepEqual(p.cmtToggles, ['Xem thêm'])
  await clickIn(page, 'FCTWO', '.cs-cmt .cs-clamp-toggle')
  await sleep(100)
  p = await post(page, 'FCTWO')
  assert.deepEqual(p.cmtToggles, ['Thu gọn']); assert.equal(p.cmts.length, Math.min(3, 2 + base))
  ok(`${W} bài 2+ bình luận: bình luận dài thu gọn/mở được, đúng nhãn "Xem thêm bình luận"`)

  // 4. Bài 10 bình luận: 3 mới nhất → "Xem thêm bình luận (7)" → đủ 10, nút biến mất; thứ tự cũ → mới
  p = await post(page, 'FCTEN')
  assert.deepEqual(p.cmts, ['FCT08', 'FCT09', 'FCT10'].map(s => s)); assert.equal(p.more, 'Xem thêm bình luận (7)')
  await clickIn(page, 'FCTEN', '.cs-cmts-more')
  await page.waitForFunction(() => { const a = [...document.querySelectorAll('article.cs-post')].find(x => x.innerText.includes('FCTEN')); return a.querySelectorAll('.cs-cmt').length === 10 }, { timeout: 10000 })
  p = await post(page, 'FCTEN')
  assert.equal(p.more, null); assert.equal(p.cmts[0], 'FCT01'); assert.equal(p.cmts[9], 'FCT10')
  ok(`${W} bài 10 bình luận: 3 → Xem thêm (7) → đủ 10 theo thứ tự cũ→mới`)

  // 5. Bài 35 bình luận: theo từng đợt 10 (3 → 13 → 23 → 33 → 35)
  const counts = []
  p = await post(page, 'FCMANY'); counts.push(p.cmts.length)
  assert.equal(p.more, 'Xem thêm bình luận (32)')
  for (let i = 0; i < 4; i++) {
    const before = (await post(page, 'FCMANY')).cmts.length
    await clickIn(page, 'FCMANY', '.cs-cmts-more')
    await page.waitForFunction((m, n) => { const a = [...document.querySelectorAll('article.cs-post')].find(x => x.innerText.includes(m)); return a.querySelectorAll('.cs-cmt').length > n }, { timeout: 10000 }, 'FCMANY', before)
    counts.push((await post(page, 'FCMANY')).cmts.length)
    if (counts.at(-1) === 35) break
  }
  assert.deepEqual(counts, [3, 13, 23, 33, 35]); assert.equal((await post(page, 'FCMANY')).more, null)
  ok(`${W} bài 35 bình luận mở theo đợt: ${counts.join(' → ')}`)

  // 6. Gửi bình luận KHÔNG cần mở hết danh sách (bài 35 còn nguyên trạng thái đã mở; thử trên bài 10 chưa mở lại: dùng FCTWO)
  const inputSel = 'textarea.cs-cmt-input'
  const sendOn = async (marker, text) => {
    const h = await page.evaluateHandle(m => [...document.querySelectorAll('article.cs-post')].find(a => a.innerText.includes(m)).querySelector('textarea.cs-cmt-input'), marker)
    await h.asElement().type(text)
    const btn = await page.evaluateHandle(m => [...document.querySelectorAll('article.cs-post')].find(a => a.innerText.includes(m)).querySelector('.cs-cmt-send'), marker)
    await btn.asElement().click()
    await page.waitForFunction((m, t) => [...document.querySelectorAll('article.cs-post')].find(a => a.innerText.includes(m)).innerText.includes(t), { timeout: 10000 }, marker, text)
  }
  await sendOn('FCSHORT', `FCNEW1-${width}`)
  p = await post(page, 'FCSHORT'); assert.equal(p.cmts.length, Math.min(3, base + 1)); ok(`${W} gửi bình luận vào bài 0 bình luận: hiện ngay`)
  await sendOn('FCTWO', `FCNEW2-${width}`)
  p = await post(page, 'FCTWO'); assert.ok(p.cmts.length >= 3 && p.cmts.at(-1).startsWith('FCNEW2')); ok(`${W} gửi bình luận vào bài đang có: bình luận mới ở cuối, không mất bình luận cũ`)
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => document.body.innerText.includes('FCNEW2'), { timeout: 20000 })
  ok(`${W} tải lại: bình luận vừa gửi vẫn còn (không mất dữ liệu)`)

  // 7. Đăng bài mới (ngắn rồi dài) từ ô Chia sẻ
  const post_ = async (text) => {
    await page.click('.cs-share-input')
    await page.evaluate(t => { const el = document.querySelector('.cs-share-input'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
    await sleep(100)
    await clickText(page, 'Đăng')
  }
  const clickText = async (pg, label) => {
    const h = await pg.waitForFunction(l => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === l && !b.disabled && b.offsetParent !== null), { timeout: 10000 }, label)
    await h.asElement().click()
  }
  await post_(`FCPOSTSHORT-${width}`)
  await page.waitForFunction(m => document.body.innerText.includes(m), { timeout: 15000 }, `FCPOSTSHORT-${width}`)
  p = await post(page, `FCPOSTSHORT-${width}`); assert.equal(p.toggle, null); ok(`${W} đăng bài ngắn mới: hiện ngay, không "Xem thêm"`)
  await post_(`FCPOSTLONG-${width} ` + Array.from({ length: 30 }, (_, i) => `dòng ${i + 1} của bài đăng mới rất dài`).join('\n'))
  await page.waitForFunction(m => document.body.innerText.includes(m), { timeout: 15000 }, `FCPOSTLONG-${width}`)
  p = await post(page, `FCPOSTLONG-${width}`); assert.equal(p.toggle, 'Xem thêm'); ok(`${W} đăng bài dài mới: tự thu gọn có "Xem thêm"`)

  // 8. Không tràn ngang ở cả hai trạng thái; từ dài không dấu cách không làm vỡ bố cục
  await noHScroll(page, `${W} bảng tin`)
  await page.screenshot({ path: `${SHOTS}/fc-${width}-feed.png`, fullPage: false })
  await page.browserContext().close()
}
await browser.close()
assert.deepEqual(errors, [], 'console/page errors: ' + errors.join(' | '))
ok('không có lỗi console/pageerror')
console.log(`ALL FEED COLLAPSE E2E PASS (${pass})`)
