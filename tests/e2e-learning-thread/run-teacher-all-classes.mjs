// E2E Teacher All Classes V1 trong Chrome thật — xem scripts/e2e-teacher-all-classes.sh.
// T = teacher · N = admin KHÔNG hồ sơ học sinh (như tài khoản Thầy production) · C = học sinh chỉ ở SOLO01.TH02 · khách.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const ME = `http://class.localhost:${process.env.VITE_PORT}/me`
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })
const EXPECTED = readFileSync(process.env.EXPECTED_FILE, 'utf8').trim().split('\n').sort()
const TH01 = 'b1000000-0000-4000-8000-000000000001', TH02 = 'b1000000-0000-4000-8000-000000000002', CUR = 'b1000000-0000-4000-8000-000000000004'

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run'] })
let pass = 0
const ok = m => { pass++; console.log('PASS: ' + m) }
const errors = []
async function open(email, path = '', width = 390) {
  let ctx
  for (let i = 0; ; i++) { try { ctx = await browser.createBrowserContext(); break } catch (e) { if (i > 2) throw e; await new Promise(r => setTimeout(r, 300)) } }
  const page = await ctx.newPage()
  await page.setViewport({ width, height: 844, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push(`${email} pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource/.test(m.text())) errors.push(`${email} console: ${m.text()}`) })
  page.rpcs = []
  page.on('request', r => { const m = r.url().match(/\/rest\/v1\/rpc\/(\w+)/); if (m && r.method() !== 'OPTIONS') page.rpcs.push(m[1]) })
  await page.goto(ME + path, { waitUntil: 'networkidle0' })
  if (email) {
    await page.waitForSelector('#cs-login-email', { timeout: 15000 })
    await page.type('#cs-login-email', email); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
    await page.waitForSelector('.cs-account', { timeout: 15000 })
  }
  page.ctx = ctx
  return page
}
const waitText = (page, re, timeout = 15000) => page.waitForFunction(r => new RegExp(r, 'u').test(document.body.innerText), { timeout }, re.source)
const classLinks = page => page.$$eval('.cs-classrow-name', as => as.map(a => a.getAttribute('href').split('/').pop()).sort())
async function classesPage(page) {
  await page.goto(`${ME}/classes`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.cs-page-title', { timeout: 15000 })
  await page.waitForFunction(() => !document.querySelector('.cs-loading'), { timeout: 15000 })
}
const noOverflow = async (page, label) => {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
  assert.ok(sw <= iw + 1, `${label}: tràn ${sw} > ${iw}`)
}

try {
  assert.ok(EXPECTED.length >= 5, 'DB tạm có ≥5 lớp: ' + EXPECTED.length)
  // ── 1. Admin không hồ sơ HS (mobile 390): /me/classes = Tất cả lớp học = ĐÚNG mọi lớp trong DB ──
  const N = await open('n@test.local')
  await classesPage(N)
  assert.equal(await N.$eval('.cs-page-title', e => e.textContent), 'Tất cả lớp học')
  assert.deepEqual(await classLinks(N), EXPECTED, 'danh sách = mọi lớp (bỏ huỷ/gộp/nháp) trong DB')
  assert.equal(await N.evaluate(() => document.body.innerText.includes('Nhập mã lớp')), false)
  assert.ok(N.rpcs.includes('social_all_classes') && !N.rpcs.includes('social_discover_classes'))
  await noOverflow(N, 'admin /me/classes 390')
  await N.screenshot({ path: `${SHOTS}/tac-admin-classes-390.png`, fullPage: true })
  ok(`1 admin (không hồ sơ HS, không là thành viên lớp nào): "Tất cả lớp học" = đúng ${EXPECTED.length} lớp trong DB, không "Nhập mã lớp", không tràn`)

  // ── 2. Admin mở TỪNG lớp: trang lớp lên, không câu "chưa tham gia", không lỗi ──
  for (const id of EXPECTED) {
    N.rpcs.length = 0
    await N.goto(`${ME}/classes/${id}`, { waitUntil: 'networkidle0' })
    await N.waitForSelector('.cs-myclasses-page, .cs-classv2, .cs-page-title, h1', { timeout: 15000 })
    const t = await N.evaluate(() => document.body.innerText)
    assert.doesNotMatch(t, /Bạn đang xem lớp này — bạn chưa tham gia|Không tìm thấy lớp|Chưa tải được/, `lớp ${id}: ${t.slice(0, 200)}`)
    assert.ok(N.rpcs.includes('social_class_detail'))
  }
  ok(`2 admin mở được cả ${EXPECTED.length} lớp (trang lớp không báo lỗi / "chưa tham gia")`)

  // ── 3. Admin: lớp có checkpoint (TH01) — mục lục + buổi 1 + nhịp học (khung bài trả xem trước, vô hiệu) ──
  await N.goto(`${ME}/classes/${TH01}`, { waitUntil: 'networkidle0' })
  await N.waitForSelector('.cs-map', { timeout: 15000 })
  const sessions = await N.$$eval('.cs-map-row', r => r.length)
  assert.ok(sessions >= 2, 'mục lục có buổi: ' + sessions)
  await N.goto(`${ME}/classes/${TH01}/sessions/1`, { waitUntil: 'networkidle0' })
  await N.waitForSelector('.lsn-paper', { timeout: 15000 })
  const cps = await N.$$eval('.lsn-cp', e => e.length)
  assert.ok(cps >= 1, 'buổi có khối bài trả (nhịp học)')
  await waitText(N, /Học viên trả bài tại đây/)
  assert.equal(await N.$$eval('.lsn-cp .lt-panel, .lsn-cp textarea', e => e.length), 0, 'Thầy không có khung nộp bài của học viên')
  await noOverflow(N, 'admin buổi TH01 390')
  await N.screenshot({ path: `${SHOTS}/tac-admin-session-390.png`, fullPage: true })
  ok(`3 admin: TH01 mục lục ${sessions} buổi → Buổi 1 có giáo án + ${cps} bài trả theo nhịp học (chế độ Thầy: ghi chú, không khung nộp)`)
  await N.goto(`${ME}/classes/${CUR}/sessions/1`, { waitUntil: 'networkidle0' })
  await waitText(N, /Nội dung thật buổi 1/)
  await N.waitForSelector('.lsn-cp.is-preview')
  assert.equal(await N.$eval('.lsn-cp.is-preview button', b => b.disabled), true, 'Thầy không trả bài thay học sinh')
  ok('3 admin: CUR01 (chế độ giáo trình) Buổi 1 hiện nội dung học + bài trả "Xem trước" (vô hiệu)')
  await N.ctx.close()

  // ── 4. Teacher T desktop 1280: cùng danh sách; sidebar "Tất cả lớp học" ──
  const T = await open('t@test.local', '', 1280)
  await classesPage(T)
  assert.equal(await T.$eval('.cs-page-title', e => e.textContent), 'Tất cả lớp học')
  assert.deepEqual(await classLinks(T), EXPECTED)
  assert.ok(await T.$$eval('.cs-nav-text', es => es.some(e => e.textContent === 'Tất cả lớp học')), 'sidebar: "Tất cả lớp học"')
  await T.screenshot({ path: `${SHOTS}/tac-teacher-classes-1280.png`, fullPage: true })
  await T.goto(`${ME}/classes/${TH02}/sessions/1`, { waitUntil: 'networkidle0' })
  await T.waitForSelector('.lsn-paper', { timeout: 15000 })
  ok('4 teacher 1280: cùng danh sách mọi lớp, sidebar "Tất cả lớp học", mở buổi TH02 (lớp T không là thành viên)')
  await T.ctx.close()

  // ── 5. Học sinh C: y nguyên "Lớp của tôi"; URL thẳng lớp khác → không lộ giáo án ──
  const C = await open('c@test.local')
  await classesPage(C)
  assert.equal(await C.$eval('.cs-page-title', e => e.textContent), 'Lớp của tôi')
  assert.ok(C.rpcs.includes('social_my_classes') && !C.rpcs.includes('social_all_classes'), 'học sinh KHÔNG gọi social_all_classes')
  const current = await C.$$eval('ul[aria-label="Lớp đang tham gia"] .cs-classrow-name', as => as.map(a => a.getAttribute('href').split('/').pop()))
  assert.deepEqual(current, [TH02], 'C chỉ thấy TH02 là lớp của mình')
  assert.ok(await C.evaluate(() => document.body.innerText.includes('Nhập mã lớp')))
  assert.ok(await C.$$eval('.cs-nav-text', es => es.some(e => e.textContent === 'Lớp của tôi')))
  ok('5 học sinh C: "Lớp của tôi" = chỉ TH02, còn "Nhập mã lớp", sidebar "Lớp của tôi", không gọi RPC của Thầy')
  const viaApi = await C.evaluate(async () => {
    const { supabase } = await import('/src/supabase.ts')
    const r = await supabase.rpc('social_all_classes')
    return { code: r.error?.code ?? null, n: Array.isArray(r.data) ? r.data.length : null }
  })
  assert.equal(viaApi.code, '42501', 'gọi thẳng social_all_classes bằng phiên học sinh → 42501: ' + JSON.stringify(viaApi))
  ok('5 học sinh C gọi thẳng RPC social_all_classes bằng phiên của mình → 42501 (quyền ở server, không chỉ UI)')
  for (const [id, label] of [[TH01, 'TH01'], [CUR, 'CUR01']]) {
    await C.goto(`${ME}/classes/${id}`, { waitUntil: 'networkidle0' })
    await C.waitForFunction(() => !document.querySelector('.cs-skeleton, .cs-loading'), { timeout: 15000 })
    assert.equal(await C.$$eval('.cs-map, .lsn-paper', e => e.length), 0, `${label}: C không thấy mục lục/giáo án`)
    await C.goto(`${ME}/classes/${id}/sessions/1`, { waitUntil: 'networkidle0' })
    await C.waitForFunction(() => !document.querySelector('.cs-skeleton, .cs-loading'), { timeout: 15000 })
    await new Promise(r => setTimeout(r, 800))
    assert.equal(await C.$$eval('.lsn-paper', e => e.length), 0, `${label}: C mở thẳng URL buổi → không giáo án`)
    assert.doesNotMatch(await C.evaluate(() => document.body.innerText), /Nội dung thật buổi 1/)
  }
  ok('5 học sinh C nhập thẳng URL lớp/buổi TH01 + CUR01 → không mục lục, không giáo án')
  await C.ctx.close()

  // ── 6. Khách: không đọc được ──
  const G = await open('', '/classes/' + TH01)
  await G.waitForSelector('#cs-login-email', { timeout: 15000 })
  assert.equal(await G.$$eval('.cs-map, .lsn-paper, .cs-classrow-name', e => e.length), 0)
  const anon = await G.evaluate(async () => {
    const { supabase } = await import('/src/supabase.ts')
    const r = await supabase.rpc('social_all_classes')
    return r.error?.code ?? 'ok'
  })
  assert.equal(anon, '42501', 'khách gọi social_all_classes → 42501')
  ok('6 khách: URL lớp → màn đăng nhập, không mục lục/giáo án; gọi thẳng RPC → 42501')
  await G.ctx.close()

  assert.deepEqual(errors, [], 'lỗi trang/console')
  ok('không lỗi trang / console')
  console.log(`TEACHER ALL CLASSES E2E: ${pass} PASS`)
} catch (e) {
  console.error('FAIL:', e.message)
  console.error(errors.join('\n'))
  process.exitCode = 1
} finally { await browser.close() }
