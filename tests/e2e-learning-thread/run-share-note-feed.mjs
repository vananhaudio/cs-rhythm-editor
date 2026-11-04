// E2E Share Note FEED PREVIEW V1 trong Chrome thật — xem scripts/e2e-share-note.sh (chạy TRƯỚC run-share-note.mjs: dữ liệu còn nguyên).
// An tạo 6 ghi chú (dải ô khác nhau) bằng chính RPC rồi đăng Feed. Bình (cùng lớp) thấy TRÍCH ĐOẠN vẽ trực tiếp (≤ 4 ô), đúng số ô gốc;
// Chi (lớp khác) chỉ thấy câu hỏi + "chưa có quyền", KHÔNG có yêu cầu đọc giáo trình; cuộn Feed 6 thẻ: ≤ 2 renderer sống, không rò rỉ;
// bấm xem trước → mở đúng đoạn; Thích/Bình luận còn nguyên; bản nhạc đổi (stale) → không vẽ nhạc;
// bản nhạc CÓ LỜI trên điện thoại 390: ≤ 2 dòng, không tràn ngang, đủ lời hát, khoảng trắng đáy gọn mà không cắt nội dung (quét điểm ảnh).
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
// Khoảng trắng đáy bằng ĐIỂM ẢNH của khung bản nhạc trong thẻ i: mực cuối cách đáy khung bao nhiêu px; mực chạm mép đáy = bị cắt
const inkGap = async (page, i) => {
  const card = (await page.$$('[data-testid="share-note-post"]'))[i]; const host = await card.$('.cs-sn-preview .lsn-score-host')
  const b64 = await host.screenshot({ encoding: 'base64' })
  return page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data; const dpr = devicePixelRatio || 1
    let last = -1
    for (let y = c.height - 1; y >= 0 && last < 0; y--) for (let xx = 0; xx < c.width; xx++) { const k = (y * c.width + xx) * 4; if (d[k + 3] > 0 && (d[k] < 225 || d[k + 1] < 225 || d[k + 2] < 225)) { last = y; break } }
    return { h: c.height / dpr, ink: (last + 1) / dpr, dpr }
  }, b64)
}
const assertTrim = (g, tag) => { assert.ok(g.h - g.ink <= 22, `${tag}: trắng đáy gọn (${Math.round(g.h - g.ink)}px)`); assert.ok(g.h - g.ink >= 2 / g.dpr + 1, `${tag}: KHÔNG cắt mất nội dung (mực không chạm mép đáy; trắng ${Math.round(g.h - g.ink)}px)`) }
// Số dòng nhạc trong thẻ i = số khóa Sol (U+E050 của font nhạc) — mỗi dòng nhạc có đúng một
const rowsOf = (page, i) => page.evaluate(i => [...document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelectorAll('svg text')].filter(t => t.textContent.includes('\uE050')).length, i)
const cardText = (page, i) => page.evaluate(i => [...document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelectorAll('svg text')].map(t => t.textContent.trim()), i)
// ── V1.1: ngữ cảnh quanh vùng khoanh. Kế hoạch (data-plan = ô bắt đầu vẽ, số ô vẽ, ô khoanh đầu, ô khoanh cuối) so với bảng TÍNH TAY theo luật Owner:
//    ≤ 2 ô trước + ≤ 2 ô sau vào chỗ còn trống (thẻ Feed desktop rộng ~560px → 2 ô/dòng × 2 dòng = 4; iPhone không lời 2 ô/dòng × 2 dòng = 4), thiếu chỗ giảm ngữ cảnh trước khi cắt vùng khoanh.
const EXPECT = { // RANGES[i] → [start, focusFrom, focusTo]
  desktop: [[2, 3, 4], [1, 1, 4], [6, 7, 7], [12, 12, 14], [20, 20, 23], [4, 5, 6]],
  iphone: [[2, 3, 4], [1, 1, 4], [6, 7, 7], [12, 12, 14], [20, 20, 23], [4, 5, 6]],
}
const planOf = (page, i) => page.evaluate(i => (document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('[data-testid="share-note-preview"]').getAttribute('data-plan') || '').split(',').map(Number), i)
// Tô cam CHỈ ở vùng khoanh: (a) có ô tô, nằm gọn trong khung; (b) trong ô tô nền ngả cam, nốt vẫn ĐẬM (không mờ); (c) ngay ngoài ô tô (ô ngữ cảnh) trắng sạch
const tintCheck = async (page, i, { before, after }, tag) => {
  const card = (await page.$$('[data-testid="share-note-post"]'))[i]; const prev = await card.$('.cs-sn-preview')
  const boxes = await page.evaluate(i => { const pv = document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('.cs-sn-preview'); const r0 = pv.getBoundingClientRect()
    return [...pv.querySelectorAll('.lsn-excerpt-hl')].map(e => { const r = e.getBoundingClientRect(); return { l: r.left - r0.left, t: r.top - r0.top, w: r.width, h: r.height } }) }, i)
  assert.ok(boxes.length >= 1, `${tag}: có vùng tô cam`)
  const b64 = await prev.screenshot({ encoding: 'base64' })
  const res = await page.evaluate(async (b64, boxes) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const k = img.width / (document.querySelector('.cs-sn-preview')?.getBoundingClientRect().width || img.width)
    const px = (X, Y) => { const d = x.getImageData(Math.round(X * k), Math.round(Y * k), 1, 1).data; return [d[0], d[1], d[2]] }
    const out = { inside: [], outsideL: null, outsideR: null, minLum: 255 }
    const first = boxes[0], last = boxes[boxes.length - 1]
    for (const b of boxes) out.inside.push(px(b.l + 6, b.t + 3))
    out.outsideL = px(first.l - 8, first.t + 3); out.outsideR = px(last.l + last.w + 8, last.t + 3)
    for (const b of boxes) { const d = x.getImageData(Math.round(b.l * k), Math.round(b.t * k), Math.max(1, Math.round(b.w * k)), Math.max(1, Math.round(b.h * k))).data; for (let n = 0; n < d.length; n += 4) out.minLum = Math.min(out.minLum, (d[n] + d[n + 1] + d[n + 2]) / 3) }
    return out
  }, b64, boxes)
  for (const p of res.inside) assert.ok(p[2] < 248 && p[0] > p[2], `${tag}: nền ô khoanh ngả cam (${p})`)
  assert.ok(res.minLum < 110, `${tag}: nốt / TAB trong vùng tô vẫn đậm, không mờ (sáng nhất-tối nhất ${Math.round(res.minLum)})`)
  if (before > 0) assert.ok(res.outsideL.every(v => v >= 250), `${tag}: ô ngữ cảnh TRƯỚC không tô (${res.outsideL})`)
  if (after > 0) assert.ok(res.outsideR.every(v => v >= 250), `${tag}: ô ngữ cảnh SAU không tô (${res.outsideR})`)
  return boxes.length
}
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
const plan0 = await planOf(B, firstIdx), [es0, ef0, et0] = EXPECT.desktop[q]
assert.deepEqual([plan0[0], plan0[2], plan0[3]], [es0, ef0, et0], `kế hoạch vẽ (bắt đầu, khoanh từ, khoanh đến) = bảng tính tay: ${plan0}`)
assert.equal(Math.min(...bars0), es0, `số ô in ra bắt đầu ĐÚNG ô ${es0} (gồm ngữ cảnh trước): ${bars0}`)
assert.ok(plan0[1] <= 4, `tổng ô vẽ ≤ 4 (2 ô/dòng × 2 dòng): ${plan0[1]}`)
assert.ok((await rowsOf(B, firstIdx)) <= 2, 'desktop ≤ 2 dòng khuông nhạc')
const label0 = await B.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('.cs-tool-share-detail').textContent, firstIdx)
const ctx0 = { before: fa - es0, after: plan0[1] - (fa - es0) - (et0 - ef0 + 1) }
const tint0 = await tintCheck(B, firstIdx, ctx0, 'desktop')
assert.equal(label0.includes('hiện 4 ô đầu'), fb - fa + 1 > 4, label0)
assert.ok(await noHScroll(B), 'không tràn ngang')
const gap1 = await inkGap(B, firstIdx); assertTrim(gap1, 'desktop')
await B.screenshot({ path: `${SHOTS}/fp-1-b-desktop-feed.png` })
ok(`1 Bình (desktop): thẻ Feed "${QS[q].slice(0, 22)}…" vẽ TRỰC TIẾP trích đoạn từ ô ${fa} (số ô in ra ${bars0}), nhãn "${label0}", không tràn ngang, trắng đáy ${Math.round(gap1.h - gap1.ink)}px (không cắt nội dung)`)

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
const plan3 = await planOf(B3, idx3), [es3, ef3, et3] = EXPECT.iphone[q3]
assert.deepEqual([plan3[0], plan3[2], plan3[3]], [es3, ef3, et3], `mobile: kế hoạch vẽ = bảng tính tay: ${plan3}`)
assert.equal(Math.min(...bars3), es3, `mobile: số ô in ra bắt đầu đúng ${es3}: ${bars3}`)
assert.ok(plan3[1] <= 4 && (await rowsOf(B3, idx3)) <= 2, `mobile ≤ 2 dòng, ≤ 4 ô (${plan3[1]} ô, ${await rowsOf(B3, idx3)} dòng)`)
await tintCheck(B3, idx3, { before: a3 - es3, after: plan3[1] - (a3 - es3) - (et3 - ef3 + 1) }, 'iphone')
assert.ok(await noHScroll(B3), 'mobile không tràn ngang')
const h3 = await B3.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].getBoundingClientRect().height, idx3)
assert.ok(h3 < 760, `thẻ không dài hơn mức tối đa của V1 (2 dòng ≈ 720px) trên điện thoại (cao ${Math.round(h3)}px)`)
const gap3 = await inkGap(B3, idx3); assertTrim(gap3, 'iPhone')
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


