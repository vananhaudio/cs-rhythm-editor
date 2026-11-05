// E2E Contextual Share V2 — chia sẻ VÙNG VĂN BẢN giáo trình, Chrome thật (puppeteer). Xem scripts/e2e-share-note.sh (E2E_SHARE_TEXT=1). Chỉ chạy trên DB tạm; KHÔNG production.
// Hành trình: A chọn văn bản (desktop: kéo chuột thật) → thanh đáy → Hỏi/Chia sẻ → Đăng Feed + gửi bạn qua Chat → Bình thấy khung gốc + <mark> cam, Xem đầy đủ/Thu gọn,
// cụm nút (BookOpen), Mở trong giáo trình → cuộn tới đúng chữ · Chi (lớp khác) không thấy giáo trình · buổi khoá · giáo trình bị chèn (moved) / sửa (stale) · chọn vượt phạm vi.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { assertControlsVisible } from './visibility.mjs'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ORIGIN = `http://class.localhost:${V}`, ME = `${ORIGIN}/me`
const EMAIL = { A: 'a@test.local', B: 'b@test.local', C: 'c@test.local' }
const TH01 = 'b1000000-0000-4000-8000-000000000001', S1 = '51000000-0000-4000-8000-000000000001', S3 = '51000000-0000-4000-8000-000000000003'
const USER = { A: 'aaaaaaaa-0000-4000-8000-00000000000a' }
const SESSION = `${ME}/classes/${TH01}/sessions/1`
const SHOTS = process.env.SHOTS; mkdirSync(SHOTS, { recursive: true })
const SEL = 'nghe kỹ nhịp chùm ba'
const P1_PATH = 'blocks.1.text'

const sql = q => execFileSync(`${process.env.E2E_PG_BIN}/psql`, ['-X', '-q', '-tA', '-h', process.env.E2E_PG_SOCK, '-p', process.env.E2E_PG_PORT, '-U', 'postgres', '-d', 'e2e', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim()
const asA = q => sql(`begin; select set_config('request.jwt.claims', json_build_object('sub','${USER.A}','role','authenticated')::text, true); set local role authenticated; ${q}; commit;`).split('\n').filter(l => /^[0-9a-f-]{36}$/.test(l)).at(-1)
const ORIG = { [S1]: sql(`select blocks::text from public.class_lesson_content where session_id = '${S1}'`), [S3]: sql(`select blocks::text from public.class_lesson_content where session_id = '${S3}'`) }
const restore = s => sql(`update public.class_lesson_content set blocks = $q$${ORIG[s]}$q$::jsonb where session_id = '${s}'`)

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--no-default-browser-check'] })
let pass = 0
const ok = msg => { pass++; console.log('PASS: ' + msg) }
const errors = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitFor = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 25000 }, ...args)

async function open(who, width = 390, height = 844) {
  let ctx
  for (let i = 0; ; i++) { try { ctx = await browser.createBrowserContext(); break } catch (e) { if (i > 2) throw e; await sleep(300) } }
  const page = await ctx.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push(`${who} pageerror: ` + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource|googlevideo|youtube|ytimg|WebAssembly|verovio/i.test(m.text())) errors.push(`${who} console: ` + m.text()) })
  page.rpcs = []; page.reads = []
  page.on('request', r => {
    const u = r.url()
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/)
    if (m && r.method() !== 'OPTIONS') { let body = {}; try { body = JSON.parse(r.postData() ?? '{}') } catch { /* GET */ } page.rpcs.push({ fn: m[1], body, raw: r.postData() ?? '' }) }
    if (/\/rest\/v1\/class_lesson_content/.test(u) && r.method() !== 'OPTIONS') page.reads.push(u)
  })
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', EMAIL[who]); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  return page
}
const calls = (page, fn) => page.rpcs.filter(r => r.fn === fn)
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
async function openSession(page, url = SESSION) {
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.lsn-study .lsn-leaf', { timeout: 30000 })
  await sleep(300)
}
/** Chọn chuỗi `text` trong lá `tp` bằng Selection API (người dùng cảm ứng: hệ thống phát selectionchange y như vậy) */
const selectIn = (page, tp, text, endTp = null, endText = null) => page.evaluate((tp, text, endTp, endText) => {
  const find = (tpv, t) => { const el = document.querySelector(`[data-tp="${tpv}"]`); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, off = 0
    while ((n = w.nextNode())) { const i = n.data.indexOf(t); if (i >= 0) return { n, i }; off += n.data.length }
    return null }
  const a = find(tp, text), b = endTp ? find(endTp, endText) : a
  const sel = getSelection(); sel.removeAllRanges()
  sel.setBaseAndExtent(a.n, a.i, b.n, b.i + (endTp ? endText.length : text.length))
}, tp, text, endTp, endText)
/** Toạ độ màn hình đầu / cuối của một chuỗi trong lá — để KÉO CHUỘT THẬT trên desktop */
const textRect = (page, tp, text) => page.evaluate((tp, text) => {
  const el = document.querySelector(`[data-tp="${tp}"]`); el.scrollIntoView({ block: 'center' })
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n
  while ((n = w.nextNode())) { const i = n.data.indexOf(text); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i); const s = r.getBoundingClientRect(); r.setStart(n, i + text.length); r.setEnd(n, i + text.length); const e = r.getBoundingClientRect(); return { x0: s.left, x1: e.left, y: (s.top + s.bottom) / 2 } } }
  return null
}, tp, text)
const bar = page => page.evaluate(() => { const b = document.querySelector('[data-testid="text-share-bar"]'); if (!b) return null
  const r = b.getBoundingClientRect(); return { state: b.dataset.state, quote: b.querySelector('[data-testid="text-share-quote"]')?.textContent ?? null, hint: b.querySelector('[data-testid="text-share-hint"]')?.textContent ?? null,
    ask: !!b.querySelector('[data-testid="text-share-ask"]'), askH: Math.round(b.querySelector('[data-testid="text-share-ask"]')?.getBoundingClientRect().height ?? 0), bottom: Math.round(innerHeight - r.bottom), inView: r.top >= 0 && r.bottom <= innerHeight + 1, sw: r.right <= innerWidth + 1 } })
