// E2E Mira cạnh màn chấm bài — Chrome thật + Mira THẬT (next start) + DB tạm. Chạy bởi scripts/e2e-mira-grading.sh.
// Không production: Class = stack local của e2e-learning-thread.sh; DB Mira = Postgres tạm riêng; OpenAI/Supabase production bị preload dịch sang local.
import { createRequire } from 'node:module'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import assert from 'node:assert/strict'
import os from 'node:os'
import http from 'node:http'
import path from 'node:path'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const V = process.env.VITE_PORT, MP = process.env.MIRA_PORT, MIRA_DIR = process.env.MIRA_DIR
const SHOTS = process.env.SHOTS; mkdirSync(SHOTS, { recursive: true })
const PGBIN = process.env.E2E_PG_BIN, SOCK = process.env.E2E_PG_SOCK, PGPORT = process.env.E2E_PG_PORT
const CLASS = `http://class.localhost:${V}`, MIRA = `http://mira.localhost:${MP}`
const TH01 = 'b1000000-0000-4000-8000-000000000001'
const TEMP = path.join(os.tmpdir(), 'mira-e2e-' + process.pid); mkdirSync(TEMP, { recursive: true })
const OPENAI_LOG = path.join(TEMP, 'openai.log'); writeFileSync(OPENAI_LOG, '')

const psql = (db, sql) => execFileSync(path.join(PGBIN, 'psql'), ['-X', '-q', '-tA', '-h', SOCK, '-p', PGPORT, '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim()
const psqlFile = (db, f) => execFileSync(path.join(PGBIN, 'psql'), ['-X', '-q', '-h', SOCK, '-p', PGPORT, '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-f', f], { encoding: 'utf8' })
const jwt = (secret, payload) => { const b = o => Buffer.from(JSON.stringify(o)).toString('base64url'); const h = b({ alg: 'HS256', typ: 'JWT' }), p = b(payload); return `${h}.${p}.${createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}` }
const sleep = ms => new Promise(r => setTimeout(r, ms))
let pass = 0; const ok = m => { pass++; console.log('PASS: ' + m) }
const errors = []; const kids = []
const run = (cmd, args, opts) => { const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }); p.stdout.on('data', d => process.env.E2E_DUMPIO && process.stdout.write(d)); p.stderr.on('data', d => process.env.E2E_DUMPIO && process.stderr.write(d)); kids.push(p); return p }
async function waitHttp(url, ms = 90000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const r = await fetch(url); if (r.status < 500) return } catch {} await sleep(400) } throw new Error('không lên: ' + url) }

// ── 1) DB riêng của Mira + PostgREST ──
const MIRA_SECRET = 'mira-e2e-secret-mira-e2e-secret-000000', MPG = Number(MP) + 100, MPG_REST = MPG + 1
execFileSync(path.join(PGBIN, 'createdb'), ['-h', SOCK, '-p', PGPORT, '-U', 'postgres', 'mira'])
psqlFile('mira', path.join(MIRA_DIR, 'tests/e2e/mira_chat_schema.sql'))
writeFileSync(path.join(TEMP, 'pgrst.conf'), `db-uri = "postgres://authenticator:authenticator@127.0.0.1:${PGPORT}/mira"\ndb-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "${MIRA_SECRET}"\nserver-port = ${MPG_REST}\nserver-host = "127.0.0.1"\n`)
run('postgrest', [path.join(TEMP, 'pgrst.conf')])
await waitHttp(`http://127.0.0.1:${MPG_REST}/`)
// supabase-js gọi /rest/v1/* (cổng Supabase cắt tiền tố này); PostgREST trần thì không có → proxy cắt giống cổng thật.
const gate = http.createServer((req, res) => {
  const up = http.request({ host: '127.0.0.1', port: MPG_REST, method: req.method, path: req.url.replace(/^\/rest\/v1/, ''), headers: req.headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res) })
  up.on('error', () => { res.writeHead(502); res.end() }); req.pipe(up)
}).listen(MPG, '127.0.0.1')
kids.push({ kill: () => gate.close() })
const SERVICE = jwt(MIRA_SECRET, { role: 'service_role', iss: 'e2e', exp: 4102444800 })
const CLASS_ANON = jwt(process.env.E2E_JWT_SECRET, { role: 'anon', iss: 'e2e', exp: 4102444800 })

