// E2E Chat V1a trong Chrome thật — xem scripts/e2e-chat-v1.sh.
// A, B, C = học sinh · T = Thầy. Mỗi người một browser context riêng (đăng nhập thật qua proxy).
// Phủ: danh sách + badge chưa đọc · mở hội thoại toàn màn hình (mobile) · Back · "Nhắn tin" không tạo hội thoại rác ·
// gửi tin đầu tạo hội thoại · hai phía thấy tin (polling chỉ hỏi tin mới) · đã đọc → hết badge · text dài/xuống dòng ·
// người ngoài không đọc được · hết bạn → chỉ đọc · Thầy (nhánh quyền lớp CHƯA mở) · ma trận 320…1440.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ME = `http://class.localhost:${V}/me`
const ID = { A: 'aaaaaaaa-0000-4000-8000-00000000000a', B: 'bbbbbbbb-0000-4000-8000-00000000000b', C: 'cccccccc-0000-4000-8000-00000000000c', T: 'dddddddd-0000-4000-8000-00000000000d' }
const EMAIL = { A: 'a@test.local', B: 'b@test.local', C: 'c@test.local', T: 't@test.local' }
const NAME = { A: 'An', B: 'Bình', C: 'Chi Nguyễn Hoàng Bảo Ngọc Phương Thảo Minh Châu', T: 'Thầy Văn Anh' }
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
})
let pass = 0
const ok = msg => { pass++; console.log('PASS: ' + msg) }
const errors = []
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function open(who, width = 390, height = 844) {
  let ctx
  for (let i = 0; ; i++) { try { ctx = await browser.createBrowserContext(); break } catch (e) { if (i > 2) throw e; await sleep(300) } }
  const page = await ctx.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push(`${who} pageerror: ` + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource/.test(m.text())) errors.push(`${who} console: ` + m.text()) })
  page.rpcs = []   // [{ fn, body }]
  page.on('request', r => {
    const m = r.url().match(/\/rest\/v1\/rpc\/(\w+)/)
    if (m && r.method() !== 'OPTIONS') { let body = {}; try { body = JSON.parse(r.postData() ?? '{}') } catch { /* GET */ } page.rpcs.push({ fn: m[1], body }) }
  })
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', EMAIL[who])
  await page.type('#cs-login-pass', 'e2e')
  await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  page.ctx = ctx
  return page
}
const waitFor = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 12000 }, ...args)
const calls = (page, fn) => page.rpcs.filter(r => r.fn === fn)
async function clickText(page, label, scope = 'button') {
  const h = await page.waitForFunction((l, s) => [...document.querySelectorAll(s)].find(b => b.textContent.trim() === l && !b.disabled && b.offsetParent !== null),
    { timeout: 10000 }, label, scope)
  await h.asElement().click()
}
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }))
const noOverflow = async (page, what) => { const o = await overflow(page); assert.ok(o.sw <= o.iw + 1, `${what}: tràn ngang ${o.sw} > ${o.iw}`) }
const convId = page => (page.url().match(new RegExp(`/me/chat/(${UUID.source})`)) ?? [])[1]
const bubbles = (page, sel = '.cs-msg-bubble') => page.$$eval(sel, es => es.map(e => e.textContent))
async function chat(page) {
  await page.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-chat', { timeout: 15000 })
  await waitFor(page, () => !document.querySelector('.cs-chat-list .cs-skeleton'))
}
async function type(page, text) { await page.click('.cs-chat-input'); await page.type('.cs-chat-input', text) }
const sendBtnDisabled = page => page.$eval('.cs-chat-send', b => b.disabled)

