import test from 'node:test'
import assert from 'node:assert/strict'
import { ADD_MODES, CATEGORY_ORDER, actionLabel, fmtDateVN, groupFacts, isVerified, trustLine } from '../../src/student360/model'
import type { Fact } from '../../src/student360/types'

const mk = (o: Partial<Fact>): Fact => ({
  id: 'f', category: 'goal', content: 'x', origin: 'self_reported', verification: 'unverified', source_kind: 'student',
  visibility: 'student_and_teacher', status: 'active', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...o,
})

test('suy luận luôn mang chữ "Suy luận" và mức xác minh thật — không bao giờ giống sự thật đã xác nhận', () => {
  assert.equal(trustLine(mk({ origin: 'inferred', verification: 'unverified' })), 'Suy luận · Chưa xác minh')
  assert.equal(trustLine(mk({ origin: 'inferred', verification: 'teacher_verified' })), 'Suy luận · Thầy đã xác minh')
  assert.equal(trustLine(mk({ origin: 'self_reported' })), 'Học viên tự nêu · Chưa xác minh')
  assert.equal(trustLine(mk({ origin: 'class_confirmed', verification: 'teacher_verified' })), 'Class xác nhận · Thầy đã xác minh')
  assert.ok(!trustLine(mk({ origin: 'inferred' })).includes('Class xác nhận'))
})

test('phân biệt bằng CHỮ: mỗi tổ hợp origin × verification cho một dòng khác nhau', () => {
  const lines = new Set<string>()
  for (const origin of ['self_reported', 'class_confirmed', 'inferred'] as const)
    for (const verification of ['unverified', 'student_confirmed', 'teacher_verified'] as const)
      lines.add(trustLine(mk({ origin, verification })))
  assert.equal(lines.size, 9)
})

test('isVerified: chỉ unverified là chưa xác minh', () => {
  assert.equal(isVerified({ verification: 'unverified' }), false)
  assert.equal(isVerified({ verification: 'student_confirmed' }), true)
  assert.equal(isVerified({ verification: 'teacher_verified' }), true)
})

test('groupFacts: đúng thứ tự nhóm, bỏ nhóm rỗng, mới trước, đã thu hồi cuối', () => {
  const g = groupFacts([
    mk({ id: 'c1', category: 'commitment' }), mk({ id: 'g-old', category: 'goal', updated_at: '2026-09-01T00:00:00Z' }),
    mk({ id: 'g-new', category: 'goal', updated_at: '2026-10-05T00:00:00Z' }),
    mk({ id: 'g-rev', category: 'goal', status: 'revoked', updated_at: '2026-10-09T00:00:00Z' }),
  ])
  assert.deepEqual(g.map(x => x.category), ['goal', 'commitment'])
  assert.deepEqual(g[0].facts.map(f => f.id), ['g-new', 'g-old', 'g-rev'])
  assert.deepEqual(groupFacts([]), [])
  assert.equal(CATEGORY_ORDER.length, 6)
})

test('cách Thầy thêm mục: không có lựa chọn nào đặt sẵn mức xác minh; suy đoán = inferred', () => {
  assert.deepEqual(ADD_MODES.map(m => m.key), ['told', 'observed', 'guess'])
  assert.equal(ADD_MODES.find(m => m.key === 'guess')!.origin, 'inferred')
  for (const m of ADD_MODES) assert.ok(!('verification' in m))
})

test('nhãn lịch sử', () => {
  assert.equal(actionLabel('visibility:student_and_teacher'), 'Cho học viên xem')
  assert.equal(actionLabel('verify:teacher_verified'), 'Thầy xác minh')
  assert.equal(actionLabel('lạ'), 'lạ')
})

test('ngày nhập học chỉ có ngày (không kèm giờ), theo giờ Việt Nam; rỗng/sai → chuỗi rỗng', () => {
  assert.equal(fmtDateVN('2026-01-02T00:00:00Z'), '02/01/2026')
  assert.equal(fmtDateVN('2026-01-02T20:00:00Z'), '03/01/2026')
  assert.equal(fmtDateVN(null), ''); assert.equal(fmtDateVN('không phải ngày'), '')
})
