// E2E Contextual Share V2 (vùng văn bản) trên WebKit (Playwright) — chạy SAU run-share-text.mjs trên cùng stack. WebKit ≠ Safari iOS thật.
// iPhone 390: chọn văn bản → thanh đáy → Composer → Đăng Feed · Bình: khung gốc + <mark>, Xem đầy đủ/Thu gọn, cụm nút, Mở trong giáo trình → <mark> trong màn hình
// iPhone 320 + desktop 1280: cụm nút · Chi: không giáo trình · chọn vượt phạm vi (cảnh báo, khoá nút).
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const require = createRequire((process.env.PLAYWRIGHT_DIR || process.env.PUPPETEER_DIR) + '/')
const { webkit } = require('playwright-core')
const ORIGIN = `http://class.localhost:${process.env.VITE_PORT}`, ME = `${ORIGIN}/me`
const TH01 = 'b1000000-0000-4000-8000-000000000001', SESSION = `${ME}/classes/${TH01}/sessions/1`
const SHOTS = process.env.SHOTS
const sql = q => execFileSync(`${process.env.E2E_PG_BIN}/psql`, ['-X', '-q', '-tA', '-h', process.env.E2E_PG_SOCK, '-p', process.env.E2E_PG_PORT, '-U', 'postgres', '-d', 'e2e', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim()
const browser = await webkit.launch()
let pass = 0
const ok = m => { pass++; console.log('PASS: [webkit v2] ' + m) }
const errors = []
const IPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const SEL = 'Vội nhịp ở ô thứ ba'               // callout (khác với đoạn Chrome đã dùng)
const NOTE = 'E2E V2 WebKit hỏi: vì sao vội nhịp ở ô thứ ba'

async function open(email, vp) {
  const ctx = await browser.newContext(vp); const page = await ctx.newPage()
  page.rpcs = []
  page.on('request', r => { const m = r.url().match(/\/rest\/v1\/rpc\/(\w+)/); if (m && r.method() !== 'OPTIONS') { let body = {}; try { body = JSON.parse(r.postData() ?? '{}') } catch { /* GET */ } page.rpcs.push({ fn: m[1], body, raw: r.postData() ?? '' }) } })
  page.on('pageerror', e => errors.push(`${email} pageerror: ${e.message}`))
  await page.goto(ME, { waitUntil: 'networkidle' })
  await page.fill('#cs-login-email', email); await page.fill('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 20000 })
  return page
}
const calls = (p, fn) => p.rpcs.filter(r => r.fn === fn)
const selectIn = (page, tp, text, endTp = null, endText = null) => page.evaluate(([tp, text, endTp, endText]) => {
  const find = (tpv, t) => { const el = document.querySelector(`[data-tp="${tpv}"]`); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.data.indexOf(t); if (i >= 0) return { n, i } } return null }
  const a = find(tp, text), b = endTp ? find(endTp, endText) : a
  const sel = getSelection(); sel.removeAllRanges(); sel.setBaseAndExtent(a.n, a.i, b.n, b.i + (endTp ? endText.length : text.length))
}, [tp, text, endTp, endText])
const bar = page => page.evaluate(() => { const b = document.querySelector('[data-testid="text-share-bar"]'); if (!b) return null; const r = b.getBoundingClientRect()
  return { state: b.dataset.state, quote: b.querySelector('[data-testid="text-share-quote"]')?.textContent ?? null, hint: b.querySelector('[data-testid="text-share-hint"]')?.textContent ?? null, ask: !!b.querySelector('[data-testid="text-share-ask"]'),
    askH: Math.round(b.querySelector('[data-testid="text-share-ask"]')?.getBoundingClientRect().height ?? 0), inView: r.top >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 } })
const card = (page, q) => page.evaluate(q => {
  const c = [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)); if (!c) return null
  const more = c.querySelector('[data-testid="share-note-more"]'), open = c.querySelector('[data-testid="share-note-open"]'), x = c.querySelector('[data-testid="context-section"]')
  const mb = more?.getBoundingClientRect(), ob = open?.getBoundingClientRect(), cb = c.getBoundingClientRect(), lab = open?.querySelector('span'), ml = more?.querySelector('span')
  return { h: Math.round(cb.height), kind: c.querySelector('.cs-tool-share-kind')?.textContent.trim(), marks: [...c.querySelectorAll('mark.lsn-text-hl')].map(m => m.textContent), surfaces: c.querySelectorAll('.at-surface').length, ctx: !!x, exp: x?.dataset.expanded ?? null,
    text: x?.textContent ?? '', msg: c.querySelector('.cs-sn-msg')?.textContent ?? null, more: more?.textContent.trim() ?? null, open: open?.textContent.trim() ?? null, openIcon: !!open?.querySelector('svg'),
    moreH: mb ? Math.round(mb.height) : 0, openH: ob ? Math.round(ob.height) : 0, openW: ob ? Math.round(ob.width) : 0, sameRow: !!(mb && ob && Math.abs((mb.top + mb.bottom) / 2 - (ob.top + ob.bottom) / 2) < 3),
    sep: mb && ob ? Math.round(Math.abs(mb.top - ob.top) < 3 ? ob.left - mb.right : ob.top - mb.bottom) : null, overlap: !!(mb && ob && mb.left < ob.right && mb.right > ob.left && mb.top < ob.bottom && mb.bottom > ob.top),
    inside: !!(ob && ob.right <= cb.right + 0.5 && ob.left >= cb.left - 0.5 && (!mb || (mb.right <= cb.right + 0.5 && mb.left >= cb.left - 0.5))), cut: [lab, ml].some(e => e && e.scrollWidth > e.clientWidth + 1), sw: document.documentElement.scrollWidth <= innerWidth + 1 }
}, q)
const live = (page, q) => page.waitForFunction(q => { const c = [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)); return c && (c.querySelector('[data-testid="context-section"]') || c.querySelector('.cs-sn-msg')) }, q, { timeout: 40000 })
const toCard = (page, q) => page.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q))?.scrollIntoView({ block: 'center' }), q)
const clickIn = (page, q, tid) => page.evaluate(([q, tid]) => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)).querySelector(`[data-testid="${tid}"]`).click(), [q, tid])
const mark = page => page.evaluate(() => { const m = document.querySelector('mark.lsn-text-hl'); if (!m) return null; const r = m.getBoundingClientRect(); return { text: m.textContent, inView: r.bottom > 0 && r.top < innerHeight } })

