// E2E Share Note V1 trong Chrome thật — xem scripts/e2e-share-note.sh. Bản nhạc THẬT (alphaTab khắc), chạm/kéo bằng sự kiện cảm ứng thật.
// Hành trình: A (iPhone 390) khoanh ô nhịp → Hỏi/Chia sẻ → gửi Bình qua Trò chuyện → Bình mở đúng đoạn → trả lời trong Trò chuyện → A thấy;
// A đăng Feed → Bình mở từ Feed + bình luận; Chi (lớp khác) thấy câu hỏi nhưng KHÔNG mở được bản nhạc; Thầy sửa bản nhạc → stale (không tô).
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { assertControlsVisible } from './visibility.mjs'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ORIGIN = `http://class.localhost:${V}`
const ME = `${ORIGIN}/me`
const EMAIL = { A: 'a@test.local', B: 'b@test.local', C: 'c@test.local', T: 't@test.local' }
const ID = { A: 'aaaaaaaa-0000-4000-8000-00000000000a' }
const TH01 = 'b1000000-0000-4000-8000-000000000001', S1 = '51000000-0000-4000-8000-000000000001'
const SESSION = `${ME}/classes/${TH01}/sessions/1`
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--no-default-browser-check'] })
let pass = 0
const ok = msg => { pass++; console.log('PASS: ' + msg) }
const errors = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitFor = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 20000 }, ...args)