// ── 8. Bản nhạc CÓ LỜI trên điện thoại 390 (Buổi 2 · Diễm xưa: bản có lời chỉ 1 ô/dòng → tối đa 2 ô / 2 dòng) ──
const S2 = '51000000-0000-4000-8000-000000000002'
const les2 = await rest(A, `/rest/v1/class_lesson_content?session_id=eq.${S2}&select=blocks`)
const SECTION2 = les2.body[0].blocks.map((b, i) => (b.kind === 'score' && /\\lyrics/.test(b.tex ?? '') ? i : -1)).filter(i => i >= 0).pop()
assert.ok(SECTION2 >= 0, 'Buổi 2 có khối nhạc có lời')
const LQ = ['LYR-1 Ô 5–8: lời chỗ này hát thế nào?', 'LYR-2 Ô 9: ô này đọc sao?']
for (const [k, [a, b]] of [[5, 8], [9, 9]].entries()) {
  const c = await rpc(A, 'share_note_create', { p_session: S2, p_section: SECTION2, p_path: ['tex'], p_from: a, p_to: b, p_note: LQ[k], p_client_key: `feedprev-lyr-${k}-${Date.now()}` })
  assert.equal(c.status, 200, `tạo ghi chú có lời ${k + 1}: ${JSON.stringify(c.body)}`)
  const p = await rpc(A, 'social_share_share_note', { p_note: c.body }); assert.equal(p.status, 200, `đăng Feed có lời ${k + 1}: ${JSON.stringify(p.body)}`)
  await sleep(1100)
}
const L = await open('B', 390, 844)
await L.goto(ME, { waitUntil: 'networkidle0' })
await waitFor(L, n => document.querySelectorAll('[data-testid="share-note-post"]').length >= n, QS.length + LQ.length)
const lyrIdx = await L.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].findIndex(e => e.textContent.includes(q)), LQ[0])
assert.ok(lyrIdx >= 0, 'thẻ LYR-1 có trên Feed')
await L.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), lyrIdx)
await waitFor(L, i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('[data-live="1"] .at-surface svg'), lyrIdx)
await waitFor(L, i => !document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('.lsn-score-msg'), lyrIdx); await sleep(900)
const rows = await rowsOf(L, lyrIdx), barsL = await printedBars(L, lyrIdx), txt = await cardText(L, lyrIdx)
assert.equal(rows, 2, `bản có lời trên 390: đúng 2 dòng (có ${rows})`)
assert.deepEqual(barsL, [5, 6], `chỉ ô 5 và 6 (2 ô đầu của dải 5–8): ${barsL}`)
for (const w of ['Nghe', 'lá', 'thu', 'mưa', 'reo', 'mòn', 'gót', 'nhỏ']) assert.ok(txt.includes(w), `đủ lời hát ô 5–6: thiếu "${w}"`)
assert.ok(!txt.includes('Đường'), 'không vẽ lời của ô 7 (ngoài 2 ô đầu)')
const labelL = await L.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('.cs-tool-share-detail').textContent, lyrIdx)
assert.match(labelL, /Ô 5–8 · hiện 2 ô đầu/)
assert.ok(await noHScroll(L), 'không tràn ngang')
const gapL = await inkGap(L, lyrIdx); assertTrim(gapL, 'có lời')
assert.deepEqual(await planOf(L, lyrIdx), [5, 2, 5, 6], 'Ô 5–8 có lời @390: vùng khoanh chiếm đủ 2 chỗ → KHÔNG ngữ cảnh (không lấn vùng khoanh)')
await tintCheck(L, lyrIdx, { before: 0, after: 0 }, 'có lời')
const hL = await L.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].getBoundingClientRect().height, lyrIdx)
await L.screenshot({ path: `${SHOTS}/fp-8-b-iphone-co-loi.png` })
ok(`8a Bản nhạc CÓ LỜI @390: đúng 2 dòng, ô in ra ${barsL}, đủ lời "Nghe lá thu mưa reo mòn gót nhỏ", không có lời ô 7, nhãn "${labelL}", không tràn ngang, trắng đáy ${Math.round(gapL.h - gapL.ink)}px, thẻ cao ${Math.round(hL)}px`)
// LYR-2: một ô
const lyr2 = await L.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].findIndex(e => e.textContent.includes(q)), LQ[1])
await L.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), lyr2)
await waitFor(L, i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('[data-live="1"] .at-surface svg'), lyr2); await sleep(900)
assert.deepEqual(await planOf(L, lyr2), [9, 2, 9, 9], 'Ô 9 có lời @390: 2 chỗ → vùng khoanh 1 ô + 1 ô ngữ cảnh SAU (ô 10), không ngữ cảnh trước')
assert.deepEqual(await printedBars(L, lyr2), [9, 10]); assert.equal(await rowsOf(L, lyr2), 2)
await tintCheck(L, lyr2, { before: 0, after: 1 }, 'có lời 1 ô')
assertTrim(await inkGap(L, lyr2), 'có lời 1 ô')
await L.screenshot({ path: `${SHOTS}/fp-8-b-iphone-co-loi-1o.png` })
ok('8b Dải 1 ô có lời (Ô 9) @390: 2 dòng (ô 9 tô cam + ô 10 ngữ cảnh không tô), trắng đáy gọn')
// Chạm xem trước → mở đúng đoạn (buổi 2, ô 5–8)
await L.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), lyrIdx); await sleep(700)
await Promise.all([L.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => null), L.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('.cs-sn-preview').click(), lyrIdx)])
await L.waitForSelector('.lsn-share-hl.is-focus', { timeout: 40000 })
assert.match(L.url(), /\/sessions\/2\?note=[0-9a-f-]{36}$/)
const panelL = await L.evaluate(() => document.querySelector('.cs-share-note-panel')?.textContent ?? '')
assert.ok(panelL.includes(LQ[0]) && /Ô 5–8/.test(panelL), panelL)
await L.screenshot({ path: `${SHOTS}/fp-8-b-co-loi-mo-dung-doan.png` })
ok('8c Chạm xem trước (bản có lời) → Buổi 2 tại đúng đoạn Ô 5–8, câu hỏi + vùng tô hiện')
// Quyền: Chi (lớp khác) không nhận nhạc có lời
const C2 = await open('C', 390, 844)
await C2.goto(ME, { waitUntil: 'networkidle0' })
await waitFor(C2, q => [...document.querySelectorAll('[data-testid="share-note-post"]')].some(e => e.textContent.includes(q)), LQ[0])
for (let i = 0; i < 2; i++) { await C2.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), i); await sleep(600) }
await waitFor(C2, q => { const e = [...document.querySelectorAll('[data-testid="share-note-post"]')].find(x => x.textContent.includes(q)); return e && /chưa có quyền xem bản nhạc/.test(e.textContent) }, LQ[0])
assert.equal(await C2.evaluate(() => document.querySelectorAll('.at-surface').length), 0)
assert.equal(C2.reqs.filter(u => /class_lesson_content|class_sessions/.test(u)).length, 0, 'Chi không đọc giáo trình có lời')
ok('8d Chi (lớp khác): thẻ bản nhạc có lời chỉ có câu hỏi + "chưa có quyền"; 0 bản nhạc; 0 yêu cầu đọc giáo trình')

