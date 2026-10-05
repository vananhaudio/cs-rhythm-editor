// E2E Friends UX V2 trong Chrome thật — xem scripts/e2e-friends-v2.sh.
// A, B, C (tên rất dài) = học sinh · T = Thầy. Mỗi người một browser context riêng (đăng nhập thật qua proxy).
// Phủ: gửi / thấy incoming + outgoing / xác nhận / huỷ lời mời (trang cá nhân + trang Bạn bè) / Xóa lời mời (hai nơi) /
// gửi lại / Huỷ kết bạn có xác nhận (Huỷ → không gọi RPC; xác nhận → xoá) ở hai nơi / đăng nhập lại / mobile 390 + desktop.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ME = `http://class.localhost:${V}/me`
const ID = { A: 'aaaaaaaa-0000-4000-8000-00000000000a', B: 'bbbbbbbb-0000-4000-8000-00000000000b', C: 'cccccccc-0000-4000-8000-00000000000c', T: 'dddddddd-0000-4000-8000-00000000000d' }
const EMAIL = { A: 'a@test.local', B: 'b@test.local', C: 'c@test.local', T: 't@test.local' }
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
})
let pass = 0
const ok = msg => { pass++; console.log('PASS: ' + msg) }
const errors = []

async function open(who, width = 390) {
  let ctx
  for (let i = 0; ; i++) { try { ctx = await browser.createBrowserContext(); break } catch (e) { if (i > 2) throw e; await new Promise(r => setTimeout(r, 300)) } }
  const page = await ctx.newPage()
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push(`${who} pageerror: ` + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource/.test(m.text())) errors.push(`${who} console: ` + m.text()) })
  page.rpcs = []
  page.on('request', r => { const m = r.url().match(/\/rest\/v1\/rpc\/(\w+)/); if (m && r.method() !== 'OPTIONS') page.rpcs.push(m[1]) })   // bỏ preflight CORS
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', EMAIL[who])
  await page.type('#cs-login-pass', 'e2e')
  await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  page.ctx = ctx
  return page
}
async function clickText(page, label, scope = 'button') {
  const h = await page.waitForFunction((l, s) => [...document.querySelectorAll(s)].find(b => b.textContent.trim() === l && !b.disabled && b.offsetParent !== null),
    { timeout: 10000 }, label, scope)
  await h.asElement().click()
}
const waitFor = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 10000 }, ...args)

