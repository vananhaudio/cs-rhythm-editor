// E2E Chat Lớp V1 trong Chrome thật — xem scripts/e2e-class-room-chat.sh. Đường production: Hộp thư V2 (chat_inbox) + lớp an toàn UGC.
// A, B = học viên lớp K1 · T = Thầy phụ trách K1 · C = lớp K2. Mỗi người một browser context, đăng nhập thật qua proxy.
// Phủ: phòng lớp trong danh sách (nhãn Lớp) · mở toàn màn hình (mobile) · gửi/nhận học viên↔học viên↔Thầy · tên + ảnh người gửi ·
// chưa đọc/badge · thành viên · cách ly giữa lớp (mở thẳng URL) · gửi lỗi không báo thành công · lớp huỷ → chỉ đọc · rời lớp → mất quyền, tin còn ·
// Band + chat cá nhân không đổi · ma trận 320…1440.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ME = `http://class.localhost:${V}/me`
const K1 = '22222222-0000-4000-8000-0000000000c1'
const K2 = '22222222-0000-4000-8000-0000000000c2'
const G1 = '33333333-0000-4000-8000-0000000000c1'
const K1_NAME = 'Guitar Cơ Bản KD21 — Thứ 3 · 19h00 · Hà Nội 2026'
const EMAIL = { A: 'a@test.local', B: 'b@test.local', C: 'c@test.local', T: 't@test.local', N: 'n@test.local', M: 't2@test.local' }
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })
const sql = q => execFileSync(`${process.env.E2E_PG_BIN}/psql`, ['-X', '-q', '-tA', '-h', process.env.E2E_PG_SOCK, '-p', process.env.E2E_PG_PORT, '-U', 'postgres', '-d', 'e2e', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim()

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
  page.rpcs = []
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
const waitFor = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 45000 }, ...args)
const calls = (page, fn) => page.rpcs.filter(r => r.fn === fn)
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }))
const noOverflow = async (page, what) => { const o = await overflow(page); assert.ok(o.sw <= o.iw + 1, `${what}: tràn ngang ${o.sw} > ${o.iw}`) }
async function chat(page) {
  await page.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-chat', { timeout: 15000 })
  await waitFor(page, () => !document.querySelector('.cs-inbox-skel') && !document.querySelector('.cs-chat-list .cs-skeleton'))
}
const rows = page => page.$$eval('.cs-inbox-main', es => es.map(e => ({
  name: e.querySelector('.cs-inbox-name').textContent, kind: e.dataset.kind, tag: e.querySelector('.cs-inbox-tag')?.textContent ?? null,
  prev: e.querySelector('.cs-inbox-preview').textContent, unread: !!e.querySelector('.cs-nav-badge'), badge: e.querySelector('.cs-nav-badge')?.textContent ?? null })))
const bubbles = page => page.$$eval('.cs-msg-bubble', es => es.map(e => e.textContent))
async function type(page, text) { await page.click('.cs-chat-input'); await page.type('.cs-chat-input', text) }
async function openRoom(page, name = K1_NAME) {
  const h = await page.waitForFunction(n => [...document.querySelectorAll('.cs-inbox-main')].find(e => e.querySelector('.cs-inbox-name').textContent === n), { timeout: 20000 }, name)
  await h.asElement().click()
  await waitFor(page, () => /\/me\/chat\/c\/[0-9a-f-]{36}$/.test(location.pathname) && !document.querySelector('.cs-chat-body-state .cs-spinner'))
}

