/** Mira chủ động V3 (giao diện): thẻ lời mời ở /me, Hộp thư, khung Mira; lựa chọn Trò chuyện / Không cần / Tắt; chỉ qua RPC; không kênh ngoài. Logic mời + tần suất + đồng ý: scripts/test-mira-proactive-db.sh */
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
dom.window.HTMLElement.prototype.scrollIntoView = () => {}
const { render, cleanup, fireEvent, waitFor } = await import('@testing-library/react')
const { setMiraTransport } = await import('../../src/class-social/chat/miraApi')
const { default: Banner } = await import('../../src/class-social/chat/MiraInvitationBanner')
const { default: MiraListItem } = await import('../../src/class-social/chat/MiraListItem')
const { default: MiraChatView } = await import('../../src/class-social/chat/MiraChatView')
const { default: Toggle } = await import('../../src/class-social/chat/MiraProactiveToggle')
const { takeInviteHandoff, setInviteHandoff } = await import('../../src/class-social/chat/miraInviteApi')
void React
const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')
const code = (f: string) => read(f).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
const IID = 'a1000000-0000-4000-8000-0000000000a1', CONV = 'c1000000-0000-4000-8000-000000000001'
const TEXT = 'Chào An, Thầy đã đề nghị bạn làm lại bài 1.1 (buổi 1). Bạn có muốn mình cùng xem lại cách luyện cho bài này không?'
let calls: Array<{ fn: string; args?: Record<string, unknown> }> = []
let inv: { id: string; kind: string; text: string } | null = { id: IID, kind: 'needs_retry', text: TEXT }
let enabled = true
setMiraTransport({
  rpc: async (fn, args) => {
    calls.push({ fn, args })
    if (fn === 'mira_invitation_ensure' || fn === 'mira_invitation_pending') return { data: inv, error: null }
    if (fn === 'mira_invitation_open') return { data: { text: TEXT, conversation_id: CONV }, error: null }
    if (fn === 'mira_proactive_enabled') return { data: enabled, error: null }
    if (fn === 'mira_proactive_set') { enabled = args?.p_enabled === true; return { data: enabled, error: null } }
    if (fn === 'mira_student_pilot_enabled') return { data: true, error: null }
    return { data: null, error: null }
  },
  invoke: async () => ({ data: { status: 'ok', reply: 'ok', actions: [], ctx_fp: 'f', conversation_id: CONV }, error: null }),
})
afterEach(() => { cleanup(); calls = []; inv = { id: IID, kind: 'needs_retry', text: TEXT }; enabled = true; takeInviteHandoff() })

