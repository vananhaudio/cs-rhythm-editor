// Thẻ "Ôn nhanh" trên Feed /me (G3). Payload tham chiếu BUỔI HỌC gốc: không URL YouTube, không video id trong thẻ/DOM ban đầu.
// "Xem clip" mở trình phát NGAY TẠI Feed (LessonClipPlayer: đọc khối video theo quyền giáo trình của chính người xem; đóng → về đúng chỗ cuộn).
// "Xem bài học" (liên kết phụ) mở trang Buổi (/me/classes/<lớp>/sessions/<số buổi>).
import { useRef, useState } from 'react'
import { relativeTime, type LessonClipEntry } from '../posts/postModel'
import { sessionPath } from '../resolveMeRoute'
import { Avatar } from '../ui'
import LessonClipPlayer, { useClipThumb } from './LessonClipPlayer'

export default function LessonClipCard({ entry, now }: { entry: LessonClipEntry; now?: Date }) {
  const href = sessionPath(entry.classId, entry.sessionNo)
  const [open, setOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)      // nút "Xem clip" (đích trả focus)
  const stageRef = useRef<HTMLButtonElement>(null)
  const thumb = useClipThumb(entry, stageRef)
  const [thumbBad, setThumbBad] = useState(false)
  const close = () => { setOpen(false); openerRef.current?.focus({ preventScroll: true }) }
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
        {/* Ảnh bìa 16:9 + nút Play: chỉ mở hộp phát khi bấm (không tự phát). Trùng chức năng với nút "Xem clip" nên bỏ khỏi thứ tự Tab. */}
        <button ref={stageRef} type="button" className="cs-clip-thumb" tabIndex={-1} aria-hidden="true" onClick={() => setOpen(true)}>
          {thumb && !thumbBad && <img src={thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setThumbBad(true)} />}
          <span className="cs-clip-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></span>
          {entry.duration && <span className="cs-clip-dur">{entry.duration}</span>}
        </button>
        <div className="lt-feed-kind">Ôn nhanh{entry.duration ? ` · ${entry.duration}` : ''}</div>
        <div className="lt-feed-lesson">{entry.title}</div>
        <div className="lt-feed-foot cs-pub-actions">
          <button ref={openerRef} type="button" className="lt-btn lt-feed-open cs-clip-open" onClick={() => setOpen(true)}>Xem clip</button>
          <a className="cs-clip-lesson" href={href}>Xem bài học</a>
        </div>
      </div>
      {open && <LessonClipPlayer entry={entry} onClose={close} />}
    </article>
  )
}