const clickText = async (page, label, scope = 'button') => {
  const h = await page.waitForFunction((l, s) => [...document.querySelectorAll(s)].find(b => b.textContent.trim() === l && !b.disabled && b.offsetParent !== null), { timeout: 15000 }, label, scope)
  await h.evaluate(el => el.scrollIntoView({ block: 'center' })); await sleep(120); await h.asElement().click()
}
async function pickAndSend(page, name) {
  await waitFor(page, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  await page.evaluate(n => [...document.querySelectorAll('[role=dialog] [role=radio]')].find(e => e.querySelector('span:last-child').textContent.trim() === n).click(), name)
  await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho')).click())
  await waitFor(page, n => document.querySelector('[role=dialog] [role=status]')?.textContent === `Đã gửi cho ${n}`, name)
}
const cardOf = (page, q) => page.evaluate(q => { const c = [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)); return !!c }, q)
const feedCard = (page, q) => page.evaluate(q => {
  const c = [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)); if (!c) return null
  const more = c.querySelector('[data-testid="share-note-more"]'), open = c.querySelector('[data-testid="share-note-open"]'), x = c.querySelector('[data-testid="context-section"]')
  const mb = more?.getBoundingClientRect(), ob = open?.getBoundingClientRect(), cb = c.getBoundingClientRect()
  const lab = open?.querySelector('span'), mlab = more?.querySelector('span')
  return { h: Math.round(cb.height), kind: c.querySelector('.cs-tool-share-kind')?.textContent.trim(), detail: c.querySelector('.cs-tool-share-detail')?.textContent.trim(),
    marks: [...c.querySelectorAll('mark.lsn-text-hl')].map(m => m.textContent), surfaces: c.querySelectorAll('.at-surface').length, ctx: !!x, expanded: x?.dataset.expanded ?? null,
    text: x?.textContent ?? '', gap: c.querySelectorAll('.lsn-ctx-gap').length, msg: c.querySelector('.cs-sn-msg')?.textContent ?? null,
    more: more?.textContent.trim() ?? null, exp: more?.getAttribute('aria-expanded') ?? null, open: open?.textContent.trim() ?? null, openIcon: !!open?.querySelector('svg'), moreIcon: !!more?.querySelector('svg'),
    moreH: mb ? Math.round(mb.height) : 0, moreW: mb ? Math.round(mb.width) : 0, openH: ob ? Math.round(ob.height) : 0, sameRow: !!(mb && ob && Math.abs((mb.top + mb.bottom) / 2 - (ob.top + ob.bottom) / 2) < 3), openW: ob ? Math.round(ob.width) : 0,
    gapPx: mb && ob ? Math.round(Math.abs(mb.top - ob.top) < 3 ? ob.left - mb.right : ob.top - mb.bottom) : null, overlap: !!(mb && ob && mb.left < ob.right && mb.right > ob.left && mb.top < ob.bottom && mb.bottom > ob.top), inside: !!(ob && ob.right <= cb.right + 0.5 && ob.left >= cb.left - 0.5 && (!mb || (mb.right <= cb.right + 0.5 && mb.left >= cb.left - 0.5))),
    openLabelCut: lab ? lab.scrollWidth > lab.clientWidth + 1 : null, moreLabelCut: mlab ? mlab.scrollWidth > mlab.clientWidth + 1 : null, links: [...c.querySelectorAll('a')].map(a => a.className), sw: document.documentElement.scrollWidth <= innerWidth + 1,
    openBg: open ? getComputedStyle(open).backgroundColor : null, moreBg: more ? getComputedStyle(more).backgroundColor : null, moreBorder: more ? getComputedStyle(more).borderTopWidth : null }
}, q)
const waitCardLive = (page, q) => page.waitForFunction(q => { const c = [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)); if (!c) return false; c.scrollIntoView({ block: 'center' })   // thẻ nạp LƯỜI theo khung nhìn ⇒ phải cuộn tới thẻ
  return !!(c.querySelector('[data-testid="context-section"]') || c.querySelector('.cs-sn-msg')) }, { timeout: 40000, polling: 300 }, q)
const scrollToCard = (page, q) => page.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q))?.scrollIntoView({ block: 'center' }), q)
const panel = page => page.$eval('.cs-share-note-panel', e => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => null)
const markInfo = page => page.evaluate(() => { const m = document.querySelector('mark.lsn-text-hl'); if (!m) return null; const r = m.getBoundingClientRect()
  return { text: m.textContent, inView: r.bottom > 0 && r.top < innerHeight, mid: Math.round((r.top + r.bottom) / 2), vh: innerHeight, n: document.querySelectorAll('mark.lsn-text-hl').length } })

