// Feed Comments Lát B — hộp xoá thay window.confirm, huy hiệu danh tính đồng bộ, kiểm duyệt không đổi, CSS vùng chạm / tên dài.
import './composer-dom-setup'
import { test, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import React from 'react'
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import TargetComments from '../../src/class-social/sections/comments/TargetComments'
import CommentItem from '../../src/class-social/sections/comments/CommentItem'
import { supabaseTargetCommentsApi as api } from '../../src/class-social/comments/targetCommentsApi'
import { buildIdentities } from '../../src/class-social/identity/learningIdentity'
import { __seedIdentity } from '../../src/class-social/identity/identityStore'
import type { TargetCommentRow } from '../../src/class-social/comments/targetCommentModel'
import type { Comment } from '../../src/class-social/comments/commentModel'
void React

const ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const row = (id: string, over: Partial<TargetCommentRow> = {}): TargetCommentRow => ({
  id, parent_comment_id: null, body: 'nội dung ' + id, created_at: '2026-11-01T10:00:00Z', edited_at: null, author_user_id: 'u-other',
  author_name: 'Bạn', author_avatar_url: null, author_role: null, is_mine: false, is_hidden: false, ...over,
})
const A = '11111111-0000-4000-8000-00000000000a', B = '11111111-0000-4000-8000-00000000000b'
const R1 = '11111111-0000-4000-8000-0000000000r1'.replace('r', '1'), R2 = '11111111-0000-4000-8000-000000000012'
const rows = (): TargetCommentRow[] => [
  row(A, { is_mine: true, author_user_id: 'u-me', author_name: 'Tôi' }),
  row(R1, { parent_comment_id: A, is_mine: true, author_user_id: 'u-me', author_name: 'Tôi' }),
  row(R2, { parent_comment_id: A, author_user_id: 'u-s2', author_name: 'Học viên Hai' }),
  row(B, { author_user_id: 'u-teacher', author_name: 'Thầy Văn Anh', author_role: 'teacher' }),
]
const me = (isTeacher = false) => ({ userId: 'u-me', name: 'Tôi', avatarUrl: null, isTeacher }) as never

let removed: string[] = [], listCalls = 0, removeImpl: (id: string) => Promise<{ ok: true; value: null } | { ok: false; message: string }>
const orig = { ...api }
beforeEach(() => {
  for (const u of ['u-me', 'u-other', 'u-s2', 'u-teacher']) __seedIdentity(u, buildIdentities([], '2026-11-06'))   // không gọi mạng thật
  removed = []; listCalls = 0
  removeImpl = async () => ({ ok: true, value: null })
  api.page = (async () => ({ ok: false as const, message: '', code: 'UNSUPPORTED' })) as typeof api.page   // tích hợp A–D: máy chủ chưa có hàm phân trang → đường cũ (api.list)
  api.list = (async () => { listCalls++; return { ok: true as const, value: (await import('../../src/class-social/comments/targetCommentModel')).buildThread(rows()) } }) as typeof api.list
  api.remove = (async (_k: unknown, id: string) => { removed.push(id); return removeImpl(id) }) as typeof api.remove
  ;(window as unknown as { confirm: () => boolean }).confirm = () => { throw new Error('window.confirm không được dùng nữa') }
})
afterEach(() => { cleanup(); Object.assign(api, orig) })

const mount = async (isTeacher = false) => {
  const r = render(<TargetComments kind="learning_thread" id={ID} me={me(isTeacher)} />)
  await waitFor(() => assert.ok(r.container.querySelector(`[data-comment-id="${A}"]`)))
  return r
}
const openMenu = (r: ReturnType<typeof render>, id: string) => {
  const li = r.container.querySelector(`[data-comment-id="${id}"]`)!
  fireEvent.click(li.querySelector('button[aria-label="Tuỳ chọn bình luận"]')!)
  return li
}
const items = (r: ReturnType<typeof render>) => [...r.container.querySelectorAll('[role=menuitem]')].map(x => x.textContent)
const dialog = (r: ReturnType<typeof render>) => r.container.querySelector('[role=alertdialog]')

test('xoá bình luận gốc có trả lời: hộp xác nhận cảnh báo chung (không nêu số) về trả lời bị xoá cùng; Huỷ không xoá gì', async () => {
  const r = await mount()
  const li = openMenu(r, A); fireEvent.click([...li.querySelectorAll('[role=menuitem]')].find(x => x.textContent === 'Xoá bình luận')!)
  const d = dialog(r)!
  assert.ok(d, 'có hộp xác nhận (không còn window.confirm)')
  assert.match(d.textContent ?? '', /Xoá bình luận này\?/)
  assert.match(d.textContent ?? '', /cùng mọi trả lời bên dưới \(nếu có\)/); assert.ok(!/\d/.test(d.textContent ?? ''), 'không nêu số trả lời (số chỉ phản ánh dòng đang thấy)')
  assert.ok(li.classList.contains('is-deleting'), 'bình luận đang chờ xoá được làm mờ')
  const [cancel, del] = [...d.querySelectorAll('button')]
  assert.equal(cancel.textContent, 'Huỷ'); assert.equal(del.textContent, 'Xoá'); assert.ok(del.classList.contains('cs-btn-danger'))
  fireEvent.click(cancel)
  assert.equal(dialog(r), null); assert.deepEqual(removed, []); assert.ok(!li.classList.contains('is-deleting'))
})

test('Esc / bấm nền = Huỷ; xoá một trả lời: tiêu đề riêng', async () => {
  const r = await mount()
  const li = openMenu(r, R1); fireEvent.click([...li.querySelectorAll('[role=menuitem]')].find(x => x.textContent === 'Xoá bình luận')!)
  assert.match(dialog(r)!.textContent ?? '', /Xoá trả lời này\?/)
  fireEvent.keyDown(window, { key: 'Escape' }); assert.equal(dialog(r), null)
  openMenu(r, R1); fireEvent.click(r.container.querySelector('[role=menuitem].is-danger')!)
  fireEvent.click(r.container.querySelector('.cs-dialog-backdrop')!); assert.equal(dialog(r), null)
  assert.deepEqual(removed, [])
})

test('chống xoá trùng: bấm Xoá liên tục chỉ gọi một lần; xong thì đóng hộp và tải lại danh sách', async () => {
  const r = await mount()
  let release!: () => void
  removeImpl = () => new Promise(res => { release = () => res({ ok: true, value: null }) })
  const li = openMenu(r, A); fireEvent.click([...li.querySelectorAll('[role=menuitem]')].find(x => x.textContent === 'Xoá bình luận')!)
  const del = [...dialog(r)!.querySelectorAll('button')][1]
  fireEvent.click(del); fireEvent.click(del); fireEvent.click(del)
  assert.deepEqual(removed, [A])
  assert.equal(del.getAttribute('aria-busy'), 'true'); assert.match(del.textContent ?? '', /Đang xử lý/)
  assert.equal([...dialog(r)!.querySelectorAll('button')][0].hasAttribute('disabled'), true, 'Huỷ bị khoá khi đang xử lý')
  fireEvent.keyDown(window, { key: 'Escape' }); assert.ok(dialog(r), 'Esc không đóng khi đang xử lý')
  const before = listCalls
  await act(async () => { release() })
  await waitFor(() => assert.equal(dialog(r), null))
  assert.equal(listCalls, before + 1)
})

test('xoá thất bại: hộp GIỮ nguyên, báo lý do, nút thành "Thử lại", danh sách không đổi; thử lại thành công thì đóng', async () => {
  const r = await mount()
  removeImpl = async () => ({ ok: false, message: 'Chưa gửi được. Thử lại sau.' })
  const li = openMenu(r, A); fireEvent.click([...li.querySelectorAll('[role=menuitem]')].find(x => x.textContent === 'Xoá bình luận')!)
  const before = listCalls
  await act(async () => { fireEvent.click([...dialog(r)!.querySelectorAll('button')][1]) })
  await waitFor(() => assert.ok(dialog(r)!.querySelector('[role=alert]')))
  assert.match(dialog(r)!.querySelector('[role=alert]')!.textContent ?? '', /Chưa xoá được\. Hãy thử lại sau/)
  assert.ok(!/gửi/.test(dialog(r)!.textContent ?? ''), 'lời báo nói về xoá, không nói về gửi')
  assert.equal([...dialog(r)!.querySelectorAll('button')][1].textContent, 'Thử lại')
  assert.equal(listCalls, before, 'không tải lại khi thất bại')
  assert.ok(r.container.querySelector(`[data-comment-id="${A}"]`), 'bình luận vẫn còn')
  removeImpl = async () => ({ ok: true, value: null })
  await act(async () => { fireEvent.click([...dialog(r)!.querySelectorAll('button')][1]) })
  await waitFor(() => assert.equal(dialog(r), null)); assert.deepEqual(removed, [A, A])
})

test('xoá bị ném ngoại lệ vẫn không vỡ giao diện (báo lỗi trong hộp)', async () => {
  const r = await mount()
  api.remove = (async () => { throw new Error('boom') }) as typeof api.remove
  const li = openMenu(r, A); fireEvent.click([...li.querySelectorAll('[role=menuitem]')].find(x => x.textContent === 'Xoá bình luận')!)
  await act(async () => { fireEvent.click([...dialog(r)!.querySelectorAll('button')][1]) })
  await waitFor(() => assert.match(dialog(r)!.textContent ?? '', /Chưa xoá được/))
})

test('kiểm duyệt không đổi: bình luận người khác có Báo cáo + Chặn; Thầy có thêm Ẩn; của mình có Sửa/Xoá (không Báo cáo)', async () => {
  let r = await mount()
  openMenu(r, R2); assert.deepEqual(items(r), ['Báo cáo', 'Chặn người dùng'])
  cleanup(); r = await mount(true)
  openMenu(r, R2); assert.deepEqual(items(r), ['Ẩn bình luận', 'Báo cáo', 'Chặn người dùng'])
  cleanup(); r = await mount()
  openMenu(r, A); assert.deepEqual(items(r), ['Sửa bình luận', 'Xoá bình luận'])
})

test('huy hiệu danh tính: thread/TeamLab hiện nhãn lớp đúng người; Thầy chỉ có "Thầy"; không trùng; Social dùng cùng renderer', async () => {
  __seedIdentity('u-s2', buildIdentities([{ class_code: 'DH2.KD0826', status: 'active' }], '2026-11-06'))
  __seedIdentity('u-teacher', buildIdentities([{ class_code: 'DH2.KD0826', status: 'active' }], '2026-11-06'))   // dù có dữ liệu, Thầy không hiện nhãn lớp
  __seedIdentity('u-other', buildIdentities([], '2026-11-06'))
  __seedIdentity('u-me', buildIdentities([{ class_code: 'TN1.X', status: 'completed' }], '2026-11-06'))        // chỉ đã tốt nghiệp → không hiện cạnh tên
  const r = await mount()
  const lids = (id: string) => [...r.container.querySelector(`[data-comment-id="${id}"]`)!.querySelectorAll('.cs-lid')].map(x => x.textContent)
  assert.deepEqual(lids(R2), ['Đệm hát 2'], 'đúng người, đúng nhãn, một nhãn')
  assert.deepEqual(lids(A), [], 'chỉ tốt nghiệp → không có nhãn cạnh tên')
  assert.deepEqual(lids(B), [], 'Thầy: không nhãn lớp')
  assert.equal(r.container.querySelector(`[data-comment-id="${B}"] .cs-cmt-badge`)!.textContent, 'Thầy')
  assert.equal(r.container.querySelectorAll('.cs-cmt-badge').length, 1)
  // Social: cùng nhãn cho cùng người
  const c: Comment = { id: 'cc', postId: 'p', body: 'x', createdAt: '2026-11-01T10:00:00Z', author: { userId: 'u-s2', name: 'Học viên Hai', avatarUrl: null, isTeacher: false }, parentId: null, seq: null, rootSeq: null, isMine: false, isHidden: false, tags: [], resources: [] }
  const s = render(<ul><CommentItem c={c} canModerate={false} onDelete={() => {}} onModerate={() => {}} /></ul>)
  assert.deepEqual([...s.container.querySelectorAll('.cs-lid')].map(x => x.textContent), ['Đệm hát 2'])
})

test('CSS: vùng chạm vô hình 44px cho Trả lời/Huỷ, mục menu 44px trên mobile, tên dài xuống dòng, trả lời có vạch dẫn', () => {
  const css = fs.readFileSync(new URL('../../src/class-social/classSocial.css', import.meta.url), 'utf8')
  assert.match(css, /\.cs-cmt-reply::after, \.cs-cmt-cancel::after \{[^}]*height: 44px/)
  assert.match(css, /@media \(max-width: 1023px\) \{\s*\.cs-cmts \.cs-more-item \{[^}]*min-height: 44px/)
  assert.match(css, /\.cs-cmt-author \{[^}]*overflow-wrap: anywhere/)
  assert.match(css, /\.cs-target-cmts \.cs-cmt-replies \{ margin-left: 16px; padding-left: 12px; border-left: 2px solid/)
})
