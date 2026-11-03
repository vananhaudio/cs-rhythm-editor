// Trình phát "Ôn nhanh" ngay trong Class (G3-2). Thẻ Feed KHÔNG mang URL/video id (payload chỉ tham chiếu buổi học);
// khi người xem bấm "Xem clip", đọc khối video từ giáo trình CỦA CHÍNH HỌ qua fetchSessionContent — RLS
// class_lesson_content_student_read quyết quyền như trang Buổi (không quyền → 0 hàng → thông báo, không phát).
// Tái dùng YouTubeLesson (player bài học sẵn có) và lớp .cs-dialog-*; không bảng/RPC/asset mới, không nhân đôi video.
import { useEffect, useId, useRef, useState } from 'react'
import YouTubeLesson from '../../video/YouTubeLesson'
import { fetchSessionContent } from '../../classLearning/api'
import type { LessonSection } from '../../lesson/lessonTypes'
import type { LessonClipEntry } from '../posts/postModel'
import { sessionPath } from '../resolveMeRoute'

export type ClipState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'missing' }   // không có quyền / khối đã gỡ / buổi không còn video
  | { status: 'error' }

/** session_id nằm trong id thẻ: '<session_id>:<10 hex>'. */
export const clipSessionId = (e: Pick<LessonClipEntry, 'id'>): string => e.id.split(':')[0]

/** Chọn khối video khớp thẻ: cùng tiêu đề (đã cắt như payload ≤120); trùng tiêu đề thì ưu tiên cùng thời lượng. */
export function pickClipVideo(sections: LessonSection[], title: string, duration: string | null): { url: string } | null {
  const want = title.trim().slice(0, 120)
  const vids = sections.filter((s): s is Extract<LessonSection, { kind: 'video' }> => s.kind === 'video' && typeof s.url === 'string' && !!s.url)
    .filter(s => s.title.trim().slice(0, 120) === want)
  if (!vids.length) return null
  const exact = duration ? vids.find(s => (s.duration ?? '').trim() === duration) : undefined
  return { url: (exact ?? vids[0]).url }
}

type Loader = (sessionId: string) => Promise<LessonSection[] | null>
const defaultLoader: Loader = async sessionId => {
  const db = (await import('../../supabase')).supabase
  return (await fetchSessionContent(db, sessionId))?.sections ?? null
}

/** Phần hiển thị thuần (kiểm thử được bằng render tĩnh). */
export function ClipPlayerView({ entry, state, onClose, titleId, closeRef }: {
  entry: LessonClipEntry; state: ClipState; onClose: () => void; titleId: string; closeRef?: React.Ref<HTMLButtonElement>
}) {
  return (
    <>
      <div className="cs-dialog-backdrop" onClick={onClose} />
      <div className="cs-dialog cs-clip-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="cs-clip-modal-head">
          <h2 id={titleId}>{entry.title}</h2>
          <button ref={closeRef} type="button" className="cs-btn cs-btn-ghost cs-clip-close" onClick={onClose} aria-label="Đóng video">Đóng</button>
        </div>
        <div className="cs-clip-stage">
          {state.status === 'loading' && <p className="cs-clip-msg" role="status">Đang mở video…</p>}
          {state.status === 'ready' && <YouTubeLesson url={state.url} title={entry.title} style={{ width: '100%' }} />}
          {state.status === 'missing' && <p className="cs-clip-msg" role="status">Clip này không còn trong giáo trình hoặc bạn chưa có quyền xem. Hãy mở bài học để kiểm tra.</p>}
          {state.status === 'error' && <p className="cs-clip-msg" role="alert">Chưa mở được video. Kiểm tra mạng rồi thử lại, hoặc mở bài học.</p>}
        </div>
        <a className="cs-clip-lesson" href={sessionPath(entry.classId, entry.sessionNo)}>Xem bài học</a>
      </div>
    </>
  )
}

export default function LessonClipPlayer({ entry, onClose, load = defaultLoader }: { entry: LessonClipEntry; onClose: () => void; load?: Loader }) {
  const [state, setState] = useState<ClipState>({ status: 'loading' })
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const sections = await load(clipSessionId(entry))
        if (!alive) return
        const v = sections ? pickClipVideo(sections, entry.title, entry.duration) : null
        setState(v ? { status: 'ready', url: v.url } : { status: 'missing' })
      } catch { if (alive) setState({ status: 'error' }) }
    })()
    return () => { alive = false }
  }, [entry, load])

  useEffect(() => { closeRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    // Khoá cuộn nền nhưng KHÔNG đổi scrollY → đóng xong Feed vẫn ở đúng chỗ
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return <ClipPlayerView entry={entry} state={state} onClose={onClose} titleId={titleId} closeRef={closeRef} />
}
