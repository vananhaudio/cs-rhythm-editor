// Kịch bản E2E Band — Tuyển thành viên V1 trong Chrome thật (puppeteer-core) trên stack local — xem scripts/e2e-band-recruit.sh.
// ACCEPTANCE: khách mở link Lá Mùa Thu → đọc → chọn vị trí → trả lời → chấp thuận Rule → gửi → Thầy thấy đơn ở Admin.
// REUSABILITY: Band thứ 2 tạo CHỈ bằng SQL dữ liệu → cùng trang /band/<slug> hiện đúng nội dung riêng và nhận đơn.
// QUẢN LÝ V1: Thầy Chấp nhận (xác nhận) → thành viên kế thừa vị trí → sửa vị trí → thêm tay → gán vai trò → Bộ máy cập nhật.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT
const BASE = `http://class.localhost:${V}`
const SHOTS = process.env.SHOTS
mkdirSync(SHOTS, { recursive: true })
const sql = q => execSync(process.env.E2E_PSQL, { input: q, encoding: 'utf8' }).trim()

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--no-first-run', '--no-default-browser-check'],
})
let pass = 0
const ok = msg => { pass++; console.log('PASS: ' + msg) }
const errors = []

async function ctxPage(width = 390) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_/.test(m.text())) errors.push('console: ' + m.text()) })
  return { ctx, page }
}
const text = page => page.evaluate(() => document.body.innerText)
const tc = page => page.evaluate(() => document.body.textContent)
async function waitText(page, re, timeout = 15000) {
  await page.waitForFunction(r => new RegExp(r, 'u').test(document.body.textContent), { timeout }, re.source)
}
async function clickLabel(page, label) {
  const h = await page.waitForFunction(l => [...document.querySelectorAll('label')].find(b => b.textContent.trim() === l && b.offsetParent !== null), { timeout: 10000 }, label)
  await h.asElement().click()
}
async function clickText(page, label, scope = 'button') {
  const h = await page.waitForFunction((l, s) => [...document.querySelectorAll(s)].find(b => b.textContent.trim().startsWith(l) && !b.disabled && b.offsetParent !== null), { timeout: 10000 }, label, scope)
  await h.asElement().click()
}
async function noHorizontalOverflow(page, label) {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  assert.ok(sw <= iw + 1, `${label}: tràn ngang ${sw} > ${iw}`)
  ok(`${label}: không tràn ngang (${sw} ≤ ${iw}px)`)
}

