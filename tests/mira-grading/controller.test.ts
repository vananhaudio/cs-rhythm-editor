import test from 'node:test'
import assert from 'node:assert/strict'
import { createDockController, NEED_COOLDOWN_MS, RENEW_MS, type DockStatus } from '../../src/mira-grading/controller'
import type { ClearMessage, ContextMessage } from '../../src/mira-grading/protocol'
import type { MiraGradingApi, TicketResult } from '../../src/mira-grading/api'

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const tk = (c: string) => 'abcdef0123456789'.repeat(4).replace(/./g, (_, i) => (i === 0 ? c : _)).slice(0, 64)

function rig() {
  const posts: (ContextMessage | ClearMessage)[] = []; const ended: string[] = []; const statuses: DockStatus[] = []
  const pending: { id: string; resolve: (r: TicketResult) => void }[] = []
  let n = 0; let t = 0
  const timers: { fn: () => void; ms: number; h: number }[] = []
  const api: MiraGradingApi = {
    ticket: (id) => new Promise((resolve) => pending.push({ id, resolve })),
    end: async (id) => { ended.push(id) },
    pilotEnabled: async () => true,
  }
  const ctl = createDockController({ api, post: (m) => posts.push(m), onStatus: (s) => statuses.push(s), now: () => t,
    setTimer: (fn, ms) => { const h = ++n; timers.push({ fn, ms, h }); return h }, clearTimer: (h) => { const i = timers.findIndex((x) => x.h === h); if (i >= 0) timers.splice(i, 1) } })
  const ok = (i: number, c = 'a') => pending[i].resolve({ ok: true, value: { ticket: tk(c), expiresAt: 'T' } })
  const flush = () => new Promise((r) => setImmediate(r))
  return { ctl, posts, ended, statuses, pending, timers, ok, flush, tick: (ms: number) => { t += ms } }
}

test('chưa có iframe sẵn sàng thì chưa cấp vé; khi sẵn sàng mới cấp và gửi đúng mã bài + vé', async () => {
  const r = rig(); r.ctl.setThread(A); await r.flush(); assert.equal(r.pending.length, 0)
  r.ctl.onChild({ v: 1, type: 'mira-grading-ready' }); await r.flush(); assert.equal(r.pending.length, 1); assert.equal(r.pending[0].id, A)
  r.ok(0); await r.flush()
  assert.equal(r.posts.length, 1); const m = r.posts[0] as ContextMessage
  assert.deepEqual([m.type, m.kind, m.id, m.seq], ['mira-context', 'learning_thread', A, 1])
  assert.equal(JSON.stringify(m).includes('access_token'), false); assert.deepEqual(Object.keys(m).sort(), ['expiresAt', 'id', 'kind', 'seq', 'ticket', 'type', 'v'])
})
test('chuyển bài khi vé bài cũ chưa về: vé cũ bị thu hồi và KHÔNG bao giờ gửi cho iframe', async () => {
  const r = rig(); r.ctl.onChild({ v: 1, type: 'mira-grading-ready' }); r.ctl.setThread(A); await r.flush()
  r.ctl.setThread(B); await r.flush(); assert.deepEqual(r.pending.map((p) => p.id), [A, B])
  r.ok(1, 'b'); await r.flush()          // vé của B về trước
  r.ok(0, 'a'); await r.flush()          // vé của A về muộn
  assert.deepEqual((r.posts as ContextMessage[]).map((m) => m.id), [B]); assert.equal(r.posts.length, 1)
  assert.ok(r.ended.includes(A), 'vé của bài A (về muộn) bị thu hồi')
})
test('đổi bài: thu hồi vé bài cũ; seq tăng dần; đóng khung thu hồi vé', async () => {
  const r = rig(); r.ctl.onChild({ v: 1, type: 'mira-grading-ready' }); r.ctl.setThread(A); await r.flush(); r.ok(0); await r.flush()
  r.ctl.setThread(B); await r.flush(); r.ok(1, 'b'); await r.flush()
  assert.deepEqual(r.posts.map((m) => m.seq), [1, 2]); assert.deepEqual(r.ended, [A])
  r.ctl.dispose(); assert.deepEqual(r.ended, [A, B])
})
test('gia hạn trước khi hết hạn; hết hạn/need-ticket cấp lại nhưng có cooldown chống vòng lặp', async () => {
  const r = rig(); r.ctl.onChild({ v: 1, type: 'mira-grading-ready' }); r.ctl.setThread(A); await r.flush(); r.ok(0); await r.flush()
  assert.equal(r.timers.length, 1); assert.equal(r.timers[0].ms, RENEW_MS); assert.ok(RENEW_MS < 5 * 60_000)
  r.timers[0].fn(); await r.flush(); assert.equal(r.pending.length, 2); r.ok(1); await r.flush()   // gia hạn
  r.ctl.onChild({ v: 1, type: 'mira-grading-need-ticket', id: A }); await r.flush(); assert.equal(r.pending.length, 2, 'trong cooldown: bỏ')
  r.tick(NEED_COOLDOWN_MS); r.ctl.onChild({ v: 1, type: 'mira-grading-need-ticket', id: A }); await r.flush(); assert.equal(r.pending.length, 3, 'sau cooldown: cấp lại')
  r.tick(NEED_COOLDOWN_MS); r.ctl.onChild({ v: 1, type: 'mira-grading-need-ticket', id: B }); await r.flush(); assert.equal(r.pending.length, 3, 'xin vé cho bài KHÁC bài đang mở: bỏ')
})
test('chưa bật/hỏng phía máy chủ: báo trạng thái, không ném, không gửi gì', async () => {
  const r = rig(); r.ctl.onChild({ v: 1, type: 'mira-grading-ready' }); r.ctl.setThread(A); await r.flush()
  r.pending[0].resolve({ ok: false, reason: 'unavailable' }); await r.flush()
  assert.equal(r.statuses.at(-1), 'unavailable'); assert.equal(r.posts.length, 0); assert.equal(r.timers.length, 0)
})
test('rời màn bài trả (setThread null): xoá ngữ cảnh ở iframe và thu hồi vé', async () => {
  const r = rig(); r.ctl.onChild({ v: 1, type: 'mira-grading-ready' }); r.ctl.setThread(A); await r.flush(); r.ok(0); await r.flush()
  r.ctl.setThread(null); assert.equal(r.posts.at(-1)?.type, 'mira-context-clear'); assert.deepEqual(r.ended, [A]); assert.equal(r.timers.length, 0)
})

test('server từ chối (forbidden) → trạng thái denied: không gửi gì cho iframe, không hẹn gia hạn, không thử lại vòng lặp', async () => {
  const r = rig(); r.ctl.onChild({ v: 1, type: 'mira-grading-ready' }); r.ctl.setThread(A); await r.flush()
  r.pending[0].resolve({ ok: false, reason: 'forbidden' }); await r.flush()
  assert.equal(r.statuses.at(-1), 'denied'); assert.equal(r.posts.length, 0); assert.equal(r.timers.length, 0)
})
