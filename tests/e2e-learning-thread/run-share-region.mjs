// E2E Contextual Share V3 (DỰ THẢO) — KHOANH VÙNG HỖN HỢP, Chrome thật (puppeteer). Xem scripts/e2e-share-note.sh (E2E_SHARE_REGION=1). Chỉ DB tạm; KHÔNG production.
// Phủ: khoanh đoạn chữ / nhiều đoạn / tiêu đề+danh sách / bảng / vùng nhạc / chữ+nhạc / chữ+hình+chữ · cảm ứng giả lập · khung quá nhỏ · đăng Feed + thẻ Feed ·
// người nhận thấy vùng bám PHẦN TỬ khi đổi bề rộng + cuộn · giáo trình đổi (stale) / chèn khối (moved) · người ngoài lớp.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ORIGIN = `http://class.localhost:${V}`, ME = `${ORIGIN}/me`
const EMAIL = { A: 'a@test.local', B: 'b@test.local', C: 'c@test.local' }
const TH01 = 'b1000000-0000-4000-8000-000000000001', S1 = '51000000-0000-4000-8000-000000000001'
const SESSION = `${ME}/classes/${TH01}/sessions/1`
const SHOTS = process.env.SHOTS; mkdirSync(SHOTS, { recursive: true })
const sql = q => execFileSync(`${process.env.E2E_PG_BIN}/psql`, ['-X', '-q', '-tA', '-h', process.env.E2E_PG_SOCK, '-p', process.env.E2E_PG_PORT, '-U', 'postgres', '-d', 'e2e', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim()
const ORIG = sql(`select blocks::text from public.class_lesson_content where session_id = '${S1}'`)
const restore = () => sql(`update public.class_lesson_content set blocks = $q$${ORIG}$q$::jsonb where session_id = '${S1}'`)

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--no-default-browser-check'] })
let pass = 0
const ok = msg => { pass++; console.log('PASS: ' + msg) }
const errors = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitFor = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 25000 }, ...args)

async function open(who, width = 1280, height = 900, touch = false) {
  let ctx
  for (let i = 0; ; i++) { try { ctx = await browser.createBrowserContext(); break } catch (e) { if (i > 2) throw e; await sleep(300) } }
  const page = await ctx.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch })
  page.on('pageerror', e => errors.push(`${who} pageerror: ` + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource|googlevideo|youtube|ytimg|WebAssembly|verovio/i.test(m.text())) errors.push(`${who} console: ` + m.text()) })
  page.rpcs = []
  page.on('request', r => {
    const m = r.url().match(/\/rest\/v1\/rpc\/(\w+)/)
    if (m && r.method() !== 'OPTIONS') { let body = {}; try { body = JSON.parse(r.postData() ?? '{}') } catch { /* GET */ } page.rpcs.push({ fn: m[1], body }) }
  })
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', EMAIL[who]); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  return page
}
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
async function openSession(page, url = SESSION) {
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-sec] .lsn-leaf', { timeout: 30000 })
  await page.waitForSelector('.lsn-score-host .at-surface svg', { timeout: 40000 })
  await sleep(500)
}
/** Hộp (client) của phần tử khớp selector; `scroll`: đưa vào giữa màn hình trước */
const box = (page, sel, scroll = false, i = 0) => page.evaluate((sel, scroll, i) => {
  const e = document.querySelectorAll(sel)[i]; if (!e) return null
  if (scroll) e.scrollIntoView({ block: 'center' })
  const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }
}, sel, scroll, i)
/** Cuộn để đỉnh phần tử nằm ở y (px từ đỉnh màn hình) */
const topAt = (page, sel, y) => page.evaluate((sel, y) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); scrollBy(0, r.top - y) }, sel, y).then(() => sleep(250))
const leaf = (si, p) => `[data-tp="${si}:${p}"]`
async function drag(page, a, b, touch = false) {
  if (touch) { await page.touchscreen.touchStart(a.x, a.y); for (let i = 1; i <= 8; i++) await page.touchscreen.touchMove(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8); await page.touchscreen.touchEnd() }
  else { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 }); await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up() }
  await sleep(250)
}
const summary = page => page.$eval('[data-testid=region-summary]', e => e.textContent).catch(() => null)
const hint = page => page.$eval('[data-testid=region-hint]', e => e.textContent).catch(() => null)
const startRegion = async page => { if (!(await page.$('[data-testid=region-capture]'))) { await page.click('[data-testid=region-start]'); await page.waitForSelector('[data-testid=region-capture]') } }
const redo = async page => { const b = await page.$('[data-testid=region-redo]'); if (b) { await b.click(); await sleep(120) } }
const cancel = async page => { const b = await page.$('[data-testid=region-cancel]'); if (b) { await b.click(); await sleep(150) } }
const outlines = page => page.evaluate(() => [...document.querySelectorAll('.lsn-rg-outline')].map(o => { const r = o.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, approx: o.classList.contains('is-approx'), sec: o.parentElement.dataset.sec } }))
const fills = page => page.evaluate(() => document.querySelectorAll('.lsn-rg-fill').length)
const inflate = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d })
const contains = (o, r) => o.x <= r.x + 1 && o.y <= r.y + 1 && o.x + o.w >= r.x + r.w - 1 && o.y + o.h >= r.y + r.h - 1
const lastRpc = (page, fn) => page.rpcs.filter(r => r.fn === fn).at(-1)

