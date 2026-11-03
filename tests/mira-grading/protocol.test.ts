import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptChildMessage, miraOriginOf } from '../../src/mira-grading/protocol'
import { createMiraGradingApi, type RpcFn } from '../../src/mira-grading/api'
import { miraGradingConfig } from '../../src/mira-grading/config'

const ID = '11111111-1111-4111-8111-111111111111'
test('origin Mira: chỉ https (hoặc http localhost); URL lạ → null', () => {
  assert.equal(miraOriginOf('https://mira-vananhaudio.netlify.app/grading'), 'https://mira-vananhaudio.netlify.app')
  assert.equal(miraOriginOf('http://localhost:3000/grading'), 'http://localhost:3000')
  assert.equal(miraOriginOf('http://mira.localhost:3000/grading'), 'http://mira.localhost:3000')
  assert.equal(miraOriginOf('http://localhost.evil.com/grading'), null)
  assert.equal(miraOriginOf('http://evil.example/grading'), null)
  assert.equal(miraOriginOf('javascript:alert(1)'), null)
  assert.equal(miraOriginOf(undefined), null)
})
test('tin từ iframe: đúng cửa sổ con + đúng origin + đúng hình dạng; còn lại bị bỏ', () => {
  const child = {}; const ctx = { child, origin: 'https://m.example' }
  const ok = { origin: 'https://m.example', source: child, data: { v: 1, type: 'mira-grading-ready' } }
  assert.deepEqual(acceptChildMessage(ok, ctx), { v: 1, type: 'mira-grading-ready' })
  assert.equal(acceptChildMessage({ ...ok, source: {} }, ctx), null)
  assert.equal(acceptChildMessage({ ...ok, origin: 'https://evil.example' }, ctx), null)
  assert.equal(acceptChildMessage({ ...ok, data: { v: 2, type: 'mira-grading-ready' } }, ctx), null)
  assert.equal(acceptChildMessage({ ...ok, data: { v: 1, type: 'mira-grading-need-ticket', id: 'x' } }, ctx), null)
  assert.deepEqual(acceptChildMessage({ ...ok, data: { v: 1, type: 'mira-grading-need-ticket', id: ID } }, ctx), { v: 1, type: 'mira-grading-need-ticket', id: ID })
  assert.equal(acceptChildMessage(ok, { child: null, origin: 'https://m.example' }), null)
})
test('cấu hình: mặc định TẮT; tắt trong app native; bật khi có URL an toàn', () => {
  assert.equal(miraGradingConfig({ url: undefined, isNative: false }), null)
  assert.equal(miraGradingConfig({ url: 'https://m.example/grading', isNative: true }), null)
  assert.equal(miraGradingConfig({ url: 'http://evil.example/grading', isNative: false }), null)
  assert.deepEqual(miraGradingConfig({ url: 'https://m.example/grading', isNative: false }), { url: 'https://m.example/grading', origin: 'https://m.example' })
})
test('API: gọi đúng RPC với đúng tham số; chưa có migration → unavailable; vé hỏng bị loại', async () => {
  const calls: [string, Record<string, unknown>][] = []
  const mk = (r: { data?: unknown; error?: { message?: string; code?: string } | null }) => createMiraGradingApi((async (n, a) => { calls.push([n, a]); return { data: r.data ?? null, error: r.error ?? null } }) as RpcFn)
  const good = 'a'.repeat(64)
  assert.deepEqual(await mk({ data: { ticket: good, expires_at: 'T' } }).ticket(ID), { ok: true, value: { ticket: good, expiresAt: 'T' } })
  await mk({}).end(ID)
  assert.deepEqual(calls, [['mira_grading_ticket', { p_thread: ID }], ['mira_grading_end', { p_thread: ID }]])
  assert.deepEqual(await mk({ error: { code: 'PGRST202', message: 'Could not find the function' } }).ticket(ID), { ok: false, reason: 'unavailable' })
  assert.deepEqual(await mk({ error: { code: '42501', message: 'forbidden' } }).ticket(ID), { ok: false, reason: 'forbidden' })
  assert.deepEqual(await mk({ error: { code: '54000', message: 'rate_limited' } }).ticket(ID), { ok: false, reason: 'rate_limited' })
  assert.deepEqual(await mk({ data: { ticket: 'eyJhbGciOi.JWT.token', expires_at: 'T' } }).ticket(ID), { ok: false, reason: 'error' })
  // pilot_enabled: chỉ true khi RPC trả đúng true; thiếu hàm / lỗi / trả khác → false (ẩn)
  assert.equal(await mk({ data: true }).pilotEnabled(), true)
  assert.equal(await mk({ data: false }).pilotEnabled(), false)
  assert.equal(await mk({ data: 'true' }).pilotEnabled(), false)
  assert.equal(await mk({ data: null }).pilotEnabled(), false)
  assert.equal(await mk({ error: { code: 'PGRST202', message: 'Could not find the function' } }).pilotEnabled(), false)
  assert.equal(await mk({ error: { code: '42501', message: 'permission denied' } }).pilotEnabled(), false)
  assert.deepEqual(calls.slice(-1)[0], ['mira_grading_pilot_enabled', {}])
  const boom = createMiraGradingApi((async () => { throw new Error('mạng') }) as RpcFn)
  assert.deepEqual(await boom.ticket(ID), { ok: false, reason: 'error' }); await boom.end(ID); assert.equal(await boom.pilotEnabled(), false) // không ném
})

