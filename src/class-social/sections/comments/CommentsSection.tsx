// Khu bình luận dưới một bài: "Xem thêm bình luận" (nếu còn), danh sách CŨ → MỚI, ô bình luận.
import { useState } from 'react'
import { COMMENTS_PREVIEW, type Comment } from '../../comments/commentModel'
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
  const [limit, setLimit] = useState(COMMENTS_PREVIEW)   // số bình luận mới nhất đang hiện; "Xem thêm" mở thêm từng đợt
  const all = state?.items ?? []
  const items = all.length > limit ? all.slice(-limit) : all
  const canFetchMore = !state?.expanded && (state && !state.loading && !state.error ? state.total : total) > all.length
  const knownTotal = canFetchMore ? (state && !state.loading && !state.error ? state.total : total) : all.length
  const hiddenCount = Math.max(0, knownTotal - items.length)
  const more = () => {
    setLimit(l => l + COMMENTS_BATCH)
    if (canFetchMore) void onExpand(postId)
  }

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
      {hiddenCount > 0 && (
        <button type="button" className="cs-link-btn cs-cmts-more" onClick={more} disabled={state?.loading}>
          {state?.loading ? 'Đang tải…' : `Xem thêm bình luận (${hiddenCount})`}
        </button>
      )}
      {state?.error && <p className="cs-cmts-error" role="alert">{state.error}{' '}
        <button type="button" className="cs-link-btn" onClick={() => void onRefresh(postId)}>Thử lại</button></p>}
      {items.length > 0 && (
        <ul className="cs-cmt-list">
          {items.map(c => (
            <CommentItem key={c.id} c={c} now={now} canModerate={!!me?.isTeacher} onOpenProfile={onOpenProfile}
              onDelete={c2 => void onDelete(c2)} onModerate={(c2, h) => void onModerate(c2, h)} />
          ))}
        </ul>
      )}
      {actionError && <p className="cs-cmts-error" role="alert">{actionError}</p>}
      {me && <CommentComposer postId={postId} me={me} onSent={() => onRefresh(postId)} />}
    </section>
  )
}