// ── Trang cá nhân ──
async function profile(page, who) {
  await page.goto(`${ME}/u/${ID[who]}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-identity-name', { timeout: 15000 })
}
const relLabel = page => page.$eval('.cs-rel-btn', e => e.textContent.trim()).catch(() => null)
async function waitRel(page, label) {
  await waitFor(page, l => document.querySelector('.cs-rel-btn')?.textContent.trim() === l && !document.querySelector('.cs-rel-btn').disabled, label)
}
async function relMenu(page, item) {
  await page.click('.cs-rel-btn')
  await clickText(page, item, '.cs-rel-menu button')
}
// Menu quan hệ: mỗi mục thật sự nhìn thấy/bấm được (elementFromPoint trúng chính nó — không bị thẻ hồ sơ cắt/che)
const menuVisible = () => {
  const b = document.querySelector('.cs-rel-btn').getBoundingClientRect(), menu = document.querySelector('.cs-rel-menu').getBoundingClientRect()
  const items = [...document.querySelectorAll('.cs-rel-menu .cs-more-item')].map(it => {
    const r = it.getBoundingClientRect()
    return { t: it.textContent, h: Math.round(r.height), hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === it }
  })
  return { bh: b.height, btnBottom: Math.round(b.bottom), top: Math.round(menu.top), sheet: Math.round(menu.bottom) === innerHeight && Math.round(menu.width) === innerWidth,
    items, iw: innerWidth, sw: document.documentElement.scrollWidth }
}
const notice = page => page.$eval('.cs-rel-notice', e => e.textContent.trim()).catch(() => null)
async function waitNotice(page, text) { await waitFor(page, t => document.querySelector('.cs-rel-notice')?.textContent.trim() === t, text) }

// ── Trang Bạn bè ──
async function friendsPage(page) {
  await page.goto(`${ME}/friends`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-fr-title', { timeout: 15000 })
  await waitFor(page, () => !document.querySelector('.cs-friends-page .cs-skeleton'))
}
const SEC = { incoming: 'cs-req-title', outgoing: 'cs-out-title', friends: 'cs-fr-title' }
const rows = (page, sec) => page.evaluate(s =>
  [...document.querySelectorAll(`section[aria-labelledby="${s}"] .cs-person`)].map(li => li.querySelector('.cs-person-link')?.getAttribute('aria-label')?.replace('Trang cá nhân của ', '')), SEC[sec])
const NAME = { A: 'An', B: 'Bình', C: 'Chi Nguyễn Hoàng Bảo Ngọc Phương Thảo Minh Châu', T: 'Thầy Văn Anh' }
async function waitRows(page, sec, whos) {
  const want = whos.map(w => NAME[w]).sort()
  await waitFor(page, (s, w) => JSON.stringify([...document.querySelectorAll(`section[aria-labelledby="${s}"] .cs-person .cs-person-link`)]
    .map(e => e.getAttribute('aria-label').replace('Trang cá nhân của ', '')).sort()) === JSON.stringify(w), SEC[sec], want)
}
const rowButton = (page, sec, who, label) => clickText(page, label, `section[aria-labelledby="${SEC[sec]}"] .cs-person button[aria-label$="${NAME[who]}"]`)

try {
  const A = await open('A'), B = await open('B'), C = await open('C')

  // ── 1. A → B gửi: nút đổi NGAY sang OUTGOING + câu báo; A thấy outgoing, B thấy incoming ──
  await profile(A, 'B')
  assert.equal(await relLabel(A), 'Kết bạn')
  await clickText(A, 'Kết bạn', '.cs-rel-btn')
  await waitRel(A, 'Đã gửi lời mời')
  assert.equal(await notice(A), 'Đã gửi lời mời — chờ người kia chấp nhận.')
  assert.equal(A.url(), `${ME}/u/${ID.B}`)
  ok('1 A bấm Kết bạn → nút "Đã gửi lời mời" ngay (không reload) + "Đã gửi lời mời — chờ người kia chấp nhận."')
  assert.match(await A.$eval('.cs-wall-locked', e => e.textContent), /Khi Bình chấp nhận lời mời/)
  ok('1 PENDING ≠ FRIENDS: tường B vẫn khoá với A')
  await friendsPage(A)
  await waitRows(A, 'outgoing', ['B'])
  assert.deepEqual(await rows(A, 'incoming'), [])
  assert.deepEqual(await rows(A, 'friends'), [])
  assert.match(await A.$eval('section[aria-labelledby="cs-out-title"] .cs-person-sub', e => e.textContent), /^Đã gửi lời mời/)
  ok('1 A /me/friends: B trong "Lời mời đã gửi" ("Đã gửi lời mời"), chưa có bạn bè')
  await friendsPage(B)
  await waitRows(B, 'incoming', ['A'])
  assert.deepEqual(await rows(B, 'outgoing'), [])
  assert.match(await B.$eval('.cs-nav-badge', e => e.textContent), /^1$/)
  ok('1 B /me/friends: A trong "Lời mời kết bạn" (+ badge 1); B không có lời mời đã gửi')
  await profile(B, 'A')
  assert.equal(await relLabel(B), 'Phản hồi lời mời')
  assert.match(await B.$eval('.cs-rel-status', e => e.textContent), /An đã gửi cho bạn lời mời kết bạn/)
  ok('1 hồ sơ A nhìn từ B: [Phản hồi lời mời]')

  // ── 2. B Xác nhận trên trang Bạn bè: A vào bạn bè NGAY; lời mời biến mất hai phía ──
  await friendsPage(B)
  await rowButton(B, 'incoming', 'A', 'Xác nhận')
  await waitRows(B, 'friends', ['A'])
  await waitFor(B, () => !document.querySelector('#cs-req-title'))
  await waitNotice(B, 'Bạn và An đã là bạn bè.')
  assert.equal(await B.$('.cs-nav-badge'), null)
  ok('2 B Xác nhận → A vào "Tất cả bạn bè" ngay, mục lời mời + badge biến mất, câu báo')
  await A.ctx.close()
  const A2 = await open('A')   // đăng xuất/đăng nhập lại = phiên mới đọc từ DB
  await friendsPage(A2)
  await waitRows(A2, 'friends', ['B'])
  assert.equal(await A2.$('#cs-out-title'), null)
  ok('2 A đăng nhập lại: B trong bạn bè, "Lời mời đã gửi" biến mất')
  await profile(A2, 'B')
  assert.equal(await relLabel(A2), 'Bạn bè')
  await A2.waitForSelector('#cs-wall-title')
  ok('2 hồ sơ B nhìn từ A: [Bạn bè] + xem được tường')
  await B.reload({ waitUntil: 'networkidle0' }); await waitRows(B, 'friends', ['A'])
  ok('2 B refresh: A vẫn là bạn')

  // ── 3. A → C gửi, huỷ trên TRANG CÁ NHÂN; gửi lại, huỷ trên TRANG BẠN BÈ ──
  await profile(A2, 'C')
  await clickText(A2, 'Kết bạn', '.cs-rel-btn'); await waitRel(A2, 'Đã gửi lời mời')
  await relMenu(A2, 'Huỷ lời mời')
  await waitRel(A2, 'Kết bạn')
  assert.equal(await notice(A2), 'Đã huỷ lời mời.')
  ok('3 A huỷ lời mời từ trang cá nhân C → nút về "Kết bạn" ngay')
  await friendsPage(C)
  assert.equal(await C.$('#cs-req-title'), null)
  ok('3 C không còn lời mời của A')
  await profile(A2, 'C')
  await clickText(A2, 'Kết bạn', '.cs-rel-btn'); await waitRel(A2, 'Đã gửi lời mời')
  ok('3 A gửi lại được cho C')
  await friendsPage(C); await waitRows(C, 'incoming', ['A'])
  await friendsPage(A2); await waitRows(A2, 'outgoing', ['C'])
  await rowButton(A2, 'outgoing', 'C', 'Huỷ lời mời')
  await waitFor(A2, () => !document.querySelector('#cs-out-title'))
  await waitNotice(A2, `Đã huỷ lời mời gửi ${NAME.C}.`)
  ok('3 A huỷ lời mời từ trang Bạn bè → dòng biến mất ngay')
  await friendsPage(C)
  assert.equal(await C.$('#cs-req-title'), null)
  await profile(C, 'A'); assert.equal(await relLabel(C), 'Kết bạn')
  ok('3 C: không còn incoming, hồ sơ A = "Kết bạn"')

  // ── 4. C → A gửi; A Xóa (trang Bạn bè); biến mất hai phía; C gửi lại; A Xóa (trang cá nhân) ──
  await clickText(C, 'Kết bạn', '.cs-rel-btn'); await waitRel(C, 'Đã gửi lời mời')
  await friendsPage(A2); await waitRows(A2, 'incoming', ['C'])
  await rowButton(A2, 'incoming', 'C', 'Xóa')
  await waitFor(A2, () => !document.querySelector('#cs-req-title'))
  await waitNotice(A2, 'Đã xoá lời mời.')
  assert.deepEqual(await rows(A2, 'friends'), [NAME.B])
  ok('4 A Xóa lời mời của C → dòng biến mất ngay, bạn bè không đổi')
  await profile(C, 'A')
  assert.equal(await relLabel(C), 'Kết bạn')
  await friendsPage(C); assert.equal(await C.$('#cs-out-title'), null)
  ok('4 C: hồ sơ A về "Kết bạn", "Lời mời đã gửi" trống (biến mất đúng hai phía, như Facebook)')
  await profile(C, 'A'); await clickText(C, 'Kết bạn', '.cs-rel-btn'); await waitRel(C, 'Đã gửi lời mời')
  ok('4 C gửi lại được sau khi bị Xóa')
  await profile(A2, 'C')
  assert.equal(await relLabel(A2), 'Phản hồi lời mời')
  await relMenu(A2, 'Xóa lời mời')
  await waitRel(A2, 'Kết bạn')
  assert.equal(await notice(A2), 'Đã xoá lời mời.')
  ok('4 A Xóa lời mời từ trang cá nhân C ([Phản hồi lời mời] → Xóa lời mời) → "Kết bạn"')

  // ── 5. Mobile 390: đủ 3 mục cùng lúc (T mời A · A mời C tên dài · A–B bạn) ──
  const T = await open('T')
  await profile(T, 'A'); await clickText(T, 'Kết bạn', '.cs-rel-btn'); await waitRel(T, 'Đã gửi lời mời')
  await profile(A2, 'C'); await clickText(A2, 'Kết bạn', '.cs-rel-btn'); await waitRel(A2, 'Đã gửi lời mời')
  await friendsPage(A2)
  await waitRows(A2, 'incoming', ['T']); await waitRows(A2, 'outgoing', ['C']); await waitRows(A2, 'friends', ['B'])
  const titles = await A2.$$eval('.cs-friends-title', es => es.map(e => e.childNodes[0].textContent))
  assert.deepEqual(titles, ['Lời mời kết bạn', 'Lời mời đã gửi', 'Tất cả bạn bè'])
  const lay = await A2.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    avatars: [...document.querySelectorAll('.cs-friends-page .cs-person .cs-avatar')].map(a => { const r = a.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] }),
    buttons: [...document.querySelectorAll('.cs-friends-page .cs-person button.cs-btn, .cs-friends-page .cs-more-btn')].map(b => { const r = b.getBoundingClientRect(); return [b.textContent.trim(), Math.round(r.height), Math.round(r.right)] }),
    longName: (() => { const n = [...document.querySelectorAll('.cs-person-name')].find(e => e.textContent.startsWith('Chi Nguyễn')); const r = n.getBoundingClientRect(); return [Math.round(r.right), n.scrollWidth <= n.clientWidth + 1] })(),
  }))
  assert.ok(lay.sw <= lay.iw + 1, `tràn ngang ${lay.sw} > ${lay.iw}`)
  assert.ok(lay.avatars.length === 3 && lay.avatars.every(([w, h]) => w === 48 && h === 48), 'avatar tròn 48×48: ' + JSON.stringify(lay.avatars))
  assert.ok(lay.buttons.every(([, h, r]) => h >= 40 && r <= lay.iw), 'nút ≥40px, trong khung: ' + JSON.stringify(lay.buttons))
  assert.ok(lay.longName[0] <= lay.iw && lay.longName[1], 'tên dài xuống dòng, không tràn: ' + JSON.stringify(lay.longName))
  ok(`5 mobile 390: 3 mục đúng thứ tự, không tràn ngang, avatar 48×48 không méo, ${lay.buttons.length} nút cao ≥40px, tên rất dài xuống dòng`)
  await A2.screenshot({ path: `${SHOTS}/friends-v2-mobile-390.png`, fullPage: true })
  // Hồ sơ trên mobile: nút quan hệ rộng hết cột, menu nằm trong màn hình
  await profile(A2, 'B')
  await A2.click('.cs-rel-btn'); await A2.waitForSelector('.cs-rel-menu')
  const m = await A2.evaluate(menuVisible)
  assert.ok(m.bh >= 40 && m.items.every(i => i.hit && i.h >= 44) && m.sheet && m.sw <= m.iw + 1, JSON.stringify(m))
  await A2.screenshot({ path: `${SHOTS}/friends-v2-profile-menu-390.png` })
  await A2.keyboard.press('Escape'); await waitFor(A2, () => !document.querySelector('.cs-rel-menu'))
  ok('5 mobile: nút [Bạn bè ▾] cao ≥40px; menu = action sheet đáy màn hình, mục cao ≥44px, KHÔNG bị thẻ hồ sơ che; Esc đóng')
  await T.ctx.close()

  // ── 6. Huỷ kết bạn trên TRANG BẠN BÈ: Huỷ → không gọi RPC; xác nhận → xoá, hai phía hết bạn ──
  await friendsPage(A2)
  A2.rpcs.length = 0
  await A2.click(`section[aria-labelledby="cs-fr-title"] .cs-more-btn`)
  await clickText(A2, 'Huỷ kết bạn', '.cs-more-item')
  await A2.waitForSelector('.cs-confirm')
  assert.equal(await A2.$eval('.cs-confirm h2', e => e.textContent), 'Huỷ kết bạn với Bình?')
  assert.deepEqual(await A2.$$eval('.cs-confirm button', bs => bs.map(b => b.textContent.trim())), ['Huỷ', 'Huỷ kết bạn'])
  assert.equal(await A2.evaluate(() => document.activeElement?.textContent.trim()), 'Huỷ', 'focus vào nút Huỷ')
  await A2.screenshot({ path: `${SHOTS}/friends-v2-confirm-390.png` })
  ok('6 bấm Huỷ kết bạn → hộp xác nhận "Huỷ kết bạn với Bình?" [Huỷ] [Huỷ kết bạn], focus ở Huỷ')
  await clickText(A2, 'Huỷ', '.cs-confirm button')
  await waitFor(A2, () => !document.querySelector('.cs-confirm'))
  assert.equal(A2.rpcs.includes('unfriend'), false, 'Huỷ không được gọi RPC unfriend')
  assert.deepEqual(await rows(A2, 'friends'), [NAME.B])
  ok('6 bấm Huỷ trong hộp → đóng, KHÔNG gọi RPC unfriend, Bình vẫn là bạn')
  await A2.click(`section[aria-labelledby="cs-fr-title"] .cs-more-btn`)
  await clickText(A2, 'Huỷ kết bạn', '.cs-more-item'); await A2.waitForSelector('.cs-confirm')
  await A2.keyboard.press('Escape'); await waitFor(A2, () => !document.querySelector('.cs-confirm'))
  assert.equal(A2.rpcs.includes('unfriend'), false)
  ok('6 Esc cũng đóng hộp, không gọi RPC')
  await A2.reload({ waitUntil: 'networkidle0' }); await waitRows(A2, 'friends', ['B'])
  ok('6 refresh: tình bạn A–B vẫn còn')
  await A2.click(`section[aria-labelledby="cs-fr-title"] .cs-more-btn`)
  await clickText(A2, 'Huỷ kết bạn', '.cs-more-item'); await A2.waitForSelector('.cs-confirm')
  await clickText(A2, 'Huỷ kết bạn', '.cs-confirm button')
  await waitFor(A2, () => !document.querySelector('.cs-confirm'))
  await waitRows(A2, 'friends', [])
  await waitNotice(A2, 'Đã huỷ kết bạn với Bình.')
  assert.equal(A2.rpcs.filter(r => r === 'unfriend').length, 1)
  ok('6 xác nhận → đúng 1 RPC unfriend, Bình biến mất ngay')
  await friendsPage(B); await waitRows(B, 'friends', [])
  await profile(B, 'A'); assert.equal(await relLabel(B), 'Kết bạn')
  await B.waitForSelector('.cs-wall-locked')
  ok('6 B: không còn A trong bạn bè, hồ sơ A = "Kết bạn", tường khoá')

  // ── 7. Huỷ kết bạn trên TRANG CÁ NHÂN (phía người NHẬN lời mời ban đầu), desktop 1280 ──
  await clickText(B, 'Kết bạn', '.cs-rel-btn'); await waitRel(B, 'Đã gửi lời mời')
  await profile(A2, 'B'); await relMenu(A2, 'Xác nhận'); await waitRel(A2, 'Bạn bè')
  assert.equal(await notice(A2), 'Bạn và Bình đã là bạn bè.')
  await A2.waitForSelector('#cs-wall-title')
  ok('7 A xác nhận từ trang cá nhân B ([Phản hồi lời mời] → Xác nhận) → [Bạn bè] + tường mở ngay')
  await A2.ctx.close()
  const A3 = await open('A', 1280)
  await profile(A3, 'B'); assert.equal(await relLabel(A3), 'Bạn bè')
  A3.rpcs.length = 0
  await A3.click('.cs-rel-btn'); await A3.waitForSelector('.cs-rel-menu')
  const dm = await A3.evaluate(menuVisible)
  assert.ok(dm.items.every(i => i.hit) && !dm.sheet && dm.top >= dm.btnBottom, JSON.stringify(dm))
  await A3.screenshot({ path: `${SHOTS}/friends-v2-profile-menu-1280.png` })
  await A3.keyboard.press('Escape'); await waitFor(A3, () => !document.querySelector('.cs-rel-menu'))
  ok('7 desktop: menu là popover ngay dưới nút, mọi mục bấm được (không bị cắt)')
  await relMenu(A3, 'Huỷ kết bạn'); await A3.waitForSelector('.cs-confirm')
  await clickText(A3, 'Huỷ', '.cs-confirm button'); await waitFor(A3, () => !document.querySelector('.cs-confirm'))
  assert.equal(await relLabel(A3), 'Bạn bè'); assert.equal(A3.rpcs.includes('unfriend'), false)
  ok('7 desktop: [Bạn bè ▾] → Huỷ kết bạn → Huỷ → vẫn "Bạn bè", không gọi RPC')
  await relMenu(A3, 'Huỷ kết bạn'); await A3.waitForSelector('.cs-confirm')
  await A3.screenshot({ path: `${SHOTS}/friends-v2-confirm-1280.png` })
  await clickText(A3, 'Huỷ kết bạn', '.cs-confirm button')
  await waitRel(A3, 'Kết bạn')
  assert.equal(await notice(A3), 'Đã huỷ kết bạn với Bình.')
  await A3.waitForSelector('.cs-wall-locked')
  ok('7 desktop: xác nhận → "Kết bạn" ngay + tường khoá ngay')
  await friendsPage(A3)
  await waitRows(A3, 'friends', []); await waitRows(A3, 'outgoing', ['C'])
  const [sw, iw] = await A3.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
  assert.ok(sw <= iw + 1)
  await A3.screenshot({ path: `${SHOTS}/friends-v2-desktop-1280.png`, fullPage: true })
  ok('7 desktop 1280: trang Bạn bè đúng từ DB (hết bạn, còn lời mời gửi C), không tràn')
  await friendsPage(B); await waitRows(B, 'friends', [])
  ok('7 B: hai phía không còn là bạn')

  assert.deepEqual(errors, [], 'lỗi trang/console')
  ok('không lỗi trang / console')
  console.log(`FRIENDS UX V2 E2E: ${pass} PASS`)
} catch (e) {
  console.error('FAIL:', e.message)
  console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
