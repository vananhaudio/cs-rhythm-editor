// Cầu HTTP cục bộ: trang thử (tests/thuvien-ui/proof) gọi RPC thật của Thư viện hợp âm trên một cluster
// PostgreSQL TẠM, qua đúng adapter RPC của app. Chỉ nghe 127.0.0.1, chỉ nhận origin của dev server, chỉ chuyển
// các hàm chord_sheet_*. Khởi chạy bằng scripts/chord-library-local-db.sh — không bao giờ trỏ tới production.
import { createServer } from 'node:http'
import { psqlRpc, targetFromEnv } from './psqlRpc.ts'
import { createPsqlSourceStore, readSigned } from './psqlStorage.ts'

const target = targetFromEnv()
if (!target) { console.error('Thiếu CHORD_PSQL/CHORD_PGHOST/CHORD_PGPORT/CHORD_PGDATABASE'); process.exit(1) }
const PORT = Number(process.env.CHORD_BRIDGE_PORT ?? 54399)
const FILES = process.env.CHORD_FILES_DIR ?? '/tmp/chord-library-localdb/files'
const ORIGINS = (process.env.CHORD_BRIDGE_ORIGINS ?? 'http://localhost:5194,http://127.0.0.1:5194').split(',')
// Danh tính trong fixture db/tests/local/*: X = admin, T = teacher, A = học viên.
const USERS: Record<string, string> = {
  admin: 'ffffffff-0000-4000-8000-00000000000f', teacher: 'dddddddd-0000-4000-8000-00000000000d', student: 'aaaaaaaa-0000-4000-8000-00000000000a',
}

createServer((req, res) => {
  const origin = req.headers.origin ?? ''
  if (ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-chord-as, x-chord-path, x-chord-mime')
  }
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  // Link xem file đã ký (có hạn) — mở được ở tab mới, không cần origin.
  if (req.method === 'GET' && url.pathname === '/storage/file') {
    const path = url.searchParams.get('path') ?? ''
    void readSigned(FILES, path, Number(url.searchParams.get('exp')), url.searchParams.get('sig') ?? '').then(bytes => {
      if (!bytes) { res.writeHead(403).end('Link hết hạn hoặc sai chữ ký.'); return }
      const ext = path.split('.').pop()
      res.writeHead(200, { 'content-type': ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg' }).end(bytes)
    }).catch(() => res.writeHead(404).end())
    return
  }
  if (url.pathname.startsWith('/storage/') || url.pathname === '/whoami') {
    const who = USERS[String(req.headers['x-chord-as'] ?? 'admin')]
    if (req.method !== 'POST' || !who || !ORIGINS.includes(origin)) { res.writeHead(404).end(); return }
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', chunk => { size += chunk.length; if (size > 21 * 1024 * 1024) req.destroy(); else chunks.push(chunk) })
    req.on('end', async () => {
      const store = createPsqlSourceStore(target, who, { dir: FILES, baseUrl: `http://127.0.0.1:${PORT}` })
      const body = Buffer.concat(chunks)
      const json = () => JSON.parse(body.toString() || '{}') as Record<string, string>
      const reply = (status: number, data: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(data))
      try {
        if (url.pathname === '/whoami') return reply(200, { id: who })
        if (url.pathname === '/storage/upload') {
          await store.upload(String(req.headers['x-chord-path']), new Blob([body]), String(req.headers['x-chord-mime']) as never)
          return reply(200, { ok: true })
        }
        if (url.pathname === '/storage/remove') { await store.remove(json().path); return reply(200, { ok: true }) }
        if (url.pathname === '/storage/copy') { const { from, to } = json(); await store.copy(from, to); return reply(200, { ok: true }) }
        if (url.pathname === '/storage/sign') return reply(200, { url: await store.viewUrl(json().path) })
        reply(404, { error: 'không có' })
      } catch (cause) { reply(400, { error: (cause as Error).message }) }
    })
    return
  }
  const match = /^\/rpc\/(chord_sheet_[a-z_]+)$/.exec(req.url ?? '')
  const user = USERS[String(req.headers['x-chord-as'] ?? 'admin')]
  if (req.method !== 'POST' || !match || !user || (origin && !ORIGINS.includes(origin))) { res.writeHead(404).end(); return }
  let body = ''
  req.on('data', chunk => { body += chunk; if (body.length > 200_000) req.destroy() })
  req.on('end', async () => {
    let args: Record<string, unknown>
    try { args = body ? JSON.parse(body) : {} } catch { res.writeHead(400).end(); return }
    try {
      const reply = await psqlRpc(target, user)(match[1], args)
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(reply))
    } catch (cause) {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: null, error: { message: (cause as Error).message } }))
    }
  })
}).listen(PORT, '127.0.0.1', () => console.log(`chord-library local DB bridge: http://127.0.0.1:${PORT} (db ${target.db} @ ${target.host}:${target.port})`))
