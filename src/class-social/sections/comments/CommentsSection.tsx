// Khu bình luận dưới một bài: "Xem thêm bình luận" (nếu còn), danh sách CŨ → MỚI, ô bình luận.
import { useState, type ComponentProps, type ReactNode } from 'react'
import { COMMENTS_PREVIEW, buildThreads, descendantCount, visibleWithContext, type Comment, type Thread } from '../../comments/commentModel'
import { loadCommentsApi } from '../../comments/lazyApi'
import type { PostComments } from '../../comments/useFeedComments'
import type { ClassIdentity } from '../../useClassSession'
import CommentComposer from './CommentComposer'
import CommentItem from './CommentItem'

const COMMENTS_BATCH = 10   // mỗi lần "Xem thêm bình luận" mở thêm tối đa 10

export default function CommentsSection({ postId, total, state, me, now, onRefresh, onExpand, onOpenProfile }: {
  postId: string
  total: number
  state: PostComments | undefined
  me: ClassIdentity | null
  now?: Date
  onRefresh: (postId: string) => Promise<unknown>
  onExpand: (postId: string) => Promise<unknown>
  onOpenProfile?: (userId: string) => void
}) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [limit, setLimit] = useState(COMMENTS_PREVIEW)   // số bình luận mới nhất đang hiện; "Xem thêm" mở thêm từng đợt
  const all = state?.items ?? []
  const items = visibleWithContext(all, limit)   // + bình luận gốc đã tải của các trả lời đang hiện
  const threads = buildThreads(items)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const canFetchMore = !state?.expanded && (state && !state.loading && !state.error ? state.total : total) > all.length
  const knownTotal = canFetchMore ? (state && !state.loading && !state.error ? state.total : total) : all.length
  const hiddenCount = Math.max(0, knownTotal - items.length)
  const more = () => {
    setLimit(l => l + COMMENTS_BATCH)
    if (canFetchMore) void onExpand(postId)
  }

  const onDelete = async (c: Comment) => {
    // DB xoá cascade theo parent_comment_id → báo rõ số trả lời sẽ mất cùng.
    const n = descendantCount(all, c.id)
    if (!window.confirm(n > 0 ? `Xoá bình luận này và ${n} trả lời bên dưới? Không thể khôi phục.` : 'Xoá bình luận này?')) return
    const r = await (await loadCommentsApi()).deleteComment(c.id)
    if (!r.ok) { setActionError(r.message); return }
    setActionError(null)
    if (replyTo && (replyTo.id === c.id || descendantCount(all, c.id) > 0)) setReplyTo(null)
    await onRefresh(postId)
  }
  const saveEdit = (c: Comment) => async (body: string): Promise<string | null> => {
    const { supabaseTargetCommentsApi } = await import('../../comments/targetCommentsApi')
    const r = await supabaseTargetCommentsApi.edit('post', c.id, body)
    if (!r.ok) return r.message
    await onRefresh(postId); return null
  }
  const onModerate = async (c: Comment, hidden: boolean) => {
    const r = await (await loadCommentsApi()).moderate('comment', c.id, hidden)
    if (!r.ok) { setActionError(r.message); return }
    setActionError(null); await onRefresh(postId)
  }

  const loaded = new Set(items.map(c => c.id))
  const item = (c: Comment, extra: Partial<ComponentProps<typeof CommentItem>> = {}, kids?: ReactNode) => (
    <CommentItem key={c.id} c={c} now={now} canModerate={!!me?.isTeacher} onOpenProfile={onOpenProfile}
      editing={editing === c.id} onEdit={() => setEditing(c.id)} onEditDone={() => setEditing(null)} saveEdit={saveEdit(c)}
      onDelete={c2 => void onDelete(c2)} onModerate={(c2, h) => void onModerate(c2, h)}
      onReply={me ? c2 => setReplyTo(r => (r?.id === c2.id ? null : c2)) : undefined} {...extra}>{kids}</CommentItem>
  )
  const replyBox = (t: Thread) => replyTo && (t.root?.id === replyTo.id || t.replies.some(r => r.c.id === replyTo.id)) && me && (
    <li className="cs-cmt-replybox" key="replybox">
      <CommentComposer postId={postId} me={me} parentId={replyTo.id} replyingTo={replyTo.author.name}
        onCancel={() => setReplyTo(null)}
        onSent={async () => { setReplyTo(null); await onExpand(postId) }} />   {/* tải đủ để thấy cả bình luận gốc của trả lời mới */}
    </li>
  )
  const renderThread = (t: Thread) => {
    const box = replyBox(t)
    const replies = t.replies.length > 0 || box
      ? (
        <ul className={'cs-cmt-list cs-cmt-replies' + (t.root ? '' : ' is-orphan')}>
          {t.replies.map(r => item(r.c, { isReply: true, replyToName: r.replyTo?.author.name ?? null, orphan: !t.root && !!r.c.parentId && !loaded.has(r.c.parentId) }))}
          {box}
        </ul>
      ) : null
    return t.root
      ? item(t.root, {}, replies)
      : <li key={`o-${t.replies[0].c.id}`} className="cs-cmt-node">{replies}</li>
  }

  return (
    <section className="cs-cmts" aria-label="Bình luận">
      {hiddenCount > 0 && (
        <button type="button" className="cs-link-btn cs-cmts-more" onClick={more} disabled={state?.loading}>
          {state?.loading ? 'Đang tải…' : `Xem thêm bình luận (${hiddenCount})`}
        </button>
      )}
      {state?.error && <p className="cs-cmts-error" role="alert">{state.error}{' '}
        <button type="button" className="cs-link-btn" onClick={() => void onRefresh(postId)}>Thử lại</button></p>}
      {threads.length > 0 && (
        <ul className="cs-cmt-list">
          {threads.map(t => renderThread(t))}
        </ul>
      )}
      {actionError && <p className="cs-cmts-error" role="alert">{actionError}</p>}
      {me && <CommentComposer postId={postId} me={me} onSent={() => onRefresh(postId)} />}
    </section>
  )
}
