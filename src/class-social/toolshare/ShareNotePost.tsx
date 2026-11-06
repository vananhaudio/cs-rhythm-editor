// Bài đăng "Bản nhạc" (Share Note) trên Feed /me: câu hỏi + xem trước ĐÚNG trích đoạn đã khoanh (tối đa 4 ô / 2 dòng), vẽ bằng LessonScore + alphaTab
// từ chính asset giáo trình gốc — KHÔNG ảnh chụp, KHÔNG bản sao. Bấm vào bản nhạc = mở trang Buổi tại đúng đoạn.
// - Quyền: share_note_open TRƯỚC; chỉ status ok mới đọc giáo trình (xem shareNotePreviewStore). no_access / stale / unavailable: không có nhạc.
// - Nạp khi thẻ gần khung nhìn (IntersectionObserver); chỉ MAX_LIVE_RENDERERS bản nhạc sống cùng lúc; thẻ cuộn xa → huỷ alphaTab (giữ chiều cao để Feed không giật).
// - Mỗi thẻ có error boundary: một thẻ lỗi không làm hỏng Feed. Thích / bình luận nằm ở chân bài (FeedEntryCard), không đổi.
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import LessonScore from '../../lesson/LessonScore'
import { ContextSectionView } from '../../lesson/LessonDocument'
import { contextHasMore } from '../../share/contextShare'
import { textContextHasMore } from '../../share/textAnchor'
import { summarize, type RegionPart } from '../../share/regionAnchor'
import { regionHasMore, regionViews } from '../../share/regionContext'
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

/** Vùng khoanh trong Feed: nguyên cảnh = các khối giáo trình GỐC (cửa sổ gọn / tiểu mục đầy đủ) dựng bằng chính renderer; chữ được khoanh tô cam đúng từng đoạn,
 *  bản nhạc chỉ vẽ đúng dải ô, phần hình/khoảng trống có khung nét đứt (gần đúng). Mặc định gọn: tối đa 3 khối, tối đa 1 bản nhạc sống. */
function RegionContextView({ sections, parts, expanded, onPlan }: { sections: unknown[]; parts: RegionPart[]; expanded: boolean; onPlan: (p: ExcerptPlan | null) => void }) {
  const views = regionViews(sections, parts, expanded)
  return (
    <div className="cs-sn-region" data-testid="region-context" data-parts={parts.length} data-shown={views.shown.length}>
      {views.shown.map((v, k) => (
        <div key={v.part.sec} className="cs-sn-region-part" data-sec={v.part.sec}>
          <ContextSectionView section={sections[v.part.sec]} index={v.part.sec} expanded={expanded} marks={v.marks} blocksAt={v.blocksAt} approx={v.approx ? v.part.box : undefined} crop={v.approx}
            scoreKey={v.score ? { section: v.part.sec, path: v.score.p as never } : undefined}
            node={v.score && v.tex ? <LessonScore tex={v.tex} excerpt={{ from: v.score.from, to: v.score.to }} onExcerpt={k === 0 ? onPlan : undefined} zoomable={false} barsPerRow={4} excerptContext={expanded ? 'full' : 'focus'} /> : undefined} />
          {v.part.scores.length > 0 && !v.score && <p className="cs-sn-msg">Bản nhạc ô {v.part.scores[0].from === v.part.scores[0].to ? v.part.scores[0].from : `${v.part.scores[0].from}–${v.part.scores[0].to}`} — bấm “Xem đầy đủ” để xem.</p>}
        </div>
      ))}
      {views.hidden > 0 && <p className="cs-sn-msg" data-testid="region-hidden">+{views.hidden} khối nữa trong vùng khoanh — bấm “Xem đầy đủ”. ({summarize(parts)})</p>}
    </div>
  )
}

