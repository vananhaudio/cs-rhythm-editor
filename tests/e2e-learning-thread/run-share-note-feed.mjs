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
    out.outsideL = first.l - 3 >= 0 ? px(first.l - 3, first.t + 3) : null
    out.outsideR = last.l + last.w + 3 < img.width / k ? px(last.l + last.w + 3, last.t + 3) : null   // vùng tô chiếm hết bề ngang (1 ô/dòng): ô ngữ cảnh nằm DÒNG DƯỚI, không ở bên phải
    for (const b of boxes) { const d = x.getImageData(Math.round(b.l * k), Math.round(b.t * k), Math.max(1, Math.round(b.w * k)), Math.max(1, Math.round(b.h * k))).data; for (let n = 0; n < d.length; n += 4) out.minLum = Math.min(out.minLum, (d[n] + d[n + 1] + d[n + 2]) / 3) }
    return out
  }, b64, boxes)
  for (const p of res.inside) assert.ok(p[2] < 248 && p[0] > p[2], `${tag}: nền ô khoanh ngả cam (${p})`)
  assert.ok(res.minLum < 110, `${tag}: nốt / TAB trong vùng tô vẫn đậm, không mờ (sáng nhất-tối nhất ${Math.round(res.minLum)})`)
  if (before > 0 && res.outsideL) assert.ok(res.outsideL.every(v => v >= 250), `${tag}: ô ngữ cảnh TRƯỚC không tô (${res.outsideL})`)
  if (after > 0 && res.outsideR) assert.ok(res.outsideR.every(v => v >= 250), `${tag}: ô ngữ cảnh SAU không tô (${res.outsideR})`)
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
const h3x = await B3.evaluate(i => { const c = document.querySelectorAll('[data-testid="share-note-post"]')[i], x = c.querySelector('[data-testid="context-section"]'), sc = c.querySelector('.cs-sn-preview .lsn-score')
  return { card: c.getBoundingClientRect().height, frame: x && sc ? x.getBoundingClientRect().height - sc.getBoundingClientRect().height : 0 } }, idx3)
// Khung giáo trình gốc (tiêu đề / nhãn / mô tả) là phần NGỮ CẢNH mới của Contextual Share — phần TRÍCH ĐOẠN NHẠC vẫn phải gọn như V1.1 (≤ 2 dòng)
const h3 = h3x.card - h3x.frame
assert.ok(h3 < 760, `thẻ không dài hơn mức tối đa của V1 (2 dòng ≈ 720px) trên điện thoại (phần nhạc+câu hỏi cao ${Math.round(h3)}px; khung giáo trình ${Math.round(h3x.frame)}px)`)
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

