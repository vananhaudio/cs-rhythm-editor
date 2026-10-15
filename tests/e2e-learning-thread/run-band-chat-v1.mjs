// E2E Band Chat V1 trong Chrome thật — xem scripts/e2e-band-chat-v1.sh.
// A, B = cùng Band X · C = Band Y (cùng Team) · mỗi người một browser context riêng, đăng nhập thật qua proxy.
// Phủ: nhóm hiện cùng danh sách cá nhân + nhãn Band · mở nhóm toàn màn hình (mobile) · gửi/nhận giữa hai người ·
// tên + ảnh người gửi · chưa đọc/badge từng người · danh sách thành viên · người ngoài Band bị chặn (mở thẳng URL) ·
// gửi thất bại không báo thành công · rời Band → mất quyền, tin cũ còn · chat cá nhân không đổi · ma trận 320…1440.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ME = `http://class.localhost:${V}/me`
const BAND_X = '11111111-0000-4000-8000-0000000000a1'
const BAND_Y = '11111111-0000-4000-8000-0000000000a2'
const X_NAME = 'Lá Mùa Thu Acoustic Band Hà Nội 2026'
const EMAIL = { A: 'a@test.local', B: 'b@test.local', C: 'c@test.local' }
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
  await waitFor(page, () => !document.querySelector('.cs-chat-list .cs-skeleton'))
}
const items = page => page.$$eval('.cs-chat-item', es => es.map(e => ({
  name: e.querySelector('.cs-chat-item-name').textContent, band: !!e.querySelector('.cs-chat-item-tag'),
  prev: e.querySelector('.cs-chat-item-preview').textContent, unread: e.classList.contains('is-unread'), badge: e.querySelector('.cs-nav-badge')?.textContent ?? null })))
const bubbles = page => page.$$eval('.cs-msg-bubble', es => es.map(e => e.textContent))
async function type(page, text) { await page.click('.cs-chat-input'); await page.type('.cs-chat-input', text) }
async function openBand(page, name = X_NAME) {
  const h = await page.waitForFunction(n => [...document.querySelectorAll('.cs-chat-item')].find(e => e.querySelector('.cs-chat-item-name').textContent === n), { timeout: 20000 }, name)
  await h.asElement().click()
  await waitFor(page, () => /\/me\/chat\/b\/[0-9a-f-]{36}$/.test(location.pathname) && !document.querySelector('.cs-chat-body-state .cs-spinner'))
}

