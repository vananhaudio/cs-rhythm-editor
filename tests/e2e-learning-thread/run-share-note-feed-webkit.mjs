// E2E Share Note FEED PREVIEW V1 trên WebKit (Playwright) — chạy SAU run-share-note-feed.mjs (dùng 6 bài Feed đã đăng). WebKit ≠ Safari iOS thật.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

const require = createRequire((process.env.PLAYWRIGHT_DIR || process.env.PUPPETEER_DIR) + '/')
const { webkit } = require('playwright-core')
const ORIGIN = `http://class.localhost:${process.env.VITE_PORT}`, ME = `${ORIGIN}/me`
const SHOTS = process.env.SHOTS
const browser = await webkit.launch()
let pass = 0
const ok = m => { pass++; console.log('PASS: [webkit feed] ' + m) }
const errors = []
async function open(email, vp) {
  const ctx = await browser.newContext(vp); const page = await ctx.newPage()
  page.reqs = []; page.on('request', r => page.reqs.push(r.url()))
  page.on('pageerror', e => errors.push(`${email} pageerror: ${e.message}`))
  await page.goto(ME, { waitUntil: 'networkidle' })
  await page.fill('#cs-login-email', email); await page.fill('#cs-login-pass', 'e2e'); await page.click('.cs-guest-submit')
  await page.waitForSelector('.cs-account', { timeout: 20000 })
  await page.goto(ME, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="share-note-post"]').length >= 6, null, { timeout: 40000 })
  return page
}
const surfaces = p => p.evaluate(() => ({ live: document.querySelectorAll('[data-testid="share-note-preview"][data-live="1"]').length, surfaces: document.querySelectorAll('.at-surface').length }))
const printed = p => p.evaluate(() => { const i = [...document.querySelectorAll('[data-testid="share-note-post"]')].findIndex(e => e.querySelector('[data-live="1"] .at-surface svg'))
  return { i, bars: i < 0 ? [] : [...document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelectorAll('svg text')].filter(t => /^\d+$/.test(t.textContent.trim()) && /c80000|rgb\(200, ?0, ?0\)/i.test(t.getAttribute('fill') || '')).map(t => Number(t.textContent.trim())),
    q: i < 0 ? '' : document.querySelectorAll('[data-testid="share-note-post"]')[i].textContent, sw: document.documentElement.scrollWidth <= innerWidth + 1 } })

