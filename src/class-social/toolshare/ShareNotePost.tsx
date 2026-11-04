// Bài đăng "Bản nhạc" (Share Note) trên Feed /me: câu hỏi + xem trước ĐÚNG trích đoạn đã khoanh (tối đa 4 ô / 2 dòng), vẽ bằng LessonScore + alphaTab
// từ chính asset giáo trình gốc — KHÔNG ảnh chụp, KHÔNG bản sao. Bấm vào bản nhạc = mở trang Buổi tại đúng đoạn.
// - Quyền: share_note_open TRƯỚC; chỉ status ok mới đọc giáo trình (xem shareNotePreviewStore). no_access / stale / unavailable: không có nhạc.
// - Nạp khi thẻ gần khung nhìn (IntersectionObserver); chỉ MAX_LIVE_RENDERERS bản nhạc sống cùng lúc; thẻ cuộn xa → huỷ alphaTab (giữ chiều cao để Feed không giật).
// - Mỗi thẻ có error boundary: một thẻ lỗi không làm hỏng Feed. Thích / bình luận nằm ở chân bài (FeedEntryCard), không đổi.
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import LessonScore from '../../lesson/LessonScore'
import { ContextSectionView } from '../../lesson/LessonDocument'
import { contextHasMore } from '../../share/contextShare'
import type { ExcerptPlan } from '../../share/scoreExcerpt'
import { loadSharePreview, requestRenderSlot, shareNoteMessage, type PreviewLoad } from '../../share/shareNotePreviewStore'
import type { ToolShareView } from './registry'

const NEAR_MARGIN = '600px 0px'   // nạp / dựng khi thẻ cách khung nhìn ≤ 600px; xa hơn thì huỷ

class PreviewBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { /* một thẻ lỗi không làm hỏng Feed; không ghi log chứa nội dung */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/** Gần khung nhìn? (không có IntersectionObserver → coi như gần: vẫn chạy được, chỉ không tiết kiệm) */
function useNear(ref: { current: Element | null }): boolean {
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(es => { for (const e of es) setNear(e.isIntersecting) }, { rootMargin: NEAR_MARGIN })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return near
}

export default function ShareNotePost({ view }: { view: ToolShareView }) {
  const note = view.sharedNote
  const box = useRef<HTMLDivElement>(null)
  const near = useNear(box)
  const [load, setLoad] = useState<PreviewLoad | null>(null)
  const [slot, setSlot] = useState(false)
  const [plan, setPlan] = useState<ExcerptPlan | null>(null)
  const [expanded, setExpanded] = useState(false)   // "Xem thêm ngữ cảnh": mở thêm phần sư phạm của khối gốc ngay trong Feed (không đổi vùng khoanh)
  const [height, setHeight] = useState(0)   // chiều cao lần dựng trước: giữ chỗ khi huỷ renderer (Feed không nhảy)
  const noteId = note?.noteId

  // Nạp quyền + nhạc khi lần đầu gần khung nhìn (lỗi mạng: thử lại lần gần kế tiếp)
  const loadRef = useRef<PreviewLoad | null>(null)
  loadRef.current = load   // eslint-disable-line react-hooks/refs -- chỉ đọc trong effect (không phụ thuộc load → lỗi mạng không lặp vô hạn)
  useEffect(() => {
    if (!near || !noteId) return
    const cur = loadRef.current
    if (cur && cur.status !== 'error') return
    let dead = false
    loadSharePreview(noteId).then(r => { if (!dead) setLoad(r) })
    return () => { dead = true }
  }, [near, noteId])

  // Khe dựng: chỉ khi có nhạc và thẻ đang gần
  const wantRender = near && load?.status === 'ok'
  useEffect(() => {
    if (!wantRender) return
    const s = requestRenderSlot(() => setSlot(true))
    return () => { s.release(); setSlot(false) }
  }, [wantRender])

  // Ghi nhớ chiều cao khi bản nhạc đã dựng xong
  const prev = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!(wantRender && slot) || !prev.current || typeof ResizeObserver === 'undefined') return
    const el = prev.current
    const ro = new ResizeObserver(() => { const h = el.offsetHeight; if (h > 40) setHeight(h) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [wantRender, slot])

  if (!note || !view.action) return <p className="cs-tool-share-missing">Kết quả này không còn hiển thị được.</p>
  const Icon = view.icon
  const msg = shareNoteMessage(load)
  const live = wantRender && slot && load?.status === 'ok'
  const label = plan?.truncated ? `${view.detail ?? ''} · hiện ${plan.focusTo - plan.focusFrom + 1} ô đầu — bấm để xem đủ` : view.detail
  const open = <a className="cs-btn cs-btn-soft cs-tool-share-cta" href={view.action.href}>{view.action.label}</a>

  return (
    <div className="cs-tool-share cs-sn-post" ref={box} data-testid="share-note-post">
      <div className="cs-tool-share-kind"><Icon size={15} aria-hidden="true" /> {view.toolLabel} · {view.kindLabel}</div>
      <div className="cs-tool-share-headline">{view.headline}</div>
      {label && <div className="cs-tool-share-detail">{label}</div>}
      {msg && <p className="cs-sn-msg" role="status">{msg}</p>}
      {load?.status === 'ok' && (
        <div className="cs-sn-slot" style={{ minHeight: live ? undefined : height || 120 }} ref={prev} data-testid="share-note-preview" data-live={live ? '1' : '0'} data-plan={plan ? `${plan.start},${plan.count},${plan.focusFrom},${plan.focusTo}` : undefined}>
          {live
            ? <PreviewBoundary fallback={<p className="cs-sn-msg">Chưa hiển thị được bản nhạc. Bấm “Mở đúng đoạn”.</p>}>
                <a className="cs-sn-preview" href={view.action.href} aria-label={`Mở đúng đoạn ${view.detail ?? ''} trong bản nhạc`}>
                  {(() => {
                    const score = <LessonScore tex={load.tex} excerpt={load.bars} onExcerpt={setPlan} zoomable={false} barsPerRow={4} />
                    // Khung ngữ cảnh = khối giáo trình GỐC (tiêu đề, mô tả, nhịp độ, tên tác phẩm) dựng bằng chính renderer của LessonDocument; thiếu khối → chỉ trích đoạn như V1.1
                    return load.section ? <ContextSectionView section={load.section} index={load.score.section} scoreKey={load.score} node={score} expanded={expanded} /> : score
                  })()}
                </a>
              </PreviewBoundary>
            : near && <div className="cs-sn-wait"><span className="cs-skeleton" style={{ width: '60%', height: 14 }} /></div>}
          {live && load.section !== undefined && contextHasMore([load.section], { ...load.score, section: 0 }) && (
            <button type="button" className="cs-sn-more" data-testid="share-note-more" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
              {expanded ? 'Thu gọn ngữ cảnh' : 'Xem thêm ngữ cảnh'}
            </button>
          )}
        </div>
      )}
      {!load && near && <span className="cs-skeleton" style={{ width: '70%', height: 14 }} />}
      {open}
    </div>
  )
}
