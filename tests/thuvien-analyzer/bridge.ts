// Cầu analyzer vạch nhịp CỤC BỘ — chỉ cho dev server / trang thử. Nghe 127.0.0.1 (không ra mạng), nhận file sheet dạng
// base64, ghi vào thư mục tạm, chạy tools/measure-analyzer/measure_analyzer.py, xoá file, trả kết quả. Không gửi gì ra ngoài.
// Chạy: node --experimental-strip-types tests/thuvien-analyzer/bridge.ts   (cổng MEASURE_ANALYZER_PORT, mặc định 54398)
import { createServer } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runAnalyzerRaw } from './harness.ts'

const PORT = Number(process.env.MEASURE_ANALYZER_PORT ?? 54398)
const MAX_BODY = 80 * 1024 * 1024
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' }
// chỉ trang dev trên máy này
const allowed = (origin: string | undefined) => !!origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

createServer(async (req, res) => {
  const origin = req.headers.origin
  if (allowed(origin)) { res.setHeader('access-control-allow-origin', origin!); res.setHeader('vary', 'origin') }
  res.setHeader('access-control-allow-headers', 'content-type')
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
  const send = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  if (origin && !allowed(origin)) return send(403, { ok: false, error: { code: 'origin', message: 'Chỉ nhận từ trang dev trên máy này.' } })
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, engine: 'numpy-pillow-v2-align' })
  if (req.method !== 'POST' || req.url !== '/analyze') return send(404, { ok: false, error: { code: 'not_found', message: 'Không có.' } })
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) return send(413, { ok: false, error: { code: 'too_large', message: 'File quá lớn.' } })
    chunks.push(chunk)
  }
  const dir = await mkdtemp(join(tmpdir(), 'measure-analyzer-'))
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { files: { mime: string; base64: string }[]; lineTokenCounts: number[]; lineTokenLengths?: number[][]; meter: unknown; traceId?: string }
    if (!Array.isArray(body.files) || !body.files.length || body.files.length > 10) return send(400, { ok: false, error: { code: 'bad_input', message: 'Cần 1–10 file sheet.' } })
    const sources = []
    for (const [index, file] of body.files.entries()) {
      const ext = EXT[file.mime]
      if (!ext) return send(400, { ok: false, error: { code: 'bad_mime', message: `Loại file không nhận: ${file.mime}` } })
      const path = join(dir, `${index}.${ext}`)
      await writeFile(path, Buffer.from(file.base64, 'base64'))
      sources.push({ path, mime: file.mime })
    }
    const lineTokenCounts = Array.isArray(body.lineTokenCounts) ? body.lineTokenCounts.map(Number).filter(n => Number.isInteger(n) && n >= 0) : []
    const lineTokenLengths = Array.isArray(body.lineTokenLengths) ? body.lineTokenLengths.map(row => (Array.isArray(row) ? row : []).map(Number)) : undefined
    send(200, await runAnalyzerRaw({ sources, lineTokenCounts, lineTokenLengths, meter: body.meter ?? null, traceId: body.traceId ?? null }))
  } catch (error) {
    send(500, { ok: false, error: { code: 'bridge_error', message: error instanceof Error ? error.message : String(error) } })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`measure-analyzer bridge: http://127.0.0.1:${PORT}`))
