// "Supabase" CỤC BỘ cho test worker extraction: HTTP thật (/auth/v1/user, /rest/v1/rpc/*, /storage/v1/object/authenticated/*) dựng trên một
// cluster PostgreSQL TẠM đã chạy migration THẬT (db/chord_library_v1_setup.sql + v1_3). RPC chạy bằng psql với danh tính của token
// (role authenticated, RLS/EXECUTE thật); Storage chỉ trả file khi policy SELECT thật cho thấy dòng storage.objects. CHỈ dùng cho cluster tạm.
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

export type Target = { psql: string; host: string; port: string; db: string }
export const targetFromEnv = (): Target | null => {
  const { CHORD_PSQL: psql, CHORD_PGHOST: host, CHORD_PGPORT: port, CHORD_PGDATABASE: db } = process.env
  return psql && host && port && db ? { psql, host, port, db } : null
}
const lit = (value: string) => `'${value.replace(/'/g, "''")}'`

/** Chạy SQL qua STDIN (payload hàng trăm KB không vừa argv). Trả dòng cuối của stdout hoặc lỗi ERROR. */
export function sql(target: Target, text: string): Promise<{ ok: boolean; out: string; err: string }> {
  return new Promise(resolve => {
    const child = execFile(target.psql, ['-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1', '-h', target.host, '-p', target.port, '-U', 'postgres', '-d', target.db],
      { maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } },
      (failure, stdout, stderr) => resolve({ ok: !failure, out: stdout.trim().split('\n').pop() ?? '', err: (/ERROR:\s+(.*)/.exec(stderr)?.[1] ?? stderr.trim()) }))
    child.stdin!.end(text)
  })
}

const ARG_TYPES: Record<string, string> = {
  p_version_id: 'uuid', p_source_index: 'integer', p_engine_version: 'text', p_config_hash: 'text', p_force: 'boolean',
  p_id: 'uuid', p_input_sha256: 'text', p_input_bytes: 'integer', p_page_count: 'integer', p_observation: 'jsonb',
  p_interpretation: 'jsonb', p_pipeline: 'jsonb', p_duration_ms: 'integer', p_error_code: 'text',
}
const FUNCTIONS = new Set(['my_chordlib_caps', 'chord_extraction_begin', 'chord_extraction_complete', 'chord_extraction_fail', 'chord_extraction_get', 'chord_extraction_list'])

export async function callRpc(target: Target, userId: string, fn: string, args: Record<string, unknown>) {
  if (!FUNCTIONS.has(fn) || !/^[0-9a-f-]{36}$/.test(userId)) return { ok: false, out: '', err: `RPC không hợp lệ: ${fn}` }
  const json = JSON.stringify(args)
  let tag = 'a'
  while (json.includes(`$${tag}$`)) tag += 'a'
  const payload = `($${tag}$${json}$${tag}$::jsonb)`
  const list = Object.keys(args).map(key => {
    const type = ARG_TYPES[key]
    if (!type) throw new Error(`tham số lạ: ${key}`)
    return type === 'jsonb' ? `${key} => ${payload} -> '${key}'` : `${key} => (${payload} ->> '${key}')::${type}`
  }).join(', ')
  const claims = JSON.stringify({ sub: userId, role: 'authenticated' })
  return sql(target, `select set_config('request.jwt.claims', ${lit(claims)}, false); set role authenticated; select public.${fn}(${list})::text;`)
}

export type Faults = { failRpc: Set<string>; calls: { kind: string; name: string }[]; storageGets: number }

export async function startBridge(options: { target: Target; filesDir: string; tokens: Record<string, string>; anonKey: string }) {
  const faults: Faults = { failRpc: new Set(), calls: [], storageGets: 0 }
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', async () => {
      const json = (status: number, data: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)) }
      const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? ''
      const uid = options.tokens[token]
      if (req.headers.apikey !== options.anonKey) return json(401, { message: 'no apikey' })
      const url = req.url ?? ''
      if (url === '/auth/v1/user') { faults.calls.push({ kind: 'auth', name: 'user' }); return uid ? json(200, { id: uid }) : json(401, { msg: 'invalid JWT' }) }
      if (!uid) return json(401, { message: 'JWT expired' })
      const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url)
      if (rpc) {
        faults.calls.push({ kind: 'rpc', name: rpc[1] })
        if (faults.failRpc.has(rpc[1])) return json(500, { message: 'fault injected' })
        const args = JSON.parse(Buffer.concat(chunks).toString() || '{}')
        const out = await callRpc(options.target, uid, rpc[1], args)
        if (!out.ok) return json(/permission denied/.test(out.err) ? 403 : 400, { code: 'P0001', message: out.err })
        return json(200, out.out ? JSON.parse(out.out) : null)
      }
      const object = /^\/storage\/v1\/object\/authenticated\/chord-sheet-sources\/(.+)$/.exec(url)
      if (object) {
        faults.calls.push({ kind: 'storage', name: 'get' }); faults.storageGets += 1
        const name = decodeURIComponent(object[1]).replace(/%/g, '')
        // policy SELECT thật quyết: người gọi có thấy dòng storage.objects này không
        const seen = await sql(options.target, `select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: uid, role: 'authenticated' }))}, false); set role authenticated; select count(*) from storage.objects where bucket_id = 'chord-sheet-sources' and name = ${lit(name)};`)
        if (!seen.ok || seen.out !== '1') return json(404, { message: 'Object not found' })
        const bytes = await readFile(join(options.filesDir, name)).catch(() => null)
        if (!bytes) return json(404, { message: 'Object not found' })
        res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': bytes.length }); return res.end(bytes)
      }
      json(404, { message: 'unknown' })
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, faults, close: () => new Promise<void>(resolve => server.close(() => resolve())) }
}
