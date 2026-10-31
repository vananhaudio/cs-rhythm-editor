import './dom-setup'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import DockView from '../../src/mira-grading/DockView'
import type { MiraGradingApi } from '../../src/mira-grading/api'

void React
const ORIGIN = 'https://m.example'; const CFG = { url: ORIGIN + '/grading', origin: ORIGIN }
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
afterEach(() => cleanup())

function mkApi() {
  const asked: string[] = []; const ended: string[] = []
  const api: MiraGradingApi = {
    ticket: async (id) => { asked.push(id); return { ok: true, value: { ticket: (id === A ? 'a' : 'b').repeat(64), expiresAt: 'T' } } },
    end: async (id) => { ended.push(id) },
  }
  return { api, asked, ended }
}
// iframe jsdom không có contentWindow thật: thay bằng cửa sổ giả ghi lại postMessage
function stubFrame(container: HTMLElement) {
  const f = container.querySelector('iframe') as HTMLIFrameElement
  const sent: { data: Record<string, unknown>; origin: string }[] = []
  const cw = { postMessage: (data: unknown, origin: string) => sent.push({ data, origin }) }
  Object.defineProperty(f, 'contentWindow', { configurable: true, value: cw })
  return { f, cw, sent }
}
const fromChild = (cw: unknown, data: unknown, origin = ORIGIN) => act(async () => { window.dispatchEvent(Object.assign(new window.Event('message'), { origin, source: cw, data })) })

test('tắt (không phải Thầy / chưa bật cấu hình): chỉ render children, KHÔNG iframe — giống hệt trước khi có tính năng', () => {
  const { api } = mkApi()
  const a = render(<DockView enabled={false} cfg={CFG} api={api} threadId={A}><p>Màn chấm</p></DockView>)
  assert.equal(a.container.querySelector('iframe'), null); assert.ok(a.getByText('Màn chấm')); a.unmount()
  const b = render(<DockView enabled cfg={null} api={api} threadId={A}><p>Màn chấm</p></DockView>)
  assert.equal(b.container.querySelector('iframe'), null); assert.equal(b.container.innerHTML, '<p>Màn chấm</p>')
})
test('bật: iframe bị hạn chế quyền, không referrer, nội dung chấm vẫn nằm bên trái; có nút Mira cho màn nhỏ', () => {
  const { api } = mkApi()
  const r = render(<DockView enabled cfg={CFG} api={api} threadId={A}><p>Màn chấm</p></DockView>)
  const f = r.container.querySelector('iframe')!
  assert.equal(f.getAttribute('src'), CFG.url); assert.equal(f.getAttribute('sandbox'), 'allow-scripts allow-same-origin'); assert.equal(f.getAttribute('referrerpolicy'), 'no-referrer'); assert.equal(f.getAttribute('allow'), '')
  assert.ok(r.getByText('Màn chấm')); assert.ok(r.getByRole('button', { name: 'Mira' }))
  assert.equal(r.container.querySelector('.mira-dock-main')!.textContent, 'Màn chấm')
})
test('luồng: iframe báo sẵn sàng → nhận mã bài + vé tới ĐÚNG origin; chuyển bài → vé mới, bài cũ thu hồi, không gửi chéo', async () => {
  const { api, asked, ended } = mkApi()
  const r = render(<DockView enabled cfg={CFG} api={api} threadId={A}><p>x</p></DockView>)
  const { cw, sent } = stubFrame(r.container)
  await fromChild(cw, { v: 1, type: 'mira-grading-ready' })
  await waitFor(() => assert.equal(sent.length, 1))
  assert.equal(sent[0].origin, ORIGIN); assert.notEqual(sent[0].origin, '*')
  assert.deepEqual([sent[0].data.type, sent[0].data.id, sent[0].data.ticket], ['mira-context', A, 'a'.repeat(64)])
  assert.equal(JSON.stringify(sent).includes('access_token'), false)
  r.rerender(<DockView enabled cfg={CFG} api={api} threadId={B}><p>x</p></DockView>)
  await waitFor(() => assert.equal(sent.length, 2))
  assert.deepEqual([sent[1].data.id, sent[1].data.ticket, sent[1].data.seq], [B, 'b'.repeat(64), 2]); assert.deepEqual(asked, [A, B]); assert.deepEqual(ended, [A])
})
test('tin giả: sai origin / sai cửa sổ không kích hoạt cấp vé', async () => {
  const { api, asked } = mkApi()
  const r = render(<DockView enabled cfg={CFG} api={api} threadId={A}><p>x</p></DockView>)
  const { cw } = stubFrame(r.container)
  await fromChild(cw, { v: 1, type: 'mira-grading-ready' }, 'https://evil.example')
  await fromChild({}, { v: 1, type: 'mira-grading-ready' })
  await new Promise((res) => setTimeout(res, 30)); assert.deepEqual(asked, [])
})
test('máy chủ Mira/Class chưa sẵn sàng: hiện thông báo nhẹ, màn chấm bài không bị ảnh hưởng', async () => {
  const api: MiraGradingApi = { ticket: async () => ({ ok: false, reason: 'unavailable' }), end: async () => {} }
  const r = render(<DockView enabled cfg={CFG} api={api} threadId={A}><p>Màn chấm</p></DockView>)
  const { cw } = stubFrame(r.container); await fromChild(cw, { v: 1, type: 'mira-grading-ready' })
  await waitFor(() => assert.ok(r.getByText(/Mira chưa sẵn sàng/))); assert.ok(r.getByText('Màn chấm'))
})
test('màn nhỏ: bấm nút Mira mở ngăn, đóng lại trả về màn chấm; unmount thu hồi vé', async () => {
  const { api, ended } = mkApi()
  const r = render(<DockView enabled cfg={CFG} api={api} threadId={A}><p>Màn chấm</p></DockView>)
  const { cw } = stubFrame(r.container); await fromChild(cw, { v: 1, type: 'mira-grading-ready' })
  const panel = r.getByTestId('mira-panel'); assert.ok(!panel.className.includes('is-open'))
  fireEvent.click(r.getByRole('button', { name: 'Mira' })); assert.ok(panel.className.includes('is-open'))
  fireEvent.click(r.getByRole('button', { name: 'Đóng Mira' })); assert.ok(!panel.className.includes('is-open'))
  r.unmount(); await waitFor(() => assert.deepEqual(ended, [A]))
})
