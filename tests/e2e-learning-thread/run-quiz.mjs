// E2E QUIZ CHECKPOINT V1 trong Chrome thật — chạy bởi scripts/e2e-quiz-checkpoint.sh (stack LOCAL, không production).
// Buổi N thật của SOLO01 (Buổi 02, 03 …) nạp vào Buổi N của SOLO01.TH01 fixture; B đã xong các buổi trước.
// ĐẶC TẢ + ĐÁP ÁN đọc từ file PRIVATE (E2E_QUIZ_ANSWERS: {session, video, answers}) — file này không chứa đáp án nào.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ME = `http://class.localhost:${V}/me`
const TH01 = 'b1000000-0000-4000-8000-000000000001'
const SHOTS = process.env.SHOTS
const SPEC = JSON.parse(readFileSync(process.env.E2E_QUIZ_ANSWERS, 'utf8'))   // { session, video, answers: { "<id>": [...] } }
const ANSWERS = SPEC.answers
const N = SPEC.session, NN = String(N).padStart(2, '0'), NEXT = String(N + 1).padStart(2, '0')
const QUIZ = Object.keys(ANSWERS)
const TOTAL = QUIZ.length + (SPEC.video ? 1 : 0)
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
  // ── 1. B mở Trang Buổi N: mỗi trắc nghiệm có câu hỏi + lựa chọn đúng kiểu (radio / checkbox) · bài video có TRẢ BÀI ──
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}/sessions/${N}`))
  await page.waitForSelector(`${cp(QUIZ[0])} .cs-quiz`, { timeout: 20000 })
  const modes = {}
  for (const id of QUIZ) {
    const radios = (await page.$$(`${cp(id)} input[type="radio"]`)).length, boxes = (await page.$$(`${cp(id)} input[type="checkbox"]`)).length
    assert.ok((radios >= 2) !== (boxes >= 2), `${id}: một kiểu lựa chọn`)
    modes[id] = radios ? 'single' : 'multiple'
    assert.ok((await page.$eval(cp(id), e => e.querySelector('.lsn-cp-q')?.textContent ?? '')).trim().length > 5, `${id}: có câu hỏi`)
    assert.equal(await page.$eval(`${cp(id)} .lt-actions button`, b => b.disabled), true, `${id}: chưa chọn → Kiểm tra khoá`)
  }
  if (SPEC.video) assert.match(await cpText(page, SPEC.video), /TRẢ BÀI/)
  const videoCps = await page.$$eval('.lsn-cp .lsn-cp-meta', ps => ps.filter(p => /link video/.test(p.textContent)).length)
  assert.equal(videoCps, SPEC.video ? 1 : 0, `Buổi ${NN} chỉ MỘT bài trả có video`)
  assert.match(await page.$eval('.cs-learn-status', e => e.textContent), new RegExp(`0/${TOTAL} bài trả bắt buộc đã Đạt`))
  ok(`Trang Buổi ${NN} (390): ${QUIZ.map(id => `${id} ${modes[id]}`).join(' · ')}${SPEC.video ? ` · ${SPEC.video} TRẢ BÀI video` : ''} · chỉ 1 video · 0/${TOTAL} Đạt`)
  await noHorizontalOverflow(page, `Trang Buổi ${NN} có trắc nghiệm 390px`)

  // ── 2. Từng trắc nghiệm: sai → "Chưa đúng — thử lại" + gợi ý → Thử lại (bỏ chọn) → (multiple: thiếu/thừa sai) → đúng → ✓ Đạt ──
  for (const [qi, id] of QUIZ.entries()) {
    const opts = await optionIds(page, id)
    const right = ANSWERS[id], wrongOne = opts.find(x => !right.includes(x))
    if (modes[id] === 'single') {
      await choose(page, id, [wrongOne])
      assert.equal(await check(page, id), 'wrong')
      assert.ok(await page.$(`${cp(id)} .cs-quiz-hint`), `${id}: sai → có gợi ý`)
      await page.screenshot({ path: `${SHOTS}/quiz-${id}-wrong-390.png`, fullPage: false })
      ok(`${id} chọn sai → "Chưa đúng — thử lại." + gợi ý, không Đạt`)
      await retry(page, id)
      assert.equal(await page.$$eval(`${cp(id)} input:checked`, x => x.length), 0, 'Thử lại → bỏ chọn')
      await choose(page, id, [wrongOne])
      assert.equal(await check(page, id), 'wrong'); await retry(page, id)
      ok(`${id} sai lần 2 → vẫn làm lại được`)
    } else {
      if (right.length > 1) { await choose(page, id, right.slice(0, -1)); assert.equal(await check(page, id), 'wrong'); await retry(page, id); ok(`${id} thiếu một lựa chọn → sai`) }
      await choose(page, id, [...right, wrongOne]); assert.equal(await check(page, id), 'wrong')
      assert.ok(await page.$(`${cp(id)} .cs-quiz-hint`), `${id}: sai → có gợi ý`)
      await retry(page, id); ok(`${id} thừa một lựa chọn → sai (+ gợi ý)`)
    }
    await choose(page, id, right)
    assert.equal(await check(page, id), 'right')
    assert.equal((await page.$$(`${cp(id)} .cs-quiz-opt input`)).length, 0, 'Đạt → không còn lựa chọn')
    await page.waitForFunction(re => new RegExp(re).test(document.querySelector('.cs-learn-status')?.textContent ?? ''), { timeout: 15000 }, `${qi + 1}/${TOTAL} bài trả bắt buộc đã Đạt`)
    ok(`${id} chọn đúng → ✓ Đạt ngay · trạng thái buổi ${qi + 1}/${TOTAL}`)
  }
  await page.waitForFunction(re => new RegExp(re).test(document.querySelector('.cs-learn-status')?.textContent ?? ''), { timeout: 15000 }, `${QUIZ.length}/${TOTAL} bài trả bắt buộc đã Đạt`)
  ok(`Trạng thái buổi: ${QUIZ.length}/${TOTAL} bài trả bắt buộc đã Đạt (chờ ${SPEC.video})`)

  // ── 3. Tải lại → vẫn ✓ Đạt ──
  await page.reload({ waitUntil: 'networkidle0' })
  for (const id of QUIZ) await page.waitForSelector(`${cp(id)} .cs-quiz.is-passed`, { timeout: 15000 })
  ok(`Tải lại Trang Buổi ${NN}: ${QUIZ.join(' + ')} vẫn ✓ Đạt`)
  await page.screenshot({ path: `${SHOTS}/quiz-b${NN}-passed-390.png`, fullPage: true })
  await ctx.close()

  // ── 4. Trang lớp 1280: mục lục + "Bài trả của tôi" đếm trắc nghiệm ĐẠT; video "Chưa trả"; Không gian lớp không có trắc nghiệm ──
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`, 1280))
  await page.waitForSelector('.cs-learnmap.is-split .cs-subs-panel', { timeout: 15000 })
  await page.waitForFunction(re => new RegExp(re).test(document.querySelector('.cs-subs-panel')?.textContent ?? ''), { timeout: 15000 }, `Buổi ${NN}`)
  assert.match(await page.$eval('.cs-subs-panel', e => e.textContent), new RegExp(`${QUIZ.length}/${TOTAL} Đạt`))
  const items = await page.$$eval('.cs-subs-panel .cs-map-cp', bs => bs.map(b => b.textContent))
  assert.equal(items.length, TOTAL)
  QUIZ.forEach((id, i) => assert.ok(new RegExp(`${id.replace('.', '\\.')}[\\s\\S]*Đạt`).test(items[i]) && !/Chờ Thầy/.test(items[i]), JSON.stringify(items)))
  if (SPEC.video) assert.match(items[TOTAL - 1], /Chưa trả/)
  assert.match(await page.$eval(`#buoi-${NN} .cs-map-meta`, e => e.textContent), new RegExp(`${QUIZ.length}/${TOTAL} bài trả Đạt`))
  ok(`Trang lớp 1280: mục lục "${QUIZ.length}/${TOTAL} bài trả Đạt" · panel: ${QUIZ.join(', ')} Đạt · ${SPEC.video} Chưa trả`)
  await page.$$eval('.cs-subs-panel .cs-map-cp', bs => bs[0].click())
  await page.waitForFunction((id, n) => location.pathname === `/me/classes/${id}/sessions/${n}`, {}, TH01, N)
  ok('Bấm trắc nghiệm đã Đạt trong panel → Trang Buổi (không có cuộc trao đổi)')
  await page.goto(`${ME}/classes/${TH01}/space`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-classspace', { timeout: 15000 })
  await new Promise(r => setTimeout(r, 800))
  const space = await page.$eval('.cs-classspace', e => e.textContent)
  for (const id of QUIZ) assert.doesNotMatch(space, new RegExp(`Bài trả ${id.replace('.', '\\.')}`))
  ok(`Không gian lớp: KHÔNG có trắc nghiệm ${QUIZ.join(' / ')}`)
  await ctx.close()

  // ── 5. Bài video: B trả video + chữ → Chờ Thầy ──
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}/sessions/${N}`))
  await page.waitForSelector(cp(SPEC.video), { timeout: 20000 })
  await clickText(page, 'TRẢ BÀI', 'button', cp(SPEC.video))
  await page.waitForSelector(`${cp(SPEC.video)} .lt-compose`)
  await page.type(`${cp(SPEC.video)} input[type="url"]`, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await page.type(`${cp(SPEC.video)} textarea`, 'Em đặt thêm Slide ở ô 5 vì câu nhạc liền hơn.')
  await clickText(page, 'Gửi bài', 'button', cp(SPEC.video))
  await page.waitForFunction(s => /Đã trả · Chờ chấm/.test(document.querySelector(s)?.textContent ?? ''), { timeout: 15000 }, cp(SPEC.video))
  ok(`${SPEC.video} trả video + chữ → "Đã trả · Chờ chấm" (Learning Thread)`)
  await ctx.close()

  // ── 6. Thầy: Hàng đợi chỉ có bài video (không trắc nghiệm) → chấm Đạt ──
  ;({ ctx, page } = await meAs('t@test.local', '', 1280))
  await page.waitForSelector('.cs-share', { timeout: 15000 })
  await page.goto(`${ME}/queue`, { waitUntil: 'networkidle0' })
  await waitText(page, new RegExp(`Bài trả ${SPEC.video.replace('.', '\\.')}`))
  const queue = await page.evaluate(() => document.body.textContent)
  for (const id of QUIZ) assert.doesNotMatch(queue, new RegExp(`Bài trả ${id.replace('.', '\\.')}`))
  ok(`Hàng đợi Thầy: có Bài trả ${SPEC.video}, KHÔNG có trắc nghiệm ${QUIZ.join(' / ')}`)
  const link = await page.evaluateHandle(v => [...document.querySelectorAll('a, button')].find(e => (e.textContent ?? '').includes(`Bài trả ${v}`)), SPEC.video)
  await link.asElement().click()
  await page.waitForFunction(() => location.pathname.startsWith('/me/t/'), { timeout: 15000 })
  await page.waitForSelector('.lt-compose[aria-label="Thầy phản hồi"] textarea', { timeout: 15000 })
  await page.type('.lt-compose[aria-label="Thầy phản hồi"] textarea', 'Slide đặt hợp lý, câu nhạc liền. Đạt.')
  await clickText(page, 'Đạt')
  await waitText(page, /Đã đạt/)
  ok(`Thầy chấm ${SPEC.video} Đạt`)
  await ctx.close()

  // ── 7. Đủ bài trả bắt buộc Đạt → Buổi N Hoàn thành → Buổi N+1 MỞ ──
  ;({ ctx, page } = await meAs('b@test.local', `/classes/${TH01}`, 1280))
  await page.waitForSelector('.cs-map', { timeout: 15000 })
  for (const b of await page.$$('.cs-map-stage-toggle[aria-expanded="false"]')) await b.click()
  await page.waitForFunction(nn => /Hoàn thành/.test(document.querySelector(`#buoi-${nn} .cs-map-meta`)?.textContent ?? ''), { timeout: 15000 }, NN)
  assert.match(await page.$eval(`#buoi-${NN} .cs-map-meta`, e => e.textContent), new RegExp(`${TOTAL}/${TOTAL} bài trả Đạt`))
  assert.equal(await page.$eval(`#buoi-${NEXT}`, e => e.classList.contains('is-locked')), false, `Buổi ${NEXT} đã mở`)
  ok(`${TOTAL}/${TOTAL} Đạt (${QUIZ.length} trắc nghiệm + video) → Buổi ${NN} Hoàn thành · Buổi ${NEXT} MỞ`)
  await page.screenshot({ path: `${SHOTS}/quiz-b${NN}-class-1280.png`, fullPage: false })
  await noHorizontalOverflow(page, `Trang lớp sau Buổi ${NN} 1280px`)
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
