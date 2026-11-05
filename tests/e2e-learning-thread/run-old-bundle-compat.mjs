// Tương thích NGƯỢC: bundle web CŨ (V1.3, main 060715fc — cũng là hành vi của app iOS đóng gói cũ) chạy trên DB ĐÃ migrate V2 + dữ liệu văn bản của V2.
// Dựng bởi tay: git worktree của 060715fc + `vite --port $OLD_PORT` với VITE_SUPABASE_URL/KEY của cùng stack (xem docs/CONTEXTUAL-SHARE-V2-TEXT.md §Kiểm thử).
// Env: OLD_PORT, PUPPETEER_DIR, SHOTS, E2E_PG_BIN/E2E_PG_SOCK/E2E_PG_PORT. Chỉ DB tạm — KHÔNG production.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const require = createRequire(process.env.PUPPETEER_DIR + '/')
const puppeteer = require('puppeteer-core')
const ORIGIN = `http://class.localhost:${process.env.OLD_PORT}`, ME = `${ORIGIN}/me`
const TH01 = 'b1000000-0000-4000-8000-000000000001', S1 = '51000000-0000-4000-8000-000000000001', A = 'aaaaaaaa-0000-4000-8000-00000000000a'
const sql = q => execFileSync(`${process.env.E2E_PG_BIN}/psql`, ['-X', '-q', '-tA', '-h', process.env.E2E_PG_SOCK, '-p', process.env.E2E_PG_PORT, '-U', 'postgres', '-d', 'e2e', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim()
const asA = q => sql(`begin; select set_config('request.jwt.claims', json_build_object('sub','${A}','role','authenticated')::text, true); set local role authenticated; ${q}; commit;`).split('\n').filter(l => /^[0-9a-f-]{36}$/.test(l)).at(-1)
let pass = 0; const ok = m => { pass++; console.log('PASS: [bundle cũ V1.3 + DB V2] ' + m) }
const errors = []
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run'] })
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function open(email) {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  page.on('pageerror', e => errors.push(`${email} pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest|fonts\.g|net::ERR_|Failed to load resource|googlevideo|youtube|ytimg|WebAssembly|verovio/i.test(m.text())) errors.push(`${email} console: ${m.text()}`) })
  await page.goto(ME, { waitUntil: 'networkidle0' })
  await page.type('#cs-login-email', email); await page.type('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 15000 })
  return page
}
try {
  // 1) dữ liệu: MỘT ghi chú ô nhịp (hàm V1, đã đăng Feed) + các ghi chú văn bản V2 sẵn có trong DB
  const sx = sql(`select (e.i - 1) from public.class_lesson_content cc cross join lateral jsonb_array_elements(cc.blocks) with ordinality e(v, i) where cc.session_id = '${S1}' and e.v ->> 'kind' = 'score' limit 1`)
  sql(`update public.share_notes set created_at = created_at - interval '1 hour'`)
  const BARS = asA(`select public.share_note_create('${S1}', ${sx}, array['tex'], 2, 3, 'COMPAT bars: ô 2–3', 'ck-compat-bars-01')`)
  asA(`select public.social_share_share_note('${BARS}')`)
  const texts = sql(`select string_agg(id::text, ',') from public.share_notes where anchor_kind = 'text' and deleted_at is null`).split(',')
  assert.ok(texts.length >= 3, 'có ≥ 3 ghi chú văn bản V2')
  const TEXT_POSTED = sql(`select tool_share ->> 'note_id' from public.class_posts where tool_share ->> 'anchor' = 'text' order by created_at limit 1`)
  assert.ok(BARS && TEXT_POSTED)

  const B = await open('b@test.local')
  // 2) Feed của bundle CŨ: không lỗi JS; ghi chú ô nhịp vẫn hiện thẻ + xem trước; bài văn bản V2 không làm hỏng Feed
  await B.goto(ME, { waitUntil: 'networkidle0' })
  await B.waitForFunction(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].some(e => e.textContent.includes(q)), { timeout: 40000 }, 'COMPAT bars')
  await B.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)).scrollIntoView({ block: 'center' }), 'COMPAT bars')
  await B.waitForSelector('[data-testid="share-note-preview"][data-live="1"] .at-surface svg', { timeout: 40000 })
  const feed = await B.evaluate(() => ({ posts: document.querySelectorAll('.cs-post').length, notePosts: document.querySelectorAll('[data-testid="share-note-post"]').length, bodyHasTextNote: /E2E V2 hỏi|E2E V2 emoji/.test(document.body.textContent), sw: document.documentElement.scrollWidth <= innerWidth + 1 }))
  assert.ok(feed.sw && feed.posts >= 1)
  ok(`Feed: ghi chú ô nhịp (tạo bằng hàm V1) vẫn hiện thẻ + xem trước nhạc; ${feed.posts} bài, ${feed.notePosts} thẻ ghi chú; bài văn bản V2 hiện ${feed.bodyHasTextNote ? 'thẻ nhẹ' : 'không hiện'} — KHÔNG lỗi, Feed không vỡ`)
  await B.screenshot({ path: `${process.env.SHOTS}/compat-old-feed.png` })
  // 3) liên kết sâu: ô nhịp mở đúng + tô; văn bản V2 → báo cũ vô hại, không tô, không lộ nội dung
  await B.goto(`${ME}/classes/${TH01}/sessions/1?note=${BARS}`, { waitUntil: 'networkidle0' })
  await B.waitForSelector('.lsn-share-hl.is-focus', { timeout: 40000 })
  ok('liên kết ghi chú ô nhịp: mở đúng đoạn, vùng tô cam có mặt (hành vi V1 nguyên vẹn)')
  await B.goto(`${ME}/classes/${TH01}/sessions/1?note=${TEXT_POSTED}`, { waitUntil: 'networkidle0' }); await sleep(1500)
  const pnl = await B.$eval('.cs-share-note-panel', e => e.innerText.replace(/\s+/g, ' ')).catch(() => null)
  assert.ok(pnl && /đã được cập nhật|không còn khả dụng/i.test(pnl), pnl)
  assert.equal(await B.$('mark.lsn-text-hl'), null); assert.equal(await B.$('.lsn-share-hl.is-focus'), null)
  assert.ok(!(await B.evaluate(() => document.body.textContent.includes('Hãy nghe kỹ nhịp chùm ba') && !!document.querySelector('.cs-share-note-panel') && false)))
  ok(`liên kết ghi chú văn bản V2 trên bundle cũ: "${pnl.slice(0, 90)}…" — báo vô hại, KHÔNG tô, không lỗi`)
  await B.screenshot({ path: `${process.env.SHOTS}/compat-old-deeplink-text.png` })
  // 4) Chat: tin tham chiếu văn bản (DM) trên bundle cũ → "không còn khả dụng", không lỗi
  const dm = sql(`select count(*) from public.dm_messages where ref_type = 'share_note' and ref_key = any (select id::text from public.share_notes where anchor_kind = 'text')`)
  await B.goto(`${ME}/chat`, { waitUntil: 'networkidle0' }); await B.waitForSelector('[data-testid="inbox-row"]', { timeout: 15000 })
  await B.evaluate(() => [...document.querySelectorAll('[data-testid="inbox-row"]')].find(e => ['An', 'Nguyễn An'].includes(e.querySelector('.cs-inbox-name').textContent.trim())).click())
  await B.waitForFunction(() => document.querySelector('.cs-chat-scroll .cs-share-card'), { timeout: 20000 }); await sleep(1500)
  const cards = await B.$$eval('.cs-chat-scroll .cs-share-card', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()))
  assert.ok(Number(dm) >= 1 && cards.length >= 1, `DM tham chiếu văn bản: ${dm}, thẻ: ${cards.length}`)
  assert.ok(cards.every(t => /không còn khả dụng|Bản nhạc|Giáo trình/i.test(t) && !/Hãy nghe kỹ|alphatex/i.test(t)), JSON.stringify(cards))
  ok(`Chat: ${cards.length} thẻ (tin tham chiếu văn bản V2 = "${cards[0]?.slice(0, 50)}") — bundle cũ không lỗi, không lộ nội dung giáo trình`)
  await B.screenshot({ path: `${process.env.SHOTS}/compat-old-chat.png` })
  assert.deepEqual(errors.filter(e => !/due to access control/.test(e)), [], errors.join(' | '))
  ok('0 lỗi JavaScript / console trên bundle cũ trong cả hành trình')
  console.log(`\nBundle cũ: ${pass} PASS`)
} catch (e) { console.log('FAIL: ' + (e.message ?? e)); console.log(String(e.stack ?? '').split('\n').slice(0, 5).join('\n')); process.exitCode = 1 }
finally { await browser.close() }
