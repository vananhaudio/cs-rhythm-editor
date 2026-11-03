// E2E Share Note FEED PREVIEW V1 trong Chrome thật — xem scripts/e2e-share-note.sh (chạy TRƯỚC run-share-note.mjs: dữ liệu còn nguyên).
// An tạo 6 ghi chú (dải ô khác nhau) bằng chính RPC rồi đăng Feed. Bình (cùng lớp) thấy TRÍCH ĐOẠN vẽ trực tiếp (≤ 4 ô), đúng số ô gốc;
// Chi (lớp khác) chỉ thấy câu hỏi + "chưa có quyền", KHÔNG có yêu cầu đọc giáo trình; cuộn Feed 6 thẻ: ≤ 2 renderer sống, không rò rỉ;
// bấm xem trước → mở đúng đoạn; Thích/Bình luận còn nguyên; bản nhạc đổi (stale) → không vẽ nhạc.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ORIGIN = `http://class.localhost:${V}`, ME = `${ORIGIN}/me`
const EMAIL = { A: 'a@test.local', B: 'b@test.local', C: 'c@test.local', T: 't@test.local' }
const S1 = '51000000-0000-4000-8000-000000000001'
const SHOTS = process.env.SHOTS; mkdirSync(SHOTS, { recursive: true })
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--no-default-browser-check'] })
let pass = 0
const ok = m => { pass++; console.log('PASS: [feed] ' + m) }
const errors = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitFor = (page, fn, ...a) => page.waitForFunction(fn, { timeout: 40000 }, ...a)

async function open(who, width = 1280, height = 900) {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push(`${who} pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource|googlevideo|youtube|ytimg|WebAssembly|verovio/i.test(m.text())) errors.push(`${who} console: ` + m.text()) })
  page.reqs = []; page.api = null
  page.on('request', r => {
    const u = r.url(); if (r.method() === 'OPTIONS') return
    page.reqs.push(u)
    if (/\/rest\/v1\//.test(u) && /^Bearer /.test(r.headers().authorization ?? '')) page.api = { origin: new URL(u).origin, apikey: r.headers().apikey, auth: r.headers().authorization }
  })
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', EMAIL[who]); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  return page
}
const rest = (page, path, init = {}) => page.evaluate(async ({ api, path, init }) => {
  const h = { apikey: api.apikey, Authorization: api.auth, 'Content-Type': 'application/json' }
  const r = await fetch(api.origin + path, { ...init, headers: { ...h, ...(init.headers ?? {}) } })
  const t = await r.text(); return { status: r.status, body: t ? JSON.parse(t) : null }
}, { api: page.api, path, init })
const rpc = (page, fn, args) => rest(page, `/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) })

// Số ô in ra (đỏ) đầu mỗi dòng trong bản nhạc của MỘT thẻ — đối chiếu độc lập với dải đã khoanh
const printedBars = (page, i) => page.evaluate(i => {
  const card = document.querySelectorAll('[data-testid="share-note-post"]')[i]
  return [...card.querySelectorAll('svg text')].filter(t => /^\d+$/.test(t.textContent.trim()) && /c80000|rgb\(200, ?0, ?0\)/i.test(t.getAttribute('fill') || t.style.fill || '')).map(t => Number(t.textContent.trim()))
}, i)
const live = page => page.evaluate(() => ({ live: document.querySelectorAll('[data-testid="share-note-preview"][data-live="1"]').length, surfaces: document.querySelectorAll('.at-surface').length }))
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)

// ── Dựng dữ liệu: An tạo + đăng 6 bài ──
const A = await open('A'); await sleep(500)
const lesson = await rest(A, `/rest/v1/class_lesson_content?session_id=eq.${S1}&select=blocks`)
const blocks = lesson.body[0].blocks
const SECTION = blocks.map((b, i) => (b.kind === 'score' && typeof b.tex === 'string' ? i : -1)).filter(i => i >= 0).pop()
assert.ok(SECTION >= 0, 'có khối bản nhạc trong buổi 1')
const RANGES = [[3, 4], [1, 10], [7, 7], [12, 14], [20, 26], [5, 6]]
const QS = RANGES.map(([a, b], i) => `FEED-${i + 1} Ô ${a}–${b}: đoạn này đếm thế nào?`)
for (let i = 0; i < RANGES.length; i++) {
  const [a, b] = RANGES[i]
  const c = await rpc(A, 'share_note_create', { p_session: S1, p_section: SECTION, p_path: ['tex'], p_from: a, p_to: b, p_note: QS[i], p_client_key: `feedprev-${i}-${Date.now()}` })
  assert.equal(c.status, 200, `tạo ghi chú ${i + 1}: ${JSON.stringify(c.body)}`)
  const p = await rpc(A, 'social_share_share_note', { p_note: c.body }); assert.equal(p.status, 200, `đăng Feed ${i + 1}: ${JSON.stringify(p.body)}`)
  await sleep(1100)   // created_at khác nhau → thứ tự Feed ổn định (mới nhất trước)
}
ok('dựng dữ liệu: An tạo + đăng 6 ghi chú (dải ô khác nhau) bằng RPC thật')

