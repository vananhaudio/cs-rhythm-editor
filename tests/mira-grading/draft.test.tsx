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
let ridN = 0
const draftMsg = (id: string, text: string, rid = `rid-${String(++ridN).padStart(8, '0')}`) => ({ v: 1, type: 'mira-grading-draft', id, rid, text })

// Giả ThreadPage: đúng cách ThreadPage nối nháp vào TeacherComposer (cùng hook useMiraDraftFor + onMiraDraftHandled).
function Page({ threadId, respond }: { threadId: string; respond: (i: { body: string }) => Promise<{ ok: true }> }) {
  const { draft, report } = useMiraDraftFor(threadId)
  return <TeacherComposer threadId={threadId} events={[]} allowKho={false} onSent={() => {}} miraDraft={draft} onMiraDraft={report}
    respond={respond as never} />
}
function setup(threadId = A, ackTimeoutMs = 2000, withComposer = true) {
  const sent: string[] = []
  const respond = async (i: { body: string }) => { sent.push(i.body); return { ok: true as const } }
  const view = (id: string) => <DockView enabled cfg={CFG} api={api} threadId={id} ackTimeoutMs={ackTimeoutMs}>{withComposer ? <Page key={id} threadId={id} respond={respond} /> : <p>Không có ô phản hồi</p>}</DockView>
  const r = render(view(threadId))
  const f = r.container.querySelector('iframe') as HTMLIFrameElement
  const out: { data: Record<string, unknown>; origin: string }[] = []
  const cw = { postMessage: (data: Record<string, unknown>, origin: string) => { if (data.type === 'mira-draft-result') out.push({ data, origin }) } }
  Object.defineProperty(f, 'contentWindow', { configurable: true, value: cw })
  const box = () => r.container.querySelector('textarea') as HTMLTextAreaElement
  const results = () => out.map(o => `${o.data.status}`)
  return { r, cw, sent, box, view, out, results }
}

