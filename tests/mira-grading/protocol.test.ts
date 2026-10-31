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
  const boom = createMiraGradingApi((async () => { throw new Error('mạng') }) as RpcFn)
  assert.deepEqual(await boom.ticket(ID), { ok: false, reason: 'error' }); await boom.end(ID) // không ném
})
