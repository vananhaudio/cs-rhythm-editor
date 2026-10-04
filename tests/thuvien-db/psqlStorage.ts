// Kho file nguồn chạy trên Postgres TẠM, mô phỏng ĐÚNG mô hình Supabase Storage API để policy + trigger N1 thật
// được thử: (1) lượt THỬ — INSERT/DELETE với vai authenticated dưới RLS rồi ROLLBACK; (2) lượt GHI THẬT — bằng
// postgres (đi vòng RLS như Storage ghi bằng superuser), trigger chord_source_guard_trg vẫn chạy. Byte file nằm trên
// đĩa (thư mục tạm). Link xem = token HMAC có hạn, phục vụ bởi cầu cục bộ. CHỈ dùng cho cluster tạm.
import { execFile } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ChordSourceStore, SourceMime } from '../../src/thuvien/chordSources.ts'
import { SOURCE_BUCKET, SOURCE_VIEW_SECONDS, parseSourcePath } from '../../src/thuvien/chordSources.ts'
import type { PsqlTarget } from './psqlRpc.ts'

const SECRET = randomBytes(16).toString('hex')
const lit = (value: string) => `'${value.replace(/'/g, "''")}'`

function psql(target: PsqlTarget, sql: string): Promise<{ ok: boolean; out: string; err: string }> {
  return new Promise(resolve => execFile(target.psql, ['-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1', '-h', target.host, '-p', target.port, '-U', 'postgres', '-d', target.db, '-c', sql],
    { env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } },
    (failure, stdout, stderr) => resolve({ ok: !failure, out: stdout.trim(), err: (/ERROR:\s+(.*)/.exec(stderr)?.[1] ?? stderr.trim()) })))
}
const asUser = (userId: string) => `select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: userId, role: 'authenticated' }))}, true); set local role authenticated;`

export function signedPath(path: string, expires: number) {
  return createHmac('sha256', SECRET).update(`${path}|${expires}`).digest('hex')
}
export function verifySigned(path: string, expires: number, signature: string) {
  return expires > Date.now() / 1000 && signedPath(path, expires) === signature
}

export function createPsqlSourceStore(target: PsqlTarget, userId: string, options: { dir: string; baseUrl?: string }): ChordSourceStore & { fileFor(path: string): string } {
  const fileFor = (path: string) => join(options.dir, path)
  async function insertObject(path: string, mime: string, size: number) {
    const values = `(${lit(SOURCE_BUCKET)}, ${lit(path)}, ${lit(userId)}, ${lit(JSON.stringify({ mimetype: mime, size }))}::jsonb)`
    // (1) lượt thử: policy INSERT dưới RLS — rồi ROLLBACK (khoá tư vấn nhả theo)
    const trial = await psql(target, `begin; ${asUser(userId)} insert into storage.objects (bucket_id, name, owner, metadata) values ${values}; rollback;`)
    if (!trial.ok) throw new Error(trial.err)
    // (2) lượt ghi thật: superuser, không RLS — trigger N1 phải tự ép luật
    const real = await psql(target, `insert into storage.objects (bucket_id, name, owner, metadata) values ${values}`)
    if (!real.ok) throw new Error(real.err)
  }
  return {
    fileFor,
    async ownerId() { return userId },
    async upload(path, file, mime: SourceMime) {
      const bytes = Buffer.from(await file.arrayBuffer())
      if (bytes.length > 20 * 1024 * 1024) throw new Error('The object exceeded the maximum allowed size')
      await insertObject(path, mime, bytes.length)
      await mkdir(dirname(fileFor(path)), { recursive: true })
      await writeFile(fileFor(path), bytes)
    },
    async remove(path) {
      // Storage xoá dưới RLS: policy cleanup không cho → 0 dòng → báo lỗi (không im lặng)
      const result = await psql(target, `begin; ${asUser(userId)} with gone as (delete from storage.objects where bucket_id = ${lit(SOURCE_BUCKET)} and name = ${lit(path)} returning 1) select count(*) from gone; commit;`)
      if (!result.ok) throw new Error(result.err)
      if (result.out.split('\n').pop() !== '1') throw new Error('Không xoá được file này — file đã gắn với một phiên bản.')
      await rm(fileFor(path), { force: true })
    },
    async copy(fromPath, toPath) {
      const read = await psql(target, `begin; ${asUser(userId)} select metadata::text from storage.objects where bucket_id = ${lit(SOURCE_BUCKET)} and name = ${lit(fromPath)}; commit;`)
      const meta = read.ok ? read.out.split('\n').pop() : ''
      if (!meta) throw new Error('Không đọc được file nguồn để chép.')
      const parsed = JSON.parse(meta) as { mimetype: string; size: number }
      if (!parseSourcePath(toPath)) throw new Error('CHORDLIB_SOURCE: đường dẫn phải là {uid}/{version_id}/{0-9}.{pdf|jpg|jpeg|png|webp}')
      await insertObject(toPath, parsed.mimetype, parsed.size)
      await mkdir(dirname(fileFor(toPath)), { recursive: true })
      await copyFile(fileFor(fromPath), fileFor(toPath))
    },
    async viewUrl(path) {
      // Ký link chỉ khi người gọi ĐỌC được object dưới RLS (policy read).
      const read = await psql(target, `begin; ${asUser(userId)} select count(*) from storage.objects where bucket_id = ${lit(SOURCE_BUCKET)} and name = ${lit(path)}; commit;`)
      if (!read.ok || read.out.split('\n').pop() !== '1') throw new Error('Không có quyền xem file này.')
      const expires = Math.floor(Date.now() / 1000) + SOURCE_VIEW_SECONDS
      return `${options.baseUrl ?? 'http://127.0.0.1:54399'}/storage/file?path=${encodeURIComponent(path)}&exp=${expires}&sig=${signedPath(path, expires)}`
    },
  }
}

export async function readSigned(dir: string, path: string, expires: number, signature: string) {
  if (!verifySigned(path, expires, signature)) return null
  return readFile(join(dir, path))
}