// Thẻ theo thứ tự Feed (mới nhất trước) → ánh xạ về câu hỏi
const cardOrder = page => page.evaluate(qs => [...document.querySelectorAll('[data-testid="share-note-post"]')].map(c => qs.findIndex(q => c.textContent.includes(q))), QS)

// ── 1. Bình (desktop 1280): thấy trích đoạn trực tiếp ──
const B = await open('B', 1280, 900)
await B.goto(ME, { waitUntil: 'networkidle0' })
await waitFor(B, n => document.querySelectorAll('[data-testid="share-note-post"]').length >= n, QS.length)
await B.evaluate(() => document.querySelector('[data-testid="share-note-post"]').scrollIntoView({ block: 'center' }))
await waitFor(B, () => document.querySelector('[data-testid="share-note-preview"][data-live="1"] .at-surface svg'))
await waitFor(B, () => !document.querySelector('[data-testid="share-note-preview"][data-live="1"] .lsn-score-msg')); await sleep(600)
let order = await cardOrder(B)
let firstIdx = (await B.evaluate(() => { const els = [...document.querySelectorAll('[data-testid="share-note-post"]')]; return els.findIndex(e => e.querySelector('[data-live="1"] .at-surface svg')) }))
assert.ok(firstIdx >= 0)
let q = order[firstIdx], [fa, fb] = RANGES[q]
const bars0 = await printedBars(B, firstIdx)
assert.ok(bars0.length > 0 && Math.min(...bars0) === fa, `số ô in ra bắt đầu ĐÚNG ô ${fa}: ${bars0}`)
const label0 = await B.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('.cs-tool-share-detail').textContent, firstIdx)
const want0 = Math.min(fb - fa + 1, 4)
assert.ok(bars0.every(n => n >= fa && n <= fa + want0 - 1), `không vẽ ô ngoài dải đã chọn (${bars0})`)
assert.equal(label0.includes('hiện 4 ô đầu'), fb - fa + 1 > 4, label0)
assert.ok(await noHScroll(B), 'không tràn ngang')
await B.screenshot({ path: `${SHOTS}/fp-1-b-desktop-feed.png` })
ok(`1 Bình (desktop): thẻ Feed "${QS[q].slice(0, 22)}…" vẽ TRỰC TIẾP trích đoạn từ ô ${fa} (số ô in ra ${bars0}), nhãn "${label0}", không tràn ngang`)

// ── 2. Cuộn Feed 6 thẻ: ≤ 2 renderer sống; thẻ rời xa bị huỷ; không rò rỉ ──
let maxLive = 0, maxSurf = 0
const sample = async () => { const s = await live(B); maxLive = Math.max(maxLive, s.live); maxSurf = Math.max(maxSurf, s.surfaces); return s }
const total = await B.evaluate(() => document.querySelectorAll('[data-testid="share-note-post"]').length)
for (let pass2 = 0; pass2 < 2; pass2++) {
  for (let i = 0; i < total; i++) { await B.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), i); await sleep(900); await sample() }
  for (let i = total - 1; i >= 0; i--) { await B.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), i); await sleep(500); await sample() }
}
await B.evaluate(() => window.scrollTo(0, 0)); await sleep(800)
const fin = await sample()
assert.ok(maxLive <= 2 && maxSurf <= 2, `renderer sống tối đa 2: live=${maxLive} surfaces=${maxSurf}`)
// Thẻ cuộn xa (> 600px) đã bị huỷ: không còn bề mặt alphaTab ở thẻ cuối khi đang ở đầu Feed
const farLive = await B.evaluate(() => { const els = [...document.querySelectorAll('[data-testid="share-note-post"]')]; return els.slice(-2).some(e => e.querySelector('.at-surface')) })
assert.equal(farLive, false, 'thẻ rời xa khung nhìn đã huỷ renderer')
ok(`2 Cuộn 6 thẻ × 2 lượt (xuôi + ngược): renderer sống tối đa ${maxLive}, bề mặt alphaTab tối đa ${maxSurf}; thẻ ở xa bị huỷ (cuối cùng ${fin.live} sống)`)