// ── 10. UNIVERSAL CONTEXTUAL SHARE: khung giáo trình GỐC quanh vùng khoanh (khối hỗn hợp "Tác phẩm": tiêu đề + dự kiến + tên/tác tác giả/ghi chú/nhịp độ + nhạc) ──
const SECTION_R = les2.body[0].blocks.findIndex(b => b.kind === 'repertoire')   // Buổi 2 (sau bản có lời)
assert.ok(SECTION_R >= 0, 'Buổi 2 có khối repertoire (fixture)')
const CQ = 'CTX-1 Ô 2–3 trong Thành Phố Buồn: đếm phách chỗ này thế nào?'
{
  const c = await rpc(A, 'share_note_create', { p_session: S2, p_section: SECTION_R, p_path: ['pieces', '0', 'tex'], p_from: 2, p_to: 3, p_note: CQ, p_client_key: `ctx-${Date.now()}` })
  assert.equal(c.status, 200, `tạo ghi chú ngữ cảnh: ${JSON.stringify(c.body)}`)
  const p = await rpc(A, 'social_share_share_note', { p_note: c.body }); assert.equal(p.status, 200, `đăng Feed: ${JSON.stringify(p.body)}`)
}
// E2E_HOLD=1: STAGING cục bộ cho Owner nghiệm thu — dừng sau khi dựng dữ liệu giả (DB tạm, KHÔNG production), giữ stack chạy; Ctrl-C / kill để dọn.
if (process.env.E2E_HOLD) {
  console.log(`\nSTAGING_READY ${ME}\n  Đăng nhập: b@test.local (Bình — học viên, thấy khung đầy đủ) · c@test.local (Chi — lớp khác, KHÔNG có quyền) · a@test.local (An — người gửi); mật khẩu bất kỳ\n  Thẻ cần xem: "${CQ}"`)
  await browser.close().catch(() => {}); setInterval(() => {}, 1 << 30); await new Promise(() => {})   // timer giữ tiến trình sống
}
const ctxIdx = page => page.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].findIndex(e => e.textContent.includes(q)), CQ)
const ctxCard = async (page, tag) => {
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await waitFor(page, q => [...document.querySelectorAll('[data-testid="share-note-post"]')].some(e => e.textContent.includes(q)), CQ)
  const i = await ctxIdx(page)
  await page.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), i)
  await waitFor(page, i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('[data-live="1"] .at-surface svg'), i)
  await waitFor(page, i => !document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('.lsn-score-msg'), i); await sleep(900)
  return i
}
const ctxFacts = (page, i) => page.evaluate(i => {
  const card = document.querySelectorAll('[data-testid="share-note-post"]')[i], ctx = card.querySelector('[data-testid="context-section"]')
  const q = s => ctx?.querySelector(s)?.textContent?.trim() ?? null
  const surf = card.querySelector('.at-surface'), h2 = ctx?.querySelector('h2'), piece = ctx?.querySelector('.lsn-piece')
  return { has: !!ctx, text: ctx?.textContent ?? '', tag: q('.lsn-tag'), h2: q('h2'), list: q('.lsn-rep-list'), h3: q('.lsn-piece-h h3'), by: q('.lsn-piece-by'), note: q('.lsn-piece-note'), tempo: q('.lsn-tempo'),
    surfaces: card.querySelectorAll('.at-surface').length, pieces: ctx?.querySelectorAll('.lsn-piece').length ?? 0,
    headerBeforeScore: !!(h2 && surf && (h2.compareDocumentPosition(surf) & Node.DOCUMENT_POSITION_FOLLOWING)),
    scoreInsidePiece: !!(piece && surf && piece.contains(surf)), h: Math.round(card.getBoundingClientRect().height) }
}, i)
const WANT = { tag: 'Tác phẩm', h2: 'Tác phẩm thực hành', h3: 'Thành Phố Buồn', by: 'Lam Phương · chuyển về Am', note: 'Đoạn mô tả nguyên văn của tác phẩm thực hành.', tempo: 'Slow rock · chậm, đủ chỗ cho nhịp chùm ba' }
const assertCtx = (f, tag) => {
  assert.ok(f.has, `${tag}: có khung ngữ cảnh`)
  for (const [k, v] of Object.entries(WANT)) assert.equal(f[k], v, `${tag}: ${k} nguyên văn`)
  assert.equal(f.list, null, `${tag}: khung MẶC ĐỊNH gọn — danh sách "Dự kiến" nằm sau "Xem thêm ngữ cảnh"`)
  assert.ok(!f.text.includes('vào nhịp chùm ba') && !f.text.includes('Giữ nhịp chùm ba'), `${tag}: marks / guidance nằm sau "Xem thêm ngữ cảnh"`)
  assert.equal(f.pieces, 1, `${tag}: chỉ MỘT tác phẩm (đúng tác phẩm được chia sẻ)`); assert.ok(!f.text.includes('TÁC PHẨM KHÁC'), `${tag}: tác phẩm khác không bị kéo vào`)
  assert.equal(f.surfaces, 1, `${tag}: đúng 1 bề mặt nhạc`); assert.ok(f.headerBeforeScore && f.scoreInsidePiece, `${tag}: thứ tự gốc (tiêu đề → tác phẩm → nhạc) và nhạc nằm trong khối tác phẩm`)
}
// 10a. Desktop
const D10 = await open('B', 1280, 900)
const di = await ctxCard(D10, 'desktop'); const df = await ctxFacts(D10, di); assertCtx(df, 'desktop')
const dPlan = await planOf(D10, di)
assert.deepEqual(dPlan.slice(2), [2, 3], `vùng khoanh Ô 2–3 đúng: ${dPlan}`)
const dHl = await tintCheck(D10, di, { before: dPlan[1] > 0 && dPlan[0] < 2 ? 1 : 0, after: 0 }, 'ngữ cảnh desktop')
assert.ok(await noHScroll(D10), 'desktop không tràn ngang')
await (await D10.$$('[data-testid="share-note-post"]'))[di].screenshot({ path: `${SHOTS}/ctx-10a-desktop.png` })
ok(`10a Desktop: khung gốc nguyên văn (tiêu đề "${df.h2}", ${df.by}, nhịp "${df.tempo}"), 1 tác phẩm, nhạc trong khối tác phẩm, vùng khoanh Ô 2–3 tô (${dHl} hình), thẻ cao ${df.h}px`)
// 10b. So với TRANG BUỔI GỐC: cùng văn bản
const href10 = await D10.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('.cs-sn-preview').getAttribute('href'), di)
await Promise.all([D10.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => null), D10.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('.cs-sn-preview').click(), di)])
await D10.waitForSelector('.lsn-share-hl.is-focus', { timeout: 40000 })
const orig10 = await D10.evaluate(() => { const q = (r, s) => r?.querySelector(s)?.textContent?.trim() ?? null; const rep = [...document.querySelectorAll('.lsn-block')].find(b => b.querySelector('.lsn-rep')); const p = rep?.querySelector('.lsn-piece')
  return { tag: q(rep, '.lsn-tag'), h2: q(rep, 'h2'), list: q(rep, '.lsn-rep-list'), h3: q(p, '.lsn-piece-h h3'), by: q(p, '.lsn-piece-by'), note: q(p, '.lsn-piece-note'), tempo: q(p, '.lsn-tempo') } })
