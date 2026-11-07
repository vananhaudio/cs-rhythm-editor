// Feed Composer Lát A — hành vi ô nhập bình luận: giữ focus, chống gửi trùng, Gửi lại, ⌘/Ctrl+Enter, cuộn tới bình luận mới.
import './composer-dom-setup'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { Composer } from '../../src/class-social/sections/comments/TargetComments'
import CommentComposer from '../../src/class-social/sections/comments/CommentComposer'
import { revealComment } from '../../src/class-social/sections/comments/ComposerInput'
void React

;(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 0)
afterEach(() => cleanup())

type Deferred = { resolve: (v: string | null) => void }
function setup(opts: { fail?: string } = {}) {
  const calls: string[] = []
  const pending: Deferred[] = []
  const onSubmit = (b: string) => { calls.push(b); return new Promise<string | null>(res => pending.push({ resolve: res })) }
  const r = render(<Composer idBase="t1" placeholder="Viết bình luận..." submitLabel="Gửi bình luận" me={null} onSubmit={onSubmit} />)
  const ta = r.container.querySelector('textarea') as HTMLTextAreaElement
  const btn = () => r.container.querySelector('button.cs-cmt-send') as HTMLButtonElement
  void opts
  return { r, ta, btn, calls, pending }
}
const type = (ta: HTMLTextAreaElement, v: string) => fireEvent.change(ta, { target: { value: v } })

test('đang gửi: ô nhập KHÔNG disabled/readOnly, giữ focus, aria-busy, nút đổi trạng thái; bấm liên tục chỉ gửi MỘT lần', async () => {
  const { r, ta, btn, calls, pending } = setup()
  type(ta, '  xin chào  '); ta.focus()
  fireEvent.click(btn()); fireEvent.click(btn()); fireEvent.click(btn())
  fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true })
  assert.deepEqual(calls, ['xin chào'], 'chống gửi trùng (kể cả ⌘/Ctrl+Enter trong lúc đang gửi)')
  assert.equal(ta.disabled, false); assert.equal(ta.readOnly, false)
  assert.equal(ta.getAttribute('aria-busy'), 'true')
  assert.equal(document.activeElement, ta, 'bàn phím không đóng: ô vẫn giữ focus')
  assert.equal(btn().getAttribute('aria-label'), 'Đang gửi…')
  assert.ok(btn().querySelector('.cs-spin'))
  assert.match(r.container.querySelector('[role=status]')!.textContent ?? '', /Đang gửi/)
  // gõ thêm trong lúc gửi bị bỏ qua (ô controlled hoàn nguyên) → không mất / lệch chữ
  type(ta, 'xin chào thêm'); assert.equal(ta.value, '  xin chào  ')
  await act(async () => { pending[0].resolve(null) })
  await waitFor(() => assert.equal(ta.value, ''))
  assert.equal(ta.getAttribute('aria-busy'), 'false')
  assert.equal(document.activeElement, ta, 'gửi xong vẫn giữ focus để viết tiếp')
  assert.equal(calls.length, 1)
})

test('Enter xuống dòng (không gửi); Ctrl/Cmd+Enter gửi', async () => {
  const { ta, calls, pending } = setup()
  type(ta, 'dòng 1')
  fireEvent.keyDown(ta, { key: 'Enter' })
  assert.equal(calls.length, 0)
  fireEvent.keyDown(ta, { key: 'Enter', metaKey: true })
  assert.equal(calls.length, 1)
  await act(async () => { pending[0].resolve(null) })
  type(ta, 'dòng 2'); fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true })
  assert.deepEqual(calls, ['dòng 1', 'dòng 2'])
  await act(async () => { pending[1].resolve(null) })
})

test('thất bại: GIỮ nguyên nội dung, hiện lỗi + "Gửi lại"; Gửi lại thành công thì xoá lỗi và ô', async () => {
  const { r, ta, btn, calls, pending } = setup()
  type(ta, 'nội dung dài'); fireEvent.click(btn())
  await act(async () => { pending[0].resolve('Không có mạng — chưa gửi được. Nội dung của bạn vẫn được giữ.') })
  const alert = await waitFor(() => { const a = r.container.querySelector('[role=alert]'); assert.ok(a); return a! })
  assert.match(alert.textContent ?? '', /Không có mạng/)
  assert.equal(ta.value, 'nội dung dài', 'giữ nguyên chữ')
  assert.equal(ta.getAttribute('aria-busy'), 'false')
  const retry = r.container.querySelector('button.cs-cmt-retry') as HTMLButtonElement
  assert.ok(retry && /Gửi lại/.test(retry.textContent ?? ''))
  fireEvent.click(retry); fireEvent.click(retry)
  assert.deepEqual(calls, ['nội dung dài', 'nội dung dài'], 'Gửi lại đúng một lần, cùng nội dung')
  await act(async () => { pending[1].resolve(null) })
  await waitFor(() => assert.equal(ta.value, ''))
  assert.equal(r.container.querySelector('[role=alert]'), null)
})