// ── 9. BUỔI KHOÁ: Buổi 3 chưa mở với Bình (class_learning_state) → Feed giữ câu hỏi, KHÔNG tải giáo trình, KHÔNG vẽ nhạc ──
const S3 = '51000000-0000-4000-8000-000000000003'
const les3 = await rest(A, `/rest/v1/class_lesson_content?session_id=eq.${S3}&select=blocks`)
const SECTION3 = les3.body[0].blocks.map((b, i) => (b.kind === 'score' ? i : -1)).filter(i => i >= 0).pop()
assert.ok(SECTION3 >= 0, 'Buổi 3 có khối nhạc')
const KQ = 'LOCK-1 Ô 1–2: buổi chưa mở mà em đã hỏi'
{ const c = await rpc(A, 'share_note_create', { p_session: S3, p_section: SECTION3, p_path: ['tex'], p_from: 1, p_to: 2, p_note: KQ, p_client_key: `feedprev-lock-${Date.now()}` })
  assert.equal(c.status, 200, `tạo ghi chú Buổi 3: ${JSON.stringify(c.body)}`)
  const p = await rpc(A, 'social_share_share_note', { p_note: c.body }); assert.equal(p.status, 200, `đăng Feed Buổi 3: ${JSON.stringify(p.body)}`) }
