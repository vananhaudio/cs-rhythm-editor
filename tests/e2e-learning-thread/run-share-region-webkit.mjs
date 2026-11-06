// E2E Contextual Share V3.1 (khoanh đúng phần được bao) trên WebKit (Playwright) — chạy SAU run-share-region.mjs trên cùng stack. WebKit ≠ Safari iOS thật.
// Desktop 1280: chuột thật (đoạn chữ + hỗn hợp chữ/nhạc) → đăng Feed → iPhone 390 người nhận thấy vùng bám phần tử.
// iPhone 390 (người soạn): Playwright WebKit KHÔNG có kéo ngón tay ⇒ phát PointerEvent kiểu 'touch' trực tiếp vào lớp bắt kéo (kiểm LOGIC; KHÔNG thay iPhone thật).
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const require = createRequire((process.env.PLAYWRIGHT_DIR || process.env.PUPPETEER_DIR) + '/')
const { webkit } = require('playwright-core')
const ORIGIN = `http://class.localhost:${process.env.VITE_PORT}`, ME = `${ORIGIN}/me`
const TH01 = 'b1000000-0000-4000-8000-000000000001', S1 = '51000000-0000-4000-8000-000000000001', SESSION = `${ME}/classes/${TH01}/sessions/1`
const SHOTS = process.env.SHOTS
const sql = q => execFileSync(`${process.env.E2E_PG_BIN}/psql`, ['-X', '-q', '-tA', '-h', process.env.E2E_PG_SOCK, '-p', process.env.E2E_PG_PORT, '-U', 'postgres', '-d', 'e2e', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim()
const browser = await webkit.launch()
let pass = 0
const ok = m => { pass++; console.log('PASS: [webkit v3] ' + m) }
const errors = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
const IPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const DESK = { viewport: { width: 1280, height: 900 } }

async function open(email, vp) {
  const ctx = await browser.newContext(vp); const page = await ctx.newPage()
  page.on('pageerror', e => errors.push(`${email} pageerror: ${e.message}`))
  await page.goto(ME, { waitUntil: 'networkidle' })
  await page.fill('#cs-login-email', email); await page.fill('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 20000 })
  return page
}
async function openSession(page, url = SESSION) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-sec] .lsn-leaf', { timeout: 30000 })
  await page.waitForSelector('.lsn-score-host .at-surface svg', { timeout: 40000 })
  await sleep(600)
}
const box = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom } }, sel)
const topAt = (page, sel, y) => page.evaluate(([sel, y]) => { const r = document.querySelector(sel).getBoundingClientRect(); scrollBy(0, r.top - y) }, [sel, y]).then(() => sleep(300))
const summary = page => page.textContent('[data-testid=region-summary]', { timeout: 3000 }).catch(() => null)
const anchor = page => page.evaluate(() => { const e = document.querySelector('[data-testid=region-bar]'); return e?.dataset.anchor ? JSON.parse(e.dataset.anchor) : null })
const fills = page => page.evaluate(() => [...document.querySelectorAll('.lsn-rg-fill')].map(o => { const r = o.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } }))
const lines = (page, sel) => page.evaluate(sel => { const rg = document.createRange(); rg.selectNodeContents(document.querySelector(sel)); return [...rg.getClientRects()].map(r => ({ x: r.left, y: r.top, w: r.width, h: r.height })) }, sel)
const outlines = page => page.evaluate(() => [...document.querySelectorAll('.lsn-rg-outline')].map(o => { const r = o.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, sec: o.parentElement.dataset.sec } }))
const touchDrag = (page, a, b) => page.evaluate(async ([a, b]) => {
  const cap = document.querySelector('[data-testid=region-capture]'); const mk = (t, p) => new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, bubbles: true, cancelable: true })
  const w = () => new Promise(r => setTimeout(r, 30))                       // như thiết bị thật: mỗi sự kiện một nhịp (React cần render giữa các sự kiện)
  cap.dispatchEvent(mk('pointerdown', a)); await w()
  for (let i = 1; i <= 6; i++) { cap.dispatchEvent(mk('pointermove', { x: a.x + (b.x - a.x) * i / 6, y: a.y + (b.y - a.y) * i / 6 })); await w() }
  cap.dispatchEvent(mk('pointerup', b))
}, [a, b]).then(() => sleep(300))