try {
  const A = await open('A'), B = await open('B', 1280, 900), C = await open('C')

  // ── 1. Danh sách của A: phòng lớp + chat cá nhân; không thấy lớp khác ──
  await chat(A)
  let list = await rows(A)
  const room = list.find(i => i.name === K1_NAME), dm = list.find(i => i.name === 'Bình')
  assert.ok(room && room.kind === 'class', 'có hàng phòng lớp (kind=class)')
  assert.match(room.tag ?? '', /Lớp học/)
  assert.match(room.prev, /Chưa có tin nhắn/)
  assert.ok(dm && dm.kind === 'dm', 'chat cá nhân vẫn có')
  assert.ok(!list.some(i => i.name === 'Lớp KD22'), 'không thấy lớp khác')
  await noOverflow(A, 'danh sách 390')
  await A.screenshot({ path: `${SHOTS}/class-chat-list-390.png` })
  ok('1 danh sách: phòng lớp (tên dài cắt gọn, nhãn Lớp học) + chat cá nhân, không thấy lớp khác, không tràn ngang')

  // ── 2. Mở phòng ──
  await openRoom(A)
  const geo = await A.evaluate(() => {
    const pane = document.querySelector('.cs-chat-pane').getBoundingClientRect(), comp = document.querySelector('.cs-chat-composer').getBoundingClientRect()
    const input = document.querySelector('.cs-chat-input').getBoundingClientRect()
    const mid = document.elementFromPoint(input.left + input.width / 2, input.top + input.height / 2)
    return { pane: [Math.round(pane.left), Math.round(pane.top), Math.round(pane.width), Math.round(pane.height)], ih: innerHeight, iw: innerWidth,
      compBottom: Math.round(comp.bottom), inputHit: mid?.classList.contains('cs-chat-input'), peerRight: Math.round(document.querySelector('.cs-chat-peer').getBoundingClientRect().right),
      name: document.querySelector('.cs-chat-peer-name').textContent.trim(), tag: document.querySelector('.cs-chat-peer-tag')?.textContent ?? '' }
  })
  assert.deepEqual(geo.pane, [0, 0, geo.iw, geo.ih])
  assert.equal(geo.compBottom, geo.ih)
  assert.ok(geo.inputHit, 'ô nhập không bị che')
  assert.equal(geo.name, K1_NAME)
  assert.ok(geo.peerRight <= geo.iw, 'tên lớp dài không tràn header')
  assert.match(geo.tag, /Lớp học · 3 thành viên/)
  await noOverflow(A, 'phòng 390')
  ok('2 mở phòng lớp: toàn màn hình, "Lớp học · 3 thành viên", composer sát đáy không bị che, tên dài không tràn')

  // ── 3. A gửi → B thấy badge, mở, thấy tên người gửi ──
  await type(A, 'Mai học lúc 7h nhé cả lớp')
  await A.click('.cs-chat-send')
  await waitFor(A, () => [...document.querySelectorAll('.cs-msg-bubble')].some(b => b.textContent === 'Mai học lúc 7h nhé cả lớp' && !b.classList.contains('is-pending')))
  assert.ok(calls(A, 'classchat_send').some(r => r.body.p_class === K1 && r.body.p_body === 'Mai học lúc 7h nhé cả lớp'))
  assert.equal(sql(`select count(*) from public.classchat_messages where class_id = '${K1}'`), '1')
  assert.equal(calls(A, 'dm_send').length + calls(A, 'bandchat_send').length, 0, 'không đi qua dm_/bandchat_send')
  await A.screenshot({ path: `${SHOTS}/class-chat-room-390.png` })
  await chat(B)
  await waitFor(B, () => [...document.querySelectorAll('.cs-inbox-main')].some(e => e.dataset.kind === 'class' && e.querySelector('.cs-nav-badge')))
  list = await rows(B)
  const bx = list.find(i => i.kind === 'class')
  assert.deepEqual([bx.name, bx.unread, bx.badge, bx.prev], [K1_NAME, true, '1', 'An: Mai học lúc 7h nhé cả lớp'])
  await B.screenshot({ path: `${SHOTS}/class-chat-list-1280.png` })
  await openRoom(B)
  await waitFor(B, () => document.querySelectorAll('.cs-msg-bubble').length >= 1)
  assert.equal(await B.$eval('.cs-msg-sender', e => e.textContent), 'An')
  await waitFor(B, () => ![...document.querySelectorAll('.cs-inbox-main')].some(e => e.dataset.kind === 'class' && e.querySelector('.cs-nav-badge')))
  assert.ok(calls(B, 'classchat_mark_read').some(r => r.body.p_class === K1 && r.body.p_seq === 1))
  ok('3 A gửi (classchat_send đúng lớp, server xác nhận); B thấy badge 1 + "An: …"; mở phòng thấy tên người gửi; đánh dấu đã đọc → hết badge')

  // ── 4. B trả lời → A thấy (polling) ──
  await type(B, 'Dạ em mang đàn ạ')
  await B.click('.cs-chat-send')
  await waitFor(B, () => [...document.querySelectorAll('.cs-msg-bubble')].some(b => b.textContent === 'Dạ em mang đàn ạ' && !b.classList.contains('is-pending')))
  await waitFor(A, () => [...document.querySelectorAll('.cs-msg-bubble')].some(b => b.textContent === 'Dạ em mang đàn ạ'))
  assert.equal(await A.$eval('.cs-msg-sender', e => e.textContent), 'Bình')
  assert.equal(await A.$$eval('.cs-msg-row.is-mine', es => es.length), 1)
  ok('4 học viên B trả lời, học viên A nhận qua polling với tên "Bình"; tin mình bên phải, người khác bên trái')

  // ── 5. Thầy phụ trách (T) cùng phòng: nhận, gửi, học viên nhận ──
  const T = await open('T', 1280, 900)
  await chat(T)
  list = await rows(T)
  const tr = list.find(i => i.kind === 'class')
  assert.ok(tr && tr.name === K1_NAME && !/xem|Hỗ trợ/i.test(tr.tag ?? ''), 'Thầy phụ trách thấy phòng như thành viên (không phải chế độ hỗ trợ)')
  await openRoom(T)
  await waitFor(T, () => document.querySelectorAll('.cs-msg-bubble').length === 2)
  await T.waitForSelector('.cs-chat-input')
  await type(T, 'Chào các em, nhớ tập nhịp nhé')
  await T.click('.cs-chat-send')
  await waitFor(T, () => [...document.querySelectorAll('.cs-msg-bubble')].some(b => b.textContent === 'Chào các em, nhớ tập nhịp nhé' && !b.classList.contains('is-pending')))
  await waitFor(A, () => [...document.querySelectorAll('.cs-msg-bubble')].some(b => b.textContent === 'Chào các em, nhớ tập nhịp nhé'))
  ok('5 Thầy phụ trách nhận 2 tin của học viên, gửi tin, học viên nhận được')

  // ── 6. Thành viên: An, Bình, Thầy (Thầy đầu) ──
  await A.click('.cs-chat-peer')
  await A.waitForSelector('.cs-chat-members .cs-chat-member')
  const names = await A.$$eval('.cs-chat-member-name', es => es.map(e => e.textContent))
  assert.equal(names.length, 3)
  assert.match(names[0], /Giáo viên/, 'Thầy xếp đầu')
  assert.deepEqual(names.slice(1).map(n => n.replace(/ · Giáo viên/, '')).sort(), ['An', 'Bình'])
  assert.equal(await A.$$eval('.cs-chat-manage-link, .cs-chat-members input, .cs-chat-members select', es => es.length), 0, 'không có liên kết/thao tác quản trị Band trong phòng lớp')
  assert.doesNotMatch(await A.$eval('.cs-chat-members', e => e.textContent), /Trưởng Band|TeamLab/)
  await noOverflow(A, 'thành viên 390')
  await A.screenshot({ path: `${SHOTS}/class-chat-members-390.png` })
  await A.click('.cs-chat-members-head button')
  ok('6 danh sách thành viên: Thầy (đầu) + An + Bình; không có nội dung/thao tác của Band')

  // ── 7. Cách ly: C (lớp K2) và N (ngoài lớp) ──
  await chat(C)
  list = await rows(C)
  const cNames = list.filter(i => i.kind === 'class').map(i => i.name)   // C còn thuộc lớp mẫu của stack E2E → chỉ cần có KD22 và KHÔNG có lớp K1
  assert.ok(cNames.includes('Lớp KD22') && !cNames.includes(K1_NAME), `C chỉ thấy lớp của mình: ${cNames}`)
  await C.goto(`${ME}/chat/c/${K1}`, { waitUntil: 'networkidle0' })
  await C.waitForSelector('.cs-chat-body-state[role=alert]', { timeout: 15000 })
  assert.match(await C.$eval('.cs-chat-body-state', e => e.textContent), /Không tìm thấy cuộc trò chuyện/)
  assert.equal(await C.$$eval('.cs-msg-bubble', es => es.length), 0, 'không lộ tin')
  assert.ok(!(await C.content()).includes('Mai học lúc 7h'))
  ok('7 C (lớp khác) không thấy phòng lớp K1 (chỉ lớp của mình), mở thẳng URL K1 → "Không tìm thấy", không lộ tin; tài khoản ngoài Class/học viên không lớp: kiểm bằng test DB + bước 10')

  // ── 8. Gửi thất bại không báo thành công ──
  await C.goto(`${ME}/chat/c/${K2}`, { waitUntil: 'networkidle0' })
  await C.waitForSelector('.cs-chat-input')
  await C.setRequestInterception(true)
  C.on('request', r => { if (/rpc\/classchat_send/.test(r.url()) && r.method() !== 'OPTIONS') r.abort('failed'); else r.continue() })
  await type(C, 'tin sẽ lỗi')
  await C.click('.cs-chat-send')
  await C.waitForSelector('.cs-msg-fail', { timeout: 15000 })
  assert.equal(sql(`select count(*) from public.classchat_messages where class_id = '${K2}'`), '0')
  assert.match(await C.$eval('.cs-msg-fail', e => e.textContent), /Chưa gửi được/)
  ok('8 mạng lỗi khi gửi: hiện "Chưa gửi được · Thử lại", không có tin trong DB (không báo thành công giả)')

  // ── 9. Lớp huỷ → chỉ đọc, lịch sử còn; mở lại → gửi được ──
  sql(`update public.class_schedule set status = 'cancelled' where id = '${K1}'`)
  await chat(A)
  await openRoom(A)
  await waitFor(A, () => document.querySelector('.cs-chat-locked'))
  assert.match(await A.$eval('.cs-chat-peer-tag', e => e.textContent), /Chỉ đọc/)
  assert.match(await A.$eval('.cs-chat-locked', e => e.textContent), /chỉ đọc/)
  assert.equal(await A.$('.cs-chat-input'), null)
  assert.equal(await A.$$eval('.cs-msg-bubble', es => es.length), 3, 'lịch sử còn nguyên')
  await A.screenshot({ path: `${SHOTS}/class-chat-cancelled-390.png` })
  sql(`update public.class_schedule set status = 'active' where id = '${K1}'`)
  await chat(A)
  await openRoom(A)
  await A.waitForSelector('.cs-chat-input')
  assert.equal(await A.$('.cs-chat-locked'), null)
  ok('9 lớp huỷ: thành viên vẫn đọc đủ 3 tin, ô gửi biến mất + giải thích; trạng thái trở lại → gửi được')

  // ── 10. Rời lớp → mất quyền; tin cũ còn ──
  sql(`update public.edu_group_members set status = 'removed' where group_id = '${G1}' and user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'`)
  await chat(B)
  assert.ok(!(await rows(B)).some(i => i.name === K1_NAME), 'B không còn thấy phòng K1')
  await B.goto(`${ME}/chat/c/${K1}`, { waitUntil: 'networkidle0' })
  await B.waitForSelector('.cs-chat-body-state[role=alert]', { timeout: 15000 })
  assert.equal(sql(`select count(*) from public.classchat_messages where class_id = '${K1}'`), '3')
  await chat(A)
  await openRoom(A)
  await waitFor(A, () => document.querySelectorAll('.cs-msg-bubble').length === 3)
  assert.equal(await A.$eval('.cs-chat-peer-tag', e => e.textContent), 'Lớp học · 2 thành viên')
  ok('10 B rời lớp: không thấy phòng, mở thẳng URL bị chặn; 3 tin cũ (kể cả của B) còn và A vẫn đọc')

  // ── 11. Chat cá nhân + Band không đổi ──
  await chat(A)
  await A.evaluate(() => { [...document.querySelectorAll('.cs-inbox-main')].find(e => e.dataset.kind === 'dm' && e.querySelector('.cs-inbox-name').textContent === 'Bình').click() })
  await waitFor(A, () => /\/me\/chat\/[0-9a-f-]{36}$/.test(location.pathname) && document.querySelectorAll('.cs-msg-bubble').length >= 2)
  assert.deepEqual((await bubbles(A)).slice(0, 2), ['Chào Bình', 'Chào An, tin riêng của hai đứa'])
  assert.equal(await A.$('.cs-chat-peer-tag'), null, 'chat cá nhân không có dòng nhóm')
  await type(A, 'tin riêng mới')
  await A.click('.cs-chat-send')
  await waitFor(A, () => [...document.querySelectorAll('.cs-msg-bubble')].some(b => b.textContent === 'tin riêng mới' && !b.classList.contains('is-pending')))
  assert.ok(calls(A, 'dm_send').length >= 1)
  ok('11 chat cá nhân A–B: tải + gửi qua dm_*, không dòng nhóm')

  // ── 11b. Hồi quy Band Chat cạnh phòng lớp: cùng danh sách, nhãn riêng, gửi/nhận qua bandchat_*, không lẫn classchat_* ──
  const BAND_X = '11111111-0000-4000-8000-0000000000a1'
  await chat(A)
  list = await rows(A)
  const bandRow = list.find(i => i.name === 'Band X')
  assert.ok(bandRow && bandRow.kind === 'band' && /Band/.test(bandRow.tag ?? ''), 'Band X hiện với nhãn Band')
  assert.ok(list.some(i => i.kind === 'class') && list.some(i => i.kind === 'dm'), 'lớp + Band + cá nhân cùng một danh sách')
  await A.evaluate(() => { [...document.querySelectorAll('.cs-inbox-main')].find(e => e.dataset.kind === 'band').click() })
  await waitFor(A, () => /\/me\/chat\/b\/[0-9a-f-]{36}$/.test(location.pathname) && !document.querySelector('.cs-chat-body-state .cs-spinner'))
  assert.match(await A.$eval('.cs-chat-peer-tag', e => e.textContent), /Nhóm Band/)
  await type(A, 'tin Band, không lẫn lớp')
  await A.click('.cs-chat-send')
  await waitFor(A, () => [...document.querySelectorAll('.cs-msg-bubble')].some(b => b.textContent === 'tin Band, không lẫn lớp' && !b.classList.contains('is-pending')))
  assert.ok(calls(A, 'bandchat_send').some(r => r.body.p_band === BAND_X))
  assert.equal(sql(`select count(*) from public.bandchat_messages where band_id = '${BAND_X}'`), '1')
  assert.equal(sql(`select count(*) from public.classchat_messages where body = 'tin Band, không lẫn lớp'`), '0')
  ok('11b Band Chat cạnh phòng lớp: nhãn Band, gửi qua bandchat_* (không qua classchat_*), tin không lẫn giữa hai hệ')

  // ── 11c. Admin ngoài mọi lớp (M): tab Lớp học có phòng hỗ trợ; Quản lý Band chỉ có Band; Hỗ trợ lớp học chỉ có lớp ──
  const M = await open('M')
  await chat(M)
  const tab = (P, id) => P.evaluate(i => document.querySelector(`[data-testid="tab-${i}"]`).click(), id)
  const bodyText = P => P.evaluate(() => document.querySelector('.cs-inbox-scroll').innerText)
  await tab(M, 'class')
  await waitFor(M, () => document.querySelector('[data-testid="class-support"]'))
  assert.ok(!/sắp có/i.test(await bodyText(M)), 'tab Lớp học KHÔNG còn "sắp có" khi có phòng')
  let cl = await rows(M)
  assert.ok(cl.length >= 3 && cl.every(i => i.kind === 'class'), `tab Lớp học chỉ có lớp (${JSON.stringify(cl.map(i => i.kind))})`)
  assert.ok(cl.some(i => i.name === 'Lớp KD27 chưa có tin') && cl.some(i => i.name === K1_NAME), 'thấy cả lớp chưa có tin lẫn lớp đã có tin')
  assert.ok(!cl.some(i => i.name === 'Lớp KD25 đã huỷ'), 'lớp huỷ chưa có tin không tự hiện')
  assert.match(await M.$eval('[data-testid="class-support"] .cs-inbox-sec', e => e.textContent), /Lớp học · hỗ trợ \(\d+\)/, 'tiêu đề mục: lớp hỗ trợ + số lượng')
  await M.screenshot({ path: `${SHOTS}/class-support-tab-class.png` })
  await tab(M, 'band')
  await waitFor(M, () => document.querySelector('[data-testid="open-band-manager"]'))
  const bl = await rows(M)
  assert.ok(bl.every(i => i.kind === 'band'), 'tab Band chỉ có Band')
  ok('11c admin ngoài lớp: tab Lớp học hiện phòng hỗ trợ (kể cả chưa có tin), không "sắp có"; tab Band chỉ Band')
  await tab(M, 'all')
  await waitFor(M, () => document.querySelector('[data-testid="open-class-manager"]'))
  const mgrTexts = await M.$$eval('.cs-inbox-manage', es => es.map(e => e.innerText.replace(/\s+/g, ' ')))
  assert.ok(mgrTexts.some(t => /Quản lý Band 2 Band khác/.test(t)) && mgrTexts.some(t => /Hỗ trợ lớp học \d+ lớp/.test(t)), 'hai mục hỗ trợ tách riêng: ' + JSON.stringify(mgrTexts))
  await M.evaluate(() => document.querySelector('[data-testid="open-band-manager"]').click())
  await waitFor(M, () => document.querySelector('[data-testid="band-manager"] .cs-inbox-main'))
  const bm = await rows(M)
  assert.ok(bm.length >= 1 && bm.every(i => i.kind === 'band'), 'Quản lý Band KHÔNG chứa phòng lớp ' + JSON.stringify(bm.map(i => i.kind)))
  await M.evaluate(() => document.querySelector('[data-testid="manager-back"]').click())
  await waitFor(M, () => document.querySelector('[data-testid="open-class-manager"]'))
  await M.evaluate(() => document.querySelector('[data-testid="open-class-manager"]').click())
  await waitFor(M, () => document.querySelector('[data-testid="class-manager"] .cs-inbox-main'))
  const cm = await rows(M)
  assert.ok(cm.length >= 3 && cm.every(i => i.kind === 'class'), 'Hỗ trợ lớp học chỉ chứa lớp')
  await M.screenshot({ path: `${SHOTS}/class-support-manager.png` })
  ok('11d Quản lý Band chỉ có Band · Hỗ trợ lớp học chỉ có lớp · hai mục đếm riêng')
  await M.evaluate(() => [...document.querySelectorAll('.cs-inbox-main')].find(e => e.querySelector('.cs-inbox-name').textContent === 'Lớp KD27 chưa có tin').click())
  await waitFor(M, () => /\/me\/chat\/c\/[0-9a-f-]{36}$/.test(location.pathname) && !document.querySelector('.cs-chat-body-state .cs-spinner'))
  assert.match(await M.$eval('.cs-chat-peer-tag', e => e.textContent), /Chế độ hỗ trợ/)
  assert.equal(await M.$('.cs-chat-input'), null, 'admin không phải Thầy đồng hành: không có ô soạn (chỉ đọc)')
  ok('11e mở phòng hỗ trợ lớp chưa có tin từ danh sách: Chế độ hỗ trợ, chỉ đọc, không có ô soạn')
  // học viên A: tab Lớp học chỉ lớp mình, không có mục hỗ trợ
  await chat(A)
  await tab(A, 'class')
  await sleep(800)
  const al = await rows(A)
  const mine = Number(sql("select count(*) from tva_private.class_memberships where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'"))
  assert.ok(mine >= 2 && al.length === mine && al.some(i => i.name === K1_NAME) && !al.some(i => i.name === 'Lớp KD27 chưa có tin'), `học viên thấy đúng ${mine} lớp mình tham gia (thấy ${al.length}), không thấy lớp ngoài`)
  assert.ok(!(await A.$('[data-testid="class-support"]')) && !(await A.$('[data-testid="open-class-manager"]')), 'học viên không có mục hỗ trợ')
  ok('11f học viên: tab Lớp học đúng số lớp mình tham gia (theo class_memberships), không có mục hỗ trợ, không thấy lớp ngoài')
  await M.ctx.close()

  // ── 12. Ma trận kích thước (phòng K2 của C) ──
  for (const [w, h] of [[320, 640], [360, 740], [390, 844], [430, 932], [1120, 800], [1280, 900], [1440, 900]]) {
    const P = await open('C', w, h)
    await P.goto(`${ME}/chat/c/${K2}`, { waitUntil: 'networkidle0' })
    await P.waitForSelector('.cs-chat-input', { timeout: 15000 })
    await noOverflow(P, `phòng ${w}`)
    const m = await P.evaluate(() => {
      const c = document.querySelector('.cs-chat-composer').getBoundingClientRect(), i = document.querySelector('.cs-chat-input').getBoundingClientRect()
      return { compBottom: Math.round(c.bottom), ih: innerHeight, hit: document.elementFromPoint(i.left + i.width / 2, i.top + i.height / 2)?.classList.contains('cs-chat-input') }
    })
    assert.ok(m.compBottom <= m.ih && m.hit, `${w}: composer trong màn hình/không bị che ${JSON.stringify(m)}`)
    await P.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
    await P.waitForSelector('.cs-inbox-main', { timeout: 15000 })
    await noOverflow(P, `danh sách ${w}`)
    if (w === 320 || w === 1440) await P.screenshot({ path: `${SHOTS}/class-chat-list-${w}.png` })
    await P.ctx.close()
  }
  ok('12 ma trận 320/360/390/430/1120/1280/1440: không tràn ngang, composer trong màn hình + không bị che')

  assert.deepEqual(errors, [], 'lỗi trang/console')
  ok('không lỗi trang / console')
  console.log(`CLASS ROOM CHAT V1 E2E: ${pass} PASS`)
} catch (e) {
  console.error('FAIL:', e.message)
  console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
