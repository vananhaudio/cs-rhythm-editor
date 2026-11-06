// Feed Comments Lát C — trả lời bình luận Social: hội thoại hai tầng, p_parent_id, người được phản hồi, cửa sổ tải, xoá cascade, kiểm duyệt giữ nguyên.
import './composer-dom-setup'
import { test, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import React from 'react'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import CommentsSection from '../../src/class-social/sections/comments/CommentsSection'
import { __setCommentsApiLoader } from '../../src/class-social/comments/lazyApi'
import { buildIdentities } from '../../src/class-social/identity/learningIdentity'
import { __seedIdentity } from '../../src/class-social/identity/identityStore'
import { toComment, groupByPost, buildThreads, visibleWithContext, descendantCount, type CommentRow, type Comment } from '../../src/class-social/comments/commentModel'
void React

const P = 'pppppppp-0000-4000-8000-000000000001'
let t0 = Date.parse('2026-11-01T10:00:00Z')
const row = (id: string, parent: string | null, over: Partial<CommentRow> = {}): CommentRow => ({
  id, post_id: P, parent_comment_id: parent, body: 'nd ' + id, created_at: new Date(t0 += 60000).toISOString(), updated_at: '2026-11-01T10:00:00Z',
  author_user_id: 'u-' + id, author_name: 'Tên ' + id, author_avatar_url: null, author_role: 'student', is_mine: false, is_hidden: false,
  tags: [], resources: [], post_comment_count: 99, ...over,
})
const cm = (rows: CommentRow[]): Comment[] => groupByPost(rows).get(P) ?? []
const ids = (cs: { c?: Comment }[] | Comment[]) => (cs as (Comment & { c?: Comment })[]).map(x => (x.c ?? x).id)

// ── Mô hình thuần ────────────────────────────────────────────────────────────
test('C2: trả lời gốc và trả lời một câu trả lời → hai tầng; trả lời lồng không thành tầng ba, và biết đúng người được phản hồi', () => {
  const items = cm([row('a', null), row('b', null), row('a1', 'a'), row('a2', 'a1'), row('a3', 'a2'), row('b1', 'b')])
  const th = buildThreads(items)
  assert.deepEqual(th.map(t => t.root?.id), ['a', 'b'])
  assert.deepEqual(ids(th[0].replies), ['a1', 'a2', 'a3'])               // phẳng dưới gốc, thứ tự thời gian
  assert.deepEqual(th[0].replies.map(r => r.replyTo?.id ?? null), [null, 'a1', 'a2'])   // trả lời gốc → không nhãn; còn lại → đúng người
  assert.deepEqual(ids(th[1].replies), ['b1'])
})

test('C2: nhiều trả lời giữ thứ tự thời gian dù thứ tự đầu vào xáo trộn; gốc theo thời gian gốc', () => {
  const rows = [row('a', null), row('b', null), row('a1', 'a'), row('b1', 'b'), row('a2', 'a')]
  const items = cm(rows.slice().reverse())
  const th = buildThreads(items)
  assert.deepEqual(th.map(t => t.root?.id), ['a', 'b'])
  assert.deepEqual(ids(th[0].replies), ['a1', 'a2'])
})

test('C3: trả lời có gốc chưa tải → nhóm mồ côi, KHÔNG mất; dữ liệu hỏng (vòng cha) không treo', () => {
  const th = buildThreads(cm([row('x1', 'old'), row('x2', 'x1'), row('n', null)]))
  assert.equal(th.length, 2)
  const orphan = th.find(t => !t.root)!
  assert.deepEqual(ids(orphan.replies), ['x1', 'x2'])
  assert.equal(orphan.replies[1].replyTo?.id, 'x1')
  const loop = buildThreads(cm([row('l1', 'l2'), row('l2', 'l1')]))
  assert.equal(loop.flatMap(t => t.replies).length, 2)
})

test('C3: cửa sổ N mới nhất kèm tổ tiên đã tải → trả lời không bị tách khỏi gốc; đếm đúng', () => {
  const all = cm([row('a', null), row('b', null), row('c', null), row('a1', 'a'), row('d', null)])
  assert.deepEqual(ids(visibleWithContext(all, 2)), ['a', 'a1', 'd'])   // a1 kéo theo gốc a; b, c nằm ngoài
  assert.deepEqual(ids(visibleWithContext(all, 10)), ids(all))
  const chain = cm([row('r', null), row('r1', 'r'), row('r2', 'r1'), row('z', null)])
  assert.deepEqual(ids(visibleWithContext(chain, 2)), ['r', 'r1', 'r2', 'z'])
})

test('C3: đếm hậu duệ để cảnh báo xoá cascade', () => {
  const items = cm([row('a', null), row('a1', 'a'), row('a2', 'a1'), row('b', null), row('b1', 'b')])
  assert.equal(descendantCount(items, 'a'), 2)
  assert.equal(descendantCount(items, 'a1'), 1)
  assert.equal(descendantCount(items, 'b1'), 0)
})

// ── Giao diện ────────────────────────────────────────────────────────────────
type Add = { postId: string; body: string; parentId?: string | null }
let adds: Add[] = [], deleted: string[] = [], addResult: { ok: true; value: { id: string } } | { ok: false; message: string }
let confirmMsg: string[] = [], confirmAnswer = true
beforeEach(() => {
  t0 = Date.parse('2026-11-01T10:00:00Z'); adds = []; deleted = []; confirmMsg = []; confirmAnswer = true
  addResult = { ok: true, value: { id: 'new-id' } }
  for (const u of ['u-a', 'u-a1', 'u-a2', 'u-b', 'u-h', 'u-me', 'u-s', 'u-x1', 'u-n', 'u-o1', 'u-o2', 'u-o3', 'u-o4', 'u-o1r']) __seedIdentity(u, buildIdentities([], '2026-11-06'))
  __setCommentsApiLoader((async () => ({
    addComment: async (i: Add) => { adds.push(i); return addResult },
    deleteComment: async (id: string) => { deleted.push(id); return { ok: true, value: null } },
    moderate: async () => ({ ok: true, value: null }),
  })) as never)
  ;(window as unknown as { confirm: (m: string) => boolean }).confirm = (m: string) => { confirmMsg.push(m); return confirmAnswer }
})
afterEach(() => { cleanup(); __setCommentsApiLoader(null) })

const me = (isTeacher = false) => ({ role: isTeacher ? 'teacher' : 'student', userId: 'u-me', studentId: 's', name: 'Tôi', email: null, avatarUrl: null, level: null, enrolledAt: null, htMember: false, isTeacher, coverUrl: null }) as never
let expands = 0, refreshes = 0
const mount = (rows: CommentRow[], opts: { teacher?: boolean; total?: number } = {}) => {
  expands = 0; refreshes = 0
  return render(<CommentsSection postId={P} total={opts.total ?? rows.length} me={me(opts.teacher)} now={new Date('2026-11-02T00:00:00Z')}
    state={{ items: cm(rows), total: opts.total ?? rows.length, expanded: true, loading: false, error: null }}
    onRefresh={async () => { refreshes++ }} onExpand={async () => { expands++ }} />)
}
const at = (r: ReturnType<typeof render>, id: string) => r.container.querySelector(`[data-comment-id="${id}"]`)!
const replyBtn = (r: ReturnType<typeof render>, id: string) => Array.from(at(r, id).querySelectorAll(':scope > .cs-cmt .cs-cmt-reply'))[0] as HTMLElement

test('C1: bấm Trả lời → ô nhập nói rõ đang trả lời ai; gửi bằng p_parent_id đúng, không chèn tên vào nội dung', async () => {
  const r = mount([row('a', null), row('b', null)])
  fireEvent.click(replyBtn(r, 'a'))
  assert.match(r.container.textContent!, /Đang trả lời\s*Tên a/)
  const ta = r.container.querySelector('textarea[placeholder="Trả lời Tên a…"]') as HTMLTextAreaElement
  assert.ok(ta)
  fireEvent.change(ta, { target: { value: 'Em cũng vậy' } })
  fireEvent.click(r.container.querySelector('button[aria-label="Gửi trả lời"]')!)
  await waitFor(() => assert.equal(adds.length, 1))
  assert.equal(adds[0].parentId, 'a')
  assert.equal(adds[0].postId, P)
  assert.equal(adds[0].body, 'Em cũng vậy')           // nội dung nguyên văn
  await waitFor(() => assert.equal(expands, 1))               // tải đủ để thấy gốc của trả lời mới
  assert.equal(r.container.querySelector('.cs-replying'), null)   // ô trả lời đóng
})

test('C1: bình luận gốc mới vẫn gửi p_parent_id = null; huỷ trả lời đóng ô, Esc cũng huỷ', async () => {
  const r = mount([row('a', null)])
  const main = r.container.querySelector('textarea[placeholder="Viết bình luận..."]') as HTMLTextAreaElement
  fireEvent.change(main, { target: { value: 'Chào mọi người' } })
  fireEvent.click(r.container.querySelector('button[aria-label="Gửi bình luận"]')!)
  await waitFor(() => assert.equal(adds.length, 1))
  assert.ok(!adds[0].parentId)
  fireEvent.click(replyBtn(r, 'a'))
  assert.ok(r.container.querySelector('.cs-replying'))
  fireEvent.click(r.container.querySelector('.cs-replying .cs-cmt-cancel')!)
  assert.equal(r.container.querySelector('.cs-replying'), null)
  fireEvent.click(replyBtn(r, 'a'))
  fireEvent.keyDown(r.container.querySelector('textarea[placeholder="Trả lời Tên a…"]')!, { key: 'Escape' })
  assert.equal(r.container.querySelector('.cs-replying'), null)
})

test('C2: trả lời một câu trả lời → parent là câu trả lời đó; hiển thị phẳng dưới gốc kèm "Trả lời <tên>"; không tầng ba', async () => {
  const rows = [row('a', null), row('a1', 'a'), row('a2', 'a1')]
  const r = mount(rows)
  const nodes = r.container.querySelectorAll('.cs-cmt-replies')
  assert.equal(nodes.length, 1)                                           // đúng một danh sách trả lời
  assert.equal(r.container.querySelectorAll('.cs-cmt-replies .cs-cmt-replies').length, 0)   // không lồng
  assert.deepEqual(Array.from(nodes[0].querySelectorAll(':scope > .cs-cmt-node')).map(n => n.getAttribute('data-comment-id')), ['a1', 'a2'])
  assert.ok(!at(r, 'a1').querySelector('.cs-replyto'))                    // trả lời thẳng gốc: không nhãn
  assert.match(at(r, 'a2').querySelector('.cs-replyto')!.textContent!, /Trả lời\s*Tên a1/)
  fireEvent.click(replyBtn(r, 'a2'))
  assert.match(r.container.textContent!, /Đang trả lời\s*Tên a2/)
  fireEvent.change(r.container.querySelector('textarea[placeholder="Trả lời Tên a2…"]')!, { target: { value: 'ok' } })
  fireEvent.click(r.container.querySelector('button[aria-label="Gửi trả lời"]')!)
  await waitFor(() => assert.equal(adds[0]?.parentId, 'a2'))
  assert.equal(adds[0].body, 'ok')
})

test('C3: trả lời mồ côi không mất, có chú thích; bình luận cũ/mới đúng thứ tự', () => {
  const r = mount([row('x1', 'cu-khong-tai'), row('n', null)], { total: 2 })
  assert.ok(at(r, 'x1'))
  assert.match(at(r, 'x1').textContent!, /Trả lời một bình luận không hiển thị ở đây/)
  assert.ok(at(r, 'n'))
})

test('C3: "Xem thêm" đếm theo bình luận thật đang hiện (cả gốc kèm theo), không đếm sai', () => {
  const rows = [row('o1', null), row('o2', null), row('o3', null), row('o4', null), row('o1r', 'o1')]
  const r = mount(rows, { total: 5 })
  // limit mặc định 3: o3, o4, o1r + gốc o1 kèm theo = 4 hiện → còn 1 ẩn (o2)
  assert.ok(at(r, 'o1') && at(r, 'o1r') && at(r, 'o3') && at(r, 'o4'))
  assert.ok(!at(r, 'o2'))
  assert.match(r.container.querySelector('.cs-cmts-more')!.textContent!, /\(1\)/)
})

test('C4 (+B): xoá gốc có trả lời → hộp xác nhận nêu số trả lời bị xoá cascade theo cây cha–con; không trả lời → câu cũ; huỷ thì không xoá', async () => {
  const rows = [row('a', null, { is_mine: true, author_user_id: 'u-me' }), row('a1', 'a'), row('a2', 'a1'), row('s', null, { is_mine: true, author_user_id: 'u-me' })]
  const r = mount(rows)
  const dlg = () => r.container.querySelector('[role=alertdialog]')
  const del = (id: string) => {
    fireEvent.click(at(r, id).querySelector(':scope > .cs-cmt .cs-more-btn')!)
    fireEvent.click((Array.from(r.container.querySelectorAll('[role="menuitem"]')) as HTMLElement[]).find(m => /Xoá bình luận/.test(m.textContent!))!)
  }
  del('a')
  assert.match(dlg()!.textContent!, /và 2 trả lời/)                        // a1 + a2 (con của con) — đếm theo cây, không theo số đang thấy
  fireEvent.click(Array.from(dlg()!.querySelectorAll('button')).find(b => b.textContent === 'Huỷ')!)
  await new Promise(r2 => setTimeout(r2, 20)); assert.deepEqual(deleted, []); assert.ok(!dlg())
  del('s')
  assert.match(dlg()!.textContent!, /Bình luận sẽ bị xoá/); assert.ok(!/trả lời bên dưới/.test(dlg()!.textContent!))
  fireEvent.click(Array.from(dlg()!.querySelectorAll('button')).find(b => b.textContent === 'Xoá')!)
  await waitFor(() => assert.deepEqual(deleted, ['s']))
  await waitFor(() => assert.equal(refreshes, 1))
  await waitFor(() => assert.ok(!dlg()))
})

test('C4: menu kiểm duyệt không đổi (người khác: Báo cáo + Chặn; Thầy thêm Ẩn; của mình: Xoá); Trả lời không thay menu; bình luận bị ẩn không có Trả lời', () => {
  const rows = [row('a', null, { is_mine: true, author_user_id: 'u-me' }), row('b', null), row('h', null, { is_hidden: true })]
  const labels = (r: ReturnType<typeof render>, id: string) => {
    fireEvent.click(at(r, id).querySelector(':scope > .cs-cmt .cs-more-btn')!)
    const l = Array.from(r.container.querySelectorAll('[role="menuitem"]')).map(x => x.textContent!.trim())
    fireEvent.keyDown(document.body, { key: 'Escape' }); return l
  }
  let r = mount(rows)
  assert.ok(labels(r, 'a').some(x => /Xoá bình luận/.test(x)))
  const other = labels(r, 'b'); assert.ok(other.some(x => /Báo cáo/.test(x)) && other.some(x => /Chặn/.test(x))); assert.ok(!other.some(x => /Ẩn bình luận/.test(x)))
  assert.ok(!at(r, 'h') || !replyBtn(r, 'h'))        // bình luận ẩn (thầy mới thấy) không cho trả lời
  cleanup()
  r = mount(rows, { teacher: true })
  assert.ok(labels(r, 'b').some(x => /Ẩn bình luận/.test(x)))
  assert.ok(!replyBtn(r, 'h'))
  assert.ok(replyBtn(r, 'b'))
})

test('Không đổi DB / RPC / RLS: lát C không thêm migration, chỉ dùng tham số p_parent_id có sẵn', () => {
  const api = fs.readFileSync(new URL('../../src/class-social/comments/commentsApi.ts', import.meta.url), 'utf8')
  assert.match(api, /p_parent_id: input\.parentId \?\? null/)
  assert.ok(!/migration|alter table|create (or replace )?function/i.test(api))
  assert.ok(!fs.existsSync(new URL('../../db/feed_comments_c_setup.sql', import.meta.url)))
})
