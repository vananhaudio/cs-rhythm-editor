// Khu bình luận dưới một bài: "Xem thêm bình luận" (nếu còn), danh sách CŨ → MỚI, ô bình luận.
import { useState } from 'react'
import type { Comment } from '../../comments/commentModel'
import { loadCommentsApi } from '../../comments/lazyApi'
import type { PostComments } from '../../comments/useFeedComments'
import type { ClassIdentity } from '../../useClassSession'
import CommentComposer from './CommentComposer'
import CommentItem from './CommentItem'

export default function CommentsSection({ postId, total, state, me, now, onRefresh, onExpand }: {
  postId: string
  total: number
  state: PostComments | undefined
  me: ClassIdentity | null
  now?: Date
  onRefresh: (postId: string) => Promise<unknown>
  onExpand: (postId: string) => Promise<unknown>
}) {
  const [actionError, setActionError] = useState<string | null>(null)
  const items = state?.items ?? []
  const hiddenCount = Math.max(0, (state && !state.loading && !state.error ? state.total : total) - items.length)

  const onDelete = async (c: Comment) => {
    if (!window.confirm('Xoá bình luận này?')) return
    const r = await (await loadCommentsApi()).deleteComment(c.id)
    if (!r.ok) { setActionError(r.message); return }
    setActionError(null); await onRefresh(postId)
  }
  const onModerate = async (c: Comment, hidden: boolean) => {
    const r = await (await loadCommentsApi()).moderate('comment', c.id, hidden)
    if (!r.ok) { setActionError(r.message); return }
    setActionError(null); await onRefresh(postId)
  }

  return (
    <section className="cs-cmts" aria-label="Bình luận">
      {hiddenCount > 0 && !state?.expanded && (
        <button type="button" className="cs-link-btn cs-cmts-more" onClick={() => void onExpand(postId)} disabled={state?.loading}>
          {state?.loading ? 'Đang tải…' : `Xem thêm bình luận (${hiddenCount})`}
        </button>
      )}
      {state?.error && <p className="cs-cmts-error" role="alert">{state.error}{' '}
        <button type="button" className="cs-link-btn" onClick={() => void onRefresh(postId)}>Thử lại</button></p>}
      {items.length > 0 && (
        <ul className="cs-cmt-list">
          {items.map(c => (
            <CommentItem key={c.id} c={c} now={now} canModerate={!!me?.isTeacher}
              onDelete={c2 => void onDelete(c2)} onModerate={(c2, h) => void onModerate(c2, h)} />
          ))}
        </ul>
      )}
      {actionError && <p className="cs-cmts-error" role="alert">{actionError}</p>}
      {me && <CommentComposer postId={postId} me={me} onSent={() => onRefresh(postId)} />}
    </section>
  )
}
