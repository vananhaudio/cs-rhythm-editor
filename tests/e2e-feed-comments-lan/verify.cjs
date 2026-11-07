// Kiểm tra stack xem tay (scripts/feed-comments-preview.sh start) bằng Playwright: node verify.cjs <host:cổng> chrome|webkit. Cần playwright-core (npm i playwright-core ở thư mục tạm). Mỗi lần chạy GHI dữ liệu thử → dừng/dựng lại stack trước lần sau.
const { chromium, webkit, devices } = require('playwright-core')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const [HOST, eng] = [process.argv[2], process.argv[3] || 'chrome']
const [V, P, A, D, T] = fs.readFileSync('/tmp/tva-fc-preview/ports', 'utf8').trim().split(' ')
const sql = q => execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', ['-X', '-tA', '-h', T, '-p', D, '-U', 'postgres', '-d', 'e2e', '-c', q]).toString().trim()
let fails = 0
const ok = (c, m) => { console.log((c ? 'PASS' : 'FAIL') + ': ' + m); if (!c) fails++ }
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function login(browser, email) {
  const ctx = await browser.newContext({ ...(eng === 'webkit' ? devices['iPhone 13'] : devices['iPhone SE']) })
  const page = await ctx.newPage(); const rpcs = [], hosts = new Set(), errs = [], ext = []
  page.on('request', r => { try { const u = new URL(r.url()); hosts.add(u.host); if (!(u.host === HOST || u.host.startsWith('192.168.'))) ext.push(r.method() + ' ' + u.host + u.pathname); const m = /\/rpc\/(\w+)/.exec(u.pathname); if (m) rpcs.push({ n: m[1], b: r.postData() }) } catch {} })
  page.on('pageerror', e => errs.push(e.message))
  await page.goto(`http://${HOST}/me`, { waitUntil: 'networkidle' })
  await page.fill('#cs-login-email', email); await page.fill('#cs-login-pass', 'x'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 20000 }); await page.waitForSelector('.cs-likebar-btn', { timeout: 20000 })
  return { ctx, page, rpcs, hosts, errs, ext }
}
const CARDS = { social: 'article.cs-post:not(.lt-feed-card)', thread: 'article.lt-feed-card:not(.cs-pub-card)', pub: 'article.cs-pub-card' }
const sel = k => k === 'social' ? '(//article[contains(@class,"cs-post") and not(contains(@class,"lt-feed-card"))])[1]' : k === 'thread' ? '(//article[contains(@class,"lt-feed-card") and not(contains(@class,"cs-pub-card"))])[1]' : '(//article[contains(@class,"cs-pub-card")])[1]'
const card = (page, k) => page.locator('xpath=' + sel(k))
const ids = (page, k) => card(page, k).locator('[data-comment-id]').evaluateAll(e => e.map(x => x.getAttribute('data-comment-id')))
async function open(page, k) {
  await card(page, k).locator('.cs-likebar-btn', { hasText: 'Bình luận' }).first().click()
  await page.waitForFunction(() => document.querySelector('[data-comment-id]'), null, { timeout: 15000 })
  await sleep(500)
}
async function loadAll(page, k, firstKeep) {
  let guard = 0, keep = null
  for (;;) {
    const btn = card(page, k).locator('button', { hasText: 'Xem bình luận cũ hơn' })
    if (!(await btn.count()) || guard++ > 60) break
    await btn.first().scrollIntoViewIfNeeded()
    const before = await ids(page, k)
    const snap = await card(page, k).locator('[data-comment-id]').evaluateAll(els => { const e = els.find(x => x.getBoundingClientRect().top >= 0 && x.getBoundingClientRect().top < innerHeight); return e ? { id: e.getAttribute('data-comment-id'), top: e.getBoundingClientRect().top } : null })
    await btn.first().click()
    await page.waitForFunction(([c, n]) => document.querySelectorAll(c + ' [data-comment-id]').length > n || !document.evaluate('//button[contains(.,"Xem bình luận cũ hơn")]', document, null, 9, null).singleNodeValue, [null, before.length].map((x, i) => i ? x : 'article'), { timeout: 15000 }).catch(() => {})
    await sleep(350)
    if (snap && keep === null) { const t = await page.evaluate(id => { const e = document.querySelector(`[data-comment-id="${id}"]`); return e ? e.getBoundingClientRect().top : null }, snap.id); keep = t === null ? 'gone' : Math.abs(t - snap.top) }
  }
  return keep
}
;(async () => {
  const browser = eng === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' })
  const B = await login(browser, 'b@test.local'); const pg = B.page
  // 1) Social: trang đầu + tải hết + vị trí đọc
  await open(pg, 'social')
  const first = (await ids(pg, 'social')).length
  ok(first > 0 && first <= 25, `Social: mở bình luận → ${first} dòng đầu (trang, không phải cả 150)`)
    const keep = await loadAll(pg, 'social')
  const all = await ids(pg, 'social')
    ok(B.rpcs.some(r => r.n === 'class_comments_page_safe'), 'Social: frontend gọi RPC PHÂN TRANG MỚI class_comments_page_safe')
  ok(all.length === 150 && new Set(all).size === 150, `Social: tải hết ${all.length}/150 bình luận, không trùng`)
  ok(typeof keep === 'number' && keep <= 3, `Social: vị trí đọc giữ khi tải thêm (lệch ${keep}px)`)
  ok((await pg.locator('text=Đã xem hết bình luận').count()) > 0, 'Social: hiện "Đã xem hết bình luận"')
  // 2) Trả lời gốc cũ (#3) → p_parent_id đúng, nằm đúng nhóm
  const old = await pg.locator('xpath=' + sel('social') + '//li[@data-comment-id][.//*[contains(text(),"Gốc #3 ")]]').first()
  const oldId = await old.getAttribute('data-comment-id')
  await old.locator('.cs-cmt-reply').first().click()
  const ta = old.locator('textarea'); await ta.fill('TRẢ LỜI gốc cũ #3 (iPhone test)'); const n0 = B.rpcs.length
  await old.locator('.cs-cmt-send').click(); await sleep(1800)
  const sent = B.rpcs.slice(n0).find(r => r.n === 'class_comment_add' || /comment/.test(r.n) && /parent/.test(r.b || ''))
  ok(!!sent && (sent.b || '').includes(oldId), 'Social: trả lời gốc cũ gửi p_parent_id đúng gốc #3')
  ok((await old.locator('text=TRẢ LỜI gốc cũ #3').count()) > 0, 'Social: trả lời hiện ngay dưới đúng gốc #3')
  ok(sql(`select count(*) from class_post_comments where body like 'TRẢ LỜI gốc cũ #3%' and parent_comment_id='${oldId}'`) === '1', 'DB: trả lời có parent đúng')
  // 3) Thread + TeamLab: trang mới, tải hết, trả lời gốc cũ
  for (const [k, total, tag] of [['thread', 98, 'Thread gốc #2 '], ['pub', 62, 'TeamLab gốc #2 ']]) {
    const n1 = B.rpcs.length; await open(pg, k)
    ok(B.rpcs.slice(n1).some(r => r.n === 'feed_comment_page'), `${k}: frontend gọi RPC PHÂN TRANG MỚI feed_comment_page`)
    const k0 = (await ids(pg, k)).length; ok(k0 > 0 && k0 < 40, `${k}: trang đầu ${k0} dòng`)
    const kp = await loadAll(pg, k); const a = await ids(pg, k)
    ok(a.length === total && new Set(a).size === total, `${k}: tải hết ${a.length}/${total}, không trùng`)
    ok(typeof kp === 'number' ? kp <= 3 : kp === null, `${k}: vị trí đọc giữ (lệch ${kp}px)`)
    const oid = sql(`select id from feed_comments where body='${tag.trim()}'`)
    const o = pg.locator('xpath=' + sel(k) + `//*[@data-comment-id="${oid}"]/ancestor::li[contains(@class,"cs-cmt-node")][1]`).first(); await o.scrollIntoViewIfNeeded(); await o.locator('.cs-cmt-reply').first().click()
    await o.locator('textarea').fill(`TRẢ LỜI ${k} gốc cũ`); await o.locator('.cs-cmt-send').click(); await sleep(2000)
    ok(sql(`select count(*) from feed_comments where body='TRẢ LỜI ${k} gốc cũ' and parent_comment_id='${oid}'`) === '1', `${k}: trả lời gốc cũ → DB đúng parent`)
    ok((await o.locator(`text=TRẢ LỜI ${k} gốc cũ`).count()) > 0, `${k}: trả lời hiện dưới đúng gốc`)
  }
  // 4) Gửi bình luận gốc mới ở cả 3 nơi
  for (const k of ['social', 'thread', 'pub']) {
    const ta = card(pg, k).locator('textarea').last(); await ta.scrollIntoViewIfNeeded(); await ta.fill(`MỚI ${k} từ iPhone test`); await card(pg, k).locator('.cs-cmt-send').last().click(); await sleep(1800)
    ok((await card(pg, k).locator(`text=MỚI ${k} từ iPhone test`).count()) > 0, `${k}: gửi bình luận gốc → hiện ngay`)
  }
  // 5) Lỗi mạng khi tải thêm: mở ở Thread (đã tải hết) → dùng trang mới
  const C = await login(browser, 'c@test.local'); const pc = C.page
  await open(pc, 'social'); await pc.locator('button', { hasText: 'Xem bình luận cũ hơn' }).first().scrollIntoViewIfNeeded()
  const nb = (await ids(pc, 'social')).length
  await C.ctx.setOffline(true); await pc.locator('button', { hasText: 'Xem bình luận cũ hơn' }).first().click(); await sleep(1500)
  ok((await ids(pc, 'social')).length === nb, 'Mạng đứt: tải thêm lỗi nhưng KHÔNG mất bình luận đang xem')
  ok((await pc.locator('[role=alert] >> text=Thử lại').count()) > 0, 'Mạng đứt: có thông báo + nút Thử lại')
  await C.ctx.setOffline(false); await pc.locator('[role=alert] >> text=Thử lại').first().click(); await sleep(2000)
  ok((await ids(pc, 'social')).length > nb, 'Có mạng lại: Thử lại tải được thêm')
  // 6) Báo cáo + chặn (C trên bình luận của người khác)
  const other = pc.locator('xpath=' + sel('social') + '//li[@data-comment-id]//div[contains(@class,"cs-cmt")]').first()
  await other.locator('.cs-more-btn').first().click()
  const items = await pc.locator('[role=menuitem]').allTextContents(); ok(items.includes('Báo cáo') && !items.some(x => /Xoá|Sửa/.test(x)), `Quyền: người khác chỉ thấy Báo cáo/Chặn (${items.join(' · ')})`)
  await pc.keyboard.press('Escape')
  // 7) Xoá cascade (A, chủ gốc #12 có trả lời + trả lời lồng)
  const Aa = await login(browser, 'a@test.local'); const pa = Aa.page
  await open(pa, 'social'); await loadAll(pa, 'social')
  const rid = sql(`select id from class_post_comments where body like 'Gốc #12 %'`)
  const before = +sql(`select count(*) from class_post_comments where id='${rid}' or parent_comment_id='${rid}' or parent_comment_id in (select id from class_post_comments where parent_comment_id='${rid}')`)
  const li = pa.locator(`xpath=${sel('social')}//li[@data-comment-id="${rid}"]`); await li.scrollIntoViewIfNeeded()
  await li.locator('.cs-more-btn').first().click(); await pa.locator('[role=menuitem]', { hasText: 'Xoá' }).first().click()
  const dlg = pa.locator('[role=alertdialog]'); await dlg.waitFor()
  const txt = await dlg.innerText(); ok(/trả lời bên dưới \(nếu có\)/.test(txt) && !/\d/.test(txt), `Xoá: cảnh báo chung, không nêu số ("${txt.replace(/\n/g, ' ')}")`)
  await dlg.locator('button', { hasText: /^Xoá$/ }).click(); await sleep(2500)
  const left = +sql(`select count(*) from class_post_comments where id='${rid}' or parent_comment_id='${rid}' or parent_comment_id in (select id from class_post_comments where parent_comment_id='${rid}')`)
  ok(before === 3 && left === 0, `Xoá cascade: ${before} dòng (gốc + trả lời + lồng) → còn ${left} trong DB`)
  ok((await li.count()) === 0, 'Xoá: gốc biến khỏi giao diện')
  // 8) Fallback: RPC phân trang mất → đường cũ
  const F = await login(browser, 'b@test.local'); const pf = F.page
  await pf.route('**/rpc/feed_comment_page', r => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.feed_comment_page', details: null, hint: null }) }))
  await pf.route('**/rpc/class_comments_page_safe', r => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.class_comments_page_safe', details: null, hint: null }) }))
  await open(pf, 'social'); const fs1 = (await ids(pf, 'social')).length
  ok(fs1 > 0 && F.rpcs.some(r => r.n === 'class_comments_for_posts_safe' || /for_posts/.test(r.n)), `Fallback Social: thiếu RPC mới → dùng RPC cũ (${fs1} dòng)`)
  await open(pf, 'thread'); ok((await ids(pf, 'thread')).length > 0 && F.rpcs.some(r => r.n === 'feed_comment_list'), 'Fallback Thread: thiếu RPC mới → dùng feed_comment_list')
  // 9) Không production
  const hosts = [...new Set([...B.hosts, ...C.hosts, ...Aa.hosts, ...F.hosts])]
  const ext = [...new Set([B, C, Aa, F].flatMap(x => x.ext))]
  const bad = ext.filter(e => !(/^GET (fonts\.googleapis\.com|fonts\.gstatic\.com)/.test(e) || /^GET wojmdilyflffvdtpovmq\.supabase\.co\/storage\/v1\/object\/public\//.test(e)))
  ok(bad.length === 0, `Mọi thao tác ghi/RPC/đăng nhập chỉ vào LAN tạm; ngoài LAN chỉ có GET ảnh công khai + font (${ext.length} URL ngoài): ` + ext.map(e => e.replace(/\/storage.*\//, '/…/')).join(' · '))
  ok(![B, C, Aa, F].some(x => x.errs.length), 'Không có lỗi JS' + [B, C, Aa, F].flatMap(x => x.errs).join('|'))
  await B.page.screenshot({ path: `lan1-${eng}.png` })
  console.log(fails ? `\n${fails} FAIL` : '\nTẤT CẢ PASS'); await browser.close(); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('CRASH', e.message.slice(0, 400)); process.exit(2) })