test('lỗi ném ngoại lệ cũng không mất chữ; sửa chữ thì lỗi biến mất; rỗng / quá dài không gọi gửi và không có nút Gửi lại', async () => {
  const calls: string[] = []
  const r = render(<Composer idBase="t2" placeholder="p" submitLabel="Gửi" me={null} onSubmit={async b => { calls.push(b); throw new Error('boom') }} />)
  const ta = r.container.querySelector('textarea') as HTMLTextAreaElement
  type(ta, 'abc'); fireEvent.click(r.container.querySelector('button.cs-cmt-send')!)
  await waitFor(() => assert.ok(r.container.querySelector('[role=alert]')))
  assert.equal(ta.value, 'abc')
  type(ta, 'abcd'); assert.equal(r.container.querySelector('[role=alert]'), null)
  const tooLong = 'x'.repeat(2001)
  // maxLength chặn khi gõ thật; jsdom không chặn change → kiểm nhánh kiểm tra nội dung
  type(ta, tooLong); fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true })
  assert.match(r.container.querySelector('[role=alert]')!.textContent ?? '', /tối đa/)
  assert.equal(r.container.querySelector('button.cs-cmt-retry'), null)
  assert.equal(calls.length, 1)
})

test('nút gửi không cướp focus của ô nhập (mousedown bị chặn mặc định) và bị khoá khi ô trống', () => {
  const { ta, btn } = setup()
  assert.equal(btn().disabled, true)
  type(ta, 'a')
  const notPrevented = fireEvent.mouseDown(btn())
  assert.equal(notPrevented, false, 'mousedown preventDefault → focus ở lại ô nhập')
})

test('nhất quán hai hệ: ô bình luận bài Social và thread/TeamLab cùng cấu trúc ô nhập', () => {
  const me = { userId: 'u1', name: 'An', avatarUrl: null, isTeacher: false } as never
  const social = renderToStaticMarkup(<CommentComposer postId="aaaaaaaa-0000-4000-8000-000000000001" me={me} onSent={() => {}} />)
  const target = renderToStaticMarkup(<Composer idBase="x" placeholder="Viết bình luận..." submitLabel="Gửi bình luận" me={me} onSubmit={async () => null} />)
  for (const html of [social, target]) {
    assert.match(html, /cs-cmt-inputwrap/); assert.match(html, /aria-busy="false"/); assert.match(html, /role="status"/)
    assert.ok(!/<textarea[^>]*disabled/.test(html), 'ô nhập không bao giờ disabled')
  }
})

test('revealComment: cuộn bình luận mới vào vùng nhìn bằng block nearest; id lạ bị bỏ qua', async () => {
  const el = document.createElement('li'); el.setAttribute('data-comment-id', 'aaaaaaaa-0000-4000-8000-0000000000bb')
  const seen: unknown[] = []
  ;(el as unknown as { scrollIntoView: (o: unknown) => void }).scrollIntoView = o => { seen.push(o) }
  document.body.appendChild(el)
  revealComment('aaaaaaaa-0000-4000-8000-0000000000bb')
  await waitFor(() => assert.equal(seen.length, 1))
  assert.equal((seen[0] as { block: string }).block, 'nearest')
  revealComment('"]><script>'); await new Promise(r => setTimeout(r, 20)); assert.equal(seen.length, 1)
  el.remove()
  // phần tử chưa có (đang tải lại) → thử lại vài khung hình rồi cuộn khi xuất hiện
  const el2 = document.createElement('li'); el2.setAttribute('data-comment-id', 'bbbbbbbb-0000-4000-8000-0000000000cc')
  const seen2: unknown[] = []; (el2 as unknown as { scrollIntoView: (o: unknown) => void }).scrollIntoView = o => { seen2.push(o) }
  revealComment('bbbbbbbb-0000-4000-8000-0000000000cc')
  setTimeout(() => document.body.appendChild(el2), 10)
  await waitFor(() => assert.equal(seen2.length, 1))
  el2.remove()
})
