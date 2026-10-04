// RpcCall chạy thẳng vào một Postgres cục bộ qua `psql` — thay cho PostgREST của Supabase khi test/thử ở máy.
// Mỗi lời gọi = một phiên psql: đặt danh tính (request.jwt.claims + role authenticated) rồi gọi RPC, đúng
// như db/tests/chord_library_v1_test.sql giả lập người dùng. CHỈ dùng cho cluster tạm; không có đường tới production.
import { execFile } from 'node:child_process'
import type { RpcCall } from '../../src/thuvien/chordLibrary.ts'

export type PsqlTarget = { psql: string; host: string; port: string; db: string }

const ARG_TYPES: Record<string, string> = {
  p_text: 'text', p_title: 'text', p_composer: 'text', p_meter: 'jsonb', p_suggested_bpm: 'integer', p_sources: 'jsonb',
  p_version_id: 'uuid', p_sheet_id: 'uuid', p_parent_version_id: 'uuid', p_query: 'text', p_limit: 'integer', p_reason: 'text',
}

export function targetFromEnv(): PsqlTarget | null {
  const { CHORD_PSQL: psql, CHORD_PGHOST: host, CHORD_PGPORT: port, CHORD_PGDATABASE: db } = process.env
  return psql && host && port && db ? { psql, host, port, db } : null
}

export function psqlRpc(target: PsqlTarget, userId: string): RpcCall {
  return (fn, args) => new Promise(resolve => {
    if (!/^chord_sheet_[a-z_]+$/.test(fn) || !/^[0-9a-f-]{36}$/.test(userId)) { resolve({ data: null, error: { message: `RPC không hợp lệ: ${fn}` } }); return }
    const json = JSON.stringify(args)
    let tag = 'a'
    while (json.includes(`$${tag}$`)) tag += 'a'
    const payload = `($${tag}$${json}$${tag}$::jsonb)`
    const list = Object.keys(args).map(key => {
      const type = ARG_TYPES[key]
      if (!type) throw new Error(`tham số lạ: ${key}`)
      return type === 'jsonb' ? `${key} => nullif(${payload} -> '${key}', 'null'::jsonb)` : `${key} => (${payload} ->> '${key}')::${type}`
    }).join(', ')
    const claims = JSON.stringify({ sub: userId, role: 'authenticated' })
    execFile(target.psql, ['-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1', '-h', target.host, '-p', target.port, '-U', 'postgres', '-d', target.db,
      '-c', `select set_config('request.jwt.claims', '${claims}', false)`, '-c', 'set role authenticated', '-c', `select public.${fn}(${list})::text`,
    ], { env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } }, (failure, stdout, stderr) => {
      if (failure) { resolve({ data: null, error: { message: (/ERROR:\s+(.*)/.exec(stderr)?.[1] ?? stderr.trim()) || failure.message } }); return }
      const last = stdout.trim().split('\n').pop() ?? ''
      resolve({ data: last ? JSON.parse(last) : null, error: null })
    })
  })
}