for (const k of ['tag', 'h2', 'h3', 'by', 'note', 'tempo']) assert.equal(df[k], orig10[k], `10b: "${k}" trên Feed GIỐNG HỆT trang Buổi gốc`)
assert.match(href10, /\/sessions\/2\?note=/)
assert.ok(await D10.evaluate(() => document.querySelectorAll('.lsn-share-hl.is-focus').length >= 1), 'mở đúng nguồn, vùng chọn tô')
ok('10b Văn bản khung trên Feed GIỐNG HỆT trang Buổi gốc (nhãn, tiêu đề, dự kiến, tác phẩm, tác giả, ghi chú, nhịp độ); bấm → mở đúng nguồn + tô đúng vùng chọn')
// 10c. iPhone 390
const P10 = await open('B', 390, 844)
const pi = await ctxCard(P10, 'iphone'); const pf = await ctxFacts(P10, pi); assertCtx(pf, 'iphone')
const pPlan = await planOf(P10, pi); assert.deepEqual(pPlan.slice(2), [2, 3], `iPhone: vùng khoanh Ô 2–3: ${pPlan}`)
await tintCheck(P10, pi, { before: 0, after: 0 }, 'ngữ cảnh iphone')
assert.ok(await noHScroll(P10), 'iPhone không tràn ngang')
const cardOverflow = await P10.evaluate(i => { const c = document.querySelectorAll('[data-testid="share-note-post"]')[i]; return c.scrollWidth <= c.clientWidth + 1 }, pi)
assert.ok(cardOverflow, 'iPhone: thẻ không tràn ngang')
const gap10 = await inkGap(P10, pi); assertTrim(gap10, 'ngữ cảnh iphone')
await (await P10.$$('[data-testid="share-note-post"]'))[pi].screenshot({ path: `${SHOTS}/ctx-10c-iphone.png` })
ok(`10c iPhone 390: cùng khung gốc, không tràn ngang, không cắt nhạc, thẻ cao ${pf.h}px`)
// 10g. "Xem thêm ngữ cảnh" (iPhone): mở rộng ngay trong Feed, KHÔNG dựng lại bản nhạc, KHÔNG đổi vùng khoanh, giữ thứ tự + renderer gốc
{
  const compactH = pf.h
  const info = () => P10.evaluate(i => {
    const c = document.querySelectorAll('[data-testid="share-note-post"]')[i], x = c.querySelector('[data-testid="context-section"]')
    const surf = c.querySelector('.at-surface'), btn = c.querySelector('[data-testid="share-note-more"]')
    const pos = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING))
    const list = x?.querySelector('.lsn-rep-list'), marks = x?.querySelector('.lsn-marks'), guide = x?.querySelector('.lsn-guide')
    return { h: Math.round(c.getBoundingClientRect().height), btn: btn?.textContent?.trim() ?? null, exp: btn?.getAttribute('aria-expanded') ?? null, btnInsideA: !!btn?.closest('a'),
      plan: c.querySelector('[data-testid="share-note-preview"]').getAttribute('data-plan'), hl: c.querySelectorAll('.lsn-excerpt-hl').length, surfaces: c.querySelectorAll('.at-surface').length, mark: surf?.dataset.mk ?? null,
      list: list?.textContent?.trim() ?? null, marksTxt: marks?.textContent?.trim() ?? null, guideTxt: guide?.textContent?.trim() ?? null,
      order: pos(list, surf) && pos(surf, marks) && pos(marks, guide), assets: c.querySelectorAll('.lsn-assets,.lsn-asset').length, links: [...c.querySelectorAll('a')].map(a => a.className) }
  }, pi)
  const b0 = await info()
  assert.equal(b0.btn, 'Xem thêm ngữ cảnh'); assert.equal(b0.exp, 'false'); assert.ok(!b0.btnInsideA, 'nút không nằm trong liên kết (không lồng tương tác)')
  await P10.evaluate(i => { document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('.at-surface').dataset.mk = 'same-surface' }, pi)
  await P10.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('[data-testid="share-note-more"]').click(), pi)
  await sleep(900)
  const b1 = await info()
  assert.equal(b1.btn, 'Thu gọn ngữ cảnh'); assert.equal(b1.exp, 'true')
  assert.equal(b1.mark, 'same-surface', 'mở rộng KHÔNG dựng lại bản nhạc (cùng một bề mặt alphaTab)')
  assert.equal(b1.plan, b0.plan, 'vùng khoanh + trích đoạn không đổi'); assert.equal(b1.hl, b0.hl); assert.equal(b1.surfaces, 1)
  assert.equal(b1.list, orig10.list, 'Dự kiến nguyên văn như trang Buổi gốc')
  assert.match(b1.marksTxt, /Ô 2\s*vào nhịp chùm ba/); assert.match(b1.guideTxt, /Giữ nhịp chùm ba thật đều tay\./)
  assert.ok(b1.order, 'thứ tự gốc: Dự kiến → bản nhạc → marks → guidance'); assert.equal(b1.assets, 0, 'không có tệp tải về trong khung')
  assert.deepEqual(b1.links, ['cs-sn-preview', 'cs-btn cs-btn-soft cs-tool-share-cta'], 'chỉ còn đường mở nguồn (không thêm thao tác tương tác)')
  assert.ok(await noHScroll(P10), 'iPhone mở rộng: không tràn ngang')
  const gapX = await inkGap(P10, pi); assertTrim(gapX, 'ngữ cảnh iphone mở rộng')
  await tintCheck(P10, pi, { before: 0, after: 0 }, 'ngữ cảnh iphone mở rộng')
  await (await P10.$$('[data-testid="share-note-post"]'))[pi].screenshot({ path: `${SHOTS}/ctx-10g-iphone-expanded.png` })
  await P10.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('[data-testid="share-note-more"]').click(), pi)
  await sleep(600)
  const b2 = await info()
  assert.equal(b2.btn, 'Xem thêm ngữ cảnh'); assert.equal(b2.list, null); assert.equal(b2.plan, b0.plan); assert.equal(b2.mark, 'same-surface')
  ok(`10g iPhone: mặc định ${compactH}px → "Xem thêm ngữ cảnh" ${b1.h}px → thu gọn ${b2.h}px; cùng bề mặt nhạc, cùng vùng khoanh (${b1.plan}), Dự kiến/marks/guidance nguyên văn + đúng thứ tự, không tệp tải về, không tràn ngang`)
}
// 10d. Khối score có mô tả + nhịp độ (lead / tempo nguyên văn)
{
  const i1 = await P10.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].findIndex(e => e.textContent.includes(q)), QS[0])
  await P10.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), i1)
  await waitFor(P10, i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('[data-live="1"] .at-surface svg'), i1)
  const t = await P10.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('[data-testid="context-section"]')?.textContent ?? '', i1)
  assert.ok(t.includes('Thành phố buồn') && t.includes('Đoạn dẫn nguyên văn của Thầy cho bản nhạc này.') && t.includes('♩ = 66') && t.includes('Tác phẩm'), `khối score: tiêu đề + mô tả + nhịp độ nguyên văn: ${t.slice(0, 120)}`)
  assert.ok(!(await P10.evaluate(i => /Chú thích|Gạch/.test(document.querySelectorAll('[data-testid="share-note-post"]')[i].textContent), i1)))
  ok('10d Khối nhạc đơn: tiêu đề + mô tả + nhịp độ nguyên văn quanh trích đoạn')
}
// 10e. Chi (lớp khác): KHÔNG lộ tiêu đề / mô tả / nhạc, 0 yêu cầu đọc giáo trình
const C10 = await open('C', 390, 844)
await C10.goto(ME, { waitUntil: 'networkidle0' })
await waitFor(C10, q => [...document.querySelectorAll('[data-testid="share-note-post"]')].some(e => e.textContent.includes(q)), CQ)
const ci = await ctxIdx(C10); await C10.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), ci)
await waitFor(C10, i => /chưa có quyền xem bản nhạc/.test(document.querySelectorAll('[data-testid="share-note-post"]')[i].textContent), ci)
const cLeak = await C10.evaluate(i => { const t = document.querySelectorAll('[data-testid="share-note-post"]')[i].textContent; return { ctx: !!document.querySelector('[data-testid="context-section"]'), leaks: ['Tác phẩm thực hành', 'Dự kiến', 'Lam Phương', 'Đoạn mô tả', 'Slow rock', 'Đoạn dẫn nguyên văn'].filter(w => t.includes(w)) } }, ci)
assert.deepEqual(cLeak, { ctx: false, leaks: [] }, 'Chi không thấy khung ngữ cảnh / văn bản giáo trình')
assert.equal(C10.reqs.filter(u => /class_lesson_content|class_sessions/.test(u)).length, 0, 'Chi: 0 yêu cầu đọc giáo trình')
assert.ok(!(await C10.content()).includes('Đoạn mô tả nguyên văn của tác phẩm thực hành'), 'HTML của Chi không chứa văn bản giáo trình')
ok('10e Chi (lớp khác): chỉ câu hỏi + "chưa có quyền"; không tiêu đề / dự kiến / ghi chú / nhịp độ / nhạc trong DOM + HTML; 0 yêu cầu đọc giáo trình')
// 10f. Giáo trình thay đổi: sửa tiêu đề (neo vẫn chắc) → hiện bản hiện hành; sửa nhạc / xoá tác phẩm → stale, KHÔNG còn ngữ cảnh nào
{
  const T10 = await open('T'); await T10.goto(ME, { waitUntil: 'networkidle0' })
  const base = await rest(T10, `/rest/v1/class_lesson_content?session_id=eq.${S2}&select=blocks`); const orig = base.body[0].blocks
  const patch = async b => { const r = await rest(T10, `/rest/v1/class_lesson_content?session_id=eq.${S2}`, { method: 'PATCH', body: JSON.stringify({ blocks: b }), headers: { Prefer: 'return=minimal' } }); assert.ok(r.status === 200 || r.status === 204, `PATCH ${r.status}`) }
  const clone = () => JSON.parse(JSON.stringify(orig))
  try {
    let b = clone(); b[SECTION_R].title = 'Tên khối đã sửa'; await patch(b)
    const V = await open('B', 1280, 900); const vi = await ctxCard(V, 'đổi tiêu đề'); const vf = await ctxFacts(V, vi)
    assert.equal(vf.h2, 'Tên khối đã sửa', 'neo vẫn chắc (nhạc không đổi) → khung hiện bản giáo trình HIỆN HÀNH'); assert.equal(vf.surfaces, 1)
    ok('10f-1 Thầy sửa tiêu đề (nhạc không đổi): khung hiện bản hiện hành, vùng khoanh vẫn đúng')
    b = clone(); b[SECTION_R].pieces[0].tex += ' | r.1'; await patch(b)
    const V2 = await open('B', 1280, 900); await V2.goto(ME, { waitUntil: 'networkidle0' })
    await waitFor(V2, q => [...document.querySelectorAll('[data-testid="share-note-post"]')].some(e => e.textContent.includes(q)), CQ)
    const si = await ctxIdx(V2); await V2.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), si)
    await waitFor(V2, i => /đã được cập nhật/.test(document.querySelectorAll('[data-testid="share-note-post"]')[i].textContent), si); await sleep(500)
    const sf = await V2.evaluate(i => { const c = document.querySelectorAll('[data-testid="share-note-post"]')[i]; return { ctx: !!c.querySelector('[data-testid="context-section"]'), surf: c.querySelectorAll('.at-surface').length, q: c.textContent.includes('CTX-1'), leak: /Tên khối đã sửa|Lam Phương|Slow rock/.test(c.textContent) } }, si)
    assert.deepEqual(sf, { ctx: false, surf: 0, q: true, leak: false }, 'nhạc đổi → stale: giữ câu hỏi, không khung, không nhạc, không đoán vị trí')
    ok('10f-2 Thầy sửa nhạc: thẻ báo "đã được cập nhật", giữ câu hỏi, KHÔNG khung ngữ cảnh / nhạc / văn bản giáo trình (fail closed)')
    b = clone(); b[SECTION_R].pieces.shift(); await patch(b)
    const V3 = await open('B', 1280, 900); await V3.goto(ME, { waitUntil: 'networkidle0' })
    await waitFor(V3, q => [...document.querySelectorAll('[data-testid="share-note-post"]')].some(e => e.textContent.includes(q)), CQ)
    const di3 = await ctxIdx(V3); await V3.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), di3)
    await waitFor(V3, i => /đã được cập nhật/.test(document.querySelectorAll('[data-testid="share-note-post"]')[i].textContent), di3)
    assert.equal(await V3.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelectorAll('[data-testid="context-section"], .at-surface').length, di3), 0, 'thẻ CTX-1: không khung, không nhạc')
    ok('10f-3 Tác phẩm bị gỡ/dời chỉ số (piece 0 đã khác): neo không khớp sha → stale, KHÔNG highlight nhầm tác phẩm khác')
  } finally { await patch(orig) }
}

assert.deepEqual(errors, [], 'không có pageerror / console error:\n' + errors.join('\n'))
ok('không có pageerror / console error')
console.log(`E2E SHARE NOTE FEED PREVIEW: ${pass} PASS`)
await browser.close()