const K = await open('B', 390, 844)
await K.goto(ME, { waitUntil: 'networkidle0' })
await waitFor(K, q => [...document.querySelectorAll('[data-testid="share-note-post"]')].some(e => e.textContent.includes(q)), KQ)
const lockIdx = await K.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].findIndex(e => e.textContent.includes(q)), KQ)
await K.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), lockIdx)
await waitFor(K, i => /chưa mở cho bạn/.test(document.querySelectorAll('[data-testid="share-note-post"]')[i].textContent), lockIdx); await sleep(900)
const lockCard = await K.evaluate(i => { const e = document.querySelectorAll('[data-testid="share-note-post"]')[i]; return { text: e.textContent, svg: e.querySelectorAll('svg.at-surface-svg, .at-surface svg').length, prev: e.querySelectorAll('[data-testid="share-note-preview"]').length, cta: !!e.querySelector('a.cs-tool-share-cta') } }, lockIdx)
assert.ok(lockCard.text.includes(KQ), 'giữ nguyên câu hỏi'); assert.equal(lockCard.svg, 0, 'KHÔNG vẽ nhạc'); assert.equal(lockCard.prev, 0, 'không có khung xem trước'); assert.ok(lockCard.cta)
assert.equal(K.reqs.filter(u => u.includes(S3) || /session_number=eq\.3\b/.test(decodeURIComponent(u))).length, 0, 'KHÔNG có yêu cầu nào đọc giáo trình / lịch của Buổi 3 (không tải byte nhạc)')
assert.ok(K.reqs.some(u => /share_note_session_open/.test(u)), 'đã hỏi RPC chỉ-đọc khoá buổi')
assert.ok(await noHScroll(K), 'không tràn ngang')
await K.screenshot({ path: `${SHOTS}/fp-9-b-iphone-buoi-khoa.png` })
ok('9a Buổi 3 KHOÁ với Bình: giữ câu hỏi + "Buổi này chưa mở cho bạn…", 0 bản nhạc, 0 yêu cầu đọc giáo trình / lịch Buổi 3')
// Bình vẫn xem được thẻ Buổi 2 (đã mở) ngay trong cùng Feed: kiểm lại ở trang này
const open2 = await K.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].findIndex(e => e.textContent.includes(q)), LQ[0])
await K.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), open2)
await waitFor(K, i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('[data-live="1"] .at-surface svg'), open2)
ok('9b Buổi 2 (đã mở) trong cùng Feed vẫn vẽ nhạc bình thường')

assert.deepEqual(errors, [], 'không có pageerror / console error:\n' + errors.join('\n'))
ok('không có pageerror / console error')
console.log(`E2E SHARE NOTE FEED PREVIEW: ${pass} PASS`)
await browser.close()
