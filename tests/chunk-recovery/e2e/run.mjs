// E2E trình duyệt thật (Chrome): "học viên mở trang TRƯỚC deploy, khoanh SAU deploy" với đúng ChunkErrorBoundary/chunkRecovery của sản phẩm.
//   PUPPETEER_DIR=/path/chứa/node_modules/puppeteer-core node tests/chunk-recovery/e2e/run.mjs
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const req = createRequire(path.join(process.env.PUPPETEER_DIR ?? process.cwd(), 'x.js'))
const puppeteer = req('puppeteer-core')
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'chunkrec-'))
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

async function buildVersion(tag) {
  await build({ root: here, configFile: false, logLevel: 'error', plugins: [react()], define: { __BUILD__: JSON.stringify(tag) },
    build: { outDir: path.join(out, tag), emptyOutDir: true } })
}
await buildVersion('A'); await buildVersion('B')

let current = 'A', legacyFallback = true                       // legacyFallback=true: /* → index.html 200 như production CŨ; false: /assets/* thiếu → 404 như bản vá
const mime = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css' }
const server = http.createServer((rq, rs) => {
  const url = new URL(rq.url, 'http://x'); const root = path.join(out, current)
  let f = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname)
  if (fs.existsSync(f) && fs.statSync(f).isFile()) { rs.writeHead(200, { 'content-type': mime[path.extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }); return rs.end(fs.readFileSync(f)) }
  if (url.pathname.startsWith('/assets/') && !legacyFallback) { rs.writeHead(404, { 'content-type': 'text/plain' }); return rs.end('asset not found') }
  rs.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); rs.end(fs.readFileSync(path.join(root, 'index.html')))
})
await new Promise(r => server.listen(0, r)); const base = `http://127.0.0.1:${server.address().port}`
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
let fails = 0
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
const txt = (p, id) => p.$eval(`[data-testid="${id}"]`, e => e.textContent).catch(() => null)
const noFullPageError = p => p.evaluate(() => !document.body.innerText.includes('Có lỗi khi hiển thị'))
const text = p => p.evaluate(() => document.body.innerText)

for (const legacy of [true, false]) {
  const label = legacy ? 'SPA-fallback HTML 200 (production cũ)' : '404 thật (bản vá _redirects)'
  console.log(`\n=== ${label} ===`)
  // ── Kịch bản 1: tab mở TRƯỚC deploy (bản A), deploy B, rồi khoanh → tự khôi phục, vùng khoanh còn nguyên ──
  current = 'A'; legacyFallback = legacy
  let page = await browser.newPage(); 
  await page.goto(base, { waitUntil: 'networkidle0' })
  check(await txt(page, 'host-build') === 'A', 'tab mở bản A')
  current = 'B'                                                       // DEPLOY: chunk Composer-<hashA>.js biến mất
  const nav = page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 })
  await page.click('[data-testid="select"]')                          // khoanh → import() chunk cũ → lỗi → tự tải lại một lần
  await nav
  await page.waitForSelector('[data-testid="composer"]', { timeout: 10000 })
  check(await txt(page, 'host-build') === 'B' && await txt(page, 'build') === 'B', 'sau khôi phục chạy bản B (cả trang lẫn chunk composer)')
  check((await txt(page, 'region')) === 'Ô 3–6 · bản nhạc Thành phố buồn', 'vùng khoanh được giữ nguyên, khung hỏi tự mở lại')
  check(await noFullPageError(page), 'không có màn hình lỗi toàn trang')
  await page.close()

  // ── Kịch bản 2: chốt chống vòng lặp đã dùng → hiện thẻ "Cập nhật & tiếp tục" (không tải lại âm thầm); gõ dở rồi bấm → giữ nháp ──
  current = 'A'
  page = await browser.newPage()
  await page.goto(base, { waitUntil: 'networkidle0' })
  await page.evaluate(() => sessionStorage.setItem('tva-chunk-reload-at', String(Date.now())))   // vừa tự tải lại < 60 giây trước
  current = 'B'
  await page.click('[data-testid="select"]')
  await page.waitForSelector('[data-testid="chunk-update-card"]', { timeout: 10000 })
  check(await txt(page, 'host-build') === 'A', 'chốt chặn tự tải lại: vẫn ở bản A, hiện thẻ cập nhật')
  check((await text(page)).includes('Cập nhật & tiếp tục') && await noFullPageError(page), 'thẻ cập nhật hiện trong trang, không phải màn hình lỗi toàn trang')
  await page.evaluate(() => sessionStorage.setItem('tva-recover:composer:s1', JSON.stringify({ t: Date.now(), v: { text: 'Ô này em bấm chưa tròn tiếng' } })))   // nháp đã gõ từ lần trước
  const nav2 = page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 })
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Cập nhật'))?.click())
  await nav2
  await page.waitForSelector('[data-testid="composer"]', { timeout: 10000 })
  check(await txt(page, 'build') === 'B', 'bấm Cập nhật → chạy bản B')
  check(await page.$eval('[data-testid="q"]', e => e.value) === 'Ô này em bấm chưa tròn tiếng', 'nội dung câu hỏi đang soạn được giữ nguyên')
  check((await txt(page, 'region')) === 'Ô 3–6 · bản nhạc Thành phố buồn', 'vùng khoanh được giữ nguyên')
  // đóng khung → xoá nháp, tải lại không mở lại
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Đóng')?.click())
  await new Promise(r => setTimeout(r, 200))
  check(await page.evaluate(() => !Object.keys(sessionStorage).some(k => k.startsWith('tva-recover:'))), 'đóng khung hỏi xoá nháp')
  await page.close()

  // ── Kịch bản 3: không deploy xen giữa → luồng bình thường, không tải lại ──
  current = 'B'
  page = await browser.newPage(); await page.goto(base, { waitUntil: 'networkidle0' })
  await page.click('[data-testid="select"]'); await page.waitForSelector('[data-testid="composer"]')
  check(await txt(page, 'build') === 'B' && (await page.evaluate(() => performance.getEntriesByType('navigation').length)) === 1, 'luồng bình thường mở khung hỏi ngay, không tải lại')
  await page.close()
}
await browser.close(); server.close(); fs.rmSync(out, { recursive: true, force: true })
console.log(fails ? `\n${fails} FAIL` : '\nALL PASS'); process.exit(fails ? 1 : 0)
