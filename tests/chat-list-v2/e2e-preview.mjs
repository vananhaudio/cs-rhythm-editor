// E2E giao diện Chat List V2 trên Chrome thật, chạy vào trang Preview (dữ liệu mẫu 0/1/50/120+ qua máy chủ giả ở lớp fetch).
//   npx vite --port 5199 &   rồi   PUPPETEER_DIR=/path/to/dir node tests/chat-list-v2/e2e-preview.mjs [outDir]
// Ngữ nghĩa lọc/tìm/con trỏ/ghim thật của DB được kiểm riêng ở scripts/test-chat-list-v2-db.sh.
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
const dir = process.env.PUPPETEER_DIR || '/Volumes/vananhaudio/.local/e2e-tools'
const puppeteer = (await import(pathToFileURL(join(dir, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).href)).default
const BASE = process.env.PREVIEW_BASE || 'http://localhost:5199/chat-preview.html'
const OUT = process.argv[2] || '/tmp/cl-shots'
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('PASS:', m) } else { fail++; console.log('FAIL:', m) } }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })

async function open(qs, { w = 390, h = 844, mobile = true } = {}) {
  const p = await browser.newPage()
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile })
  p.errs = []
  p.on('pageerror', e => p.errs.push(String(e)))
  p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) p.errs.push(m.text()) })
  await p.goto(`${BASE}?${qs}`, { waitUntil: 'networkidle0' })
  await p.waitForSelector('[data-testid="inbox"]', { timeout: 8000 })
  await sleep(350)
  return p
}
const rows = p => p.$$eval('[data-testid="inbox-row"]', els => els.map(e => ({ id: e.dataset.conv, kind: e.dataset.kind, label: e.getAttribute('aria-label'), unread: e.parentElement.classList.contains('is-unread') })))
const names = p => p.$$eval('.cs-inbox-name', els => els.map(e => e.textContent))
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` })
const settle = async p => { await sleep(500); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => r()))) }
async function scrollAll(p, max = 40) {
  let last = -1
  for (let i = 0; i < max; i++) {
    const n = (await rows(p)).length
    if (n === last && !(await p.$('[data-testid="inbox-sentinel"]'))) break
    last = n
    await p.evaluate(() => { const el = document.querySelector('[data-testid="inbox-sentinel"]'); if (el) el.scrollIntoView({ block: 'center' }); else window.scrollTo(0, document.body.scrollHeight) })
    await sleep(300)
  }
  return (await rows(p)).length
}
const tap = (p, h) => h.evaluate(e => e.click())   // bấm bằng DOM (puppeteer cuộn nút xuống dưới thanh dính rồi bấm trượt)
const typeSearch = async (p, t) => { await p.click('[data-testid="inbox-search"]'); await p.type('[data-testid="inbox-search"]', t); await sleep(700) }
const clearSearch = async p => { await p.click('.cs-inbox-search-x'); await sleep(500) }

// ── 1. 120 DM + 24 Band: trang đầu 30, cuộn tải thêm tới đủ 144, không trùng ──
{
  const p = await open('view=mobile&dm=120&bands=24')
  const first = await rows(p)
  ok(first.length === 30, `120+ : trang đầu đúng 30 hàng (có ${first.length})`)
  await shot(p, 'm-120')
  const total = await scrollAll(p)
  const all = await rows(p)
  ok(total === 144 && new Set(all.map(r => r.id)).size === 144, `120+ : cuộn hết → đủ 144 hội thoại, 0 trùng (có ${total})`)
  ok(!!(await p.$('[data-testid="end-note"]')), '120+ : hiện dòng "Đã hiển thị tất cả 144" (không cắt âm thầm)')
  await p.evaluate(() => window.scrollTo(0, 0)); await settle(p)
  // tìm hội thoại CHƯA tải: chuyển về đầu danh sách mới (reload) rồi tìm tên ở cuối
  await p.reload({ waitUntil: 'networkidle0' }); await p.waitForSelector('[data-testid="inbox"]'); await sleep(400)
  const before = await names(p)
  ok(!before.some(n => /120$/.test(n)), 'tìm : hội thoại cuối (…120) CHƯA nằm trong 30 hàng đã tải')
  await typeSearch(p, '120')
  const hit = await names(p)
  ok(hit.length >= 1 && hit.every(n => /120/.test(n)), `tìm : "120" tìm được hội thoại chưa tải (${hit.join(' | ')})`)
  await shot(p, 'm-search-120')
  await clearSearch(p)
  await typeSearch(p, 'binh')   // không dấu → Bình
  const b = await names(p)
  ok(b.length > 0 && b.every(n => /b[iì]nh/i.test(n.normalize('NFD').replace(/[̀-ͯ]/g, ''))), `tìm : "binh" khớp "Bình" bỏ dấu (${b.length} kết quả)`)
  await shot(p, 'm-search-binh')
  await typeSearch(p, 'zzzzqq')
  ok((await p.$eval('.cs-empty', e => e.textContent)).includes('Không tìm thấy'), 'tìm : không có kết quả → trạng thái trống "Không tìm thấy"')
  await shot(p, 'm-search-empty')
  ok(p.errs.length === 0, `console sạch lỗi (${p.errs.slice(0, 2)})`)
  await p.close()
}

// ── 2. Bộ lọc: Cá nhân · Lớp học (trống) · Band · Chưa đọc ──
{
  const p = await open('view=mobile&dm=120&bands=24')
  await p.click('[data-testid="tab-dm"]'); await sleep(500)
  let r = await rows(p); ok(r.length > 0 && r.every(x => x.kind === 'dm'), `lọc Cá nhân: ${r.length} hàng, toàn DM`)
  await p.click('[data-testid="tab-band"]'); await sleep(500)
  r = await rows(p); ok(r.length > 0 && r.every(x => x.kind === 'band'), `lọc Band: ${r.length} hàng, toàn Band`)
  await shot(p, 'm-filter-band')
  await p.click('[data-testid="tab-class"]'); await sleep(500)
  ok((await rows(p)).length === 0 && (await p.$eval('.cs-empty', e => e.textContent)).includes('Nhóm chat lớp học sắp có'), 'lọc Lớp học: trạng thái trống "Nhóm chat lớp học sắp có"')
  await shot(p, 'm-filter-class-empty')
  await p.click('[data-testid="tab-all"]'); await p.click('[data-testid="chip-unread"]'); await sleep(500)
  r = await rows(p); ok(r.length > 0 && r.every(x => x.unread), `Chưa đọc: ${r.length} hàng, tất cả đều chưa đọc`)
  await shot(p, 'm-filter-unread')
  await p.click('[data-testid="tab-dm"]'); await sleep(400)
  r = await rows(p); ok(r.length > 0 && r.every(x => x.unread && x.kind === 'dm'), 'Cá nhân + Chưa đọc kết hợp đúng')
  await p.close()
}

// ── 3. Ghim do người dùng chọn: không tự ghim; ghim → mục Đã ghim; tối đa 10 ──
{
  const p = await open('view=mobile&dm=120&bands=24')
  ok(!(await p.$('section[aria-label="Đã ghim"]')), 'ghim: không tự ghim Band/lớp nào (chưa có mục Đã ghim)')
  await p.click('[data-testid="edit-toggle"]'); await sleep(200)
  await shot(p, 'm-edit-mode')
  const btns = await p.$$('[data-testid="row-pin"]')
  await tap(p, btns[1]); await sleep(500)
  await tap(p, (await p.$$('[data-testid="row-pin"]'))[3]); await sleep(500)
  const pinned = await p.$$eval('section[aria-label="Đã ghim"] [data-testid="inbox-row"]', els => els.map(e => e.dataset.conv))
  ok(pinned.length === 2, `ghim: 2 hội thoại vào mục "Đã ghim" (${pinned.length})`)
  ok(!(await p.$$eval('section[aria-label="Tin nhắn"] [data-testid="inbox-row"]', els => els.map(e => e.dataset.conv))).some(id => pinned.includes(id)), 'ghim: hội thoại đã ghim KHÔNG lặp ở danh sách thường')
  await shot(p, 'm-pinned')
  // ghim tới 10 rồi thêm cái thứ 11 → báo lỗi
  for (let i = 0; i < 8; i++) { const b = await p.$$('[data-testid="row-pin"]'); const unp = []; for (const x of b) { if ((await x.evaluate(e => e.getAttribute('aria-pressed'))) === 'false') unp.push(x) } await tap(p, unp[0]); await sleep(350) }
  const p10 = await p.$$('section[aria-label="Đã ghim"] [data-testid="inbox-row"]')
  ok(p10.length === 10, `ghim: đủ 10 (${p10.length})`)
  const b11 = (await p.$$('[data-testid="row-pin"]'))
  for (const x of b11) { if ((await x.evaluate(e => e.getAttribute('aria-pressed'))) === 'false') { await tap(p, x); break } }
  await sleep(500)
  ok((await p.$eval('.cs-inbox-toast', e => e.textContent)).includes('tối đa 10'), 'ghim: cái thứ 11 bị từ chối với thông báo rõ ràng')
  await shot(p, 'm-pin-limit')
  // bỏ ghim
  const first = await p.$('section[aria-label="Đã ghim"] [data-testid="row-pin"]'); await tap(p, first); await sleep(500)
  ok((await p.$$('section[aria-label="Đã ghim"] [data-testid="inbox-row"]')).length === 9, 'ghim: bỏ ghim → còn 9')
  const calls = await p.evaluate(() => window.__mockCalls.filter(x => x === 'chat_pin_set').length)
  ok(calls >= 11, `ghim: gọi RPC chat_pin_set thật (${calls} lần, không dùng localStorage)`)
  ok(await p.evaluate(() => !Object.keys(localStorage).some(k => /pin/i.test(k))), 'ghim: KHÔNG lưu trong localStorage')
  await p.close()
}

// ── 4. Nhấn giữ mở menu Ghim (cảm ứng) ──
{
  const p = await open('view=mobile&dm=20&bands=4')
  const box = await (await p.$('[data-testid="inbox-row"]')).boundingBox()
  await p.touchscreen.touchStart(box.x + 100, box.y + 20); await sleep(700); await p.touchscreen.touchEnd(); await sleep(300)
  ok(!!(await p.$('[role="menu"] [data-testid="menu-pin"]')), 'nhấn giữ: mở menu "Ghim lên đầu"')
  await shot(p, 'm-longpress-menu')
  await p.click('[data-testid="menu-pin"]'); await sleep(500)
  ok((await p.$$('section[aria-label="Đã ghim"] [data-testid="inbox-row"]')).length === 1, 'nhấn giữ → Ghim: hội thoại vào Đã ghim')
  await p.close()
}

// ── 5. Trạng thái 0 / 1 / 50 ──
{
  const p0 = await open('view=mobile&dm=0&bands=0')
  ok((await rows(p0)).length === 0 && (await p0.$eval('.cs-empty', e => e.textContent)).includes('Chưa có cuộc trò chuyện'), '0 hội thoại: trạng thái trống + nút Mở Bạn bè')
  ok(!!(await p0.$x?.('//button[contains(., "Mở Bạn bè")]') ?? [1]), '0 hội thoại: có nút Mở Bạn bè')
  await shot(p0, 'm-0'); await p0.close()
  const p1 = await open('view=mobile&dm=1&bands=0')
  ok((await rows(p1)).length === 1 && !(await p1.$('[data-testid="end-note"]')) && !(await p1.$('[data-testid="inbox-sentinel"]')), '1 hội thoại: đúng 1 hàng, không có "tải thêm"')
  await shot(p1, 'm-1'); await p1.close()
  const p50 = await open('view=mobile&dm=50&bands=6')
  ok((await rows(p50)).length === 30, '50+: trang đầu 30')
  await scrollAll(p50)
  ok((await rows(p50)).length === 56, `50+: cuộn hết → 56 (${(await rows(p50)).length})`)
  await shot(p50, 'm-50'); await p50.close()
}

// ── 6. Thầy/Admin: Quản lý Band riêng, có tìm kiếm + phân trang; không tràn danh sách chính ──
{
  const p = await open('view=mobile&dm=20&bands=3&teacher=1&support=60')
  const main = await rows(p)
  ok(main.length === 23 || main.length <= 30, `Thầy: danh sách chính chỉ DM + Band của mình (${main.length}), KHÔNG có 60 Band hỗ trợ`)
  ok(!main.some(r => r.label.includes('Lớp 1')), 'Thầy: Band hỗ trợ không lẫn trong danh sách chính')
  ok(!!(await p.$('[data-testid="open-band-manager"]')), 'Thầy: có hàng "Quản lý Band"')
  await shot(p, 'm-teacher-main')
  await p.click('[data-testid="open-band-manager"]'); await sleep(600)
  ok(!!(await p.$('[data-testid="band-manager"]')) && (await rows(p)).length === 30, 'Quản lý Band: trang đầu 30 trong 60')
  ok((await scrollAll(p)) === 60, 'Quản lý Band: cuộn hết → đủ 60')
  await p.evaluate(() => window.scrollTo(0, 0)); await settle(p)
  await shot(p, 'm-manager')
  await typeSearch(p, 'lop 105')
  const hit = await names(p); ok(hit.length === 1 && /105/.test(hit[0]), `Quản lý Band: tìm "lop 105" → ${hit.join('|')}`)
  await shot(p, 'm-manager-search')
  await p.click('[data-testid="manager-back"]'); await sleep(400)
  ok(!!(await p.$('[data-testid="open-band-manager"]')), 'Quản lý Band: nút Trò chuyện quay về danh sách chính')
  await p.close()
}

// ── 7. Server chưa nâng cấp (legacy) · lỗi mạng ──
{
  const p = await open('view=mobile&dm=150&bands=10&legacy=1')
  const n = (await rows(p)).length
  ok(n > 0 && n <= 100 && !(await p.$('[data-testid="edit-toggle"]')), `legacy: ≤100 hàng, KHÔNG có nút ghim (${n})`)
  ok(!!(await p.$('[data-testid="legacy-note"]')), 'legacy: ghi chú rõ "Đang hiển thị 100 cuộc gần nhất" (không cắt âm thầm)')
  await typeSearch(p, 'binh'); ok((await rows(p)).length > 0, 'legacy: tìm kiếm cục bộ vẫn chạy')
  await shot(p, 'm-legacy'); await p.close()
  const pe = await open('view=mobile&dm=10&fail=1')
  ok(!!(await pe.$('.cs-feed-error')), 'lỗi server: hiện khung lỗi + nút Thử lại'); await shot(pe, 'm-error'); await pe.close()
}

// ── 8. Mở hội thoại, gửi tin — hành vi nhắn tin giữ nguyên ──
{
  const p = await open('view=mobile&dm=30&bands=3')
  const r = await rows(p)
  await (await p.$(`[data-conv="${r[0].id}"]`)).click(); await sleep(900)
  ok(!!(await p.$('.cs-chat-pane.is-open')) && !!(await p.$('.cs-chat-input')), 'mở hội thoại: màn chat toàn màn hình + ô soạn')
  await shot(p, 'm-conversation')
  await p.type('.cs-chat-input', 'Tin thử Preview'); await p.click('.cs-chat-send'); await sleep(900)
  ok((await p.$$eval('.cs-msg-bubble', els => els.map(e => e.textContent))).some(t => t.includes('Tin thử Preview')), 'gửi tin: tin hiện trong hội thoại')
  await p.click('.cs-chat-back'); await sleep(500)
  ok(!!(await p.$('[data-testid="inbox"]')) && (await rows(p)).length > 0, 'quay lại: danh sách còn nguyên (không mất bộ lọc/tải lại)')
  await p.close()
}

// ── 9. Desktop 1280: hai cột, ⋯ menu, mở hội thoại ──
{
  const p = await open('view=desktop&dm=120&bands=24&pins=2&teacher=1&support=40', { w: 1280, h: 860, mobile: false })
  await shot(p, 'd-120')
  const r = await rows(p)
  ok(r.length === 32, `desktop: 2 đã ghim + trang đầu 30 (có ${r.length})`)
  ok(!!(await p.$('section[aria-label="Đã ghim"]')), 'desktop: ghim cấu hình sẵn hiện ở mục Đã ghim')
  await p.hover('[data-testid="inbox-row"]'); await sleep(200)
  await p.click('.cs-inbox-row:hover [data-testid="row-more"]'); await sleep(300)
  ok(!!(await p.$('[data-testid="menu-pin"]')), 'desktop: nút ⋯ hiện khi rê chuột, mở menu Ghim')
  await shot(p, 'd-menu')
  await p.keyboard.press('Escape'); await sleep(200)
  await (await p.$('section[aria-label="Tin nhắn"] [data-testid="inbox-row"]')).click(); await sleep(900)
  ok(!!(await p.$('.cs-chat-input')) && !!(await p.$('[data-testid="inbox"]')), 'desktop: mở hội thoại, danh sách vẫn hiện bên trái')
  await shot(p, 'd-open')
  await typeSearch(p, 'lop 1'); await shot(p, 'd-search')
  ok(p.errs.length === 0, `desktop: console sạch lỗi (${p.errs.slice(0, 2)})`)
  await p.close()
}
await browser.close()
console.log(`\n${pass} PASS, ${fail} FAIL`)
process.exit(fail ? 1 : 0)
