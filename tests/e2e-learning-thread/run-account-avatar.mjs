// E2E Account Avatar V1 trong Chrome thật — xem scripts/e2e-account-avatar.sh.
// N (n@test.local) = admin KHÔNG có hồ sơ học sinh: tự đổi ảnh ở /me (mobile 390: nút máy ảnh trên trang cá nhân;
// desktop 1280: menu tài khoản), tải lại vẫn còn, role không đổi; học sinh B thấy ảnh mới qua get_user_profile.
// Proxy local trả URL http → safeImageUrl (chỉ https) hiện chữ cái đầu: kiểm ảnh qua phản hồi REST/RPC + tải được ảnh từ Storage.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const ME = `http://class.localhost:${V}/me`
const N = 'eeeeeeee-0000-4000-8000-00000000000e'
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })
const PNG = SHOTS + '/avatar-src.png'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
})
let pass = 0
const ok = msg => { pass++; console.log('PASS: ' + msg) }
const errors = []

async function ctxPage(width) {
  let ctx
  for (let i = 0; ; i++) { try { ctx = await browser.createBrowserContext(); break } catch (e) { if (i > 2) throw e; await new Promise(r => setTimeout(r, 300)) } }
  const page = await ctx.newPage()
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_/.test(m.text())) errors.push('console: ' + m.text()) })
  // ghi lại phản hồi REST/RPC liên quan ảnh
  page.net = []
  page.on('response', async r => {
    const u = r.url()
    if (!/\/rest\/v1\/(app_users|edu_students|rpc\/(class_set_my_avatar|get_user_profile))/.test(u)) return
    let body = null; try { body = await r.json() } catch { /* không phải JSON */ }
    page.net.push({ url: u, method: r.request().method(), status: r.status(), body })
  })
  return { ctx, page }
}
async function login(page, email, path = '') {
  await page.goto(ME + path, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', email)
  await page.type('#cs-login-pass', 'e2e')
  await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
}
async function noHorizontalOverflow(page, label) {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  assert.ok(sw <= iw + 1, `${label}: tràn ngang ${sw} > ${iw}`)
  ok(`${label}: không tràn ngang (${sw} ≤ ${iw}px)`)
}
const appUserAvatar = page => {
  const hit = [...page.net].reverse().find(n => n.url.includes('/rest/v1/app_users') && /avatar_url/.test(n.url) && n.status === 200)
  const row = Array.isArray(hit?.body) ? hit.body[0] : hit?.body
  return hit ? (row?.avatar_url ?? null) : undefined
}
async function saveViaChooser(page, openPicker, label) {
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 10000 }), openPicker()])
  await chooser.accept([PNG])
  await page.waitForSelector('.cs-media-dialog img.cs-preview-avatar', { timeout: 10000 })
  await page.screenshot({ path: `${SHOTS}/avatar-${label}-preview.png` })
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/rpc/class_set_my_avatar') && r.request().method() === 'POST', { timeout: 15000 }),
    page.evaluate(() => [...document.querySelectorAll('.cs-media-dialog button')].find(b => b.textContent.trim() === 'Lưu').click()),
  ])
  assert.ok(resp.status() >= 200 && resp.status() < 300, `${label}: RPC class_set_my_avatar trả ${resp.status()}`)
  const url = JSON.parse(resp.request().postData()).p_url
  assert.match(url, new RegExp(`/storage/v1/object/public/avatars/${N}-\\d{13}\\.jpg$`), `${label}: URL ảnh theo quy ước <userId>-<ms>.jpg`)
  await page.waitForFunction(() => !document.querySelector('.cs-media-dialog'), { timeout: 10000 })
  return url
}

