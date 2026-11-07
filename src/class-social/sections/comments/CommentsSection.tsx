// Khu bình luận dưới một bài: "Xem thêm bình luận" (nếu còn), danh sách CŨ → MỚI, ô bình luận.
import { useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { useScrollAnchor } from '../../comments/useScrollAnchor'
import { COMMENTS_PREVIEW, buildThreads, descendantCount, visibleWithContext, type Comment, type Thread } from '../../comments/commentModel'
import { loadCommentsApi } from '../../comments/lazyApi'
import type { PostComments } from '../../comments/useFeedComments'
import type { ClassIdentity } from '../../useClassSession'
import CommentComposer from './CommentComposer'
import CommentItem from './CommentItem'
import DeleteCommentConfirm from './DeleteCommentConfirm'

const COMMENTS_BATCH = 10   // mỗi lần "Xem thêm bình luận" mở thêm tối đa 10

export default function CommentsSection({ postId, total, state, me, now, onRefresh, onExpand, onLoadOlder, onDrop, onRefreshThread, onOpenProfile }: {
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
  /** Sau khi gửi trả lời: nạp lại ĐÚNG cây của bình luận gốc đó (gốc có thể rất cũ, ngoài trang mới nhất). */
  onRefreshThread?: (postId: string, rootSeq: number | null) => Promise<unknown>
  onOpenProfile?: (userId: string) => void
}) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [limit, setLimit] = useState(COMMENTS_PREVIEW)   // số bình luận mới nhất đang hiện; "Xem thêm" mở thêm từng đợt
  const all = state?.items ?? []
  const items = visibleWithContext(all, limit)   // C: + bình luận gốc đã tải của các trả lời đang hiện
  const threads = buildThreads(items)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const paged = !!state?.paged || !!onLoadOlder   // có hàm tải trang → chế độ phân trang (tự lùi về cách cũ nếu máy chủ chưa hỗ trợ)
  const serverTotal = state && !state.loading && !state.error ? state.total : total
  // Còn trên máy chủ? Đã vào chế độ phân trang → theo hasMore; chưa → ước từ tổng số
  const moreOnServer = state?.paged ? state.hasMore === true : !state?.expanded && serverTotal > all.length
  const localHidden = Math.max(0, all.length - items.length)
  const knownTotal = moreOnServer ? serverTotal : all.length
  const hiddenCount = state?.paged ? localHidden : Math.max(0, knownTotal - items.length)
  const showMore = hiddenCount > 0 || moreOnServer
  const listRef = useRef<HTMLElement>(null)
  useScrollAnchor(listRef, [state?.items, items.length])   // D: đọc dở không bị nhảy khi danh sách đổi (tải thêm / sửa / xoá / gửi)
  const more = async () => {
    if (localHidden > 0) { setLimit(l => l + COMMENTS_BATCH); return }   // còn bình luận đã tải nhưng chưa hiện → mở thêm, chưa cần gọi mạng
    if (!moreOnServer) return
    if (onLoadOlder) { const added = await onLoadOlder(postId); setLimit(l => l + COMMENTS_BATCH + added) }
    else { setLimit(l => l + COMMENTS_BATCH); void onExpand(postId) }
  }

  // Xoá: hộp xác nhận chung (B) — nêu số trả lời bị xoá cascade tính từ cây cha–con (C), không từ số đang hiển thị;
  // thất bại giữ hộp mở + báo lý do; thành công: gỡ cục bộ cả nhánh (D) rồi tải lại trang mới nhất.
  const [deleting, setDeleting] = useState<Comment | null>(null)
  const confirmDelete = async (): Promise<string | null> => {
    if (!deleting) return null
    const gone = deleting
    const r = await (await loadCommentsApi()).deleteComment(gone.id)
    if (!r.ok) return r.message
    setActionError(null)
    if (replyTo && (replyTo.id === gone.id || descendantCount(all, gone.id) > 0)) setReplyTo(null)
    onDrop?.(postId, gone.id); await onRefresh(postId); return null
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
      onDelete={c2 => setDeleting(c2)} onModerate={(c2, h) => void onModerate(c2, h)}
      onReply={me ? c2 => setReplyTo(r => (r?.id === c2.id ? null : c2)) : undefined} {...extra}>{kids}</CommentItem>
  )
  const replyBox = (t: Thread) => replyTo && (t.root?.id === replyTo.id || t.replies.some(r => r.c.id === replyTo.id)) && me && (
    <li className="cs-cmt-replybox" key="replybox">
      <CommentComposer postId={postId} me={me} parentId={replyTo.id} replyingTo={replyTo.author.name}
        onCancel={() => setReplyTo(null)}
        onSent={async () => {
          const to = replyTo; setReplyTo(null)
          // Chế độ phân trang: nạp lại đúng cây chứa trả lời mới (kể cả gốc rất cũ) — không kéo cả 200 bình luận.
          if (state?.paged && onRefreshThread) await onRefreshThread(postId, to.rootSeq ?? to.seq)
          else await onExpand(postId)   // cách cũ: tải đủ để thấy cả bình luận gốc của trả lời mới
        }} />
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
      {threads.length > 0 && (
        <ul className="cs-cmt-list">
          {threads.map(t => renderThread(t))}
        </ul>
      )}
      {actionError && <p className="cs-cmts-error" role="alert">{actionError}</p>}
      {deleting && <DeleteCommentConfirm isReply={!!deleting.parentId} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />}
      {me && <CommentComposer postId={postId} me={me} onSent={() => onRefresh(postId)} />}
    </section>
  )
}