let A, B, C, At
try {
  A = await open('A'); B = await open('B'); C = await open('C'); At = await open('A', 390, 844, true)
  await openSession(A)
  const SI = await A.evaluate(() => { const l = [...document.querySelectorAll('.lsn-leaf')].find(x => x.textContent.includes('nghe kỹ nhịp chùm ba ở ô 2')); return l.closest('[data-sec]').dataset.sec })
  const SC = String(Number(SI) - 1), FR = await A.evaluate(() => document.querySelector('.lsn-fb')?.closest('[data-sec]')?.dataset.sec)
  assert.ok(FR, 'có khối sơ đồ cần đàn'); assert.ok(await A.$(`[data-sec="${SC}"] .lsn-score-host`), 'khối ngay trước study là bản nhạc')
  ok(`0 trang Buổi dựng có [data-sec] cho mọi khối (study=${SI}, nhạc=${SC}, hình=${FR}); nút "Khoanh vùng để hỏi" hiện`)
  assert.ok(await A.$('[data-testid=region-start]') && await A.$('.lsn-share-bar'), 'nút mới + nút khoanh ô nhịp V1.3 cùng có mặt')
  await A.screenshot({ path: `${SHOTS}/v3-0-truoc-khi-khoanh.png` })

  // ── 1. Khoanh một đoạn chữ
  await startRegion(A)
  let r = await box(A, leaf(SI, 'blocks.1.text'), true); r = await box(A, leaf(SI, 'blocks.1.text'))
  await drag(A, { x: r.x - 6, y: r.y - 3 }, { x: r.r + 6, y: r.b + 3 })
  assert.equal(await summary(A), '1 khối · 1 đoạn chữ', 'đoạn chữ: ' + (await summary(A)) + (await hint(A)))
  let o = await outlines(A)
  assert.equal(o.length, 1); assert.ok(contains(o[0], r), 'viền bao đúng đoạn chữ'); assert.ok(await fills(A) >= 1)
  await A.screenshot({ path: `${SHOTS}/v3-1-khoanh-doan-chu.png` })
  ok('1 khoanh MỘT đoạn chữ → "1 khối · 1 đoạn chữ"; viền cam bao đúng đoạn')

  // ── 2. Nhiều đoạn (đoạn + danh sách 3 mục)
  await redo(A)
  const p = await box(A, leaf(SI, 'blocks.1.text')), li = await box(A, leaf(SI, 'blocks.2.items.2'))
  await drag(A, { x: p.x - 6, y: p.y - 3 }, { x: li.r + 6, y: li.b + 3 })
  assert.equal(await summary(A), '1 khối · 4 đoạn chữ', 'nhiều đoạn: ' + (await summary(A)))
  ok('2 khoanh NHIỀU đoạn (1 đoạn + 3 mục danh sách) → "1 khối · 4 đoạn chữ"')

  // ── 3. Tiêu đề + danh sách
  await redo(A)
  const h = await box(A, leaf(SI, 'blocks.0.text'), true); const li2 = await box(A, leaf(SI, 'blocks.2.items.2')); const h2 = await box(A, leaf(SI, 'blocks.0.text'))
  await drag(A, { x: h2.x - 6, y: h2.y - 3 }, { x: li2.r + 6, y: li2.b + 3 })
  assert.equal(await summary(A), '1 khối · 5 đoạn chữ', 'tiêu đề+danh sách: ' + (await summary(A)))
  ok('3 khoanh TIÊU ĐỀ + đoạn + danh sách → "1 khối · 5 đoạn chữ"'); void h

  // ── 4. Bảng (ô tiêu đề + ô nội dung; ô "___" không phải lá)
  await redo(A)
  const t0 = await box(A, leaf(SI, 'blocks.3.rows.0.0'), true), t1 = await box(A, leaf(SI, 'blocks.3.rows.2.0')), t00 = await box(A, leaf(SI, 'blocks.3.rows.0.0')), t01 = await box(A, leaf(SI, 'blocks.3.rows.0.1')), t21 = await box(A, '.lsn-st-table tr:nth-child(2) td:nth-child(2)')
  await drag(A, { x: t00.x - 6, y: t00.y - 4 }, { x: t01.r + 6, y: t1.b + 4 })
  const sm = await summary(A)
  assert.match(sm, /^1 khối · 5 đoạn chữ$/, 'bảng: ' + sm + ' ' + (await hint(A))); void t0; void t21
  await A.screenshot({ path: `${SHOTS}/v3-4-khoanh-bang.png` })
  ok('4 khoanh BẢNG → "1 khối · 5 đoạn chữ" (ô trống "___" không tính)')

  // ── 5. Vùng bản nhạc
  await redo(A)
  await topAt(A, `[data-sec="${SC}"] .at-surface`, 120); let sf = await box(A, `[data-sec="${SC}"] .at-surface`)
  await drag(A, { x: sf.x + sf.w * 0.08, y: sf.y + 12 }, { x: sf.x + sf.w * 0.55, y: sf.y + Math.min(sf.h * 0.4, 150) })
  const sc1 = await summary(A)
  assert.match(sc1 ?? '', /^1 khối · bản nhạc \(ô \d+(–\d+)?\)$/, 'nhạc: ' + sc1 + ' ' + (await hint(A)))
  await A.screenshot({ path: `${SHOTS}/v3-5-khoanh-ban-nhac.png` })
  ok(`5 khoanh VÙNG BẢN NHẠC → "${sc1}"`)

  // ── 6. Hỗn hợp chữ + nhạc: cuối bản nhạc + đầu study
  await redo(A)
  await topAt(A, leaf(SI, 'blocks.0.text'), 700)
  const hh = await box(A, leaf(SI, 'blocks.0.text')); sf = await box(A, `[data-sec="${SC}"] .at-surface`)
  assert.ok(hh && hh.b < 880, 'cả cuối nhạc lẫn tiêu đề study nằm trong màn hình ' + JSON.stringify([sf, hh]))
  await drag(A, { x: sf.x + 8, y: Math.max(30, sf.y + sf.h * 0.6) }, { x: sf.r - 8, y: hh.b + 4 })
  const mix = await summary(A)
  assert.match(mix ?? '', /^2 khối · \d+ đoạn chữ · bản nhạc \(ô \d+(–\d+)?\)$/, 'hỗn hợp: ' + mix + ' ' + (await hint(A)))
  o = await outlines(A); assert.equal(o.length, 2)
  await A.screenshot({ path: `${SHOTS}/v3-6-khoanh-chu-va-nhac.png` })
  ok(`6 khoanh HỖN HỢP chữ + nhạc → "${mix}" — hai viền, mỗi khối một viền`)
  const mixParts = await A.evaluate(() => null)
  void mixParts

  // ── 7. Đăng Feed (hỗn hợp) → server nhận các phần, KHÔNG nhận băm/nội dung
  await A.click('[data-testid=region-ask]')
  await A.waitForSelector('#share-note-text')
  assert.ok((await A.$eval('[data-testid=composer-region]', e => e.textContent)).includes('Vùng khoanh:'))
  await A.type('#share-note-text', 'E2E V3 hỏi cả chữ lẫn nhạc')
  await A.screenshot({ path: `${SHOTS}/v3-7-soan-cau-hoi.png` })
  await A.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Đăng lên Feed')).click())
  await waitFor(A, () => document.body.innerText.includes('Đã đăng lên Feed'))
  const cr = lastRpc(A, 'share_region_create'); assert.ok(cr && Array.isArray(cr.body.p_parts) && cr.body.p_parts.length === 2)
  const wire = JSON.stringify(cr.body)
  assert.ok(!/sha|"fp"/.test(wire) && !wire.includes('chùm ba') && !wire.includes('nghe kỹ'), 'client không gửi băm / nội dung giáo trình')
  const NID = sql(`select id from public.share_notes where anchor_kind = 'region' order by created_at desc limit 1`)
  ok('7 đăng Feed: client gửi chỉ đường dẫn + dải ô + hộp ‰ (không băm, không nội dung); server tạo ghi chú region')
  await A.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Xong')?.click())

  // ── 8. Người nhận (Bình): thấy vùng bám PHẦN TỬ; đổi bề rộng + cuộn
  await openSession(B, `${SESSION}?note=${NID}`)
  await waitFor(B, () => document.querySelectorAll('.lsn-rg-outline').length === 2)
  const panelTxt = await B.$eval('.cs-share-note-panel', e => e.innerText.replace(/\s+/g, ' '))
  assert.match(panelTxt, /Vùng được khoanh đang tô màu cam/); assert.ok(panelTxt.includes('E2E V3 hỏi cả chữ lẫn nhạc'))
  const alignedAt = async (w, h) => {
    await B.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
    await sleep(1200)                                                    // alphaTab khắc lại + vòng vẽ 250 ms
    const out = await B.evaluate(() => {
      const secs = [...document.querySelectorAll('.lsn-rg-outline')].map(o => o.getBoundingClientRect())
      const hd = document.querySelector('.lsn-leaf[data-tp$=":blocks.0.text"]')?.getBoundingClientRect()
      return { secs: secs.map(r => ({ x: r.left, y: r.top, w: r.width, h: r.height })), hd: hd && { x: hd.left, y: hd.top, w: hd.width, h: hd.height }, sw: document.documentElement.scrollWidth <= innerWidth + 1, n: secs.length }
    })
    assert.equal(out.n, 2, `${w}px: đủ 2 viền`)
    assert.ok(out.secs.some(s => contains(s, out.hd)), `${w}px: một viền bao đúng tiêu đề study sau khi bố cục đổi ` + JSON.stringify(out))
    assert.ok(out.sw, `${w}px: không tràn ngang`)
    // Viền của khối NHẠC phải nằm TRONG bề mặt bản nhạc vừa khắc lại (± viền đệm), không tràn ra ngoài và không phủ trọn bản nhạc (khung chỉ lấy phần dưới)
    const sc = (await outlines(B)).find(x => x.sec === SC), surf = await box(B, `[data-sec="${SC}"] .at-surface`)
    assert.ok(sc && surf && sc.x >= surf.x - 9 && sc.x + sc.w <= surf.r + 9 && sc.y >= surf.y - 9 && sc.y + sc.h <= surf.b + 9 && sc.h < surf.h - 4, `${w}px: viền nhạc nằm trong bề mặt nhạc ` + JSON.stringify([sc, surf]))
    return out
  }
  await alignedAt(1280, 900); await B.screenshot({ path: `${SHOTS}/v3-8-nguoi-nhan-1280.png` })
  await alignedAt(700, 900); await alignedAt(390, 844); await B.screenshot({ path: `${SHOTS}/v3-8-nguoi-nhan-390.png` })
  await alignedAt(1280, 900)
  await B.evaluate(() => scrollBy(0, 200)); await sleep(300)
  assert.equal((await outlines(B)).length, 2)
  ok('8 người nhận: vùng TÔ ĐÚNG phần tử, bám theo khi đổi bề rộng 1280 → 700 → 390 → 1280 (alphaTab khắc lại, chữ xuống dòng) và khi cuộn; không tràn ngang')
  const rr = B.rpcs.filter(r => r.fn === 'share_region_open'); assert.ok(rr.length >= 1)

  // ── 9. Thẻ Feed + thẻ nhẹ
  await B.goto(ME, { waitUntil: 'networkidle0' })
  await waitFor(B, () => document.body.innerText.includes('Mở vùng khoanh'))
  assert.ok(await B.evaluate(() => document.body.innerText.includes('E2E V3 hỏi cả chữ lẫn nhạc')))
  ok('9 Feed: thẻ vùng khoanh (lời nhắn + "Mở vùng khoanh"), không dựng giáo trình trong Feed')

  // ── 10. Giáo trình đổi: sửa một khối được khoanh → stale (không tô); chèn khối → moved
  sql(`update public.class_lesson_content set blocks = jsonb_set(blocks, '{${SI},tag}', '"ĐÃ SỬA"') where session_id = '${S1}'`)
  await B.goto(`${SESSION}?note=${NID}`, { waitUntil: 'networkidle0' }); await sleep(1500)
  const stalePanel = await B.$eval('.cs-share-note-panel', e => e.innerText.replace(/\s+/g, ' '))
  assert.match(stalePanel, /đã được cập nhật/); assert.equal((await outlines(B)).length, 0)
  const so = B.rpcs.filter(r => r.fn === 'share_region_open').length; assert.ok(so >= 1)
  ok('10a giáo trình bị sửa trong khối được khoanh → báo "đã được cập nhật", KHÔNG tô gì (không giả vờ neo đúng)')
  restore()
  sql(`update public.class_lesson_content set blocks = jsonb_build_array(jsonb_build_object('kind','note','title','Chèn đầu','text','Khối mới.')) || blocks where session_id = '${S1}'`)
  await B.goto(`${SESSION}?note=${NID}`, { waitUntil: 'networkidle0' })
  await waitFor(B, () => document.querySelectorAll('.lsn-rg-outline').length === 2)
  assert.match(await B.$eval('.cs-share-note-panel', e => e.innerText.replace(/\s+/g, ' ')), /sắp xếp lại/)
  ok('10b chèn khối lên đầu buổi → server tìm lại (moved) và vùng vẫn tô đúng 2 khối'); restore()

  // ── 11. Người ngoài lớp: không thấy giáo trình, không tô
  await C.goto(`${SESSION}?note=${NID}`, { waitUntil: 'networkidle0' }); await sleep(1500)
  const ctxt = await C.evaluate(() => ({ body: document.body.innerText, o: document.querySelectorAll('.lsn-rg-outline').length, secs: document.querySelectorAll('[data-sec]').length }))
  assert.ok(!ctxt.body.includes('nghe kỹ nhịp chùm ba') && ctxt.o === 0 && ctxt.secs === 0, JSON.stringify({ ...ctxt, body: ctxt.body.slice(0, 80) }))
  ok('11 người ngoài lớp: không có khối giáo trình, không có vùng tô, không lộ nội dung')

  // ── 12. Chữ + hình + chữ (vùng hình đánh dấu GẦN ĐÚNG)
  await openSession(A)
  await startRegion(A)
  await A.setViewport({ width: 1280, height: 1500, deviceScaleFactor: 1 }); await sleep(600)       // sơ đồ cần đàn cao: cần màn hình cao để cả 3 khối cùng nằm trong khung nhìn
  await A.evaluate(fr => { [...document.querySelectorAll(`[data-sec="${Number(fr) - 1}"] .lsn-leaf`)].at(-1).setAttribute('data-e2e', 'ck') }, FR)
  await topAt(A, '[data-e2e=ck]', 60)
  const lastCk = await box(A, '[data-e2e=ck]'), nextH = await box(A, `[data-sec="${Number(FR) + 1}"] .lsn-leaf`)
  assert.ok(nextH.b < 1450 && lastCk.y > 0, 'cả 3 khối trong màn hình ' + JSON.stringify([lastCk, nextH]))
  await drag(A, { x: lastCk.x - 8, y: lastCk.y - 3 }, { x: nextH.r + 8, y: nextH.b + 3 })
  const fr = await summary(A)
  assert.match(fr ?? '', /^3 khối · \d+ đoạn chữ · 1 vùng hình\/khoảng trống \(gần đúng\)$/, 'chữ+hình+chữ: ' + fr + ' ' + (await hint(A)))
  o = await outlines(A); assert.equal(o.filter(x => x.approx).length, 1)
  await A.screenshot({ path: `${SHOTS}/v3-12-chu-hinh-chu.png` })
  ok(`12 khoanh chữ + SƠ ĐỒ CẦN ĐÀN + chữ → "${fr}"; riêng phần hình viền NÉT ĐỨT (gần đúng, không giả vờ chính xác)`)
  await cancel(A); await A.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })

  // ── 13. Khung quá nhỏ / ngoài giáo trình / Esc; V2 chọn văn bản vẫn chạy
  await startRegion(A)
  await drag(A, { x: 300, y: 300 }, { x: 310, y: 308 })
  assert.match(await hint(A) ?? '', /quá nhỏ/); assert.equal(await A.$('[data-testid=region-ask]'), null)
  await drag(A, { x: 2, y: 200 }, { x: 8, y: 400 })
  assert.match(await hint(A) ?? '', /quá nhỏ|chưa chạm/)
  const n0 = A.rpcs.filter(r => r.fn === 'share_region_create').length
  assert.equal(n0, 1, 'không gọi tạo khi khung không hợp lệ')
  await A.keyboard.press('Escape'); await sleep(150)
  assert.equal(await A.$('[data-testid=region-capture]'), null)
  await A.evaluate(si => { const el = document.querySelector(`[data-tp="${si}:blocks.1.text"]`); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const n = w.nextNode(); const s = getSelection(); s.removeAllRanges(); s.setBaseAndExtent(n, 8, n, 30) }, SI)
  await waitFor(A, () => document.querySelector('[data-testid=text-share-bar]'))
  ok('13 khung quá nhỏ/ngoài giáo trình bị từ chối rõ lý do, KHÔNG gọi server; Esc thoát; chọn văn bản V2 vẫn hoạt động')

  // ── 14. Cảm ứng giả lập (iPhone 390): vẽ bằng ngón tay + chế độ Cuộn
  await openSession(At)
  await startRegion(At)
  const tp = await box(At, leaf(SI, 'blocks.1.text'), true)
  await drag(At, { x: tp.x - 4, y: tp.y - 3 }, { x: tp.r + 4, y: tp.b + 3 }, true)
  assert.equal(await summary(At), '1 khối · 1 đoạn chữ', 'cảm ứng: ' + (await summary(At)) + ' ' + (await hint(At)))
  await At.screenshot({ path: `${SHOTS}/v3-14-cam-ung-390.png` })
  await redo(At)
  await At.click('[data-testid=region-mode]')
  const cap = await At.$eval('[data-testid=region-capture]', e => ({ pe: getComputedStyle(e).pointerEvents, cls: e.className }))
  assert.equal(cap.pe, 'none'); assert.ok(await noHScroll(At))
  ok('14 cảm ứng giả lập 390px: ngón tay vẽ được khung; nút "Cuộn" trả lại cuộn trang cho trình duyệt (lớp phủ pointer-events:none)')

  assert.deepEqual(errors, [], 'không lỗi JS/console: ' + errors.join(' | '))
  ok('15 không có lỗi JavaScript / console trong toàn bộ kịch bản')
  console.log(`\nALL_SHARE_REGION_E2E_OK ${pass} PASS`)
} catch (e) {
  console.log('FAIL: ' + (e?.stack || e)); restore()
  for (const [n, p] of Object.entries({ A, B, C, At })) { try { if (p) await p.screenshot({ path: `${SHOTS}/v3-FAIL-${n}.png` }) } catch { /* trang đã đóng */ } }
  if (process.env.E2E_HOLD_ON_FAIL) { console.log(`STAGING_READY ${ME} (lỗi — giữ stack)`); setInterval(() => {}, 1 << 30); await new Promise(() => {}) }
  await browser.close(); process.exit(1)
}
restore()
if (process.env.E2E_HOLD) {
  console.log(`\nSTAGING_READY ${ME}\n  Đăng nhập: a@test.local (An — người khoanh) · b@test.local (Bình — người nhận, cùng lớp) · c@test.local (Chi — lớp khác, KHÔNG quyền); mật khẩu bất kỳ\n  Buổi 1: ${SESSION}  → bấm "Khoanh vùng để hỏi" (nút tím, góc phải-dưới)`)
  await browser.close().catch(() => {}); setInterval(() => {}, 1 << 30); await new Promise(() => {})
}
await browser.close()
