import './dom-setup'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import DockView from '../../src/mira-grading/DockView'
import TeacherComposer from '../../src/learning-thread/TeacherComposer'
import { useMiraDraftFor } from '../../src/mira-grading/draftContext'
import type { MiraGradingApi } from '../../src/mira-grading/api'

void React
const ORIGIN = 'https://m.example'; const CFG = { url: ORIGIN + '/grading', origin: ORIGIN }
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
afterEach(() => cleanup())

const api: MiraGradingApi = { ticket: async () => ({ ok: true, value: { ticket: 'a'.repeat(64), expiresAt: 'T' } }), end: async () => {}, pilotEnabled: async () => true }
const fromChild = (cw: unknown, data: unknown, origin = ORIGIN) => act(async () => { window.dispatchEvent(Object.assign(new window.Event('message'), { origin, source: cw, data })) })
const draftMsg = (id: string, text: string) => ({ v: 1, type: 'mira-grading-draft', id, text })

// Giả ThreadPage: đúng cách ThreadPage nối nháp vào TeacherComposer (cùng hook useMiraDraftFor + onMiraDraftHandled).
function Page({ threadId, respond }: { threadId: string; respond: (i: { body: string }) => Promise<{ ok: true }> }) {
  const { draft, handled } = useMiraDraftFor(threadId)
  return <TeacherComposer threadId={threadId} events={[]} allowKho={false} onSent={() => {}} miraDraft={draft} onMiraDraftHandled={handled}
    respond={respond as never} />
}
function setup(threadId = A) {
  const sent: string[] = []
  const respond = async (i: { body: string }) => { sent.push(i.body); return { ok: true as const } }
  const view = (id: string) => <DockView enabled cfg={CFG} api={api} threadId={id}><Page key={id} threadId={id} respond={respond} /></DockView>
  const r = render(view(threadId))
  const f = r.container.querySelector('iframe') as HTMLIFrameElement
  const cw = { postMessage: () => {} }
  Object.defineProperty(f, 'contentWindow', { configurable: true, value: cw })
  const box = () => r.container.querySelector('textarea') as HTMLTextAreaElement
  return { r, cw, sent, box, view }
}

