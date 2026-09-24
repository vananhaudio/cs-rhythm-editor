// Đính kèm bài giảng từ Kho (CHỈ Thầy). Chọn khoá → chọn bài → tuỳ chọn mốc bắt đầu + trích
// đoạn ngắn → Đính kèm. Dữ liệu lấy qua API sẵn có của Kho (khoAdapter), chỉ lưu THAM CHIẾU.
// Player của Kho chỉ hỗ trợ mốc bắt đầu (?t=) → không có ô "kết thúc".
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { MAX_EXCERPT, formatTimecode, parseTimecode, type ResourceRef } from '../../comments/commentModel'
import { filterByTitle, listKhoCourseVideos, listKhoCourses, type KhoCourse, type KhoVideo } from '../../comments/khoAdapter'

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: T[] }

export default function KhoResourcePicker({ onAttach, onClose }: {
  onAttach: (r: ResourceRef) => void
  onClose: () => void
}) {
  const [courses, setCourses] = useState<Load<KhoCourse>>({ status: 'loading' })
  const [course, setCourse] = useState<KhoCourse | null>(null)
  const [videos, setVideos] = useState<Load<KhoVideo>>({ status: 'loading' })
  const [video, setVideo] = useState<KhoVideo | null>(null)
  const [q, setQ] = useState('')
  const [start, setStart] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void listKhoCourses().then(r => setCourses(r.ok ? { status: 'ready', items: r.value } : { status: 'error', message: r.message }))
  }, [reloadTick])
  useEffect(() => {
    if (!course) return
    void listKhoCourseVideos(course.id).then(r => setVideos(r.ok ? { status: 'ready', items: r.value } : { status: 'error', message: r.message }))
  }, [course, reloadTick])
  useEffect(() => { searchRef.current?.focus() }, [course])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const startSec = parseTimecode(start)
  const startError = startSec === undefined ? 'Mốc thời gian dạng 03:42 hoặc 1:02:03.'
    : video?.durationSec && startSec !== null && startSec >= video.durationSec ? `Bài giảng dài ${formatTimecode(video.durationSec)}.` : null

  const back = () => {
    if (video) { setVideo(null); return }
    setCourse(null); setVideos({ status: 'loading' }); setQ('')
  }
  const attach = () => {
    if (!video || startError) return
    onAttach({ resourceType: 'kho_video', resourceId: video.id, title: video.title, startSeconds: startSec ?? null, excerpt: excerpt.trim() || null })
  }

  const list = (load: Load<KhoCourse | KhoVideo>, pick: (x: KhoCourse & KhoVideo) => void) => {
    if (load.status === 'loading') return <p className="cs-picker-hint">Đang tải Kho bài giảng…</p>
    if (load.status === 'error') return (
      <div className="cs-picker-hint" role="alert">{load.message}{' '}
        <button type="button" className="cs-link-btn" onClick={() => setReloadTick(t => t + 1)}>Thử lại</button>
      </div>
    )
    const items = filterByTitle(load.items, q)
    if (items.length === 0) return <p className="cs-picker-hint">Không có kết quả.</p>
    return (
      <ul className="cs-kho-list">
        {items.map(x => (
          <li key={x.id}>
            <button type="button" className="cs-kho-item" onClick={() => pick(x as KhoCourse & KhoVideo)}>
              <span className="cs-kho-title">{x.title}</span>
              <span className="cs-kho-meta">
                {'count' in x ? `${x.count} bài` : x.durationSec ? formatTimecode(x.durationSec) : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <div className="cs-dialog-backdrop cs-backdrop-top" onClick={onClose} />
      <div className="cs-composer-modal cs-kho-modal" role="dialog" aria-modal="true" aria-labelledby="cs-kho-title">
        <header className="cs-composer-modal-head">
          {course && <button type="button" className="cs-icon-btn" onClick={back} aria-label="Quay lại"><ArrowLeft size={20} /></button>}
          <h2 id="cs-kho-title">{video ? 'Chọn đoạn bài giảng' : course ? course.title : 'Đính kèm bài giảng'}</h2>
          <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </header>
        <div className="cs-composer-modal-body">
          {!video && (
            <>
              <input ref={searchRef} className="cs-input" placeholder={course ? 'Lọc bài giảng theo tên' : 'Lọc khoá học theo tên'}
                value={q} onChange={e => setQ(e.target.value)} />
              {course
                ? list(videos as Load<KhoCourse | KhoVideo>, v => setVideo(v))
                : list(courses as Load<KhoCourse | KhoVideo>, c => { setCourse(c); setQ('') })}
            </>
          )}
          {video && (
            <>
              <div className="cs-kho-picked">
                <span className="cs-res-kicker">Bài giảng</span>
                <span className="cs-res-title">{video.title}</span>
                {video.durationSec && <span className="cs-res-time">Dài {formatTimecode(video.durationSec)}</span>}
              </div>
              <label className="cs-field">
                <span className="cs-field-label">Bắt đầu tại <span className="cs-field-optional">(không bắt buộc)</span></span>
                <input className="cs-input" inputMode="numeric" placeholder="03:42" value={start}
                  onChange={e => setStart(e.target.value)} aria-invalid={!!startError} />
                {startError && <span className="cs-field-status is-error">{startError}</span>}
              </label>
              <label className="cs-field">
                <span className="cs-field-label">Trích đoạn ngắn <span className="cs-field-optional">(không bắt buộc — bản chụp Thầy chọn)</span></span>
                <textarea className="cs-input cs-textarea" rows={2} maxLength={MAX_EXCERPT} value={excerpt}
                  placeholder="Ví dụ: Giữ bass đúng phách 1 và 3." onChange={e => setExcerpt(e.target.value)} />
              </label>
              <footer className="cs-composer-modal-foot">
                <button type="button" className="cs-btn cs-btn-ghost" onClick={back}>Chọn bài khác</button>
                <button type="button" className="cs-btn cs-btn-primary" onClick={attach} disabled={!!startError}>Đính kèm</button>
              </footer>
            </>
          )}
        </div>
      </div>
    </>
  )
}