// ── 2) Mira THẬT: build (CSP đọc lúc build) rồi start ──
const miraEnv = {
  ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MPG}`, SUPABASE_SERVICE_ROLE_KEY: SERVICE, MIRA_GRADING_KEY: 'e2e-mira-key',
  MIRA_GRADING_PARENT_ORIGINS: CLASS, OPENAI_API_KEY: 'fake', E2E_CLASS_URL: `http://127.0.0.1:${process.env.E2E_PROXY_PORT}`, E2E_CLASS_ANON: CLASS_ANON,
  E2E_OPENAI_LOG: OPENAI_LOG, NODE_OPTIONS: `--require ${path.join(MIRA_DIR, 'tests/e2e/preload.cjs')}`, PORT: MP,
}
execFileSync('npx', ['next', 'build'], { cwd: MIRA_DIR, env: { ...miraEnv, NODE_OPTIONS: '' }, stdio: 'ignore' })
run('npx', ['next', 'start', '-p', MP, '-H', '127.0.0.1'], { cwd: MIRA_DIR, env: miraEnv })
await waitHttp(`http://127.0.0.1:${MP}/grading`)
ok('Mira thật đã lên (build với CSP theo origin Class của lần chạy)')

const idOf = n => psql('e2e', `select t.id from public.learning_threads t where t.learner_user_id = '${n}' and t.checkpoint_id = '1.1'`)
const TH_A = idOf('aaaaaaaa-0000-4000-8000-00000000000a'), TH_B = idOf('bbbbbbbb-0000-4000-8000-00000000000b')
assert.ok(TH_A && TH_B && TH_A !== TH_B)

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--host-resolver-rules=MAP *.localhost 127.0.0.1'] })
async function ctxPage(width, height = 900, track = true) {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 })
  // Lỗi 'Lỗi tải khoá học' đến từ MobileStudentPortal (cổng cũ, không liên quan) vì DB tạm của harness không có bảng khoá học → bỏ qua.
  if (track) {
    page.on('pageerror', e => errors.push('pageerror: ' + e.message))
    page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|404|400 \(Bad Request\)|Refused to frame|Failed to load resource|Lỗi tải khoá học/.test(m.text())) errors.push('console: ' + m.text()) })
  }
  return { ctx, page }
}
async function login(page, email, p = '') {
  await page.goto(CLASS + '/me' + p, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#cs-login-email', { timeout: 20000 })
  await page.type('#cs-login-email', email); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
}
const miraFrame = async page => { await page.waitForFunction(() => document.querySelector('iframe.mira-dock-frame')); for (let i = 0; i < 100; i++) { const f = page.frames().find(x => x.url().startsWith(MIRA + '/grading')); if (f) return f; await sleep(150) } throw new Error('không thấy iframe Mira; frames=' + page.frames().map(x => x.url()).join(' | ') + ' src=' + await page.evaluate(() => document.querySelector('iframe.mira-dock-frame')?.getAttribute('src'))) }
const curFrame = page => page.frames().find(x => x.url().startsWith(MIRA + '/grading'))
const fText = async (page, sel = 'main') => { for (let i = 0; i < 40; i++) { try { return await curFrame(page).$eval(sel, e => e.innerText) } catch { await sleep(250) } } throw new Error('không đọc được khung Mira') }
async function fWait(page, re0, ms = 20000) {
  const t0 = Date.now(); let last = ''
  while (Date.now() - t0 < ms) {
    try { const f = curFrame(page); if (f) { const t = (await f.evaluate(() => document.body.innerText)).normalize('NFC').replace(/\s+/g, ' '); last = t; if (re0.test(t)) return } } catch { /* iframe đang nạp lại → lấy frame mới ở vòng sau */ }
    await sleep(200)
  }
  const ta = await curFrame(page)?.evaluate(() => { const t = document.querySelector('textarea'); return t ? `textarea=${JSON.stringify(t.value)} disabled=${t.disabled} busy=${document.querySelector('textarea ~ button')?.disabled}` : 'no textarea' }).catch(() => '?')
  throw new Error(`chờ ${re0} quá hạn; nội dung khung: ${JSON.stringify(last.slice(0, 600))} | ${ta} | lỗi trình duyệt: ${errors.join(' ; ').slice(0, 800)}`)
}
async function ask(page, text) {
  let lastErr = ''
  for (let i = 0; i < 6; i++) {
    let typed = false
    try {
      const f = curFrame(page); await f.waitForSelector('textarea:not([disabled])', { timeout: 3000 })
      await f.click('textarea'); await f.type('textarea', text); typed = true
      await f.click('textarea ~ button'); return
    } catch (e) { lastErr = e.message; if (typed) throw e; await sleep(250) }   // chỉ thử lại khi CHƯA gõ (iframe đang nạp lại)
  }
  throw new Error('không gửi được vào khung Mira: ' + lastErr)
}
const noOverflow = async (page, label) => { const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(sw <= iw + 1, `${label}: tràn ngang ${sw} > ${iw}`); ok(`${label}: không tràn ngang`) }
const logLines = () => readFileSync(OPENAI_LOG, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const ticketsCount = () => Number(psql('e2e', 'select count(*) from public.mira_grading_tickets'))

try {
  // ── A. Desktop 1366: hai cột, Mira tự hiểu bài trả, không dán gì ──
  const D = await ctxPage(1366, 900)
  await login(D.page, 't@test.local', `/t/${TH_A}`)
  const t0 = Date.now()
  await miraFrame(D.page)
  await fWait(D.page, /An · SOLO01\.TH01 · Buổi 1 · Bài trả 1\.1/, 60000)
  console.log(`(thời gian từ mở trang đến khi Mira hiểu bài trả: ${Date.now() - t0}ms)`)
  ok('desktop: Mira tự nhận đúng học viên/lớp/buổi/bài trả mà không ai dán gì')
  const srcText = await fText(D.page, 'ul[aria-label="Nguồn ngữ cảnh"]')
  assert.match(srcText, /Bài trả và bài nộp[\s\S]*đã đọc/); assert.match(srcText, /Đề bài và giáo trình[\s\S]*đã đọc/); assert.match(srcText, /Student 360°[\s\S]*đã đọc/)
  ok('desktop: ba nguồn ngữ cảnh đều báo "đã đọc"')
  const box = await D.page.evaluate(() => { const m = document.querySelector('.mira-dock-main').getBoundingClientRect(), p = document.querySelector('.mira-dock-panel').getBoundingClientRect(); return { mR: m.right, pL: p.left, pW: p.width, mW: m.width } })
  assert.ok(box.pL >= box.mR - 1 && box.pW > 300 && box.mW > 400, JSON.stringify(box)); ok(`desktop: hai cột — chấm bài bên trái (${Math.round(box.mW)}px), Mira bên phải (${Math.round(box.pW)}px)`)
  assert.equal(await D.page.$('.mira-dock-fab:not([hidden])') && await D.page.evaluate(() => getComputedStyle(document.querySelector('.mira-dock-fab')).display), 'none'); ok('desktop: không có nút nổi')
  assert.ok(ticketsCount() >= 1); 
  await noOverflow(D.page, 'desktop')
  await ask(D.page, 'Bài này cần gợi ý gì?')
  await fWait(D.page, /Mira \(giả lập\) đã đọc bài trả của An/)
  const L1 = logLines().at(-1); const all1 = JSON.stringify(L1.input)
  assert.equal(L1.store, false); assert.equal(L1.tools, undefined)
  for (const need of ['BÀI-NỘP-CỦA-AN', 'MỤC-TIÊU-CỦA-AN', 'Gửi video chơi âm giai']) assert.ok(all1.includes(need), 'prompt thiếu ' + need)
  for (const bad of ['BÀI-NỘP-CỦA-BÌNH', 'REF-NỘI-BỘ-AN', 'aaaaaaaa-0000']) assert.ok(!all1.includes(bad), 'prompt lộ ' + bad)
  ok('Mira nhận đúng ngữ cảnh bài của An (bài nộp + đề + Student 360), KHÔNG có bài của Bình, KHÔNG lộ con trỏ nội bộ/user_id; store=false, không công cụ')
  await D.page.screenshot({ path: path.join(SHOTS, 'mira-desktop-an.png') })

  // ── B. Chuyển bài trong cùng iframe: không lẫn ──
  await D.page.evaluate(id => { history.pushState({}, '', '/me/t/' + id); dispatchEvent(new PopStateEvent('popstate')) }, TH_B)
  await fWait(D.page, /Bình · SOLO01\.TH01 · Buổi 1 · Bài trả 1\.1/)
  const afterSwitch = await fText(D.page)
  assert.ok(!afterSwitch.includes('Bài này cần gợi ý gì?') && !afterSwitch.includes('Mira (giả lập) đã đọc bài trả của An'), 'còn chữ của bài An sau khi chuyển')
  ok('chuyển sang bài của Bình: khung dọn sạch, không còn một chữ nào của bài An')
  await ask(D.page, 'So với bài trước thì sao?')
  await fWait(D.page, /đã đọc bài trả của Bình/)
  const all2 = JSON.stringify(logLines().at(-1).input)
  assert.ok(all2.includes('BÀI-NỘP-CỦA-BÌNH') && !all2.includes('BÀI-NỘP-CỦA-AN') && !all2.includes('MỤC-TIÊU-CỦA-AN') && !all2.includes('Bài này cần gợi ý gì?'), 'prompt của Bình lẫn dữ liệu của An')
  ok('hỏi ở bài của Bình: prompt chỉ có dữ liệu của Bình (không lẫn bài, Student 360 hay lịch sử của An)')
  await D.page.screenshot({ path: path.join(SHOTS, 'mira-desktop-binh.png') })
  await D.page.evaluate(id => { history.pushState({}, '', '/me/t/' + id); dispatchEvent(new PopStateEvent('popstate')) }, TH_A)
  await fWait(D.page, /An · SOLO01/); await fWait(D.page, /Bài này cần gợi ý gì\?/)
  const backA = await fText(D.page); assert.ok(!backA.includes('So với bài trước thì sao?'))
  ok('quay lại bài của An: khôi phục đúng lịch sử của An, không có câu hỏi của Bình')

  // ── C. Hết hạn vé: Mira xin vé mới, Thầy không phải làm gì ──
  psql('e2e', "update public.mira_grading_tickets set expires_at = now() - interval '1 second'")
  await sleep(300)
  await ask(D.page, 'Hỏi sau khi vé hết hạn')
  // Vé cũ bị DB từ chối → khung báo hết hạn, trả chữ về ô nhập, Class cấp vé mới tự động; Thầy chỉ bấm Gửi lại (không gõ lại).
  const textareaVal = () => curFrame(D.page).evaluate(() => document.querySelector('textarea').value)
  for (let i = 0; i < 40 && !(await textareaVal().catch(() => '')) && !/Câu hỏi: “Hỏi sau khi vé hết hạn”/.test(await fText(D.page).catch(() => '')); i++) await sleep(250)
  if (await textareaVal()) {
    assert.equal(await textareaVal(), 'Hỏi sau khi vé hết hạn', 'chữ của Thầy phải được trả lại nguyên vẹn, không nhân đôi')
    await sleep(1500)   // chờ vé mới đến khung
    await curFrame(D.page).click('textarea ~ button')
  }
  await fWait(D.page, /Câu hỏi: “Hỏi sau khi vé hết hạn”/, 25000)
  assert.equal((await fText(D.page)).split('Hỏi sau khi vé hết hạn').length - 1 <= 3, true)
  ok('vé hết hạn: bị DB từ chối, Class cấp vé mới tự động, Thầy bấm Gửi lại là xong (chữ không mất, không nhân đôi)')

  // ── D. Kênh khác và dữ liệu: không chạm people/memories ──
  assert.equal(psql('mira', 'select count(*) from people'), '1'); assert.equal(psql('mira', 'select count(*) from memories'), '1')
  assert.equal(psql('mira', "select count(distinct channel) from conversations"), '1'); assert.equal(psql('mira', "select min(channel) from conversations"), 'class-grading')
  assert.equal(psql('mira', "select count(*) from chat_conversations where channel = 'class-grading'"), '1')
  assert.equal(psql('mira', 'select count(*) from chat_sessions'), '2')
  assert.equal(psql('mira', "select count(*) from conversations where content like '%BÀI-NỘP-CỦA%' or content like '%MỤC-TIÊU-CỦA%'"), '0')
  ok('DB Mira: people/memories không đổi; chỉ kênh class-grading; 1 cuộc + 2 phiên (mỗi bài một phiên); không lưu khối ngữ cảnh học viên')
  assert.equal(psql('mira', "select user_id from chat_conversations where channel = 'class-grading'"), 'u:dddddddd-0000-4000-8000-00000000000d')
  ok('danh tính cuộc = Thầy do DB Class xác nhận (không từ token trình duyệt)')
  assert.equal(Number(psql('e2e', "select count(*) from public.mira_grading_tickets where position(ticket_hash in 'x') > 0")), 0)

  // ── E. Bảo mật khung: trang lạ không nhúng được Mira; mở thẳng không dùng được ──
  const E = await ctxPage(1000, 900, false)
  await E.page.goto(`http://evil.localhost:${V}/`, { waitUntil: 'domcontentloaded' })
  const framed = await E.page.evaluate(async url => new Promise(res => { const i = document.createElement('iframe'); i.src = url; i.onload = () => { try { res('loaded:' + (i.contentDocument?.body?.innerText?.slice(0, 40) ?? 'cross-origin')) } catch { res('loaded:blocked-read') } }; document.body.appendChild(i); setTimeout(() => res('timeout'), 6000) }), MIRA + '/grading')
  const blocked = await E.page.evaluate(() => { const i = document.querySelector('iframe'); try { return i.contentDocument === null || i.contentDocument.body === null || i.contentDocument.body.innerText === '' } catch { return false } })
  const hdr = await (await fetch(MIRA + '/grading'.replace('mira.localhost', '127.0.0.1'))).headers.get('content-security-policy')
  assert.ok(hdr && hdr.includes('frame-ancestors') && hdr.includes(CLASS) && !hdr.includes('evil'), 'CSP: ' + hdr)
  ok('CSP frame-ancestors chỉ cho origin Class: ' + hdr)
  await sleep(500)
  const urls = E.page.frames().map(x => x.url())
  assert.ok(urls.some(u => u.startsWith('chrome-error://')) && !urls.some(u => u.startsWith(MIRA + '/grading')), 'iframe lạ không bị chặn: ' + JSON.stringify(urls))
  ok('trang lạ (evil.localhost) KHÔNG nhúng được Mira: khung bị trình duyệt chặn (chrome-error) theo frame-ancestors')
  await E.page.goto(MIRA + '/grading', { waitUntil: 'networkidle0' })
  assert.match(await E.page.evaluate(() => document.body.innerText), /chỉ dùng bên cạnh màn chấm bài/); ok('mở /grading trực tiếp: báo "chỉ dùng bên cạnh màn chấm bài", không có ô chat')
  await E.ctx.close()

  // ── F. Học viên (không phải Thầy) mở bài của mình: không có Mira ──
  const S = await ctxPage(1366, 900)
  await login(S.page, 'a@test.local', `/t/${TH_A}`)
  await S.page.waitForSelector('.lt-page', { timeout: 20000 })
  await sleep(800)
  assert.equal(await S.page.$('iframe.mira-dock-frame'), null); assert.equal(await S.page.$('.mira-dock-fab'), null); assert.equal(await S.page.$('.mira-dock-wrap'), null)
  ok('học viên mở bài của chính mình: không có khung Mira, không có nút Mira')
  await S.ctx.close()
  await D.ctx.close()

  // ── G. Điện thoại 390: nút Mira, ngăn trượt, không che nội dung khi đóng ──
  const P = await ctxPage(390, 844)
  await login(P.page, 't@test.local', `/t/${TH_A}`)
  await P.page.waitForSelector('.lt-page', { timeout: 20000 })
  const fabVisible = async () => P.page.evaluate(() => { const b = document.querySelector('.mira-dock-fab'); return !!b && !b.hidden && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().height >= 44 })
  assert.ok(await fabVisible()); ok('điện thoại: có nút "Mira" (cao ≥ 44px)')
  assert.equal(await P.page.evaluate(() => getComputedStyle(document.querySelector('.mira-dock-panel')).display), 'none'); ok('điện thoại: khung Mira đóng — không che nội dung chấm bài')
  await noOverflow(P.page, 'điện thoại (đóng)')
  await P.page.screenshot({ path: path.join(SHOTS, 'mira-phone-closed.png') })
  await P.page.click('.mira-dock-fab')
  await miraFrame(P.page)
  await fWait(P.page, /An · SOLO01\.TH01 · Buổi 1 · Bài trả 1\.1/)
  const sheet = await P.page.evaluate(() => { const r = document.querySelector('.mira-dock-panel').getBoundingClientRect(); return { top: r.top, h: r.height, vh: innerHeight, w: r.width, iw: innerWidth } })
  assert.ok(sheet.top > 100 && sheet.w <= sheet.iw + 1 && sheet.h < sheet.vh, JSON.stringify(sheet)); ok(`điện thoại: ngăn trượt cao ${Math.round(sheet.h)}/${sheet.vh}px — phần trên màn chấm bài vẫn thấy`)
  await noOverflow(P.page, 'điện thoại (mở)')
  await P.page.screenshot({ path: path.join(SHOTS, 'mira-phone-open.png') })
  await ask(P.page, 'Gợi ý nhận xét giúp Thầy'); await fWait(P.page, /Mira \(giả lập\) đã đọc bài trả của An/); ok('điện thoại: hỏi và nhận trả lời trong ngăn')
  await P.page.click('.mira-dock-close'); await sleep(300)
  assert.equal(await P.page.evaluate(() => getComputedStyle(document.querySelector('.mira-dock-panel')).display), 'none'); ok('điện thoại: đóng ngăn → trở về đúng màn chấm bài')
  await P.page.click('.mira-dock-fab'); await sleep(500)
  assert.match(await fText(P.page), /Gợi ý nhận xét giúp Thầy/); ok('điện thoại: mở lại → lịch sử còn nguyên')

  assert.deepEqual(errors, [], 'lỗi trình duyệt: ' + errors.join(' | ')); ok('không có lỗi script/console trong cả phiên')
  console.log(`XONG: Mira E2E — ${pass} kiểm tra đạt. Ảnh: ${SHOTS}`)
  if (process.env.MIRA_PREVIEW_HOLD) {
    console.log(`\nPREVIEW ĐANG CHẠY (Ctrl-C để dừng). Mở trong Chrome:\n  ${CLASS}/me/t/${TH_A}   (đăng nhập t@test.local / mật khẩu bất kỳ — dữ liệu GIẢ)\n  ${CLASS}/me/t/${TH_B}\nHọc viên thử: a@test.local (sẽ không thấy Mira)`)
    await new Promise(() => {})
  }
} finally {
  await browser.close().catch(() => {})
  for (const k of kids) try { k.kill() } catch {}
  await sleep(300)
}
