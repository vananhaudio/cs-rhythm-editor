import './dom-setup'
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import Student360Panel from '../../src/student360/Student360Panel'
import { Student360Error } from '../../src/student360/api'
import type { Fact, HistoryEntry, Student360, Student360Api } from '../../src/student360/types'

void React

const U = 'aaaaaaaa-0000-4000-8000-00000000000a'
const OV = { fullName: 'Nguyễn An', level: 'Mới bắt đầu', goals: 'Đệm hát', instruments: 'Guitar', learningStyle: null, enrolledAt: '2026-01-02T00:00:00Z' }
const fact = (o: Partial<Fact>): Fact => ({
  id: 'f1', category: 'goal', content: 'Muốn đệm hát Bolero', origin: 'self_reported', verification: 'unverified', source_kind: 'student',
  visibility: 'student_and_teacher', status: 'active', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z', ...o,
})
const snap = (facts: Fact[]): Student360 => ({ user_id: U, profile: null, facts, learning_sources: [], generated_at: '2026-10-27T00:00:00Z' })

let facts: Fact[] = []
let calls: [string, ...unknown[]][] = []
let failNext: Student360Error | null = null
let hist: HistoryEntry[] = []
function mkApi(): Student360Api {
  const guard = () => { if (failNext) { const e = failNext; failNext = null; throw e } }
  return {
    get: async (u, inc) => { calls.push(['get', u, inc]); guard(); return snap(inc ? facts : facts.filter(f => f.status === 'active')) },
    add: async i => { calls.push(['add', i]); guard(); return fact({}) },
    edit: async (id, c) => { calls.push(['edit', id, c]); guard(); return fact({}) },
    setVerification: async (id, l) => { calls.push(['verify', id, l]); guard(); return fact({}) },
    setVisibility: async (id, v) => { calls.push(['vis', id, v]); guard(); return fact({}) },
    revoke: async (id, r) => { calls.push(['revoke', id, r]); guard(); return fact({}) },
    history: async id => { calls.push(['history', id]); guard(); return hist },
  }
}
const mount = (userId: string | null = U) => render(<Student360Panel userId={userId} overview={OV} api={mkApi()} />)
beforeEach(() => { facts = []; calls = []; failNext = null; hist = [] })
afterEach(() => cleanup())

test('học viên chưa có tài khoản: báo rõ, không gọi RPC', () => {
  const v = mount(null)
  assert.ok(v.getByText(/chưa có tài khoản đăng nhập Class/))
  assert.deepEqual(calls, [])
  assert.ok(v.getByText('Guitar'), 'vẫn hiện tổng quan từ hồ sơ Class')
  assert.ok(v.getByText('02/01/2026'), 'ngày nhập học chỉ có ngày')
})

test('trạng thái tải rồi trạng thái rỗng', async () => {
  const v = mount()
  assert.ok(v.getByText('Đang tải hồ sơ…'))
  await waitFor(() => v.getByText(/Chưa có thông tin nào được ghi nhận/))
  assert.deepEqual(calls[0], ['get', U, false])
})

test('lỗi tải: hiện lỗi + nút Thử lại tải lại được', async () => {
  failNext = new Student360Error('forbidden', 'Bạn không có quyền thực hiện thao tác này.')
  const v = mount()
  await waitFor(() => v.getByRole('alert'))
  assert.match(v.getByRole('alert').textContent!, /không có quyền/)
  fireEvent.click(v.getByText('Thử lại'))
  await waitFor(() => v.getByText(/Chưa có thông tin nào/))
})

test('hiển thị nguồn + mức xác minh + phạm vi bằng chữ; suy luận có nhãn riêng; KHÔNG lộ source_ref', async () => {
  facts = [
    fact({ id: 'a', content: 'Học viên nói muốn đệm hát' }),
    fact({ id: 'b', category: 'difficulty', content: 'Hay đau tay khi bấm barre', origin: 'inferred', source_kind: 'crm_zalo', visibility: 'teacher', source_ref: 'crm-link:7', created_by: 'x' }),
  ]
  const v = mount()
  await waitFor(() => v.getByText('Hay đau tay khi bấm barre'))
  assert.ok(v.getByText('Suy luận · Chưa xác minh'))
  assert.ok(v.getByText('Học viên tự nêu · Chưa xác minh'))
  assert.ok(v.getByText('Nguồn: Lịch sử Zalo (CRM)'))
  assert.ok(v.getByText('Chỉ giáo viên thấy'))
  assert.ok(v.getByText('Học viên cũng thấy'))
  assert.ok(v.getByRole('heading', { name: 'Mục tiêu' }) && v.getByRole('heading', { name: 'Khó khăn khi học' }))
  assert.ok(!document.body.textContent!.includes('crm-link:7'), 'không hiển thị source_ref nội bộ')
})

