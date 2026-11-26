// Thẻ truyện trên Feed /me và trang /me/stories. Chỉ mở trang đọc công khai /story/<slug> (không bản sao nội dung).
// Thích · Bình luận cho truyện sẽ dùng hệ thống chung của Feed ở Lát 3 — chưa có thanh tương tác ở đây.
import { useState } from 'react'
import { BookText } from 'lucide-react'
import { storyHref, type StoryCardData } from './storyModel'

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

export default function StoryCard({ card, variant, returnTo = '/me' }: {
  card: StoryCardData; variant: 'feed' | 'today' | 'list'; returnTo?: '/me' | '/me/stories'
}) {
  const [broken, setBroken] = useState(false)
  const href = storyHref(card.slug, returnTo)
  const kicker = variant === 'today' ? 'Câu chuyện hôm nay' : variant === 'feed' ? '1001 Câu Chuyện' : card.storyNumber != null ? `Câu chuyện số ${card.storyNumber}` : null
  return (
    <article className="cs-card cs-story-card" aria-label={`Câu chuyện: ${card.title}`}>
      <a className="cs-story-link" href={href}>
        {card.coverUrl && !broken && <img className="cs-story-cover" src={card.coverUrl} alt="" loading="lazy" onError={() => setBroken(true)} />}
        <div className="cs-story-body">
          {kicker && <div className="cs-story-kicker"><BookText size={14} aria-hidden="true" />{kicker}</div>}
          <h3 className="cs-story-title">{card.title}</h3>
          {card.excerpt && <p className="cs-story-excerpt">{card.excerpt}</p>}
          <div className="cs-story-meta">
            <span className="cs-story-by">{card.authorName}{card.publishedAt ? ` · ${fmtDate(card.publishedAt)}` : ''}</span>
            <span className="cs-story-more">Đọc tiếp</span>
          </div>
        </div>
      </a>
    </article>
  )
}
