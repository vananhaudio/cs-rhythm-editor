// Cầu HTTP cục bộ: trang thử (tests/thuvien-ui/proof) gọi RPC thật của Thư viện hợp âm trên một cluster
// PostgreSQL TẠM, qua đúng adapter RPC của app. Chỉ nghe 127.0.0.1, chỉ nhận origin của dev server, chỉ chuyển
// các hàm chord_sheet_*. Khởi chạy bằng scripts/chord-library-local-db.sh — không bao giờ trỏ tới production.
import { createServer } from 'node:http'
import { psqlRpc, targetFromEnv } from './psqlRpc.ts'

const target = targetFromEnv()
if (!target) { console.error('Thiếu CHORD_PSQL/CHORD_PGHOST/CHORD_PGPORT/CHORD_PGDATABASE'); process.exit(1) }
const PORT = Number(process.env.CHORD_BRIDGE_PORT ?? 54399)
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
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-chord-as')
  }
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }
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
