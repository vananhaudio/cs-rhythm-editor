// E2E Chat V1b (Share nội bộ BMS artifact) trong Chrome thật — xem scripts/e2e-chat-share-v1b.sh.
// A, B, C = học sinh · T = Thầy. Mỗi người một browser context riêng (đăng nhập thật qua proxy).
// Luồng chính: BMS artifact → Gửi bạn bè → B thấy unread → mở Chat → thấy card → unread hết → bấm card → mở ĐÚNG artifact.
// Thêm: người lạ · artifact không có quyền · artifact bị gỡ · client V1a cũ · text trước/sau share · Feed entry · hết bạn · mobile 320…1440.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ORIGIN = `http://class.localhost:${V}`
const ME = `${ORIGIN}/me`
const ID = { A: 'aaaaaaaa-0000-4000-8000-00000000000a', B: 'bbbbbbbb-0000-4000-8000-00000000000b', C: 'cccccccc-0000-4000-8000-00000000000c', T: 'dddddddd-0000-4000-8000-00000000000d' }
const EMAIL = { A: 'a@test.local', B: 'b@test.local', C: 'c@test.local', T: 't@test.local' }
const NAME = { A: 'An', B: 'Bình', C: 'Chi Nguyễn Hoàng Bảo Ngọc Phương Thảo Minh Châu' }
const ART1 = 'a1111111-0000-4000-8000-000000000001', ART2 = 'a2222222-0000-4000-8000-000000000002', ARTP = 'a3333333-0000-4000-8000-000000000003'
const FALLBACK = 'Đã chia sẻ một nội dung', GONE = 'Nội dung này không còn khả dụng'
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
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource|googlevideo|youtube|ytimg/.test(m.text())) errors.push(`${who} console: ` + m.text()) })
  page.rpcs = []; page.msgResp = []
  page.on('request', r => {
    const m = r.url().match(/\/rest\/v1\/rpc\/(\w+)/)
    if (m && r.method() !== 'OPTIONS') { let body = {}; try { body = JSON.parse(r.postData() ?? '{}') } catch { /* GET */ } page.rpcs.push({ fn: m[1], body }) }
  })
  page.on('response', async r => {
    if (/\/rest\/v1\/rpc\/dm_messages/.test(r.url()) && r.request().method() === 'POST') { try { page.msgResp.push(await r.json()) } catch { /* điều hướng */ } }
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
const waitFor = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 15000 }, ...args)
const calls = (page, fn) => page.rpcs.filter(r => r.fn === fn)
async function clickText(page, label, scope = 'button') {
  const h = await page.waitForFunction((l, s) => [...document.querySelectorAll(s)].find(b => b.textContent.trim() === l && !b.disabled && b.offsetParent !== null),
    { timeout: 12000 }, label, scope)
  await h.asElement().click()
}
const noOverflow = async (page, what) => { const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })); assert.ok(o.sw <= o.iw + 1, `${what}: tràn ngang ${o.sw} > ${o.iw}`) }
const convId = page => (page.url().match(new RegExp(`/me/chat/(${UUID.source})`)) ?? [])[1]
async function chat(page) {
  await page.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-chat', { timeout: 15000 })
  await waitFor(page, () => !document.querySelector('.cs-chat-list .cs-skeleton'))
}
async function openArtifact(page, id) {
  await page.goto(`${ORIGIN}/song-builder?artifact=${id}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.bms-artifact-banner, .bms-artifact-msg', { timeout: 20000 })
}
const sheet = page => page.waitForSelector('[role=dialog]', { timeout: 10000 })
const sheetFriends = page => page.$$eval('[role=dialog] [role=radio]', es => es.map(e => e.querySelector('span:last-child').textContent.trim()))
const cardsOf = (page, scope = '.cs-chat-scroll') => page.$$eval(`${scope} .cs-share-card`, es => es.map(e => ({
  text: e.textContent.trim(), href: e.getAttribute('href'), gone: e.classList.contains('is-unavailable'), loading: e.classList.contains('is-loading'), mine: !!e.closest('.is-mine'),
})))
const settled = (page, n) => waitFor(page, k => { const c = [...document.querySelectorAll('.cs-chat-scroll .cs-share-card')]; return c.length === k && c.every(x => !x.classList.contains('is-loading')) }, n)

try {
  const A = await open('A'), B = await open('B', 1280, 900), C = await open('C'), T = await open('T', 1280, 900)

  // ── 1. A: BMS artifact → Gửi bạn bè → chọn B → gửi (bấm đúp = MỘT lần) ──
  await openArtifact(A, ART1)
  assert.match(await A.$eval('.bms-artifact-banner', e => e.textContent), /Bài của bạn/)
  assert.equal(await A.$$eval('.bms-artifact-share', es => es.length), 1, 'có nút "Chia sẻ" trên trang artifact')
  await A.click('.bms-artifact-share')
  await sheet(A)
  await waitFor(A, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  const names = (await sheetFriends(A)).sort()
  assert.deepEqual(names, [NAME.B, NAME.C].sort(), 'chỉ bạn bè accepted (không có Thầy / người lạ)')
  assert.equal(await A.$$eval('[role=dialog] textarea, [role=dialog] input', es => es.length), 0, 'ít bạn → không có ô tìm; TUYỆT ĐỐI không có ô ghi chú')
  const sendLabel = () => A.$$eval('[role=dialog] button', es => es.map(e => e.textContent.trim()).find(t => /^(Gửi cho|Chọn một người|Đang gửi)/.test(t)))
  assert.equal(await sendLabel(), 'Chọn một người bạn')
  assert.equal(await A.$$eval('[role=dialog] button', es => es.find(e => e.textContent.trim() === 'Chọn một người bạn').disabled), true, 'chưa chọn → khoá Gửi')
  await A.screenshot({ path: `${SHOTS}/share-sheet-390.png` })
  await A.evaluate(n => [...document.querySelectorAll('[role=dialog] [role=radio]')].find(e => e.querySelector('span:last-child').textContent.trim() === n).click(), NAME.B)
  assert.equal(await sendLabel(), `Gửi cho ${NAME.B}`)
  await A.evaluate(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho')); b.click(); b.click() })
  await waitFor(A, () => document.querySelector('[role=dialog] [role=status]')?.textContent === 'Đã gửi cho Bình')
  const sh = calls(A, 'dm_share')
  assert.equal(sh.length, 1, 'bấm đúp vẫn CHỈ MỘT dm_share')
  assert.deepEqual(Object.keys(sh[0].body).sort(), ['p_ref_key', 'p_ref_type', 'p_user'], 'chỉ gửi người + loại + khoá (không body/ghi chú)')
  assert.deepEqual([sh[0].body.p_user, sh[0].body.p_ref_type, sh[0].body.p_ref_key], [ID.B, 'tool_artifact', ART1])
  assert.equal(calls(A, 'dm_start').length + calls(A, 'dm_send').length, 0, 'share KHÔNG đi qua đường text')
  assert.ok(await A.$$eval('[role=dialog] a', es => es.some(e => e.textContent.trim() === 'Mở cuộc trò chuyện')), 'có hành động phụ "Mở cuộc trò chuyện"')
  ok('1 A: trang BMS artifact → "Gửi bạn bè" → chỉ bạn accepted, KHÔNG có ô ghi chú → chọn Bình → Gửi (bấm đúp = 1 dm_share, chỉ gửi tham chiếu) → "Đã gửi cho Bình" + "Mở cuộc trò chuyện"')

  // ── 2. B (desktop): thấy unread → mở Chat → thấy card → unread hết ──
  await B.goto(ME, { waitUntil: 'networkidle0' })
  await waitFor(B, () => [...document.querySelectorAll('.cs-sidebar .cs-nav-item')].find(i => i.textContent.includes('Trò chuyện'))?.querySelector('.cs-nav-badge')?.textContent === '1')
  await chat(B)
  const bi = await B.$$eval('.cs-chat-item', es => es.map(e => [e.querySelector('.cs-chat-item-name').textContent, e.querySelector('.cs-chat-item-preview').textContent, e.querySelector('.cs-nav-badge')?.textContent]))
  assert.deepEqual(bi, [[NAME.A, FALLBACK, '1']], 'preview danh sách = fallback cố định; badge 1')
  await B.click('.cs-chat-item')
  await waitFor(B, () => document.querySelector('.cs-chat-scroll .cs-share-card'))
  await settled(B, 1)
  const CONV_AB = convId(B)
  const [card1] = await cardsOf(B)
  assert.ok(card1.href === `/song-builder?artifact=${ART1}` && !card1.gone && !card1.mine, JSON.stringify(card1))
  assert.match(card1.text, /BMS · Dựng bài hát/); assert.match(card1.text, /Có Chàng Trai Viết Lên Cây/); assert.match(card1.text, /76 BPM · 4\/4 · 3 hợp âm/); assert.match(card1.text, /Luyện bài này/)
  assert.equal(UUID.test(card1.text) || /https?:|tool_artifact|\{/.test(card1.text), false, 'card không hiện URL/id/JSON')
  assert.equal(await B.$$eval('.cs-chat-scroll .cs-msg-bubble', es => es.length), 0, 'tin share là card, không phải bong bóng text')
  assert.equal(await B.$eval('.cs-chat-scroll img.cs-share-thumb', e => e.getAttribute('src')), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
  await waitFor(B, () => ![...document.querySelectorAll('.cs-sidebar .cs-nav-item')].find(i => i.textContent.includes('Trò chuyện'))?.querySelector('.cs-nav-badge'))
  assert.ok(calls(B, 'dm_mark_read').length >= 1, 'đọc tới tin share → dm_mark_read')
  assert.ok(calls(B, 'dm_conversations').length >= 1)
  await B.screenshot({ path: `${SHOTS}/share-desktop-1280.png` })
  ok('2 B: badge 1 + preview "Đã chia sẻ một nội dung" → mở hội thoại → CARD (loại · tên · BPM/nhịp/hợp âm · ảnh · Luyện bài này), không URL thô → badge hết, dm_mark_read')

  // ── 3. A: "Mở cuộc trò chuyện" → card bên PHẢI; text trước/sau share nguyên vẹn, hai phía ──
  await A.evaluate(() => [...document.querySelectorAll('[role=dialog] a')].find(e => e.textContent.trim() === 'Mở cuộc trò chuyện').click())
  await waitFor(A, id => location.pathname === `/me/chat/${id}` && document.querySelector('.cs-chat-input'), CONV_AB)
  await settled(A, 1)
  assert.equal((await cardsOf(A))[0].mine, true, 'người gửi thấy card bên phải')
  await A.click('.cs-chat-input'); await A.type('.cs-chat-input', 'Bài này hay lắm'); await A.click('.cs-chat-send')
  await waitFor(B, () => [...document.querySelectorAll('.cs-msg-row.is-theirs .cs-msg-bubble')].some(b => b.textContent === 'Bài này hay lắm'))
  await B.click('.cs-chat-input'); await B.type('.cs-chat-input', 'Cảm ơn An'); await B.keyboard.press('Enter')
  await waitFor(A, () => [...document.querySelectorAll('.cs-msg-row.is-theirs .cs-msg-bubble')].some(b => b.textContent === 'Cảm ơn An'))
  const order = await A.$$eval('.cs-chat-scroll .cs-msg-row', es => es.map(e => e.querySelector('.cs-share-card') ? 'CARD' : e.querySelector('.cs-msg-bubble')?.textContent))
  assert.deepEqual(order, ['CARD', 'Bài này hay lắm', 'Cảm ơn An'], 'cùng timeline: card rồi text, đúng thứ tự seq')
  ok('3 A mở hội thoại từ sheet: card bên phải; text sau share ở cả hai phía (polling), thứ tự CARD → text → text')

  // ── 4. B bấm card → mở ĐÚNG artifact ──
  await B.click('.cs-chat-scroll a.cs-share-card')
  await waitFor(B, id => location.pathname === '/song-builder' && location.search === `?artifact=${id}`, ART1)
  await B.waitForSelector('.bms-artifact-banner', { timeout: 20000 })
  assert.match(await B.$eval('.bms-artifact-banner', e => e.textContent), /Bài chia sẻ · chỉ luyện/)
  assert.equal(await B.$('.bms-artifact-msg'), null, 'không phải trạng thái lỗi/không có quyền')
  ok('4 B bấm card → /song-builder?artifact=<ART1> mở đúng bài ở chế độ chỉ luyện ("Bài chia sẻ · chỉ luyện, không sửa bài gốc")')

  // ── 5. Người lạ (C không là bạn B): thấy bạn của MÌNH; không chen vào hội thoại A–B ──
  await openArtifact(C, ART1)
  assert.match(await C.$eval('.bms-artifact-banner', e => e.textContent), /Bài chia sẻ/, 'C đọc được artifact class-visible')
  await C.click('.bms-artifact-share'); await sheet(C)
  await waitFor(C, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  assert.deepEqual(await sheetFriends(C), [NAME.A], 'C chỉ chọn được bạn của mình (An) — Bình không có trong danh sách')
  await C.keyboard.press('Escape')
  await waitFor(C, () => !document.querySelector('[role=dialog]'))
  await C.goto(`${ME}/chat/${CONV_AB}`, { waitUntil: 'networkidle0' })
  await C.waitForSelector('.cs-chat-body-state p', { timeout: 15000 })
  assert.match(await C.$eval('.cs-chat-body-state', e => e.textContent), /Không tìm thấy cuộc trò chuyện này/)
  assert.equal(await C.$('.cs-share-card'), null, 'C không thấy card trong hội thoại A–B')
  assert.equal(calls(C, 'dm_share').length, 0)
  ok('5 người lạ C: sheet chỉ liệt kê bạn của C (không có Bình); hội thoại A–B ≡ không tồn tại, không lộ card')

  // ── 6. Artifact KHÔNG có quyền: A–C có sẵn tin share tới bài riêng của C → card không khả dụng, message còn nguyên ──
  await chat(A)
  await A.evaluate(n => [...document.querySelectorAll('.cs-chat-item')].find(e => e.querySelector('.cs-chat-item-name').textContent === n).click(), NAME.C)
  await waitFor(A, () => document.querySelectorAll('.cs-chat-scroll .cs-msg-row').length >= 3)
  await settled(A, 1)
  const priv = (await cardsOf(A))[0]
  assert.deepEqual([priv.gone, priv.href, priv.text], [true, null, GONE], JSON.stringify(priv))
  assert.deepEqual(await A.$$eval('.cs-chat-scroll .cs-msg-bubble', es => es.map(e => e.textContent)), ['Xin chào An', 'Bài đó hay lắm'], 'text trước/sau share nguyên vẹn')
  assert.equal(await A.$eval('.cs-chat-scroll .cs-share-card', (e, id) => e.outerHTML.includes(id), ARTP), false, 'không rò id artifact trong DOM của card')
  ok('6 artifact private của C (A không có quyền): giữ nguyên tin, card "Nội dung này không còn khả dụng", không link, không rò id; text trước/sau nguyên vẹn')

  // ── 7. Entry point Feed: B bấm "Gửi bạn bè" trên card BMS → An ──
  await B.goto(ME, { waitUntil: 'networkidle0' })
  await B.waitForSelector('.cs-tool-share', { timeout: 15000 })
  const feedBtn = await B.$$eval('.cs-tool-share', es => es.map(e => ({ title: e.querySelector('.cs-tool-share-headline')?.textContent, btns: [...e.querySelectorAll('button')].map(b => b.textContent.trim()) })))
  assert.ok(feedBtn.some(c => c.title === 'Bài trên Feed của An' && c.btns.includes('Chia sẻ')), JSON.stringify(feedBtn))
  const feedArt = await B.$$eval('.cs-tool-share', es => es.find(e => e.querySelector('.cs-tool-share-headline')?.textContent === 'Bài trên Feed của An').querySelector('a').getAttribute('href').split('=')[1])
  await B.evaluate(() => [...document.querySelectorAll('.cs-tool-share')].find(e => e.querySelector('.cs-tool-share-headline')?.textContent === 'Bài trên Feed của An').querySelector('button').click())
  await sheet(B)
  await waitFor(B, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  assert.deepEqual(await sheetFriends(B), [NAME.A])
  await B.evaluate(() => document.querySelector('[role=dialog] [role=radio]').click())
  await B.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho')).click())
  await waitFor(B, () => document.querySelector('[role=dialog] [role=status]')?.textContent === 'Đã gửi cho An')
  assert.deepEqual([calls(B, 'dm_share')[0].body.p_ref_key, calls(B, 'dm_share')[0].body.p_user], [feedArt, ID.A])
  await B.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.trim() === 'Xong').click())
  await waitFor(B, () => !document.querySelector('[role=dialog]'))
  await waitFor(A, () => document.querySelectorAll('.cs-chat-scroll .cs-share-card').length >= 1 || true)
  ok('7 Feed: card BMS có "Chia sẻ" (mở thẳng chọn bạn) → chọn An → dm_share đúng artifact của card; "Xong" đóng sheet, không bắt buộc chuyển trang')

  // ── 8. Artifact bị GỠ sau khi share: tin còn, card chuyển "không còn khả dụng" ──
  await openArtifact(A, ART2)
  await A.click('.bms-artifact-share'); await sheet(A)
  await waitFor(A, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  await A.evaluate(n => [...document.querySelectorAll('[role=dialog] [role=radio]')].find(e => e.querySelector('span:last-child').textContent.trim() === n).click(), NAME.B)
  await A.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho')).click())
  await waitFor(A, () => document.querySelector('[role=dialog] [role=status]'))
  await A.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.trim() === 'Xong').click())
  await clickText(A, 'Gỡ chia sẻ', '.bms-artifact-banner button'); await clickText(A, 'Xác nhận gỡ', '.bms-artifact-banner button')
  await waitFor(A, () => document.querySelector('.bms-artifact-msg')?.textContent.includes('không còn được chia sẻ'))
  await B.goto(`${ME}/chat/${CONV_AB}`, { waitUntil: 'networkidle0' })
  await waitFor(B, () => document.querySelectorAll('.cs-chat-scroll .cs-share-card').length === 3)
  await settled(B, 3)
  const bc = await cardsOf(B)
  assert.equal(bc.filter(c => c.gone).length, 1, 'đúng 1 card không khả dụng (bài đã gỡ)')
  assert.equal(bc.filter(c => !c.gone && c.href === `/song-builder?artifact=${ART1}`).length, 1, 'card ART1 vẫn mở được')
  assert.equal(bc.filter(c => c.gone)[0].text, GONE)
  ok('8 artifact bị chủ GỠ: tin share vẫn nằm trong hội thoại, card "Nội dung này không còn khả dụng"; card khác không ảnh hưởng')

  // ── 9. Client V1a cũ gặp tin share: đọc dm_messages thật qua đúng cách ánh xạ của V1a ──
  const v1a = rows => rows.filter(r => r?.seq != null).map(r => ({ seq: Number(r.seq), mine: r.mine === true, body: r.body ?? '', at: r.created_at ?? '' })).sort((a, b) => a.seq - b.seq)
  const resp = B.msgResp.flat().filter(r => r.ref_type)
  assert.ok(resp.length >= 1, 'RPC thật trả tin share')
  const legacy = v1a(resp)
  assert.ok(legacy.every(m => m.body === FALLBACK), 'V1a cũ hiện tin share như bong bóng text "Đã chia sẻ một nội dung"')
  assert.ok(Object.keys(resp[0]).includes('seq') && Object.keys(resp[0]).includes('body'), 'các cột V1a vẫn còn nguyên tên/kiểu')
  ok('9 client V1a cũ: cột V1a giữ nguyên + body cố định "Đã chia sẻ một nội dung" → hiện như text, không lỗi')

  // ── 10. Hết bạn: hội thoại + card vẫn đọc được; không share mới ──
  await A.goto(`${ME}/u/${ID.B}`, { waitUntil: 'networkidle0' })
  await A.waitForSelector('.cs-rel-btn')
  await A.click('.cs-rel-btn')
  await clickText(A, 'Huỷ kết bạn', '.cs-rel-menu button'); await clickText(A, 'Huỷ kết bạn', '.cs-confirm button')
  await waitFor(A, () => document.querySelector('.cs-rel-btn')?.textContent.trim() === 'Kết bạn')
  await A.goto(`${ME}/chat/${CONV_AB}`, { waitUntil: 'networkidle0' })
  await A.waitForSelector('.cs-chat-locked', { timeout: 15000 })
  await settled(A, 3)
  assert.equal((await cardsOf(A)).length, 3, 'hết bạn: lịch sử + card vẫn đọc được')
  await openArtifact(B, ART1)
  await B.click('.bms-artifact-share'); await sheet(B)
  await waitFor(B, () => /chưa có bạn bè/.test(document.querySelector('[role=dialog]').textContent))
  assert.equal(await B.$$eval('[role=dialog] [role=radio]', es => es.length), 0, 'B hết bạn → không còn ai để chọn')
  await B.keyboard.press('Escape')
  ok('10 hết bạn: lịch sử + card vẫn đọc/mở được; sheet không còn người nhận (không share mới)')

  // ── 11. Ma trận kích thước: card trong hội thoại + sheet ──
  for (const [w, h] of [[320, 640], [360, 740], [390, 844], [430, 932], [1120, 800], [1280, 900], [1440, 900]]) {
    await A.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600 })
    await A.goto(`${ME}/chat/${CONV_AB}`, { waitUntil: 'networkidle0' })
    await A.waitForSelector('.cs-chat-scroll', { timeout: 15000 })
    await settled(A, 3)
    const g = await A.evaluate(() => {
      const sc = document.querySelector('.cs-chat-scroll'), cs = [...document.querySelectorAll('.cs-share-card')].map(c => c.getBoundingClientRect())
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, scO: sc.scrollWidth > sc.clientWidth + 1, inView: cs.every(r => r.left >= 0 && r.right <= innerWidth), maxW: Math.round(Math.max(...cs.map(r => r.width))), n: cs.length }
    })
    assert.ok(g.sw <= g.iw + 1 && !g.scO && g.inView && g.maxW <= 300 + 1 && g.n === 3, `${w}: ${JSON.stringify(g)}`)
    if (w === 320 || w === 1120) await A.screenshot({ path: `${SHOTS}/share-conv-${w}.png` })
  }
  await A.setViewport({ width: 320, height: 568, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  await openArtifact(C, ART1)
  await C.setViewport({ width: 320, height: 568, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  await C.click('.bms-artifact-share'); await sheet(C)
  await waitFor(C, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  await C.evaluate(() => document.querySelector('[role=dialog] [role=radio]').click())
  const geo = await C.evaluate(() => { const d = document.querySelector('[role=dialog]').getBoundingClientRect(), b = [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho')).getBoundingClientRect()
    return { l: d.left, r: d.right, t: d.top, b: d.bottom, iw: innerWidth, ih: innerHeight, bb: b.bottom, bl: b.left, br: b.right } })
  assert.ok(geo.l >= 0 && geo.r <= geo.iw && geo.t >= 0 && geo.b <= geo.ih + 1 && geo.bb <= geo.ih && geo.bl >= 0 && geo.br <= geo.iw, JSON.stringify(geo))
  await C.screenshot({ path: `${SHOTS}/share-sheet-320.png` })
  ok('11 ma trận 320/360/390/430/1120/1280/1440: card trong hội thoại không tràn (≤300px, trong màn hình); sheet 320×568 nằm trọn trong màn hình, nút Gửi chạm được')

  assert.deepEqual(errors, [], 'lỗi trang/console')
  ok('không lỗi trang / console')
  console.log(`CHAT V1b E2E: ${pass} PASS`)
} catch (e) {
  console.error('FAIL:', e.message)
  console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