try {
  // ── 1. Khách (chưa đăng nhập) mở link Lá Mùa Thu trên điện thoại ──────────────
  let { ctx, page } = await ctxPage(390)
  await page.goto(`${BASE}/band/la-mua-thu`, { waitUntil: 'networkidle0' })
  await waitText(page, /Lá Mùa Thu/)
  const t1 = await text(page)
  for (const s of ['Thầy Văn Anh', 'Tình ca nhẹ nhàng, sâu lắng, giàu giai điệu', '19:00 Thứ Tư hàng tuần', 'Mùa thu cho em', 'Miễn phí',
    'Vocal', 'Guitar đệm', 'Guitar tỉa / Lead', 'Keyboard', 'Bass', 'Trống / Percussion', 'Khác']) assert.ok(t1.includes(s), 'landing có ' + s)
  assert.equal(await page.$('#cs-login-email'), null, 'không bắt đăng nhập')
  ok('khách xem landing Lá Mùa Thu: Leader, gu, lịch, bài tham chiếu, miễn phí, 7 vị trí — không cần đăng nhập')
  await noHorizontalOverflow(page, 'landing 390px')
  await page.screenshot({ path: `${SHOTS}/1-landing-390.png`, fullPage: true })
  assert.equal(await page.$eval('.cs-band-submit', b => b.disabled), true)
  ok('nút Gửi khoá khi chưa tick Rule')

  // ── 2. Điền form → tick Rule → gửi ───────────────────────────────────────────
  await page.type('#band-name', 'Lê Thu Hà')
  await page.type('#band-phone', '0987 111 222')
  await clickLabel(page, 'Guitar đệm')
  await clickLabel(page, 'Chơi được cơ bản')
  await clickLabel(page, 'Rất đúng gu')
  await clickLabel(page, 'Có, tôi có thể ưu tiên lịch này')
  await clickLabel(page, 'Tôi đã đọc và đồng ý thực hiện')
  await page.type('#band-reason', 'Em mê Mùa thu cho em và muốn chơi cùng mọi người mỗi tuần.')
  await page.screenshot({ path: `${SHOTS}/2-form-filled-390.png`, fullPage: true })
  await page.click('.cs-band-submit')
  await waitText(page, /Đã gửi đơn ứng tuyển/)
  assert.match(await text(page), /Thầy sẽ liên hệ qua Zalo/)
  ok('khách gửi đơn → màn xác nhận (thông điệp từ config)')
  await page.screenshot({ path: `${SHOTS}/3-submitted-390.png`, fullPage: true })
  const row = sql(`select full_name || '|' || phone || '|' || position_key || '|' || answers::text || '|' || rule_version || '|' || (rules_accepted_at is not null) || '|' || status || '|' || coalesce(applicant_user_id::text, 'khach') from band_applications`)
  assert.equal(row, 'Lê Thu Hà|0987111222|guitar_dem|{"level": "basic", "schedule": "yes", "taste_fit": "very"}|1|true|NEW|khach')
  ok('DB: đơn lưu band_id + ứng viên + vị trí + câu trả lời + Rule v1 + thời điểm chấp thuận, NEW, không tài khoản')
  // gửi lại cùng SĐT ở trang mới → báo đã gửi, không tạo đơn
  await page.goto(`${BASE}/band/la-mua-thu`, { waitUntil: 'networkidle0' })
  await waitText(page, /Gửi đơn ứng tuyển/)
  await page.type('#band-name', 'Lê Thu Hà'); await page.type('#band-phone', '+84987111222')
  await clickLabel(page, 'Vocal'); await clickLabel(page, 'Mới học'); await clickLabel(page, 'Khá phù hợp'); await clickLabel(page, 'Tôi chưa chắc chắn')
  await clickLabel(page, 'Tôi đã đọc và đồng ý thực hiện'); await page.type('#band-reason', 'Gửi lại')
  await page.click('.cs-band-submit')
  await waitText(page, /Bạn đã gửi đơn trước đó/)
  assert.equal(sql('select count(*) from band_applications'), '1')
  ok('gửi trùng SĐT (dạng +84) → "Bạn đã gửi đơn trước đó", không tạo đơn thứ 2')
  await ctx.close()

  // ── 3. Học viên A đã đăng nhập gửi đơn → đơn gắn tài khoản ────────────────────
  ;({ ctx, page } = await ctxPage(390))
  await page.goto(`${BASE}/me`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', 'a@test.local'); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-sidebar, .cs-menu-btn', { timeout: 15000 })
  await page.goto(`${BASE}/band/la-mua-thu`, { waitUntil: 'networkidle0' })
  await waitText(page, /Gửi đơn ứng tuyển/)
  await page.type('#band-name', 'An'); await page.type('#band-phone', '0912000111')
  await clickLabel(page, 'Khác')
  await page.type('.cs-band-other', 'Sáo trúc')
  await clickLabel(page, 'Đã từng chơi Band'); await clickLabel(page, 'Không phải gu của tôi'); await clickLabel(page, 'Thỉnh thoảng sẽ vắng')
  await clickLabel(page, 'Tôi đã đọc và đồng ý thực hiện'); await page.type('#band-reason', 'Muốn thử sức')
  await page.click('.cs-band-submit')
  await waitText(page, /Đã gửi đơn ứng tuyển/)
  assert.equal(sql(`select position_other || '|' || applicant_user_id from band_applications where phone = '0912000111'`), 'Sáo trúc|aaaaaaaa-0000-4000-8000-00000000000a')
  ok('học viên đã đăng nhập gửi đơn → server tự gắn applicant_user_id; vị trí Khác + mô tả')
  // học viên KHÔNG vào được Admin
  await page.goto(`${BASE}/me/bands/la-mua-thu`, { waitUntil: 'networkidle0' })
  await waitText(page, /không có quyền/)
  assert.ok(!(await text(page)).includes('Lê Thu Hà'))
  ok('học viên mở /me/bands/la-mua-thu → "không có quyền", không thấy đơn của ai')
  // 403 của RPC admin ở bước này là CỐ Ý (server chặn) — trình duyệt ghi "Failed to load resource" → chỉ bỏ đúng loại này
  for (let i = errors.length - 1; i >= 0; i--) if (/status of 403/.test(errors[i])) errors.splice(i, 1)
  await ctx.close()

  // ── 4. Thầy: thấy đơn trong Admin, đổi trạng thái ─────────────────────────────
  ;({ ctx, page } = await ctxPage(390))
  await page.goto(`${BASE}/me/bands`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', 't@test.local'); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await waitText(page, /Quản lý Band/)
  await waitText(page, /2 mới/)
  ok('Thầy: link /me/bands giữ qua bước đăng nhập; Lá Mùa Thu "Đang tuyển · 2 mới · 2 đơn"')
  await page.screenshot({ path: `${SHOTS}/4-admin-bands-390.png`, fullPage: true })
  await clickText(page, 'Lá Mùa Thu')
  await waitText(page, /Lê Thu Hà/)
  const t4 = await text(page)
  for (const s of ['Lê Thu Hà', '0987111222', 'Guitar đệm', 'Chơi được cơ bản', 'Rất đúng gu', 'Có, tôi có thể ưu tiên lịch này',
    'Em mê Mùa thu cho em', 'Đã đồng ý bản v1', 'Khác: Sáo trúc', 'Thỉnh thoảng sẽ vắng', 'có tài khoản', 'Gu nhạc', 'Lịch tập'])
    assert.ok(t4.includes(s), 'Admin có ' + s)
  assert.equal(new URL(page.url()).pathname, '/me/bands/la-mua-thu')
  ok('Admin /me/bands/la-mua-thu: tên, SĐT, vị trí, trình độ, lịch, gu, lý do, Rule v1 + thời điểm, thời gian gửi')
  await noHorizontalOverflow(page, 'admin 390px')
  await page.screenshot({ path: `${SHOTS}/5-admin-apps-390.png`, fullPage: true })
  // đầu trang bàn điều hành
  const h0 = await tc(page)
  for (const s of ['Thầy Văn Anh', '19:00 Thứ Tư hàng tuần', 'Tình ca nhẹ nhàng', 'thành viên', 'đơn mới', 'Ứng tuyển', 'Thành viên', 'Bộ máy', '0/6'])
    assert.ok(h0.includes(s), 'đầu trang có ' + s)
  ok('bàn điều hành: tên Band, Leader, lịch, gu, tổng thành viên, đơn mới + 3 tab ỨNG TUYỂN | THÀNH VIÊN | BỘ MÁY')
  // NEW → Đang xem xét (đổi chữ bình thường)
  const group = 'Trạng thái đơn của Lê Thu Hà'
  const pressStatus = label => page.$$eval(`[aria-label="${group}"] button`, (bs, l) => bs.find(b => b.textContent.trim() === l).click(), label)
  await pressStatus('Đang xem xét')
  await page.waitForFunction(g => document.querySelector(`[aria-label="${g}"] button[aria-pressed="true"]`)?.textContent.trim() === 'Đang xem xét', { timeout: 10000 }, group)
  assert.equal(sql(`select status from band_applications where phone = '0987111222'`), 'REVIEWING')
  assert.equal(sql('select count(*) from band_members'), '0')
  ok('NEW → REVIEWING (lưu DB), chưa tạo thành viên')
  // Chấp nhận → hộp xác nhận → Xác nhận → thành viên
  await pressStatus('Chấp nhận')
  await waitText(page, /Chấp nhận Lê Thu Hà và thêm vào Band\?/)
  assert.equal(sql(`select status from band_applications where phone = '0987111222'`), 'REVIEWING', 'chưa xác nhận → chưa đổi gì')
  await page.screenshot({ path: `${SHOTS}/5b-accept-confirm-390.png`, fullPage: false })
  ok('bấm Chấp nhận → hỏi "Chấp nhận Lê Thu Hà và thêm vào Band?" (chưa đổi DB)')
  await clickText(page, 'Xác nhận')
  await waitText(page, /Đã là thành viên của Band/)
  assert.equal(sql(`select a.status || '|' || m.full_name || '|' || m.phone || '|' || m.positions::text || '|' || m.status || '|' || (m.application_id = a.id)
    from band_applications a join band_members m on m.band_id = a.band_id where a.phone = '0987111222'`), 'ACCEPTED|Lê Thu Hà|0987111222|{guitar_dem}|ACTIVE|true')
  ok('Xác nhận → đơn ACCEPTED + đúng 1 thành viên ACTIVE của Lá Mùa Thu, kế thừa vị trí Guitar đệm')
  // retry (gọi lại RPC như mạng chập chờn) → không trùng
  sql(`select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-4000-8000-00000000000d","role":"authenticated"}', false);
       select band_admin_accept((select id from band_applications where phone = '0987111222'));
       select band_admin_set_status((select id from band_applications where phone = '0987111222'), 'ACCEPTED');`)
  assert.equal(sql('select count(*) from band_members'), '1')
  ok('retry Chấp nhận ×2 (accept + set_status) → vẫn đúng 1 thành viên')
  // THÀNH VIÊN
  await clickText(page, 'Xem')
  await page.waitForSelector('.cs-band-member', { timeout: 10000 })
  let tm = await tc(page)
  assert.ok(tm.includes('Lê Thu Hà') && tm.includes('Guitar đệm') && tm.includes('qua đơn ứng tuyển'))
  ok('tab THÀNH VIÊN: Lê Thu Hà · Guitar đệm (kế thừa) · qua đơn ứng tuyển')
  await clickText(page, 'Sửa vị trí / trạng thái')
  await clickText(page, 'Vocal', '.cs-band-chip')
  await clickText(page, 'Lưu')
  await page.waitForFunction(() => !document.querySelector('.cs-band-medit') && document.body.textContent.includes('Vocal'), { timeout: 10000 })
  assert.equal(sql(`select positions::text from band_members where phone = '0987111222'`), '{guitar_dem,vocal}')
  ok('Leader thêm vị trí Vocal → Guitar đệm + Vocal (lưu DB)')
  await clickText(page, 'Thêm thành viên')
  await page.type('#madd-name', 'Văn Anh')
  await clickText(page, 'Guitar tỉa / Lead', '.cs-band-chip')
  await clickText(page, 'Thêm vào Band', 'button[type=submit]')
  await page.waitForFunction(() => [...document.querySelectorAll('.cs-band-member')].some(li => li.textContent.includes('Văn Anh')), { timeout: 10000 })
  assert.equal(sql(`select positions::text || '|' || (application_id is null) from band_members where full_name = 'Văn Anh'`), '{guitar_lead}|true')
  ok('thêm thành viên trực tiếp (không qua đơn): Văn Anh · Guitar tỉa / Lead')
  await noHorizontalOverflow(page, 'tab Thành viên 390px')
  await page.screenshot({ path: `${SHOTS}/5c-members-390.png`, fullPage: true })
  // BỘ MÁY
  await clickText(page, 'Bộ máy', '.cs-band-tab')
  await page.waitForSelector('.cs-band-role', { timeout: 10000 })
  assert.match(await tc(page), /Band Leader · tối đa 1Chưa phân công/)
  const assign = async (role, person) => {
    await page.evaluate(r => [...document.querySelectorAll('.cs-band-role')].find(li => li.querySelector('.cs-band-role-name').textContent.startsWith(r)).querySelector('.cs-band-role-add').click(), role)
    const sel = await page.waitForSelector(`select[aria-label="Chọn người phụ trách ${role}"]`, { timeout: 10000 })
    const val = await page.$$eval(`select[aria-label="Chọn người phụ trách ${role}"] option`, (os, n) => os.find(o => o.textContent === n).value, person)
    await sel.select(val)
    await page.evaluate(r => [...document.querySelectorAll('.cs-band-role')].find(li => li.querySelector('.cs-band-role-name').textContent.startsWith(r)).querySelector('.cs-band-role-pick .cs-btn-primary').click(), role)
    await page.waitForFunction((r, n) => [...document.querySelectorAll('.cs-band-role')].find(li => li.querySelector('.cs-band-role-name').textContent.startsWith(r))
      ?.querySelector('.cs-band-role-holders')?.textContent.includes(n), { timeout: 10000 }, role, person)
  }
  await assign('Band Leader', 'Văn Anh')
  await assign('Membership', 'Lê Thu Hà')
  await assign('TeamLab / Recording', 'Lê Thu Hà')
  await assign('Membership', 'Văn Anh')
  assert.equal(sql(`select string_agg(m.full_name || ':' || r.role_key, ',' order by m.full_name, r.role_key) from band_member_roles r join band_members m on m.id = r.member_id`),
    'Lê Thu Hà:membership,Lê Thu Hà:teamlab,Văn Anh:band_leader,Văn Anh:membership')
  const org = await page.$$eval('.cs-band-role', lis => lis.map(li => li.querySelector('.cs-band-role-name').textContent + '=' +
    ([...li.querySelectorAll('.cs-band-role-holders li span')].map(x => x.textContent).join(', ') || li.querySelector('.cs-band-role-none').textContent)))
  assert.deepEqual(org, ['Band Leader · tối đa 1=Văn Anh', 'Music Leader=Chưa phân công', 'Membership=Lê Thu Hà, Văn Anh', 'Lịch & điều phối=Chưa phân công',
    'TeamLab / Recording=Lê Thu Hà', 'Performance / Media=Chưa phân công'])
  assert.match(await tc(page), /Đã phân công 3\/6 vai trò/)
  assert.equal(await page.$eval('.cs-band-role', li => li.querySelector('.cs-band-role-add')), null)
  ok('BỘ MÁY: gán Band Leader/Membership(2 người)/TeamLab → màn hiện ngay ai phụ trách, "Chưa phân công", "Đã phân công 3/6"; Band Leader đủ 1 → hết nút thêm')
  await noHorizontalOverflow(page, 'tab Bộ máy 390px')
  await page.screenshot({ path: `${SHOTS}/5d-org-390.png`, fullPage: true })
  await page.click('[aria-label="Bỏ Văn Anh khỏi Membership"]')
  await page.waitForFunction(() => !document.querySelector('[aria-label="Bỏ Văn Anh khỏi Membership"]'), { timeout: 10000 })
  assert.equal(sql(`select count(*) from band_member_roles where role_key = 'membership'`), '1')
  ok('bỏ vai trò → Bộ máy + DB cập nhật')
  // một người nhiều vị trí + nhiều vai trò hiện ở thẻ thành viên; đầu trang đếm 2
  await clickText(page, 'Thành viên', '.cs-band-tab')
  await page.waitForSelector('.cs-band-member', { timeout: 10000 })
  const ha = await page.$$eval('.cs-band-member', lis => lis.find(li => li.textContent.includes('Lê Thu Hà')).textContent)
  for (const s of ['Guitar đệm', 'Vocal', 'Membership', 'TeamLab / Recording']) assert.ok(ha.includes(s), 'thẻ Lê Thu Hà có ' + s)
  assert.match(await tc(page), /2thành viên/)
  ok('thẻ thành viên: nhiều vị trí + nhiều vai trò; đầu trang "2 thành viên"')
  // lọc + reload
  await clickText(page, 'Ứng tuyển', '.cs-band-tab')
  await clickText(page, 'Chấp nhận', '.cs-band-filter-btn')
  const t5 = await text(page)
  assert.ok(t5.includes('Lê Thu Hà') && !t5.includes('0912000111'))
  ok('lọc "Chấp nhận" chỉ còn đơn đã chấp nhận')
  await page.reload({ waitUntil: 'networkidle0' })
  await waitText(page, /Lê Thu Hà/)
  ok('reload /me/bands/la-mua-thu giữ đúng trang')
  await ctx.close()

  ;({ ctx, page } = await ctxPage(1280))
  await page.goto(`${BASE}/me/bands/la-mua-thu`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', 't@test.local'); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-band-tabs', { timeout: 15000 })
  await clickText(page, 'Bộ máy', '.cs-band-tab')
  await page.waitForSelector('.cs-band-role', { timeout: 10000 })
  await noHorizontalOverflow(page, 'Bộ máy 1280px')
  await page.screenshot({ path: `${SHOTS}/5e-org-1280.png`, fullPage: true })
  await ctx.close()

  // desktop
  ;({ ctx, page } = await ctxPage(1280))
  await page.goto(`${BASE}/band/la-mua-thu`, { waitUntil: 'networkidle0' })
  await waitText(page, /Gửi đơn ứng tuyển/)
  await noHorizontalOverflow(page, 'landing 1280px')
  await page.screenshot({ path: `${SHOTS}/6-landing-1280.png`, fullPage: true })
  await ctx.close()

  // ── 5. REUSABILITY: Band 2 chỉ bằng DỮ LIỆU ──────────────────────────────────
  sql(`insert into bands (slug, name, leader_name, music_style, schedule_text, reference_songs, highlights)
       values ('acoustic-chu-nhat', 'Acoustic Chủ Nhật', 'Bình', 'Acoustic pop', '9:00 Chủ Nhật', '[{"title":"Ngày mai em đi"}]', '[{"label":"Học phí","value":"50.000đ/buổi"}]');
       insert into band_rule_versions (band_id, version, title, items, agree_label)
         select id, 1, 'Luật nhóm', '["Đến đúng giờ.","Mang nhạc cụ của mình."]', 'Tôi đồng ý' from bands where slug = 'acoustic-chu-nhat';
       insert into band_recruitments (band_id, title, positions, questions, reason_label, success_message, rule_version_id)
         select b.id, 'Tìm bạn cajon', '[{"key":"cajon","label":"Cajon"},{"key":"ukulele","label":"Ukulele"}]',
           '[{"key":"mic","label":"Bạn có micro riêng?","short_label":"Micro","type":"single","options":[{"value":"y","label":"Có micro"},{"value":"n","label":"Chưa có"}]}]',
           'Bạn mong gì ở nhóm?', 'Bình sẽ nhắn bạn.', v.id
         from bands b join band_rule_versions v on v.band_id = b.id where b.slug = 'acoustic-chu-nhat';`)
  ;({ ctx, page } = await ctxPage(390))
  await page.goto(`${BASE}/band/acoustic-chu-nhat`, { waitUntil: 'networkidle0' })
  await waitText(page, /Acoustic Chủ Nhật/)
  const b2 = await text(page)
  for (const s of ['Bình', 'Acoustic pop', '9:00 Chủ Nhật', 'Ngày mai em đi', '50.000đ/buổi', 'Cajon', 'Ukulele', 'Bạn có micro riêng?', 'Luật nhóm', 'Mang nhạc cụ của mình.', 'Tôi đồng ý', 'Bạn mong gì ở nhóm?'])
    assert.ok(b2.includes(s), 'Band 2 có ' + s)
  for (const s of ['Lá Mùa Thu', 'Mùa thu cho em', 'Thứ Tư', 'Guitar đệm', 'Trình độ']) assert.ok(!b2.includes(s), 'Band 2 không có ' + s)
  await page.screenshot({ path: `${SHOTS}/7-band2-390.png`, fullPage: true })
  await page.type('#band-name', 'Chi'); await page.type('#band-phone', '0933000999')
  await clickLabel(page, 'Ukulele'); await clickLabel(page, 'Có micro'); await clickLabel(page, 'Tôi đồng ý')
  await page.type('#band-reason', 'Vui là chính')
  await page.click('.cs-band-submit')
  await waitText(page, /Bình sẽ nhắn bạn/)
  assert.equal(sql(`select b.slug || '|' || a.position_key || '|' || a.answers::text from band_applications a join bands b on b.id = a.band_id where a.phone = '0933000999'`),
    'acoustic-chu-nhat|ukulele|{"mic": "y"}')
  ok('REUSABILITY: Band 2 tạo bằng 3 câu INSERT → cùng trang hiện nội dung riêng, nhận đơn đúng band_id + câu hỏi riêng')
  await ctx.close()
  // Leader Band 2 (B) chỉ quản lý Band của mình
  sql(`update bands set leader_user_id = 'bbbbbbbb-0000-4000-8000-00000000000b' where slug = 'acoustic-chu-nhat'`)
  ;({ ctx, page } = await ctxPage(390))
  await page.goto(`${BASE}/me/bands`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 15000 })
  await page.type('#cs-login-email', 'b@test.local'); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await waitText(page, /Acoustic Chủ Nhật/)
  assert.ok(!(await text(page)).includes('Lá Mùa Thu'))
  await clickText(page, 'Acoustic Chủ Nhật')
  await waitText(page, /Vui là chính/)
  assert.match(await text(page), /Micro[\s\S]*Có micro/)
  ok('Leader Band 2 thấy và duyệt đơn Band 2 (cột "Micro" từ config), không thấy Lá Mùa Thu')
  await page.$$eval('[aria-label="Trạng thái đơn của Chi"] button', bs => bs.find(b => b.textContent.trim() === 'Chấp nhận').click())
  await clickText(page, 'Xác nhận')
  await waitText(page, /Đã là thành viên của Band/)
  await clickText(page, 'Thành viên', '.cs-band-tab')
  await page.waitForSelector('.cs-band-member', { timeout: 10000 })
  assert.ok((await tc(page)).includes('Ukulele'), 'vị trí tuyển không có trong danh mục Band 2 → giữ thành mô tả')
  assert.equal(sql(`select b.slug || '|' || m.position_note from band_members m join bands b on b.id = m.band_id where m.phone = '0933000999'`), 'acoustic-chu-nhat|Ukulele')
  ok('Leader Band 2 chấp nhận Chi → thành viên Band 2 (đúng band_id), cùng component')
  await page.goto(`${BASE}/me/bands/la-mua-thu`, { waitUntil: 'networkidle0' })
  await waitText(page, /không có quyền/)
  assert.ok(!(await text(page)).includes('Lê Thu Hà'))
  ok('Leader Band 2 mở /me/bands/la-mua-thu → "không có quyền", không thấy thành viên Band 1')
  for (let i = errors.length - 1; i >= 0; i--) if (/status of 403/.test(errors[i])) errors.splice(i, 1)
  await ctx.close()

  // ── 6. Khách: slug lạ ────────────────────────────────────────────────────────
  ;({ ctx, page } = await ctxPage(390))
  await page.goto(`${BASE}/band/khong-ton-tai`, { waitUntil: 'networkidle0' })
  await waitText(page, /Không tìm thấy Band/)
  ok('slug lạ → "Không tìm thấy Band"')
  await ctx.close()

  assert.deepEqual(errors, [], 'không lỗi JS/console')
  ok('không có lỗi JS / console error')
  console.log(`\nE2E BAND: ${pass} PASS · ảnh: ${SHOTS}`)
} catch (e) {
  console.error('FAIL:', e.message)
  if (errors.length) console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
}