try {
  const A = await open('A'), B = await open('B', 1280, 900), C = await open('C')

  // ── 1. Danh sách của A: nhóm Band + chat cá nhân; không thấy Band Y ──
  await chat(A)
  let list = await items(A)
  assert.equal(list.length, 2)
  const band = list.find(i => i.name === X_NAME), dm = list.find(i => i.name === 'Bình')
  assert.ok(band && band.band, 'có hàng nhóm Band với nhãn Band')
  assert.ok(dm && !dm.band, 'chat cá nhân không có nhãn Band')
  assert.match(band.prev, /Chưa có tin nhắn/)
  assert.ok(!list.some(i => i.name === 'Band Y'), 'không thấy nhóm Band khác')
  assert.match(dm.prev, /tin riêng của hai đứa/)
  await noOverflow(A, 'danh sách 390')
  await A.screenshot({ path: `${SHOTS}/band-chat-list-390.png` })
  ok('1 danh sách: nhóm Band (tên dài cắt gọn, nhãn Band) + chat cá nhân (không nhãn), không có Band khác, không tràn ngang')

  // ── 2. Mở nhóm: toàn màn hình, tên Band + số thành viên, composer sát đáy ──
  await openBand(A)
  const geo = await A.evaluate(() => {
    const pane = document.querySelector('.cs-chat-pane').getBoundingClientRect(), comp = document.querySelector('.cs-chat-composer').getBoundingClientRect()
    const input = document.querySelector('.cs-chat-input').getBoundingClientRect()
    const mid = document.elementFromPoint(input.left + input.width / 2, input.top + input.height / 2)
    const backEl = document.querySelector('.cs-chat-back'), after = getComputedStyle(backEl, '::after')   // vùng chạm mở bằng ::after (≥44)
    return { pane: [Math.round(pane.left), Math.round(pane.top), Math.round(pane.width), Math.round(pane.height)], ih: innerHeight, iw: innerWidth,
      compBottom: Math.round(comp.bottom), inputHit: mid?.classList.contains('cs-chat-input'), backW: Math.round(parseFloat(after.width)), backH: Math.round(parseFloat(after.height)),
      peerRight: Math.round(document.querySelector('.cs-chat-peer').getBoundingClientRect().right),
      name: document.querySelector('.cs-chat-peer-name').textContent.trim(), tag: document.querySelector('.cs-chat-peer-tag')?.textContent ?? '' }
  })
  assert.deepEqual(geo.pane, [0, 0, geo.iw, geo.ih])
  assert.equal(geo.compBottom, geo.ih)
  assert.ok(geo.inputHit, 'ô nhập không bị che')
  assert.ok(geo.backW >= 44 && geo.backH >= 44, `nút ← đủ vùng chạm ${geo.backW}x${geo.backH}`)
  assert.equal(geo.name, X_NAME)
  assert.ok(geo.peerRight <= geo.iw, `tên Band dài không tràn header (${geo.peerRight} > ${geo.iw})`)
  assert.match(geo.tag, /Nhóm Band · 2 thành viên/)
  assert.ok(await A.$('.cs-chat-pane .cs-chat-empty, .cs-chat-scroll') !== null)
  await noOverflow(A, 'nhóm 390')
  ok('2 mở nhóm: toàn màn hình, tên Band + "Nhóm Band · 2 thành viên", composer sát đáy không bị che, nút ← đủ lớn')

  // ── 3. A gửi → hiện, server xác nhận; B (desktop) thấy badge, mở, thấy tên người gửi ──
  await type(A, 'Mai tập lúc 7h nhé cả nhà')
  await A.click('.cs-chat-send')
  await waitFor(A, () => [...document.querySelectorAll('.cs-msg-bubble')].some(b => b.textContent === 'Mai tập lúc 7h nhé cả nhà' && !b.classList.contains('is-pending')))
  assert.ok(calls(A, 'bandchat_send').some(r => r.body.p_band === BAND_X && r.body.p_body === 'Mai tập lúc 7h nhé cả nhà'))
  assert.equal(sql(`select count(*) from public.bandchat_messages where band_id = '${BAND_X}'`), '1')
  assert.equal(calls(A, 'dm_send').length, 0, 'không đi qua dm_send')
  await A.screenshot({ path: `${SHOTS}/band-chat-conv-390.png` })
  ok('3 A gửi tin nhóm: bandchat_send đúng Band, tin xác nhận bởi server (không còn "đang gửi")')

  await chat(B)
  await waitFor(B, () => [...document.querySelectorAll('.cs-chat-item')].some(e => e.querySelector('.cs-chat-item-tag') && e.querySelector('.cs-nav-badge')))
  list = await items(B)
  const bx = list.find(i => i.band)
  assert.deepEqual([bx.name, bx.unread, bx.badge, bx.prev], [X_NAME, true, '1', 'An: Mai tập lúc 7h nhé cả nhà'])
  assert.equal(await B.$eval('.cs-menu-btn .cs-nav-badge', e => e.textContent), '1')
  await B.screenshot({ path: `${SHOTS}/band-chat-list-1280.png` })
  await openBand(B)
  await waitFor(B, () => document.querySelectorAll('.cs-msg-bubble').length >= 1)
  assert.equal(await B.$eval('.cs-msg-sender', e => e.textContent), 'An')
  assert.equal(await B.$$eval('.cs-msg-avatar', es => es.length), 1, 'có chỗ ảnh người gửi')
  await waitFor(B, () => !document.querySelector('.cs-chat-item .cs-nav-badge'))
  assert.ok(calls(B, 'bandchat_mark_read').some(r => r.body.p_band === BAND_X && r.body.p_seq === 1))
  ok('3 B thấy badge 1 + "An: …" ở danh sách; mở nhóm thấy tên + ảnh người gửi; đánh dấu đã đọc → hết badge')

  // ── 4. B trả lời → A thấy (polling), mine vs theirs ──
  await type(B, 'Ok anh, em mang theo capo')
  await B.click('.cs-chat-send')
  await waitFor(B, () => [...document.querySelectorAll('.cs-msg-bubble')].some(b => b.textContent === 'Ok anh, em mang theo capo' && !b.classList.contains('is-pending')))
  await waitFor(A, () => [...document.querySelectorAll('.cs-msg-bubble')].some(b => b.textContent === 'Ok anh, em mang theo capo'))
  assert.equal(await A.$eval('.cs-msg-sender', e => e.textContent), 'Bình')
  assert.equal(await A.$$eval('.cs-msg-row.is-mine', es => es.length), 1)
  assert.equal(await A.$eval('.cs-msg-row.is-theirs .cs-msg-bubble', e => e.textContent), 'Ok anh, em mang theo capo')
  ok('4 B trả lời, A nhận qua polling với tên "Bình"; tin mình bên phải, tin người khác bên trái')

  // ── 5. Danh sách thành viên ──
  await A.click('.cs-chat-peer')
  await A.waitForSelector('.cs-chat-members .cs-chat-member')
  assert.deepEqual((await A.$$eval('.cs-chat-member-name', es => es.map(e => e.textContent))).sort(), ['An', 'Bình'])
  await noOverflow(A, 'thành viên 390')
  await A.click('.cs-chat-members-head button')
  await waitFor(A, () => !document.querySelector('.cs-chat-members'))
  ok('5 danh sách thành viên: An, Bình; đóng được')

  // ── 6. Người ngoài Band (C) ──
  await chat(C)
  list = await items(C)
  assert.deepEqual(list.map(i => i.name), ['Band Y'])
  await C.goto(`${ME}/chat/b/${BAND_X}`, { waitUntil: 'networkidle0' })
  await C.waitForSelector('.cs-chat-body-state[role=alert]', { timeout: 15000 })
  assert.match(await C.$eval('.cs-chat-body-state', e => e.textContent), /Không tìm thấy cuộc trò chuyện/)
  assert.equal(await C.$$eval('.cs-msg-bubble', es => es.length), 0, 'không lộ tin')
  assert.ok(!(await C.content()).includes('Mai tập lúc 7h'))
  ok('6 C (Band khác cùng Team): danh sách chỉ có Band Y; mở thẳng URL nhóm X → "Không tìm thấy", không thấy tin')

  // ── 7. Gửi thất bại không báo thành công ──
  await C.goto(`${ME}/chat/b/${BAND_Y}`, { waitUntil: 'networkidle0' })
  await C.waitForSelector('.cs-chat-input')
  await C.setRequestInterception(true)
  C.on('request', r => { if (/rpc\/bandchat_send/.test(r.url()) && r.method() !== 'OPTIONS') r.abort('failed'); else r.continue() })
  await type(C, 'tin sẽ lỗi')
  await C.click('.cs-chat-send')
  await C.waitForSelector('.cs-msg-fail', { timeout: 15000 })
  assert.ok(await C.$('.cs-msg-bubble.is-failed'))
  assert.equal(sql(`select count(*) from public.bandchat_messages where band_id = '${BAND_Y}'`), '0')
  assert.match(await C.$eval('.cs-msg-fail', e => e.textContent), /Chưa gửi được/)
  ok('7 mạng lỗi khi gửi: hiện "Chưa gửi được · Thử lại", không có tin trong DB (không báo thành công giả)')

  // ── 8. Rời Band → mất quyền; tin cũ còn ──
  sql(`delete from public.teamlab_band_members where band_id = '${BAND_X}' and user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'`)
  await B.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
  await waitFor(B, () => !document.querySelector('.cs-chat-list .cs-skeleton'))
  list = await items(B)
  assert.ok(!list.some(i => i.name === X_NAME), 'B không còn thấy nhóm')
  await B.goto(`${ME}/chat/b/${BAND_X}`, { waitUntil: 'networkidle0' })
  await B.waitForSelector('.cs-chat-body-state[role=alert]', { timeout: 15000 })
  assert.equal(sql(`select count(*) from public.bandchat_messages where band_id = '${BAND_X}'`), '2')
  await chat(A)
  await openBand(A)
  await waitFor(A, () => document.querySelectorAll('.cs-msg-bubble').length === 2)
  assert.equal(await A.$eval('.cs-chat-peer-tag', e => e.textContent), 'Nhóm Band · 1 thành viên')
  ok('8 B rời Band: không thấy nhóm, mở thẳng URL bị chặn; 2 tin cũ (kể cả của B) vẫn còn và A vẫn đọc được')

  // ── 9. Chat cá nhân A–B không đổi ──
  await chat(A)
  await A.evaluate(() => { [...document.querySelectorAll('.cs-chat-item')].find(e => e.querySelector('.cs-chat-item-name').textContent === 'Bình').click() })
  await waitFor(A, () => /\/me\/chat\/[0-9a-f-]{36}$/.test(location.pathname) && document.querySelectorAll('.cs-msg-bubble').length >= 2)
  assert.deepEqual((await bubbles(A)).slice(0, 2), ['Chào Bình', 'Chào An, tin riêng của hai đứa'])
  assert.equal(await A.$('.cs-chat-peer-tag'), null, 'chat cá nhân không có dòng "Nhóm Band"')
  await type(A, 'tin riêng mới')
  await A.click('.cs-chat-send')
  await waitFor(A, () => [...document.querySelectorAll('.cs-msg-bubble')].some(b => b.textContent === 'tin riêng mới' && !b.classList.contains('is-pending')))
  assert.ok(calls(A, 'dm_send').length >= 1)
  ok('9 chat cá nhân: tải + gửi qua dm_*, không dòng nhóm Band')

  // ── 10. Ma trận kích thước (nhóm Y của C: danh sách + nhóm) ──
  for (const [w, h] of [[320, 640], [360, 740], [390, 844], [430, 932], [1120, 800], [1280, 900], [1440, 900]]) {
    const P = await open('C', w, h)
    await P.goto(`${ME}/chat/b/${BAND_Y}`, { waitUntil: 'networkidle0' })
    await P.waitForSelector('.cs-chat-input', { timeout: 15000 })
    await noOverflow(P, `nhóm ${w}`)
    const m = await P.evaluate(() => {
      const c = document.querySelector('.cs-chat-composer').getBoundingClientRect(), i = document.querySelector('.cs-chat-input').getBoundingClientRect()
      return { compBottom: Math.round(c.bottom), ih: innerHeight, hit: document.elementFromPoint(i.left + i.width / 2, i.top + i.height / 2)?.classList.contains('cs-chat-input') }
    })
    assert.ok(m.compBottom <= m.ih && m.hit, `${w}: composer trong màn hình/không bị che ${JSON.stringify(m)}`)
    await P.goto(`${ME}/chat`, { waitUntil: 'networkidle0' })
    await P.waitForSelector('.cs-chat-item', { timeout: 15000 })
    await noOverflow(P, `danh sách ${w}`)
    if (w === 320 || w === 1440) await P.screenshot({ path: `${SHOTS}/band-chat-list-${w}.png` })
    await P.ctx.close()
  }
  ok('10 ma trận 320/360/390/430/1120/1280/1440: không tràn ngang, composer trong màn hình + không bị che')

  assert.deepEqual(errors, [], 'lỗi trang/console')
  ok('không lỗi trang / console')
  console.log(`BAND CHAT V1 E2E: ${pass} PASS`)
} catch (e) {
  console.error('FAIL:', e.message)
  console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