for (const [name, vp] of [['iPhone 390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['desktop 1280', { viewport: { width: 1280, height: 900 } }]]) {
  const B = await open('b@test.local', vp)
  await B.evaluate(() => document.querySelector('[data-testid="share-note-post"]').scrollIntoView({ block: 'center' }))
  await B.waitForSelector('[data-testid="share-note-preview"][data-live="1"] .at-surface svg', { timeout: 40000 }); await B.waitForTimeout(900)
  const p = await printed(B)
  const m = p.q.match(/(?:FEED|LYR|CTX)-\d Ô (\d+)(?:–(\d+))?/); assert.ok(m, p.q.slice(0, 80)); m.splice(1, 0, null)   // m[2] = ô đầu
  // V1.1: ô in ra đầu tiên = ô bắt đầu vẽ = vùng khoanh lùi ≤ 2 ô ngữ cảnh (không lùi quá ô 1); vùng tô cam có mặt và kế hoạch khớp
  const plan = await B.evaluate(() => { const pv = [...document.querySelectorAll('[data-testid="share-note-preview"][data-live="1"]')][0]; return { plan: (pv.getAttribute('data-plan') || '').split(',').map(Number), hl: pv.querySelectorAll('.lsn-excerpt-hl').length } })
  assert.equal(plan.plan[2], Number(m[2]), `vùng khoanh bắt đầu ĐÚNG ô ${m[2]}: ${plan.plan}`)
  assert.equal(Math.min(...p.bars), plan.plan[0], `ô in ra đầu tiên = ô bắt đầu vẽ ${plan.plan[0]}: ${p.bars}`)
  assert.ok(plan.plan[2] - plan.plan[0] >= 0 && plan.plan[2] - plan.plan[0] <= 2, `ngữ cảnh trước ≤ 2 ô (${plan.plan})`)
  assert.ok(plan.hl >= 1, 'có vùng tô cam cho ô khoanh')
  assert.ok(p.sw, 'không tràn ngang')
  let maxLive = 0, maxSurf = 0
  const total = await B.evaluate(() => document.querySelectorAll('[data-testid="share-note-post"]').length)
  for (let k = 0; k < 2; k++) for (let i = 0; i < total; i++) { await B.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), i); await B.waitForTimeout(800); const s = await surfaces(B); maxLive = Math.max(maxLive, s.live); maxSurf = Math.max(maxSurf, s.surfaces) }
  assert.ok(maxLive <= 2 && maxSurf <= 2, `renderer sống tối đa 2: ${maxLive}/${maxSurf}`)
  await B.screenshot({ path: `${SHOTS}/fp-wk-${name.startsWith('iPhone') ? 'iphone' : 'desktop'}-feed.png` })

  if (name.startsWith('iPhone')) {
    // Bản nhạc CÓ LỜI (Buổi 2 · Diễm xưa) trên WebKit 390: đúng 2 dòng, ô 5–6, đủ lời, không tràn ngang, khoảng trắng đáy gọn
    const li = await B.evaluate(() => [...document.querySelectorAll('[data-testid="share-note-post"]')].findIndex(e => e.textContent.includes('LYR-1')))
    assert.ok(li >= 0, 'có thẻ LYR-1')
    await B.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), li)
    await B.waitForFunction(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('[data-live="1"] .at-surface svg') && !document.querySelectorAll('[data-testid="share-note-post"]')[i].querySelector('.lsn-score-msg'), li, { timeout: 40000 }); await B.waitForTimeout(900)
    const info = await B.evaluate(async i => {
      const card = document.querySelectorAll('[data-testid="share-note-post"]')[i]
      const texts = [...card.querySelectorAll('svg text')].map(t => t.textContent.trim())
      const bars = [...card.querySelectorAll('svg text')].filter(t => /^\d+$/.test(t.textContent.trim()) && /c80000|rgb\(200, ?0, ?0\)/i.test(t.getAttribute('fill') || '')).map(t => Number(t.textContent.trim()))
      return { rows: texts.filter(x => x.includes('\uE050')).length, bars, texts, sw: document.documentElement.scrollWidth <= innerWidth + 1, label: card.querySelector('.cs-tool-share-detail').textContent }
    }, li)
    assert.equal(info.rows, 2, `2 dòng (có ${info.rows})`); assert.deepEqual(info.bars, [5, 6]); assert.ok(info.sw)
    for (const w of ['Nghe', 'lá', 'thu', 'mưa', 'reo', 'mòn', 'gót', 'nhỏ']) assert.ok(info.texts.includes(w), `đủ lời: thiếu "${w}"`)
    assert.ok(!info.texts.includes('Đường')); assert.match(info.label, /hiện 2 ô đầu/)
    const host = B.locator('[data-testid="share-note-post"]').nth(li).locator('.cs-sn-preview .lsn-score-host')
    const png = await host.screenshot()
    const gap = await B.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data; const dpr = devicePixelRatio || 1; let last = -1
      for (let y = c.height - 1; y >= 0 && last < 0; y--) for (let xx = 0; xx < c.width; xx++) { const k = (y * c.width + xx) * 4; if (d[k + 3] > 0 && (d[k] < 225 || d[k + 1] < 225 || d[k + 2] < 225)) { last = y; break } }
      return { h: c.height / dpr, ink: (last + 1) / dpr, dpr }
    }, png.toString('base64'))
    assert.ok(gap.h - gap.ink <= 22 && gap.h - gap.ink >= 3, `trắng đáy gọn mà không cắt: ${gap.h - gap.ink}px`)
    await B.screenshot({ path: `${SHOTS}/fp-wk-iphone-co-loi.png` })
    ok(`iPhone 390 bản CÓ LỜI: đúng 2 dòng, ô ${info.bars}, đủ lời, không tràn ngang, trắng đáy ${Math.round(gap.h - gap.ink)}px`)
  }
  await B.evaluate(() => { const els = [...document.querySelectorAll('[data-testid="share-note-post"]')]; els.find(e => e.querySelector('.cs-sn-preview'))?.scrollIntoView({ block: 'center' }) }); await B.waitForTimeout(700)
  await Promise.all([B.waitForURL(/note=/, { timeout: 30000 }), B.locator('.cs-sn-preview').first().click()])
  await B.waitForSelector('.lsn-share-hl.is-focus', { timeout: 40000 })
  ok(`${name}: trích đoạn từ ô ${m[2]} (in ra ${p.bars}), không tràn ngang; cuộn 6 thẻ × 2: sống tối đa ${maxLive}, bề mặt tối đa ${maxSurf}; bấm → mở đúng đoạn (vùng tô)`)
}
// V1.3 trên WebKit (iPhone 390): khung GỌN mặc định → "Xem đầy đủ" → "Thu gọn" trên thẻ CTX-1 (Tác phẩm thực hành)
{
  const W = await open('b@test.local', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const Q = 'CTX-1 Ô 2–3'
  await W.waitForFunction(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].some(e => e.textContent.includes(q)), Q, { timeout: 40000 })
  const st = q => W.evaluate(q => { const c = [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)); const n = c.querySelector('.lsn-piece-note'), b = c.querySelector('[data-testid="share-note-more"]')
    return { rows: [...c.querySelectorAll('svg text')].filter(t => t.textContent.includes('\uE050')).length, btn: b?.textContent.trim() ?? null, cta: c.querySelector('[data-testid="share-note-open"]')?.textContent.trim(), list: !!c.querySelector('.lsn-rep-list'), marks: !!c.querySelector('.lsn-marks'),
      clamped: n ? n.scrollHeight > n.clientHeight + 1 : null, plan: c.querySelector('[data-testid="share-note-preview"]')?.getAttribute('data-plan'), h: Math.round(c.getBoundingClientRect().height), sw: document.documentElement.scrollWidth <= innerWidth + 1,
      busy: !!c.querySelector('.lsn-score-msg') || !c.querySelector('[data-live="1"] .at-surface svg') } }, q)
  await W.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)).scrollIntoView({ block: 'center' }), Q)
  await W.waitForFunction(async q => { const c = [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)); return !!c.querySelector('[data-live="1"] .at-surface svg') && !c.querySelector('.lsn-score-msg') }, Q, { timeout: 40000 }); await W.waitForTimeout(900)
  const w0 = await st(Q)
  assert.equal(w0.rows, 1, `WebKit gọn: 1 dòng nhạc (có ${w0.rows})`); assert.equal(w0.btn, 'Xem đầy đủ'); assert.equal(w0.cta, 'Mở trong giáo trình'); assert.ok(!w0.list && !w0.marks && w0.clamped && w0.sw)
  await W.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)).querySelector('[data-testid="share-note-more"]').click(), Q)
  await W.waitForFunction(q => { const c = [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)); return c.querySelector('[data-testid="share-note-more"]')?.textContent.trim() === 'Thu gọn' && !!c.querySelector('.lsn-rep-list') && !c.querySelector('.lsn-score-msg') && [...c.querySelectorAll('svg text')].filter(t => t.textContent.includes('\uE050')).length === 2 }, Q, { timeout: 20000 }); await W.waitForTimeout(700)
  const w1 = await st(Q)
  assert.equal(w1.rows, 2); assert.ok(w1.list && w1.marks && !w1.clamped && w1.sw && w1.h > w0.h)
  assert.deepEqual(w1.plan.split(',').slice(2).map(Number), [2, 3], 'vùng khoanh không đổi')
  await W.evaluate(q => [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)).querySelector('[data-testid="share-note-more"]').click(), Q)
  await W.waitForFunction(q => { const c = [...document.querySelectorAll('[data-testid="share-note-post"]')].find(e => e.textContent.includes(q)); return c.querySelector('[data-testid="share-note-more"]')?.textContent.trim() === 'Xem đầy đủ' && !c.querySelector('.lsn-rep-list') && !c.querySelector('.lsn-score-msg') }, Q, { timeout: 20000 }); await W.waitForTimeout(700)
  const w2 = await st(Q); assert.equal(w2.rows, 1); assert.equal(w2.plan, w0.plan)
  ok(`iPhone 390 khung giáo trình: gọn ${w0.h}px (1 dòng nhạc, mô tả rút gọn) → "Xem đầy đủ" ${w1.h}px (2 dòng + dự kiến/marks) → "Thu gọn" ${w2.h}px; vùng khoanh không đổi, không tràn ngang`)
}
const C = await open('c@test.local', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
for (let i = 0; i < 6; i++) { await C.evaluate(i => document.querySelectorAll('[data-testid="share-note-post"]')[i].scrollIntoView({ block: 'center' }), i); await C.waitForTimeout(500) }
await C.waitForFunction(() => [...document.querySelectorAll('[data-testid="share-note-post"]')].filter(e => /chưa có quyền xem bản nhạc/.test(e.textContent)).length >= 6, null, { timeout: 40000 })
assert.equal((await surfaces(C)).surfaces, 0)
assert.equal(C.reqs.filter(u => /class_lesson_content|class_sessions/.test(u)).length, 0, 'Chi không đọc giáo trình')
ok('Chi (lớp khác): 6 thẻ chỉ câu hỏi + "chưa có quyền"; 0 bản nhạc; 0 yêu cầu đọc giáo trình')
// WebKit báo request bị HUỶ khi test chuyển trang (goto / bấm xem trước) giữa chừng thành pageerror "… due to access control checks" / "Importing a module script failed"
// (chunk lazy bị huỷ); Chrome không báo. Chỉ lọc ĐÚNG hai mẫu này (như run-share-note-webkit.mjs); còn lại là lỗi thật.
const noise = errors.filter(m => / due to access control checks\.$|Importing a module script failed/.test(m))
const real = errors.filter(m => !noise.includes(m))
assert.deepEqual(real, [], real.join('\n'))
console.log(`(bỏ qua ${noise.length} thông báo huỷ request do chuyển trang của WebKit)`)
console.log(`E2E SHARE NOTE FEED PREVIEW WEBKIT: ${pass} PASS`)
await browser.close()
