// E2E Contextual Share V3.1 (DỰ THẢO) — KHOANH ĐÚNG PHẦN ĐƯỢC BAO, Chrome thật (puppeteer). Xem scripts/e2e-share-note.sh (E2E_SHARE_REGION=1). Chỉ DB tạm; KHÔNG production.
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


const anchor = page => page.$eval('[data-testid=region-bar]', e => JSON.parse(e.dataset.anchor || 'null')).catch(() => null)
/** Chữ được khoanh = cắt chuỗi lá theo [từ,đến) điểm mã (đọc từ neo trên thanh công cụ + chữ trong DOM) */
const pickedText = (page, parts) => page.evaluate(parts => parts.flatMap(p => p.leaves.map(l => {
  const el = document.querySelector(`[data-tp="${p.sec}:${l.p.join('.')}"]`); const cps = Array.from(el?.textContent ?? '')
  return { path: l.p.join('.'), total: cps.length, text: l.r.map(([a, b]) => cps.slice(a, b).join('')) }
})), parts)
const fillRects = page => page.evaluate(() => [...document.querySelectorAll('.lsn-rg-fill')].map(o => { const r = o.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, approx: o.classList.contains('is-approx') } }))
/** Mọi ô tô nằm TRONG hộp của lá (± dung sai) — tô đúng chữ, không tràn sang chỗ khác */
const fillsInsideLeaf = (fs, leafBox, tol = 3) => fs.length > 0 && fs.every(f => f.x >= leafBox.x - tol && f.y >= leafBox.y - tol && f.x + f.w <= leafBox.r + tol && f.y + f.h <= leafBox.b + tol)
const pBox = b => b
const lineRects = (page, sel) => page.evaluate(sel => { const rg = document.createRange(); rg.selectNodeContents(document.querySelector(sel)); return [...rg.getClientRects()].map(r => ({ x: r.left, y: r.top, w: r.width, h: r.height })) }, sel)

