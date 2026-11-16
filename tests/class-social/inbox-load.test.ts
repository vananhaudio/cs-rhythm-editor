import test from 'node:test'
import assert from 'node:assert/strict'
import { loadInboxHead } from '../../src/class-social/chat/inboxLoad'
import type { InboxSource } from '../../src/class-social/chat/inboxApi'
import { DEFAULT_FILTER } from '../../src/class-social/chat/inboxModel'

const item = (id: string) => ({ id } as never)
const delay = <T,>(ms: number, v: T) => new Promise<T>(r => setTimeout(() => r(v), ms))
type Cfg = { main?: () => Promise<unknown>; pinned?: () => Promise<unknown>; sum?: () => Promise<unknown> }
function src(c: Cfg, calls: string[] = []): InboxSource {
  return {
    mode: () => 'server',
    page: (a: { pinned: string }) => { calls.push('page:' + a.pinned); return (a.pinned === 'only' ? c.pinned : c.main)!() },
    summary: () => { calls.push('summary'); return c.sum!() },
  } as unknown as InboxSource
}
const ok = <T,>(value: T) => ({ ok: true as const, value })
function run(s: InboxSource, searching = false, alive = () => true) {
  const log: string[] = []
  const p = loadInboxHead({
    source: s, scope: 'mine', filter: DEFAULT_FILTER, searching, pageSize: 30, alive,
    on: {
      onMain: pg => log.push('main:' + pg.items.map((x: { id: string }) => x.id).join(',')),
      onMainError: m => log.push('mainErr:' + m),
      onPinned: it => log.push('pinned:' + it.map((x: { id: string }) => x.id).join(',')),
      onSummary: () => log.push('summary'),
    },
  })
  return { p, log }
}

test('chính nhanh, ghim + summary chậm: danh sách chính báo trước, không chờ', async () => {
  const { p, log } = run(src({ main: () => delay(5, ok({ items: [item('a')], hasMore: false })), pinned: () => delay(60, ok({ items: [item('p')], hasMore: false })), sum: () => delay(80, ok({})) }))
  await delay(30, 0)
  assert.deepEqual(log, ['main:a'])
  assert.equal(await p, true)
  assert.deepEqual(log, ['main:a', 'pinned:p', 'summary'])
})
test('ghim/summary lỗi hoặc ném: không báo, trang chính vẫn thành công', async () => {
  const { p, log } = run(src({ main: async () => ok({ items: [item('a')], hasMore: true }), pinned: async () => ({ ok: false, message: 'x' }), sum: async () => { throw new Error('timeout') } }))
  assert.equal(await p, true)
  assert.deepEqual(log, ['main:a'])
})
test('chính lỗi: báo lỗi, ghim/summary vẫn cập nhật độc lập, trả false', async () => {
  const { p, log } = run(src({ main: async () => ({ ok: false, message: 'boom' }), pinned: async () => ok({ items: [item('p')], hasMore: false }), sum: async () => ok({}) }))
  assert.equal(await p, false)
  assert.ok(log.includes('mainErr:boom') && log.includes('pinned:p') && log.includes('summary'))
})
test('chính ném ngoại lệ → mainErr, không treo', async () => {
  const { p, log } = run(src({ main: async () => { throw new Error('net') }, pinned: async () => ok({ items: [], hasMore: false }), sum: async () => ok({}) }))
  assert.equal(await p, false)
  assert.ok(log.some(l => l.startsWith('mainErr:')))
})
test('tìm kiếm: chỉ 1 request (pinned any), xoá mục ghim, không gọi summary-ghim thừa', async () => {
  const calls: string[] = []
  const { p, log } = run(src({ main: async () => ok({ items: [item('a')], hasMore: false }), sum: async () => ok({}) }, calls), true)
  await p
  assert.deepEqual(calls.filter(c => c.startsWith('page')), ['page:any'])
  assert.deepEqual(log.filter(l => l.startsWith('pinned')), ['pinned:'])
})
test('không trùng request: mỗi lượt đúng 3 lời gọi (exclude, only, summary)', async () => {
  const calls: string[] = []
  const { p } = run(src({ main: async () => ok({ items: [], hasMore: false }), pinned: async () => ok({ items: [], hasMore: false }), sum: async () => ok({}) }, calls))
  await p
  assert.deepEqual([...calls].sort(), ['page:exclude', 'page:only', 'summary'])
})
test('đổi bộ lọc/rời trang (alive=false) giữa chừng: không báo kết quả cũ', async () => {
  let live = true
  const { p, log } = run(src({ main: () => delay(10, ok({ items: [item('a')], hasMore: false })), pinned: () => delay(10, ok({ items: [item('p')], hasMore: false })), sum: () => delay(10, ok({})) }), false, () => live)
  live = false
  await p
  assert.deepEqual(log, [])
})
