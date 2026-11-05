// Lớp "Khoanh để hỏi" trên MỘT bản nhạc LessonScore (alphaTab). Chỉ hiện khi trang cấp ScoreShareSlot (trang Buổi /me).
// • Tắt chế độ Khoanh: lớp phủ KHÔNG nhận chạm → cuộn / chụm phóng / "Xem lớn" như cũ.
// • Bật: lớp phủ touch-action:none — chạm một ô hoặc kéo qua nhiều ô; chạm khe giữa dòng / lề không chọn gì (không đoán).
// • Vùng tô = tính lại từ api.renderer.boundsLookup sau MỖI lần khắc (tick) và khi khung cuộn ngang; KHÔNG lưu pixel.
// Kiểm chứng spike 01/11 (alphaTab 1.8.3, Chrome + WebKit, 1280/390/320/xoay ngang, phóng khắc lại).
import { useCallback, useContext, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { PenLine, X } from 'lucide-react'
import { ScoreShareSlot } from './scoreShareSlot'
import { barCount, hitTestBar, rangeFits, rectsForBars, toRange, type BoundsLike, type HighlightRect } from './scoreShare'
import { barRangeText, sameScoreKey, type ScoreKey } from '../share/shareNoteApi'
import { registerScoreProbe } from './regionDom'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AlphaApi = any
type Px = { left: number; top: number; width: number; height: number; key: string }

export default function ScoreShareLayer({ api, host, tick, tex, shareKey, children }: {
  api: AlphaApi; host: HTMLDivElement | null; tick: number; tex: string; shareKey: ScoreKey
  /** Khung bản nhạc (lsn-score-host) — lớp phủ đặt ĐÚNG trên khung này, không phủ thanh công cụ */
  children: ReactNode
}) {
  const ctx = useContext(ScoreShareSlot)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState(false)
  // 0-based, đã chốt — GẮN với nội dung bản nhạc lúc chọn: nội dung đổi thì lựa chọn cũ tự hết hiệu lực
  const [chosen, setChosen] = useState<{ tex: string; r: [number, number] } | null>(null)
  const sel = chosen && chosen.tex === tex ? chosen.r : null
  const setSel = (r: [number, number] | null) => setChosen(r ? { tex, r } : null)
  const [draft, setDraft] = useState<[number, number] | null>(null)  // 0-based, đang kéo
  const [boxes, setBoxes] = useState<{ sel: Px[]; focus: Px[] }>({ sel: [], focus: [] })
  const drag = useRef<{ id: number; start: number } | null>(null)
  const shownFor = useRef<string | null>(null)
  const focus = ctx && sameScoreKey(ctx.focus?.score, shareKey) ? ctx.focus!.bars : null

  // ĐỌC MỚI mỗi lần (api đến SAU lần render đầu): mọi callback dùng lookup phải phụ thuộc api
  const lookup = useCallback((): BoundsLike | null => api?.renderer?.boundsLookup ?? null, [api])
  // Gốc toạ độ boundsLookup = góc trên-trái .at-surface; SVG có thể bị CSS co (max-width:100%) → hệ số k
  const geom = useCallback(() => {
    const surface = host?.querySelector('.at-surface') as HTMLElement | null
    const ov = overlayRef.current
    if (!surface || !ov) return null
    const sr = surface.getBoundingClientRect(), or = ov.getBoundingClientRect()
    const svg = surface.querySelector('svg')
    const w = svg ? parseFloat(svg.getAttribute('width') || '') : NaN
    const k = svg && w > 0 ? svg.getBoundingClientRect().width / w : 1
    return { sr, or, k: Number.isFinite(k) && k > 0 ? k : 1 }
  }, [host])

  const toPx = useCallback((rects: HighlightRect[], tag: string): Px[] => {
    const g = geom()
    if (!g) return []
    return rects.map(r => ({ left: g.sr.left - g.or.left + r.x * g.k, top: g.sr.top - g.or.top + r.y * g.k, width: r.w * g.k, height: r.h * g.k, key: `${tag}${r.first}-${r.last}` }))
  }, [geom])

  const paint = useCallback(() => {
    const lk = lookup()
    const live = draft ?? sel
    const count = barCount(lk)
    setBoxes({
      sel: live ? toPx(rectsForBars(lk, live[0], live[1]), 's') : [],
      focus: focus && rangeFits(focus.from, focus.to, count) ? toPx(rectsForBars(lk, focus.from - 1, focus.to - 1), 'f') : [],
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, sel?.[0], sel?.[1], focus?.from, focus?.to, toPx, lookup])

  useEffect(() => { const id = requestAnimationFrame(paint); return () => cancelAnimationFrame(id) }, [paint, tick])
  useEffect(() => {
    if (!host) return
    const onScroll = () => paint()
    host.addEventListener('scroll', onScroll, { passive: true })
    return () => host.removeEventListener('scroll', onScroll)
  }, [host, paint])

  // Mở từ liên kết: cuộn tới vùng tô MỘT lần khi đã vẽ được
  useEffect(() => {
    if (!focus || !boxes.focus.length || !overlayRef.current) return
    const id = `${focus.from}-${focus.to}`
    if (shownFor.current === id) return
    shownFor.current = id
    const el = overlayRef.current.querySelector<HTMLElement>('.lsn-share-hl.is-focus')
    if (el) { el.scrollIntoView({ block: 'center' }); ctx?.onFocusShown?.(el) }
  }, [focus, boxes.focus, ctx])

  // V3 (khoanh vùng hỗn hợp): đăng ký bản nhạc này vào sổ để khung chữ nhật tra được ô nhịp nằm dưới khung. Toạ độ client, tính lại mỗi lần gọi (không lưu pixel).
  useEffect(() => {
    if ((!ctx?.onAskRegion && !ctx?.regionFocus) || !host) return
    return registerScoreProbe({
      sec: shareKey.section, p: [...shareKey.path], el: host,
      bars: () => {
        const g = geom(), lk = lookup()
        if (!g || !lk) return []
        const out: { index: number; rect: { x: number; y: number; w: number; h: number } }[] = []
        for (const sys of lk.staffSystems) for (const b of sys.bars) out.push({ index: b.index, rect: { x: g.sr.left + b.realBounds.x * g.k, y: g.sr.top + sys.realBounds.y * g.k, w: b.realBounds.w * g.k, h: sys.realBounds.h * g.k } })
        return out
      },
      rectsFor: (a, b) => {
        const g = geom(), lk = lookup()
        return g && lk ? rectsForBars(lk, a, b).map(r => ({ x: g.sr.left + r.x * g.k, y: g.sr.top + r.y * g.k, w: r.w * g.k, h: r.h * g.k })) : []
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.onAskRegion, ctx?.regionFocus, host, geom, lookup, shareKey.section, shareKey.path.join('.')])

  const barAt = (e: RPointerEvent) => {
    const g = geom()
    return g ? hitTestBar(lookup(), (e.clientX - g.sr.left) / g.k, (e.clientY - g.sr.top) / g.k) : null
  }
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const b = barAt(e)
    if (b == null) return
    drag.current = { id: e.pointerId, start: b }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sự kiện không còn hoạt động */ }
    setDraft([b, b]); e.preventDefault()
  }
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return
    const b = barAt(e)
    if (b == null) return                                    // rơi vào khe / lề: giữ dải cũ
    const r = toRange(drag.current.start, b)
    setDraft([r.from - 1, r.to - 1])
  }
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    if (draft) setSel(draft)
    setDraft(null)
  }

  if (!ctx) return <>{children}</>
  const range = sel ? toRange(sel[0], sel[1]) : null
  const exit = () => { setMode(false); setSel(null); setDraft(null) }
  return (
    <>
      <div className="lsn-share-bar no-print" role="toolbar" aria-label="Khoanh ô nhịp để hỏi">
        {!mode ? (
          <button type="button" className="lsn-share-btn" aria-pressed="false" onClick={() => setMode(true)}><PenLine size={15} aria-hidden="true" /> Khoanh để hỏi</button>
        ) : range ? (
          <>
            <span className="lsn-share-range" aria-live="polite">{barRangeText(range)}</span>
            <button type="button" className="lsn-share-btn is-primary" onClick={() => { ctx.onAsk(shareKey, range); exit() }}>Hỏi / Chia sẻ</button>
            <button type="button" className="lsn-share-btn" onClick={() => setSel(null)}>Chọn lại</button>
            <button type="button" className="lsn-share-icon" aria-label="Thoát khoanh" onClick={exit}><X size={16} aria-hidden="true" /></button>
          </>
        ) : (
          <>
            <span className="lsn-share-hint" aria-live="polite">Chạm một ô nhịp, hoặc kéo qua nhiều ô</span>
            <button type="button" className="lsn-share-btn" aria-pressed="true" onClick={exit}>Xong</button>
          </>
        )}
      </div>
      <div className="lsn-score-wrap">
      {children}
      <div ref={overlayRef} className={'lsn-share-overlay no-print' + (mode ? ' is-on' : '')} aria-hidden="true"
        onPointerDown={mode ? onDown : undefined} onPointerMove={mode ? onMove : undefined}
        onPointerUp={mode ? onUp : undefined} onPointerCancel={mode ? () => { drag.current = null; setDraft(null) } : undefined}>
        {boxes.focus.map(b => <div key={b.key} className="lsn-share-hl is-focus" style={{ left: b.left, top: b.top, width: b.width, height: b.height }} />)}
        {boxes.sel.map(b => <div key={b.key} className={'lsn-share-hl' + (draft ? ' is-draft' : '')} style={{ left: b.left, top: b.top, width: b.width, height: b.height }} />)}
      </div>
      </div>
    </>
  )
}