try {
  const A = await open('A'), B = await open('B', 1280, 900), C = await open('C'), T = await open('T', 1280, 900)

  // ── 1. Danh sách (mobile 390): hội thoại sẵn A–C, badge, preview ──
  await chat(A)
  const items = await A.$$eval('.cs-chat-item', es => es.map(e => ({ name: e.querySelector('.cs-chat-item-name').textContent, prev: e.querySelector('.cs-chat-item-preview').textContent, unread: e.classList.contains('is-unread'), badge: e.querySelector('.cs-nav-badge')?.textContent ?? null })))
  assert.equal(items.length, 1)
  assert.deepEqual([items[0].name, items[0].prev.slice(0, 9), items[0].unread, items[0].badge], [NAME.C, 'Tin số 70', true, '3'])
  assert.ok(items[0].prev.length > 40, 'tin cuối dài được cắt một dòng bằng dấu …')
  assert.equal(await A.$eval('.cs-menu-btn .cs-nav-badge', e => e.textContent), '1')
  assert.match(await A.$eval('.cs-menu-btn', e => e.getAttribute('aria-label')), /1 cuộc trò chuyện chưa đọc/)
  await noOverflow(A, 'danh sách 390')
  assert.equal(await A.$eval('.cs-chat-pane', e => getComputedStyle(e).display), 'none', 'mobile: /me/chat chỉ là danh sách')
  await A.screenshot({ path: `${SHOTS}/chat-list-390.png` })
  ok('1 mobile /me/chat: danh sách (avatar/tên dài cắt gọn/preview/badge 3), ☰ báo 1 cuộc chưa đọc, không tràn ngang')

  // ── 2. Mở hội thoại: toàn màn hình, composer cố định đáy, ở cuối, tin dài wrap, đã đọc → hết badge ──
  await A.click('.cs-chat-item')
  await waitFor(A, () => /\/me\/chat\/[0-9a-f-]{36}$/.test(location.pathname) && document.querySelectorAll('.cs-msg-bubble').length >= 30)
  const CONV_AC = convId(A)
  const geo = await A.evaluate(() => {
    const pane = document.querySelector('.cs-chat-pane').getBoundingClientRect(), comp = document.querySelector('.cs-chat-composer').getBoundingClientRect()
    const input = document.querySelector('.cs-chat-input').getBoundingClientRect()
    const mid = document.elementFromPoint(input.left + input.width / 2, input.top + input.height / 2)
    const sc = document.querySelector('.cs-chat-scroll'), last = [...document.querySelectorAll('.cs-msg-bubble')].pop().getBoundingClientRect()
    const wide = Math.max(...[...document.querySelectorAll('.cs-msg-bubble')].map(b => b.getBoundingClientRect().right))
    return { pane: [Math.round(pane.left), Math.round(pane.top), Math.round(pane.width), Math.round(pane.height)], ih: innerHeight, iw: innerWidth, compBottom: Math.round(comp.bottom),
      inputHit: mid?.classList.contains('cs-chat-input'), atBottom: sc.scrollHeight - sc.scrollTop - sc.clientHeight < 4, lastVisible: last.bottom <= sc.getBoundingClientRect().bottom + 1,
      wide: Math.round(wide), scOverflow: sc.scrollWidth > sc.clientWidth + 1, back: !!document.querySelector('.cs-chat-back') && getComputedStyle(document.querySelector('.cs-chat-back')).display !== 'none' }
  })
  assert.deepEqual(geo.pane, [0, 0, geo.iw, geo.ih], 'pane phủ toàn màn hình')
  assert.equal(geo.compBottom, geo.ih, 'composer sát đáy màn hình')
  assert.ok(geo.inputHit, 'ô nhập không bị che')
  assert.ok(geo.atBottom && geo.lastVisible, 'mở ra ở tin mới nhất')
  assert.ok(geo.wide <= geo.iw - 8 && !geo.scOverflow, 'bong bóng không tràn')
  assert.ok(geo.back, 'có nút ← rõ ràng')
  assert.equal(await A.$eval('.cs-chat-peer-name', e => e.textContent.trim()), NAME.C)
  assert.deepEqual((await bubbles(A)).slice(-3).map(t => t.slice(0, 9)), ['Tin số 68', 'Tin số 69', 'Tin số 70'])
  await noOverflow(A, 'hội thoại 390')
  await A.screenshot({ path: `${SHOTS}/chat-conv-390.png` })
  ok('2 mở hội thoại: toàn màn hình, composer sát đáy + không bị che, ở tin cuối, tin dài wrap, nút ←')
  await waitFor(A, () => !document.querySelector('.cs-menu-btn .cs-nav-badge'))
  assert.ok(calls(A, 'dm_mark_read').some(r => r.body.p_seq === 70), 'đánh dấu đã đọc tới tin 70')
  ok('2 đã đọc → badge ☰ biến mất ngay (dm_mark_read p_seq=70)')

  // ── 3. "Xem tin cũ hơn": tải 30 tin trước, GIỮ vị trí đọc; dấu giờ chen khi cách >30 phút ──
  await A.evaluate(() => { document.querySelector('.cs-chat-scroll').scrollTop = 0 })
  const pos41 = () => A.evaluate(() => { const b = [...document.querySelectorAll('.cs-msg-bubble')].find(x => x.textContent.startsWith('Tin số 41')); return { top: Math.round(b.getBoundingClientRect().top), n: document.querySelectorAll('.cs-msg-bubble').length } })
  const before = await pos41()
  assert.equal(before.n, 30)
  assert.ok(await A.$('.cs-chat-older'))
  await A.click('.cs-chat-older')
  await waitFor(A, () => document.querySelectorAll('.cs-msg-bubble').length === 60)
  const afterTop = (await pos41()).top
  const olderOpts = calls(A, 'dm_messages').filter(r => r.body.p_before_seq != null)
  assert.ok(olderOpts.length >= 1 && olderOpts.every(r => r.body.p_before_seq === 41), 'chỉ hỏi trang cũ hơn tin 41, không tải lại toàn bộ')
  assert.ok((await A.$$('.cs-chat-divider')).length >= 2, 'có nhãn giờ giữa các cụm tin cách >30 phút')
  assert.ok(Math.abs(afterTop - before.top) <= 3, `giữ vị trí đọc: tin 41 dịch ${afterTop - before.top}px`)
  ok(`3 Xem tin cũ hơn: 30 tin trước (before_seq=41), có nhãn giờ; tin đang đọc đứng yên (lệch ${Math.abs(afterTop - before.top)}px)`)
  assert.ok(await A.$('.cs-chat-older') === null || (await bubbles(A))[0] === 'Tin số 11')

  // ── 4. Back (mobile) → danh sách ──
  await A.click('.cs-chat-back')
  await waitFor(A, () => location.pathname === '/me/chat')
  assert.equal(await A.$eval('.cs-chat-pane', e => getComputedStyle(e).display), 'none')
  assert.equal((await A.$$('.cs-chat-item.is-unread')).length, 0, 'hết in đậm sau khi đã đọc')
  ok('4 Back (←) về /me/chat; mục không còn tô đậm/badge')

  // ── 5. "Nhắn tin" từ Bạn bè: KHÔNG tạo hội thoại; gửi tin đầu mới tạo ──
  await A.goto(`${ME}/friends`, { waitUntil: 'networkidle0' })
  await A.waitForSelector('.cs-person-friend')
  await A.click('.cs-person-friend button[aria-label="Nhắn tin cho Bình"]')
  await waitFor(A, id => location.pathname === `/me/chat/u/${id}` && document.querySelector('.cs-chat-input'), ID.B)
  assert.match(await A.$eval('.cs-chat-start-title', e => e.textContent), /Bắt đầu trò chuyện với Bình/)
  assert.equal(calls(A, 'dm_start').length, 0, 'chưa gửi tin → CHƯA tạo hội thoại')
  assert.ok(calls(A, 'dm_find').length >= 1 && calls(A, 'dm_can_message').length >= 1)
  assert.equal(await sendBtnDisabled(A), true)
  await type(A, '   \n  ')
  assert.equal(await sendBtnDisabled(A), true, 'chỉ khoảng trắng → không gửi được')
  await A.click('.cs-chat-back')
  await waitFor(A, () => location.pathname === '/me/friends')   // vào từ Bạn bè → Back về Bạn bè
  await chat(A)
  assert.equal((await A.$$('.cs-chat-item')).length, 1, 'mở "Nhắn tin" rồi thoát: không có hội thoại rác')
  ok('5 Nhắn tin (Bạn bè) → /me/chat/u/<B>: hỏi dm_find + dm_can_message, KHÔNG dm_start; thoát → vẫn 1 hội thoại; Back về Bạn bè; chỉ khoảng trắng → khoá Gửi')

  await A.goto(`${ME}/u/${ID.B}`, { waitUntil: 'networkidle0' })
  await A.waitForSelector('.cs-identity-name')
  await A.waitForSelector('.cs-rel-row button:not(.cs-rel-btn.cs-btn-primary)')
  await clickText(A, 'Nhắn tin', '.cs-rel-row button')
  await waitFor(A, id => location.pathname === `/me/chat/u/${id}` && document.querySelector('.cs-chat-input'), ID.B)
  await type(A, 'Chào Bình ')
  await A.keyboard.sendCharacter('👋')
  assert.equal(await sendBtnDisabled(A), false)
  await A.click('.cs-chat-send')
  await waitFor(A, () => /\/me\/chat\/[0-9a-f-]{36}$/.test(location.pathname) && document.querySelector('.cs-msg-row.is-mine .cs-msg-bubble'))
  const CONV_AB = convId(A)
  assert.notEqual(CONV_AB, CONV_AC)
  assert.deepEqual(await bubbles(A), ['Chào Bình 👋'])
  assert.equal(await A.$eval('.cs-chat-input', e => e.value), '', 'composer được xoá')
  assert.equal(calls(A, 'dm_start').length, 1)
  assert.equal(await A.$eval('.cs-chat-peer-name', e => e.textContent.trim()), NAME.B)
  ok('5 Nhắn tin (Hồ sơ B) → gửi tin đầu: dm_start ×1, URL → /me/chat/<id>, bong bóng bên phải, composer trống, header Bình')

  // ── 6. B (desktop 1280): badge + danh sách 2 cột + đọc + trả lời bằng Enter ──
  await B.goto(`${ME}`, { waitUntil: 'networkidle0' })
  await waitFor(B, () => [...document.querySelectorAll('.cs-sidebar .cs-nav-item')].find(i => i.textContent.includes('Trò chuyện'))?.querySelector('.cs-nav-badge')?.textContent === '1')
  await chat(B)
  const cols = await B.evaluate(() => { const l = document.querySelector('.cs-chat-list').getBoundingClientRect(), p = document.querySelector('.cs-chat-pane').getBoundingClientRect()
    return { l: Math.round(l.width), pLeft: Math.round(p.left), lRight: Math.round(l.right), same: Math.abs(l.top - p.top) < 2, empty: !!document.querySelector('.cs-chat-pane-empty') } })
  assert.ok(cols.l >= 320 && cols.l <= 360 && cols.pLeft >= cols.lRight - 1 && cols.same && cols.empty, JSON.stringify(cols))
  const bi = await B.$$eval('.cs-chat-item', es => es.map(e => [e.querySelector('.cs-chat-item-name').textContent, e.querySelector('.cs-chat-item-preview').textContent, e.querySelector('.cs-nav-badge')?.textContent]))
  assert.deepEqual(bi, [[NAME.A, 'Chào Bình 👋', '1']])
  await noOverflow(B, 'desktop 1280 danh sách')
  await B.click('.cs-chat-item')
  await waitFor(B, () => document.querySelector('.cs-msg-row.is-theirs .cs-msg-bubble'))
  assert.deepEqual(await bubbles(B, '.cs-msg-row.is-theirs .cs-msg-bubble'), ['Chào Bình 👋'])
  assert.equal(await B.$eval('.cs-chat-back', e => getComputedStyle(e).display), 'none', 'desktop: không có nút ←')
  await waitFor(B, () => ![...document.querySelectorAll('.cs-sidebar .cs-nav-item')].find(i => i.textContent.includes('Trò chuyện'))?.querySelector('.cs-nav-badge'))
  ok('6 B desktop: badge sidebar 1 → danh sách hai cột + preview → mở, tin bên TRÁI, badge biến mất khi đã đọc, không có ←')
  await B.click('.cs-chat-input')
  await B.type('.cs-chat-input', 'Chào An')
  await B.keyboard.press('Enter')
  await waitFor(B, () => document.querySelector('.cs-msg-row.is-mine .cs-msg-bubble')?.textContent === 'Chào An')
  assert.equal(await B.$eval('.cs-chat-input', e => e.value), '')
  await B.type('.cs-chat-input', 'Dòng 1'); await B.keyboard.down('Shift'); await B.keyboard.press('Enter'); await B.keyboard.up('Shift')
  await B.type('.cs-chat-input', 'Dòng 2')
  assert.equal(await B.$eval('.cs-chat-input', e => e.value), 'Dòng 1\nDòng 2', 'Shift+Enter xuống dòng, không gửi')
  await B.keyboard.press('Enter')
  await waitFor(B, () => [...document.querySelectorAll('.cs-msg-row.is-mine .cs-msg-bubble')].some(b => b.textContent === 'Dòng 1\nDòng 2'))
  ok('6 B: Enter gửi · Shift+Enter xuống dòng · tin nhiều dòng giữ nguyên xuống dòng')
  await B.screenshot({ path: `${SHOTS}/chat-desktop-1280.png` })

  // ── 7. A thấy tin của B nhờ polling (chỉ hỏi tin mới) ──
  await waitFor(A, () => [...document.querySelectorAll('.cs-msg-row.is-theirs .cs-msg-bubble')].some(b => b.textContent === 'Dòng 1\nDòng 2'))
  assert.deepEqual((await bubbles(A, '.cs-msg-row.is-theirs .cs-msg-bubble')), ['Chào An', 'Dòng 1\nDòng 2'])
  const dm = calls(A, 'dm_messages').filter(r => r.body.p_conversation === CONV_AB)
  const full = dm.filter(r => r.body.p_after_seq == null && r.body.p_before_seq == null)
  const polls = dm.filter(r => r.body.p_after_seq != null)
  assert.ok(full.length <= 2, `tải lịch sử đầy đủ ≤2 lần — vite dev chạy StrictMode nên effect mount chạy đôi (có ${full.length})`)
  assert.ok(polls.length >= 1 && polls.every(r => r.body.p_after_seq >= 1), 'polling chỉ hỏi tin MỚI (p_after_seq)')
  ok(`7 A (đang mở hội thoại) tự thấy 2 tin của B: ${polls.length} lượt polling theo p_after_seq, ${full.length} lần tải đầy đủ`)

  // ── 8. Tin dài + xuống dòng (mobile): Enter = xuống dòng, bấm Gửi ──
  const LONG = 'X'.repeat(420)
  await A.click('.cs-chat-input'); await A.keyboard.sendCharacter(LONG)
  await A.click('.cs-chat-send')
  await waitFor(A, l => [...document.querySelectorAll('.cs-msg-row.is-mine .cs-msg-bubble')].some(b => b.textContent === l), LONG)
  await A.type('.cs-chat-input', 'Dòng 1'); await A.keyboard.press('Enter'); await A.type('.cs-chat-input', 'Dòng 2')
  assert.equal(await A.$eval('.cs-chat-input', e => e.value), 'Dòng 1\nDòng 2', 'cảm ứng: Enter xuống dòng, KHÔNG gửi')
  await A.click('.cs-chat-send')
  await waitFor(A, () => [...document.querySelectorAll('.cs-msg-row.is-mine .cs-msg-bubble')].some(b => b.textContent === 'Dòng 1\nDòng 2'))
  const longGeo = await A.evaluate(() => { const sc = document.querySelector('.cs-chat-scroll'), bs = [...document.querySelectorAll('.cs-msg-row.is-mine .cs-msg-bubble')]
    const long = bs.find(b => b.textContent.startsWith('XXXX')).getBoundingClientRect(), two = bs.find(b => b.textContent === 'Dòng 1\nDòng 2').getBoundingClientRect()
    return { right: Math.round(long.right), iw: innerWidth, h: Math.round(long.height), twoH: Math.round(two.height), scO: sc.scrollWidth > sc.clientWidth + 1, atBottom: sc.scrollHeight - sc.scrollTop - sc.clientHeight < 4 } })
  assert.ok(longGeo.right <= longGeo.iw - 8 && !longGeo.scO, JSON.stringify(longGeo))
  assert.ok(longGeo.h > 60, 'chuỗi 420 ký tự không khoảng trắng được bẻ dòng')
  assert.ok(longGeo.twoH > 40, 'hai dòng cao hơn một dòng')
  assert.ok(longGeo.atBottom, 'mình gửi → tự xuống cuối')
  await noOverflow(A, 'tin dài 390')
  await A.screenshot({ path: `${SHOTS}/chat-long-390.png` })
  ok('8 tin 420 ký tự liền + 2 dòng: bẻ dòng đúng, không tràn, tự xuống cuối; cảm ứng Enter = xuống dòng')

  // ── 9. Người ngoài hội thoại + Thầy (nhánh quyền lớp chưa mở) ──
  await C.goto(`${ME}/chat/${CONV_AB}`, { waitUntil: 'networkidle0' })
  await C.waitForSelector('.cs-chat-body-state p', { timeout: 15000 })
  assert.match(await C.$eval('.cs-chat-body-state', e => e.textContent), /Không tìm thấy cuộc trò chuyện này/)
  const ctext = await C.evaluate(() => document.body.innerText)
  assert.ok(!/Chào Bình|Chào An|XXXX/.test(ctext), 'C không thấy nội dung hội thoại của A–B')
  assert.equal(await C.$('.cs-chat-input'), null)
  await C.goto(`${ME}/chat/00000000-1111-4000-8000-000000000000`, { waitUntil: 'networkidle0' })
  await C.waitForSelector('.cs-chat-body-state p', { timeout: 15000 })
  assert.equal(await C.$eval('.cs-chat-body-state p', e => e.textContent), 'Không tìm thấy cuộc trò chuyện này.')
  ok('9 C (không thuộc hội thoại) mở /me/chat/<id A–B> ≡ mở id không tồn tại: cùng thông báo, không lộ nội dung, không có ô nhập')
  await C.goto(`${ME}/chat/u/${ID.B}`, { waitUntil: 'networkidle0' })
  await C.waitForSelector('.cs-chat-locked', { timeout: 15000 })
  assert.match(await C.$eval('.cs-chat-locked', e => e.textContent), /Bạn cần là bạn bè của Bình để nhắn tin/)
  assert.equal(await C.$('.cs-chat-input'), null)
  ok('9 C (không là bạn B) mở /me/chat/u/<B>: không có ô nhập, nói rõ cần là bạn bè')
  await T.goto(`${ME}/chat/u/${ID.A}`, { waitUntil: 'networkidle0' })
  await T.waitForSelector('.cs-chat-locked', { timeout: 15000 })
  assert.equal(await T.$('.cs-chat-input'), null)
  await T.goto(`${ME}/u/${ID.A}`, { waitUntil: 'networkidle0' })
  await T.waitForSelector('.cs-rel-row')
  await sleep(600)
  assert.deepEqual(await T.$$eval('.cs-rel-row button', es => es.map(e => e.textContent.trim())), ['Kết bạn'], 'Thầy chưa là bạn: chưa có nút Nhắn tin (nhánh quyền lớp đang dừng)')
  ok('9 Thầy ↔ học viên không bạn: CHƯA nhắn được (nhánh quyền lớp đang dừng có chủ đích) — không có ô nhập, không có nút Nhắn tin')

  // ── 10. Hồ sơ người đã có hội thoại: Nhắn tin → mở hội thoại có sẵn (không tạo mới) ──
  await A.goto(`${ME}/u/${ID.B}`, { waitUntil: 'networkidle0' })
  await A.waitForSelector('.cs-identity-name')
  await clickText(A, 'Nhắn tin', '.cs-rel-row button')
  await waitFor(A, id => location.pathname === `/me/chat/${id}`, CONV_AB)
  assert.equal(calls(A, 'dm_start').length, 1, 'không tạo hội thoại mới')
  ok('10 Nhắn tin từ hồ sơ B khi đã có hội thoại → mở đúng /me/chat/<id> có sẵn (replace), không dm_start mới')

  // ── 11. Huỷ kết bạn → chỉ đọc ──
  await A.goto(`${ME}/u/${ID.B}`, { waitUntil: 'networkidle0' })
  await A.waitForSelector('.cs-rel-btn')
  await A.click('.cs-rel-btn')
  await clickText(A, 'Huỷ kết bạn', '.cs-rel-menu button')
  await clickText(A, 'Huỷ kết bạn', '.cs-confirm button')
  await waitFor(A, () => document.querySelector('.cs-rel-btn')?.textContent.trim() === 'Kết bạn')
  assert.equal(await A.$$eval('.cs-rel-row button', es => es.some(e => e.textContent.trim() === 'Nhắn tin')), false, 'hết bạn → ẩn nút Nhắn tin ở hồ sơ')
  await A.goto(`${ME}/chat/${CONV_AB}`, { waitUntil: 'networkidle0' })
  await A.waitForSelector('.cs-chat-locked', { timeout: 15000 })
  assert.equal(await A.$('.cs-chat-input'), null)
  assert.ok((await bubbles(A)).includes('Chào Bình 👋'), 'vẫn đọc được lịch sử')
  assert.match(await A.$eval('.cs-chat-locked', e => e.textContent), /Bạn chưa thể gửi tin mới cho Bình/)
  await A.screenshot({ path: `${SHOTS}/chat-locked-390.png` })
  ok('11 hết bạn: hồ sơ ẩn Nhắn tin; hội thoại vẫn đọc được, ô nhập thay bằng ghi chú, không gửi mới')
  await waitFor(B, () => document.querySelector('.cs-chat-locked'))   // list polling 15s → can_send=false cho B
  assert.equal(await B.$('.cs-chat-input'), null)
  ok('11 phía B cũng chuyển sang chỉ đọc (list polling cập nhật can_send)')

  // ── 12. Ma trận kích thước: hội thoại A–C (dài) + danh sách ──
  const widths = [[320, 640], [360, 740], [390, 844], [430, 932], [1120, 800], [1280, 900], [1440, 900]]
  for (const [w, h] of widths) {
    await A.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600 })
    await A.goto(`${ME}/chat/${CONV_AC}`, { waitUntil: 'networkidle0' })
    await A.waitForSelector('.cs-chat-input', { timeout: 15000 })
    await waitFor(A, () => document.querySelectorAll('.cs-msg-bubble').length >= 20)
    const m = await A.evaluate(() => {
      const comp = document.querySelector('.cs-chat-composer').getBoundingClientRect(), input = document.querySelector('.cs-chat-input').getBoundingClientRect()
      const send = document.querySelector('.cs-chat-send').getBoundingClientRect()
      const hit = document.elementFromPoint(input.left + input.width / 2, input.top + input.height / 2)
      const sc = document.querySelector('.cs-chat-scroll'), pane = document.querySelector('.cs-chat-pane').getBoundingClientRect()
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, ih: innerHeight, compBottom: Math.round(comp.bottom), compTop: Math.round(comp.top), hit: hit?.classList.contains('cs-chat-input'),
        sendIn: send.right <= innerWidth && send.bottom <= innerHeight, scO: sc.scrollWidth > sc.clientWidth + 1, paneH: Math.round(pane.height), paneW: Math.round(pane.width),
        listShown: getComputedStyle(document.querySelector('.cs-chat-list')).display !== 'none' }
    })
    assert.ok(m.sw <= m.iw + 1, `${w}: tràn ngang`)
    assert.ok(m.compBottom <= m.ih && m.compTop > 0 && m.hit && m.sendIn && !m.scO, `${w}: composer/ô nhập ${JSON.stringify(m)}`)
    if (w < 1024) assert.ok(m.paneW === w && m.paneH === h && m.compBottom === h && !m.listShown, `${w}: mobile toàn màn hình ${JSON.stringify(m)}`)
    else assert.ok(m.listShown && m.paneW < w && m.compBottom <= h, `${w}: desktop hai cột ${JSON.stringify(m)}`)
    if (w === 320 || w === 430 || w === 1120 || w === 1440) await A.screenshot({ path: `${SHOTS}/chat-conv-${w}.png` })
    await A.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
    await A.waitForSelector('.cs-chat-item', { timeout: 15000 })
    await noOverflow(A, `danh sách ${w}`)
    const nameFit = await A.$$eval('.cs-chat-item', es => es.every(e => e.scrollWidth <= e.clientWidth + 1))
    assert.ok(nameFit, `${w}: mục danh sách không tràn (tên rất dài cắt gọn)`)
  }
  ok('12 ma trận 320/360/390/430/1120/1280/1440: không tràn ngang, composer luôn trong màn hình + không bị che, mobile toàn màn hình, desktop hai cột, danh sách tên dài cắt gọn')

  assert.deepEqual(errors, [], 'lỗi trang/console')
  ok('không lỗi trang / console')
  console.log(`CHAT V1a E2E: ${pass} PASS`)
} catch (e) {
  console.error('FAIL:', e.message)
  console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
