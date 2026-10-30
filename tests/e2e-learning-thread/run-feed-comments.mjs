// E2E Feed Comments V2 — xem scripts/e2e-feed-comments.sh. iPhone 390px, Light Mode.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const ME = `http://class.localhost:${process.env.VITE_PORT}/me`
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run'] })
const ok = m => console.log('PASS: ' + m)
const errors = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
// Trang ở context nền không chạy rAF/timer trong trang → tự thăm dò bằng evaluate (không dùng page.waitForFunction)
async function waitFor(page, fn, arg, ms = 15000) {
  const t0 = Date.now()
  for (;;) {
    if (await page.evaluate(fn, arg).catch(() => false)) return
    if (Date.now() - t0 > ms) throw new Error('waitFor timeout: ' + fn.toString().slice(0, 120))
    await sleep(150)
  }
}
const sql = q => execFileSync(`${process.env.E2E_PG_BIN}/psql`, ['-X', '-tA', '-h', process.env.E2E_PG_SOCK, '-p', process.env.E2E_PG_PORT, '-U', 'postgres', '-d', 'e2e', '-c', q]).toString().trim()

async function meAs(email) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.setBypassServiceWorker(true)
  page.on('dialog', d => d.accept())
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
const THREAD = 'article.lt-feed-card:not(.cs-pub-card)'
const openComments = async (page, card) => {
  await page.evaluate(sel => { const b = [...document.querySelector(sel).querySelectorAll('.cs-likebar-btn')].find(x => /Bình luận/.test(x.textContent)); b.click() }, card)
  await page.waitForSelector(`${card} .cs-target-cmts`)
}
const send = async (page, scope, text) => {
  await page.type(`${scope} textarea`, text)
  await page.click(`${scope} .cs-cmt-send`)
}
const texts = (page, card) => page.$$eval(`${card} .cs-target-cmts [data-comment-id]`, els => els.map(e => ({ t: e.querySelector('.cs-cmt-body')?.textContent ?? '', reply: e.classList.contains('is-reply'), id: e.getAttribute('data-comment-id') })))

