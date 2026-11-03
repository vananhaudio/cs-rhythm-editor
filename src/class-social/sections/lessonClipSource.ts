// Nguồn video của thẻ "Ôn nhanh" (G3). Thẻ Feed KHÔNG mang URL/video id (payload chỉ tham chiếu buổi học); khi thẻ sắp vào khung nhìn
// hoặc khi người xem bấm Play, đọc khối video từ giáo trình CỦA CHÍNH HỌ qua fetchSessionContent — RLS class_lesson_content_student_read
// quyết quyền như trang Buổi (không quyền → 0 hàng → 'missing', không phát). Ảnh bìa và player trực tiếp trong thẻ dùng chung MỘT lần đọc.
// Tái dùng YouTubeLesson (player bài học sẵn có); không bảng/RPC/asset mới, không nhân đôi video.
import { useEffect, useState } from 'react'
import { getYouTubeId } from '../../video/YouTubeLesson'
import { fetchSessionContent } from '../../classLearning/api'
import type { LessonSection } from '../../lesson/lessonTypes'
import type { LessonClipEntry } from '../posts/postModel'

export type ClipSource =
  | { status: 'idle' }
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
// Nhớ ngắn (60 giây) theo buổi: thẻ (ảnh bìa) và hộp phát dùng chung MỘT lần đọc giáo trình. Chỉ nhớ lần đọc thành công;
// quyền vẫn do RLS quyết ở mỗi lần đọc thật (hết hạn → đọc lại), nên đổi tài khoản không dùng nhầm dữ liệu cũ quá 60 giây.
const SECTIONS_TTL_MS = 60_000
const sectionsCache = new Map<string, { at: number; p: Promise<LessonSection[] | null> }>()
const defaultLoader: Loader = sessionId => {
  const hit = sectionsCache.get(sessionId)
  if (hit && Date.now() - hit.at < SECTIONS_TTL_MS) return hit.p
  const p = (async () => {
    const db = (await import('../../supabase')).supabase
    return (await fetchSessionContent(db, sessionId))?.sections ?? null
  })()
  sectionsCache.set(sessionId, { at: Date.now(), p })
  p.then(v => { if (!v) sectionsCache.delete(sessionId) }, () => sectionsCache.delete(sessionId))
  return p
}

/** Ảnh bìa YouTube (i.ytimg.com) dựng từ video id CỦA CHÍNH NGƯỜI XEM sau khi RLS cho đọc giáo trình — không nằm trong dữ liệu Feed. */
export function clipThumbUrl(url: string | null | undefined): string | null {
  const id = getYouTubeId(url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

/**
 * Đọc nguồn video của thẻ: khi thẻ lại gần khung nhìn (IntersectionObserver, lề 300px; không có IO thì ngay) hoặc khi `wanted`
 * (người xem bấm Play). Chỉ đọc một lần cho mỗi thẻ; `retry` đổi để đọc lại sau lỗi.
 */
export function useClipSource(entry: LessonClipEntry, target: React.RefObject<Element | null>, wanted: boolean, retry = 0, load: Loader = defaultLoader): ClipSource {
  const [src, setSrc] = useState<ClipSource>({ status: 'idle' })
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = target.current
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); setNear(true) } }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [target])
  const go = near || wanted
  useEffect(() => {
    if (!go) return
    let alive = true
    setSrc(prev => (prev.status === 'ready' ? prev : { status: 'loading' }))
    void (async () => {
      try {
        const sections = await load(clipSessionId(entry))
        if (!alive) return
        const v = sections ? pickClipVideo(sections, entry.title, entry.duration) : null
        setSrc(v ? { status: 'ready', url: v.url } : { status: 'missing' })
      } catch { if (alive) setSrc({ status: 'error' }) }
    })()
    return () => { alive = false }
  }, [go, entry, load, retry])
  return src
}

// Chỉ MỘT thẻ phát tại một thời điểm: thẻ bắt đầu phát phát tín hiệu, các thẻ khác tự dừng (gỡ iframe → giải phóng player).
const ACTIVATE = 'cs-clip-activate'
export const announceClipPlaying = (id: string): void => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ACTIVATE, { detail: id })) }
export function onOtherClipPlaying(myId: string, stop: () => void): () => void {
  const h = (e: Event) => { if ((e as CustomEvent<string>).detail !== myId) stop() }
  window.addEventListener(ACTIVATE, h)
  return () => window.removeEventListener(ACTIVATE, h)
}
