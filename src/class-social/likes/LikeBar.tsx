// Thanh Thích dưới một thẻ Feed (Feed Likes V1). Chỉ nút ĐÃ hoạt động: Thích. Bình luận/Chia sẻ thêm ở Lát 2–3.
// Mục tiêu chạm ≥ 44px (iOS HIG), Light Mode, một tay. Không có phiên/không thấy mục → không hiện gì.
import { useEffect } from 'react'
import { MessageCircle, ThumbsUp } from 'lucide-react'
import { ensureLike, toggleLike, useLike } from './likeStore'
import { likeLabel, type LikeKind } from './likeModel'

/** comment: có → hiện nút Bình luận (thực sự hoạt động); không → chỉ Thích. */
export type CommentAction = { count: number; open: boolean; onToggle: () => void }

export default function LikeBar({ kind, id, comment }: { kind: LikeKind; id: string; comment?: CommentAction }) {
  const v = useLike(kind, id)
  useEffect(() => { ensureLike(kind, id) }, [kind, id])
  if (v.hidden) return null
  const liked = v.state?.liked === true
  const count = v.state?.count ?? 0
  return (
    <div className="cs-likebar" data-kind={kind}>
      {(count > 0 || (comment && comment.count > 0)) && (
        <span className="cs-likebar-count" aria-live="polite">
          {likeLabel(count)}{count > 0 && comment && comment.count > 0 ? ' · ' : ''}{comment && comment.count > 0 ? `${comment.count} bình luận` : ''}
        </span>
      )}
      <div className="cs-likebar-row">
        <button type="button" className={`cs-likebar-btn${liked ? ' is-on' : ''}`} aria-pressed={liked}
          onClick={() => toggleLike(kind, id)}>
          <ThumbsUp size={18} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
          <span>{liked ? 'Đã thích' : 'Thích'}</span>
        </button>
        {comment && (
          <button type="button" className={`cs-likebar-btn${comment.open ? ' is-on' : ''}`} aria-expanded={comment.open} onClick={comment.onToggle}>
            <MessageCircle size={18} aria-hidden="true" />
            <span>Bình luận</span>
          </button>
        )}
      </div>
      {v.error && <p className="cs-likebar-err" role="alert">{v.error}</p>}
    </div>
  )
}