try {
  const A = await open('a@test.local', DESK)
  await openSession(A)
  const SI = await A.evaluate(() => [...document.querySelectorAll('.lsn-leaf')].find(x => x.textContent.includes('nghe kỹ nhịp chùm ba ở ô 2')).closest('[data-sec]').dataset.sec)
  const SC = String(Number(SI) - 1)
  await A.click('[data-testid=region-start]'); await A.waitForSelector('[data-testid=region-capture]')
  await topAt(A, `[data-tp="${SI}:blocks.1.text"]`, 300)
  let r = await box(A, `[data-tp="${SI}:blocks.1.text"]`)
  const ln = await lines(A, `[data-tp="${SI}:blocks.1.text"]`)
  await A.mouse.move(r.x - 4, ln[0].y - 2); await A.mouse.down(); await A.mouse.move(ln[0].x + ln[0].w * 0.5, ln[0].y + ln[0].h + 1, { steps: 8 }); await A.mouse.up(); await sleep(300)
  let anc = await anchor(A); assert.ok(anc, 'có neo')
  const cpl = await A.evaluate(si => Array.from(document.querySelector(`[data-tp="${si}:blocks.1.text"]`).textContent).length, SI)
  const [f0, t0] = anc[0].leaves[0].r[0]; assert.ok(f0 === 0 && t0 > 3 && t0 < cpl / 2, `nửa dòng đầu: [${f0},${t0}] / ${cpl}`)
  ok(`desktop: khoanh NỬA đoạn bằng chuột → ${t0}/${cpl} ký tự đầu, không lấy cả lá`)
  await A.click('[data-testid=region-redo]'); await sleep(150)
  await topAt(A, `[data-tp="${SI}:blocks.0.text"]`, 640)
  const hh = await box(A, `[data-tp="${SI}:blocks.0.text"]`), sf = await box(A, `[data-sec="${SC}"] .at-surface`), pl = await lines(A, `[data-tp="${SI}:blocks.1.text"]`)
  await A.mouse.move(sf.x + 6, Math.max(30, sf.y + sf.h * 0.55)); await A.mouse.down(); await A.mouse.move(pl[0].x + pl[0].w * 0.5, pl[0].y + pl[0].h + 1, { steps: 10 }); await A.mouse.up(); await sleep(300)
  const mix = await summary(A)
  assert.match(mix ?? '', /^2 khối · \d+ đoạn chữ · bản nhạc \(ô \d+(–\d+)?\)$/, mix); void hh
  ok(`desktop: khoanh HỖN HỢP chữ + một phần nhạc → "${mix}"`)
  await A.click('[data-testid=region-ask]'); await A.fill('#share-note-text', 'E2E V3.1 WebKit hỏi chữ và nhạc')
  await A.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Đăng lên Feed')).click())
  await A.waitForFunction(() => document.body.innerText.includes('Đã đăng lên Feed'), null, { timeout: 25000 })
  const NID = sql(`select id from public.share_notes where anchor_kind = 'region' and note like 'E2E V3.1 WebKit%' limit 1`)
  assert.ok(NID); ok('desktop: đăng Feed thành công')

  // iPhone 390 — người nhận
  const B = await open('b@test.local', IPHONE)
  await openSession(B, `${SESSION}?note=${NID}`)
  await B.waitForFunction(() => document.querySelectorAll('.lsn-rg-fill').length >= 2, null, { timeout: 25000 })
  await sleep(800)
  const hd = await box(B, `[data-tp="${SI}:blocks.0.text"]`), pa = await box(B, `[data-tp="${SI}:blocks.1.text"]`), fl = await fills(B), surf = await box(B, `[data-sec="${SC}"] .at-surface`)
  const inb = (f, b) => f.x >= b.x - 3 && f.y >= b.y - 3 && f.x + f.w <= b.r + 3 && f.y + f.h <= b.b + 3
  assert.ok(fl.some(f => inb(f, hd)), 'ô tô nằm trên tiêu đề study'); assert.ok(fl.some(f => inb(f, pa)), 'ô tô nằm trên đoạn')
  const paFill = fl.filter(f => inb(f, pa)).reduce((n, f) => n + f.w * f.h, 0); assert.ok(paFill < (pa.r - pa.x) * (pa.b - pa.y) * 0.75, 'chỉ một phần đoạn được tô')
  assert.ok(fl.some(f => inb(f, surf)), 'ô nhạc tô nằm trong bề mặt nhạc'); assert.ok(await B.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await B.screenshot({ path: `${SHOTS}/v31-webkit-nguoi-nhan-390.png` })
  ok('iPhone 390 (WebKit): người nhận thấy ô tô bám đúng CHỮ (tiêu đề + nửa đầu đoạn) và đúng ô nhạc đã khắc lại; không tràn ngang')
  // Feed trên iPhone: nguyên cảnh + vùng khoanh
  await B.goto(ME, { waitUntil: 'networkidle' })
  await B.waitForSelector('[data-testid=region-context] [data-testid=region-mark]', { timeout: 30000 })
  const fm = await B.evaluate(() => [...document.querySelectorAll('[data-testid=region-mark]')].map(m => m.textContent))
  assert.ok(fm.some(m => m.startsWith('Giữ nhịp')) && fm.every(m => m.length < 120), JSON.stringify(fm))
  assert.ok(await B.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await B.screenshot({ path: `${SHOTS}/v31-webkit-feed-390.png` })
  ok('iPhone 390 (WebKit): Feed dựng nguyên cảnh giáo trình + tô đúng đoạn khoanh; không tràn ngang')

  // iPhone 390 — người soạn (PointerEvent touch tổng hợp)
  const At = await open('a@test.local', IPHONE)
  await openSession(At)
  await At.click('[data-testid=region-start]'); await At.waitForSelector('[data-testid=region-capture]')
  await topAt(At, `[data-tp="${SI}:blocks.1.text"]`, 300)
  r = await box(At, `[data-tp="${SI}:blocks.1.text"]`)
  const tl = await lines(At, `[data-tp="${SI}:blocks.1.text"]`)
  await touchDrag(At, { x: r.x - 4, y: tl[0].y - 2 }, { x: tl[0].x + tl[0].w * 0.6, y: tl[0].y + tl[0].h + 1 })
  anc = await anchor(At); assert.ok(anc, 'có neo (cảm ứng)')
  const [tf, tt] = anc[0].leaves[0].r[0]; assert.ok(tf === 0 && tt > 2 && tt < cpl / 2 + 20, `cảm ứng: nửa dòng đầu [${tf},${tt}]`)
  ok('iPhone 390 (WebKit, PointerEvent touch tổng hợp): vẽ khung quanh nửa dòng đầu → chỉ phần đó (KHÔNG thay thử iPhone thật)')
  // WebKit báo 2 loại lỗi vô hại khi điều hướng cắt ngang yêu cầu đang chạy (giống run-share-text-webkit.mjs)
  const real = errors.filter(m => !/ due to access control checks\.$|Importing a module script failed/.test(m))
  assert.deepEqual(real, [], real.join(' | ')); ok('không lỗi JavaScript thật (bỏ qua 2 loại nhiễu điều hướng của WebKit)')
  console.log(`\nALL_SHARE_REGION_WEBKIT_OK ${pass} PASS`)
} catch (e) { console.log('FAIL: ' + (e?.stack || e)); await browser.close(); process.exit(1) }
if (process.env.E2E_HOLD) {
  console.log(`\nSTAGING_READY ${ME}\n  Đăng nhập: a@test.local (An — người khoanh) · b@test.local (Bình — người nhận, cùng lớp) · c@test.local (Chi — lớp khác, KHÔNG quyền); mật khẩu bất kỳ\n  Buổi 1: ${SESSION}  → bấm "Khoanh để hỏi" (nút tím, góc phải-dưới)`)
  await browser.close().catch(() => {}); setInterval(() => {}, 1 << 30); await new Promise(() => {})
}
await browser.close()
