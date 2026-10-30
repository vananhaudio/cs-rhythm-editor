// Thanh Thích dưới một thẻ Feed (Feed Likes V1). Chỉ nút ĐÃ hoạt động: Thích. Bình luận/Chia sẻ thêm ở Lát 2–3.
// Mục tiêu chạm ≥ 44px (iOS HIG), Light Mode, một tay. Không có phiên/không thấy mục → không hiện gì.
import { useEffect } from 'react'
import { ThumbsUp } from 'lucide-react'
import { ensureLike, toggleLike, useLike } from './likeStore'
import { likeLabel, type LikeKind } from './likeModel'

export default function LikeBar({ kind, id }: { kind: LikeKind; id: string }) {
  const v = useLike(kind, id)
  useEffect(() => { ensureLike(kind, id) }, [kind, id])
  if (v.hidden) return null
  const liked = v.state?.liked === true
  const count = v.state?.count ?? 0
  return (
    <div className="cs-likebar" data-kind={kind}>
      {count > 0 && <span className="cs-likebar-count" aria-live="polite">{likeLabel(count)}</span>}
      <div className="cs-likebar-row">
        <button type="button" className={`cs-likebar-btn${liked ? ' is-on' : ''}`} aria-pressed={liked}
          onClick={() => toggleLike(kind, id)}>
          <ThumbsUp size={18} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
          <span>{liked ? 'Đã thích' : 'Thích'}</span>
        </button>
      </div>
      {v.error && <p className="cs-likebar-err" role="alert">{v.error}</p>}
    </div>
  )
}