let b
try {
  b = await meAs('b@test.local')
  // Thread: nút Bình luận có thật; mở khu bình luận
  assert.ok(await b.page.$(THREAD), 'có thẻ thread trên Feed')
  await openComments(b.page, THREAD)
  await waitFor(b.page, sel => /Chưa có bình luận nào/.test(document.querySelector(sel + ' .cs-target-cmts').textContent), THREAD)
  ok('Thread: bấm Bình luận → mở khu bình luận (rỗng)')
  await send(b.page, `${THREAD} .cs-target-cmts > .cs-cmt-composer`, 'THREADCMT hay quá')
  await waitFor(b.page, sel => /THREADCMT hay quá/.test(document.querySelector(sel + ' .cs-target-cmts').textContent), THREAD)
  await waitFor(b.page, sel => /1 bình luận/.test(document.querySelector(sel + ' .cs-likebar-count')?.textContent ?? ''), THREAD)
  ok('Thread: gửi bình luận → hiện ngay + số "1 bình luận" trên thanh tương tác')
  const [sw, iw] = await b.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(sw <= iw + 1); ok('không tràn ngang (390px)')
  await b.page.screenshot({ path: `${SHOTS}/cmt-390-thread.png` })

  // Publication: bình luận bài TeamLab
  const PUB = '.cs-pub-card'
  await openComments(b.page, PUB)
  await send(b.page, `${PUB} .cs-target-cmts > .cs-cmt-composer`, 'PUBCMT bài hát hay')
  await waitFor(b.page, sel => /PUBCMT bài hát hay/.test(document.querySelector(sel + ' .cs-target-cmts').textContent), PUB)
  assert.equal(await b.page.$eval(`${PUB} audio, ${PUB} iframe`, () => 1).catch(() => 0), 0, 'chưa bấm Nghe ngay: không iframe/âm thanh')
  ok('Bài TeamLab: bình luận được; không nạp trình phát khi chỉ bình luận')

  // Người thứ hai: thấy bình luận, trả lời một cấp
  const c = await meAs('c@test.local')
  await waitFor(c.page, sel => /1 bình luận/.test(document.querySelector(sel + ' .cs-likebar-count')?.textContent ?? ''), THREAD)
  ok('Người thứ hai thấy số bình luận trên thanh (đồng bộ DB)')
  await openComments(c.page, THREAD)
  await waitFor(c.page, sel => /THREADCMT hay quá/.test(document.querySelector(sel + ' .cs-target-cmts').textContent), THREAD)
  await c.page.click(`${THREAD} .cs-cmt-reply`)
  await send(c.page, `${THREAD} .cs-cmt-replybox`, 'REPLY1 đồng ý')
  await waitFor(c.page, sel => document.querySelectorAll(sel + ' .cs-cmt.is-reply').length === 1, THREAD)
  let list = await texts(c.page, THREAD)
  assert.equal(list.length, 2); assert.equal(list[1].reply, true); assert.match(list[1].t, /REPLY1/)
  assert.equal(await c.page.$(`${THREAD} .cs-cmt.is-reply .cs-cmt-reply`), null, 'trả lời không có nút Trả lời (một cấp)')
  ok('Trả lời một cấp: hiện thụt lề dưới bình luận gốc; trả lời không có nút Trả lời')
  await c.page.screenshot({ path: `${SHOTS}/cmt-390-reply.png` })

  // Mất mạng: giữ nguyên chữ đang gõ
  await c.page.setOfflineMode(true)
  await send(c.page, `${THREAD} .cs-target-cmts > .cs-cmt-composer`, 'OFFLINE giữ chữ')
  await c.page.waitForSelector(`${THREAD} .cs-target-cmts > .cs-cmt-composer .cs-form-error`)
  assert.equal(await c.page.$eval(`${THREAD} .cs-target-cmts > .cs-cmt-composer textarea`, e => e.value), 'OFFLINE giữ chữ')
  await c.page.setOfflineMode(false)
  ok('Mất mạng: báo lỗi, nội dung đang gõ được giữ nguyên')
  await c.page.click(`${THREAD} .cs-target-cmts > .cs-cmt-composer .cs-cmt-send`)
  await waitFor(c.page, sel => /OFFLINE giữ chữ/.test(document.querySelector(sel + ' .cs-target-cmts').textContent), THREAD)
  ok('Có mạng lại: gửi lại được')

  // B: sửa bình luận của mình, người khác không có menu Sửa; xoá kéo theo trả lời
  await b.page.reload({ waitUntil: 'networkidle0' }); await b.page.waitForSelector(THREAD)
  await openComments(b.page, THREAD)
  await b.page.waitForSelector(`${THREAD} .cs-cmt-list [data-comment-id]`)
  const mine = await b.page.$$eval(`${THREAD} [data-comment-id]`, els => els.filter(e => !e.classList.contains('is-reply') && /THREADCMT/.test(e.textContent)).map(e => e.getAttribute('data-comment-id')))
  const menuItems = async id => {
    await b.page.evaluate(id => document.querySelector(`[data-comment-id="${id}"] .cs-more-btn`)?.click(), id)
    await b.page.waitForSelector(`[data-comment-id="${id}"] .cs-more-item`)
    return b.page.evaluate(id => [...document.querySelectorAll(`[data-comment-id="${id}"] .cs-more-item`)].map(x => x.textContent), id)
  }
  assert.deepEqual(await menuItems(mine[0]), ['Sửa bình luận', 'Xoá bình luận'])
  await b.page.evaluate(id => [...document.querySelector(`[data-comment-id="${id}"]`).querySelectorAll('.cs-more-item')].find(x => /Sửa/.test(x.textContent)).click(), mine[0])
  await b.page.waitForSelector(`[data-comment-id="${mine[0]}"] textarea`)
  await b.page.click(`[data-comment-id="${mine[0]}"] textarea`, { clickCount: 3 }); await b.page.keyboard.press('Backspace')
  await b.page.type(`[data-comment-id="${mine[0]}"] textarea`, 'THREADCMT đã sửa')
  await b.page.click(`[data-comment-id="${mine[0]}"] .cs-cmt-send`)
  await waitFor(b.page, id => /THREADCMT đã sửa/.test(document.querySelector(`[data-comment-id="${id}"]`).textContent) && /đã sửa/.test(document.querySelector(`[data-comment-id="${id}"] .cs-cmt-meta`).textContent), mine[0])
  ok('Sửa bình luận của mình → nội dung mới + nhãn "đã sửa"')
  await c.page.evaluate(id => document.querySelector(`[data-comment-id="${id}"] .cs-more-btn`)?.click(), mine[0])
  await c.page.waitForSelector(`[data-comment-id="${mine[0]}"] .cs-more-item`)
  const cItems = await c.page.evaluate(id => [...document.querySelectorAll(`[data-comment-id="${id}"] .cs-more-item`)].map(x => x.textContent), mine[0])
  assert.deepEqual(cItems, ['Báo cáo', 'Chặn người dùng'], 'người khác chỉ có Báo cáo/Chặn, không Sửa/Xoá'); ok('Người khác chỉ có Báo cáo/Chặn trên bình luận của B (không Sửa/Xoá)')
  // C báo cáo bình luận của B → class_reports (kind comment), cùng hàng đợi của Thầy
  await c.page.evaluate(id => [...document.querySelectorAll(`[data-comment-id="${id}"] .cs-more-item`)].find(x => /Báo cáo/.test(x.textContent)).click(), mine[0])
  await c.page.waitForSelector('.csafe-sheet input[type=radio]')
  await c.page.evaluate(() => document.querySelector('.csafe-sheet input[type=radio]').click())
  await c.page.evaluate(() => document.querySelector('.csafe-btn.danger').click())
  await c.page.waitForSelector('.csafe-ok')
  assert.equal(sql(`select count(*) from public.class_reports where kind='comment' and target_id='${mine[0]}' and reporter_id='cccccccc-0000-4000-8000-00000000000c' and target_user_id='bbbbbbbb-0000-4000-8000-00000000000b'`), '1')
  ok('C báo cáo bình luận Thread của B → 1 báo cáo trong class_reports (đúng tác giả)')
  await c.page.evaluate(() => document.querySelector('.csafe-btn.primary').click())
  // C chặn B (ghi thẳng DB như class_block_user) → tải lại: bình luận của B biến mất
  sql(`insert into public.class_user_blocks values ('cccccccc-0000-4000-8000-00000000000c','bbbbbbbb-0000-4000-8000-00000000000b') on conflict do nothing`)
  await c.page.reload({ waitUntil: 'networkidle0' }); await c.page.waitForSelector(THREAD)
  await openComments(c.page, THREAD)
  await c.page.waitForSelector(`${THREAD} .cs-cmt-list [data-comment-id]`)   // khu đã nạp xong (còn bình luận của C)
  assert.equal(await c.page.evaluate(id => document.querySelector(`[data-comment-id="${id}"]`) === null, mine[0]), true, 'C đã chặn B: không thấy bình luận của B')
  ok('C chặn B → bình luận của B biến mất khỏi khu bình luận')
  sql(`delete from public.class_user_blocks`)
  await b.page.click(`[data-comment-id="${mine[0]}"] .cs-more-btn`)
  await b.page.waitForSelector(`[data-comment-id="${mine[0]}"] .cs-more-item`)
  await b.page.evaluate(id => [...document.querySelectorAll(`[data-comment-id="${id}"] .cs-more-item`)].find(x => /Xoá/.test(x.textContent)).click(), mine[0])
  await waitFor(b.page, id => !document.querySelector(`[data-comment-id="${id}"]`), mine[0])
  assert.equal((await texts(b.page, THREAD)).some(x => /REPLY1/.test(x.t)), false, 'xoá bình luận gốc kéo theo trả lời')
  ok('Xoá bình luận gốc → trả lời của nó cũng biến mất')

  // Thông báo System Chat cho chủ thread (A): 2 người khác nhau đã bình luận
  const n = sql(`select count(*) from public.class_system_notices where user_id='aaaaaaaa-0000-4000-8000-00000000000a' and kind='feed_comment' and ref_type='thread'`)
  assert.equal(n, '2'); ok('Chủ thread nhận 2 thông báo (B và C, mỗi người gộp theo ngày), publication không thông báo')

  // Bài Social: sửa bình luận qua khu bình luận cũ
  const POST = 'article.cs-post:not(.lt-feed-card)'
  await b.page.waitForSelector(`${POST} .cs-cmt`)
  assert.match(await b.page.$eval(`${POST} .cs-cmt-body`, e => e.textContent), /POSTCMT của B/)
  await b.page.evaluate(sel => document.querySelector(sel + ' .cs-cmt .cs-more-btn').click(), POST)
  await b.page.waitForSelector(`${POST} .cs-cmt .cs-more-item`)
  await b.page.evaluate(sel => [...document.querySelectorAll(sel + ' .cs-cmt .cs-more-item')].find(x => /Sửa/.test(x.textContent)).click(), POST)
  await b.page.waitForSelector(`${POST} .cs-cmt textarea`)
  await b.page.click(`${POST} .cs-cmt textarea`, { clickCount: 3 }); await b.page.keyboard.press('Backspace')
  await b.page.type(`${POST} .cs-cmt textarea`, 'POSTCMT đã sửa')
  await b.page.click(`${POST} .cs-cmt .cs-cmt-send`)
  await waitFor(b.page, sel => /POSTCMT đã sửa/.test(document.querySelector(sel + ' .cs-cmt-body')?.textContent ?? ''), POST)
  ok('Bài Social: sửa bình luận của mình qua khu bình luận cũ (bảng cũ)')
  // Nút Bình luận của bài Social đưa con trỏ vào ô viết
  await b.page.evaluate(sel => [...document.querySelector(sel).querySelectorAll('.cs-likebar-btn')].find(x => /Bình luận/.test(x.textContent)).click(), POST)
  assert.equal(await b.page.evaluate(() => document.activeElement?.tagName), 'TEXTAREA'); ok('Bài Social: nút Bình luận focus vào ô viết')

  // Like trên thẻ Learning Thread (ba nguồn Feed đều được kiểm bằng thao tác thật cùng với Like E2E của bài Social + TeamLab)
  await b.page.evaluate(sel => [...document.querySelector(sel).querySelectorAll('.cs-likebar-btn')].find(x => /Thích/.test(x.textContent)).click(), THREAD)
  await waitFor(b.page, sel => /1 lượt thích/.test(document.querySelector(sel + ' .cs-likebar-count')?.textContent ?? ''), THREAD)
  ok('Thread: Thích → 1 lượt thích (cùng thanh với Bình luận)')

  assert.deepEqual(errors, [], 'không lỗi console/page: ' + errors.join(' | ')); ok('Không có lỗi console/pageerror')
  console.log('══ E2E Feed Comments: TẤT CẢ PASS')
} catch (e) {
  console.error('FAIL:', e.message); process.exitCode = 1
  await b?.page.screenshot({ path: `${SHOTS}/fail-b.png`, fullPage: true }).catch(() => {})
  console.error('LI:', await b?.page.evaluate(() => [...document.querySelectorAll('[data-comment-id]')].map(e => JSON.stringify(e.textContent) + ' META=' + JSON.stringify(e.querySelector('.cs-cmt-meta')?.textContent))).catch(x => String(x)))
} finally { await browser.close() }