try {
  // ── 1. Mobile 390: admin mở trang cá nhân → nút máy ảnh trên avatar → chọn ảnh → Lưu
  let { ctx, page } = await ctxPage(390)
  await login(page, 'n@test.local')
  // Ảnh thật (PNG vẽ bằng canvas, như run.mjs)
  const png = await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = cv.height = 96; const g = cv.getContext('2d'); g.fillStyle = '#0f766e'; g.fillRect(0, 0, 96, 96); g.fillStyle = '#fbbf24'; g.fillRect(24, 24, 48, 48); return cv.toDataURL('image/png').split(',')[1] })
  writeFileSync(PNG, Buffer.from(png, 'base64'))
  assert.equal(appUserAvatar(page), null, 'trước khi đổi: app_users.avatar_url = null')
  ok('admin N đăng nhập /me (không hồ sơ học sinh) — chế độ giáo viên, chưa có ảnh')
  await page.goto(`${ME}/u/${N}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-identity .cs-avatar-edit', { timeout: 15000 })
  assert.match(await page.$eval('.cs-identity-facts', e => e.textContent), /Giáo viên/)
  ok('mobile: trang cá nhân của admin có nút "Đổi ảnh đại diện" trên avatar (trước đây bị ẩn)')
  const url1 = await saveViaChooser(page, () => page.click('.cs-identity .cs-avatar-edit'), 'mobile')
  ok('mobile: chọn ảnh → xem trước → Lưu → RPC 2xx, URL đúng quy ước')
  const img = await page.evaluate(async u => { const r = await fetch(u); return { status: r.status, type: r.headers.get('content-type'), size: (await r.arrayBuffer()).byteLength } }, url1)
  assert.equal(img.status, 200); assert.equal(img.type, 'image/jpeg'); assert.ok(img.size > 100)
  ok(`ảnh đã nằm trong bucket avatars (JPEG ${img.size} byte, đọc public được)`)
  await noHorizontalOverflow(page, 'mobile 390 trang cá nhân sau khi lưu')
  page.net.length = 0
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-identity', { timeout: 15000 })
  assert.equal(appUserAvatar(page), url1, 'refresh: /me đọc lại đúng ảnh mới')
  assert.match(await page.$eval('.cs-identity-facts', e => e.textContent), /Giáo viên/)
  ok('mobile: refresh → /me đọc lại app_users.avatar_url = ảnh mới; vẫn "Giáo viên" (role không đổi)')
  await page.screenshot({ path: `${SHOTS}/avatar-mobile-after.png` })
  await ctx.close()

  // ── 2. Desktop 1280: đổi lần 2 qua menu tài khoản
  ;({ ctx, page } = await ctxPage(1280))
  await login(page, 'n@test.local')
  assert.equal(appUserAvatar(page), url1, 'desktop: phiên mới thấy ảnh lần 1')
  await page.click('.cs-account > button')
  await page.waitForSelector('.cs-account .cs-more-menu', { timeout: 5000 })
  const items = await page.$$eval('.cs-account .cs-more-item', els => els.map(e => e.textContent.trim()))
  assert.ok(items.includes('Đổi ảnh đại diện'), 'menu tài khoản có "Đổi ảnh đại diện": ' + items.join(' · '))
  ok('desktop: menu tài khoản của admin có "Đổi ảnh đại diện"')
  const url2 = await saveViaChooser(page, () => page.evaluate(() =>
    [...document.querySelectorAll('.cs-account .cs-more-item')].find(b => b.textContent.trim() === 'Đổi ảnh đại diện').click()), 'desktop')
  assert.notEqual(url2, url1)
  ok('desktop: đổi ảnh lần 2 → RPC 2xx (thay ảnh cũ)')
  await noHorizontalOverflow(page, 'desktop 1280')
  page.net.length = 0
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  assert.equal(appUserAvatar(page), url2)
  ok('desktop: refresh → ảnh lần 2')
  await ctx.close()

  // ── 3. Học sinh B: thấy ảnh mới của admin qua hồ sơ chuẩn (get_user_profile → class_public_identity); ảnh B không đổi
  ;({ ctx, page } = await ctxPage(390))
  await login(page, 'b@test.local')
  const own = page.net.find(n => n.url.includes('/rest/v1/edu_students') && n.status === 200)
  const ownRow = Array.isArray(own?.body) ? own.body[0] : own?.body
  assert.equal(ownRow?.avatar_url ?? null, null, 'ảnh của B không bị đụng')
  await page.goto(`${ME}/u/${N}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-identity-name, .cs-profile', { timeout: 15000 })
  const prof = page.net.find(n => n.url.includes('/rpc/get_user_profile') && n.status === 200)
  const profRow = Array.isArray(prof?.body) ? prof.body[0] : prof?.body
  assert.equal(profRow?.avatar_url, url2, 'B xem hồ sơ admin: avatar_url = ảnh mới nhất')
  assert.equal(profRow?.role, 'teacher')
  assert.equal(await page.$('.cs-avatar-edit'), null, 'B KHÔNG có nút đổi ảnh trên trang của admin')
  ok('học sinh B: hồ sơ admin trả ảnh mới qua class_public_identity; B không có nút đổi ảnh của người khác; ảnh B giữ nguyên')
  // (gọi thẳng RPC với URL người khác / tài khoản có hồ sơ học sinh: phủ ở scripts/test-account-avatar-db.sh)
  await ctx.close()

  const bad = errors.filter(e => !/Failed to load resource/.test(e))
  assert.deepEqual(bad, [], 'lỗi trang/console')
  ok('không lỗi trang / console')
  console.log(`ACCOUNT AVATAR E2E: ${pass} PASS`)
} catch (e) {
  console.error('FAIL:', e.message)
  console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
