// Thẻ "Ôn nhanh" trên Feed /me (G3). Payload tham chiếu BUỔI HỌC gốc: không URL YouTube, không video id trong thẻ/DOM ban đầu.
// Khung 16:9 có ảnh bìa + nút Play. Bấm Play / "Xem clip" → video phát NGAY TẠI khung đó (YouTubeLesson, điều khiển gốc của YouTube:
// phát/tạm dừng, âm lượng, tua, toàn màn hình); không modal, không tự phát khi cuộn, chỉ một thẻ phát tại một thời điểm.
// "Xem bài học" (liên kết phụ) mở trang Buổi (/me/classes/<lớp>/sessions/<số buổi>).
import { useEffect, useRef, useState } from 'react'
import { relativeTime, type LessonClipEntry } from '../posts/postModel'
import { sessionPath } from '../resolveMeRoute'
import { Avatar } from '../ui'
import YouTubeLesson from '../../video/YouTubeLesson'
import { announceClipPlaying, clipThumbUrl, onOtherClipPlaying, useClipSource } from './lessonClipSource'

export default function LessonClipCard({ entry, now }: { entry: LessonClipEntry; now?: Date }) {
  const href = sessionPath(entry.classId, entry.sessionNo)
  const [playing, setPlaying] = useState(false)
  const [retry, setRetry] = useState(0)
  const [thumbBad, setThumbBad] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)      // nút "Xem clip" / "Đóng video"
  const frameRef = useRef<HTMLDivElement>(null)
  const src = useClipSource(entry, frameRef, playing, retry)
  const thumb = src.status === 'ready' ? clipThumbUrl(src.url) : null
  // Thẻ khác bắt đầu phát → thẻ này dừng (gỡ iframe = giải phóng player). Tháo thẻ khỏi giao diện cũng gỡ iframe.
  useEffect(() => (playing ? onOtherClipPlaying(entry.id, () => setPlaying(false)) : undefined), [playing, entry.id])
  const start = () => { announceClipPlaying(entry.id); setPlaying(true) }
  const stop = () => { setPlaying(false); openerRef.current?.focus({ preventScroll: true }) }
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
        <div ref={frameRef} className="cs-clip-frame">
          {!playing && (
            /* Trùng chức năng với nút "Xem clip" nên bỏ khỏi thứ tự Tab / trình đọc màn hình. */
            <button type="button" className="cs-clip-thumb" tabIndex={-1} aria-hidden="true" onClick={start}>
              {thumb && !thumbBad && <img src={thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setThumbBad(true)} />}
              <span className="cs-clip-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></span>
              {entry.duration && <span className="cs-clip-dur">{entry.duration}</span>}
            </button>
          )}
          {playing && src.status === 'ready' && <YouTubeLesson url={src.url} title={entry.title} autoplay style={{ width: '100%', height: '100%' }} />}
          {playing && (src.status === 'loading' || src.status === 'idle') && <p className="cs-clip-msg" role="status">Đang mở video…</p>}
          {playing && src.status === 'missing' && <p className="cs-clip-msg" role="status">Clip này không còn trong giáo trình hoặc bạn chưa có quyền xem. Hãy mở bài học để kiểm tra.</p>}
          {playing && src.status === 'error' && (
            <div className="cs-clip-msg" role="alert">Chưa mở được video. Kiểm tra mạng rồi thử lại, hoặc mở bài học.
              <div><button type="button" className="lt-btn" onClick={() => setRetry(n => n + 1)}>Thử lại</button></div></div>
          )}
        </div>
        <div className="lt-feed-kind">Ôn nhanh{entry.duration ? ` · ${entry.duration}` : ''}</div>
        <div className="lt-feed-lesson">{entry.title}</div>
        <div className="lt-feed-foot cs-pub-actions">
          <button ref={openerRef} type="button" className="lt-btn lt-feed-open cs-clip-open" aria-pressed={playing} onClick={playing ? stop : start}>{playing ? 'Đóng video' : 'Xem clip'}</button>
          <a className="cs-clip-lesson" href={href}>Xem bài học</a>
        </div>
      </div>
    </article>
  )
}
