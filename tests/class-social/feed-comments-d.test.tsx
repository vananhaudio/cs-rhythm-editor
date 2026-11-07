// Feed Comments Lát D — tải thêm theo trang (con trỏ theo gốc), không trùng/mất, >200 bình luận, giữ vị trí đọc, lỗi mạng, đồng thời.
import './composer-dom-setup'
import { test, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import React from 'react'
import { render, renderHook, act, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { mergeById, replaceHead, minRootSeq, dropWithDescendants, isMissingRpc, PAGE_ROOTS, type SeqItem } from '../../src/class-social/comments/paging'
import { toComment, COMMENTS_PREVIEW, groupByPost, totalsByPost, type CommentRow, type Comment } from '../../src/class-social/comments/commentModel'
import { useFeedComments } from '../../src/class-social/comments/useFeedComments'
import { __setCommentsApiLoader } from '../../src/class-social/comments/lazyApi'
import CommentsSection from '../../src/class-social/sections/comments/CommentsSection'
import TargetComments from '../../src/class-social/sections/comments/TargetComments'
import { supabaseTargetCommentsApi as tapi } from '../../src/class-social/comments/targetCommentsApi'
import { toTargetComment, buildThreadFromComments, type TargetCommentRow } from '../../src/class-social/comments/targetCommentModel'
import { applyAnchor } from '../../src/class-social/comments/useScrollAnchor'
import { buildIdentities } from '../../src/class-social/identity/learningIdentity'
import { __seedIdentity } from '../../src/class-social/identity/identityStore'
void React

const P = 'pppppppp-0000-4000-8000-000000000001'
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// ── "Máy chủ" giả: N gốc, cứ gốc thứ 4 có 2 trả lời (một lồng) — mô phỏng đúng ngữ nghĩa class_comments_page_safe ─────────
type Srv = { rows: CommentRow[]; calls: { before: number | null; limit: number }[] }
function makeServer(roots: number): Srv {
  const rows: CommentRow[] = []; let seq = 0
  const mk = (id: string, parent: string | null, rootSeq: number): CommentRow => ({
    id, post_id: P, parent_comment_id: parent, body: 'nd ' + id, created_at: new Date(Date.UTC(2026, 0, 1) + seq * 1000).toISOString(), updated_at: '',
    author_user_id: 'u-' + (seq % 3), author_name: 'Tên ' + (seq % 3), author_avatar_url: null, author_role: 'student', is_mine: false, is_hidden: false,
    tags: [], resources: [], seq: ++seq, root_seq: rootSeq, post_comment_count: 0,
  })
  for (let i = 1; i <= roots; i++) {
    const r = mk(uid(i), null, seq + 1); rows.push(r)
    if (i % 4 === 0) { const a = mk(uid(100000 + i), r.id, r.seq as number); rows.push(a); rows.push(mk(uid(200000 + i), a.id, r.seq as number)) }
  }
  for (const r of rows) r.post_comment_count = rows.length
  return { rows, calls: [] }
}
const pageOf = (srv: Srv, before: number | null, limit: number): CommentRow[] => {
  srv.calls.push({ before, limit })
  const rootRows = srv.rows.filter(r => r.parent_comment_id === null && (before === null || (r.seq as number) < before)).sort((a, b) => (b.seq as number) - (a.seq as number)).slice(0, limit)
  const set = new Set(rootRows.map(r => r.seq as number))
  const minSeq = Math.min(...rootRows.map(r => r.seq as number))
  const older = srv.rows.filter(r => r.parent_comment_id === null && (r.seq as number) < minSeq).length
  return srv.rows.filter(r => set.has(r.root_seq as number)).sort((a, b) => (a.seq as number) - (b.seq as number)).map(r => ({ ...r, older_roots: older }))
}

let srv: Srv, failNext = 0, legacyOnly = false, latency = 0, fetchPageCalls = 0, expandCalls = 0, deleted: string[] = []
const wait = () => new Promise(r => setTimeout(r, latency))
function installApi() {
  __setCommentsApiLoader((async () => ({
    fetchComments: async (_ids: string[], per: number) => {
      if (per > 3) expandCalls++
      const roots = srv.rows.slice(-per)
      return { ok: true, value: { byPost: groupByPost(roots), totals: totalsByPost(roots) } }
    },
    fetchCommentsPage: async (_p: string, before: number | null, limit: number) => {
      fetchPageCalls++; await wait()
      if (legacyOnly) return { ok: false, message: 'x', unsupported: true }
      if (failNext > 0) { failNext--; return { ok: false, message: 'Chưa tải được bình luận cũ hơn.' } }
      const rows = pageOf(srv, before, limit)
      return { ok: true, value: { items: rows.map(toComment) as Comment[], total: rows[0]?.post_comment_count ?? 0, hasMore: (rows[0]?.older_roots ?? 0) > 0 } }
    },
    deleteComment: async (id: string) => { deleted.push(id); return { ok: true, value: null } },
    moderate: async () => ({ ok: true, value: null }), addComment: async () => ({ ok: true, value: { id: 'n' } }),
  })) as never)
}
beforeEach(() => {
  srv = makeServer(5); failNext = 0; legacyOnly = false; latency = 0; fetchPageCalls = 0; expandCalls = 0; deleted = []
  for (let i = 0; i < 3; i++) __seedIdentity('u-' + i, buildIdentities([], '2026-11-06'))
  __seedIdentity('u-me', buildIdentities([], '2026-11-06'))
  installApi()
  ;(window as unknown as { confirm: () => boolean }).confirm = () => true
})
afterEach(() => { cleanup(); __setCommentsApiLoader(null) })

const it_ = (id: string, seq: number | null, rootSeq: number | null, parentId: string | null = null, createdAt = '2026-01-01T00:00:00Z'): SeqItem & { parentId: string | null } => ({ id, seq, rootSeq, parentId, createdAt })

// ── Mô hình thuần ────────────────────────────────────────────────────────────
test('D1: gộp theo id — không trùng, không mất, thứ tự cũ → mới', () => {
  const a = [it_('1', 1, 1, null, '2026-01-01T00:00:01Z'), it_('2', 2, 2, null, '2026-01-01T00:00:02Z')]
  const b = [it_('2', 2, 2, null, '2026-01-01T00:00:02Z'), it_('0', 0, 0, null, '2026-01-01T00:00:00Z')]
  assert.deepEqual(mergeById(a, b).map(x => x.id), ['0', '1', '2'])
  assert.deepEqual(mergeById(mergeById(a, b), b).map(x => x.id), ['0', '1', '2'])   // gộp lại lần nữa: bất biến
})

test('D1: tải lại trang mới nhất giữ trang cũ, và bình luận đã xoá ở vùng mới biến mất đúng', () => {
  const old = [it_('o1', 1, 1), it_('o2', 2, 2)]
  const head0 = [it_('h1', 10, 10), it_('h2', 11, 11), it_('h2r', 12, 11, 'h2')]
  const head1 = [it_('h1', 10, 10), it_('h2r2', 13, 11, 'h2')]          // h2 và h2r đã xoá, có trả lời mới
  const cur = mergeById(old, head0)
  const next = replaceHead(cur, head1, true)
  assert.deepEqual(next.map(x => x.id).sort(), ['h1', 'h2r2', 'o1', 'o2'])
  assert.deepEqual(replaceHead(cur, head1, false).map(x => x.id).sort(), ['h1', 'h2r2'])   // hết trang cũ → thay hẳn
  assert.equal(minRootSeq(next), 1)
})

test('D2/D4: gỡ cục bộ gốc kéo theo mọi hậu duệ; isMissingRpc nhận ra hàm chưa cài', () => {
  const items = [it_('a', 1, 1), it_('a1', 2, 1, 'a'), it_('a2', 3, 1, 'a1'), it_('b', 4, 4)]
  assert.deepEqual(dropWithDescendants(items, 'a').map(x => x.id), ['b'])
  assert.deepEqual(dropWithDescendants(items, 'a1').map(x => x.id), ['a', 'b'])
  assert.ok(isMissingRpc({ code: 'PGRST202' }) && isMissingRpc({ code: '42883' }) && isMissingRpc({ message: 'Could not find the function public.x' }) && isMissingRpc({}, 404))
  assert.ok(!isMissingRpc({ code: '42501' }) && !isMissingRpc(null))
})

test('D1/D4: bài > 200 bình luận (600 gốc + trả lời) — duyệt hết các trang: đủ, không trùng, mỗi trả lời kèm gốc, đúng số lượt gọi', () => {
  const big = makeServer(600)                                  // 600 gốc + 150 nhóm × 2 = 900 bình luận
  let before: number | null = null, got: Comment[] = [], pages = 0
  for (;;) {
    const rows = pageOf(big, before, PAGE_ROOTS); pages++
    const items = rows.map(toComment) as Comment[]
    got = mergeById(got, items)
    before = minRootSeq(got)
    if (!(rows[0].older_roots! > 0)) break
    assert.ok(pages < 100, 'không vòng lặp vô hạn')
  }
  assert.equal(got.length, 900)
  assert.equal(new Set(got.map(c => c.id)).size, 900)
  assert.equal(pages, 30)                                      // 600 / 20 — không tăng theo số bình luận
  const ids = new Set(got.map(c => c.id))
  assert.ok(got.every(c => !c.parentId || ids.has(c.parentId)), 'trả lời không bị tách khỏi cha')
})

// ── Hook Social ──────────────────────────────────────────────────────────────
const mountHook = async () => {
  const h = renderHook(() => useFeedComments([P]))
  await waitFor(() => assert.equal(h.result.current.comments[P]?.items.length, COMMENTS_PREVIEW))
  return h
}

test('D1: loadOlder từng đợt — không trùng, không mất, con trỏ lùi dần, hasMore đúng, trả số mới thêm', async () => {
  srv = makeServer(45)
  const h = await mountHook()
  let added = 0
  await act(async () => { added = await h.result.current.loadOlder(P) })
  let s = h.result.current.comments[P]
  assert.ok(added >= 20 && s.paged && s.loadedOlder && s.hasMore === true)
  assert.equal(new Set(s.items.map(c => c.id)).size, s.items.length)
  const c1 = s.cursor!
  await act(async () => { await h.result.current.loadOlder(P) })
  s = h.result.current.comments[P]
  assert.ok(s.cursor! < c1 && s.hasMore === true)
  await act(async () => { await h.result.current.loadOlder(P) })
  s = h.result.current.comments[P]
  assert.equal(s.hasMore, false)
  assert.equal(s.items.length, srv.rows.length)                // mọi bình luận, đúng một lần
  assert.equal(new Set(s.items.map(c => c.id)).size, srv.rows.length)
  assert.deepEqual(srv.calls.map(c => c.before === null), [true, false, false])
})

test('D3/D4: bấm đúp "cũ hơn" chỉ gọi một lần; làm mới đồng thời không mất dữ liệu', async () => {
  srv = makeServer(45); latency = 30
  const h = await mountHook()
  await act(async () => { await Promise.all([h.result.current.loadOlder(P), h.result.current.loadOlder(P)]) })
  assert.equal(fetchPageCalls, 1)
  const idsBefore = h.result.current.comments[P].items.map(c => c.id)
  await act(async () => { await Promise.all([h.result.current.loadOlder(P), h.result.current.refresh(P)]) })   // gửi bình luận trong lúc tải thêm
  const after = h.result.current.comments[P]
  for (const id of idsBefore) assert.ok(after.items.some(c => c.id === id), 'không mất ' + id)
  assert.equal(new Set(after.items.map(c => c.id)).size, after.items.length)
})

test('D3: lỗi mạng khi tải thêm — giữ nguyên dữ liệu đã hiện, báo lỗi, thử lại thành công', async () => {
  srv = makeServer(45)
  const h = await mountHook()
  await act(async () => { await h.result.current.loadOlder(P) })
  const n = h.result.current.comments[P].items.length
  failNext = 1
  let added = -1
  await act(async () => { added = await h.result.current.loadOlder(P) })
  const s = h.result.current.comments[P]
  assert.equal(added, 0); assert.equal(s.items.length, n); assert.match(s.moreError!, /cũ hơn/); assert.equal(s.loadingMore, false)
  await act(async () => { await h.result.current.loadOlder(P) })
  const s2 = h.result.current.comments[P]
  assert.ok(s2.items.length > n && s2.moreError === null)
})

test('D1/D2: tải lại sau gửi/xoá chỉ lấy trang mới nhất, GIỮ các trang cũ đã mở; xoá cục bộ vùng cũ', async () => {
  srv = makeServer(45)
  const h = await mountHook()
  await act(async () => { await h.result.current.loadOlder(P); await h.result.current.loadOlder(P) })
  const total = h.result.current.comments[P].items.length
  const calls = fetchPageCalls
  srv.rows.push({ ...srv.rows[0], id: 'new-1', parent_comment_id: null, seq: 9999, root_seq: 9999, created_at: '2027-01-01T00:00:00Z', body: 'mới' })   // bình luận mới
  await act(async () => { await h.result.current.refresh(P) })
  assert.equal(fetchPageCalls, calls + 1)                       // một trang, không tải lại toàn bộ
  const s = h.result.current.comments[P]
  assert.equal(s.items.length, total + 1)
  assert.ok(s.items.some(c => c.id === 'new-1'))
  const oldest = s.items[0].id
  act(() => h.result.current.drop(P, oldest))
  assert.ok(!h.result.current.comments[P].items.some(c => c.id === oldest))
})

test('D4: máy chủ chưa có hàm phân trang → lùi về cách cũ (mở tối đa 200), vẫn dùng được', async () => {
  srv = makeServer(10); legacyOnly = true
  const h = await mountHook()
  await act(async () => { await h.result.current.loadOlder(P) })
  assert.equal(expandCalls, 1)
  await act(async () => { await h.result.current.loadOlder(P) })   // lần sau đi thẳng đường cũ, không gọi lại hàm vắng
  assert.equal(fetchPageCalls, 1)
})

// ── Giao diện Social ─────────────────────────────────────────────────────────
const me = { role: 'student', userId: 'u-me', studentId: 's', name: 'Tôi', email: null, avatarUrl: null, level: null, enrolledAt: null, htMember: false, isTeacher: false, coverUrl: null } as never
function Harness({ onDropSpy }: { onDropSpy?: (id: string) => void }) {
  const { comments, refresh, expand, loadOlder, drop } = useFeedComments([P])
  return <CommentsSection postId={P} total={srv.rows.length} state={comments[P]} me={me} now={new Date('2026-11-02T00:00:00Z')}
    onRefresh={refresh} onExpand={expand} onLoadOlder={loadOlder} onDrop={(p, id) => { onDropSpy?.(id); drop(p, id) }} />
}
const count = (r: ReturnType<typeof render>) => r.container.querySelectorAll('[data-comment-id]').length

test('D1/D3 UI: nút "Xem bình luận cũ hơn" tải từng đợt; hết → "Đã xem hết bình luận"; lỗi → báo + Thử lại, giữ dữ liệu', async () => {
  srv = makeServer(30)
  const r = render(<Harness />)
  await waitFor(() => assert.equal(count(r), COMMENTS_PREVIEW))
  const btn = () => r.container.querySelector('.cs-cmts-more') as HTMLButtonElement
  assert.match(btn().textContent!, /Xem bình luận cũ hơn/)
  failNext = 1
  fireEvent.click(btn())
  await waitFor(() => assert.ok(r.container.querySelector('.cs-cmts-error')))
  assert.equal(count(r), COMMENTS_PREVIEW)                                 // lỗi không làm mất dữ liệu
  assert.match(r.container.querySelector('.cs-cmts-error')!.textContent!, /cũ hơn/)
  fireEvent.click(r.container.querySelector('.cs-cmts-error button')!)      // Thử lại
  await waitFor(() => assert.ok(count(r) > 20))
  assert.ok(!r.container.querySelector('.cs-cmts-error'))
  for (let i = 0; i < 5 && r.container.querySelector('.cs-cmts-more'); i++) { fireEvent.click(btn()); await waitFor(() => assert.ok(!btn()?.disabled)) }
  await waitFor(() => assert.ok(r.container.querySelector('.cs-cmts-end')))
  assert.equal(count(r), srv.rows.length)                                   // đủ, mỗi bình luận đúng một lần
  assert.ok(!r.container.querySelector('.cs-cmts-more'))
})

test('D2 UI: tải thêm đặt bình luận cũ hơn LÊN TRÊN nhưng bình luận đang đọc giữ nguyên vị trí (bù cuộn)', async () => {
  srv = makeServer(30)
  // jsdom không có layout: mô phỏng — mỗi bình luận cao 100px, đặt theo thứ tự DOM; khung nhìn cuộn theo window.scrollY
  let scrollY = 0
  const rectOf = function (this: Element) {
    const all = Array.from(document.querySelectorAll('[data-comment-id]'))
    const i = all.indexOf(this)
    const top = i * 100 + 40 - scrollY
    return { top, bottom: top + 100, left: 0, right: 300, width: 300, height: 100, x: 0, y: top, toJSON() {} } as DOMRect
  }
  const proto = window.HTMLElement.prototype as unknown as { getBoundingClientRect: () => DOMRect }
  const origRect = proto.getBoundingClientRect, origScrollBy = window.scrollBy
  proto.getBoundingClientRect = rectOf
  window.scrollBy = ((_x: number, y: number) => { scrollY += y }) as typeof window.scrollBy
  try {
    const r = render(<Harness />)
    await waitFor(() => assert.equal(count(r), COMMENTS_PREVIEW))
    const firstId = r.container.querySelector('[data-comment-id]')!.getAttribute('data-comment-id')!
    const topBefore = (r.container.querySelector(`[data-comment-id="${firstId}"]`) as HTMLElement).getBoundingClientRect().top
    fireEvent.click(r.container.querySelector('.cs-cmts-more')!)
    await waitFor(() => assert.ok(count(r) > 10))
    const el = r.container.querySelector(`[data-comment-id="${firstId}"]`) as HTMLElement
    assert.equal(el.getBoundingClientRect().top, topBefore, 'bình luận đang đọc không bị đẩy xuống')
    assert.ok(scrollY > 0, 'đã bù cuộn')
  } finally { proto.getBoundingClientRect = origRect; window.scrollBy = origScrollBy }
})

test('D2: không bù khi không lệch (không tự cuộn); phần tử đã gỡ khỏi DOM thì bỏ qua', () => {
  let calls = 0; const orig = window.scrollBy; window.scrollBy = (() => { calls++ }) as typeof window.scrollBy
  const el = document.createElement('div'); document.body.appendChild(el)
  el.getBoundingClientRect = () => ({ top: 50 } as DOMRect)
  applyAnchor({ el, top: 50, sc: null }); assert.equal(calls, 0)
  applyAnchor({ el, top: 20, sc: null }); assert.equal(calls, 1)
  el.remove(); applyAnchor({ el, top: 0, sc: null }); assert.equal(calls, 1)
  window.scrollBy = orig
})

test('D2: xoá bình luận ở vùng cũ (đã tải thêm) biến mất ngay; chỉ tải lại trang mới nhất, các trang cũ còn nguyên', async () => {
  srv = makeServer(30)
  const target = srv.rows[2]; target.is_mine = true; target.author_user_id = 'u-me'    // một gốc cũ của tôi
  const r = render(<Harness />)
  await waitFor(() => assert.equal(count(r), COMMENTS_PREVIEW))
  fireEvent.click(r.container.querySelector('.cs-cmts-more')!)
  await waitFor(() => assert.ok(count(r) > 10))
  for (let i = 0; i < 4 && !r.container.querySelector(`[data-comment-id="${target.id}"]`); i++) {
    fireEvent.click(r.container.querySelector('.cs-cmts-more')!); await waitFor(() => assert.ok(!(r.container.querySelector('.cs-cmts-more') as HTMLButtonElement | null)?.disabled))
  }
  const li = r.container.querySelector(`[data-comment-id="${target.id}"]`)!
  assert.ok(li)
  const total = count(r), calls = fetchPageCalls
  fireEvent.click(li.querySelector('.cs-more-btn')!)
  fireEvent.click(Array.from(r.container.querySelectorAll('[role="menuitem"]')).find(m => /Xoá bình luận/.test(m.textContent!)) as HTMLElement)
  fireEvent.click(Array.from(r.container.querySelector('[role=alertdialog]')!.querySelectorAll('button')).find(b => b.textContent === 'Xoá') as HTMLElement)   // hộp xác nhận chung (B)
  await waitFor(() => assert.ok(!r.container.querySelector(`[data-comment-id="${target.id}"]`)))
  assert.deepEqual(deleted, [target.id])
  await waitFor(() => assert.equal(fetchPageCalls, calls + 1))              // một trang mới nhất, không tải lại cả danh sách
  assert.ok(count(r) >= total - 1 - 2 && count(r) < total)                  // chỉ mất bình luận đã xoá (và trả lời của nó nếu có)
})

// ── Thread / TeamLab ─────────────────────────────────────────────────────────
const TID = 'aaaaaaaa-0000-4000-8000-000000000001'
const trow = (n: number, parent: string | null, rootSeq: number, older: number, over: Partial<TargetCommentRow> = {}): TargetCommentRow => ({
  id: uid(n), parent_comment_id: parent, body: 'nd ' + n, created_at: new Date(Date.UTC(2026, 0, 1) + n * 1000).toISOString(), edited_at: null, author_user_id: 'u-' + (n % 3),
  author_name: 'Tên ' + (n % 3), author_avatar_url: null, author_role: null, is_mine: false, is_hidden: false, seq: n, root_seq: rootSeq, older_roots: older, total_count: 60, ...over,
})
// 60 gốc (seq 1..60); gốc 55 có 1 trả lời (seq 1000)
const tpage = (before: number | null, limit: number): TargetCommentRow[] => {
  const roots = Array.from({ length: 60 }, (_, i) => i + 1).filter(n => before === null || n < before).sort((a, b) => b - a).slice(0, limit)
  const lo = Math.min(...roots), older = lo - 1
  return [...roots.sort((a, b) => a - b).flatMap(n => [trow(n, null, n, older), ...(n === 55 ? [trow(1000, uid(55), 55, older)] : [])])].sort((a, b) => (a.seq as number) - (b.seq as number))
}
let tcalls: (number | null)[] = [], tfail = 0, tlegacy = false
const origT = { ...tapi }
beforeEach(() => {
  tcalls = []; tfail = 0; tlegacy = false
  tapi.page = (async (_k: unknown, _i: unknown, before: number | null, limit: number) => {
    tcalls.push(before)
    if (tlegacy) return { ok: false as const, message: '', code: 'UNSUPPORTED' }
    if (tfail > 0 && before !== null) { tfail--; return { ok: false as const, message: 'Chưa tải được bình luận cũ hơn.' } }
    const rows = tpage(before, limit)
    return { ok: true as const, value: { items: rows.map(toTargetComment) as never, hasMore: rows[0].older_roots! > 0, total: 61 } }
  }) as typeof tapi.page
  tapi.list = (async () => ({ ok: true as const, value: buildThreadFromComments(tpage(null, 100).map(toTargetComment) as never) })) as typeof tapi.list
})
afterEach(() => { Object.assign(tapi, origT) })
const tmount = async () => {
  const r = render(<TargetComments kind="learning_thread" id={TID} me={me} />)
  await waitFor(() => assert.ok(r.container.querySelector('[data-comment-id]')))
  return r
}

test('D1 Thread: trang đầu 20 gốc; "cũ hơn" thêm đợt; hết → thông báo; trả lời đi cùng gốc; không trùng', async () => {
  const r = await tmount()
  assert.equal(r.container.querySelectorAll('.cs-cmt-node > .cs-cmt-solo > [data-comment-id]').length, 20)
  assert.ok(r.container.querySelector(`[data-comment-id="${uid(1000)}"]`), 'trả lời của gốc 55 có mặt cùng gốc')
  for (let i = 0; i < 5 && r.container.querySelector('.cs-cmts-more'); i++) { fireEvent.click(r.container.querySelector('.cs-cmts-more')!); await waitFor(() => assert.ok(!(r.container.querySelector('.cs-cmts-more') as HTMLButtonElement | null)?.disabled)) }
  await waitFor(() => assert.ok(r.container.querySelector('.cs-cmts-end')))
  const ids = Array.from(r.container.querySelectorAll('[data-comment-id]')).map(e => e.getAttribute('data-comment-id'))
  assert.equal(ids.length, 61); assert.equal(new Set(ids).size, 61)
  assert.deepEqual(tcalls.map(c => c === null), [true, false, false])   // 60 gốc / 20 = 3 trang, đúng 3 lượt gọi
  assert.ok(!r.container.querySelector('.cs-cmts-more'))
})

test('D3 Thread: lỗi tải thêm giữ dữ liệu, có Thử lại; bấm đúp chỉ một lần gọi', async () => {
  const r = await tmount()
  tfail = 1
  fireEvent.click(r.container.querySelector('.cs-cmts-more')!)
  await waitFor(() => assert.ok(r.container.querySelector('.cs-cmts-error')))
  assert.equal(r.container.querySelectorAll('[data-comment-id]').length, 21)
  const calls = tcalls.length
  const retry = r.container.querySelector('.cs-cmts-error button') as HTMLElement
  fireEvent.click(retry); fireEvent.click(retry)
  await waitFor(() => assert.ok(!r.container.querySelector('.cs-cmts-error')))
  assert.equal(tcalls.length, calls + 1)
})

test('D4 Thread: chưa có hàm phân trang → dùng feed_comment_list như cũ, không nút "cũ hơn"', async () => {
  tlegacy = true
  const r = await tmount()
  assert.ok(!r.container.querySelector('.cs-cmts-more'))
  assert.ok(r.container.querySelectorAll('[data-comment-id]').length >= 20)
})

test('Không đổi kiểm duyệt/phân quyền ở frontend: CommentItem/Row giữ menu; DB mới chỉ thêm hàm đọc, không policy/bảng', () => {
  const sql = fs.readFileSync(new URL('../../db/feed_comments_paging_v1_setup.sql', import.meta.url), 'utf8')
  assert.ok(!/create policy|alter table|drop (function|table)|create table|insert into|update public|delete from/i.test(sql.replace(/--.*$/gm, '')), 'chỉ create or replace function (đọc)')
  assert.equal((sql.match(/create or replace function/g) ?? []).length, 2)
  assert.match(sql, /class_ugc_pair_blocked/)
  assert.match(sql, /revoke all on function public\.feed_comment_page[^;]*from public, anon/)
  const ci = fs.readFileSync(new URL('../../src/class-social/sections/comments/CommentItem.tsx', import.meta.url), 'utf8')
  assert.match(ci, /SafetyMenu/)
})