test('thành công: ô trống → điền nháp, KHÔNG gửi, có dòng báo "chưa gửi"; sửa tiếp được', async () => {
  const { r, cw, sent, box } = setup()
  await fromChild(cw, draftMsg(A, 'Bạn tìm đúng nốt C.'))
  await waitFor(() => assert.equal(box().value, 'Bạn tìm đúng nốt C.'))
  assert.deepEqual(sent, [])
  assert.ok(r.getByText(/chưa gửi cho học viên/))
  fireEvent.change(box(), { target: { value: 'Bạn tìm đúng nốt C. Cố thêm.' } })
  assert.equal(r.queryByText(/chưa gửi cho học viên/), null)   // đã sửa tay → bỏ dòng báo
  assert.deepEqual(sent, [])
})
test('gửi vẫn là hành động riêng của Thầy: chỉ khi bấm "Gửi phản hồi" mới có lượt gửi, với đúng chữ trong ô', async () => {
  const { r, cw, sent, box } = setup()
  await fromChild(cw, draftMsg(A, 'Nháp 1'))
  await waitFor(() => assert.equal(box().value, 'Nháp 1'))
  fireEvent.click(r.getByRole('button', { name: 'Gửi phản hồi' }))
  await waitFor(() => assert.deepEqual(sent, ['Nháp 1']))
})
test('ô đã có chữ: hỏi xác nhận, chưa đổi gì; "Giữ nguyên" → chữ cũ còn nguyên, không gửi', async () => {
  const { r, cw, sent, box } = setup()
  fireEvent.change(box(), { target: { value: 'Chữ Thầy tự viết' } })
  await fromChild(cw, draftMsg(A, 'Nháp mới của Mira'))
  await waitFor(() => assert.ok(r.getByRole('alertdialog')))
  assert.equal(box().value, 'Chữ Thầy tự viết')
  fireEvent.click(r.getByRole('button', { name: 'Giữ nguyên' }))
  assert.equal(r.queryByRole('alertdialog'), null)
  assert.equal(box().value, 'Chữ Thầy tự viết'); assert.deepEqual(sent, [])
})
test('ô đã có chữ: "Thay bằng nháp của Mira" → thay đúng nháp, vẫn chưa gửi', async () => {
  const { r, cw, sent, box } = setup()
  fireEvent.change(box(), { target: { value: 'Chữ Thầy tự viết' } })
  await fromChild(cw, draftMsg(A, 'Nháp mới của Mira'))
  await waitFor(() => assert.ok(r.getByRole('alertdialog')))
  fireEvent.click(r.getByRole('button', { name: 'Thay bằng nháp của Mira' }))
  assert.equal(box().value, 'Nháp mới của Mira'); assert.equal(r.queryByRole('alertdialog'), null); assert.deepEqual(sent, [])
})
test('sai origin / sai cửa sổ / rỗng / vượt 4000 / mã bài lạ: ô không đổi, không hỏi', async () => {
  const { r, cw, box } = setup()
  await fromChild(cw, draftMsg(A, 'từ origin lạ'), 'https://evil.example')
  await fromChild({}, draftMsg(A, 'từ cửa sổ lạ'))
  await fromChild(cw, draftMsg(A, '   '))
  await fromChild(cw, draftMsg(A, 'x'.repeat(4001)))
  await fromChild(cw, draftMsg('không-phải-uuid', 'mã hỏng'))
  assert.equal(box().value, ''); assert.equal(r.queryByRole('alertdialog'), null); assert.equal(r.queryByText(/chưa gửi cho học viên/), null)
})
test('sai thread: nháp mang mã bài khác (Mira chưa kịp đổi bài) bị bỏ', async () => {
  const { cw, box } = setup(A)
  await fromChild(cw, draftMsg(B, 'nháp của bài B'))
  assert.equal(box().value, '')
})
test('đổi bài: nháp chưa dùng của bài cũ không điền sang bài mới, cũng không điền lại khi quay về bài cũ', async () => {
  const { r, cw, box, view } = setup(A)
  // nháp hợp lệ của A đang chờ (ô chưa mount được vì ta đổi bài ngay) → mô phỏng bằng: nhận nháp A rồi đổi sang B trước khi ô nhận
  await fromChild(cw, draftMsg(A, 'nháp A'))
  await waitFor(() => assert.equal(box().value, 'nháp A'))
  r.rerender(view(B))
  assert.equal(box().value, '')                      // bài B: ô sạch (Page có key theo bài)
  await fromChild(cw, draftMsg(A, 'nháp A đến muộn'))
  assert.equal(box().value, '')                      // mã A ≠ bài đang mở B
  r.rerender(view(A))
  assert.equal(box().value, '')                      // quay lại A: không tự điền lại
})
test('màn nhỏ: nhận nháp hợp lệ thì đóng ngăn Mira; nháp bị từ chối thì ngăn vẫn mở', async () => {
  const { r, cw } = setup()
  fireEvent.click(r.getByRole('button', { name: 'Mira' }))
  const panel = () => r.container.querySelector('.mira-dock-panel')!
  assert.ok(panel().classList.contains('is-open'))
  await fromChild(cw, draftMsg(B, 'sai bài'))
  assert.ok(panel().classList.contains('is-open'))
  await fromChild(cw, draftMsg(A, 'đúng bài'))
  await waitFor(() => assert.equal(panel().classList.contains('is-open'), false))
})
test('nháp thứ hai khi ô đang chờ xác nhận: lấy nháp mới nhất; cùng nội dung gửi lại vẫn được xử lý như nháp mới', async () => {
  const { r, cw, box } = setup()
  fireEvent.change(box(), { target: { value: 'Chữ cũ' } })
  await fromChild(cw, draftMsg(A, 'N1')); await fromChild(cw, draftMsg(A, 'N2'))
  await waitFor(() => assert.ok(r.getByRole('alertdialog')))
  fireEvent.click(r.getByRole('button', { name: 'Thay bằng nháp của Mira' }))
  assert.equal(box().value, 'N2')
  fireEvent.change(box(), { target: { value: 'N2 đã sửa' } })
  await fromChild(cw, draftMsg(A, 'N2'))             // cùng chữ nhưng là lần bấm mới
  await waitFor(() => assert.ok(r.getByRole('alertdialog')))
  assert.equal(box().value, 'N2 đã sửa')
})