test('thêm: mặc định chỉ bật khi có nội dung; "Thầy suy đoán" gửi origin=inferred, nguồn teacher, đã trim', async () => {
  const v = mount(); await waitFor(() => v.getByText(/Chưa có thông tin nào/))
  const add = v.getByText('Thêm') as HTMLButtonElement
  assert.equal(add.disabled, true)
  fireEvent.change(v.getByLabelText('Nguồn thông tin'), { target: { value: 'guess' } })
  fireEvent.change(v.getByLabelText('Nhóm thông tin'), { target: { value: 'support_need' } })
  fireEvent.change(v.getByLabelText('Nội dung'), { target: { value: '  Cần bài tập chậm  ' } })
  assert.equal((v.getByText('Thêm') as HTMLButtonElement).disabled, false)
  fireEvent.click(v.getByText('Thêm'))
  await waitFor(() => v.getByText('Đã thêm thông tin.'))
  assert.deepEqual(calls.find(c => c[0] === 'add')![1], { userId: U, category: 'support_need', content: 'Cần bài tập chậm', origin: 'inferred', sourceKind: 'teacher', visibility: 'teacher' })
  assert.equal((v.getByLabelText('Nội dung') as HTMLTextAreaElement).value, '', 'xoá ô nhập sau khi thêm')
  assert.equal(calls.filter(c => c[0] === 'get').length, 2, 'tải lại từ server sau khi thêm')
})

test('form thêm: bắt buộc chọn nguồn, hiện ai sẽ thấy, mặc định chỉ giáo viên, chia sẻ phải tích rõ, không giữ lựa chọn sang lần sau', async () => {
  const v = mount(); await waitFor(() => v.getByText(/Chưa có thông tin nào/))
  const src = v.getByLabelText('Nguồn thông tin') as HTMLSelectElement
  assert.equal(src.value, '', 'không có nguồn mặc định')
  fireEvent.change(v.getByLabelText('Nội dung'), { target: { value: 'Muốn đệm hát' } })
  assert.equal((v.getByText('Thêm') as HTMLButtonElement).disabled, true, 'có nội dung nhưng chưa chọn nguồn thì chưa thêm được')
  assert.match(v.getByLabelText('Ai sẽ thấy').textContent!, /chọn nguồn/)
  fireEvent.change(src, { target: { value: 'observed' } })
  assert.match(v.getByLabelText('Ai sẽ thấy').textContent!, /chỉ giáo viên/)
  fireEvent.click(v.getByText('Thêm')); await waitFor(() => v.getByText('Đã thêm thông tin.'))
  assert.equal((calls.find(c => c[0] === 'add')![1] as { visibility: string }).visibility, 'teacher', 'không tích → chỉ giáo viên')
  assert.equal((v.getByLabelText('Nguồn thông tin') as HTMLSelectElement).value, '', 'sau khi thêm, nguồn được đặt lại')
  calls.length = 0
  fireEvent.change(v.getByLabelText('Nguồn thông tin'), { target: { value: 'told' } })
  fireEvent.click(v.getByLabelText('Cho học viên xem ngay'))
  assert.match(v.getByLabelText('Ai sẽ thấy').textContent!, /giáo viên và học viên/)
  fireEvent.change(v.getByLabelText('Nội dung'), { target: { value: 'Thích bolero' } })
  fireEvent.click(v.getByText('Thêm')); await waitFor(() => assert.equal(calls.filter(c => c[0] === 'add').length, 1))
  assert.equal((calls.find(c => c[0] === 'add')![1] as { visibility: string }).visibility, 'student_and_teacher')
  assert.equal((v.getByLabelText('Cho học viên xem ngay') as HTMLInputElement).checked, false, 'ô chia sẻ cũng được đặt lại')
  fireEvent.change(v.getByLabelText('Nguồn thông tin'), { target: { value: 'guess' } })
  assert.equal(v.queryByLabelText('Cho học viên xem ngay'), null, 'mục suy đoán không cho chia sẻ ngay lúc thêm')
})

test('sửa: gửi nội dung mới và báo mức xác minh bị đặt lại', async () => {
  facts = [fact({ verification: 'teacher_verified' })]
  const v = mount(); await waitFor(() => v.getByText('Muốn đệm hát Bolero'))
  fireEvent.click(v.getByText('Sửa'))
  fireEvent.change(v.getByLabelText('Sửa nội dung'), { target: { value: 'Muốn đệm hát Ballad' } })
  fireEvent.click(v.getByText('Lưu'))
  await waitFor(() => v.getByText(/được đặt lại về "Chưa xác minh"/))
  assert.deepEqual(calls.find(c => c[0] === 'edit'), ['edit', 'f1', 'Muốn đệm hát Ballad'])
})

