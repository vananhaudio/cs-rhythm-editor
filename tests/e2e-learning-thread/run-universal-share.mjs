// E2E Class Universal Share trong Chrome thật — xem scripts/e2e-universal-share.sh.
// (1) Nhịp & Phách dùng lại vòng đời BMS: riêng → đăng → gỡ khỏi cộng đồng (đã gửi DM → còn) → xoá bài riêng · không forward · người ngoài không đọc.
// (2) Lớp học / Buổi học: CHỈ tham chiếu qua DM — người nhận mở bằng quyền của chính họ (không đủ quyền → fail-safe), không đăng cộng đồng, không tạo artifact.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ORIGIN = `http://class.localhost:${V}`
const ME = `${ORIGIN}/me`
const EMAIL = { A: 'a@test.local', B: 'b@test.local', C: 'c@test.local', T: 't@test.local' }
const NAME = { B: 'Bình', C: 'Chi' }
const NP1 = 'c1111111-0000-4000-8000-000000000001', NP2 = 'c2222222-0000-4000-8000-000000000002', NP3 = 'c3333333-0000-4000-8000-000000000003'
const TH01 = 'b1000000-0000-4000-8000-000000000001', SES2 = '51000000-0000-4000-8000-000000000002'
const GONE = 'Nội dung này không còn khả dụng', MISSING = /không còn được chia sẻ hoặc bạn chưa có quyền xem/
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--no-default-browser-check'] })
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
const waitFor = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 15000 }, ...args)
const calls = (page, fn) => page.rpcs.filter(r => r.fn === fn)
async function clickText(page, label, scope = 'button') {
  const h = await page.waitForFunction((l, s) => [...document.querySelectorAll(s)].find(b => b.textContent.trim() === l && !b.disabled && b.offsetParent !== null), { timeout: 12000 }, label, scope)
  await h.asElement().click()
}
const dialog = page => page.waitForSelector('[role=dialog]', { timeout: 10000 })
const dialogButtons = page => page.$$eval('[role=dialog] button', es => es.map(e => e.textContent.trim().replace(/\s+/g, ' ')))
const friendsInSheet = page => page.$$eval('[role=dialog] [role=radio]', es => es.map(e => e.querySelector('span:last-child').textContent.trim()))
async function pickAndSend(page, name) {
  await waitFor(page, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  await page.evaluate(n => [...document.querySelectorAll('[role=dialog] [role=radio]')].find(e => e.querySelector('span:last-child').textContent.trim() === n).click(), name)
  await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho')).click())
  await waitFor(page, n => document.querySelector('[role=dialog] [role=status]')?.textContent === `Đã gửi cho ${n}`, name)
}
async function chatCards(page, peerName) {
  await page.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-chat-item', { timeout: 15000 })
  await page.evaluate(n => [...document.querySelectorAll('.cs-chat-item')].find(e => e.querySelector('.cs-chat-item-name').textContent === n).click(), peerName)
  await waitFor(page, () => document.querySelector('.cs-chat-scroll .cs-share-card'))
  await waitFor(page, () => [...document.querySelectorAll('.cs-chat-scroll .cs-share-card')].every(x => !x.classList.contains('is-loading')))
  return page.$$eval('.cs-chat-scroll .cs-share-card', es => es.map(e => ({ text: e.textContent.trim(), href: e.getAttribute('href'), gone: e.classList.contains('is-unavailable') })))
}
async function nhip(page, id) {
  await page.goto(`${ORIGIN}/nhipphach?artifact=${id}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.np-shared-banner, .np-shared-msg', { timeout: 25000 })
}
const banner = page => page.$eval('.np-shared-banner', e => e.textContent)
const bannerBtns = page => page.$$eval('.np-shared-banner button', es => es.map(e => e.textContent.trim()).join('|'))

let A, B, C, T
try {
  A = await open('A', 390); B = await open('B', 1280, 900); C = await open('C'); T = await open('T')

  // ══ (1) NHỊP & PHÁCH — vòng đời dùng chung với BMS ══
  // 1. A mở bản riêng NP1 (đã gửi B): banner + [Chia sẻ|Gỡ bài]; sheet hai lựa chọn
  await nhip(A, NP1)
  assert.match(await banner(A), /Bản của bạn · đang gửi riêng, chưa đăng lên cộng đồng/)
  assert.equal(await bannerBtns(A), 'Chia sẻ|Gỡ bài')
  await A.waitForSelector('.np-page img', { timeout: 25000 })   // bản khắc dựng lại từ MusicXML đã lưu
  await A.click('.np-share-btn'); await dialog(A)
  const opts = await dialogButtons(A)
  assert.ok(opts.some(t => t.startsWith('Gửi cho bạn bè') && t.includes('Gửi riêng qua Chat')) && opts.some(t => t.startsWith('Đăng lên cộng đồng') && t.includes('Chia sẻ để mọi người trong Class cùng xem')), JSON.stringify(opts))
  assert.equal(/artifact|shared|promote/i.test(await A.$eval('[role=dialog]', e => e.innerText)), false)
  ok('1 Nhịp & Phách bản riêng: banner "đang gửi riêng, chưa đăng", [Chia sẻ|Gỡ bài], bản khắc dựng lại từ MusicXML; sheet đúng hai lựa chọn, không từ kỹ thuật')

  // 2. Gửi cho C (bản riêng → chỉ tham chiếu), Feed không có bài; C mở được, B (đã nhận) mở được, người ngoài (Thầy) không
  await A.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho bạn bè')).click())
  await pickAndSend(A, NAME.C)
  const sh = calls(A, 'dm_share').at(-1).body
  assert.deepEqual([sh.p_user !== undefined, sh.p_ref_type, sh.p_ref_key], [true, 'tool_artifact', NP1])
  assert.equal(calls(A, 'social_publish_tool_artifact').length + calls(A, 'tool_artifact_save_for_share').length, 0, 'bài đã có sẵn: không lưu lại, không đăng')
  await C.goto(ME, { waitUntil: 'networkidle0' }); await sleep(1200)
  const feedC = await C.$$eval('.cs-tool-share', es => es.map(e => e.querySelector('a')?.getAttribute('href')))
  assert.equal(feedC.some(h => h?.includes(NP1)), false, 'gửi riêng KHÔNG lên Feed')
  await nhip(C, NP1)
  assert.match(await banner(C), /Bản được gửi riêng cho bạn · chỉ xem/)
  assert.equal(await bannerBtns(C), '', 'người được gửi riêng: không Chia sẻ, không Gỡ (không forward)')
  await nhip(B, NP1); assert.match(await banner(B), /Bản được gửi riêng cho bạn/)
  await nhip(T, NP1); assert.match(await T.$eval('.np-shared-msg', e => e.textContent), MISSING)
  ok('2 gửi bản Nhịp & Phách riêng cho Chi: Feed không có bài; Chi/Bình (đã nhận) mở được ở chế độ chỉ xem, không forward; Thầy (không nhận) không mở được')

  // 3. Đăng cộng đồng = promote chính bản; Feed đúng một thẻ Nhịp & Phách trỏ đúng; gỡ khỏi cộng đồng (đã gửi DM) → còn
  await nhip(A, NP1)
  await A.click('.np-share-btn'); await dialog(A)
  await A.evaluate(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Đăng lên cộng đồng')); b.click(); b.click() })
  await waitFor(A, () => document.querySelector('[role=dialog] [role=status]')?.textContent === 'Đã đăng lên cộng đồng')
  assert.equal(calls(A, 'social_publish_tool_artifact').length, 1, 'bấm đúp = một lần đăng')
  assert.equal(calls(A, 'social_publish_tool_artifact')[0].body.p_id, NP1, 'promote CHÍNH bản đã lưu riêng')
  await A.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.trim() === 'Xong').click())
  await waitFor(A, () => /đang chia sẻ cho Class/.test(document.querySelector('.np-shared-banner').textContent))
  await C.goto(ME, { waitUntil: 'networkidle0' }); await C.waitForSelector('.cs-tool-share', { timeout: 15000 })
  const cards = await C.$$eval('.cs-tool-share', es => es.map(e => ({ t: e.textContent, href: e.querySelector('a')?.getAttribute('href'), btns: [...e.querySelectorAll('button')].map(b => b.textContent.trim()) })))
  const mine = cards.filter(c => c.href === `/nhipphach?artifact=${NP1}`)
  assert.equal(mine.length, 1, 'đúng MỘT thẻ Feed cho NP1'); assert.match(mine[0].t, /Nhịp & Phách · Bản nhạc[\s\S]*Bản riêng một/); assert.ok(mine[0].btns.includes('Chia sẻ'), 'thẻ Nhịp & Phách có nút Chia sẻ (chọn thẳng bạn)')
  assert.equal(/<|MusicXML|score-partwise/.test(mine[0].t), false)
  await nhip(T, NP1); assert.match(await banner(T), /Bản chia sẻ · chỉ xem/, 'đăng xong: Thầy mở được')
  // gỡ khỏi cộng đồng khi đã gửi bạn → artifact còn
  await nhip(A, NP1)
  assert.equal(await bannerBtns(A), 'Chia sẻ|Gỡ khỏi cộng đồng')
  await clickText(A, 'Gỡ khỏi cộng đồng', '.np-shared-banner button')
  assert.match(await banner(A), /họ vẫn mở được/)
  await clickText(A, 'Xác nhận gỡ', '.np-shared-banner button')
  await waitFor(A, () => /đang gửi riêng/.test(document.querySelector('.np-shared-banner').textContent))
  assert.equal(calls(A, 'social_unpublish_tool_artifact').at(-1).body.p_id, NP1)
  await nhip(T, NP1); assert.match(await T.$eval('.np-shared-msg', e => e.textContent), MISSING, 'gỡ khỏi cộng đồng: Thầy không còn mở được')
  await nhip(B, NP1); assert.match(await banner(B), /Bản được gửi riêng cho bạn/, 'B (đã nhận) vẫn mở được')
  const cardsB = await chatCards(B, 'An')
  assert.ok(cardsB.filter(c => c.href === `/nhipphach?artifact=${NP1}` && !c.gone).length >= 1, 'card DM cũ vẫn sống')
  assert.match(cardsB.find(c => c.href === `/nhipphach?artifact=${NP1}`).text, /Nhịp & Phách · Bản nhạc[\s\S]*Bản riêng một[\s\S]*Nhịp 4\/4 · Đếm phách[\s\S]*Xem bản nhạc/)
  ok('3 đăng cộng đồng = promote chính bản (bấm đúp 1 lần, Feed đúng 1 thẻ, Thầy mở được); gỡ khỏi cộng đồng khi đã gửi DM → bản còn, Feed hết, Thầy không mở, Bình vẫn mở, card DM sống')

  // 4. Xoá bài riêng → tin Chat còn, card không khả dụng
  await nhip(A, NP2)
  await clickText(A, 'Gỡ bài', '.np-shared-banner button')
  assert.match(await banner(A), /Tin nhắn trong Chat vẫn còn/)
  await clickText(A, 'Xác nhận gỡ', '.np-shared-banner button')
  await waitFor(A, () => document.querySelector('.np-shared-msg')?.textContent.includes('không còn được chia sẻ'))
  const after = await chatCards(B, 'An')
  const np2 = after.find(c => c.href === `/nhipphach?artifact=${NP2}`) ?? after.find(c => c.gone)
  assert.ok(after.filter(c => c.gone).length === 1 && after.find(c => c.gone).text === GONE, JSON.stringify(after))
  await nhip(B, NP2); assert.match(await B.$eval('.np-shared-msg', e => e.textContent), MISSING)
  void np2
  ok('4 chủ xoá bản riêng: tin Chat còn nguyên, card "Nội dung này không còn khả dụng", người nhận không mở được')

  // 5. Feed: thẻ Nhịp & Phách đã đăng (NP3) → Chia sẻ → chọn thẳng bạn (một lựa chọn hợp lệ)
  await B.goto(ME, { waitUntil: 'networkidle0' }); await B.waitForSelector('.cs-tool-share', { timeout: 15000 })
  const feedBtn = await B.$$eval('.cs-tool-share', es => es.map(e => ({ t: e.querySelector('.cs-tool-share-headline')?.textContent, btns: [...e.querySelectorAll('button')].map(b => b.textContent.trim()) })))
  assert.ok(feedBtn.some(c => c.t === 'Bản đã đăng' && c.btns.includes('Chia sẻ')), JSON.stringify(feedBtn))
  await B.evaluate(() => [...document.querySelectorAll('.cs-tool-share')].find(e => e.querySelector('.cs-tool-share-headline')?.textContent === 'Bản đã đăng').querySelector('button').click())
  await dialog(B)
  assert.deepEqual(await friendsInSheet(B).catch(() => []), [], 'chưa tải xong — chờ')
  await waitFor(B, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  assert.deepEqual(await friendsInSheet(B), ['An'])
  assert.equal(/Đăng lên cộng đồng/.test(await B.$eval('[role=dialog]', e => e.innerText)), false, 'Feed card: chỉ gửi bạn')
  await pickAndSend(B, 'An')
  assert.equal(calls(B, 'dm_share').at(-1).body.p_ref_key, NP3)
  await B.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.trim() === 'Xong').click())
  ok('5 Feed: thẻ Nhịp & Phách có "Chia sẻ" → chọn thẳng bạn (không menu), dm_share đúng bản của thẻ')

  // ══ (2) LỚP HỌC / BUỔI HỌC — chỉ tham chiếu; người nhận mở bằng quyền của chính họ ══
  const before = { save: calls(A, 'tool_artifact_save_for_share').length, pub: calls(A, 'social_publish_tool_artifact').length }
  await A.goto(`${ME}/classes/${TH01}`, { waitUntil: 'networkidle0' })
  await A.waitForSelector('.cs-class-name', { timeout: 15000 })
  assert.equal(await A.$$eval('.cs-share-btn', es => es.length), 1, 'A (thành viên) thấy MỘT nút Chia sẻ trên trang lớp')
  await A.click('.cs-share-btn'); await dialog(A)
  await waitFor(A, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  assert.deepEqual((await friendsInSheet(A)).sort(), [NAME.B, NAME.C].sort())
  assert.equal(/Đăng lên cộng đồng/.test(await A.$eval('[role=dialog]', e => e.innerText)), false, 'lớp: chỉ gửi bạn')
  await pickAndSend(A, NAME.C)
  const dsc = calls(A, 'dm_share').at(-1).body
  assert.deepEqual([dsc.p_ref_type, dsc.p_ref_key], ['class', TH01])
  await A.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.trim() === 'Xong').click())
  await A.goto(`${ME}/classes/${TH01}/sessions/2`, { waitUntil: 'networkidle0' })
  await A.waitForSelector('.cs-session-top .cs-share-btn', { timeout: 15000 })
  await A.click('.cs-session-top .cs-share-btn'); await dialog(A)
  await pickAndSend(A, NAME.C)
  const dss = calls(A, 'dm_share').at(-1).body
  assert.deepEqual([dss.p_ref_type, dss.p_ref_key], ['class_session', SES2])
  assert.equal(calls(A, 'tool_artifact_save_for_share').length - before.save + calls(A, 'social_publish_tool_artifact').length - before.pub, 0, 'lớp/buổi học KHÔNG tạo artifact, KHÔNG đăng cộng đồng')
  ok('6 A (thành viên) gửi LỚP và BUỔI HỌC cho Chi: chỉ chọn bạn (không menu, không đăng cộng đồng), dm_share đúng loại/khoá, không lưu/đăng artifact')

  // 7. C (KHÔNG thành viên lớp) nhận card: metadata công khai; mở bằng quyền của chính C → fail-safe, không lộ giáo án; không có nút Chia sẻ
  const cc = await chatCards(C, 'An')
  const kinds = cc.map(c => c.text.split('\n')[0]).join('|')
  const cl = cc.find(c => c.href === `/me/classes/${TH01}`), ss = cc.find(c => c.href === `/me/classes/${TH01}/sessions/2`)
  assert.ok(cl && !cl.gone && ss && !ss.gone, kinds + JSON.stringify(cc))
  assert.match(cl.text, /Lớp học · Lớp[\s\S]*Solo Guitar Căn Bản[\s\S]*Mở lớp/); assert.match(ss.text, /Buổi học[\s\S]*Buổi 2 · Ép ngón & Bass[\s\S]*Mở buổi học/)
  assert.equal(/\{|tool_artifact|b1000000/.test((cl.text + ss.text)), false, 'card không lộ id/JSON')
  await C.click(`.cs-chat-scroll a[href="/me/classes/${TH01}"]`)
  await C.waitForSelector('.cs-class-name', { timeout: 15000 })
  assert.match(await C.evaluate(() => document.body.innerText), /Bạn đang xem lớp này — bạn chưa tham gia/)
  assert.equal(await C.$('.cs-share-btn'), null, 'không thành viên: không có nút Chia sẻ trên trang lớp')
  await C.goto(`${ME}/classes/${TH01}/sessions/2`, { waitUntil: 'networkidle0' })
  await C.waitForSelector('.cs-learn-locked', { timeout: 15000 })
  const ctext = await C.evaluate(() => document.body.innerText)
  assert.match(ctext, /Bạn chưa xem được giáo trình của lớp này/); assert.equal(/Ép ngón|Bass|checkpoint/i.test(ctext.replace(/Buổi 2 · Ép ngón & Bass/g, '')), false, 'không lộ nội dung giáo án')
  assert.equal(await C.$('.cs-share-btn'), null)
  ok('7 Chi (không thành viên) nhận card lớp/buổi (tên lớp, số buổi — metadata công khai), mở bằng quyền của chính Chi → "chưa xem được giáo trình", không lộ giáo án, không có Chia sẻ: share KHÔNG cấp quyền')

  // 8. B (thành viên TH01, được A gửi buổi 1 — buổi 2 vốn khoá theo tiến độ) mở card → vào đúng buổi bằng quyền thành viên
  await A.goto(`${ME}/classes/${TH01}/sessions/1`, { waitUntil: 'networkidle0' })
  await A.waitForSelector('.cs-session-top .cs-share-btn', { timeout: 15000 })
  await A.click('.cs-session-top .cs-share-btn'); await dialog(A)
  await pickAndSend(A, NAME.B)
  const cb = await chatCards(B, 'An')
  assert.ok(cb.some(c => c.href === `/me/classes/${TH01}/sessions/1` && !c.gone))
  await B.click(`.cs-chat-scroll a[href="/me/classes/${TH01}/sessions/1"]`)
  await B.waitForSelector('.cs-session-top .cs-share-btn', { timeout: 20000 })
  assert.equal(await B.evaluate(() => location.pathname), `/me/classes/${TH01}/sessions/1`)
  assert.equal(await B.$('.cs-learn-locked'), null, 'thành viên mở được buổi học')
  assert.equal(await B.$$eval('.cs-session-top .cs-share-btn', es => es.length), 1, 'thành viên thấy Chia sẻ')
  ok('8 Bình (thành viên lớp) nhận card buổi 1 → bấm → đúng /me/classes/<id>/sessions/1, mở được giáo án bằng quyền thành viên (buổi khoá theo tiến độ vẫn do trang đích quyết)')

  // 9. Mobile: sheet + card trong màn hình ở 320
  for (const [w, h] of [[320, 640], [375, 700], [390, 844], [430, 932]]) {
    await A.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
    await A.goto(`${ME}/classes/${TH01}`, { waitUntil: 'networkidle0' })
    await A.waitForSelector('.cs-share-btn', { timeout: 15000 })
    await A.click('.cs-share-btn'); await dialog(A)
    await waitFor(A, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
    const g = await A.evaluate(() => { const d = document.querySelector('[role=dialog]').getBoundingClientRect(); return { l: d.left, r: d.right, b: d.bottom, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth } })
    assert.ok(g.l >= 0 && g.r <= g.iw && g.b <= g.ih + 1 && g.sw <= g.iw + 1, `${w}: ${JSON.stringify(g)}`)
    if (w === 320) await A.screenshot({ path: `${SHOTS}/universal-sheet-320.png` })
    await A.keyboard.press('Escape')
    await C.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
    await chatCards(C, 'An')
    const m = await C.evaluate(() => { const cs = [...document.querySelectorAll('.cs-share-card')].map(c => c.getBoundingClientRect()); const sc = document.querySelector('.cs-chat-scroll')
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, inView: cs.every(r => r.left >= 0 && r.right <= innerWidth), maxW: Math.round(Math.max(...cs.map(r => r.width))), scO: sc.scrollWidth > sc.clientWidth + 1 } })
    assert.ok(m.sw <= m.iw + 1 && m.inView && m.maxW <= 301 && !m.scO, `${w}: ${JSON.stringify(m)}`)
    if (w === 320) await C.screenshot({ path: `${SHOTS}/universal-cards-320.png` })
  }
  ok('9 mobile 320/375/390/430: sheet nằm trọn màn hình; card lớp/buổi/Nhịp & Phách không tràn (≤300px)')

  assert.deepEqual(errors, [], 'lỗi trang/console')
  ok('không lỗi trang / console')
  console.log(`UNIVERSAL SHARE E2E: ${pass} PASS`)
} catch (e) {
  console.error('FAIL:', e.message)
  for (const [n, pg] of [['A', A], ['B', B], ['C', C], ['T', T]]) if (pg) { try { console.error(`[${n}] url=${pg.url()} dialog=${JSON.stringify(await pg.$eval('[role=dialog]', d => d.innerText).catch(() => null))} rpcs=${pg.rpcs.slice(-5).map(r => r.fn).join(',')}`) } catch { /* */ } }
  console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
