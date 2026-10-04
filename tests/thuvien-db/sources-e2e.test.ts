// END-TO-END file nguồn: adapter RPC thật + kho file mô phỏng Storage API (thử policy → rollback → ghi thật) trên
// Postgres TẠM có policy + trigger N1 thật. Chạy bởi scripts/test-chord-library-db.sh. Không có biến môi trường → bỏ qua.
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { createRpcChordLibrary } from '../../src/thuvien/chordLibrary.ts'
import { sha256Hex, sourcePath } from '../../src/thuvien/chordSources.ts'
import type { ChordSource } from '../../src/thuvien/chordSources.ts'
import { psqlRpc, targetFromEnv } from './psqlRpc.ts'
import { createPsqlSourceStore, readSigned } from './psqlStorage.ts'

const target = targetFromEnv()
const ADMIN = 'ffffffff-0000-4000-8000-00000000000f'
const STUDENT = 'bbbbbbbb-0000-4000-8000-00000000000b'
const TAG = `SRC ${Date.now().toString(36)}`
const dir = await mkdtemp(join(tmpdir(), 'chord-src-'))
after(() => rm(dir, { recursive: true, force: true }))
const skip = !target && 'không có cluster tạm'

async function put(library: ReturnType<typeof createRpcChordLibrary>, versionId: string, index: number, body: string, mime: 'image/png' | 'application/pdf' = 'image/png'): Promise<ChordSource> {
  const owner = await library.sources.ownerId()
  const path = sourcePath(owner, versionId, index, mime)
  const file = new Blob([body], { type: mime })
  await library.sources.upload(path, file, mime)
  return { path, mime, sha256: await sha256Hex(await file.arrayBuffer()), sizeBytes: file.size, page: index + 1 }
}

test('admin: nạp sheet → lưu bài kèm nguồn → đọc lại → thư mục đã ghi đóng băng → thay nguồn = phiên bản mới (chép) → bản cũ nguyên vẹn', { skip }, async () => {
  const admin = createRpcChordLibrary(psqlRpc(target!, ADMIN), createPsqlSourceStore(target!, ADMIN, { dir }))
  const v1 = admin.newVersionId()
  const a = await put(admin, v1, 0, 'trang một')
  const b = await put(admin, v1, 1, '%PDF trang hai', 'application/pdf')
  await assert.rejects(admin.createChordSheet({ title: `Bài ${TAG}`, composer: '', meter: null, suggestedBpm: null, text: '[C] lời' }, { versionId: v1, sources: [a] }),
    /chưa được khai/, 'thư mục còn file chưa khai → máy chủ từ chối')
  const created = await admin.createChordSheet({ title: `Bài ${TAG}`, composer: '', meter: null, suggestedBpm: null, text: '[C] lời' }, { versionId: v1, sources: [a, b] })
  assert.deepEqual([created.versionId, created.status, created.sources.map(source => [source.path, source.mime, source.sha256, source.sizeBytes, source.page])],
    [v1, 'draft', [[a.path, a.mime, a.sha256, a.sizeBytes, 1], [b.path, b.mime, b.sha256, b.sizeBytes, 2]]])
  assert.deepEqual((await admin.getChordSheet(v1)).sources, created.sources, 'đọc lại đúng nguồn')

  await assert.rejects(put(admin, v1, 2, 'thêm'), /phiên bản đã ghi/, 'thêm file vào phiên bản đã ghi → trigger chặn')
  await assert.rejects(admin.sources.remove(a.path), /Không xoá được/, 'xoá file đã gắn → policy chặn, báo lỗi')

  const url = await admin.sources.viewUrl(a.path)
  const parsed = new URL(url)
  assert.equal((await readSigned(dir, parsed.searchParams.get('path')!, Number(parsed.searchParams.get('exp')), parsed.searchParams.get('sig')!))?.toString(), 'trang một', 'link xem ký đúng → đọc được')
  assert.equal(await readSigned(dir, a.path, Number(parsed.searchParams.get('exp')), 'sai'), null, 'chữ ký sai → không đọc được')
  assert.equal(await readSigned(dir, a.path, Math.floor(Date.now() / 1000) - 1, parsed.searchParams.get('sig')!), null, 'hết hạn → không đọc được')

  // Thay nguồn: giữ a (CHÉP sang thư mục mới), bỏ b, thêm c → phiên bản 2.
  const v2 = admin.newVersionId()
  const owner = await admin.sources.ownerId()
  const carried = { ...a, path: sourcePath(owner, v2, 0, 'image/png') }
  await admin.sources.copy(a.path, carried.path)
  const c = await put(admin, v2, 1, 'trang mới')
  const next = await admin.createChordSheetVersion(created.sheetId, { text: '[C] lời', meter: null, suggestedBpm: null }, v1, { versionId: v2, sources: [carried, c] })
  assert.deepEqual([next.versionId, next.versionNumber, next.sources.map(source => source.sha256)], [v2, 2, [a.sha256, c.sha256]], 'chỉ thay nguồn → phiên bản mới')
  assert.deepEqual((await admin.getChordSheet(v1)).sources.map(source => source.path), [a.path, b.path], 'v1 giữ nguyên bộ nguồn')

  // Nguồn y hệt (cùng sha256) → trùng, trả v2; file trong thư mục v3 không gắn → xoá được.
  const v3 = admin.newVersionId()
  const again = await put(admin, v3, 0, 'trang một')
  const again2 = await put(admin, v3, 1, 'trang mới')
  const dup = await admin.createChordSheetVersion(created.sheetId, { text: '[C] lời', meter: null, suggestedBpm: null }, v2, { versionId: v3, sources: [again, again2] })
  assert.equal(dup.versionId, v2, 'cùng nội dung + cùng sha256 nguồn → trùng')
  await admin.sources.remove(again.path)
  await admin.sources.remove(again2.path)
})

test('học viên: không đọc / ký link / xoá file nguồn của admin; thư mục người khác → bị chặn', { skip }, async () => {
  const admin = createRpcChordLibrary(psqlRpc(target!, ADMIN), createPsqlSourceStore(target!, ADMIN, { dir }))
  const student = createRpcChordLibrary(psqlRpc(target!, STUDENT), createPsqlSourceStore(target!, STUDENT, { dir }))
  const v = admin.newVersionId()
  const s = await put(admin, v, 0, 'của admin')
  await assert.rejects(student.sources.viewUrl(s.path), /Không có quyền xem/)
  await assert.rejects(student.sources.remove(s.path), /Không xoá được/)
  await assert.rejects(student.sources.upload(s.path.replace(ADMIN, STUDENT).replace(/0\.png$/, '0.png'), new Blob(['x']), 'image/png').then(() => student.sources.upload(s.path, new Blob(['x']), 'image/png')),
    /chủ file không khớp|row-level security/, 'ghi vào thư mục của admin → chặn')
  await admin.sources.remove(s.path)
})