test('thành công: ô trống → điền nháp, KHÔNG gửi, có dòng báo "chưa gửi"; Mira nhận "applied"; sửa tiếp được', async () => {
  const { r, cw, sent, box, out } = setup()
  await fromChild(cw, draftMsg(A, 'Bạn tìm đúng nốt C.', 'rid-aaaaaaaa'))
  await waitFor(() => assert.equal(box().value, 'Bạn tìm đúng nốt C.'))
  assert.deepEqual(sent, [])
  await waitFor(() => assert.deepEqual(out.map(o => [o.data.rid, o.data.id, o.data.status, o.origin]), [['rid-aaaaaaaa', A, 'applied', ORIGIN]]))   // xác nhận về ĐÚNG yêu cầu, đúng origin
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
test('ô đã có chữ: hỏi xác nhận, chưa đổi gì; "Giữ nguyên" → chữ cũ còn nguyên, không gửi, Mira nhận "declined"', async () => {
  const { r, cw, sent, box, results } = setup(A, 50)
  fireEvent.change(box(), { target: { value: 'Chữ Thầy tự viết' } })
  await fromChild(cw, draftMsg(A, 'Nháp mới của Mira'))
  await waitFor(() => assert.ok(r.getByRole('alertdialog')))
  assert.equal(box().value, 'Chữ Thầy tự viết')
  assert.deepEqual(results(), [])                    // đang chờ Thầy quyết định: CHƯA báo thành công
  await new Promise(r => setTimeout(r, 120))         // quá ackTimeoutMs: ô đã nhận nháp nên KHÔNG bị tính là 'unavailable'
  assert.deepEqual(results(), [])
  fireEvent.click(r.getByRole('button', { name: 'Giữ nguyên' }))
  assert.equal(r.queryByRole('alertdialog'), null)
  assert.equal(box().value, 'Chữ Thầy tự viết'); assert.deepEqual(sent, [])
  assert.deepEqual(results(), ['declined'])          // huỷ thay → không báo thành công
})
test('ô đã có chữ: "Thay bằng nháp của Mira" → thay đúng nháp, vẫn chưa gửi, Mira nhận "applied" sau khi thay', async () => {
  const { r, cw, sent, box, results } = setup()
  fireEvent.change(box(), { target: { value: 'Chữ Thầy tự viết' } })
  await fromChild(cw, draftMsg(A, 'Nháp mới của Mira'))
  await waitFor(() => assert.ok(r.getByRole('alertdialog')))
  assert.deepEqual(results(), [])
  fireEvent.click(r.getByRole('button', { name: 'Thay bằng nháp của Mira' }))
  assert.equal(box().value, 'Nháp mới của Mira'); assert.equal(r.queryByRole('alertdialog'), null); assert.deepEqual(sent, [])
  assert.deepEqual(results(), ['applied'])           // chỉ SAU khi Thầy đồng ý thay
})
test('sai origin / sai cửa sổ / rỗng / vượt 4000 / mã bài lạ: ô không đổi, không hỏi', async () => {
  const { r, cw, box, out } = setup()
  await fromChild(cw, draftMsg(A, 'từ origin lạ'), 'https://evil.example')
  await fromChild({}, draftMsg(A, 'từ cửa sổ lạ'))
  await fromChild(cw, draftMsg(A, '   '))
  await fromChild(cw, draftMsg(A, 'x'.repeat(4001)))
  await fromChild(cw, draftMsg('không-phải-uuid', 'mã hỏng'))
  assert.equal(box().value, ''); assert.equal(r.queryByRole('alertdialog'), null); assert.equal(r.queryByText(/chưa gửi cho học viên/), null)
  assert.deepEqual(out.map(o => o.data.status), ['rejected'].slice(1))   // tin không hợp lệ: im lặng, không có phản hồi nào (đặc biệt không có 'applied')
})
test('sai thread: nháp mang mã bài khác (Mira chưa kịp đổi bài) bị bỏ và Mira nhận "rejected"', async () => {
  const { cw, box, out } = setup(A)
  await fromChild(cw, draftMsg(B, 'nháp của bài B', 'rid-bbbbbbbb'))
  assert.equal(box().value, '')
  assert.deepEqual(out.map(o => [o.data.rid, o.data.id, o.data.status]), [['rid-bbbbbbbb', B, 'rejected']])   // báo từ chối, không báo thành công
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

test('không có ô nhận (bài không cho phản hồi): hết hạn → Mira nhận \"unavailable\", nháp bị bỏ, KHÔNG điền muộn', async () => {
  const { r, cw, results } = setup(A, 40, false)
  await fromChild(cw, draftMsg(A, 'nháp không có chỗ nhận'))
  assert.deepEqual(results(), [])
  await waitFor(() => assert.deepEqual(results(), ['unavailable']))
  assert.equal(r.container.querySelector('textarea'), null)
})
test('đổi bài khi nháp đang chờ Thầy xác nhận: không có xác nhận nào gửi về (kết quả bài cũ bị huỷ), bài mới sạch', async () => {
  const { r, cw, box, view, results } = setup(A, 50)
  fireEvent.change(box(), { target: { value: 'Chữ Thầy' } })
  await fromChild(cw, draftMsg(A, 'Nháp A'))
  await waitFor(() => assert.ok(r.getByRole('alertdialog')))
  r.rerender(view(B))
  await new Promise(res => setTimeout(res, 120))
  assert.equal(box().value, ''); assert.equal(r.queryByRole('alertdialog'), null)
  assert.deepEqual(results(), [])                    // không gửi 'applied'/'declined' của bài A sang lúc đang ở bài B
})
test('nháp mới thay nháp đang chờ xác nhận: nháp cũ nhận \"declined\", nháp mới được hỏi', async () => {
  const { r, cw, box, out } = setup(A, 50)
  fireEvent.change(box(), { target: { value: 'Chữ Thầy' } })
  await fromChild(cw, draftMsg(A, 'N1', 'rid-11111111')); await fromChild(cw, draftMsg(A, 'N2', 'rid-22222222'))
  await waitFor(() => assert.deepEqual(out.map(o => [o.data.rid, o.data.status]), [['rid-11111111', 'declined']]))
  fireEvent.click(r.getByRole('button', { name: 'Thay bằng nháp của Mira' }))
  assert.equal(box().value, 'N2')
  assert.deepEqual(out.map(o => [o.data.rid, o.data.status]), [['rid-11111111', 'declined'], ['rid-22222222', 'applied']])
})
test('xác nhận chỉ gửi tới đúng origin Mira (không \"*\")', async () => {
  const { cw, out } = setup()
  await fromChild(cw, draftMsg(A, 'x'))
  await waitFor(() => assert.equal(out.length, 1))
  assert.equal(out[0].origin, ORIGIN); assert.notEqual(out[0].origin, '*')
})