test('nháp từ iframe: chỉ nhận khi đúng cửa sổ + origin + mã bài + chữ 1–4000; chữ được cắt khoảng trắng đầu/cuối', async () => {
  const { MAX_DRAFT_CHARS } = await import('../../src/mira-grading/protocol')
  const { MAX_EVENT_BODY } = await import('../../src/learning-thread/ltModel')
  assert.equal(MAX_DRAFT_CHARS, MAX_EVENT_BODY)   // giữ hai giới hạn khớp nhau
  const child = {}; const ctx = { child, origin: 'https://m.example' }
  const mk = (data: unknown, extra: object = {}) => ({ origin: 'https://m.example', source: child, data, ...extra })
  const d = (over: object = {}) => ({ v: 1, type: 'mira-grading-draft', id: ID, rid: 'rid-12345678', text: '  Nháp nhận xét  ', ...over })
  assert.deepEqual(acceptChildMessage(mk(d()), ctx), { v: 1, type: 'mira-grading-draft', id: ID, rid: 'rid-12345678', text: 'Nháp nhận xét' })
  assert.equal(acceptChildMessage(mk(d(), { origin: 'https://evil.example' }), ctx), null)       // sai origin
  assert.equal(acceptChildMessage(mk(d(), { source: {} }), ctx), null)                            // sai cửa sổ
  assert.equal(acceptChildMessage(mk(d({ id: 'x' })), ctx), null)                                 // mã bài hỏng
  assert.equal(acceptChildMessage(mk(d({ text: '' })), ctx), null)                                // rỗng
  assert.equal(acceptChildMessage(mk(d({ text: ' \n\t ' })), ctx), null)                          // chỉ khoảng trắng
  assert.equal(acceptChildMessage(mk(d({ text: 123 })), ctx), null)                               // không phải chuỗi
  assert.equal(acceptChildMessage(mk(d({ text: 'a'.repeat(4000) })), ctx)?.type, 'mira-grading-draft')   // đúng 4000: nhận
  assert.equal(acceptChildMessage(mk(d({ text: 'a'.repeat(4001) })), ctx), null)                  // vượt: bỏ, không cắt ngầm
  assert.equal(acceptChildMessage(mk(d({ rid: 'x' })), ctx), null)                                // thiếu/hỏng mã yêu cầu
  assert.equal(acceptChildMessage(mk(d({ rid: undefined })), ctx), null)
  assert.equal(acceptChildMessage(mk(d({ v: 2 })), ctx), null)
  // tin nháp không mang quyền nào khác: chỉ có đúng 5 trường
  assert.deepEqual(Object.keys(acceptChildMessage(mk(d({ verdict: 'pass', send: true })), ctx)!).sort(), ['id', 'rid', 'text', 'type', 'v'])
})
