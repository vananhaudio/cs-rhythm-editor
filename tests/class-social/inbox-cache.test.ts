import test from 'node:test'
import assert from 'node:assert/strict'
import { getInboxCache, putInboxCache, clearInboxCache, cacheable } from '../../src/class-social/chat/inboxCache'
import { readFileSync } from 'node:fs'

const snap = (id: string) => ({ pinned: [], items: [{ id } as never], hasMore: false, summary: null })
const K = 'mine|all|false|'

test('cache theo người dùng: tài khoản khác không thấy dữ liệu của người trước', () => {
  clearInboxCache(); putInboxCache('u1', K, snap('a'))
  assert.equal(getInboxCache('u1', K)?.items.length, 1)
  assert.equal(getInboxCache('u2', K), null)
  assert.equal(getInboxCache(undefined, K), null)
})
test('không cache tìm kiếm / scope support / khi không có userId', () => {
  clearInboxCache()
  assert.equal(cacheable('u1', 'mine|all|false|abc'), false)
  assert.equal(cacheable('u1', 'support|all|false|'), false)
  assert.equal(cacheable(undefined, K), false)
  putInboxCache('u1', 'mine|all|false|abc', snap('x')); assert.equal(getInboxCache('u1', 'mine|all|false|abc'), null)
})
test('hết hạn sau 10 phút; đăng xuất xoá hết', () => {
  clearInboxCache(); const t = 1_000_000
  putInboxCache('u1', K, snap('a'), t)
  assert.ok(getInboxCache('u1', K, t + 9 * 60_000))
  assert.equal(getInboxCache('u1', K, t + 11 * 60_000), null)
  putInboxCache('u1', K, snap('a')); clearInboxCache(); assert.equal(getInboxCache('u1', K), null)
})
test('giới hạn số mục', () => {
  clearInboxCache()
  for (let i = 0; i < 20; i++) putInboxCache('u' + i, K, snap('a'))
  assert.equal(getInboxCache('u0', K), null); assert.ok(getInboxCache('u19', K))
})
test('nối dây: Chat truyền meId, đăng xuất xoá cache, hook khởi tạo từ cache và vẫn tải lại từ server', () => {
  const chat = readFileSync('src/class-social/sections/Chat.tsx', 'utf8')
  const hook = readFileSync('src/class-social/chat/useInbox.ts', 'utf8')
  const sess = readFileSync('src/class-social/useClassSession.ts', 'utf8')
  assert.match(chat, /useInbox\(source, \{ cacheUser: meId \}\)/)
  assert.match(sess, /SIGNED_OUT[\s\S]{0,120}clearSwr\(\)/)   // clearSwr cũng xoá đệm Chat (xem me-swr-cache.test)
  assert.match(hook, /getInboxCache\(opts\.cacheUser/)
  assert.match(hook, /startPolling\(tick/)
})