let A, B, C, At, o
try {
  A = await open('A'); B = await open('B'); C = await open('C'); At = await open('A', 390, 844, true)
  // Không còn vòng hỏi định kỳ 250 ms cho vùng khoanh: ghi lại mọi setInterval ngắn do trang tạo ra
  for (const pg of [A, B]) await pg.evaluateOnNewDocument(() => { const si = window.setInterval; window.__iv = []; window.setInterval = function (f, ms, ...a) { window.__iv.push(ms); return si.call(window, f, ms, ...a) } })
  await openSession(A)
  const SI = await A.evaluate(() => { const l = [...document.querySelectorAll('.lsn-leaf')].find(x => x.textContent.includes('nghe kỹ nhịp chùm ba ở ô 2')); return l.closest('[data-sec]').dataset.sec })
  const SC = String(Number(SI) - 1), FR = await A.evaluate(() => document.querySelector('.lsn-fb')?.closest('[data-sec]')?.dataset.sec)
  assert.ok(FR, 'có khối sơ đồ cần đàn'); assert.ok(await A.$(`[data-sec="${SC}"] .lsn-score-host`), 'khối ngay trước study là bản nhạc')
  assert.match(await A.$eval('[data-testid=region-start]', e => e.textContent), /Khoanh để hỏi/)
  ok(`0 trang Buổi dựng [data-sec] cho mọi khối (study=${SI}, nhạc=${SC}, hình=${FR}); nút tím "Khoanh để hỏi" hiện`)
  await A.screenshot({ path: `${SHOTS}/v31-0-truoc-khi-khoanh.png` })

  // ── 1. NỬA đoạn văn: chỉ nửa đầu dòng đầu — KHÔNG lấy cả lá
  await startRegion(A)
  let r = await box(A, leaf(SI, 'blocks.1.text'), true); r = await box(A, leaf(SI, 'blocks.1.text'))
  const lines = await lineRects(A, leaf(SI, 'blocks.1.text'))
  assert.ok(lines.length >= 1, 'đoạn có dòng: ' + lines.length)
  await drag(A, { x: r.x - 4, y: lines[0].y - 2 }, { x: lines[0].x + lines[0].w * 0.5, y: lines[0].y + lines[0].h + 1 })
  let anc = await anchor(A); assert.ok(anc, 'có neo: ' + (await hint(A)))
  let pk = await pickedText(A, anc)
  assert.equal(pk.length, 1); assert.equal(anc[0].leaves[0].r.length, 1)
  assert.ok(pk[0].text[0].startsWith('Giữ nhịp') && Array.from(pk[0].text[0]).length < pk[0].total / 2, JSON.stringify(pk))
  assert.ok(!pk[0].text[0].includes('lời hát') && !pk[0].text[0].includes('thêm'), 'không lấy phần sau: ' + pk[0].text[0])
  let fs = await fillRects(A); assert.ok(fs.length >= 1 && fs.every(f => f.y >= lines[0].y - 3 && f.y + f.h <= lines[0].y + lines[0].h + 3), 'chỉ dòng đầu được tô')
  await A.screenshot({ path: `${SHOTS}/v31-1-nua-doan-van.png` })
  ok(`1 khoanh NỬA đoạn văn → chỉ "${pk[0].text[0].slice(0, 40)}…" (${Array.from(pk[0].text[0]).length}/${pk[0].total} ký tự); chỉ dòng đầu được tô`)

  // ── 1b. Từ nằm giữa đường biên: ≥ 50% thì lấy cả từ, không cắt ngang chữ
  assert.ok(!/\s$|^\s/.test(pk[0].text[0]), 'đoạn đã cắt khoảng trắng đầu/cuối'); assert.ok(/[\p{L}\p{N}.,!?]$/u.test(pk[0].text[0]), 'kết thúc ở cuối từ')
  ok('1b biên đoạn khoanh làm tròn theo TỪ (không cắt ngang chữ)')

  // ── 1c. Màn hình hẹp: đoạn xuống nhiều dòng; khung chỉ bao NỬA PHẢI của hai dòng đầu → các mảnh rời, không lấy phần trái
  await cancel(A); await A.setViewport({ width: 420, height: 900, deviceScaleFactor: 1 }); await sleep(900)
  await startRegion(A)
  await topAt(A, leaf(SI, 'blocks.1.text'), 200)
  const nl = await lineRects(A, leaf(SI, 'blocks.1.text')); assert.ok(nl.length >= 3, 'đoạn ≥ 3 dòng ở 420px: ' + nl.length)
  const mid = nl[0].x + nl[0].w * 0.5
  await drag(A, { x: mid, y: nl[0].y - 2 }, { x: nl[0].x + nl[0].w + 8, y: nl[1].y + nl[1].h + 1 })
  anc = await anchor(A); assert.ok(anc, 'nửa phải: ' + (await hint(A)))
  assert.ok(anc[0].leaves[0].r.length >= 2, 'nửa phải hai dòng ⇒ ≥ 2 mảnh rời: ' + JSON.stringify(anc[0].leaves[0].r))
  assert.ok(anc[0].leaves[0].r[0][0] > 0, 'không lấy phần trái đầu đoạn')
  fs = await fillRects(A); assert.ok(fs.length >= 2 && fs.every(f => f.x >= mid - 12), 'ô tô chỉ nằm bên phải đường giữa')
  await A.screenshot({ path: `${SHOTS}/v31-1c-nua-phai-hai-dong.png` })
  ok(`1c màn hình hẹp 420px: khoanh NỬA PHẢI hai dòng → ${anc[0].leaves[0].r.length} mảnh rời, phần trái không bị lấy`)
  await cancel(A); await A.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 }); await sleep(900)
  await startRegion(A); r = await box(A, leaf(SI, 'blocks.1.text'), true)

  // ── 2. NHIỀU đoạn: đoạn + 3 mục danh sách (khung bao trọn)
  await redo(A)
  const p = await box(A, leaf(SI, 'blocks.1.text')), li = await box(A, leaf(SI, 'blocks.2.items.2'))
  await drag(A, { x: p.x - 6, y: p.y - 3 }, { x: Math.max(p.r, li.r) + 6, y: li.b + 3 })
  anc = await anchor(A); pk = await pickedText(A, anc)
  assert.deepEqual(pk.map(x => x.path), ['blocks.1.text', 'blocks.2.items.0', 'blocks.2.items.1', 'blocks.2.items.2'], 'nhiều đoạn: ' + (await summary(A)))
  assert.ok(pk.every(x => x.text.length === 1 && Array.from(x.text[0]).length === x.total || x.total - Array.from(x.text[0]).length <= 1), 'khung bao trọn ⇒ cả lá: ' + JSON.stringify(pk))
  ok('2 khoanh NHIỀU đoạn (đoạn + 3 mục danh sách) → mỗi lá được bao trọn thì lấy trọn')

  // ── 3. Tiêu đề + đoạn + danh sách
  await redo(A)
  const h2 = await box(A, leaf(SI, 'blocks.0.text'), true); const li2 = await box(A, leaf(SI, 'blocks.2.items.2'))
  await drag(A, { x: h2.x - 6, y: h2.y - 3 }, { x: Math.max(h2.r, pBox(li2).r, 900) + 6, y: li2.b + 3 })
  anc = await anchor(A); pk = await pickedText(A, anc)
  assert.equal(pk.length, 5, 'tiêu đề+danh sách: ' + JSON.stringify(pk.map(x => x.path)))
  ok('3 khoanh TIÊU ĐỀ + đoạn + danh sách → 5 lá')

  // ── 4. MỘT PHẦN bảng: chỉ hàng 2 (hai ô), không tự chọn cả bảng
  await redo(A)
  const c10 = await box(A, leaf(SI, 'blocks.3.rows.1.0'), true), c11 = await box(A, leaf(SI, 'blocks.3.rows.1.1')), c00 = await box(A, leaf(SI, 'blocks.3.rows.0.0'))
  await drag(A, { x: c10.x - 6, y: c10.y - 3 }, { x: c11.r + 6, y: c11.b + 3 })
  anc = await anchor(A); pk = await pickedText(A, anc)
  assert.deepEqual(pk.map(x => x.path), ['blocks.3.rows.1.0', 'blocks.3.rows.1.1'], 'phần bảng: ' + JSON.stringify(pk))
  assert.ok(c00.y < c10.y - 4, 'hàng tiêu đề nằm phía trên, không được lấy')
  await A.screenshot({ path: `${SHOTS}/v31-4-mot-phan-bang.png` })
  await redo(A)
  const only = await box(A, leaf(SI, 'blocks.3.rows.1.1'))
  await drag(A, { x: only.x - 4, y: only.y - 2 }, { x: only.r + 4, y: only.b + 2 })
  pk = await pickedText(A, await anchor(A)); assert.deepEqual(pk.map(x => x.path), ['blocks.3.rows.1.1'])
  ok('4 khoanh MỘT PHẦN bảng → đúng 2 ô của một hàng, rồi đúng 1 ô; không tự chọn cả bảng')

  // ── 5. VÀI ô nhịp: chọn cả bản nhạc để biết tổng ô, rồi chỉ vài ô đầu
  await redo(A)
  await A.setViewport({ width: 1280, height: 1800, deviceScaleFactor: 1 }); await sleep(1200)          // bản nhạc dài (nhiều dòng): cần màn hình cao để lấy TỔNG số ô bằng một khung
  await topAt(A, `[data-sec="${SC}"] .at-surface`, 20); let sf = await box(A, `[data-sec="${SC}"] .at-surface`)
  assert.ok(sf.b < 1790, 'cả bản nhạc trong màn hình: ' + JSON.stringify(sf))
  await drag(A, { x: sf.x + 2, y: sf.y + 2 }, { x: sf.r - 2, y: sf.b - 2 })
  const total = (await anchor(A))[0].scores[0].to; assert.ok(total >= 4, 'tổng ô: ' + total)
  await redo(A)
  await A.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 }); await sleep(1200)
  await topAt(A, `[data-sec="${SC}"] .at-surface`, 100); sf = await box(A, `[data-sec="${SC}"] .at-surface`)
  const bars = await A.evaluate(sec => [...document.querySelectorAll(`[data-sec="${sec}"] .at-surface`)].length, SC)
  assert.equal(bars, 1)
  await drag(A, { x: sf.x + sf.w * 0.04, y: sf.y + 6 }, { x: sf.x + sf.w * 0.5, y: sf.y + Math.min(sf.h * 0.3, 140) })
  anc = await anchor(A); const sc0 = anc[0].scores[0]
  assert.ok(sc0 && sc0.from === 1 && sc0.to < total && sc0.to >= 1, 'chỉ vài ô đầu: ' + JSON.stringify(sc0) + ' / tổng ' + total)
  await A.screenshot({ path: `${SHOTS}/v31-5-vai-o-nhip.png` })
  ok(`5 khoanh VÀI ô nhịp → ô 1–${sc0.to} trên tổng ${total} ô (không tự chọn cả bản nhạc)`)

  // ── 6. Hỗn hợp chữ + nhạc: nửa dưới bản nhạc + tiêu đề study + nửa đầu dòng đầu của đoạn
  await redo(A)
  await topAt(A, leaf(SI, 'blocks.0.text'), 640)
  const hh = await box(A, leaf(SI, 'blocks.0.text')); sf = await box(A, `[data-sec="${SC}"] .at-surface`)
  const pl = await lineRects(A, leaf(SI, 'blocks.1.text'))
  assert.ok(pl[0].y + pl[0].h < 870, 'đoạn nằm trong màn hình ' + JSON.stringify([sf, hh, pl[0]]))
  await drag(A, { x: sf.x + 6, y: Math.max(130, sf.y + sf.h * 0.55) }, { x: pl[0].x + pl[0].w * 0.5, y: pl[0].y + pl[0].h + 1 })
  anc = await anchor(A)
  assert.ok(anc && anc.length === 2, 'hỗn hợp: ' + (await summary(A)) + ' ' + (await hint(A)))
  const mixSc = anc.find(x => x.scores.length)?.scores[0], mixTx = anc.find(x => x.leaves.length)
  assert.ok(mixSc && mixSc.to <= total && mixSc.to - mixSc.from + 1 < total, 'một phần bản nhạc: ' + JSON.stringify(mixSc))
  pk = await pickedText(A, anc)
  assert.deepEqual(pk.map(x => x.path), ['blocks.0.text', 'blocks.1.text']); assert.ok(Array.from(pk[1].text[0]).length < pk[1].total / 2)
  const mixSum = await summary(A); void mixTx
  await A.screenshot({ path: `${SHOTS}/v31-6-chu-va-nhac.png` })
  ok(`6 khoanh HỖN HỢP chữ + nhạc → "${mixSum}" (một phần bản nhạc + tiêu đề + nửa đầu đoạn)`)

  // ── 7. Đăng Feed
  await A.click('[data-testid=region-ask]')
  await A.waitForSelector('#share-note-text')
  assert.ok((await A.$eval('[data-testid=composer-region]', e => e.textContent)).includes('Vùng khoanh:'))
  await A.type('#share-note-text', 'E2E V3.1 hỏi cả chữ lẫn nhạc')
  await A.screenshot({ path: `${SHOTS}/v31-7-soan-cau-hoi.png` })
  await A.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Đăng lên Feed')).click())
  await waitFor(A, () => document.body.innerText.includes('Đã đăng lên Feed'))
  const cr = lastRpc(A, 'share_region_create'); assert.ok(cr && Array.isArray(cr.body.p_parts) && cr.body.p_parts.length === 2)
  const wire = JSON.stringify(cr.body)
  assert.ok(!/sha|"fp"|"s":|"c":/.test(wire) && !wire.includes('chùm ba') && !wire.includes('nghe kỹ') && !wire.includes('Giữ nhịp'), 'client không gửi băm / nội dung giáo trình')
  const NID = sql(`select id from public.share_notes where anchor_kind = 'region' order by created_at desc limit 1`)
  ok('7 đăng Feed: client chỉ gửi đường dẫn + đoạn [từ,đến) + dải ô + hộp ‰ (không băm, không nội dung); server tạo ghi chú region')
  await A.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Xong')?.click())

  // ── 8. Người nhận: vùng bám CHỮ khi đổi bề rộng + cuộn; không có vòng hỏi 250 ms
  await openSession(B, `${SESSION}?note=${NID}`)
  await waitFor(B, () => document.querySelectorAll('.lsn-rg-fill').length >= 2)
  const panelTxt = await B.$eval('.cs-share-note-panel', e => e.innerText.replace(/\s+/g, ' '))
  assert.match(panelTxt, /Vùng được khoanh đang tô màu cam/); assert.ok(panelTxt.includes('E2E V3.1 hỏi cả chữ lẫn nhạc'))
  const alignedAt = async (w, h) => {
    await B.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
    await sleep(1300)                                                    // alphaTab khắc lại; vẽ lại theo sự kiện bố cục
    const out = await B.evaluate(() => {
      const fl = [...document.querySelectorAll('.lsn-rg-fill')].map(o => { const r = o.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })
      const hd = document.querySelector('.lsn-leaf[data-tp$=":blocks.0.text"]')?.getBoundingClientRect(), pa = document.querySelector('.lsn-leaf[data-tp$=":blocks.1.text"]')?.getBoundingClientRect()
      return { fl, hd: hd && { x: hd.left, y: hd.top, r: hd.right, b: hd.bottom }, pa: pa && { x: pa.left, y: pa.top, r: pa.right, b: pa.bottom }, sw: document.documentElement.scrollWidth <= innerWidth + 1 }
    })
    const onHead = out.fl.filter(f => f.x >= out.hd.x - 3 && f.y >= out.hd.y - 3 && f.x + f.w <= out.hd.r + 3 && f.y + f.h <= out.hd.b + 3)
    const onPara = out.fl.filter(f => f.x >= out.pa.x - 3 && f.y >= out.pa.y - 3 && f.x + f.w <= out.pa.r + 3 && f.y + f.h <= out.pa.b + 3)
    assert.ok(onHead.length >= 1 && onPara.length >= 1, `${w}px: ô tô nằm trên tiêu đề + đoạn: ` + JSON.stringify(out))
    const paBoxArea = (out.pa.r - out.pa.x) * (out.pa.b - out.pa.y), paFill = onPara.reduce((s, f) => s + f.w * f.h, 0)
    assert.ok(paFill < paBoxArea * 0.75, `${w}px: chỉ một phần đoạn được tô (${Math.round(paFill)} / ${Math.round(paBoxArea)})`)
    assert.ok(out.sw, `${w}px: không tràn ngang`)
    const surf = await box(B, `[data-sec="${SC}"] .at-surface`)
    const scFills = out.fl.filter(f => !onHead.includes(f) && !onPara.includes(f))
    assert.ok(scFills.length >= 1 && scFills.every(f => f.x >= surf.x - 4 && f.x + f.w <= surf.r + 4 && f.y >= surf.y - 4 && f.y + f.h <= surf.b + 4), `${w}px: ô nhạc tô nằm trong bề mặt bản nhạc vừa khắc lại ` + JSON.stringify([scFills, surf]))
    return out
  }
  await alignedAt(1280, 900); await B.screenshot({ path: `${SHOTS}/v31-8-nguoi-nhan-1280.png` })
  await alignedAt(700, 900); await alignedAt(390, 844); await B.screenshot({ path: `${SHOTS}/v31-8-nguoi-nhan-390.png` })
  await alignedAt(1280, 900)
  const nBefore = (await fillRects(B)).length
  await B.evaluate(() => scrollBy(0, 220)); await sleep(300)
  assert.equal((await fillRects(B)).length, nBefore, 'cuộn trang không làm mất ô tô')
  const iv = await B.evaluate(() => window.__iv)
  assert.ok(!iv.some(ms => ms === 250), 'không còn vòng hỏi 250 ms: ' + JSON.stringify(iv))
  ok('8 người nhận: ô tô bám ĐÚNG CHỮ khi đổi bề rộng 1280 → 700 → 390 → 1280 (alphaTab khắc lại, chữ xuống dòng) và khi cuộn; không tràn ngang; không còn setInterval 250 ms')

  // ── 9. FEED: nguyên cảnh giáo trình + vùng khoanh (gọn / xem đầy đủ) + nút "Mở trong giáo trình"
  await B.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
  await B.goto(ME, { waitUntil: 'networkidle0' })
  await waitFor(B, () => document.querySelector('[data-testid=region-context]'))
  await waitFor(B, () => document.querySelector('[data-testid=share-note-preview] .lsn-score-host svg'))
  await sleep(500)
  const card = await B.evaluate(() => {
    const c = document.querySelector('[data-testid=share-note-post]')
    return { marks: [...c.querySelectorAll('[data-testid=region-mark]')].map(m => m.textContent), expanded: c.querySelector('[data-testid=context-section]')?.dataset.expanded, parts: c.querySelector('[data-testid=region-context]').dataset.parts,
      hasHead: c.innerText.includes('Ôn tập 7 ngày'), more: !!c.querySelector('[data-testid=share-note-more]'), open: c.querySelector('[data-testid=share-note-open]')?.getAttribute('href'), text: c.innerText.length, leaves: c.querySelectorAll('.lsn-st-p, .lsn-st-h, .lsn-st-list li').length }
  })
  assert.ok(card.marks.length >= 2 && card.marks.some(m => m.startsWith('Giữ nhịp')), 'chữ khoanh tô cam đúng đoạn: ' + JSON.stringify(card))
  assert.ok(card.marks.every(m => m.length < 120), 'chỉ tô đoạn khoanh, không tô cả lá: ' + JSON.stringify(card.marks))
  assert.ok(card.hasHead && card.more && card.open && card.open.includes('note='), 'tiêu đề khối + "Xem đầy đủ" + "Mở trong giáo trình": ' + JSON.stringify(card))
  await (await B.$('[data-testid=share-note-post]')).screenshot({ path: `${SHOTS}/v31-9-feed-gon.png` })
  await B.click('[data-testid=share-note-more]'); await sleep(500)
  const full = await B.evaluate(() => { const c = document.querySelector('[data-testid=share-note-post]'); return { expanded: c.querySelector('[data-testid=context-section]')?.dataset.expanded, leaves: c.querySelectorAll('.lsn-st-p, .lsn-st-h, .lsn-st-list li').length, marks: c.querySelectorAll('[data-testid=region-mark]').length, label: c.querySelector('[data-testid=share-note-more]')?.textContent } })
  assert.equal(full.expanded, '1'); assert.ok(full.leaves > card.leaves, 'xem đầy đủ hiện thêm ngữ cảnh: ' + JSON.stringify([card.leaves, full]))
  assert.equal(full.marks, card.marks.length, 'vùng khoanh không đổi khi xem đầy đủ'); assert.match(full.label, /Thu gọn/)
  await (await B.$('[data-testid=share-note-post]')).screenshot({ path: `${SHOTS}/v31-9-feed-day-du.png` })
  await B.click('[data-testid=share-note-more]'); await sleep(300)
  assert.equal(await B.$eval('[data-testid=context-section]', e => e.dataset.expanded), '0')
  ok(`9 Feed dựng NGUYÊN CẢNH bằng renderer giáo trình: tiêu đề khối, ${card.marks.length} đoạn chữ tô đúng, trích đoạn bản nhạc; "Xem đầy đủ" ↔ "Thu gọn"; nút "Mở trong giáo trình" giữ nguyên`)
  const link = await B.$eval('[data-testid=share-note-open]', e => e.href)
  await B.goto(link, { waitUntil: 'networkidle0' }); await waitFor(B, () => document.querySelectorAll('.lsn-rg-fill').length >= 2)
  ok('9b "Mở trong giáo trình" từ Feed → trang Buổi cuộn tới vùng khoanh và tô đúng')

  // ── 10. Giáo trình đổi
  const ptxt = sql(`select blocks -> ${SI} -> 'blocks' -> 1 ->> 'text' from public.class_lesson_content where session_id = '${S1}'`)
  const reopen = async () => { await B.goto(`${SESSION}?note=${NID}`, { waitUntil: 'networkidle0' }); await sleep(1600) }
  // 10a: sửa câu NGOÀI vùng khoanh (đuôi đoạn) → vẫn ok, vẫn tô đúng
  sql(`update public.class_lesson_content set blocks = jsonb_set(blocks, '{${SI},blocks,1,text}', to_jsonb(($q$${ptxt}$q$ || ' Câu mới thêm ở cuối đoạn.')::text)) where session_id = '${S1}'`)
  await reopen(); await waitFor(B, () => document.querySelectorAll('.lsn-rg-fill').length >= 2)
  assert.match(await B.$eval('.cs-share-note-panel', e => e.innerText.replace(/\s+/g, ' ')), /Vùng được khoanh đang tô màu cam/)
  ok('10a sửa câu NGOÀI vùng khoanh (thêm câu cuối đoạn) → vùng vẫn hợp lệ và vẫn tô đúng'); restore()
  // 10b: thêm câu TRƯỚC vùng khoanh trong cùng đoạn → server tìm lại đoạn, vẫn tô đúng chữ cũ
  sql(`update public.class_lesson_content set blocks = jsonb_set(blocks, '{${SI},blocks,1,text}', to_jsonb(('Câu mở đầu mới. ' || $q$${ptxt}$q$)::text)) where session_id = '${S1}'`)
  await reopen(); await waitFor(B, () => document.querySelectorAll('.lsn-rg-fill').length >= 2)
  const mv = await B.evaluate(() => { const l = document.querySelector('.lsn-leaf[data-tp$=":blocks.1.text"]').getBoundingClientRect(); return [...document.querySelectorAll('.lsn-rg-fill')].filter(o => { const r = o.getBoundingClientRect(); return r.top >= l.top - 3 && r.bottom <= l.bottom + 3 }).length })
  assert.ok(mv >= 1)
  ok('10b thêm câu TRƯỚC vùng khoanh trong cùng đoạn → đoạn cũ vẫn được tìm lại (offset dời) và tô đúng'); restore()
  // 10c: sửa chính chữ được khoanh → stale: không tô gì
  sql(`update public.class_lesson_content set blocks = jsonb_set(blocks, '{${SI},blocks,1,text}', to_jsonb(replace($q$${ptxt}$q$, 'Giữ nhịp thật đều', 'Hãy giữ tốc độ ổn định')::text)) where session_id = '${S1}'`)
  await reopen()
  assert.match(await B.$eval('.cs-share-note-panel', e => e.innerText.replace(/\s+/g, ' ')), /đã được cập nhật/); assert.equal((await fillRects(B)).length, 0)
  await B.goto(ME, { waitUntil: 'networkidle0' }); await waitFor(B, () => document.querySelector('[data-testid=share-note-post] .cs-sn-msg')); await sleep(300)
  assert.ok(await B.evaluate(() => /đã được cập nhật/.test(document.querySelector('[data-testid=share-note-post]').innerText)) && !(await B.$('[data-testid=region-mark]')))
  ok('10c sửa CHÍNH chữ được khoanh → trang Buổi và Feed báo "đã được cập nhật", KHÔNG tô gì (không giả vờ neo đúng)'); restore()
  // 10d: chèn khối lên đầu → moved
  sql(`update public.class_lesson_content set blocks = jsonb_build_array(jsonb_build_object('kind','note','title','Chèn đầu','text','Khối mới.')) || blocks where session_id = '${S1}'`)
  await reopen(); await waitFor(B, () => document.querySelectorAll('.lsn-rg-fill').length >= 2)
  assert.match(await B.$eval('.cs-share-note-panel', e => e.innerText.replace(/\s+/g, ' ')), /sắp xếp lại/)
  ok('10d chèn khối lên đầu buổi → server tìm lại (moved) và vùng vẫn tô đúng'); restore()

  // ── 11. Người ngoài lớp
  await C.goto(`${SESSION}?note=${NID}`, { waitUntil: 'networkidle0' }); await sleep(1500)
  const ctxt = await C.evaluate(() => ({ body: document.body.innerText, o: document.querySelectorAll('.lsn-rg-fill, .lsn-rg-outline').length, secs: document.querySelectorAll('[data-sec]').length }))
  assert.ok(!ctxt.body.includes('nghe kỹ nhịp chùm ba') && ctxt.o === 0 && ctxt.secs === 0, JSON.stringify({ ...ctxt, body: ctxt.body.slice(0, 80) }))
  await C.goto(ME, { waitUntil: 'networkidle0' }); await sleep(1200)
  assert.ok(await C.evaluate(() => !document.body.innerText.includes('Giữ nhịp') && !document.querySelector('[data-testid=region-mark]')))
  ok('11 người ngoài lớp: không có khối giáo trình, không có vùng tô, Feed không lộ nội dung')

  // ── 12. Chữ + hình + chữ
  await openSession(A)
  await A.setViewport({ width: 1280, height: 1500, deviceScaleFactor: 1 }); await sleep(600)
  await startRegion(A)
  await A.evaluate(fr => { [...document.querySelectorAll(`[data-sec="${Number(fr) - 1}"] .lsn-leaf`)].at(-1).setAttribute('data-e2e', 'ck') }, FR)
  await topAt(A, '[data-e2e=ck]', 60)
  const lastCk = await box(A, '[data-e2e=ck]'), nextH = await box(A, `[data-sec="${Number(FR) + 1}"] .lsn-leaf`)
  assert.ok(nextH.b < 1450 && lastCk.y > 0, 'cả 3 khối trong màn hình ' + JSON.stringify([lastCk, nextH]))
  await drag(A, { x: lastCk.x - 8, y: lastCk.y - 3 }, { x: nextH.r + 8, y: nextH.b + 3 })
  const fr = await summary(A)
  assert.match(fr ?? '', /^3 khối · \d+ đoạn chữ · 1 vùng hình\/khoảng trống \(gần đúng\)$/, 'chữ+hình+chữ: ' + fr + ' ' + (await hint(A)))
  o = await outlines(A); assert.equal(o.filter(x => x.approx).length, 1)
  await A.screenshot({ path: `${SHOTS}/v31-12-chu-hinh-chu.png` })
  ok(`12 khoanh chữ + SƠ ĐỒ CẦN ĐÀN + chữ → "${fr}"; riêng phần hình viền NÉT ĐỨT (gần đúng, không giả vờ chính xác)`)
  await cancel(A); await A.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })

  // ── 13. Tự cuộn khi kéo sát mép + thanh công cụ không che vùng khoanh
  await openSession(A)
  await startRegion(A)
  await A.evaluate(() => scrollTo(0, 0)); await sleep(200)
  const y0 = await A.evaluate(() => scrollY)
  const startAt = await box(A, leaf(SI, 'blocks.1.text'), true)
  await topAt(A, leaf(SI, 'blocks.1.text'), 120); const st = await box(A, leaf(SI, 'blocks.1.text'))
  await A.mouse.move(st.x - 4, st.y - 2); await A.mouse.down(); await A.mouse.move(st.x + 200, 600, { steps: 6 }); await A.mouse.move(st.x + 400, 880, { steps: 4 })
  const sy0 = await A.evaluate(() => scrollY); await sleep(900); const sy1 = await A.evaluate(() => scrollY)
  assert.ok(sy1 > sy0 + 150, `kéo sát mép dưới → trang tự cuộn xuống (${sy0} → ${sy1})`)
  await A.mouse.up(); await sleep(300)
  anc = await anchor(A); assert.ok(anc && anc.length >= 1, 'có neo sau tự cuộn: ' + (await hint(A)))
  const nLeaves = anc.reduce((n, x) => n + x.leaves.length, 0); assert.ok(nLeaves >= 4, 'khung kéo dài qua phần đã cuộn bao nhiều lá hơn màn hình đầu: ' + nLeaves)
  void startAt; void y0
  ok(`13 kéo sát mép dưới → trang TỰ CUỘN (${sy0} → ${sy1}px), khung kéo dài theo và bao ${nLeaves} lá nằm ngoài màn hình ban đầu`)
  // thanh công cụ: khung thấp ⇒ thanh lên đầu màn hình, không che vùng
  await redo(A)
  await topAt(A, leaf(SI, 'blocks.2.items.2'), 780); const lowItem = await box(A, leaf(SI, 'blocks.2.items.2'))
  await drag(A, { x: lowItem.x - 6, y: lowItem.y - 3 }, { x: lowItem.r + 6, y: lowItem.b + 3 })
  const barBox = await box(A, '[data-testid=region-bar] .lsn-textbar-in'); const hl = await fillRects(A)
  assert.ok(barBox.b < lowItem.y || barBox.y > lowItem.b, 'thanh công cụ không che vùng vừa khoanh ' + JSON.stringify([barBox, lowItem]))
  assert.ok(hl.every(f => f.y + f.h < barBox.y || f.y > barBox.b), 'ô tô không bị thanh che')
  await cancel(A)
  ok('13b khung nằm thấp → thanh công cụ chuyển lên đầu màn hình, KHÔNG che nội dung đang khoanh')

  // ── 14. Khung quá nhỏ / ngoài giáo trình / Esc; V2 chọn văn bản vẫn chạy
  await startRegion(A)
  await drag(A, { x: 300, y: 300 }, { x: 310, y: 308 })
  assert.match(await hint(A) ?? '', /quá nhỏ/); assert.equal(await A.$('[data-testid=region-ask]'), null)
  await drag(A, { x: 2, y: 200 }, { x: 8, y: 400 })
  assert.match(await hint(A) ?? '', /quá nhỏ|chưa bao/)
  assert.equal(A.rpcs.filter(r => r.fn === 'share_region_create').length, 1, 'không gọi tạo khi khung không hợp lệ')
  await A.keyboard.press('Escape'); await sleep(150)
  assert.equal(await A.$('[data-testid=region-capture]'), null)
  await A.evaluate(si => { const el = document.querySelector(`[data-tp="${si}:blocks.1.text"]`); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const n = w.nextNode(); const s = getSelection(); s.removeAllRanges(); s.setBaseAndExtent(n, 8, n, 30) }, SI)
  await waitFor(A, () => document.querySelector('[data-testid=text-share-bar]'))
  ok('14 khung quá nhỏ/ngoài giáo trình bị từ chối rõ lý do, KHÔNG gọi server; Esc thoát; chọn văn bản V2 vẫn hoạt động')

  // ── 15. Cảm ứng giả lập (iPhone 390)
  await openSession(At)
  await startRegion(At)
  const tp = await box(At, leaf(SI, 'blocks.1.text'), true)
  const tl = await lineRects(At, leaf(SI, 'blocks.1.text'))
  await drag(At, { x: tp.x - 4, y: tl[0].y - 2 }, { x: tl[0].x + tl[0].w * 0.6, y: tl[0].y + tl[0].h + 1 }, true)
  anc = await anchor(At); assert.ok(anc, 'cảm ứng: ' + (await hint(At)))
  pk = await pickedText(At, anc); assert.ok(Array.from(pk[0].text[0]).length < pk[0].total / 2, 'cảm ứng: nửa dòng đầu ' + JSON.stringify(pk))
  await At.screenshot({ path: `${SHOTS}/v31-15-cam-ung-390.png` })
  await redo(At)
  await At.click('[data-testid=region-mode]')
  const cap = await At.$eval('[data-testid=region-capture]', e => ({ pe: getComputedStyle(e).pointerEvents }))
  assert.equal(cap.pe, 'none'); assert.ok(await noHScroll(At))
  ok('15 cảm ứng giả lập 390px: ngón tay khoanh nửa dòng đầu của đoạn; nút "Cuộn" trả lại cuộn trang (lớp phủ pointer-events:none)')

  // ── 17. V3.2: nhẹ nhàng, đúng vùng, gọn trong Feed, tự cuộn có chủ ý
  await openSession(A)
  await A.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 }); await sleep(500)
  await startRegion(A)
  // 17a: lớp tô nhẹ — không sọc, nền ≤ 0.12, viền mảnh
  await topAt(A, leaf(SI, 'blocks.1.text'), 300); const t17 = await box(A, leaf(SI, 'blocks.1.text')); const tl17 = await lineRects(A, leaf(SI, 'blocks.1.text'))
  await drag(A, { x: t17.x - 4, y: tl17[0].y - 2 }, { x: tl17[0].x + tl17[0].w * 0.5, y: tl17[0].y + tl17[0].h + 1 })
  const sty = await A.evaluate(() => [...document.querySelectorAll('.lsn-rg-fill, .lsn-rg-outline')].map(e => { const c = getComputedStyle(e); const m = /rgba?\(([^)]+)\)/.exec(c.backgroundColor); const a = m ? (m[1].split(',')[3] ?? '1') : '0'; return { img: c.backgroundImage, a: Number(a), bw: parseFloat(c.borderTopWidth) } }))
  assert.ok(sty.length > 0 && sty.every(x => x.img === 'none' && x.a <= 0.12 && x.bw <= 2), 'lớp tô nhẹ, không sọc: ' + JSON.stringify(sty))
  ok('17a vùng khoanh: nền cam ≤ 12%, KHÔNG sọc, viền ≤ 2px (nội dung đọc được)')
  await redo(A)
  // 17b: tự cuộn có chủ ý — bắt đầu kéo sát mép dưới rồi rời ngay ⇒ KHÔNG cuộn; giữ yên sát mép ⇒ cuộn
  await topAt(A, leaf(SI, 'blocks.0.text'), 300)
  const q0 = await A.evaluate(() => scrollY)
  await A.mouse.move(1100, 884); await A.mouse.down(); await A.mouse.move(1100, 500, { steps: 3 }); await sleep(250)
  const q1 = await A.evaluate(() => scrollY); assert.ok(Math.abs(q1 - q0) <= 2, `bắt đầu kéo sát mép rồi rời ngay → KHÔNG tự cuộn (${q0} → ${q1})`)
  await A.mouse.up(); await redo(A)
  await A.mouse.move(1100, 884); await A.mouse.down(); await A.mouse.move(1102, 886, { steps: 2 }); await sleep(1100)
  const q2 = await A.evaluate(() => scrollY); assert.ok(q2 > q0 + 40, `giữ yên sát mép ≥ 0,45 s → tự cuộn (${q0} → ${q2})`)
  await A.mouse.up(); await redo(A)
  ok('17b tự cuộn có chủ ý: kéo bắt đầu sát mép KHÔNG cuộn bất ngờ; giữ yên sát mép thì cuộn')
  // 17c: khoanh một phần NHỎ của sơ đồ cần đàn → khung dựng lại = đúng khung kéo (không phóng to); Feed xem gọn có cắt dải
  await A.evaluate(fr => { document.querySelector(`[data-sec="${fr}"]`).scrollIntoView({ block: 'center' }) }, FR); await sleep(400)
  const fb = await box(A, `[data-sec="${FR}"]`)
  const fa = { x: fb.x + fb.w * 0.16, y: fb.y + fb.h * 0.30 }, fz = { x: fb.x + fb.w * 0.34, y: fb.y + fb.h * 0.55 }
  const sv = await box(A, `[data-sec="${FR}"] svg[role=img]`)
  const frac = { l: (fa.x - sv.x) / sv.w, t: (fa.y - sv.y) / sv.h, r: (fz.x - sv.x) / sv.w, b: (fz.y - sv.y) / sv.h }
  await drag(A, fa, fz)
  assert.equal(await summary(A), '1 khối · 1 vùng hình/khoảng trống (gần đúng)', await hint(A))
  const ol = (await outlines(A)).filter(x => x.approx); assert.equal(ol.length, 1)
  const fw = fz.x - fa.x, fh = fz.y - fa.y
  assert.ok(Math.abs(ol[0].x + 6 - fa.x) <= 3 && Math.abs(ol[0].y + 6 - fa.y) <= 3 && Math.abs(ol[0].w - 12 - fw) <= 4 && Math.abs(ol[0].h - 12 - fh) <= 4, 'khung dựng lại = khung kéo: ' + JSON.stringify([ol[0], fa, fz]))
  await A.screenshot({ path: `${SHOTS}/v32-1-so-do-nguoi-khoanh.png` })
  await A.click('[data-testid=region-ask]'); await A.waitForSelector('#share-note-text'); await A.type('#share-note-text', 'E2E V3.2 hỏi một góc sơ đồ')
  await A.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Đăng lên Feed')).click())
  await waitFor(A, () => document.body.innerText.includes('Đã đăng lên Feed'))
  await B.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await B.goto(ME, { waitUntil: 'networkidle0' })
  await waitFor(B, () => [...document.querySelectorAll('[data-testid=share-note-post]')].some(c => c.innerText.includes('E2E V3.2')))
  await sleep(600)
  const handle = await B.evaluateHandle(() => [...document.querySelectorAll('[data-testid=share-note-post]')].find(c => c.innerText.includes('E2E V3.2')))
  const g1 = await handle.evaluate(c => { c.scrollIntoView({ block: 'start' }); const vr = c.querySelector('svg[role=img]').getBoundingClientRect(), orr = c.querySelector('[data-testid=region-approx]').getBoundingClientRect(); const fr = { l: (orr.left - vr.left) / vr.width, t: (orr.top - vr.top) / vr.height, r: (orr.right - vr.left) / vr.width, b: (orr.bottom - vr.top) / vr.height }; const cr = c.querySelector('[data-testid=region-crop]'); const ap = c.querySelector('[data-testid=region-approx]').getBoundingClientRect(); const cb = c.getBoundingClientRect(); return { fr, cropped: cr?.dataset.cropped, h: cb.height, apIn: ap.top >= cb.top && ap.bottom <= cb.bottom, apBg: getComputedStyle(c.querySelector('[data-testid=region-approx]')).backgroundImage, sw: document.documentElement.scrollWidth <= innerWidth + 1 } })
  for (const k of ['l', 't', 'r', 'b']) assert.ok(Math.abs(g1.fr[k] - frac[k]) < 0.015, `người nhận (390) thấy ĐÚNG phần của sơ đồ người khoanh chọn (${k}: ${g1.fr[k].toFixed(3)} vs ${frac[k].toFixed(3)})`)
  assert.equal(g1.cropped, '1', 'Feed gọn cắt dải quanh vùng hình'); assert.ok(g1.apIn && g1.apBg === 'none' && g1.sw, 'vùng khoanh nằm trọn trong thẻ, không sọc, không tràn ngang: ' + JSON.stringify(g1))
  await handle.screenshot({ path: `${SHOTS}/v32-2-so-do-feed-gon-390.png` })
  await handle.evaluate(c => c.querySelector('[data-testid=share-note-more]').click()); await sleep(500)
  const g2 = await handle.evaluate(c => ({ h: c.getBoundingClientRect().height, cropped: c.querySelector('[data-testid=region-crop]')?.dataset.cropped ?? '0' }))
  assert.ok(g2.h > g1.h + 40, `xem đầy đủ cao hơn xem gọn (${g1.h} → ${g2.h})`)
  await handle.screenshot({ path: `${SHOTS}/v32-3-so-do-feed-day-du-390.png` })
  await handle.evaluate(c => c.querySelector('[data-testid=share-note-more]').click()); await sleep(300)
  // mọi thẻ chia sẻ trong Feed đều gọn (không quá dài)
  { const cs = await B.$$('[data-testid=share-note-post]'); for (let i = 0; i < cs.length; i++) await cs[i].screenshot({ path: `${SHOTS}/v32-4-feed-the-${i + 1}-390.png` }).catch(() => {}) }
  const hs = await B.evaluate(() => [...document.querySelectorAll('[data-testid=share-note-post]')].map(c => Math.round(c.getBoundingClientRect().height)))
  assert.ok(hs.length >= 2 && hs.every(h => h < 1400) && hs.includes(Math.min(...hs)) && Math.min(...hs) < 640, 'nhiều bài chia sẻ liên tiếp: thẻ sơ đồ gọn (<640) và thẻ nhạc+chữ (4 ô, 2 dòng nhạc – Owner chốt) < 1400: ' + hs)
  ok(`17c khoanh MỘT GÓC sơ đồ → khung dựng lại đúng khung kéo (±4px); người nhận 390 thấy ĐÚNG phần sơ đồ (sai số < 1,5% bề rộng/cao sơ đồ), Feed 390 xem gọn ${g1.h}px (cắt dải) ↔ đầy đủ ${g2.h}px; ${hs.length} thẻ liên tiếp cao ${hs.join('/')}px`)
  await B.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })

  assert.deepEqual(errors, [], 'không lỗi JS/console: ' + errors.join(' | '))
  ok('16 không có lỗi JavaScript / console trong toàn bộ kịch bản')
  console.log(`\nALL_SHARE_REGION_E2E_OK ${pass} PASS`)
} catch (e) {
  console.log('FAIL: ' + (e?.stack || e)); restore()
  for (const [n, p] of Object.entries({ A, B, C, At })) { try { if (p) await p.screenshot({ path: `${SHOTS}/v31-FAIL-${n}.png` }) } catch { /* trang đã đóng */ } }
  if (process.env.E2E_HOLD_ON_FAIL) { console.log(`STAGING_READY ${ME} (lỗi — giữ stack)`); setInterval(() => {}, 1 << 30); await new Promise(() => {}) }
  await browser.close(); process.exit(1)
}
restore()
if (process.env.E2E_HOLD) {
  console.log(`\nSTAGING_READY ${ME}\n  Đăng nhập: a@test.local (An — người khoanh) · b@test.local (Bình — người nhận, cùng lớp) · c@test.local (Chi — lớp khác, KHÔNG quyền); mật khẩu bất kỳ\n  Buổi 1: ${SESSION}  → bấm "Khoanh để hỏi" (nút tím, góc phải-dưới)`)
  await browser.close().catch(() => {}); setInterval(() => {}, 1 << 30); await new Promise(() => {})
}
await browser.close()
