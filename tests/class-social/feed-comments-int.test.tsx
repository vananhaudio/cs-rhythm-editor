// Tích hợp A+B+C+D — các tình huống GIAO NHAU giữa composer dùng chung (A), hộp xoá (B), trả lời hai tầng (C), phân trang (D):
// trả lời vào gốc nằm ngoài trang mới nhất; con trỏ trang không nhảy; xoá cascade đếm theo cây thật; thread/TeamLab; lỗi mạng.
import './composer-dom-setup'
import { test, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, renderHook, act, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { toComment, type CommentRow, type Comment } from '../../src/class-social/comments/commentModel'
import { useFeedComments } from '../../src/class-social/comments/useFeedComments'
import { __setCommentsApiLoader } from '../../src/class-social/comments/lazyApi'
import CommentsSection from '../../src/class-social/sections/comments/CommentsSection'
import TargetComments from '../../src/class-social/sections/comments/TargetComments'
import { supabaseTargetCommentsApi as tapi } from '../../src/class-social/comments/targetCommentsApi'
import { toTargetComment, type TargetCommentRow } from '../../src/class-social/comments/targetCommentModel'
import { buildIdentities } from '../../src/class-social/identity/learningIdentity'
import { __seedIdentity } from '../../src/class-social/identity/identityStore'
void React

const P = 'pppppppp-0000-4000-8000-000000000002'
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const me = { role: 'student', userId: 'u-me', studentId: 's', name: 'Tôi', email: null, avatarUrl: null, level: null, enrolledAt: null, htMember: false, isTeacher: false, coverUrl: null } as never

// ── "Máy chủ" Social giả (đúng ngữ nghĩa class_comments_page_safe + xoá cascade + trả lời giữ root_seq của gốc) ──
let rows: CommentRow[] = [], seqN = 0, calls: { before: number | null; limit: number }[] = [], deleted: string[] = [], adds: { parentId: string | null; body: string }[] = [], failPage = 0
const mk = (id: string, parent: string | null, rootSeq: number | null, over: Partial<CommentRow> = {}): CommentRow => ({
  id, post_id: P, parent_comment_id: parent, body: 'nd ' + id, created_at: new Date(Date.UTC(2026, 0, 1) + seqN * 1000).toISOString(), updated_at: '',
  author_user_id: 'u-' + (seqN % 3), author_name: 'Tên ' + (seqN % 3), author_avatar_url: null, author_role: 'student', is_mine: false, is_hidden: false,
  tags: [], resources: [], seq: ++seqN, root_seq: rootSeq ?? seqN, post_comment_count: 0, ...over,
})
/** 60 gốc; gốc i%4==0 có trả lời a, và a có trả lời con b (trả lời một câu trả lời). */
function seed() {
  rows = []; seqN = 0
  for (let i = 1; i <= 60; i++) {
    const r = mk(uid(i), null, null); rows.push(r)
    if (i % 4 === 0) { const a = mk(uid(1000 + i), r.id, r.seq as number); rows.push(a); rows.push(mk(uid(2000 + i), a.id, r.seq as number)) }
  }
}
const subtree = (id: string): Set<string> => { const g = new Set([id]); for (let c = true; c;) { c = false; for (const r of rows) if (r.parent_comment_id && g.has(r.parent_comment_id) && !g.has(r.id)) { g.add(r.id); c = true } } return g }
const pageOf = (before: number | null, limit: number): CommentRow[] => {
  calls.push({ before, limit })
  const roots = rows.filter(r => r.parent_comment_id === null && (before === null || (r.seq as number) < before)).sort((a, b) => (b.seq as number) - (a.seq as number)).slice(0, limit)
  const set = new Set(roots.map(r => r.seq as number))
  const lo = Math.min(...roots.map(r => r.seq as number))
  const older = rows.filter(r => r.parent_comment_id === null && (r.seq as number) < lo).length
  return rows.filter(r => set.has(r.root_seq as number)).sort((a, b) => (a.seq as number) - (b.seq as number)).map(r => ({ ...r, older_roots: older, post_comment_count: rows.length }))
}
function installApi() {
  __setCommentsApiLoader((async () => ({
    fetchComments: async (_ids: string[], per: number) => {
      const { groupByPost, totalsByPost } = await import('../../src/class-social/comments/commentModel')
      const sel = rows.slice(-per)
      return { ok: true, value: { byPost: groupByPost(sel.map(r => ({ ...r, post_comment_count: rows.length }))), totals: totalsByPost(sel.map(r => ({ ...r, post_comment_count: rows.length }))) } }
    },
    fetchCommentsPage: async (_p: string, before: number | null, limit: number) => {
      if (failPage > 0) { failPage--; return { ok: false, message: 'Chưa tải được bình luận cũ hơn.' } }
      const out = pageOf(before, limit)
      return { ok: true, value: { items: out.map(toComment) as Comment[], total: rows.length, hasMore: (out[0]?.older_roots ?? 0) > 0 } }
    },
    deleteComment: async (id: string) => { const g = subtree(id); deleted.push(...g); rows = rows.filter(r => !g.has(r.id)); return { ok: true, value: null } },   // DB: on delete cascade
    moderate: async () => ({ ok: true, value: null }),
    addComment: async (i: { parentId?: string | null; body: string }) => {
      adds.push({ parentId: i.parentId ?? null, body: i.body })
      const parent = rows.find(r => r.id === i.parentId)
      const row = mk('new-' + (seqN + 1), parent?.id ?? null, parent ? (parent.root_seq as number) : null, { body: i.body, is_mine: true, author_user_id: 'u-me', author_name: 'Tôi' })
      rows.push(row); return { ok: true, value: { id: row.id } }
    },
  })) as never)
}
beforeEach(() => {
  seed(); calls = []; deleted = []; adds = []; failPage = 0
  for (const u of ['u-0', 'u-1', 'u-2', 'u-me']) __seedIdentity(u, buildIdentities([], '2026-11-06'))
  installApi()
  ;(window as unknown as { confirm: () => boolean }).confirm = () => { throw new Error('không dùng window.confirm') }
})
afterEach(() => { cleanup(); __setCommentsApiLoader(null) })

function Harness() {
  const { comments, refresh, refreshThread, expand, loadOlder, drop } = useFeedComments([P])
  return <CommentsSection postId={P} total={rows.length} state={comments[P]} me={me} now={new Date('2026-11-02T00:00:00Z')}
    onRefresh={refresh} onExpand={expand} onLoadOlder={loadOlder} onDrop={drop} onRefreshThread={refreshThread} />
}
const ids = (r: ReturnType<typeof render>) => Array.from(r.container.querySelectorAll('[data-comment-id]')).map(e => e.getAttribute('data-comment-id')!)
const at = (r: ReturnType<typeof render>, id: string) => r.container.querySelector(`[data-comment-id="${id}"]`) as HTMLElement | null
async function loadAll(r: ReturnType<typeof render>) {
  for (let i = 0; i < 12 && r.container.querySelector('.cs-cmts-more'); i++) {
    fireEvent.click(r.container.querySelector('.cs-cmts-more')!)
    await waitFor(() => assert.ok(!(r.container.querySelector('.cs-cmts-more') as HTMLButtonElement | null)?.disabled))
  }
}
const cap = (id: string) => (e: HTMLElement | null) => e!.querySelector(id)
void cap

test('I1 (hook): nạp riêng cây của gốc nằm DƯỚI con trỏ không làm "cũ hơn" nhảy qua các gốc ở giữa', async () => {
  const h = renderHook(() => useFeedComments([P]))
  await waitFor(() => assert.equal(h.result.current.comments[P]?.items.length, 3))
  await act(async () => { await h.result.current.loadOlder(P) })             // trang đầu: 20 gốc mới nhất
  const rootOf3 = rows.find(r => r.id === uid(3))!
  await act(async () => { await h.result.current.refreshThread(P, rootOf3.seq as number) })   // gốc #3 (rất cũ) được nạp riêng
  assert.ok(h.result.current.comments[P].items.some(c => c.id === uid(3)))
  for (let i = 0; i < 6 && h.result.current.comments[P].hasMore; i++) await act(async () => { await h.result.current.loadOlder(P) })
  const got = h.result.current.comments[P].items.map(c => c.id)
  assert.equal(new Set(got).size, got.length, 'không trùng')
  assert.deepEqual([...got].sort(), rows.map(r => r.id).sort(), 'không mất gốc nào ở giữa')
})

test('I2 (Social): trả lời một CÂU TRẢ LỜI của gốc nằm ngoài trang mới nhất → nằm đúng dưới gốc đó, gửi p_parent_id đúng, nạp cây riêng, không kéo cả 200', async () => {
  const r = render(<Harness />)
  await waitFor(() => assert.equal(ids(r).length, 3))
  await loadAll(r)
  const reply = uid(1000 + 8), root8 = uid(8)
  assert.ok(at(r, reply), 'câu trả lời của gốc #8 có mặt (cũ, ngoài trang mới nhất)')
  const before = calls.length
  fireEvent.click(at(r, reply)!.querySelector('.cs-cmt-reply')!)
  const ta = r.container.querySelector(`#cs-reply-input-${reply}`) as HTMLTextAreaElement
  assert.ok(ta)
  fireEvent.change(ta, { target: { value: 'trả lời của tôi' } })
  fireEvent.click(ta.closest('form')!.querySelector('.cs-cmt-send')!)
  await waitFor(() => assert.equal(adds.length, 1))
  assert.deepEqual(adds[0], { parentId: reply, body: 'trả lời của tôi' })
  await waitFor(() => assert.ok(r.container.textContent!.includes('trả lời của tôi')))
  const mine = rows.find(x => x.body === 'trả lời của tôi')!
  assert.equal(mine.root_seq, rows.find(x => x.id === root8)!.seq)
  const list = at(r, root8)!                                                // thấy trong CÙNG nhóm với gốc #8, không phải nhóm mồ côi
  assert.ok(list.contains(at(r, mine.id)), 'trả lời mới nằm trong nhóm của gốc')
  assert.ok(calls.slice(before).every(c => c.limit <= 20), 'chỉ tải trang nhỏ, không mở 200')
  assert.ok(calls.slice(before).some(c => c.limit === 1 && c.before === (rows.find(x => x.id === root8)!.seq as number) + 1), 'nạp đúng cây của gốc #8')
  assert.equal(new Set(ids(r)).size, ids(r).length)
})

test('I3 (Social+B+C): xoá gốc có trả lời lồng → hộp cảnh báo cascade chung, không nêu số; xoá xong cả nhánh biến mất, vùng khác nguyên', async () => {
  rows.find(x => x.id === uid(12))!.is_mine = true; rows.find(x => x.id === uid(12))!.author_user_id = 'u-me'
  const r = render(<Harness />)
  await waitFor(() => assert.equal(ids(r).length, 3))
  await loadAll(r)
  const total = ids(r).length
  fireEvent.click(at(r, uid(12))!.querySelector(':scope > .cs-cmt .cs-more-btn')!)
  fireEvent.click((Array.from(r.container.querySelectorAll('[role=menuitem]')) as HTMLElement[]).find(m => /Xoá bình luận/.test(m.textContent!))!)
  const dlg = r.container.querySelector('[role=alertdialog]')!
  assert.match(dlg.textContent!, /cùng mọi trả lời bên dưới \(nếu có\)/); assert.ok(!/\d/.test(dlg.textContent!))
  const nBefore = calls.length
  fireEvent.click(Array.from(dlg.querySelectorAll('button')).find(b => b.textContent === 'Xoá')!)
  await waitFor(() => assert.ok(!at(r, uid(12))))
  assert.deepEqual(new Set(deleted), new Set([uid(12), uid(1012), uid(2012)]), 'DB xoá cascade đúng 3 dòng')
  assert.ok(!at(r, uid(1012)) && !at(r, uid(2012)))
  await waitFor(() => assert.equal(ids(r).length, total - 3))
  assert.equal(calls.slice(nBefore).length, 1, 'chỉ tải lại trang mới nhất')
})

test('I4 (Social): bình luận gốc mới + lỗi tải thêm không mất dữ liệu; Thử lại; sau cùng đủ, không trùng', async () => {
  const r = render(<Harness />)
  await waitFor(() => assert.equal(ids(r).length, 3))
  fireEvent.click(r.container.querySelector('.cs-cmts-more')!)
  await waitFor(() => assert.ok(ids(r).length > 10))
  const shown = ids(r).length
  failPage = 1
  fireEvent.click(r.container.querySelector('.cs-cmts-more')!)
  await waitFor(() => assert.ok(r.container.querySelector('.cs-cmts-error')))
  assert.equal(ids(r).length, shown, 'lỗi không làm mất bình luận đã hiện')
  // gửi bình luận gốc trong lúc đang có lỗi tải thêm
  const ta = r.container.querySelector('#cs-cmt-input-' + P) as HTMLTextAreaElement
  fireEvent.change(ta, { target: { value: 'bình luận mới' } })
  fireEvent.click(ta.closest('form')!.querySelector('.cs-cmt-send')!)
  await waitFor(() => assert.ok(r.container.textContent!.includes('bình luận mới')))
  assert.deepEqual(adds[0], { parentId: null, body: 'bình luận mới' })
  fireEvent.click(r.container.querySelector('.cs-cmts-error button')!)
  await loadAll(r)
  await waitFor(() => assert.ok(r.container.querySelector('.cs-cmts-end')))
  assert.equal(ids(r).length, rows.length); assert.equal(new Set(ids(r)).size, rows.length)
})

// ── Thread / TeamLab ─────────────────────────────────────────────────────────
const TID = 'aaaaaaaa-0000-4000-8000-000000000002'
let trows: TargetCommentRow[] = [], tcalls: { before: number | null; limit: number }[] = [], tadds: { body: string; parent: string | null }[] = [], tdeleted: string[] = []
const tm = (id: string, parent: string | null, rootSeq: number, seq: number, over: Partial<TargetCommentRow> = {}): TargetCommentRow => ({
  id, parent_comment_id: parent, body: 'nd ' + id, created_at: new Date(Date.UTC(2026, 0, 1) + seq * 1000).toISOString(), edited_at: null, author_user_id: 'u-' + (seq % 3),
  author_name: 'Tên ' + (seq % 3), author_avatar_url: null, author_role: null, is_mine: false, is_hidden: false, seq, root_seq: rootSeq, older_roots: 0, total_count: 0, ...over,
})
const tOrig = { ...tapi }
beforeEach(() => {
  trows = Array.from({ length: 50 }, (_, i) => tm(uid(i + 1), null, i + 1, i + 1)); tcalls = []; tadds = []; tdeleted = []
  tapi.page = (async (_k: unknown, _i: unknown, before: number | null, limit: number) => {
    tcalls.push({ before, limit })
    const roots = trows.filter(x => x.parent_comment_id === null && (before === null || (x.seq as number) < before)).sort((a, b) => (b.seq as number) - (a.seq as number)).slice(0, limit)
    const set = new Set(roots.map(x => x.seq as number)), lo = Math.min(...roots.map(x => x.seq as number))
    const older = trows.filter(x => x.parent_comment_id === null && (x.seq as number) < lo).length
    const out = trows.filter(x => set.has(x.root_seq as number)).sort((a, b) => (a.seq as number) - (b.seq as number)).map(x => ({ ...x, older_roots: older, total_count: trows.length }))
    return { ok: true as const, value: { items: out.map(toTargetComment) as never, hasMore: older > 0, total: trows.length } }
  }) as typeof tapi.page
  tapi.add = (async (_k: unknown, _i: unknown, body: string, parent: string | null) => {
    tadds.push({ body, parent })
    const p = trows.find(x => x.id === parent)
    const n = Math.max(...trows.map(x => x.seq as number)) + 1
    const row = tm('t-new-' + n, parent, p ? (p.root_seq as number) : n, n, { body, is_mine: true, author_user_id: 'u-me' })
    trows.push(row); return { ok: true as const, value: row.id }
  }) as typeof tapi.add
  tapi.remove = (async (_k: unknown, id: string) => { const g = new Set([id]); for (const x of trows) if (x.parent_comment_id === id) g.add(x.id); tdeleted.push(...g); trows = trows.filter(x => !g.has(x.id)); return { ok: true as const, value: null } }) as typeof tapi.remove
})
afterEach(() => { Object.assign(tapi, tOrig) })

test('I5 (Thread/TeamLab): trả lời gốc nằm ngoài trang mới nhất → hiện ngay dưới gốc đó (nạp riêng cây), con trỏ không nhảy, xoá gốc đi kèm trả lời', async () => {
  const r = render(<TargetComments kind="learning_thread" id={TID} me={me} />)
  await waitFor(() => assert.ok(at(r, uid(50))))
  for (let i = 0; i < 4 && r.container.querySelector('.cs-cmts-more'); i++) { fireEvent.click(r.container.querySelector('.cs-cmts-more')!); await waitFor(() => assert.ok(!(r.container.querySelector('.cs-cmts-more') as HTMLButtonElement | null)?.disabled)) }
  assert.ok(at(r, uid(3)), 'gốc #3 (rất cũ) đã hiện')
  fireEvent.click(at(r, uid(3))!.querySelector('.cs-cmt-reply')!)
  const ta = r.container.querySelector('#cs-reply-' + uid(3)) as HTMLTextAreaElement
  fireEvent.change(ta, { target: { value: 'trả lời cũ' } })
  fireEvent.click(ta.closest('form')!.querySelector('.cs-cmt-send')!)
  await waitFor(() => assert.equal(tadds.length, 1))
  assert.deepEqual(tadds[0], { body: 'trả lời cũ', parent: uid(3) })
  await waitFor(() => assert.ok(r.container.textContent!.includes('trả lời cũ')))
  assert.ok(tcalls.some(c => c.limit === 1 && c.before === 4), 'nạp đúng cây của gốc #3 (before = root_seq + 1)')
  const all = Array.from(r.container.querySelectorAll('[data-comment-id]')).map(e => e.getAttribute('data-comment-id'))
  assert.equal(new Set(all).size, all.length, 'không trùng')
  assert.equal(all.length, trows.length, 'đủ: mọi gốc + trả lời mới')
  // xoá gốc #3 (có 1 trả lời): hộp nêu 1 trả lời; DB xoá cả hai; giao diện gỡ cả nhánh
  trows.find(x => x.id === uid(3))!.is_mine = true
})
