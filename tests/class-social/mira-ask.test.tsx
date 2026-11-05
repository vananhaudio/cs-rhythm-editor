/**
 * "Hỏi Mira" (giao diện): route, mục ghim, phiên chỉ trong RAM, gửi/nhận, lỗi/hạn mức, nút mở lớp, lịch sử gửi kèm dấu vân tay,
 * và các rào chắn nguồn (không lưu trình duyệt, không bảng/service role, cờ build mặc định TẮT). Server: scripts/test-mira-student-ask-db.sh.
 */
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// @ts-expect-error jsdom không có kiểu
import { JSDOM } from 'jsdom'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://localhost' })
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window }, document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator }, IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
})
dom.window.HTMLElement.prototype.scrollIntoView = () => {}
// react-dom / RTL phải nạp SAU khi có window (canUseDOM tính lúc nạp module)
const { render, act, cleanup, fireEvent, waitFor } = await import('@testing-library/react')
const { default: MiraChatView } = await import('../../src/class-social/chat/MiraChatView')
const { default: MiraListItem } = await import('../../src/class-social/chat/MiraListItem')
const { default: ConversationList } = await import('../../src/class-social/chat/ConversationList')
const { buildEnabled, askMira, setMiraTransport, previewBuild, miraPreviewVisible } = await import('../../src/class-social/chat/miraApi')
const { default: MiraPreparingView } = await import('../../src/class-social/chat/MiraPreparingView')
const { chatConversationPath, viewFromPath } = await import('../../src/class-social/resolveMeRoute')
void React

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')
const code = (f: string) => read(f).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
const CLASS = 'b1000000-0000-4000-8000-000000000001'
type Call = { name: string; body: { message: string; history: Array<{ role: string; text: string }>; history_fp: string } }
let calls: Call[] = []
let queue: Array<{ data?: unknown; error?: unknown }> = []
// Đồng ý (V1.1): trạng thái do "server" giả quyết. Mặc định ĐÃ đồng ý (để các test chat cũ chạy như trước).
const NOTICE = { version: 7, title: 'Thử nghiệm trợ lý học tập Mira (trí tuệ nhân tạo)', scope: ['profile', 'learning_state'],
  body: 'Mira là TRỢ LÝ AI, không phải người thật.\n\nNội dung được gửi tới nhà cung cấp AI để tạo câu trả lời.' }
let consentState = 'granted'
type Rpc = { fn: string; args?: Record<string, unknown> }
let rpcCalls: Rpc[] = []
let rpcFail = false
const statusJson = () => ({ feature: 'mira_student', pilot: true, state: consentState, notice: consentState === 'unavailable' ? null : NOTICE })
const baseTransport: Parameters<typeof setMiraTransport>[0] = {
  rpc: async (fn: string, args?: Record<string, unknown>) => {
    rpcCalls.push({ fn, args: args ? JSON.parse(JSON.stringify(args)) : undefined })
    if (rpcFail && fn.startsWith('ai_consent')) return { data: null, error: new Error('mạng') }
    if (fn === 'ai_consent_status') return { data: statusJson(), error: null }
    if (fn === 'ai_consent_grant') { consentState = args?.p_version === NOTICE.version ? 'granted' : consentState; return { data: statusJson(), error: null } }
    if (fn === 'ai_consent_withdraw') { consentState = 'withdrawn'; return { data: { feature: 'mira_student', state: 'withdrawn' }, error: null } }
    return { data: true, error: null }
  },
  invoke: async (name, body): Promise<{ data: unknown; error: unknown }> => {
    calls.push({ name, body: JSON.parse(JSON.stringify(body)) })
    const r = queue.shift(); return { data: r?.data ?? null, error: r ? (r.error ?? null) : new Error('hết kịch bản') }
  },
}
setMiraTransport(baseTransport)
afterEach(() => { cleanup(); calls = []; queue = []; rpcCalls = []; consentState = 'granted'; rpcFail = false; setMiraTransport(baseTransport) })