export default function ShareNotePost({ view }: { view: ToolShareView }) {
  const note = view.sharedNote
  const box = useRef<HTMLDivElement>(null)
  const near = useNear(box)
  const [load, setLoad] = useState<PreviewLoad | null>(null)
  const [slot, setSlot] = useState(false)
  const [plan, setPlan] = useState<ExcerptPlan | null>(null)
  const [expanded, setExpanded] = useState(false)   // "Xem đầy đủ": mở thêm ngữ cảnh (nhạc + phần sư phạm của khối gốc) ngay trong Feed — không cấp thêm quyền, không đổi vùng khoanh
  const [clamped, setClamped] = useState(false)       // mô tả dài đang bị rút gọn 2 dòng (nguyên văn vẫn đủ trong DOM) → có gì đó để "Xem đầy đủ"
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
  // vùng văn bản (hoặc vùng khoanh KHÔNG có bản nhạc): KHÔNG alphaTab ⇒ không xin khe dựng, không đếm vào MAX_LIVE_RENDERERS
  const isTextPost = note?.kind === 'text' || (load?.status === 'ok' && load.kind === 'region' && !load.parts.some(p => p.scores.length > 0))
  const wantRender = near && load?.status === 'ok'
  useEffect(() => {
    if (!wantRender || isTextPost) return
    const s = requestRenderSlot(() => setSlot(true))
    return () => { s.release(); setSlot(false) }
  }, [wantRender, isTextPost])

  // Ghi nhớ chiều cao khi bản nhạc đã dựng xong
  const prev = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!(wantRender && (slot || isTextPost)) || !prev.current || typeof ResizeObserver === 'undefined') return
    const el = prev.current
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight; if (h > 40) setHeight(h)
      if (el.querySelector('[data-expanded="0"]')) setClamped([...el.querySelectorAll('.lsn-ctx .lsn-sub, .lsn-ctx .lsn-piece-note')].some(n => n.scrollHeight > n.clientHeight + 1))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [wantRender, slot, isTextPost])

  if (!note || !view.action) return <p className="cs-tool-share-missing">Kết quả này không còn hiển thị được.</p>
  const Icon = view.icon
  const msg = shareNoteMessage(load)
  const live = wantRender && (slot || isTextPost) && load?.status === 'ok'
  const label = plan?.truncated ? `${view.detail ?? ''} · hiện ${plan.focusTo - plan.focusFrom + 1} ô đầu — bấm để xem đủ` : view.detail
  // "Xem đầy đủ" chỉ hiện khi thật sự có gì thêm: phần sư phạm bị ẩn, mô tả bị rút gọn, hoặc ô nhạc ngữ cảnh chưa vẽ
  const hasMore = live && load?.status === 'ok' && (load.kind === 'region'
    ? (regionHasMore(load.sections, load.parts) || expanded)
    : load.section !== undefined && (load.kind === 'text'
    ? (textContextHasMore(load.section, load.text) || expanded)
    : (contextHasMore([load.section], { ...load.score, section: 0 }) || clamped || !!plan?.moreContext || expanded)))
  const more = hasMore
    ? <button type="button" className="cs-sn-more" data-testid="share-note-more" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
        <span>{expanded ? 'Thu gọn' : 'Xem đầy đủ'}</span>{expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
    : null
  const open = <a className="cs-sn-open" data-testid="share-note-open" href={view.action.href}><BookOpen size={17} aria-hidden="true" /><span>{view.action.label}</span></a>

  return (
    <div className="cs-tool-share cs-sn-post" ref={box} data-testid="share-note-post">
      <div className="cs-tool-share-kind"><Icon size={15} aria-hidden="true" /> {view.toolLabel} · {view.kindLabel}</div>
      <div className="cs-tool-share-headline">{view.headline}</div>
      {label && <div className="cs-tool-share-detail">{label}</div>}
      {msg && <p className="cs-sn-msg" role="status">{msg}</p>}
      {load?.status === 'ok' && (
        <div className="cs-sn-slot" style={{ minHeight: live ? undefined : height || 120 }} ref={prev} data-testid="share-note-preview" data-live={live ? '1' : '0'} data-plan={plan ? `${plan.start},${plan.count},${plan.focusFrom},${plan.focusTo}` : undefined}>
          {live
            ? <PreviewBoundary fallback={<p className="cs-sn-msg">{load.kind === 'text' ? 'Chưa hiển thị được đoạn văn bản.' : load.kind === 'region' ? 'Chưa hiển thị được vùng khoanh.' : 'Chưa hiển thị được bản nhạc.'} Bấm “Mở trong giáo trình”.</p>}>
                <a className="cs-sn-preview" href={view.action.href} aria-label={`Mở trong giáo trình: ${view.detail ?? 'đoạn đã chọn'}`}>
                  {(() => {
                    // Vùng văn bản: khung = khối giáo trình GỐC (cửa sổ gọn / tiểu mục) dựng bằng chính renderer; vùng chọn là <mark> cam. Không alphaTab.
                    if (load.kind === 'region') return <RegionContextView sections={load.sections} parts={load.parts} expanded={expanded} onPlan={setPlan} />
                    if (load.kind === 'text') return <ContextSectionView section={load.section} index={load.text.section} text={load.text} expanded={expanded} />
                    const score = <LessonScore tex={load.tex} excerpt={load.bars} onExcerpt={setPlan} zoomable={false} barsPerRow={4} excerptContext={load.section ? (expanded ? 'full' : 'focus') : 'full'} />
                    // Khung ngữ cảnh = khối giáo trình GỐC (tiêu đề, mô tả, nhịp độ, tên tác phẩm) dựng bằng chính renderer của LessonDocument; thiếu khối → chỉ trích đoạn như V1.1
                    return load.section ? <ContextSectionView section={load.section} index={load.score.section} scoreKey={load.score} node={score} expanded={expanded} /> : score
                  })()}
                </a>
              </PreviewBoundary>
            : near && <div className="cs-sn-wait"><span className="cs-skeleton" style={{ width: '60%', height: 14 }} /></div>}
        </div>
      )}
      {!load && near && <span className="cs-skeleton" style={{ width: '70%', height: 14 }} />}
      <div className="cs-sn-actions">
        {more}
        {open}
      </div>
    </div>
  )
}