// E2E_HOLD_ON_FAIL=1: giữ stack khi lỗi để gỡ (E2E_HOLD=1 do run-share-text-webkit.mjs xử lý ở cuối): STAGING cục bộ cho Owner / gỡ lỗi — DB tạm (dữ liệu giả, KHÔNG production), giữ stack chạy; kill để dọn.
const hold = async why => {
  console.log(`\nSTAGING_READY ${ME}  (${why})\n  Đăng nhập: b@test.local (Bình — học viên, thấy khung đầy đủ) · c@test.local (Chi — lớp khác, KHÔNG có quyền) · a@test.local (An — người gửi); mật khẩu bất kỳ\n  Thẻ cần xem: "${HOLD_Q}"`)
  await browser.close().catch(() => {}); setInterval(() => {}, 1 << 30); await new Promise(() => {})
}
let HOLD_Q = 'E2E V2 hỏi'
let A, A1280, B, B320, C
try {
  A = await open('A', 390); A1280 = await open('A', 1280, 900); B = await open('B', 390); B320 = await open('B', 320, 740); C = await open('C', 390)

  // 1. Trang Buổi: giáo trình có lá chọn được; chữ y nguyên; không tràn ngang; chưa có thanh khi chưa chọn
  await openSession(A)
  const leafInfo = await A.evaluate(() => { const ls = [...document.querySelectorAll('.lsn-leaf')]; return { n: ls.length, study: document.querySelectorAll('.lsn-study .lsn-leaf').length, tp: ls.map(l => l.dataset.tp).filter(t => t.endsWith(':blocks.1.text')), noBar: !document.querySelector('[data-testid="text-share-bar"]') } })
  assert.ok(leafInfo.n >= 20 && leafInfo.study >= 10 && leafInfo.noBar, JSON.stringify(leafInfo))
  const SI = leafInfo.tp[0].split(':')[0]; const TP = `${SI}:${P1_PATH}`
  assert.ok(await noHScroll(A))
  ok(`1 trang Buổi: ${leafInfo.n} lá văn bản chọn được (data-tp), chưa chọn thì chưa có thanh; không tràn ngang`)

  // 2. Phân loại vùng chọn (iPhone 390): hợp lệ → thanh đáy có trích + nút; vượt phạm vi → CẢNH BÁO, KHOÁ nút, GIỮ NGUYÊN vùng chọn, KHÔNG gọi RPC tạo
  await selectIn(A, TP, SEL); await sleep(250)
  let b = await bar(A)
  assert.ok(b && b.state === 'ok' && b.quote === SEL && b.ask && b.askH >= 44 && b.inView && b.sw && b.bottom >= 0, JSON.stringify(b))
  await A.screenshot({ path: `${SHOTS}/v2-a-thanh-390.png` })
  await assertControlsVisible(A, 'thanh hành động chọn văn bản')
  await selectIn(A, TP, 'Hãy nghe', `${SI}:blocks.2.items.0`, 'Khởi động'); await sleep(250)
  b = await bar(A); const keep = await A.evaluate(() => getSelection().toString())
  assert.ok(b && b.state === 'multi' && !b.ask && /nhiều đoạn/.test(b.hint) && keep.includes('Hãy nghe') && keep.includes('Khởi động'), JSON.stringify({ b, keep: keep.slice(0, 60) }))
  await selectIn(A, TP, 'Giữ'); await sleep(250); b = await bar(A)
  assert.ok(b.state === 'short' && !b.ask && /quá ngắn/.test(b.hint), JSON.stringify(b))
  await A.evaluate(() => { const h = document.querySelector('.lsn-study .lsn-block-h h2'); getSelection().setBaseAndExtent(h.firstChild, 0, h.firstChild, 6) }); await sleep(250); b = await bar(A)
  assert.ok(b.state === 'outside' && !b.ask && /chưa chia sẻ được/.test(b.hint), JSON.stringify(b))
  const longTp = await A.evaluate(() => [...document.querySelectorAll('.lsn-leaf')].find(l => l.textContent.length > 520)?.dataset.tp)
  assert.ok(longTp, 'có lá dài > 520 ký tự trong fixture')
  await A.evaluate(tp => { const el = document.querySelector(`[data-tp="${tp}"]`); const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r) }, longTp); await sleep(250); b = await bar(A)
  assert.ok(b.state === 'long' && !b.ask && /500/.test(b.hint), JSON.stringify(b))
  assert.equal(calls(A, 'share_text_create').length, 0, 'chọn vượt phạm vi KHÔNG tạo ghi chú nào')
  ok('2 vùng chọn: hợp lệ → thanh đáy (trích, nút ≥44px); nhiều đoạn / quá ngắn / ngoài lá / > 500 → cảnh báo rõ, nút bị khoá, vùng chọn giữ nguyên, 0 lần gọi share_text_create')

  // 3. "Cả đoạn" + Bỏ chọn
  await selectIn(A, TP, 'Hãy nghe kỹ'); await sleep(250)
  await clickText(A, 'Cả đoạn'); await sleep(300)
  b = await bar(A); const whole = await A.evaluate(tp => getSelection().toString() === document.querySelector(`[data-tp="${tp}"]`).textContent, TP)
  assert.ok(b.state === 'ok' && whole, JSON.stringify({ b, whole }))
  await A.click('[aria-label="Bỏ chọn"]'); await sleep(250)
  assert.equal(await bar(A), null); assert.equal(await A.evaluate(() => getSelection().toString()), '')
  ok('3 "Cả đoạn" chọn nguyên lá; "Bỏ chọn" xoá vùng chọn và thanh')

  // 4. Desktop 1280: KÉO CHUỘT THẬT → thanh → Hỏi/Chia sẻ → Composer có trích → Đăng Feed (client chỉ gửi toạ độ, KHÔNG gửi nội dung / băm)
  await openSession(A1280)
  const rc = await textRect(A1280, TP, SEL); assert.ok(rc)
  await A1280.mouse.move(rc.x0 + 0.5, rc.y); await A1280.mouse.down(); await A1280.mouse.move((rc.x0 + rc.x1) / 2, rc.y, { steps: 6 }); await A1280.mouse.move(rc.x1 - 0.5, rc.y, { steps: 6 }); await A1280.mouse.up(); await sleep(350)
  b = await bar(A1280)
  assert.ok(b && b.state === 'ok' && b.quote.trim().length >= 12 && SEL.includes(b.quote.trim().slice(0, 8)), JSON.stringify(b))
  await selectIn(A1280, TP, SEL); await sleep(250)   // đoạn chính xác cho phần còn lại (kéo chuột có thể lệch nửa ký tự)
  await clickText(A1280, 'Hỏi / Chia sẻ')
  await A1280.waitForSelector('[role=dialog][aria-label="Hỏi về đoạn văn bản"]')
  assert.equal(await A1280.$eval('[data-testid="composer-quote"]', e => e.textContent), SEL)
  const NOTE1 = 'E2E V2 hỏi: em chưa hiểu chỗ nghe nhịp chùm ba'
  await A1280.type('#share-note-text', NOTE1)
  await A1280.screenshot({ path: `${SHOTS}/v2-a-composer-1280.png` })
  await A1280.evaluate(() => { const bt = [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Đăng lên Feed')); bt.click(); bt.click() })
  await waitFor(A1280, () => document.querySelector('[role=dialog] [role=status]')?.textContent === 'Đã đăng lên Feed')
  const cr = calls(A1280, 'share_text_create'), pub = calls(A1280, 'social_share_share_text')
  assert.equal(new Set(cr.map(c => c.body.p_client_key)).size, 1, 'bấm đúp dùng CÙNG một khoá chống trùng')
  assert.equal(Object.keys(cr[0].body).sort().join(','), 'p_client_key,p_from,p_note,p_path,p_section,p_session,p_to', 'client chỉ gửi toạ độ + lời nhắn')
  assert.ok(!cr[0].raw.includes(SEL) && !/[0-9a-f]{64}/.test(cr[0].raw), 'request KHÔNG chứa nội dung đoạn chọn và KHÔNG chứa băm')
  assert.deepEqual(cr[0].body.p_path, ['blocks', '1', 'text']); assert.equal(cr[0].body.p_session, S1)
  assert.equal(pub.length >= 1, true)
  const NOTE_ID = pub[0].body.p_note
  const dbRow = sql(`select anchor_kind || '|' || char_from || '|' || char_to || '|' || (text_sha = encode(sha256(convert_to($q$${SEL}$q$, 'UTF8')), 'hex')) from public.share_notes where id = '${NOTE_ID}'`)
  const exp = (await A1280.evaluate((tp, s) => { const t = document.querySelector(`[data-tp="${tp}"]`).textContent; const i = t.indexOf(s); return [Array.from(t.slice(0, i)).length, Array.from(t.slice(0, i)).length + Array.from(s).length] }, TP, SEL))
  assert.equal(dbRow, `text|${exp[0]}|${exp[1]}|true`, 'server lưu toạ độ điểm mã + băm đúng')
  ok(`4 desktop: kéo chuột thật → thanh → Composer có trích → Đăng Feed; request chỉ có toạ độ (không nội dung/băm); DB: ${dbRow}`)

  // 5. Bình (390) trên Feed: khung gốc + <mark>; không alphaTab; cụm nút; Xem đầy đủ/Thu gọn không nhảy cuộn
  await B.goto(ME, { waitUntil: 'networkidle0' }); await waitCardLive(B, NOTE1); await scrollToCard(B, NOTE1); await sleep(500)
  let f = await feedCard(B, NOTE1)
  assert.equal(f.kind, 'Giáo trình · Buổi 1'); assert.equal(f.detail, 'Đoạn văn bản')
  assert.deepEqual(f.marks, [SEL]); assert.equal(f.surfaces, 0, 'khung văn bản KHÔNG dùng alphaTab')
  assert.ok(f.text.includes('Hãy nghe kỹ nhịp chùm ba ở ô 2'), 'lá chứa vùng chọn in NGUYÊN VĂN, không cắt')
  assert.ok(/Ngày 1/.test(f.text) && /Khởi động/.test(f.text), 'gọn: tiêu đề + lá + khối phụ thuộc'); assert.doesNotMatch(f.text, /LỖI DỄ MẮC/, 'gọn: chưa có callout phía sau')
  assert.equal(f.expanded, '0'); assert.ok(f.gap >= 1); assert.ok(f.sw)
  assert.equal(f.more, 'Xem đầy đủ'); assert.equal(f.exp, 'false'); assert.equal(f.open, 'Mở trong giáo trình'); assert.ok(f.openIcon && f.moreIcon)
  assert.ok(!f.overlap && f.moreH >= 44 && f.openH >= 44 && f.moreW >= 44 && f.gapPx >= 8 && f.inside && f.openW >= 190, 'cụm nút 390: ' + JSON.stringify(f))
  assert.ok(f.openLabelCut === false && f.moreLabelCut === false, 'chữ trên nút không bị cắt / ép')
  assert.equal(f.moreBorder, '0px', 'nút phụ nhẹ: không viền'); assert.notEqual(f.openBg, 'rgba(0, 0, 0, 0)'); assert.equal(f.moreBg, 'rgba(0, 0, 0, 0)')
  assert.deepEqual(f.links, ['cs-sn-preview', 'cs-sn-open'], 'chỉ có đường mở nguồn')
  const topBefore = await B.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)).getBoundingClientRect().top, NOTE1)
  await B.screenshot({ path: `${SHOTS}/v2-b-feed-390-gon.png` })
  await B.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)).querySelector('[data-testid="share-note-more"]').click(), NOTE1); await sleep(400)
  const fx = await feedCard(B, NOTE1)
  const topAfter = await B.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)).getBoundingClientRect().top, NOTE1)
  assert.equal(fx.more, 'Thu gọn'); assert.equal(fx.exp, 'true'); assert.equal(fx.expanded, '1'); assert.deepEqual(fx.marks, [SEL])
  assert.match(fx.text, /LỖI DỄ MẮC/); assert.match(fx.text, /Đếm chậm cùng máy nhịp/); assert.ok(fx.h > f.h)
  assert.ok(!fx.overlap && fx.moreH >= 44 && fx.openH >= 44 && fx.gapPx >= 8 && fx.inside && fx.moreLabelCut === false && fx.openLabelCut === false, 'cụm nút đạt cả khi mở rộng: ' + JSON.stringify(fx))
  assert.ok(Math.abs(topAfter - topBefore) < 2, `mở rộng không nhảy cuộn: ${topBefore} → ${topAfter}`)
  await B.screenshot({ path: `${SHOTS}/v2-b-feed-390-mo-rong.png` })
  await B.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)).querySelector('[data-testid="share-note-more"]').click(), NOTE1); await sleep(300)
  const fc = await feedCard(B, NOTE1)
  assert.ok(fc.more === 'Xem đầy đủ' && fc.expanded === '0' && Math.abs(fc.h - f.h) < 2, 'Thu gọn trả về trạng thái gọn')
  ok(`5 Feed 390: "Giáo trình · Buổi 1 · Đoạn văn bản", khung gốc (không alphaTab) + <mark> cam = đúng đoạn; gọn ${f.h}px → mở rộng ${fx.h}px → gọn; cụm nút BookOpen: không chồng lấn, cách nhau ${f.gapPx}px, ≥44px, nút chính rộng ${f.openW}px, chữ không cắt; không nhảy cuộn`)

  // 6. Cụm nút trên iPhone 320 (hẹp nhất) — mặc định + mở rộng
  await B320.goto(ME, { waitUntil: 'networkidle0' }); await waitCardLive(B320, NOTE1); await scrollToCard(B320, NOTE1); await sleep(500)
  const f320 = await feedCard(B320, NOTE1)
  assert.ok(f320.sw && !f320.overlap && f320.moreH >= 44 && f320.openH >= 44 && f320.gapPx >= 8 && f320.inside && f320.openLabelCut === false && f320.moreLabelCut === false && f320.openW >= 190, '320 gọn: ' + JSON.stringify(f320))
  await B320.screenshot({ path: `${SHOTS}/v2-b-feed-320-gon.png` })
  await B320.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)).querySelector('[data-testid="share-note-more"]').click(), NOTE1); await sleep(400)
  const f320x = await feedCard(B320, NOTE1)
  assert.ok(f320x.sw && !f320x.overlap && f320x.moreH >= 44 && f320x.openH >= 44 && f320x.gapPx >= 8 && f320x.inside && f320x.moreLabelCut === false && f320x.openLabelCut === false && f320x.more === 'Thu gọn', '320 mở rộng: ' + JSON.stringify(f320x))
  await B320.screenshot({ path: `${SHOTS}/v2-b-feed-320-mo-rong.png` })
  ok(`6 iPhone 320: không tràn ngang; cụm nút không chồng lấn (cách ${f320.gapPx}px), nút chính ${f320.openW}px, ≥44px, chữ không cắt — cả gọn lẫn mở rộng`)

  // 7. Mở trong giáo trình → trang Buổi: panel + <mark> cam đúng chữ, cuộn tới giữa màn hình
  await B.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)).querySelector('[data-testid="share-note-open"]').click(), NOTE1)
  await B.waitForSelector('.cs-share-note-panel', { timeout: 20000 }); await B.waitForSelector('mark.lsn-text-hl', { timeout: 30000 }); await sleep(900)
  const pB = await panel(B), mk = await markInfo(B)
  assert.ok(pB.includes(NOTE1) && /câu hỏi về đoạn văn bản/i.test(pB) && /tô màu cam/.test(pB), pB)
  assert.ok(mk.text === SEL && mk.n === 1 && mk.inView && Math.abs(mk.mid - mk.vh / 2) < mk.vh * 0.35, JSON.stringify(mk))
  assert.ok(await noHScroll(B)); await assertControlsVisible(B, 'trang Buổi mở từ liên kết văn bản')
  await B.screenshot({ path: `${SHOTS}/v2-b-mo-dung-doan-390.png` })
  assert.equal(calls(B, 'share_note_open_v2').length >= 1, true)
  ok(`7 Mở trong giáo trình: panel "Câu hỏi về đoạn văn bản", <mark> = "${mk.text}" trong màn hình (giữa ${mk.mid}/${mk.vh}px), không tràn ngang`)

  // 8. Chi (lớp khác): thấy câu hỏi, KHÔNG thấy giáo trình; không đọc class_lesson_content
  await C.goto(ME, { waitUntil: 'networkidle0' }); await waitCardLive(C, NOTE1)
  const fC = await feedCard(C, NOTE1)
  assert.equal(fC.ctx, false); assert.equal(fC.marks.length, 0); assert.match(fC.msg, /chưa có quyền xem phần giáo trình/)
  assert.ok(!fC.text.includes('nghe kỹ') && !(await C.evaluate(() => document.body.innerHTML.includes('Hãy nghe kỹ nhịp chùm ba'))), 'giáo trình KHÔNG có trong DOM')
  assert.equal(C.reads.length, 0, `Chi KHÔNG đọc class_lesson_content: ${C.reads.length}`)
  await C.goto(`${SESSION}?note=${NOTE_ID}`, { waitUntil: 'networkidle0' }); await sleep(800)
  assert.match(await panel(C) ?? '', /chưa có quyền/); assert.equal(await markInfo(C), null)
  ok('8 Chi (lớp khác): thấy câu hỏi + "chưa có quyền xem phần giáo trình", 0 chữ giáo trình trong DOM, 0 yêu cầu đọc giáo trình, deep link không tô')

  // 9. Gửi bạn qua Chat (vùng khác: callout) → Bình thấy thẻ tham chiếu → mở → <mark>
  await openSession(A)
  const calloutTp = `${SI}:blocks.4.text`
  await selectIn(A, calloutTp, 'nên hãy nghe kỹ giai điệu'); await sleep(250)
  await clickText(A, 'Hỏi / Chia sẻ'); await A.waitForSelector('[role=dialog][aria-label="Hỏi về đoạn văn bản"]')
  const NOTE2 = 'E2E V2 gửi Chat: callout này nghĩa là gì'
  await A.type('#share-note-text', NOTE2); await assertControlsVisible(A, 'Composer văn bản (390)')
  await A.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho bạn bè')).click())
  await pickAndSend(A, 'Bình')
  const sh = calls(A, 'dm_share').at(-1).body; assert.equal(sh.p_ref_type, 'share_note')
  await B.goto(`${ME}/chat`, { waitUntil: 'networkidle0' }); await B.waitForSelector('[data-testid="inbox-row"]', { timeout: 15000 })
  await B.evaluate(() => [...document.querySelectorAll('[data-testid="inbox-row"]')].find(e => ['An', 'Nguyễn An'].includes(e.querySelector('.cs-inbox-name').textContent.trim())).click())
  await waitFor(B, q => [...document.querySelectorAll('.cs-chat-scroll .cs-share-card:not(.is-loading)')].some(c => c.textContent.includes(q)), NOTE2)
  const card = await B.evaluate(q => { const c = [...document.querySelectorAll('.cs-chat-scroll .cs-share-card')].find(e => e.textContent.includes(q)); return { t: c.textContent.replace(/\s+/g, ' '), href: c.getAttribute('href') } }, NOTE2)
  assert.match(card.t, /Giáo trình · Buổi 1/); assert.match(card.t, /Đoạn văn bản/); assert.match(card.t, /Mở trong giáo trình/)
  assert.equal(card.href, `/me/classes/${TH01}/sessions/1?note=${sh.p_ref_key}`)
  assert.ok(!/alphatex|share_note|nghe kỹ giai điệu/i.test(card.t), 'thẻ không lộ nội dung giáo trình / từ kỹ thuật')
  await B.evaluate(q => [...document.querySelectorAll('.cs-chat-scroll .cs-share-card')].find(e => e.textContent.includes(q)).click(), NOTE2)
  await B.waitForSelector('mark.lsn-text-hl', { timeout: 30000 }); await sleep(700)
  const mk2 = await markInfo(B); assert.ok(mk2.text === 'nên hãy nghe kỹ giai điệu' && mk2.inView, JSON.stringify(mk2))
  await B.screenshot({ path: `${SHOTS}/v2-b-chat-mo-dung-doan.png` })
  ok('9 Chat: thẻ tham chiếu "Giáo trình · Buổi 1 · Đoạn văn bản" (không lộ nội dung) → mở đúng trang Buổi, <mark> = đúng chữ trong callout')

  // 9b. Tiếng Việt tổ hợp (NFD) và emoji đi TRỌN vòng JS → PostgreSQL → Feed: toạ độ theo điểm mã, <mark> đúng chữ, không tách dấu tổ hợp
  await openSession(A1280)
  const uni = await A1280.evaluate(() => { const ls = [...document.querySelectorAll('.lsn-leaf')]
    const e = ls.find(l => l.textContent.startsWith('Đàn 🎸 hay lắm')), n = ls.find(l => /Tiếng Việt tổ hợp/.test(l.textContent.normalize('NFC')) && l.textContent !== l.textContent.normalize('NFC'))
    return { e: e?.dataset.tp, n: n?.dataset.tp, nText: n?.textContent } })
  assert.ok(uni.e && uni.n, JSON.stringify(uni))
  const cases = [
    { tp: uni.e, sel: 'Đàn 🎸 hay lắm', note: 'E2E V2 emoji: chữ có biểu tượng' },
    { tp: uni.n, sel: 'giữ đều tay'.normalize('NFD'), note: 'E2E V2 NFD: chữ tổ hợp' },
  ]
  for (const c of cases) {
    await selectIn(A1280, c.tp, c.sel); await sleep(300)
    const bb = await bar(A1280); assert.ok(bb && bb.state === 'ok' && bb.quote === c.sel, JSON.stringify({ c: c.note, bb }))
    await clickText(A1280, 'Hỏi / Chia sẻ'); await A1280.waitForSelector('[role=dialog][aria-label="Hỏi về đoạn văn bản"]')
    await A1280.type('#share-note-text', c.note)
    await A1280.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Đăng lên Feed')).click())
    await waitFor(A1280, () => document.querySelector('[role=dialog] [role=status]')?.textContent === 'Đã đăng lên Feed')
    await A1280.evaluate(() => document.querySelector('[role=dialog] button')?.click()); await sleep(300)
    const nid = calls(A1280, 'social_share_share_text').at(-1).body.p_note
    const row = sql(`select char_from || '|' || char_to || '|' || (text_sha = encode(sha256(convert_to($q$${c.sel}$q$, 'UTF8')), 'hex')) from public.share_notes where id = '${nid}'`)
    const leaf = await A1280.evaluate(tp => document.querySelector(`[data-tp="${tp}"]`).textContent, c.tp)
    const cps = Array.from(leaf), selCps = Array.from(c.sel)
    const at = cps.findIndex((_, i) => cps.slice(i, i + selCps.length).join('') === c.sel)
    assert.equal(row, `${at}|${at + selCps.length}|true`, `${c.note}: toạ độ ĐIỂM MÃ (JS) = PostgreSQL`)
    await B.goto(ME, { waitUntil: 'networkidle0' }); await waitCardLive(B, c.note); await scrollToCard(B, c.note); await sleep(300)
    const fu = await feedCard(B, c.note); assert.deepEqual(fu.marks, [c.sel], `${c.note}: <mark> = đúng chữ`)
    assert.ok(fu.text.includes(leaf), `${c.note}: lá in nguyên văn`)
  }
  ok('9b chữ có emoji (🎸 ngoài BMP) và tiếng Việt tổ hợp NFD: toạ độ điểm mã từ JS = PostgreSQL (kèm băm), Feed tô ĐÚNG chữ, không tách dấu tổ hợp')

  // 10. Giáo trình đổi: CHÈN khối đầu buổi → moved (Feed + liên kết vẫn tô đúng chữ, báo "sắp xếp lại"); SỬA chính đoạn → stale (không tô, không hiện khung)
  sql(`update public.class_lesson_content set blocks = jsonb_build_array(jsonb_build_object('kind','note','text','Khối mới chèn đầu buổi')) || blocks where session_id = '${S1}'`)
  const B2 = await open('B', 390)
  await B2.goto(ME, { waitUntil: 'networkidle0' }); await waitCardLive(B2, NOTE1); await scrollToCard(B2, NOTE1); await sleep(400)
  const fm = await feedCard(B2, NOTE1); assert.deepEqual(fm.marks, [SEL], 'chèn khối phía trước: Feed vẫn tô đúng chữ (moved)')
  await B2.goto(`${SESSION}?note=${NOTE_ID}`, { waitUntil: 'networkidle0' }); await B2.waitForSelector('mark.lsn-text-hl', { timeout: 30000 }); await sleep(500)
  assert.match(await panel(B2) ?? '', /sắp xếp lại/); assert.equal((await markInfo(B2)).text, SEL)
  assert.equal(calls(B2, 'share_note_open_v2').at(-1) !== undefined, true)
  ok('10a chèn khối phía trước (chỉ số khối dịch): Feed + liên kết vẫn tìm lại và tô ĐÚNG chữ; panel báo "đã được sắp xếp lại"')
  restore(S1)
  sql(`update public.class_lesson_content set blocks = replace(blocks::text, 'nghe kỹ nhịp chùm ba ở ô 2', 'lắng nghe nhịp chùm ba ở ô 2')::jsonb where session_id = '${S1}'`)
  const B3 = await open('B', 390)
  await B3.goto(ME, { waitUntil: 'networkidle0' }); await waitCardLive(B3, NOTE1); await scrollToCard(B3, NOTE1); await sleep(400)
  const fs = await feedCard(B3, NOTE1)
  assert.equal(fs.ctx, false); assert.equal(fs.marks.length, 0); assert.match(fs.msg, /Giáo trình đã được cập nhật/)
  assert.ok(!(await B3.evaluate(() => document.body.innerHTML.includes('lắng nghe nhịp chùm ba'))), 'stale: KHÔNG hiện chữ giáo trình')
  console.log('   (debug) bài Feed share_note: ' + sql("select string_agg(tool_share ->> 'note_id' || ':' || coalesce(tool_share ->> 'anchor', 'bars') || ':' || (tool_share ->> 'note'), ' | ') from public.class_posts where tool_share ->> 'tool' = 'share_note'") + ' ; NOTE_ID=' + NOTE_ID)
  assert.equal(calls(B3, 'share_note_session_open').filter(c => c.body.p_note === NOTE_ID).length, 0, 'stale: store dừng ngay sau open_v2 — KHÔNG gọi session_open: ' + JSON.stringify(B3.rpcs.filter(r => /share_note/.test(r.fn)).map(r => r.fn + ':' + JSON.stringify(r.body))))
  await B3.goto(`${SESSION}?note=${NOTE_ID}`, { waitUntil: 'networkidle0' }); await sleep(900)
  assert.match(await panel(B3) ?? '', /không xác định chắc chắn đoạn cũ và không tô/); assert.equal(await markInfo(B3), null)
  await B3.screenshot({ path: `${SHOTS}/v2-b-stale-390.png` })
  restore(S1)
  ok('10b sửa chính đoạn được chọn: Feed báo "Giáo trình đã được cập nhật", KHÔNG khung / KHÔNG <mark> / không gọi session_open; liên kết không tô (fail-closed)')

  // 10c. DI CHUYỂN khối: chuyển khối study xuống cuối buổi (chỉ số dịch xa) → vẫn tìm lại và tô đúng chữ; 10d. XOÁ khối → stale
  sql(`update public.class_lesson_content set blocks = (select jsonb_agg(e order by (e ->> 'title' = 'Ôn tập 7 ngày'), i) from jsonb_array_elements(blocks) with ordinality t(e, i)) where session_id = '${S1}'`)
  const B5 = await open('B', 390)
  await B5.goto(`${SESSION}?note=${NOTE_ID}`, { waitUntil: 'networkidle0' }); await B5.waitForSelector('mark.lsn-text-hl', { timeout: 30000 }); await sleep(500)
  assert.match(await panel(B5) ?? '', /sắp xếp lại/); assert.equal((await markInfo(B5)).text, SEL)
  ok('10c di chuyển khối study xuống cuối buổi: liên kết vẫn tìm lại và tô ĐÚNG chữ (moved)')
  restore(S1)
  sql(`update public.class_lesson_content set blocks = (select jsonb_agg(e order by i) from jsonb_array_elements(blocks) with ordinality t(e, i) where e ->> 'title' is distinct from 'Ôn tập 7 ngày') where session_id = '${S1}'`)
  const B6 = await open('B', 390)
  await B6.goto(`${SESSION}?note=${NOTE_ID}`, { waitUntil: 'networkidle0' }); await B6.waitForSelector('.cs-share-note-panel', { timeout: 20000 })
  await waitFor(B6, () => /không xác định chắc chắn/.test(document.querySelector('.cs-share-note-panel')?.textContent ?? '')); await sleep(400)
  assert.match(await panel(B6) ?? '', /không xác định chắc chắn đoạn cũ và không tô/); assert.equal(await markInfo(B6), null)
  restore(S1)
  ok('10d xoá cả khối chứa đoạn: stale — không tô, không đoán')

  // 11. Buổi CHƯA MỞ KHOÁ (Buổi 3 với Bình): thẻ chỉ có câu hỏi, 0 yêu cầu đọc giáo trình
  sql(`update public.class_lesson_content set blocks = blocks || jsonb_build_array(jsonb_build_object('kind','note','text','Đoạn văn bản thuộc buổi chưa mở khoá cho học viên.')) where session_id = '${S3}'`)
  const idx3 = Number(sql(`select jsonb_array_length(blocks) - 1 from public.class_lesson_content where session_id = '${S3}'`))
  const lockId = asA(`select public.share_text_create('${S3}', ${idx3}, array['text'], 0, 30, 'E2E V2 khoá: hỏi buổi chưa mở', 'ck-e2e-lock-v2-01')`)
  asA(`select public.social_share_share_text('${lockId}')`)
  const B4 = await open('B', 390)
  await B4.goto(ME, { waitUntil: 'networkidle0' }); await waitCardLive(B4, 'E2E V2 khoá'); await scrollToCard(B4, 'E2E V2 khoá'); await sleep(400)
  const fl = await feedCard(B4, 'E2E V2 khoá')
  assert.equal(fl.ctx, false); assert.match(fl.msg, /chưa mở cho bạn/)
  assert.ok(!(await B4.evaluate(() => document.body.innerHTML.includes('chưa mở khoá cho học viên'))))
  assert.ok(calls(B4, 'share_note_session_open').length >= 1)
  restore(S3)
  ok('11 buổi chưa mở khoá: thẻ chỉ có câu hỏi + "Buổi này chưa mở cho bạn", 0 chữ giáo trình trong DOM (session_open = false nên thẻ không tải giáo trình)')

  // 12. Hồi quy trang Buổi: khi KHÔNG chọn gì, nội dung giáo trình y như cũ (chữ không đổi) và không có thanh
  await openSession(A)
  const same = await A.evaluate(() => ({ bar: !!document.querySelector('[data-testid="text-share-bar"]'), marks: document.querySelectorAll('mark').length }))
  assert.deepEqual(same, { bar: false, marks: 0 })
  assert.deepEqual(errors, [], 'không lỗi JS / console: ' + errors.join(' | '))
  ok('12 không chọn gì: không thanh, không <mark>; 0 lỗi JavaScript trong cả hành trình')
  console.log(`\nChrome V2: ${pass} PASS`)
} catch (e) {
  console.log('FAIL: ' + (e.message ?? e)); console.log(String(e.stack ?? '').split('\n').slice(0, 6).join('\n'))
  process.exitCode = 1
  if (process.env.E2E_HOLD_ON_FAIL) await hold('lỗi — giữ stack để gỡ')
} finally {
  try { restore(S1); restore(S3) } catch { /* DB tạm */ }
  await browser.close()
}
