// E2E BMS Share Lifecycle trong Chrome thật — xem scripts/e2e-bms-share-lifecycle.sh.
// local draft → "Chia sẻ" → [Gửi cho bạn bè | Đăng lên cộng đồng] · MỘT bài = MỘT artifact (lưu riêng → promote) · riêng tư thật · gỡ bài riêng.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ORIGIN = `http://class.localhost:${V}`
const ME = `${ORIGIN}/me`, SB = `${ORIGIN}/song-builder`
const ID = { A: 'aaaaaaaa-0000-4000-8000-00000000000a', B: 'bbbbbbbb-0000-4000-8000-00000000000b', C: 'cccccccc-0000-4000-8000-00000000000c' }
const EMAIL = { A: 'a@test.local', B: 'b@test.local', C: 'c@test.local' }
const NAME = { B: 'Bình', C: 'Chi' }
const SH1 = 'b1111111-0000-4000-8000-000000000001', SH2 = 'b2222222-0000-4000-8000-000000000002'
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
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource|googlevideo|youtube|ytimg/.test(m.text())) errors.push(`${who} console: ` + m.text()) })
  page.rpcs = []; page.saved = []
  page.on('request', r => {
    const m = r.url().match(/\/rest\/v1\/rpc\/(\w+)/)
    if (m && r.method() !== 'OPTIONS') { let body = {}; try { body = JSON.parse(r.postData() ?? '{}') } catch { /* GET */ } page.rpcs.push({ fn: m[1], body }) }
  })
  page.on('response', async r => {
    if (/\/rest\/v1\/rpc\/bms_save_for_share/.test(r.url()) && r.request().method() === 'POST') { try { page.saved.push(await r.json()) } catch { /* điều hướng */ } }
  })
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', EMAIL[who]); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  return page
}
const waitFor = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 15000 }, ...args)
const calls = (page, fn) => page.rpcs.filter(r => r.fn === fn)
const bodyText = page => page.evaluate(() => document.body.innerText)
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
async function chatCards(page) {
  await page.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-chat-item', { timeout: 15000 })
  await page.click('.cs-chat-item')
  await waitFor(page, () => document.querySelector('.cs-chat-scroll .cs-share-card'))
  await waitFor(page, () => [...document.querySelectorAll('.cs-chat-scroll .cs-share-card')].every(x => !x.classList.contains('is-loading')))
  return page.$$eval('.cs-chat-scroll .cs-share-card', es => es.map(e => ({ text: e.textContent.trim(), href: e.getAttribute('href'), gone: e.classList.contains('is-unavailable') })))
}
async function artifactPage(page, id) {
  await page.goto(`${SB}?artifact=${id}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.bms-artifact-banner, .bms-artifact-msg', { timeout: 20000 })
}
async function lastStep(page) {
  await page.evaluate(() => {
    const anchor = (w, word, b) => ({ id: `anchor_${String(w).padStart(3, '0')}_b${b}`, wordIndex: w, word, beatIndex: b, tick: b * 480, source: 'anchor' })
    localStorage.setItem('csre-sb-scratch-v1', JSON.stringify({
      id: 'd_e2e1', title: 'Bài nháp của An', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ', thumbnail: null,
      lyricsText: 'Có chàng trai viết lên cây\nlời yêu thương cô gái ấy',
      fit: { ok: true, fitted: true, bpm: 76, beatDuration: 60 / 76, gridOffset: 1.2, validTaps: 12, rejected: 0, avgError: 0.01, maxError: 0.02, assign: [] },
      timeSignature: 4, downbeatPosition: 1, groupBeats: true,
      anchors: [anchor(0, 'Có', 0), anchor(6, 'lời', 8), anchor(11, 'ấy', 16)],
      chords: [{ wordIndex: 0, name: 'Am' }, { wordIndex: 3, name: 'F' }, { wordIndex: 6, name: 'C' }, { wordIndex: 9, name: 'G' }],
      step: 5, createdAt: Date.now(), updatedAt: Date.now(),
    }))
  })
  await page.goto(SB, { waitUntil: 'domcontentloaded' })
  await clickText(page, '▶ Tiếp tục')
  await waitFor(page, () => /Gửi riêng cho bạn bè hoặc đăng lên cộng đồng/.test(document.body.innerText))
}

let A, B, C
try {
  A = await open('A'); B = await open('B', 1280, 900); C = await open('C')

  // ── 1. Bản nháp local → MỘT nút "Chia sẻ" → sheet hai lựa chọn; chưa chọn thì KHÔNG gọi server ──
  await lastStep(A)
  const labels = await A.$$eval('button', es => es.map(e => e.textContent.trim()))
  assert.equal(labels.filter(t => t === 'Chia sẻ').length, 1, 'đúng MỘT nút "Chia sẻ"')
  assert.equal(labels.some(t => /Chia sẻ lên cộng đồng|Gửi bạn bè/.test(t)), false, 'không còn hai nút riêng')
  await A.click('.bms-share button')
  await dialog(A)
  const opts = await dialogButtons(A)
  assert.ok(opts.some(t => t.startsWith('Gửi cho bạn bè') && t.includes('Gửi riêng qua Chat')) && opts.some(t => t.startsWith('Đăng lên cộng đồng') && t.includes('Chia sẻ để mọi người trong Class cùng xem')), JSON.stringify(opts))
  const uiText = (await bodyText(A))
  assert.equal(/artifact|shared|promote/i.test(await A.$eval('[role=dialog]', e => e.innerText)), false, 'sheet không lộ từ kỹ thuật')
  assert.equal(calls(A, 'bms_save_for_share').length + calls(A, 'social_publish_tool_artifact').length + calls(A, 'dm_share').length, 0, 'mở sheet chưa gọi server')
  await A.screenshot({ path: `${SHOTS}/lifecycle-sheet-390.png` })
  ok('1 bản nháp local: MỘT nút "Chia sẻ" → sheet "Gửi cho bạn bè — Gửi riêng qua Chat" / "Đăng lên cộng đồng — Chia sẻ để mọi người trong Class cùng xem"; không lộ từ kỹ thuật; mở sheet chưa gọi server')

  // ── 2. Gửi cho bạn bè (bài chưa lưu → tự lưu RIÊNG; bấm đúp = 1 lần lưu) ──
  await A.evaluate(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho bạn bè')); b.click(); b.click() })
  await waitFor(A, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  assert.deepEqual((await friendsInSheet(A)).sort(), [NAME.B, NAME.C].sort())
  assert.equal(calls(A, 'bms_save_for_share').length, 1, 'bấm đúp → MỘT lần lưu')
  assert.equal(calls(A, 'social_publish_tool_artifact').length, 0, 'gửi bạn KHÔNG đăng cộng đồng')
  assert.deepEqual(Object.keys(calls(A, 'bms_save_for_share')[0].body), ['p_song'])
  await pickAndSend(A, NAME.B)
  await sleep(300)
  const ART = A.saved[0]
  assert.match(ART, /^[0-9a-f-]{36}$/)
  assert.equal(calls(A, 'dm_share')[0].body.p_ref_key, ART, 'dm_share gửi đúng artifact vừa lưu riêng')
  ok('2 "Gửi cho bạn bè" từ bản nháp: tự lưu riêng ×1 (bấm đúp), chọn Bình, dm_share đúng id; không gọi đăng cộng đồng')

  // ── 3. Riêng tư thật: Feed không có bài; người ngoài không mở được; người nhận mở được ──
  await C.goto(ME, { waitUntil: 'networkidle0' })
  await sleep(1200)
  assert.equal((await C.$$('.cs-tool-share')).length, 0, 'Feed của C KHÔNG có bài BMS (gửi riêng không đăng)')
  await artifactPage(C, ART)
  assert.match(await C.$eval('.bms-artifact-msg', e => e.textContent), MISSING)
  const cards = await chatCards(B)
  const mine = cards.find(c => c.href === `/song-builder?artifact=${ART}`)
  assert.ok(mine && !mine.gone, 'B thấy card bài mới và mở được: ' + JSON.stringify(cards))
  await B.click(`.cs-chat-scroll a[href="/song-builder?artifact=${ART}"]`)
  await B.waitForSelector('.bms-artifact-banner', { timeout: 20000 })
  assert.match(await B.$eval('.bms-artifact-banner', e => e.textContent), /Bài được gửi riêng cho bạn · chỉ luyện, không sửa bài gốc/)
  assert.equal(await B.$('.bms-artifact-share'), null, 'người được gửi riêng KHÔNG có nút Chia sẻ (không forward)')
  assert.equal((await dialogButtons(B).catch(() => [])).length, 0)
  assert.equal(/Gỡ bài|Gỡ chia sẻ/.test(await B.$eval('.bms-artifact-banner', e => e.textContent)), false, 'người nhận không gỡ')
  ok('3 gửi riêng ≠ đăng: Feed của C không có bài; C mở bài → "chưa có quyền xem"; B (đã nhận) mở được, banner "Bài được gửi riêng cho bạn", không có Chia sẻ/Gỡ')

  // ── 4. Đăng cộng đồng sau khi đã gửi riêng = PROMOTE chính bài (cùng id, không bản sao) ──
  await lastStep(A)
  await A.click('.bms-share button'); await dialog(A)
  await A.evaluate(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Đăng lên cộng đồng')); b.click(); b.click() })
  await waitFor(A, () => document.querySelector('[role=dialog] [role=status]')?.textContent === 'Đã đăng lên cộng đồng')
  assert.equal(A.saved.length, 1 + 1, 'mở lại → gọi lưu lần 2 (idempotent theo nội dung)')
  assert.equal(A.saved[1], ART, 'lần lưu thứ hai trả CÙNG artifact (không nhân bản)')
  const pubs = calls(A, 'social_publish_tool_artifact')
  assert.equal(pubs.length, 1, 'bấm đúp đăng → MỘT lần')
  assert.equal(pubs[0].body.p_id, ART, 'đăng = promote chính artifact đã lưu riêng')
  await A.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.trim() === 'Xong').click())
  await A.goto(ME, { waitUntil: 'networkidle0' })
  await A.waitForSelector('.cs-tool-share', { timeout: 15000 })
  const feed = await A.$$eval('.cs-tool-share', es => es.map(e => ({ t: e.textContent, href: e.querySelector('a')?.getAttribute('href') })))
  assert.equal(feed.length, 1, 'đúng MỘT bài BMS trên Feed')
  assert.equal(feed[0].href, `/song-builder?artifact=${ART}`, 'bài Feed trỏ đúng artifact đã gửi riêng')
  assert.equal(/yêu thương|cô gái/.test(feed[0].t), false, 'Feed không lộ lời')
  ok('4 đăng cộng đồng sau khi gửi riêng: lưu lại trả CÙNG id, publish(p_id=id) ×1 (bấm đúp), Feed đúng MỘT bài trỏ cùng bài — không bản sao')

  // ── 5. Sau khi đăng: mọi người mở được; card cũ của B vẫn đúng bài; gửi tiếp cho bạn khác không đổi trạng thái ──
  await artifactPage(C, ART)
  assert.match(await C.$eval('.bms-artifact-banner', e => e.textContent), /Bài chia sẻ · chỉ luyện/)
  await C.click('.bms-artifact-share'); await dialog(C)
  await waitFor(C, () => document.querySelectorAll('[role=dialog] [role=radio]').length > 0)
  assert.deepEqual(await friendsInSheet(C), ['An'], 'bài đã đăng: ai xem cũng chọn thẳng bạn của mình (không menu một mục)')
  await C.keyboard.press('Escape')
  const cardsB2 = await chatCards(B)
  assert.ok(cardsB2.some(c => c.href === `/song-builder?artifact=${ART}` && !c.gone), 'card cũ của B vẫn mở đúng bài')
  const saves0 = A.saved.length
  await lastStep(A)   // phiên mới của trình dựng: chưa biết bài đã đăng → vẫn hiện cả hai lựa chọn; server idempotent
  await A.click('.bms-share button'); await dialog(A)
  await A.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Gửi cho bạn bè')).click())
  await pickAndSend(A, NAME.C)
  assert.equal(A.saved.length, saves0 + 1)
  assert.equal(A.saved.at(-1), ART, 'lưu lại cùng nội dung → CÙNG artifact (đã class)')
  assert.equal(calls(A, 'dm_share').at(-1).body.p_ref_key, ART)
  assert.equal(calls(A, 'social_publish_tool_artifact').length, 1, 'gửi bạn không đăng thêm / không đổi trạng thái')
  const cardsC = await chatCards(C)
  assert.ok(cardsC.some(c => c.href === `/song-builder?artifact=${ART}` && !c.gone), 'C nhận card đúng bài')
  ok('5 sau khi đăng: C mở được, chọn thẳng bạn; card cũ của B vẫn đúng bài; A gửi thêm cho C chỉ gửi tham chiếu (không đăng lại)')

  // ── 6. Chủ bài mở bài RIÊNG có sẵn: menu hai lựa chọn → Đăng = promote chính id ──
  const A2 = await open('A', 320, 568)
  await artifactPage(A2, SH1)
  assert.match(await A2.$eval('.bms-artifact-banner', e => e.textContent), /Bài của bạn · đang gửi riêng, chưa đăng lên cộng đồng/)
  assert.equal(await A2.$$eval('.bms-artifact-banner button', es => es.map(e => e.textContent.trim()).join('|')), 'Chia sẻ|Gỡ bài')
  await A2.click('.bms-artifact-share'); await dialog(A2)
  assert.equal((await dialogButtons(A2)).filter(t => /^(Gửi cho bạn bè|Đăng lên cộng đồng)/.test(t)).length, 2)
  const g = await A2.evaluate(() => { const d = document.querySelector('[role=dialog]').getBoundingClientRect(); return { l: d.left, r: d.right, b: d.bottom, iw: innerWidth, ih: innerHeight } })
  assert.ok(g.l >= 0 && g.r <= g.iw && g.b <= g.ih + 1, JSON.stringify(g))
  await A2.screenshot({ path: `${SHOTS}/lifecycle-sheet-320.png` })
  await A2.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.startsWith('Đăng lên cộng đồng')).click())
  await waitFor(A2, () => document.querySelector('[role=dialog] [role=status]')?.textContent === 'Đã đăng lên cộng đồng')
  assert.equal(calls(A2, 'social_publish_tool_artifact')[0].body.p_id, SH1, 'promote chính bài riêng có sẵn')
  assert.equal(calls(A2, 'bms_save_for_share').length, 0, 'bài đã có sẵn → không lưu thêm')
  await A2.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find(x => x.textContent.trim() === 'Xong').click())
  await waitFor(A2, () => /đang chia sẻ cho Class/.test(document.querySelector('.bms-artifact-banner').textContent))
  assert.match(await A2.$eval('.bms-artifact-banner', e => e.textContent), /Gỡ chia sẻ/)
  await artifactPage(C, SH1)
  assert.match(await C.$eval('.bms-artifact-banner', e => e.textContent), /Bài chia sẻ/, 'sau promote, C mở được')
  ok('6 chủ bài mở bài riêng: banner "đang gửi riêng, chưa đăng", [Chia sẻ|Gỡ bài], menu 2 lựa chọn (320px trong màn hình) → Đăng = promote chính id (không lưu thêm) → banner "đang chia sẻ cho Class"; C mở được')

  // ── 7. Gỡ bài riêng: artifact xoá, tin Chat còn, card "không còn khả dụng" ──
  await artifactPage(B, SH2)
  assert.match(await B.$eval('.bms-artifact-banner', e => e.textContent), /Bài được gửi riêng cho bạn/)
  const before = (await chatCards(B)).length
  await artifactPage(A, SH2)
  await clickText(A, 'Gỡ bài', '.bms-artifact-banner button')
  assert.match(await A.$eval('.bms-artifact-banner', e => e.textContent), /Tin nhắn trong Chat vẫn còn/)
  await clickText(A, 'Xác nhận gỡ', '.bms-artifact-banner button')
  await waitFor(A, () => document.querySelector('.bms-artifact-msg')?.textContent.includes('không còn được chia sẻ'))
  const after = await chatCards(B)
  assert.equal(after.length, before, 'tin Chat KHÔNG bị xoá')
  assert.equal(after.filter(c => c.gone).length, 1, 'đúng một card "không còn khả dụng"')
  assert.equal(after.find(c => c.gone).text, GONE)
  await artifactPage(B, SH2)
  assert.match(await B.$eval('.bms-artifact-msg', e => e.textContent), MISSING)
  ok('7 chủ bài gỡ bài riêng: artifact xoá, tin Chat còn nguyên (card "Nội dung này không còn khả dụng"), người nhận không mở được nữa')

  assert.deepEqual(errors, [], 'lỗi trang/console')
  ok('không lỗi trang / console')
  console.log(`BMS SHARE LIFECYCLE E2E: ${pass} PASS`)
} catch (e) {
  console.error('FAIL:', e.message)
  for (const [n, pg] of [['A', A], ['B', B], ['C', C]]) if (pg) { try { console.error(`[${n}] url=${pg.url()} dialog=${JSON.stringify(await pg.$eval('[role=dialog]', d => d.innerText).catch(() => null))} rpcs=${pg.rpcs.slice(-6).map(r => r.fn).join(',')}`) } catch { /* */ } }
  console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