async function open(who, width = 390, height = 844) {
  let ctx
  for (let i = 0; ; i++) { try { ctx = await browser.createBrowserContext(); break } catch (e) { if (i > 2) throw e; await sleep(300) } }
  const page = await ctx.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push(`${who} pageerror: ` + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource|googlevideo|youtube|ytimg|WebAssembly|verovio/i.test(m.text())) errors.push(`${who} console: ` + m.text()) })
  page.rpcs = []; page.api = null
  page.on('request', r => {
    const u = r.url()
    if (/\/rest\/v1\//.test(u) && r.method() !== 'OPTIONS' && /^Bearer /.test(r.headers().authorization ?? '')) page.api = { origin: new URL(u).origin, apikey: r.headers().apikey, auth: r.headers().authorization }
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/)
    if (m && r.method() !== 'OPTIONS') { let body = {}; try { body = JSON.parse(r.postData() ?? '{}') } catch { /* GET */ } page.rpcs.push({ fn: m[1], body }) }
  })
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', EMAIL[who]); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  page.cdp = await page.createCDPSession()
  return page
}
const calls = (page, fn) => page.rpcs.filter(r => r.fn === fn)
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
async function openScore(page, url = SESSION) {
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.lsn-score-wrap .at-surface svg', { timeout: 30000 })
  await waitFor(page, () => !document.querySelector('.lsn-score-msg'))
  await sleep(500)
}
/** Toạ độ màn hình của một điểm theo TỈ LỆ trong bề mặt bản nhạc (đưa vào giữa màn hình trước) */
async function surfacePoint(page, fx, fyPx) {
  await page.evaluate(y => { const s = document.querySelector('.lsn-score-wrap .at-surface'); window.scrollBy(0, s.getBoundingClientRect().top + y - innerHeight / 2) }, fyPx)
  await sleep(250)
  return page.evaluate((fx, y) => { const r = document.querySelector('.lsn-score-wrap .at-surface').getBoundingClientRect(); return { x: r.left + r.width * fx, y: r.top + y, sx: r.width * fx, sy: y } }, fx, fyPx)
}
const touch = (page, type, pts) => page.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(p => ({ x: p.x, y: p.y })) })
async function tap(page, p) { await touch(page, 'touchStart', [p]); await touch(page, 'touchEnd', []); await sleep(150) }
async function dragTouch(page, a, b) {
  await touch(page, 'touchStart', [a])
  for (let i = 1; i <= 8; i++) await touch(page, 'touchMove', [{ x: a.x + (b.x - a.x) * i / 8, y: a.y + (b.y - a.y) * i / 8 }])
  await touch(page, 'touchEnd', []); await sleep(200)
}
const barText = page => page.$eval('.lsn-share-range', e => e.textContent.trim()).catch(() => null)
async function clickBtn(page, label, scope = 'button') {
  const h = await page.waitForFunction((l, s) => [...document.querySelectorAll(s)].find(b => b.textContent.trim() === l && !b.disabled && b.offsetParent !== null), { timeout: 15000 }, label, scope)
  // đưa vào GIỮA màn hình trước (header dính của /me đè mép trên — bấm sát mép sẽ trúng link "← Class")
  await h.evaluate(el => el.scrollIntoView({ block: 'center' })); await sleep(150)
  await h.asElement().click()
}
async function pickAndSend(page, name) {
  await waitFor(page, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  await page.evaluate(n => [...document.querySelectorAll('[role=dialog] [role=radio]')].find(e => e.querySelector('span:last-child').textContent.trim() === n).click(), name)
  await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho')).click())
  await waitFor(page, n => document.querySelector('[role=dialog] [role=status]')?.textContent === `Đã gửi cho ${n}`, name)
}
async function compose(page, text) {
  await clickBtn(page, 'Hỏi / Chia sẻ')
  await page.waitForSelector('[role=dialog][aria-label="Hỏi về đoạn nhạc"]')
  await page.type('#share-note-text', text)
}
const scrollGesture = (page, x, y, dy) => page.cdp.send('Input.synthesizeScrollGesture', { x, y, yDistance: -dy, gestureSourceType: 'touch', speed: 900 })
const focusInfo = page => page.evaluate(() => {
  const hl = [...document.querySelectorAll('.lsn-share-hl.is-focus')].map(e => e.getBoundingClientRect())
  const s = document.querySelector('.lsn-score-wrap .at-surface')?.getBoundingClientRect()
  return { n: hl.length, inView: hl.some(r => r.bottom > 0 && r.top < innerHeight), rel: s ? hl.map(r => ({ l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top })) : [] }
})
const panel = page => page.$eval('.cs-share-note-panel', e => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => null)

let A, B, B390, C, T
try {
  A = await open('A', 390); B = await open('B', 1280, 900); B390 = await open('B', 390); C = await open('C', 390); T = await open('T', 1280, 900)

  // 1. Trang Buổi của A: bản nhạc thật + nút "Khoanh để hỏi" (mặc định TẮT); không tràn ngang; vuốt trên bản nhạc vẫn cuộn trang
  await openScore(A)
  assert.equal(await A.$eval('.lsn-share-bar button', b => b.textContent.trim()), 'Khoanh để hỏi')
  assert.equal(await A.$eval('.lsn-share-overlay', e => e.classList.contains('is-on')), false)
  assert.ok(await noHScroll(A), 'không tràn ngang')
  await assertControlsVisible(A, 'trang Buổi (A, 390)')
  const mid = await surfacePoint(A, 0.5, 120)
  const y0 = await A.evaluate(() => scrollY); await scrollGesture(A, mid.x, mid.y, 260); await sleep(500)
  const y1 = await A.evaluate(() => scrollY)
  assert.ok(y1 > y0 + 100, `tắt Khoanh: vuốt trên bản nhạc phải cuộn trang (${y0}→${y1})`)
  await A.screenshot({ path: `${SHOTS}/sn-1-a-trang-buoi.png` })
  ok('1 trang Buổi: bản nhạc alphaTab thật + nút "Khoanh để hỏi" (mặc định tắt), không tràn ngang, vuốt trên bản nhạc vẫn cuộn trang, nút nhìn thấy được')

  // 2. Bật Khoanh: chạm một ô → "Ô n"; vuốt không cuộn trang; kéo qua nhiều ô → "Ô a–b"
  await clickBtn(A, 'Khoanh để hỏi')
  assert.equal(await A.$eval('.lsn-share-overlay', e => e.classList.contains('is-on')), true)
  const p1 = await surfacePoint(A, 0.35, 90)
  await tap(A, p1)
  const one = await barText(A)
  assert.match(one ?? '', /^Ô \d+$/, `chạm một ô → "${one}"`)
  const yb = await A.evaluate(() => scrollY); const q = await surfacePoint(A, 0.5, 90)
  const yq = await A.evaluate(() => scrollY); await scrollGesture(A, q.x, q.y, 260); await sleep(500)
  assert.ok(Math.abs((await A.evaluate(() => scrollY)) - yq) < 5, 'bật Khoanh: vuốt trên bản nhạc KHÔNG cuộn trang (touch-action:none)')
  void yb
  await clickBtn(A, 'Chọn lại')
  const a0 = await surfacePoint(A, 0.2, 90), a1 = await surfacePoint(A, 0.85, 90)
  await dragTouch(A, a0, a1)
  const range = await barText(A)
  assert.match(range ?? '', /^Ô \d+–\d+$/, `kéo qua nhiều ô → "${range}"`)
  await A.screenshot({ path: `${SHOTS}/sn-2-a-khoanh.png` })
  await assertControlsVisible(A, 'thanh Khoanh có vùng chọn')
  ok(`2 Khoanh bằng cảm ứng thật: chạm → "${one}", vuốt không cuộn trang khi đang khoanh, kéo → "${range}"`)

  // 3. Hỏi / Chia sẻ → lời nhắn → Gửi cho bạn bè (Universal Share) → Bình; bấm đúp = MỘT note
  const NOTE1 = `E2E hỏi ${range}: em bấm chưa tròn tiếng`
  await compose(A, NOTE1)
  await assertControlsVisible(A, 'khung Hỏi về đoạn nhạc')
  await A.evaluate(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho bạn bè')); b.click(); b.click() })
  await pickAndSend(A, 'Bình')
  const cr = calls(A, 'share_note_create')
  assert.equal(new Set(cr.map(c => c.body.p_client_key)).size, 1, 'bấm đúp/thử lại dùng CÙNG một khoá chống trùng')
  assert.deepEqual(cr[0].body.p_path, ['tex']); assert.equal(cr[0].body.p_session, S1)
  assert.equal(cr[0].body.p_from + '–' + cr[0].body.p_to, range.replace('Ô ', ''))
  assert.equal(Object.keys(cr[0].body).sort().join(','), 'p_client_key,p_from,p_note,p_path,p_section,p_session,p_to', 'client chỉ gửi tham chiếu, KHÔNG nội dung nhạc/toạ độ pixel')
  const sh = calls(A, 'dm_share').at(-1).body
  assert.equal(sh.p_ref_type, 'share_note')
  const NOTE_ID = sh.p_ref_key
  ok('3 Hỏi/Chia sẻ → Gửi cho bạn bè: tạo MỘT tham chiếu (khối + đường dẫn + dải ô + lời nhắn, không pixel/không nội dung nhạc) rồi gửi qua dm_share (Universal Share)')

  // 4. Bình (desktop) thấy thẻ trong Trò chuyện → mở đúng đoạn
  await B.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
  await B.waitForSelector('[data-testid="inbox-row"]', { timeout: 15000 })
  await B.evaluate(() => [...document.querySelectorAll('[data-testid="inbox-row"]')].find(e => ['An', 'Nguyễn An'].includes(e.querySelector('.cs-inbox-name').textContent.trim())).click())
  await waitFor(B, () => document.querySelector('.cs-chat-scroll .cs-share-card:not(.is-loading)'))
  const card = await B.$eval('.cs-chat-scroll .cs-share-card', e => ({ t: e.textContent.replace(/\s+/g, ' '), href: e.getAttribute('href') }))
  assert.match(card.t, /Bản nhạc · Buổi 1/); assert.ok(card.t.includes(NOTE1), card.t); assert.ok(card.t.includes(range), card.t); assert.match(card.t, /Mở trong giáo trình/)
  assert.equal(card.href, `/me/classes/${TH01}/sessions/1?note=${NOTE_ID}`)
  assert.equal(/share_note|alphatex|\\ts/i.test(card.t), false, 'thẻ không lộ từ kỹ thuật / nội dung nhạc')
  await B.screenshot({ path: `${SHOTS}/sn-4-b-the-tro-chuyen.png` })
  await B.click('.cs-chat-scroll .cs-share-card')
  await B.waitForSelector('.cs-share-note-panel', { timeout: 20000 })
  await B.waitForSelector('.lsn-share-hl.is-focus', { timeout: 30000 }); await sleep(600)
  const pB = await panel(B), fB = await focusInfo(B)
  assert.ok(pB.includes(NOTE1) && pB.includes(range) && /tô màu cam/.test(pB), pB)
  assert.ok(fB.n >= 1 && fB.inView, `vùng tô có mặt + trong màn hình: ${JSON.stringify(fB)}`)
  await assertControlsVisible(B, 'trang Buổi mở từ liên kết (Bình, 1280)')
  await B.screenshot({ path: `${SHOTS}/sn-4-b-mo-dung-doan-1280.png` })
  ok(`4 Bình (1280) thấy thẻ "Bản nhạc · Buổi 1 · ${range}" → mở đúng trang Buổi, câu hỏi + vùng tô trong màn hình (khổ khác người gửi)`)

  // 5. Cùng khổ người gửi (390): vùng tô PHỦ đúng điểm A đã kéo (cùng bố cục alphaTab)
  await openScore(B390, `${SESSION}?note=${NOTE_ID}`)
  await B390.waitForSelector('.lsn-share-hl.is-focus', { timeout: 30000 }); await sleep(500)
  const f390 = await focusInfo(B390)
  const covers = pt => f390.rel.some(r => pt.sx >= r.l - 1 && pt.sx <= r.r + 1 && pt.sy >= r.t - 1 && pt.sy <= r.b + 1)
  assert.ok(covers(a0) && covers(a1), `vùng tô phủ điểm đầu/cuối A đã kéo: ${JSON.stringify({ a0: [a0.sx, a0.sy], a1: [a1.sx, a1.sy], f390 })}`)
  assert.ok(await noHScroll(B390))
  await B390.screenshot({ path: `${SHOTS}/sn-5-b-mo-dung-doan-390.png` })
  ok('5 cùng khổ 390: vùng tô phủ ĐÚNG hai điểm A đã kéo (đối chiếu toạ độ độc lập), không tràn ngang')

  // 6. Trả lời trong Trò chuyện → A thấy
  await clickBtn(B, 'Trả lời trong Trò chuyện', 'a')
  // /me/chat/u/<id> → app chuyển về đường dẫn chuẩn của hội thoại đã có; kiểm: đang ở hội thoại có thẻ câu hỏi + ô nhập
  await waitFor(B, t => location.pathname.startsWith('/me/chat/') && document.querySelector('.cs-chat-input') && document.querySelector('.cs-chat-scroll')?.textContent.includes(t), NOTE1)
  const REPLY = 'E2E thầy/bạn trả lời: giữ ngón 3 sát phím'
  await B.click('.cs-chat-input'); await B.type('.cs-chat-input', REPLY); await B.click('.cs-chat-send')
  await waitFor(B, t => document.querySelector('.cs-chat-scroll')?.textContent.includes(t), REPLY)
  await A.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
  await A.waitForSelector('[data-testid="inbox-row"]', { timeout: 15000 })
  await A.evaluate(() => [...document.querySelectorAll('[data-testid="inbox-row"]')].find(e => e.querySelector('.cs-inbox-name').textContent.trim() === 'Bình').click())
  await waitFor(A, t => document.querySelector('.cs-chat-scroll')?.textContent.includes(t), REPLY)
  await A.screenshot({ path: `${SHOTS}/sn-6-a-nhan-tra-loi.png` })
  ok('6 Bình bấm "Trả lời trong Trò chuyện" → đúng hội thoại với An → gửi trả lời → An thấy câu trả lời ngay dưới thẻ câu hỏi')

  // 7. Đăng Feed: A khoanh đoạn khác → Đăng lên Feed
  await openScore(A)
  await clickBtn(A, 'Khoanh để hỏi')
  await tap(A, await surfacePoint(A, 0.6, 90))
  const range2 = await barText(A)
  const NOTE2 = `E2E Feed ${range2}: đoạn này đếm phách thế nào?`
  await compose(A, NOTE2)
  await A.evaluate(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Đăng lên Feed')); b.click(); b.click() })
  await waitFor(A, () => document.querySelector('[role=dialog] [role=status]')?.textContent === 'Đã đăng lên Feed')
  assert.equal(calls(A, 'social_share_share_note').length, 1, 'bấm đúp = một lần đăng')
  await A.screenshot({ path: `${SHOTS}/sn-7-a-dang-feed.png` })
  ok(`7 An khoanh "${range2}" → Đăng lên Feed (bấm đúp = một lần)`)

  // 8. Chi (lớp khác): thấy câu hỏi trên Feed, mở → KHÔNG có quyền bản nhạc, không tô
  const feedCard = async (page) => {
    await page.goto(ME, { waitUntil: 'networkidle0' })
    await waitFor(page, t => [...document.querySelectorAll('.cs-tool-share')].some(e => e.textContent.includes(t)), NOTE2)
    return page.evaluate(t => { const e = [...document.querySelectorAll('.cs-tool-share')].find(x => x.textContent.includes(t)); return { t: e.textContent.replace(/\s+/g, ' '), href: e.querySelector('a')?.getAttribute('href') } }, NOTE2)
  }
  const cC = await feedCard(C)
  assert.match(cC.t, /Bản nhạc · Buổi 1/); assert.ok(cC.t.includes(range2)); assert.match(cC.href, /\/sessions\/1\?note=[0-9a-f-]{36}$/)
  await C.screenshot({ path: `${SHOTS}/sn-8-c-feed.png` })
  await C.goto(ORIGIN + cC.href, { waitUntil: 'networkidle0' })
  await C.waitForSelector('.cs-share-note-panel', { timeout: 20000 }); await sleep(800)
  const pC = await panel(C)
  assert.ok(pC.includes(NOTE2) && /chưa có quyền xem bản nhạc/.test(pC), pC)
  assert.equal(await C.$('.lsn-share-hl.is-focus'), null, 'không có vùng tô')
  assert.equal(await C.$('.at-surface'), null, 'không tải bản nhạc giáo trình lớp khác')
  await C.screenshot({ path: `${SHOTS}/sn-8-c-khong-quyen.png` })
  ok('8 Chi (lớp khác): thấy câu hỏi trên Feed; mở → "chưa có quyền xem bản nhạc", KHÔNG tô, KHÔNG tải giáo trình')

  // 9. Bình: mở từ Feed → đúng đoạn; bình luận ngay dưới bài (phản hồi trong ngữ cảnh Feed)
  const cB = await feedCard(B)
  const POST = await B.evaluate(t => { const e = [...document.querySelectorAll('.cs-tool-share')].find(x => x.textContent.includes(t)); const art = e.closest('article'); art.setAttribute('data-e2e', 'sn-post'); return !!art }, NOTE2)
  assert.ok(POST, 'thẻ Feed nằm trong một bài đăng')
  await B.evaluate(() => [...document.querySelector('[data-e2e=sn-post]').querySelectorAll('.cs-likebar-btn')].find(x => /Bình luận/.test(x.textContent)).click())
  await B.waitForSelector('[data-e2e=sn-post] .cs-cmt-composer textarea')
  const CMT = 'E2E bình luận: đếm 1 2 3 4 đều tay'
  await B.type('[data-e2e=sn-post] .cs-cmt-composer textarea', CMT); await B.click('[data-e2e=sn-post] .cs-cmt-composer .cs-cmt-send')
  await waitFor(B, t => [...document.querySelectorAll('[data-e2e=sn-post] .cs-cmt-body')].some(e => e.textContent.includes(t)), CMT)
  await B.screenshot({ path: `${SHOTS}/sn-9-b-binh-luan-feed.png` })
  await B.goto(ORIGIN + cB.href, { waitUntil: 'networkidle0' })
  await B.waitForSelector('.lsn-share-hl.is-focus', { timeout: 30000 })
  assert.ok((await panel(B)).includes(NOTE2))
  ok('9 Bình mở từ Feed → đúng đoạn (tô); bình luận ngay dưới bài Feed (phản hồi trong ngữ cảnh)')

  // 10. Thầy sửa bản nhạc (thêm một ô) → liên kết cũ: giữ câu hỏi, KHÔNG tô vùng cũ
  await T.goto(ME, { waitUntil: 'networkidle0' })
  assert.ok(T.api, 'đã thấy API PostgREST của trang')
  const patched = await T.evaluate(async ({ api, S }) => {
    const h = { apikey: api.apikey, Authorization: api.auth, 'Content-Type': 'application/json', Prefer: 'return=representation' }
    const cur = await (await fetch(`${api.origin}/rest/v1/class_lesson_content?session_id=eq.${S}&select=blocks`, { headers: h })).json()
    const blocks = cur[0].blocks; const last = blocks[blocks.length - 1]; last.tex = last.tex + ' | r.1'
    const res = await fetch(`${api.origin}/rest/v1/class_lesson_content?session_id=eq.${S}`, { method: 'PATCH', headers: h, body: JSON.stringify({ blocks }) })
    return res.status
  }, { api: T.api, S: S1 })
  assert.ok(patched === 200 || patched === 204, `Thầy sửa giáo trình: ${patched}`)
  await openScore(B390, `${SESSION}?note=${NOTE_ID}`)
  await B390.waitForSelector('.cs-share-note-panel'); await sleep(1500)
  const pS = await panel(B390)
  assert.ok(pS.includes(NOTE1) && /đã được cập nhật/.test(pS), pS)
  assert.equal(await B390.$('.lsn-share-hl.is-focus'), null, 'stale: KHÔNG tô')
  await B390.screenshot({ path: `${SHOTS}/sn-10-b-stale.png` })
  ok('10 Thầy sửa bản nhạc → mở liên kết cũ: câu hỏi còn nguyên, báo "bản nhạc đã được cập nhật", KHÔNG tô vùng cũ')

  // 11. Trang không cấp slot (Admin/xem trước) không có lớp khoanh — đã kiểm unit; ở đây: thẻ Trò chuyện vẫn hiện sau khi bản nhạc đổi
  await B.goto(`${ME}/chat`, { waitUntil: 'networkidle0' }); await B.waitForSelector('[data-testid="inbox-row"]', { timeout: 15000 })
  await B.evaluate(() => [...document.querySelectorAll('[data-testid="inbox-row"]')].find(e => ['An', 'Nguyễn An'].includes(e.querySelector('.cs-inbox-name').textContent.trim())).click())
  await waitFor(B, () => document.querySelector('.cs-chat-scroll .cs-share-card:not(.is-loading)'))
  assert.ok((await B.$eval('.cs-chat-scroll .cs-share-card', e => e.textContent)).includes(NOTE1))
  ok('11 sau khi bản nhạc đổi: lịch sử câu hỏi trong Trò chuyện vẫn còn')

  assert.deepEqual(errors, [], 'không lỗi trang / console')
  ok('không có pageerror / console error')
  console.log(`\nE2E SHARE NOTE: ${pass} PASS`)
} catch (e) {
  for (const [n, p] of Object.entries({ A, B, B390, C, T })) { try { await p?.screenshot({ path: `${SHOTS}/FAIL-${n}.png` }) } catch { /* */ } }
  console.error('FAIL:', e?.message ?? e); if (errors.length) console.error('errors:', errors.slice(0, 5))
  await browser.close(); process.exit(1)
}
await browser.close()
