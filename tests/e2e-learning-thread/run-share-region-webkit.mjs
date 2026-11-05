// E2E Contextual Share V3 (khoanh vùng hỗn hợp) trên WebKit (Playwright) — chạy SAU run-share-region.mjs trên cùng stack. WebKit ≠ Safari iOS thật.
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
  await A.mouse.move(r.x - 6, r.y - 3); await A.mouse.down(); await A.mouse.move(r.r + 6, r.b + 3, { steps: 8 }); await A.mouse.up(); await sleep(300)
  assert.equal(await summary(A), '1 khối · 1 đoạn chữ'); ok('desktop: khoanh MỘT đoạn chữ bằng chuột → "1 khối · 1 đoạn chữ"')
  await A.click('[data-testid=region-redo]'); await sleep(150)
  await topAt(A, `[data-tp="${SI}:blocks.0.text"]`, 700)
  const hh = await box(A, `[data-tp="${SI}:blocks.0.text"]`), sf = await box(A, `[data-sec="${SC}"] .at-surface`)
  await A.mouse.move(sf.x + 8, Math.max(30, sf.y + sf.h * 0.6)); await A.mouse.down(); await A.mouse.move(sf.r - 8, hh.b + 4, { steps: 10 }); await A.mouse.up(); await sleep(300)
  const mix = await summary(A)
  assert.match(mix ?? '', /^2 khối · \d+ đoạn chữ · bản nhạc \(ô \d+(–\d+)?\)$/, mix)
  ok(`desktop: khoanh HỖN HỢP chữ + nhạc → "${mix}"`)
  await A.click('[data-testid=region-ask]'); await A.fill('#share-note-text', 'E2E V3 WebKit hỏi chữ và nhạc')
  await A.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Đăng lên Feed')).click())
  await A.waitForFunction(() => document.body.innerText.includes('Đã đăng lên Feed'), null, { timeout: 25000 })
  const NID = sql(`select id from public.share_notes where anchor_kind = 'region' and note like 'E2E V3 WebKit%' limit 1`)
  assert.ok(NID); ok('desktop: đăng Feed thành công')

  // iPhone 390 — người nhận
  const B = await open('b@test.local', IPHONE)
  await openSession(B, `${SESSION}?note=${NID}`)
  await B.waitForFunction(() => document.querySelectorAll('.lsn-rg-outline').length === 2, null, { timeout: 25000 })
  await sleep(800)
  const hd = await box(B, `[data-tp="${SI}:blocks.0.text"]`), os = await outlines(B)
  assert.ok(os.some(o => o.x <= hd.x + 1 && o.y <= hd.y + 1 && o.x + o.w >= hd.r - 1 && o.y + o.h >= hd.b - 1), 'viền bao tiêu đề study: ' + JSON.stringify([os, hd]))
  const surf = await box(B, `[data-sec="${SC}"] .at-surface`), so = os.find(o => o.sec === SC)
  assert.ok(so && so.x >= surf.x - 9 && so.x + so.w <= surf.r + 9 && so.h < surf.h - 4, 'viền nhạc trong bề mặt: ' + JSON.stringify([so, surf]))
  assert.ok(await B.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await B.screenshot({ path: `${SHOTS}/v3-webkit-nguoi-nhan-390.png` })
  ok('iPhone 390 (WebKit): người nhận thấy 2 viền bám đúng tiêu đề + bề mặt nhạc đã khắc lại; không tràn ngang')

  // iPhone 390 — người soạn (PointerEvent touch tổng hợp)
  const At = await open('a@test.local', IPHONE)
  await openSession(At)
  await At.click('[data-testid=region-start]'); await At.waitForSelector('[data-testid=region-capture]')
  await topAt(At, `[data-tp="${SI}:blocks.1.text"]`, 300)
  r = await box(At, `[data-tp="${SI}:blocks.1.text"]`)
  await touchDrag(At, { x: r.x - 4, y: r.y - 3 }, { x: r.r + 4, y: r.b + 3 })
  assert.equal(await summary(At), '1 khối · 1 đoạn chữ'); ok('iPhone 390 (WebKit, PointerEvent touch tổng hợp): vẽ khung → "1 khối · 1 đoạn chữ" (KHÔNG thay thử iPhone thật)')
  // WebKit báo 2 loại lỗi vô hại khi điều hướng cắt ngang yêu cầu đang chạy (giống run-share-text-webkit.mjs)
  const real = errors.filter(m => !/ due to access control checks\.$|Importing a module script failed/.test(m))
  assert.deepEqual(real, [], real.join(' | ')); ok('không lỗi JavaScript thật (bỏ qua 2 loại nhiễu điều hướng của WebKit)')
  console.log(`\nALL_SHARE_REGION_WEBKIT_OK ${pass} PASS`)
} catch (e) { console.log('FAIL: ' + (e?.stack || e)); await browser.close(); process.exit(1) }
if (process.env.E2E_HOLD) {
  console.log(`\nSTAGING_READY ${ME}\n  Đăng nhập: a@test.local (An — người khoanh) · b@test.local (Bình — người nhận, cùng lớp) · c@test.local (Chi — lớp khác, KHÔNG quyền); mật khẩu bất kỳ\n  Buổi 1: ${SESSION}  → bấm "Khoanh vùng để hỏi" (nút tím, góc phải-dưới)`)
  await browser.close().catch(() => {}); setInterval(() => {}, 1 << 30); await new Promise(() => {})
}
await browser.close()
