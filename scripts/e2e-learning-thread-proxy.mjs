// Proxy E2E local (KHÔNG production): giả lập đúng phần Supabase mà frontend Learning Thread dùng.
//   /rest/v1/*  → PostgREST local (JWT thật ký bằng secret local → RLS/GRANT/RPC chạy thật trên Postgres tạm)
//   /auth/v1/*  → auth giả lập: đăng nhập bằng email của fixture (@test.local), phát JWT role=authenticated
// Dùng bởi scripts/e2e-learning-thread.sh. Không phụ thuộc thư viện ngoài.
import http from 'node:http'
import crypto from 'node:crypto'

const PORT = Number(process.env.PROXY_PORT)
const PGRST = process.env.PGRST_URL
const SECRET = process.env.JWT_SECRET
const USERS = JSON.parse(process.env.E2E_USERS)   // { email: userId }

const b64u = b => Buffer.from(b).toString('base64url')
export function sign(payload) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64u(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}
const verify = tok => {
  const [h, b, s] = (tok ?? '').split('.')
  if (!s || crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url') !== s) return null
  return JSON.parse(Buffer.from(b, 'base64url').toString())
}
const userObj = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' })
function session(email) {
  const id = USERS[email]
  const exp = Math.floor(Date.now() / 1000) + 3600
  return {
    access_token: sign({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp }),
    token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'rt-' + email, user: userObj(id, email),
  }
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-expose-headers': 'content-range,content-profile,x-total-count',
}
const send = (res, code, obj) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)) }
const readBody = req => new Promise(r => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => r(d)) })

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  const url = new URL(req.url, 'http://x')
  if (url.pathname.startsWith('/auth/v1/')) {
    const p = url.pathname.slice('/auth/v1'.length)
    if (p === '/token') {
      const body = JSON.parse((await readBody(req)) || '{}')
      const email = url.searchParams.get('grant_type') === 'refresh_token' ? String(body.refresh_token ?? '').replace(/^rt-/, '') : body.email
      if (!USERS[email]) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' })
      return send(res, 200, session(email))
    }
    if (p === '/user') {
      const claims = verify((req.headers.authorization ?? '').replace(/^Bearer /i, ''))
      if (!claims?.sub) return send(res, 401, { msg: 'invalid JWT' })
      return send(res, 200, userObj(claims.sub, claims.email))
    }
    if (p === '/logout') return send(res, 204)
    return send(res, 404, { msg: 'not mocked: ' + p })
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    const target = new URL(PGRST + url.pathname.slice('/rest/v1'.length) + url.search)
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req)
    const headers = { ...req.headers }
    delete headers.host; delete headers['content-length']; delete headers.origin
    const r = await fetch(target, { method: req.method, headers, body })
    const out = Buffer.from(await r.arrayBuffer())
    if (r.status >= 400) console.log(`[proxy] ${req.method} ${url.pathname} → ${r.status} ${out.toString().slice(0, 160)}`)
    const h = { ...cors }
    for (const k of ['content-type', 'content-range', 'content-profile', 'preference-applied']) if (r.headers.get(k)) h[k] = r.headers.get(k)
    res.writeHead(r.status, h)
    return res.end(out)
  }
  console.log(`[proxy] 404 ${req.method} ${url.pathname}`)
  send(res, 404, { msg: 'not mocked' })
}).listen(PORT, '127.0.0.1', () => console.log(`[proxy] :${PORT} → ${PGRST}`))
