// END-TO-END: adapter RPC THẬT (src/thuvien/chordLibrary.ts) ↔ SQL THẬT (db/chord_library_v1_setup.sql) trên cluster
// PostgreSQL tạm. Chạy bởi scripts/test-chord-library-db.sh (đặt CHORD_PSQL/CHORD_PGHOST/CHORD_PGPORT/CHORD_PGDATABASE).
// Không có biến môi trường → bỏ qua (không bao giờ tự tìm tới một database nào khác).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRpcChordLibrary } from '../../src/thuvien/chordLibrary.ts'
import { psqlRpc, targetFromEnv } from './psqlRpc.ts'

const target = targetFromEnv()
const ADMIN = 'ffffffff-0000-4000-8000-00000000000f'
const STUDENT = 'aaaaaaaa-0000-4000-8000-00000000000a'
const TAG = `E2E ${Date.now().toString(36)}`

test('bàn biên tập của admin: tìm → chưa có → tạo → sửa tên → sửa lời → chỉ đổi BPM/nhịp → duyệt → tìm lại', { skip: !target && 'không có cluster tạm' }, async () => {
  const admin = createRpcChordLibrary(psqlRpc(target!, ADMIN))
  const student = createRpcChordLibrary(psqlRpc(target!, STUDENT))

  // 1–2. tìm: chưa có
  assert.deepEqual(await admin.searchChordSheets(`Bài thử ${TAG}`), [])

  // 3–4. tạo → bản nháp v1, chưa có bản đang dùng → đọc lại đúng nội dung đã chuẩn hoá
  const v1 = await admin.createChordSheet({ title: `  Bài thử ${TAG} `, composer: '', meter: { beats: 4, beatType: 4 }, suggestedBpm: 80, text: '1. [C] Câu một  \r\n[G] Câu hai\n\n' })
  assert.deepEqual([v1.title, v1.composer, v1.versionNumber, v1.status, v1.draftVersionId, v1.hasAnchors, v1.hasSource],
    [`Bài thử ${TAG}`, null, 1, 'draft', null, false, false])
  assert.equal(v1.text, '1. [C] Câu một\n[G] Câu hai')
  assert.deepEqual([v1.meter, v1.suggestedBpm], [{ beats: 4, beatType: 4 }, 80])
  assert.deepEqual(await admin.getChordSheet(v1.versionId), v1)
  assert.deepEqual(await student.searchChordSheets(`bai thu ${TAG}`), [], 'chưa duyệt → học viên không thấy')

  // 5. sửa tên bài + tác giả: không tạo phiên bản, tìm không dấu theo tên mới thấy ngay
  await admin.updateChordSheetInfo(v1.sheetId, { title: ` Khúc Mẫu ${TAG} `, composer: ' Đội Thử ' })
  const renamed = await admin.getChordSheet(v1.versionId)
  assert.deepEqual([renamed.title, renamed.composer, renamed.versionNumber, renamed.text], [`Khúc Mẫu ${TAG}`, 'Đội Thử', 1, v1.text])
  assert.equal((await admin.searchChordSheets(`KHUC MAU ${TAG.toLowerCase()}`)).length, 1)
  assert.equal((await admin.searchChordSheets('doi thu')).some(item => item.sheetId === v1.sheetId), true, 'tìm theo tác giả mới')
  assert.deepEqual(await admin.searchChordSheets(`Bài thử ${TAG}`), [], 'tên cũ không còn khớp')

  // 6. sửa lời → v2 (cha = v1)
  const v2 = await admin.createChordSheetVersion(v1.sheetId, { text: v1.text + '\n[Am] Câu ba', meter: v1.meter, suggestedBpm: 80 }, v1.versionId)
  assert.deepEqual([v2.versionNumber, v2.status], [2, 'draft'])
  assert.notEqual(v2.versionId, v1.versionId)
  // 7. chỉ đổi BPM → v3; chỉ đổi nhịp → v4; BPM về null → v5
  const v3 = await admin.createChordSheetVersion(v1.sheetId, { text: v2.text, meter: v2.meter, suggestedBpm: 96 }, v2.versionId)
  assert.deepEqual([v3.versionNumber, v3.suggestedBpm, v3.text === v2.text], [3, 96, true])
  const v4 = await admin.createChordSheetVersion(v1.sheetId, { text: v2.text, meter: { beats: 3, beatType: 4 }, suggestedBpm: 96 }, v3.versionId)
  assert.deepEqual([v4.versionNumber, v4.meter], [4, { beats: 3, beatType: 4 }])
  const v5 = await admin.createChordSheetVersion(v1.sheetId, { text: v2.text, meter: { beats: 3, beatType: 4 }, suggestedBpm: null }, v4.versionId)
  assert.deepEqual([v5.versionNumber, v5.suggestedBpm], [5, null])
  // y hệt một bản đã có → máy chủ trả bản đó, KHÔNG có v6
  const again = await admin.createChordSheetVersion(v1.sheetId, { text: v2.text + '  \n', meter: { beats: 3, beatType: 4 }, suggestedBpm: 96 }, v5.versionId)
  assert.equal(again.versionId, v4.versionId)
  assert.equal((await admin.getChordSheet(v1.versionId)).draftVersionId, v5.versionId, 'bản cũ nhất báo bản nháp mới nhất là v5')

  // bỏ v5; trước khi duyệt: danh sách của admin lấy bản nháp mới nhất còn hiệu lực làm đại diện
  await admin.discardChordSheetVersion(v5.versionId)
  assert.equal((await admin.getChordSheet(v5.versionId)).status, 'discarded')
  const [pending] = await admin.searchChordSheets(`khuc mau ${TAG}`)
  assert.deepEqual([pending.versionId, pending.status, pending.draftVersionId], [v4.versionId, 'draft', null])

  // 8. duyệt v3 (không phải bản mới nhất) → bản đang dùng = v3; v4 thành "bản nháp mới hơn"
  const approved = await admin.approveChordSheetVersion(v3.versionId)
  assert.deepEqual([approved.status, approved.versionNumber, approved.draftVersionId], ['current', 3, v4.versionId])

  // 9–10. tìm lại: admin + học viên đều thấy đúng bản đang dùng
  const [listed] = await admin.searchChordSheets(`khuc mau ${TAG}`)
  assert.deepEqual([listed.versionId, listed.status, listed.draftVersionId, listed.title], [v3.versionId, 'current', v4.versionId, `Khúc Mẫu ${TAG}`])
  const [seen] = await student.searchChordSheets(`khuc mau ${TAG}`)
  assert.deepEqual([seen.versionId, seen.status, seen.draftVersionId], [v3.versionId, 'current', null], 'học viên chỉ thấy bản đang dùng, không thấy nháp')
  assert.equal((await student.getChordSheet(v3.versionId)).text, v2.text)

  // 11. phiên bản cũ bất biến
  const old1 = await admin.getChordSheet(v1.versionId)
  assert.deepEqual([old1.text, old1.meter, old1.suggestedBpm, old1.versionNumber, old1.status], [v1.text, { beats: 4, beatType: 4 }, 80, 1, 'draft'])
  const old2 = await admin.getChordSheet(v2.versionId)
  assert.deepEqual([old2.text, old2.suggestedBpm, old2.status], [v2.text, 80, 'draft'])

  // duyệt tiếp v4 → v3 thành "bản cũ" nhưng vẫn đọc được nguyên văn (consumer giữ snapshot)
  assert.equal((await admin.approveChordSheetVersion(v4.versionId)).status, 'current')
  const former = await student.getChordSheet(v3.versionId)
  assert.deepEqual([former.status, former.text, former.suggestedBpm], ['old', v2.text, 96])
})