test('/me: thẻ lời mời hiện đúng nội dung do server cấp; gọi ensure (nhận diện tình huống) đúng một lần', async () => {
  const r = render(<Banner mode="ensure" onStart={() => {}} />)
  await waitFor(() => r.getByTestId('mira-invite')); assert.equal(r.getByTestId('mira-invite-text').textContent, TEXT)
  assert.deepEqual(calls.map(c => c.fn), ['mira_invitation_ensure'])
})
test('server không mời (chưa đồng ý / hết hạn mức / ngoài pilot) ⇒ không hiện gì', async () => {
  inv = null; const r = render(<Banner mode="ensure" onStart={() => {}} />); await waitFor(() => assert.equal(calls.length, 1)); assert.ok(!r.queryByTestId('mira-invite'))
})
test('không bật (giáo viên / ngoài pilot ở client) ⇒ KHÔNG gọi RPC nào', async () => {
  const r = render(<Banner mode="ensure" enabled={false} onStart={() => {}} />); await new Promise(res => setTimeout(res, 30)); assert.equal(calls.length, 0); assert.ok(!r.queryByTestId('mira-invite'))
})
test('"Trò chuyện": mở lời mời (RPC), chuyển lời + hội thoại đã lưu cho khung chat', async () => {
  let got: unknown = null; const r = render(<Banner mode="ensure" onStart={x => { got = x }} />)
  await waitFor(() => r.getByTestId('mira-invite-start')); fireEvent.click(r.getByTestId('mira-invite-start'))
  await waitFor(() => assert.ok(got)); assert.deepEqual(got, { text: TEXT, conversationId: CONV }); assert.equal(calls[1].fn, 'mira_invitation_open'); assert.equal(calls[1].args?.p_id, IID)
  assert.ok(!r.queryByTestId('mira-invite'))
})
test('"Không cần": gửi từ chối và thẻ biến mất', async () => {
  const a = render(<Banner mode="ensure" onStart={() => {}} />); await waitFor(() => a.getByTestId('mira-invite-decline')); fireEvent.click(a.getByTestId('mira-invite-decline'))
  await waitFor(() => assert.ok(!a.queryByTestId('mira-invite'))); assert.ok(calls.some(c => c.fn === 'mira_invitation_decline' && c.args?.p_id === IID))
})
test('"Tắt lời nhắc": gọi tắt và báo đã tắt', async () => {
  const b = render(<Banner mode="ensure" onStart={() => {}} />); await waitFor(() => b.getByTestId('mira-invite-off-btn')); fireEvent.click(b.getByTestId('mira-invite-off-btn'))
  await waitFor(() => b.getByTestId('mira-invite-off')); assert.ok(calls.some(c => c.fn === 'mira_proactive_set' && c.args?.p_enabled === false))
})
test('Hộp thư: mục Mira hiện lời mời + chấm báo khi có lời đang chờ; không thì giữ câu cũ; chỉ ĐỌC (pending), không tạo', async () => {
  const a = render(<MiraListItem active={false} onSelect={() => {}} />)
  await waitFor(() => assert.equal(a.getByTestId('mira-list-preview').textContent, TEXT)); assert.ok(a.getByTestId('mira-list-dot'))
  assert.deepEqual(calls.map(c => c.fn).sort(), ['mira_invitation_pending', 'mira_welcome_get']); cleanup()
  inv = null; const b = render(<MiraListItem active={false} onSelect={() => {}} />)
  await waitFor(() => assert.equal(calls.length, 4)); assert.match(b.getByTestId('mira-list-preview').textContent ?? '', /Chào bạn, mình là Mira/); assert.ok(!b.queryByTestId('mira-list-dot'))
})
test('khung Mira: lời mời đang chờ hiện trong chat; bấm Trò chuyện ⇒ lời của Mira thành câu mở đầu, hội thoại nối vào lượt hỏi tiếp theo', async () => {
  const r = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  await waitFor(() => r.getByTestId('mira-invite-start')); fireEvent.click(r.getByTestId('mira-invite-start'))
  await waitFor(() => r.getByText(TEXT, { selector: '.cs-msg-bubble' }))
  const box = r.getByLabelText('Tin nhắn gửi Mira') as HTMLTextAreaElement
  fireEvent.change(box, { target: { value: 'Có, mình muốn xem lại' } }); fireEvent.keyDown(box, { key: 'Enter' }); fireEvent.click(r.getByLabelText(/Gửi/))
})
test('mở từ /me: lời mời chuyển sang khung chat đúng MỘT lần (không lặp khi mở lại)', async () => {
  setInviteHandoff({ text: TEXT, conversationId: CONV })
  inv = null
  const a = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />); await waitFor(() => a.getByText(TEXT, { selector: '.cs-msg-bubble' })); a.unmount()
  const b = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />); await new Promise(res => setTimeout(res, 30)); assert.ok(!b.queryByText(TEXT, { selector: '.cs-msg-bubble' }))
})
test('bật/tắt lời nhắc trong khung Mira đi qua RPC; ngoài pilot (null) không hiện', async () => {
  const r = render(<Toggle />); await waitFor(() => r.getByText('Tắt lời nhắc')); fireEvent.click(r.getByText('Tắt lời nhắc'))
  await waitFor(() => r.getByText('Bật lại')); assert.equal(enabled, false)
})
test('rào chắn nguồn: chỉ RPC mira_*; không kênh ngoài; không lưu trình duyệt; client không tự sinh nội dung lời mời', () => {
  const src = ['miraInviteApi.ts', 'MiraInvitationBanner.tsx', 'MiraProactiveToggle.tsx', 'MiraListItem.tsx'].map(f => code(`src/class-social/chat/${f}`)).join('\n')
  const rpcs = new Set([...src.matchAll(/'(mira_[a-z_]+)'/g)].map(m => m[1]))
  assert.deepEqual([...rpcs].sort(), ['mira_invitation_decline', 'mira_invitation_ensure', 'mira_invitation_open', 'mira_invitation_pending', 'mira_proactive_enabled', 'mira_proactive_set', 'mira_welcome_get', 'mira_welcome_opened'])
  assert.ok(!/localStorage|sessionStorage|indexedDB|Notification|serviceWorker|PushManager|mailto:|sms:|fetch\(/.test(src))
  assert.match(code('src/class-social/sections/MeHome.tsx'), /enabled=\{miraOn && !me\.isTeacher\}/)
})

// V3.1: đồng ý ngay trong hội thoại — vẫn là lựa chọn của chính học viên; không tự đồng ý.
const { default: ConsentBubble } = await import('../../src/class-social/chat/MiraConsentBubble')
const view = (state: string) => ({ status: 'ready', consent: { state, notice: { version: 2, title: 'T', body: 'Đoạn 1\n\nĐoạn 2' } } }) as never
test('V3.1: chưa đồng ý ⇒ Mira đề nghị trong hội thoại; chỉ khi học viên bấm mới gọi grant', () => {
  let n = 0; const r = render(<ConsentBubble consent={view('none')} busy={false} error={null} onGrant={() => { n++ }} />)
  assert.equal(n, 0); fireEvent.click(r.getByTestId('mira-consent-inline-grant')); assert.equal(n, 1)
})
test('V3.1: đã đồng ý / thông báo chưa có hiệu lực / lỗi tải ⇒ không hiện đề nghị', () => {
  for (const v of [view('granted'), view('unavailable'), { status: 'error' } as never, { status: 'loading' } as never]) {
    const r = render(<ConsentBubble consent={v} busy={false} error={null} onGrant={() => {}} />); assert.ok(!r.queryByTestId('mira-consent-bubble')); cleanup()
  }
})

// V3.2: lời chào trước đồng ý — chỉ tên + chấm báo do server; không gọi mô hình / không gửi gì đi
test('V3.2: mục Mira trong Hộp thư chào đúng tên và có chấm báo khi chưa mở', async () => {
  inv = null
  const prev = (globalThis as { __t?: unknown }).__t
  void prev
  setMiraTransport({
    rpc: async (fn, args) => { calls.push({ fn, args }); if (fn === 'mira_welcome_get') return { data: { first_name: 'Hoa', unread: true }, error: null }; if (fn === 'mira_student_pilot_enabled') return { data: true, error: null }; return { data: null, error: null } },
    invoke: async () => { throw new Error('không được gọi mô hình trước đồng ý') },
  })
  const r = render(<MiraListItem active={false} onSelect={() => {}} />)
  await waitFor(() => assert.match(r.getByTestId('mira-list-preview').textContent ?? '', /Chào Hoa, mình là Mira/))
  assert.ok(r.getByTestId('mira-list-dot'))
  assert.ok(calls.every(c => ['mira_invitation_pending', 'mira_welcome_get'].includes(c.fn)), JSON.stringify(calls.map(c => c.fn)))
})