const ok = (reply: string, extra: Record<string, unknown> = {}) => ({ data: { status: 'ok', reply, actions: [], ctx_fp: 'fp1', ...extra }, error: null })
async function say(ui: ReturnType<typeof render>, text: string) {
  const ta = await ui.findByLabelText('Tin nhắn gửi Mira') as HTMLTextAreaElement   // chờ màn đồng ý (server) xong
  await act(async () => { fireEvent.change(ta, { target: { value: text } }) })
  await act(async () => { fireEvent.submit(ta.closest('form')!) })
}

// ── Chế độ xem trước cho admin (production: Mira "đang chuẩn bị hoạt động", KHÔNG có AI) ──
test('xem trước: chỉ hiện khi cờ build PREVIEW bật VÀ là admin; mặc định TẮT; giá trị lạ → ẩn', () => {
  assert.equal(previewBuild(), false, 'cờ build mặc định TẮT')
  for (const [build, admin, want] of [[true, true, true], [true, false, false], [true, undefined, false], [false, true, false], [false, false, false], [false, undefined, false]] as const)
    assert.equal(miraPreviewVisible(build, admin), want, `build=${build} admin=${admin}`)
  assert.equal(miraPreviewVisible(true, 'true' as unknown as boolean), false, 'chỉ đúng boolean true')
  assert.equal(miraPreviewVisible(1 as unknown as boolean, true), false)
})
test('xem trước: màn "đang chuẩn bị" có lời chào + trạng thái, KHÔNG ô soạn, KHÔNG gọi mạng/RPC', async () => {
  const ui = render(<MiraPreparingView onBack={() => {}} />)
  await act(async () => { await new Promise(r => setTimeout(r, 30)) })
  const t = ui.container.textContent ?? ''
  assert.match(t, /Chào bạn, mình là Mira!/); assert.match(t, /Trợ lý AI của Thầy Văn Anh/); assert.match(t, /Mira đang chuẩn bị hoạt động/)
  assert.ok(ui.getByTestId('mira-preparing'))
  assert.equal(ui.container.querySelectorAll('textarea,input,form').length, 0, 'không có ô nhập/biểu mẫu')
  assert.equal(calls.length, 0); assert.equal(rpcCalls.length, 0, 'không gọi function/RPC nào')
  assert.ok(ui.container.querySelector('.cs-mira-avatar'), 'avatar chữ M')
})
test('xem trước: rào chắn nguồn — màn chuẩn bị không có đường gửi; Chat dùng cổng admin + cờ build; phiên đọc role admin từ app_users', () => {
  const prep = code('src/class-social/chat/MiraPreparingView.tsx')
  assert.ok(!/askMira|useMiraChat|useMiraConsent|supabase|fetch\(|\.rpc\(|\.invoke\(|miraApi'.*transport/.test(prep), 'MiraPreparingView không có đường gọi mạng')
  const chat = code('src/class-social/sections/Chat.tsx')
  assert.ok(/miraPreviewVisible\(previewBuild\(\), isAdmin\)/.test(chat) && /!miraOn && miraPreview/.test(chat), 'cổng hiển thị = cờ build + admin; chế độ thật thắng')
  assert.ok(/const isAdmin = appUser\?\.role === 'admin'/.test(code('src/class-social/useClassSession.ts')), 'admin lấy từ app_users.role')
  assert.ok(/isAdmin=\{me\.isAdmin\}/.test(code('src/class-social/ClassSocialPage.tsx')))
})
test('Owner V1.2: build có PREVIEW → chỉ admin mới hỏi server pilot (người khác không gọi RPC); cờ ENABLED chỉ ở production', () => {
  const chat = readFileSync('src/class-social/sections/Chat.tsx', 'utf8'), api = readFileSync('src/class-social/chat/miraApi.ts', 'utf8'), toml = readFileSync('netlify.toml', 'utf8')
  assert.match(chat, /useMiraEnabled\(!previewBuild\(\) \|\| isAdmin === true\)/)
  assert.match(api, /if \(!buildEnabled\(\) \|\| !allow\) return/)
  const prod = toml.split('[context.production.environment]')[1] ?? ''
  assert.match(prod, /VITE_MIRA_STUDENT_ENABLED = "1"/)
  assert.match(prod, /VITE_MIRA_STUDENT_PREVIEW = "1"/)
  assert.ok(!(toml.split('[context.production.environment]')[0]).includes('VITE_MIRA_STUDENT_ENABLED'), 'không bật ở deploy-preview/branch')
})
test('route: /me/chat/mira ↔ id "mira"; id lạ vẫn bị từ chối', () => {
  assert.equal(chatConversationPath('mira'), '/me/chat/mira')
  assert.deepEqual(viewFromPath('/me/chat/mira'), { kind: 'chatConversation', conversationId: 'mira' })
  assert.notEqual((viewFromPath('/me/chat/khong-phai-uuid') as { kind: string }).kind, 'chatConversation')
})
test('cờ build mặc định TẮT: buildEnabled() = false (không gọi mạng, không hiện mục)', () => { assert.equal(buildEnabled(), false) })
test('danh sách: có `top` thì Mira ghim đầu; không có thì DOM y như cũ', () => {
  const state = { status: 'ready', items: [] } as never
  const withTop = renderToStaticMarkup(<ConversationList state={state} selectedId={null} onSelect={() => {}} onRetry={() => {}} onOpenFriends={() => {}} top={<MiraListItem active={false} onSelect={() => {}} />} />)
  const without = renderToStaticMarkup(<ConversationList state={state} selectedId={null} onSelect={() => {}} onRetry={() => {}} onOpenFriends={() => {}} />)
  assert.ok(withTop.includes('Mira') && withTop.indexOf('Mira') < withTop.indexOf('Chưa có cuộc trò chuyện'))
  assert.ok(!without.includes('Mira'))
})
test('avatar Mira: chữ M, 48 ở danh sách / 40 ở đầu hội thoại; avatar người khác KHÔNG đổi', async () => {
  const { default: ChatHeader } = await import('../../src/class-social/chat/ChatHeader')
  const { default: MiraAvatar } = await import('../../src/class-social/chat/MiraAvatar')
  const item = renderToStaticMarkup(<MiraListItem active={false} onSelect={() => {}} />)
  assert.ok(/class="cs-avatar cs-mira-avatar"[^>]*width:48px;height:48px/.test(item) && item.includes('>M</span>'), 'danh sách: M 48×48')
  const mira = renderToStaticMarkup(<ChatHeader name="Mira" avatarUrl={null} avatar={<MiraAvatar size={40} />} onBack={() => {}} />)
  assert.ok(/cs-mira-avatar[^>]*width:40px;height:40px/.test(mira), 'đầu hội thoại: M 40×40')
  const other = renderToStaticMarkup(<ChatHeader name="Bình" avatarUrl={null} onBack={() => {}} />)
  assert.ok(!other.includes('cs-mira-avatar') && /class="cs-avatar"[^>]*width:40px;height:40px/.test(other), 'avatar thường giữ nguyên')
  const css = readFileSync('src/class-social/classSocial.css', 'utf8')
  assert.ok(/\.cs-mira-avatar\s*\{[^}]*background:\s*#4338CA[^}]*color:\s*#fff[^}]*font-weight:\s*800/i.test(css), 'CSS đúng thông số ClassLandingPage')
})
test('mở màn (V1.3): lời chào NGẮN + ô soạn ngay; thông tin AI gọn (đóng sẵn) có đủ: là AI, có thể sai, không chấm bài, gửi tới Anthropic, không lưu; chưa gọi Mira', async () => {
  consentState = 'unavailable'
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  assert.ok(ui.getByLabelText('Tin nhắn gửi Mira'), 'ô soạn có ngay, không chờ server')
  const ps = [...ui.getByRole('log').querySelectorAll('.cs-msg-bubble p')]
  assert.equal(ps.length, 2, 'lời chào 2 đoạn'); assert.match(ps[0].textContent ?? '', /Chào bạn, mình là Mira!/); assert.equal((ps[0] as HTMLElement).style.fontWeight, '700')
  assert.match(ps[1].textContent ?? '', /Trợ lý AI của Thầy Văn Anh/)
  const info = ui.getByTestId('mira-info') as HTMLDetailsElement
  assert.equal(info.open, false, 'thông tin AI đóng sẵn — không lấn nội dung')
  for (const re of [/Mira là AI, có thể sai/, /không phải người thật/, /không thay Thầy chấm bài/, /Anthropic/, /không lưu cuộc trò chuyện/]) assert.match(info.textContent ?? '', re)
  await waitFor(() => assert.ok(rpcCalls.some(c => c.fn === 'ai_consent_status')))
  assert.equal(ui.queryByTestId('mira-data'), null, 'server chưa có nội dung đồng ý → không mời chia sẻ dữ liệu')
  assert.equal(calls.length, 0)
})
test('gửi → gọi mira-student-chat với message + history rỗng; hiện câu trả lời; KHÔNG gửi user_id/role', async () => {
  queue.push(ok('Hôm nay tập âm giai C chậm nhé.'))
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  await say(ui, 'Em nên luyện gì hôm nay?')
  assert.equal(calls.length, 1); assert.equal(calls[0].name, 'mira-student-chat')
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['history', 'history_fp', 'message']); assert.deepEqual(calls[0].body.history, [])
  await waitFor(() => assert.ok(ui.getByText('Hôm nay tập âm giai C chậm nhé.')))
  assert.ok(ui.getByText('Em nên luyện gì hôm nay?'))
})
test('lượt 2 gửi kèm lịch sử lượt 1 + ctx_fp; tối đa 6 lượt', async () => {
  for (let i = 0; i < 5; i++) queue.push(ok(`đáp ${i}`, { ctx_fp: `fp${i}` }))
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  for (let i = 0; i < 5; i++) await say(ui, `hỏi ${i}`)
  assert.deepEqual(calls[1].body.history, [{ role: 'user', text: 'hỏi 0' }, { role: 'assistant', text: 'đáp 0' }]); assert.equal(calls[1].body.history_fp, 'fp0')
  assert.equal(calls[4].body.history.length, 6); assert.equal(calls[4].body.history_fp, 'fp3')
})
test('nút hành động "Mở lớp" → onOpenClass(id lớp); đường dẫn lạ bị bỏ', async () => {
  queue.push(ok('Mở lớp nhé', { actions: [{ label: 'Mở lớp Solo', path: `/me/classes/${CLASS}` }, { label: 'XAU', path: 'https://evil.example' }, { label: 'XAU2', path: '/admin' }] }))
  let opened = ''
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={id => { opened = id }} />)
  await say(ui, 'mở bài giúp em')
  await waitFor(() => assert.ok(ui.getByText('Mở lớp Solo')))
  assert.equal(ui.queryByText('XAU'), null); assert.equal(ui.queryByText('XAU2'), null)
  await act(async () => { fireEvent.click(ui.getByText('Mở lớp Solo')) }); assert.equal(opened, CLASS)
})
test('lỗi: hạn mức → thông báo thân thiện; mạng → thông báo; lỗi KHÔNG vào lịch sử gửi lượt sau', async () => {
  queue.push({ data: null, error: Object.assign(new Error('x'), { context: new Response(JSON.stringify({ status: 'rate_limit', reply: 'Bạn nghỉ một lát nhé.' }), { status: 429 }) }) })
  queue.push({ data: null, error: new Error('Failed to fetch') })
  queue.push(ok('xong'))
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  await say(ui, 'một'); await waitFor(() => assert.ok(ui.getByText('Bạn nghỉ một lát nhé.')))
  await say(ui, 'hai'); await waitFor(() => assert.ok(ui.getByText(/Chưa kết nối được/)))
  await say(ui, 'ba'); await waitFor(() => assert.ok(ui.getByText('xong')))
  assert.deepEqual(calls[2].body.history, [], 'lượt lỗi không đi vào lịch sử')
})
test('tin quá 1200 ký tự bị chặn ở máy khách, không gọi mạng', async () => {
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  await say(ui, 'a'.repeat(1300)); assert.equal(calls.length, 0); assert.ok(ui.getByText(/tối đa 1200 ký tự/))
})
test('Xoá khỏi màn hình: xoá tin + lịch sử + dấu vân tay; lượt sau gửi history rỗng', async () => {
  queue.push(ok('a', { ctx_fp: 'fpX' })); queue.push(ok('b'))
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  await say(ui, 'một'); await waitFor(() => ui.getByText('a'))
  await act(async () => { fireEvent.click(ui.getByLabelText(/Xoá cuộc trò chuyện này khỏi màn hình/)) })
  assert.equal(ui.queryByText('một'), null); await say(ui, 'hai')
  assert.deepEqual(calls[1].body.history, []); assert.equal(calls[1].body.history_fp, '')
})
test('askMira: thân phản hồi lạ / thiếu status → network (không bịa)', async () => {
  queue.push({ data: { hello: 1 }, error: null }); assert.equal((await askMira({ message: 'x', history: [], historyFp: '' })).status, 'network')
  queue.push({ data: null, error: null }); assert.equal((await askMira({ message: 'x', history: [], historyFp: '' })).status, 'network')
})
test('rào chắn nguồn: không lưu trình duyệt, không đọc bảng, không service role, chỉ gọi 1 function + 1 RPC cờ', () => {
  for (const f of ['src/class-social/chat/miraApi.ts', 'src/class-social/chat/useMiraChat.ts', 'src/class-social/chat/MiraChatView.tsx', 'src/class-social/chat/MiraListItem.tsx']) {
    const s = code(f)
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(s), `${f}: không lưu trình duyệt`)
    assert.ok(!/service_role|SERVICE_ROLE|\.from\(/.test(s), `${f}: không bảng/service role`)
  }
  const api = code('src/class-social/chat/miraApi.ts')
  assert.deepEqual([...api.matchAll(/transport\.rpc\('([a-z_]+)'/g)].map(m => m[1]), ['mira_student_pilot_enabled', 'ai_consent_status', 'ai_consent_grant', 'ai_consent_withdraw'])
  assert.ok(!/p_user|user_id|subject|learner/i.test(api), 'client không gửi danh tính trong RPC đồng ý (server lấy từ JWT)')
  assert.deepEqual([...api.matchAll(/transport\.invoke\('([a-z-]+)'/g)].map(m => m[1]), ['mira-student-chat'])
})
test('Chat.tsx: Mira không đi vào ConversationView/dm_* (id "mira" không bao giờ gọi dm_messages)', () => {
  const s = code('src/class-social/sections/Chat.tsx')
  assert.ok(/selection\.kind === 'conversation' && !isMira/.test(s)); assert.ok(/isMira && miraOn/.test(s))
})

// ── V1.3: không cổng đồng ý; chia sẻ dữ liệu học tập là LỰA CHỌN trong thông tin AI ──
const textOf = (ui: ReturnType<typeof render>) => ui.container.textContent ?? ''
test('chưa đồng ý (none): VẪN trò chuyện được (phổ thông); lời mời chia sẻ dữ liệu nằm trong thông tin AI với nội dung/phiên bản từ server', async () => {
  consentState = 'none'; queue.push(ok('Hợp âm Am gồm La, Đô, Mi.'))
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  await waitFor(() => assert.ok(ui.getByTestId('mira-data')))
  assert.ok(textOf(ui).includes(NOTICE.title) && textOf(ui).includes('TRỢ LÝ AI'))
  await say(ui, 'Hợp âm Am gồm những nốt nào?')
  await waitFor(() => assert.ok(ui.getByText('Hợp âm Am gồm La, Đô, Mi.')))
  assert.equal(rpcCalls.filter(c => c.fn === 'ai_consent_grant').length, 0, 'không tự ghi đồng ý')
})
test('chọn "Cho Mira dùng hồ sơ học tập": gửi ĐÚNG phiên bản server trả (7), không kèm danh tính; không tự gọi Mira', async () => {
  consentState = 'none'
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  const btn = await ui.findByTestId('mira-consent-grant')
  await act(async () => { fireEvent.click(btn) })
  await waitFor(() => assert.ok(ui.getByTestId('mira-withdraw')))
  const g = rpcCalls.filter(c => c.fn === 'ai_consent_grant')
  assert.equal(g.length, 1); assert.deepEqual(g[0].args, { p_feature: 'mira_student', p_version: 7 }); assert.equal(calls.length, 0)
  assert.match(textOf(ui), /đang dùng hồ sơ học tập/)
})
test('đã rút lại / phiên bản cũ: lời nhắn riêng trong thông tin AI; ô soạn vẫn có', async () => {
  for (const [st, re] of [['withdrawn', /ngừng chia sẻ trước đó/], ['outdated', /đã được cập nhật/]] as const) {
    consentState = st
    const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
    await waitFor(() => assert.ok(re.test(textOf(ui)), st)); assert.ok(ui.getByLabelText('Tin nhắn gửi Mira'))
    cleanup()
  }
})
test('lỗi mạng / dữ liệu lạ khi hỏi trạng thái: KHÔNG coi là đã đồng ý — không mời/không báo đang dùng hồ sơ; trò chuyện phổ thông vẫn được', async () => {
  rpcFail = true
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  await waitFor(() => assert.ok(rpcCalls.some(c => c.fn === 'ai_consent_status')))
  assert.equal(ui.queryByTestId('mira-data'), null); assert.ok(!/đang dùng hồ sơ học tập/.test(textOf(ui))); assert.ok(ui.getByLabelText('Tin nhắn gửi Mira'))
  cleanup()
  setMiraTransport({ rpc: async () => ({ data: true, error: null }), invoke: async () => ({ data: null, error: null }) })
  const ui2 = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  await new Promise(r => setTimeout(r, 20))
  assert.equal(ui2.queryByTestId('mira-data'), null); assert.ok(!/đang dùng hồ sơ học tập/.test(textOf(ui2)))
})
test('ngừng chia sẻ: có xác nhận; server xác nhận → quay về lời mời; trò chuyện vẫn tiếp tục', async () => {
  queue.push(ok('Trả lời trước.'))
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  await say(ui, 'Em cần gợi ý'); await waitFor(() => assert.ok(ui.getByText('Trả lời trước.')))
  await act(async () => { fireEvent.click(await ui.findByTestId('mira-withdraw')) })
  assert.ok(ui.getByTestId('mira-withdraw-confirm')); assert.equal(rpcCalls.filter(c => c.fn === 'ai_consent_withdraw').length, 0)
  await act(async () => { fireEvent.click(ui.getByTestId('mira-withdraw-yes')) })
  await waitFor(() => assert.ok(ui.getByTestId('mira-consent-grant')))
  assert.equal(rpcCalls.filter(c => c.fn === 'ai_consent_withdraw').length, 1); assert.ok(ui.getByLabelText('Tin nhắn gửi Mira'))
})
test('server báo consent_required (rút ở thiết bị khác): báo nhẹ + làm mới trạng thái; ô soạn vẫn có', async () => {
  queue.push({ data: { status: 'consent_required', reply: '', actions: [], ctx_fp: '' }, error: null })
  const ui = render(<MiraChatView onBack={() => {}} onOpenClass={() => {}} />)
  consentState = 'withdrawn'
  await say(ui, 'Em hỏi tiếp')
  await waitFor(() => assert.ok(/vẫn trả lời câu hỏi chung/.test(textOf(ui))))
  await waitFor(() => assert.ok(ui.getByTestId('mira-consent-grant'))); assert.ok(ui.getByLabelText('Tin nhắn gửi Mira'))
})
