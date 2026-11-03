// Thẻ "Ôn nhanh" trên Feed /me (G3). Tham chiếu BUỔI HỌC gốc: không URL YouTube, không video id, không trình phát tại đây —
// bấm "Xem clip" mở trang Buổi (/me/classes/<lớp>/sessions/<số buổi>) nơi khối video phát theo quyền giáo trình của chính người xem.
import { relativeTime, type LessonClipEntry } from '../posts/postModel'
import { sessionPath } from '../resolveMeRoute'
import { Avatar } from '../ui'

export default function LessonClipCard({ entry, now }: { entry: LessonClipEntry; now?: Date }) {
  const href = sessionPath(entry.classId, entry.sessionNo)
  return (
    <article className="cs-card cs-post lt-feed-card cs-pub-card cs-clip-card" aria-label={`Ôn nhanh ${entry.className} buổi ${entry.sessionNo}: ${entry.title}`}>
      <header className="cs-post-head">
        <Avatar name={entry.className} url={null} size={40} />
        <div className="cs-post-meta">
          <div className="cs-post-line"><span className="cs-post-author">{entry.className}</span></div>
          <div className="cs-post-sub">
            <span className="cs-pub-announce">Buổi {entry.sessionNo} · </span>
            <time className="cs-post-time" dateTime={entry.createdAt}>{relativeTime(entry.createdAt, now)}</time>
          </div>
        </div>
      </header>
      <div className="lt-feed-body">
        <div className="lt-feed-kind">Ôn nhanh{entry.duration ? ` · ${entry.duration}` : ''}</div>
        <div className="lt-feed-lesson">{entry.title}</div>
        <div className="lt-feed-foot cs-pub-actions">
          <a className="lt-btn lt-feed-open cs-clip-open" href={href}>Xem clip</a>
        </div>
      </div>
    </article>
  )
}