try {
  const A = await open('a@test.local', IPHONE)
  await A.goto(SESSION, { waitUntil: 'networkidle' }); await A.waitForSelector('.lsn-study .lsn-leaf', { timeout: 30000 })
  const tp = await A.evaluate(() => [...document.querySelectorAll('.lsn-leaf')].find(l => l.textContent.includes('Vội nhịp ở ô thứ ba')).dataset.tp)
  const P1 = await A.evaluate(() => [...document.querySelectorAll('.lsn-leaf')].find(l => l.textContent.startsWith('Giữ nhịp thật đều')).dataset.tp)
  const item = await A.evaluate(() => [...document.querySelectorAll('.lsn-leaf')].find(l => l.textContent.startsWith('Khởi động')).dataset.tp)
  await selectIn(A, tp, SEL); await A.waitForSelector('[data-testid="text-share-bar"]', { timeout: 5000 })
  let b = await bar(A); assert.ok(b.state === 'ok' && b.quote === SEL && b.ask && b.askH >= 44 && b.inView, JSON.stringify(b))
  await selectIn(A, P1, 'Hãy nghe', item, 'Khởi động'); await A.waitForTimeout(300)
  b = await bar(A); assert.ok(b.state === 'multi' && !b.ask && /nhiều đoạn/.test(b.hint), JSON.stringify(b))
  assert.equal(calls(A, 'share_text_create').length, 0)
  await A.screenshot({ path: `${SHOTS}/v2-wk-a-canh-bao-390.png` })
  ok('iPhone 390: chọn hợp lệ → thanh đáy (trích, nút ≥44px, trong màn hình); chọn nhiều đoạn → cảnh báo, khoá nút, 0 RPC tạo')

  await selectIn(A, tp, SEL); await A.waitForTimeout(300)
  await A.click('[data-testid="text-share-ask"]'); await A.waitForSelector('[role=dialog][aria-label="Hỏi về đoạn văn bản"]')
  assert.equal(await A.textContent('[data-testid="composer-quote"]'), SEL)
  await A.fill('#share-note-text', NOTE)
  await A.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Đăng lên Feed')).click())
  await A.waitForFunction(() => document.querySelector('[role=dialog] [role=status]')?.textContent === 'Đã đăng lên Feed', null, { timeout: 20000 })
  const cr = calls(A, 'share_text_create')[0]
  assert.equal(Object.keys(cr.body).sort().join(','), 'p_client_key,p_from,p_note,p_path,p_section,p_session,p_to'); assert.ok(!cr.raw.includes(SEL))
  assert.equal(calls(A, 'social_share_share_text').length >= 1, true)
  ok('iPhone 390: Hỏi / Chia sẻ → Composer có trích → Đăng Feed; request chỉ có toạ độ + lời nhắn (không nội dung, không băm)')

  for (const [name, vp, w] of [['iPhone 390', IPHONE, 390], ['iPhone 320', { viewport: { width: 320, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 320], ['desktop 1280', { viewport: { width: 1280, height: 900 } }, 1280]]) {
    const B = await open('b@test.local', vp)
    await B.goto(ME, { waitUntil: 'networkidle' }); await live(B, NOTE); await toCard(B, NOTE); await B.waitForTimeout(500)
    const c0 = await card(B, NOTE)
    assert.equal(c0.kind, 'Giáo trình · Buổi 1'); assert.deepEqual(c0.marks, [SEL]); assert.equal(c0.surfaces, 0); assert.ok(c0.sw)
    assert.ok(c0.text.includes('Vội nhịp ở ô thứ ba, nên hãy nghe kỹ giai điệu trước khi đàn nhé.'), 'lá chứa vùng chọn in nguyên văn')
    assert.equal(c0.open, 'Mở trong giáo trình'); assert.ok(c0.openIcon)
    const dsk = w >= 640
    assert.ok(!c0.overlap && c0.openH >= 44 && c0.sep >= 8 && c0.inside && !c0.cut && c0.openW >= 190, `${name} cụm nút: ` + JSON.stringify(c0))
    if (dsk) assert.ok(c0.sameRow, 'desktop: nút phụ + nút chính CÙNG một hàng')
    if (c0.more) {
      assert.ok(c0.moreH >= 44, JSON.stringify(c0))
      await clickIn(B, NOTE, 'share-note-more'); await B.waitForTimeout(400)
      const cx = await card(B, NOTE)
      assert.ok(cx.more === 'Thu gọn' && cx.exp === '1' && cx.h > c0.h && cx.marks[0] === SEL && !cx.overlap && cx.sep >= 8 && cx.inside && !cx.cut, `${name} mở rộng: ` + JSON.stringify(cx))
      await B.screenshot({ path: `${SHOTS}/v2-wk-${name.replace(' ', '-')}-mo-rong.png` })
      await clickIn(B, NOTE, 'share-note-more'); await B.waitForTimeout(300)
      const cc = await card(B, NOTE); assert.ok(cc.more === 'Xem đầy đủ' && Math.abs(cc.h - c0.h) < 2)
    }
    await B.screenshot({ path: `${SHOTS}/v2-wk-${name.replace(' ', '-')}-gon.png` })
    if (name === 'iPhone 390') {
      await clickIn(B, NOTE, 'share-note-open')
      await B.waitForSelector('mark.lsn-text-hl', { timeout: 30000 }); await B.waitForTimeout(1200)
      const mk = await mark(B); assert.ok(mk.text === SEL && mk.inView, JSON.stringify(mk))
      assert.match(await B.textContent('.cs-share-note-panel'), /tô màu cam/i)
      await B.screenshot({ path: `${SHOTS}/v2-wk-mo-dung-doan-390.png` })
    }
    ok(`${name}: thẻ Feed khung gốc + <mark>, không alphaTab; cụm nút ${dsk ? 'cùng một hàng' : 'không chồng lấn'} (cách ${c0.sep}px, ≥44px, nút chính ${c0.openW}px, chữ không cắt), gọn ${c0.h}px ↔ mở rộng; không tràn ngang${name === 'iPhone 390' ? '; Mở trong giáo trình → <mark> trong màn hình' : ''}`)
    await B.context().close()
  }

  const C = await open('c@test.local', IPHONE)
  await C.goto(ME, { waitUntil: 'networkidle' }); await live(C, NOTE)
  const cc = await card(C, NOTE)
  assert.ok(!cc.ctx && cc.marks.length === 0 && /chưa có quyền xem phần giáo trình/.test(cc.msg))
  assert.ok(!(await C.evaluate(() => document.body.innerHTML.includes('Vội nhịp ở ô thứ ba'))), 'không có chữ giáo trình trong DOM')
  ok('Chi (lớp khác): chỉ thấy câu hỏi + "chưa có quyền xem phần giáo trình", 0 chữ giáo trình trong DOM')

  // nhiễu WebKit đã biết (yêu cầu bị huỷ khi điều hướng/đóng trang) — cùng bộ lọc với các kịch bản V1; lỗi thật vẫn làm hỏng
  const real = errors.filter(m => !/ due to access control checks\.$|Importing a module script failed/.test(m))
  assert.deepEqual(real, [], real.join(' | '))
  console.log(`\nWebKit V2: ${pass} PASS`)
  if (process.env.E2E_HOLD) {
    console.log(`\nSTAGING_READY ${ME}\n  Đăng nhập: b@test.local (Bình — học viên, thấy khung đầy đủ) · c@test.local (Chi — lớp khác, KHÔNG có quyền) · a@test.local (An — người gửi); mật khẩu bất kỳ\n  Thẻ cần xem: "E2E V2 hỏi" (Chrome) và "${NOTE}"`)
    await browser.close().catch(() => {}); setInterval(() => {}, 1 << 30); await new Promise(() => {})
  }
} catch (e) {
  console.log('FAIL: ' + (e.message ?? e)); console.log(String(e.stack ?? '').split('\n').slice(0, 5).join('\n')); process.exitCode = 1
} finally {
  await browser.close().catch(() => {})
}