test('xác minh bật/tắt đúng mức: chưa xác minh → teacher_verified; đã xác minh → unverified', async () => {
  facts = [fact({})]
  const v = mount(); await waitFor(() => v.getByText('Xác minh'))
  fireEvent.click(v.getByText('Xác minh'))
  await waitFor(() => v.getByText('Đã xác minh.'))
  assert.deepEqual(calls.find(c => c[0] === 'verify'), ['verify', 'f1', 'teacher_verified'])
  cleanup(); calls = []; facts = [fact({ verification: 'teacher_verified' })]
  const w = mount(); await waitFor(() => w.getByText('Bỏ xác minh'))
  fireEvent.click(w.getByText('Bỏ xác minh'))
  await waitFor(() => w.getByText('Đã bỏ xác minh.'))
  assert.deepEqual(calls.find(c => c[0] === 'verify'), ['verify', 'f1', 'unverified'])
})

test('mục suy luận: "Cho học viên xem" phải xác nhận; chưa xác nhận thì không gọi RPC', async () => {
  facts = [fact({ origin: 'inferred', visibility: 'teacher', source_kind: 'crm_zalo' })]
  const v = mount(); await waitFor(() => v.getByText('Cho học viên xem'))
  fireEvent.click(v.getByText('Cho học viên xem'))
  const g = v.getByRole('group', { name: 'Xác nhận cho học viên xem' })
  assert.match(g.textContent!, /thông tin suy luận/); assert.match(g.textContent!, /chưa chính xác/); assert.match(g.textContent!, /học viên sẽ nhìn thấy/)
  assert.equal(calls.filter(c => c[0] === 'vis').length, 0, 'chưa gọi RPC trước khi xác nhận')
  fireEvent.click(v.getByText('Vẫn cho học viên xem'))
  await waitFor(() => v.getByText('Học viên đã có thể xem mục này.'))
  assert.deepEqual(calls.filter(c => c[0] === 'vis'), [['vis', 'f1', 'student_and_teacher']])
  assert.equal(calls.filter(c => c[0] === 'verify' || c[0] === 'edit').length, 0, 'không đổi xác minh/nội dung')
})

test('mục suy luận: Hủy xác nhận giữ nguyên dữ liệu, không gọi RPC, nút quay lại', async () => {
  facts = [fact({ origin: 'inferred', visibility: 'teacher', source_kind: 'crm_zalo' })]
  const v = mount(); await waitFor(() => v.getByText('Cho học viên xem'))
  fireEvent.click(v.getByText('Cho học viên xem'))
  fireEvent.click(v.getByText('Hủy'))
  assert.equal(v.queryByRole('group', { name: 'Xác nhận cho học viên xem' }), null)
  assert.equal(calls.filter(c => c[0] !== 'get').length, 0, 'Hủy không gọi RPC ghi nào')
  assert.ok(v.getByText('Cho học viên xem'))
  assert.ok(v.getAllByText('Chỉ giáo viên thấy').length >= 1)
})

test('đổi phạm vi hiển thị mục KHÔNG suy luận: làm ngay, không hỏi; thu về chỉ giáo viên: không hỏi', async () => {
  facts = [fact({ origin: 'class_confirmed', visibility: 'teacher' })]
  const v = mount(); await waitFor(() => v.getByText('Cho học viên xem'))
  fireEvent.click(v.getByText('Cho học viên xem'))
  await waitFor(() => v.getByText('Học viên đã có thể xem mục này.'))
  assert.equal(v.queryByRole('group', { name: 'Xác nhận cho học viên xem' }), null)
  assert.deepEqual(calls.find(c => c[0] === 'vis'), ['vis', 'f1', 'student_and_teacher'])
  cleanup(); calls = []; facts = [fact({ origin: 'inferred', visibility: 'student_and_teacher' })]
  const w = mount(); await waitFor(() => w.getByText('Chỉ giáo viên xem'))
  fireEvent.click(w.getByText('Chỉ giáo viên xem'))
  await waitFor(() => w.getByText('Mục này chỉ còn giáo viên thấy.'))
  assert.equal(w.queryByRole('group', { name: 'Xác nhận cho học viên xem' }), null)
  assert.deepEqual(calls.find(c => c[0] === 'vis'), ['vis', 'f1', 'teacher'])
})