test('quyền qua adapter: học viên không sửa tên, không duyệt, không bỏ được; lỗi máy chủ thành câu đọc được', { skip: !target && 'không có cluster tạm' }, async () => {
  const admin = createRpcChordLibrary(psqlRpc(target!, ADMIN))
  const student = createRpcChordLibrary(psqlRpc(target!, STUDENT))
  const sheet = await admin.createChordSheet({ title: `Bài quyền ${TAG}`, composer: '', meter: null, suggestedBpm: null, text: '[C] x' })
  await assert.rejects(student.updateChordSheetInfo(sheet.sheetId, { title: 'Học viên đổi', composer: '' }), /không có quyền/)
  await assert.rejects(student.approveChordSheetVersion(sheet.versionId), /không có quyền/)
  await assert.rejects(student.discardChordSheetVersion(sheet.versionId), /không có quyền/)
  await assert.rejects(student.getChordSheet(sheet.versionId), /Không tìm thấy/, 'bản nháp của admin: học viên không đọc được')
  await assert.rejects(admin.getChordSheet('00000000-0000-4000-8000-000000000000'), /Không tìm thấy/)
  await assert.rejects(admin.updateChordSheetInfo(sheet.sheetId, { title: 'x'.repeat(201), composer: '' }), /thiếu tên bài/)
  assert.equal((await admin.getChordSheet(sheet.versionId)).title, `Bài quyền ${TAG}`, 'không gì bị đổi sau các lần bị từ chối')
  await admin.approveChordSheetVersion(sheet.versionId)
  await assert.rejects(admin.discardChordSheetVersion(sheet.versionId), /bản đã duyệt không từ chối được/, 'bản đã duyệt không bỏ được, kể cả admin')
})
