/** Hội thoại học viên ↔ Mira (Owner): route, nav chỉ cho admin, danh sách/tìm/đọc, liên kết Student 360°, từ chối quyền, client chỉ giữ conversation_id. */
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// @ts-expect-error jsdom không có kiểu
import { JSDOM } from 'jsdom'
import React from 'react'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://localhost' })
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window }, document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator }, IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
})
const { render, cleanup, fireEvent, waitFor } = await import('@testing-library/react')
const { default: MiraOwnerPage } = await import('../../src/class-social/mira-owner/MiraOwnerPage')
const api = await import('../../src/class-social/mira-owner/miraOwnerApi')
const { viewFromPath, viewPath, sameView, MIRA_OWNER_PATH } = await import('../../src/class-social/resolveMeRoute')
const { askMira, setMiraTransport } = await import('../../src/class-social/chat/miraApi')
void React
const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')
const STU = 'c0000000-0000-4000-8000-0000000000aa', CONV = 'c1000000-0000-4000-8000-000000000001', EDU = 'e0000000-0000-4000-8000-0000000000bb'
let calls: Array<{ fn: string; args: Record<string, unknown> }> = []
let mode: 'ok' | 'forbidden' | 'fail' = 'ok'
const item = { conversation_id: CONV, student_user_id: STU, student_id: EDU, display_name: 'Lan', started_at: '2026-11-18T01:00:00Z', last_at: '2026-11-18T01:05:00Z', turn_count: 2, snippet: 'Em muốn luyện hợp âm Am', matched: false }
api.setMiraOwnerRpc(async (fn, args = {}) => {
  calls.push({ fn, args })
  if (mode === 'forbidden') return { data: null, error: { code: '42501', message: 'MIRA_OWNER_ONLY' } }
  if (mode === 'fail') return { data: null, error: { message: 'boom' } }
  if (fn === 'mira_owner_conversations') return { data: { items: [item], total_conversations: 1, total_students: 1, next_before: null }, error: null }
  return { data: { conversation_id: CONV, student_user_id: STU, student_id: EDU, display_name: 'Lan', started_at: item.started_at, last_at: item.last_at, turn_count: 2, notice_version: 3,
    messages: [{ seq: 1, role: 'user', content: 'Em muốn luyện hợp âm Am', created_at: item.started_at, meta: {} }, { seq: 2, role: 'assistant', content: 'Bạn thử đổi hợp âm chậm.', created_at: item.started_at, meta: {} }] }, error: null }
})
afterEach(() => { cleanup(); calls = []; mode = 'ok' })

test('route /me/mira-owner: viewFromPath ↔ viewPath ↔ sameView', () => {
  assert.deepEqual(viewFromPath(MIRA_OWNER_PATH), { kind: 'miraOwner' }); assert.equal(viewPath({ kind: 'miraOwner' }), '/me/mira-owner')
  assert.ok(sameView({ kind: 'miraOwner' }, { kind: 'miraOwner' })); assert.ok(!sameView({ kind: 'miraOwner' }, { kind: 'queue' }))
})
test('danh sách hiện học viên + đoạn trích; mở hội thoại hiện đủ tin và liên kết hồ sơ Student 360°', async () => {
  const r = render(<MiraOwnerPage onBack={() => {}} />)
  await waitFor(() => r.getByText('Lan')); assert.ok(r.getByText('Em muốn luyện hợp âm Am'))
  fireEvent.click(r.getByText('Lan'))
  await waitFor(() => r.getByText('Bạn thử đổi hợp âm chậm.'))
  const a = r.getByText(/Hồ sơ Student 360°/) as HTMLAnchorElement
  assert.equal(a.getAttribute('href'), `/student?id=${EDU}`)
  assert.deepEqual(calls.map(c => c.fn), ['mira_owner_conversations', 'mira_owner_conversation_get'])
})
test('tìm kiếm gửi q lên server (không lọc phía client)', async () => {
  const r = render(<MiraOwnerPage onBack={() => {}} />); await waitFor(() => r.getByText('Lan'))
  fireEvent.change(r.getByLabelText('Tìm hội thoại'), { target: { value: 'hop am' } }); fireEvent.submit(r.getByLabelText('Tìm hội thoại').closest('form')!)
  await waitFor(() => assert.equal(calls.length, 2)); assert.deepEqual((calls[1].args.p_args as Record<string, unknown>).q, 'hop am')
})
test('server từ chối (không phải Owner) ⇒ màn "chỉ dành cho Owner", không lộ gì', async () => {
  mode = 'forbidden'; const r = render(<MiraOwnerPage onBack={() => {}} />)
  await waitFor(() => r.getByText('Mục này chỉ dành cho Owner.')); assert.ok(!r.queryByText('Lan'))
})
test('lỗi mạng ⇒ báo lỗi + nút thử lại', async () => {
  mode = 'fail'; const r = render(<MiraOwnerPage onBack={() => {}} />); await waitFor(() => r.getByText(/Chưa tải được/)); assert.ok(r.getByText('Thử lại'))
})
test('student360Href chỉ nhận UUID', () => {
  assert.equal(api.student360Href(EDU), `/student?id=${EDU}`); assert.equal(api.student360Href(null), null); assert.equal(api.student360Href('x"><script>'), null)
})
test('nav "Hội thoại với Mira" chỉ gắn khi me.isAdmin === true; trang kiểm isAdmin lần nữa; route private cho OG', () => {
  const layout = read('src/class-social/ClassSocialLayout.tsx'); assert.equal((layout.match(/miraOwner=\{me\.isAdmin === true\}/g) ?? []).length, 2)
  assert.match(read('src/class-social/ClassSocialPage.tsx'), /view\.kind === 'miraOwner' && \(me\.isAdmin/)
  assert.match(read('netlify/og/routes.ts'), /'\/me\/mira-owner'/)
})
test('client chỉ gửi/giữ conversation_id (UUID); id lạ từ server bị bỏ; không lưu trình duyệt', async () => {
  const sent: Array<Record<string, unknown>> = []
  setMiraTransport({ rpc: async () => ({ data: null, error: null }), invoke: async (_f, body) => { sent.push(body as Record<string, unknown>); return { data: { status: 'ok', reply: 'ok', actions: [], ctx_fp: 'f', conversation_id: sent.length === 1 ? CONV : '<script>' }, error: null } } })
  const a = await askMira({ message: 'hi', history: [], historyFp: '' }); assert.equal(a.conversationId, CONV); assert.ok(!('conversation_id' in sent[0]))
  const b = await askMira({ message: 'hi2', history: [], historyFp: '', conversationId: CONV }); assert.equal(sent[1].conversation_id, CONV); assert.equal(b.conversationId, undefined)
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(read('src/class-social/chat/useMiraChat.ts').replace(/\/\/.*$/gm, '')))
})
