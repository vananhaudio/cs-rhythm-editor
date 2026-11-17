/** Cache SWR chung cho /me: hiện ngay khi quay lại, làm mới ở nền, tách theo tài khoản, an toàn khi lỗi/đăng xuất/offline. */
import './composer-dom-setup'
import { test, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import React from 'react'
import { render, cleanup, act } from '@testing-library/react'
import { clearSwr, dropSwr, peekSwr, putSwr, setSwrOwner } from '../../src/class-social/swr/swrCache'
import { useSwrLoad } from '../../src/class-social/swr/useSwrLoad'
import { putInboxCache, getInboxCache } from '../../src/class-social/chat/inboxCache'
void React

beforeEach(() => { clearSwr(); setSwrOwner('u1') })
afterEach(() => { cleanup(); clearSwr(); setSwrOwner(null) })
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
type R = { ok: true; value: string } | { ok: false; message: string }

function Probe({ k, fetcher }: { k: string; fetcher: () => Promise<R> }) {
  const { state } = useSwrLoad<string>(k, fetcher)
  return <p data-s={state.status}>{state.status === 'ready' ? state.value : state.status === 'error' ? state.message : '…'}</p>
}
const txt = (c: HTMLElement) => c.querySelector('p')!.getAttribute('data-s') + ':' + c.querySelector('p')!.textContent

test('store: khoá theo tài khoản — đổi tài khoản / đăng xuất xoá sạch, không lộ sang người khác', () => {
  putSwr('class:1:detail', 'A')
  assert.equal(peekSwr('class:1:detail'), 'A')
  setSwrOwner('u2')
  assert.equal(peekSwr('class:1:detail'), undefined, 'tài khoản khác không thấy')
  setSwrOwner('u1')
  assert.equal(peekSwr('class:1:detail'), undefined, 'quay lại u1 cũng đã bị xoá (không giữ dữ liệu cũ)')
  setSwrOwner(null); putSwr('x', 1)
  assert.equal(peekSwr('x'), undefined, 'không có chủ sở hữu → không lưu')
})

test('store: TTL hết hạn, giới hạn số mục, clearSwr xoá cả đệm Chat', () => {
  putSwr('a', 1, 0)
  assert.equal(peekSwr('a', 10 * 60_000 - 1), 1)
  assert.equal(peekSwr('a', 10 * 60_000 + 1), undefined)
  for (let i = 0; i < 120; i++) putSwr('k' + i, i)
  assert.equal(peekSwr('k0'), undefined, 'mục cũ nhất bị loại')
  assert.equal(peekSwr('k119'), 119)
  putInboxCache('u1', 'mine|all|false|', { pinned: [], items: [], hasMore: false, summary: null })
  assert.ok(getInboxCache('u1', 'mine|all|false|'))
  clearSwr()
  assert.equal(getInboxCache('u1', 'mine|all|false|'), null)
  assert.equal(peekSwr('k119'), undefined)
})

test('lần đầu: loading → ready; quay lại: hiện NGAY (không loading) rồi server thay thế ở nền', async () => {
  const first = render(<Probe k="class:1:detail" fetcher={async () => ({ ok: true, value: 'v1' })} />)
  assert.equal(txt(first.container), 'loading:…')
  await act(async () => { await Promise.resolve() })
  assert.equal(txt(first.container), 'ready:v1')
  first.unmount()

  const d = deferred<R>()
  const again = render(<Probe k="class:1:detail" fetcher={() => d.promise} />)
  assert.equal(txt(again.container), 'ready:v1', 'có nội dung ngay ở lần render đầu, server chưa trả')
  await act(async () => { d.resolve({ ok: true, value: 'v2' }); await Promise.resolve() })
  assert.equal(txt(again.container), 'ready:v2', 'dữ liệu mới thay thế khi server trả về')
  assert.equal(peekSwr('class:1:detail'), 'v2')
})

test('server báo lỗi (vd. mất quyền) → bỏ đệm, KHÔNG tiếp tục hiện nội dung cũ', async () => {
  putSwr('class:2:members', 'bí mật')
  const r = render(<Probe k="class:2:members" fetcher={async () => ({ ok: false, message: 'Không có quyền' })} />)
  assert.equal(txt(r.container), 'ready:bí mật')
  await act(async () => { await Promise.resolve() })
  assert.equal(txt(r.container), 'error:Không có quyền')
  assert.equal(peekSwr('class:2:members'), undefined)
})

test('offline: lỗi mạng giữ nội dung đang hiện (không xoá trắng)', async () => {
  putSwr('class:3:detail', 'còn đó')
  const nav = globalThis.navigator as unknown as { onLine: boolean }
  Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, get: () => false })
  try {
    const r = render(<Probe k="class:3:detail" fetcher={async () => ({ ok: false, message: 'mạng' })} />)
    await act(async () => { await Promise.resolve() })
    assert.equal(txt(r.container), 'ready:còn đó')
  } finally { delete (nav as { onLine?: boolean }).onLine }
})

test('đổi key (sang lớp khác): hiện đệm của key mới nếu có, không lẫn dữ liệu lớp cũ', async () => {
  putSwr('class:B:detail', 'Lớp B')
  const d = deferred<R>()
  const r = render(<Probe k="class:A:detail" fetcher={() => d.promise} />)
  assert.equal(txt(r.container), 'loading:…')
  r.rerender(<Probe k="class:B:detail" fetcher={() => new Promise<R>(() => {})} />)
  assert.equal(txt(r.container), 'ready:Lớp B')
  await act(async () => { d.resolve({ ok: true, value: 'Lớp A' }) })
  assert.equal(txt(r.container), 'ready:Lớp B', 'kết quả muộn của key cũ không ghi đè')
  dropSwr('class:B:detail')
})

test('nối dây: phiên đặt chủ đệm + xoá khi đăng xuất/đổi tài khoản; Chat/Lớp/Band dùng cùng một kho', () => {
  const read = (f: string) => fs.readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8')
  const sess = read('class-social/useClassSession.ts')
  assert.match(sess, /setSwrOwner\(userIdOf\(s\)\)/)
  assert.match(sess, /event === 'SIGNED_OUT'\) \{[\s\S]*?clearSwr\(\)[\s\S]*?setSwrOwner\(null\)/)
  assert.match(sess, /SIGNED_IN[\s\S]*?clearSwr\(\); setSwrOwner\(null\)/)
  assert.match(read('class-social/classes/useClassLearning.ts'), /useSwrLoad/)
  assert.match(read('class-social/classes/ClassSpacePage.tsx'), /useSwrLoad<ClassCard>\(`class:\$\{classId\}:detail`/)
  assert.match(read('class-social/classes/ClassSpacePage.tsx'), /usePostsFeed\(fetchPage, `class:\$\{classId\}:activity`\)/)
  assert.match(read('class-social/chat/useChat.ts'), /peekSwr<\{ messages: ChatMessage\[\]; hasMore: boolean \}>\(cacheKey\)/)
  assert.match(read('band/BandAdmin.tsx'), /useSwrLoad<AdminBand\[\]>\('band:admin:list'/)
  assert.match(read('band/BandManage.tsx'), /band:\$\{slug\}:overview/)
})
