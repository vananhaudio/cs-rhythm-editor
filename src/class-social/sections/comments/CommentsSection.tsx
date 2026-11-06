// Khu bình luận dưới một bài: "Xem thêm bình luận" (nếu còn), danh sách CŨ → MỚI, ô bình luận.
import { useRef, useState } from 'react'
import { useScrollAnchor } from '../../comments/useScrollAnchor'
import { COMMENTS_PREVIEW, type Comment } from '../../comments/commentModel'
import { loadCommentsApi } from '../../comments/lazyApi'
import type { PostComments } from '../../comments/useFeedComments'
import type { ClassIdentity } from '../../useClassSession'
import CommentComposer from './CommentComposer'
import CommentItem from './CommentItem'

const COMMENTS_BATCH = 10   // mỗi lần "Xem thêm bình luận" mở thêm tối đa 10

export default function CommentsSection({ postId, total, state, me, now, onRefresh, onExpand, onLoadOlder, onDrop, onOpenProfile }: {
  postId: string
  total: number
  state: PostComments | undefined
  me: ClassIdentity | null
  now?: Date
  onRefresh: (postId: string) => Promise<unknown>
  onExpand: (postId: string) => Promise<unknown>
  /** Lát D: tải thêm một trang bình luận cũ hơn; trả số bình luận mới thêm. Không có → cách cũ (onExpand). */
  onLoadOlder?: (postId: string) => Promise<number>
  /** Sau khi xoá thành công: gỡ cục bộ (bình luận ở vùng cũ không nằm trong trang mới nhất được tải lại). */
  onDrop?: (postId: string, commentId: string) => void
  onOpenProfile?: (userId: string) => void
}) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [limit, setLimit] = useState(COMMENTS_PREVIEW)   // số bình luận mới nhất đang hiện; "Xem thêm" mở thêm từng đợt
  const all = state?.items ?? []
  const items = all.length > limit ? all.slice(-limit) : all
  const paged = !!state?.paged || !!onLoadOlder   // có hàm tải trang → chế độ phân trang (tự lùi về cách cũ nếu máy chủ chưa hỗ trợ)
  const serverTotal = state && !state.loading && !state.error ? state.total : total
  // Còn trên máy chủ? Đã vào chế độ phân trang → theo hasMore; chưa → ước từ tổng số
  const moreOnServer = state?.paged ? state.hasMore === true : !state?.expanded && serverTotal > all.length
  const localHidden = all.length - items.length
  const knownTotal = moreOnServer ? serverTotal : all.length
  const hiddenCount = state?.paged ? localHidden : Math.max(0, knownTotal - items.length)
  const showMore = hiddenCount > 0 || moreOnServer
  const listRef = useRef<HTMLElement>(null)
  useScrollAnchor(listRef, [state?.items, items.length])   // đọc dở không bị nhảy khi danh sách đổi (tải thêm / sửa / xoá / gửi)
  const more = async () => {
    if (localHidden > 0) { setLimit(l => l + COMMENTS_BATCH); return }   // còn bình luận đã tải nhưng chưa hiện → mở thêm, chưa cần gọi mạng
    if (!moreOnServer) return
    if (onLoadOlder) { const added = await onLoadOlder(postId); setLimit(l => l + COMMENTS_BATCH + added) }
    else { setLimit(l => l + COMMENTS_BATCH); void onExpand(postId) }
  }

  const onDelete = async (c: Comment) => {
    if (!window.confirm('Xoá bình luận này?')) return
    const r = await (await loadCommentsApi()).deleteComment(c.id)
    if (!r.ok) { setActionError(r.message); return }
    setActionError(null); onDrop?.(postId, c.id); await onRefresh(postId)
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

  return (
    <section className="cs-cmts" aria-label="Bình luận" ref={listRef}>
      {showMore && (
        <button type="button" className="cs-link-btn cs-cmts-more" onClick={() => void more()} disabled={state?.loading || state?.loadingMore}>
          {state?.loadingMore ? 'Đang tải…' : state?.loading ? 'Đang tải…' : state?.paged || onLoadOlder ? 'Xem bình luận cũ hơn' : `Xem thêm bình luận (${hiddenCount})`}
        </button>
      )}
      {state?.moreError && <p className="cs-cmts-error" role="alert">{state.moreError}{' '}
        <button type="button" className="cs-link-btn" onClick={() => void more()}>Thử lại</button></p>}
      {state?.loadedOlder && !showMore && all.length > COMMENTS_PREVIEW && <p className="cs-cmts-end" role="status">Đã xem hết bình luận</p>}
      {state?.error && <p className="cs-cmts-error" role="alert">{state.error}{' '}
        <button type="button" className="cs-link-btn" onClick={() => void onRefresh(postId)}>Thử lại</button></p>}
      {items.length > 0 && (
        <ul className="cs-cmt-list">
          {items.map(c => (
            <CommentItem key={c.id} c={c} now={now} canModerate={!!me?.isTeacher} onOpenProfile={onOpenProfile}
              editing={editing === c.id} onEdit={() => setEditing(c.id)} onEditDone={() => setEditing(null)} saveEdit={saveEdit(c)}
              onDelete={c2 => void onDelete(c2)} onModerate={(c2, h) => void onModerate(c2, h)} />
          ))}
        </ul>
      )}
      {actionError && <p className="cs-cmts-error" role="alert">{actionError}</p>}
      {me && <CommentComposer postId={postId} me={me} onSent={() => onRefresh(postId)} />}
    </section>
  )
}
