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
const { default: MiraOwnerThread } = await import('../../src/class-social/mira-owner/MiraOwnerThread')
const { default: MiraOwnerList } = await import('../../src/class-social/mira-owner/MiraOwnerList')
const { default: MiraOwnerEntry } = await import('../../src/class-social/mira-owner/MiraOwnerEntry')
const api = await import('../../src/class-social/mira-owner/miraOwnerApi')
const { viewFromPath, viewPath, sameView, MIRA_OWNER_PATH, chatConversationPath, chatConversationIdFromPath } = await import('../../src/class-social/resolveMeRoute')
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

test('route: /me/chat/m/<id> ↔ id miraowner:<id>; /me/mira-owner giữ làm đường dẫn tương thích', () => {
  assert.equal(chatConversationPath('miraowner:' + CONV), '/me/chat/m/' + CONV); assert.equal(chatConversationIdFromPath('/me/chat/m/' + CONV.toUpperCase()), 'miraowner:' + CONV)
  assert.equal(chatConversationIdFromPath('/me/chat/m/khong-phai-uuid'), null)
  assert.deepEqual(viewFromPath(MIRA_OWNER_PATH), { kind: 'miraOwner' }); assert.equal(viewPath({ kind: 'miraOwner' }), '/me/mira-owner'); assert.ok(sameView({ kind: 'miraOwner' }, { kind: 'miraOwner' }))
})
test('mục Mira-Owner chỉ được dựng khi InboxList nhận miraOwner (Chat truyền isAdmin === true); bấm → mở danh sách', async () => {
  let n = 0; const r = render(<MiraOwnerEntry onOpen={() => n++} />); fireEvent.click(r.getByTestId('mira-owner-entry')); assert.equal(n, 1)
  const il = read('src/class-social/chat/InboxList.tsx')
  assert.match(il, /miraOwner && !inbox\.searching && <MiraOwnerEntry/); assert.match(il, /miraOwner = false/)
  assert.match(read('src/class-social/sections/Chat.tsx'), /miraOwner=\{isAdmin === true\}/)
})
test('Owner: danh sách học viên gọi server; chọn học viên → mở hội thoại bằng id miraowner:<id>', async () => {
  const opened: string[] = []; let back = 0
  const r = render(<MiraOwnerList selectedId={null} onSelect={id => opened.push('miraowner:' + id)} onBack={() => back++} />)
  await waitFor(() => r.getByText('Lan')); fireEvent.click(r.getByTestId('mira-owner-row'))
  assert.deepEqual(opened, ['miraowner:' + CONV]); assert.equal(calls[0].fn, 'mira_owner_conversations'); fireEvent.click(r.getByTestId('manager-back')); assert.equal(back, 1)
})
test('Khung hội thoại: tin học viên ≠ tin Mira, có thời gian, liên kết Student 360°, CHỈ ĐỌC (không ô nhập, không nút gửi)', async () => {
  const r = render(<MiraOwnerThread conversationId={CONV} onBack={() => {}} />)
  await waitFor(() => r.getByText('Bạn thử đổi hợp âm chậm.'))
  const rows = Array.from(r.container.querySelectorAll('[data-role]')).map(e => e.getAttribute('data-role')); assert.deepEqual(rows, ['user', 'assistant'])
  assert.equal((r.getByTestId('mira-360-link') as HTMLAnchorElement).getAttribute('href'), `/student?id=${EDU}`)
  assert.equal(r.container.querySelectorAll('textarea, input, [contenteditable]').length, 0, 'không có ô nhập')
  assert.ok(r.getByText(/Chỉ đọc/)); assert.deepEqual(calls.map(c => c.fn), ['mira_owner_conversation_get'])
})
test('Chat chỉ dựng khung Mira-Owner khi isAdmin === true; Mira của học viên giữ nguyên', () => {
  const chat = read('src/class-social/sections/Chat.tsx')
  assert.match(chat, /isMiraOwnerConv = isAdmin === true && /); assert.match(chat, /!isMira && !isMiraOwnerConv/)
  assert.match(chat, /miraOwner=\{isAdmin === true\}/)
})
test('server từ chối (không phải Owner) ⇒ báo "chỉ dành cho Owner", không lộ gì', async () => {
  mode = 'forbidden'; const r = render(<MiraOwnerThread conversationId={CONV} onBack={() => {}} />)
  await waitFor(() => r.getByText('Mục này chỉ dành cho Owner.')); assert.ok(!r.queryByText('Lan'))
  const l = render(<MiraOwnerList selectedId={null} onSelect={() => {}} />); await waitFor(() => l.getByText('Chỉ dành cho Owner'))
})
test('tìm kiếm: gõ xong gửi q lên server (không lọc phía client); lỗi mạng ⇒ nút thử lại', async () => {
  const r = render(<MiraOwnerList selectedId={null} onSelect={() => {}} />); await waitFor(() => r.getByText('Lan'))
  fireEvent.change(r.getByTestId('mira-owner-search'), { target: { value: 'hop am' } })
  await waitFor(() => assert.equal(calls.length, 2)); assert.equal((calls[1].args.p_args as Record<string, unknown>).q, 'hop am')
  cleanup(); mode = 'fail'; const f = render(<MiraOwnerList selectedId={null} onSelect={() => {}} />); await waitFor(() => f.getByText('Thử lại'))
})
test('student360Href chỉ nhận UUID', () => {
  assert.equal(api.student360Href(EDU), `/student?id=${EDU}`); assert.equal(api.student360Href(null), null); assert.equal(api.student360Href('x"><script>'), null)
})
test('không còn menu riêng; trang cũ chuyển vào Hộp thư; route OG giữ; không bảng/RPC mới', () => {
  assert.ok(!/mira-owner|MIRA_OWNER_ITEM/.test(read('src/class-social/ClassSocialLayout.tsx')))
  assert.match(read('src/class-social/ClassSocialPage.tsx'), /view\.kind === 'miraOwner'[\s\S]{0,140}section: 'chat'[\s\S]{0,60}\?mira=1/)
  assert.match(read('netlify/og/routes.ts'), /'\/me\/mira-owner'/)
  const code = ['MiraOwnerList', 'MiraOwnerThread', 'miraOwnerApi'].map(f => read(`src/class-social/mira-owner/${f}.${f === 'miraOwnerApi' ? 'ts' : 'tsx'}`)).join('\n')
  assert.deepEqual([...new Set([...code.matchAll(/rpc\('([a-z_0-9]+)'/g)].map(m => m[1]))].sort(), ['mira_owner_conversation_get', 'mira_owner_conversations'])
  assert.ok(!/\.insert\(|\.update\(|\.delete\(|mira_owner_delete|sendMessage|dm_send/.test(code), 'Owner chỉ đọc')
})
test('client học viên: chỉ gửi/giữ conversation_id (UUID); id lạ từ server bị bỏ; không lưu trình duyệt', async () => {
  const sent: Array<Record<string, unknown>> = []
  setMiraTransport({ rpc: async () => ({ data: null, error: null }), invoke: async (_f, body) => { sent.push(body as Record<string, unknown>); return { data: { status: 'ok', reply: 'ok', actions: [], ctx_fp: 'f', conversation_id: sent.length === 1 ? CONV : '<script>' }, error: null } } })
  const a = await askMira({ message: 'hi', history: [], historyFp: '' }); assert.equal(a.conversationId, CONV); assert.ok(!('conversation_id' in sent[0]))
  const b = await askMira({ message: 'hi2', history: [], historyFp: '', conversationId: CONV }); assert.equal(sent[1].conversation_id, CONV); assert.equal(b.conversationId, undefined)
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(read('src/class-social/chat/useMiraChat.ts').replace(/\/\/.*$/gm, '')))
})