test('thu hồi: phải xác nhận; Hủy không gọi RPC; xác nhận gửi lý do', async () => {
  facts = [fact({})]
  const v = mount(); await waitFor(() => v.getByText('Thu hồi'))
  fireEvent.click(v.getByText('Thu hồi'))
  assert.ok(v.getByRole('group', { name: 'Xác nhận thu hồi' }))
  assert.equal(calls.some(c => c[0] === 'revoke'), false, 'chưa gọi RPC trước khi xác nhận')
  fireEvent.click(v.getByText('Hủy'))
  assert.equal(v.queryByRole('group', { name: 'Xác nhận thu hồi' }), null)
  assert.equal(calls.some(c => c[0] === 'revoke'), false)
  fireEvent.click(v.getByText('Thu hồi'))
  fireEvent.change(v.getByLabelText('Lý do thu hồi (không bắt buộc)'), { target: { value: ' nhầm học viên ' } })
  fireEvent.click(v.getByText('Xác nhận thu hồi'))
  await waitFor(() => v.getByText(/Đã thu hồi\. Lịch sử vẫn được lưu/))
  assert.deepEqual(calls.find(c => c[0] === 'revoke'), ['revoke', 'f1', 'nhầm học viên'])
})

test('mục đã thu hồi chỉ hiện khi bật công tắc, và không còn nút sửa/xác minh/thu hồi', async () => {
  facts = [fact({ id: 'r', content: 'Đã sai', status: 'revoked', revoke_reason: 'nhầm' })]
  const v = mount(); await waitFor(() => v.getByText(/Chưa có thông tin nào/))
  fireEvent.click(v.getByLabelText(/Hiện cả mục đã thu hồi/))
  await waitFor(() => v.getByText('Đã sai'))
  assert.deepEqual(calls.filter(c => c[0] === 'get').map(c => c[2]), [false, true])
  assert.ok(v.getByText('Đã thu hồi: nhầm'))
  for (const t of ['Sửa', 'Xác minh', 'Thu hồi']) assert.equal(v.queryByText(t), null)
  assert.ok(v.getByText('Lịch sử'))
})

test('lịch sử: hiện hành động có nhãn tiếng Việt, nội dung trước/sau khi sửa; bấm lần nữa để ẩn', async () => {
  facts = [fact({})]
  hist = [
    { at: '2026-10-01T01:00:00Z', action: 'create', actor: 'x', before: null, after: { content: 'Muốn đệm hát' } },
    { at: '2026-10-02T01:00:00Z', action: 'edit', actor: 'x', before: { content: 'Muốn đệm hát' }, after: { content: 'Muốn đệm hát Bolero' } },
    { at: '2026-10-03T01:00:00Z', action: 'visibility:student_and_teacher', actor: 'x', before: null, after: null },
  ]
  const v = mount(); await waitFor(() => v.getByText('Lịch sử'))
  fireEvent.click(v.getByText('Lịch sử'))
  await waitFor(() => v.getByRole('region', { name: 'Lịch sử thay đổi' }))
  const r = v.getByRole('region', { name: 'Lịch sử thay đổi' }).textContent!
  assert.match(r, /Tạo mục/); assert.match(r, /Sửa nội dung/); assert.match(r, /Cho học viên xem/)
  assert.match(r, /Trước: Muốn đệm hát/); assert.match(r, /Sau: Muốn đệm hát Bolero/)
  fireEvent.click(v.getByText('Ẩn lịch sử'))
  assert.equal(v.queryByRole('region', { name: 'Lịch sử thay đổi' }), null)
})

test('lỗi quyền khi thao tác: hiện thông báo lỗi tiếng Việt, hồ sơ không bị đổi', async () => {
  facts = [fact({})]
  const v = mount(); await waitFor(() => v.getByText('Xác minh'))
  failNext = new Student360Error('forbidden', 'Bạn không có quyền thực hiện thao tác này.')
  fireEvent.click(v.getByText('Xác minh'))
  await waitFor(() => v.getByRole('alert'))
  assert.match(v.getByRole('alert').textContent!, /không có quyền/)
  assert.ok(v.getByText('Xác minh'), 'nút vẫn ở trạng thái cũ')
})

test('nút thu hồi/ sửa khoá khi đang có thao tác khác (chống bấm đúp)', async () => {
  facts = [fact({})]
  let release: () => void = () => {}
  const api = mkApi()
  api.setVerification = (id, l) => { calls.push(['verify', id, l]); return new Promise(res => { release = () => res(fact({})) }) }
  const v = render(<Student360Panel userId={U} overview={OV} api={api} />)
  await waitFor(() => v.getByText('Xác minh'))
  fireEvent.click(v.getByText('Xác minh'))
  fireEvent.click(v.getByText('Xác minh'))
  assert.equal(calls.filter(c => c[0] === 'verify').length, 1, 'bấm đúp chỉ gọi một lần')
  assert.equal((v.getByText('Sửa') as HTMLButtonElement).disabled, true)
  release()
  await waitFor(() => v.getByText('Đã xác minh.'))
})