// ── 3. Thích + Bình luận còn nguyên trên thẻ có xem trước ──
const likeOk = await B.evaluate(() => { const art = document.querySelector('[data-testid="share-note-post"]').closest('article'); return !!art?.querySelector('.cs-likebar-btn') })
assert.ok(likeOk, 'thanh Thích / Bình luận vẫn có')
await B.evaluate(() => { const art = document.querySelector('[data-testid="share-note-post"]').closest('article'); art.setAttribute('data-e2e', 'fp-post'); art.scrollIntoView({ block: 'center' }) })
await B.evaluate(() => [...document.querySelector('[data-e2e=fp-post]').querySelectorAll('.cs-likebar-btn')].find(x => /Bình luận/.test(x.textContent)).click())
await B.waitForSelector('[data-e2e=fp-post] .cs-cmt-composer textarea')
const CMT = 'FEED preview: bình luận vẫn hoạt động'
await B.type('[data-e2e=fp-post] .cs-cmt-composer textarea', CMT); await B.click('[data-e2e=fp-post] .cs-cmt-composer .cs-cmt-send')
await waitFor(B, t => [...document.querySelectorAll('[data-e2e=fp-post] .cs-cmt-body')].some(e => e.textContent.includes(t)), CMT)
await B.evaluate(() => [...document.querySelector('[data-e2e=fp-post]').querySelectorAll('.cs-likebar-btn')].find(x => /Thích/.test(x.textContent))?.click()); await sleep(500)
ok('3 Thanh Thích / Bình luận vẫn có và bình luận gửi được ngay dưới thẻ có xem trước')

// ── 4. Bấm xem trước → mở đúng đoạn trong LessonScore gốc ──
await B.goto(ME, { waitUntil: 'networkidle0' })
await waitFor(B, () => document.querySelector('[data-testid="share-note-preview"][data-live="1"] .at-surface svg') || document.querySelectorAll('[data-testid="share-note-post"]').length)
await B.evaluate(() => document.querySelector('[data-testid="share-note-post"]').scrollIntoView({ block: 'center' }))
await waitFor(B, () => document.querySelector('[data-testid="share-note-preview"][data-live="1"] .at-surface svg'))
await sleep(500)
const href = await B.evaluate(() => document.querySelector('.cs-sn-preview').getAttribute('href'))
assert.match(href, /\/sessions\/1\?note=[0-9a-f-]{36}$/)
await Promise.all([B.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => null), B.evaluate(() => document.querySelector('.cs-sn-preview').click())])
await B.waitForSelector('.lsn-share-hl.is-focus', { timeout: 40000 })
assert.ok(new URL(B.url()).search.includes('note='), 'đã sang trang Buổi với ?note=')
await B.screenshot({ path: `${SHOTS}/fp-4-b-mo-dung-doan.png` })
ok('4 Bấm vào bản nhạc xem trước → trang Buổi (LessonScore gốc) tại đúng đoạn, vùng tô hiện')

// ── 5. Bình (iPhone 390): trích đoạn gọn, không tràn ngang ──
const B3 = await open('B', 390, 844)
await B3.goto(ME, { waitUntil: 'networkidle0' })
await waitFor(B3, n => document.querySelectorAll('[data-testid="share-note-post"]').length >= n, QS.length)
await B3.evaluate(() => document.querySelector('[data-testid="share-note-post"]').scrollIntoView({ block: 'center' }))
await waitFor(B3, () => document.querySelector('[data-testid="share-note-preview"][data-live="1"] .at-surface svg')); await sleep(900)
const idx3 = await B3.evaluate(() => [...document.querySelectorAll('[data-testid="share-note-post"]')].findIndex(e => e.querySelector('[data-live="1"] .at-surface svg')))
const q3 = (await cardOrder(B3))[idx3], [a3, b3] = RANGES[q3]
const bars3 = await printedBars(B3, idx3)
assert.ok(bars3.length > 0 && Math.min(...bars3) === a3, `mobile: số ô bắt đầu đúng ${a3}: ${bars3}`)
assert.ok(await noHScroll(B3), 'mobile không tràn ngang')
const h3 = await B3.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].getBoundingClientRect().height, idx3)
assert.ok(h3 < 700, `thẻ gọn trên điện thoại (cao ${Math.round(h3)}px)`)
await B3.screenshot({ path: `${SHOTS}/fp-5-b-iphone-feed.png` })
ok(`5 Bình (iPhone 390): trích đoạn từ ô ${a3} (in ra ${bars3}), thẻ cao ${Math.round(h3)}px, không tràn ngang`)

