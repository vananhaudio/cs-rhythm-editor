// Thẻ "Bài mới phát hành" của Band (TeamLab) trên Feed /me. Một publication = một thẻ. Chỉ dữ liệu công khai của
// teamlab_public_song (tên Band, tên bài, ảnh Team, thời điểm, slug) — KHÔNG take/track/người tham gia.
// Khung dùng chung cs-card/cs-post như thẻ Feed khác; nút mở trang nghe công khai /teamlab/song/<slug>.
import { useState } from 'react'
import { relativeTime, type PublicationEntry } from '../posts/postModel'
import { Avatar } from '../ui'

export default function PublicationCard({ entry, now }: { entry: PublicationEntry; now?: Date }) {
  const who = entry.bandName ?? entry.projectName
  const [coverBroken, setCoverBroken] = useState(false)
  const href = `/teamlab/song/${entry.slug}`
  return (
    <article className="cs-card cs-post lt-feed-card cs-pub-card" aria-label={`Bài mới phát hành của ${who}: ${entry.title}`}>
      <header className="cs-post-head">
        <Avatar name={who} url={entry.avatarUrl} size={40} />
        <div className="cs-post-meta">
          <div className="cs-post-line"><span className="cs-post-author">{who}</span></div>
          <div className="cs-post-sub">
            <time className="cs-post-time" dateTime={entry.createdAt}>{relativeTime(entry.createdAt, now)}</time>
          </div>
        </div>
      </header>
      <div className="lt-feed-body">
        <div className="lt-feed-kind">Bài mới phát hành</div>
        <div className="lt-feed-lesson">{entry.title}</div>
        {entry.coverUrl && !coverBroken && (
          <img className="cs-pub-cover" src={entry.coverUrl} alt="" loading="lazy" onError={() => setCoverBroken(true)} />
        )}
        <div className="lt-feed-foot">
          <a className="lt-btn lt-feed-open cs-pub-open" href={href}>Nghe bài</a>
        </div>
      </div>
    </article>
  )
}