// ── 6. Chi (lớp khác): chỉ câu hỏi + "chưa có quyền"; KHÔNG đọc giáo trình ──
const C = await open('C', 390, 844)
await C.goto(ME, { waitUntil: 'networkidle0' })
await waitFor(C, n => document.querySelectorAll('[data-testid="share-note-post"]').length >= n, QS.length)
for (let i = 0; i < QS.length; i++) { await C.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), i); await sleep(500) }
await waitFor(C, n => [...document.querySelectorAll('[data-testid="share-note-post"]')].filter(e => /chưa có quyền xem bản nhạc/.test(e.textContent)).length >= n, QS.length)
const cNo = await C.evaluate(() => ({ surfaces: document.querySelectorAll('.at-surface').length, previews: document.querySelectorAll('[data-testid="share-note-preview"]').length }))
assert.deepEqual(cNo, { surfaces: 0, previews: 0 })
const leaked = C.reqs.filter(u => /class_lesson_content|class_sessions/.test(u))
assert.equal(leaked.length, 0, `Chi không được đọc giáo trình/buổi: ${leaked.slice(0, 2)}`)
await C.screenshot({ path: `${SHOTS}/fp-6-c-khong-quyen.png` })
ok('6 Chi (lớp khác): 6 thẻ chỉ câu hỏi + "chưa có quyền xem bản nhạc"; 0 bản nhạc; 0 yêu cầu đọc class_lesson_content / class_sessions')

// ── 7. Bản nhạc đổi → stale: không vẽ nhạc, giữ câu hỏi (rồi khôi phục) ──
const T = await open('T'); await T.goto(ME, { waitUntil: 'networkidle0' }); assert.ok(T.api)
const orig = await rest(T, `/rest/v1/class_lesson_content?session_id=eq.${S1}&select=blocks`)
const changed = JSON.parse(JSON.stringify(orig.body[0].blocks)); changed[SECTION].tex += ' | r.1'
const p1 = await rest(T, `/rest/v1/class_lesson_content?session_id=eq.${S1}`, { method: 'PATCH', body: JSON.stringify({ blocks: changed }), headers: { Prefer: 'return=minimal' } })
assert.ok(p1.status === 200 || p1.status === 204, `Thầy sửa nhạc: ${p1.status}`)
try {
  const B2 = await open('B', 1280, 900)
  await B2.goto(ME, { waitUntil: 'networkidle0' })
  await waitFor(B2, n => document.querySelectorAll('[data-testid="share-note-post"]').length >= n, QS.length)
  for (let i = 0; i < QS.length; i++) { await B2.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), i); await sleep(500) }
  await waitFor(B2, n => [...document.querySelectorAll('[data-testid="share-note-post"]')].filter(e => /đã được cập nhật/.test(e.textContent)).length >= n, QS.length)
  const st = await B2.evaluate(() => ({ surfaces: document.querySelectorAll('.at-surface').length, qs: [...document.querySelectorAll('[data-testid="share-note-post"]')].every(e => /FEED-\d/.test(e.textContent)) }))
  assert.deepEqual(st, { surfaces: 0, qs: true })
  await B2.screenshot({ path: `${SHOTS}/fp-7-b-stale.png` })
  ok('7 Thầy sửa bản nhạc → 6 thẻ báo "đã được cập nhật", giữ câu hỏi, KHÔNG vẽ nhạc (không tô đoạn có thể sai)')
} finally {
  const back = await rest(T, `/rest/v1/class_lesson_content?session_id=eq.${S1}`, { method: 'PATCH', body: JSON.stringify({ blocks: orig.body[0].blocks }), headers: { Prefer: 'return=minimal' } })
  assert.ok(back.status === 200 || back.status === 204, `khôi phục bản nhạc: ${back.status}`)
}

assert.deepEqual(errors, [], 'không có pageerror / console error:\n' + errors.join('\n'))
ok('không có pageerror / console error')
console.log(`E2E SHARE NOTE FEED PREVIEW: ${pass} PASS`)
await browser.close()
