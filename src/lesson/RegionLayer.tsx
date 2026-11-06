// Contextual Share V3 — "Khoanh vùng để hỏi": kéo KHUNG CHỮ NHẬT trên giáo trình đang nhìn thấy (chữ, bản nhạc, bảng, hình… lẫn lộn).
// • Bật chế độ → lớp phủ nhận kéo (chuột / cảm ứng / bút). Cảm ứng: nút "Cuộn" để cuộn trang giữa chừng (lớp phủ trả cuộn cho trình duyệt).
// • Thả chuột → biến khung thành NEO TÀI LIỆU (regionAnchor.buildParts) rồi VẼ LẠI từ chính neo đó bằng cùng bộ vẽ mà người nhận dùng
//   (RegionHighlight) ⇒ cái người soạn thấy sau khi thả = cái người nhận sẽ thấy; phần chỉ vẽ gần đúng được ghi rõ.
// • Khung kéo chỉ là toạ độ tạm thời trong lúc kéo; không lưu pixel.
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { PenLine, X, Hand, MessageCircleQuestion } from 'lucide-react'
import { buildParts, drawParts, normRect, REGION_HINT, summarize, type DrawnPart, type Rect, type RegionPart } from '../share/regionAnchor'
import { lookupFor, onLayoutChange, partsReady, probeSections } from './regionDom'

const pageRect = (r: Rect): Rect => ({ x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.w, h: r.h })   // client → toạ độ trang (cuộn không làm lệch khi vẽ)

/** Vẽ vùng theo NEO (người soạn sau khi thả + người nhận khi mở liên kết). Tính lại từ DOM hiện tại: đổi bề rộng / xuống dòng / alphaTab khắc lại đều tự đi theo. */
export function RegionHighlight({ root, parts, focus = false, onShown }: { root: RefObject<HTMLElement | null>; parts: RegionPart[]; focus?: boolean; onShown?: (el: HTMLElement) => void }) {
  const [drawn, setDrawn] = useState<DrawnPart[]>([])
  const sig = useRef('')
  const shown = useRef(false)
  useEffect(() => {
    shown.current = false
    const el = root.current
    if (!el) return
    const tick = () => {
      const d = drawParts(parts, lookupFor(el)).map(p => ({ ...p, rects: p.rects.map(pageRect), outline: p.outline && pageRect(p.outline) }))
      const s = JSON.stringify(d.map(p => [p.rects.map(r => [r.x, r.y, r.w, r.h].map(Math.round)), p.approx]))
      if (s !== sig.current) { sig.current = s; setDrawn(d) }
    }
    // Vẽ lại theo SỰ KIỆN bố cục (không hỏi định kỳ): đổi kích thước khối/trang, DOM đổi, font nạp xong, alphaTab khắc xong/khắc lại, xoay máy. Gộp về một lần/khung hình.
    let raf = 0
    const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; tick() }) }
    tick()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    ro?.observe(el); el.querySelectorAll('[data-sec]').forEach(n => ro?.observe(n))
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(schedule) : null
    mo?.observe(el, { childList: true, subtree: true })
    const off = onLayoutChange(schedule)
    window.addEventListener('resize', schedule); window.addEventListener('orientationchange', schedule)
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    fonts?.ready.then(schedule).catch(() => undefined); fonts?.addEventListener?.('loadingdone', schedule)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro?.disconnect(); mo?.disconnect(); off()
      window.removeEventListener('resize', schedule); window.removeEventListener('orientationchange', schedule)
      fonts?.removeEventListener?.('loadingdone', schedule); sig.current = ''
    }
  }, [root, parts])
  useEffect(() => {
    if (!focus || shown.current || !drawn.some(p => p.rects.length) || !root.current || !partsReady(parts, root.current)) return
    const first = document.querySelector<HTMLElement>('.lsn-rg-outline')
    if (first) { shown.current = true; first.scrollIntoView({ block: 'center' }); onShown?.(first) }
  }, [drawn, focus, parts, root, onShown])
  return createPortal(
    <div className="lsn-rg-layer no-print" aria-hidden="true" data-testid="region-highlight">
      {drawn.map((p, i) => (
        <div key={i} data-sec={p.sec} data-approx={p.approx ? '1' : '0'}>
          {p.rects.map((r, k) => <div key={k} className={'lsn-rg-fill' + (p.approx ? ' is-approx' : '')} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />)}
          {p.outline && <div className={'lsn-rg-outline' + (p.approx ? ' is-approx' : '')} style={{ left: p.outline.x, top: p.outline.y, width: p.outline.w, height: p.outline.h }} />}
        </div>
      ))}
    </div>, document.body)
}

type Pt = { x: number; y: number }
const EDGE = 72, MAX_STEP = 22

export default function RegionLayer({ root, sections, onAsk }: { root: RefObject<HTMLElement | null>; sections: unknown; onAsk: (parts: RegionPart[], summary: string) => void }) {
  const [mode, setMode] = useState<'off' | 'draw' | 'scroll'>('off')
  // Điểm kéo lưu theo TOẠ ĐỘ TRANG (cuộn trong lúc kéo không làm lệch); chỉ là đầu vào tạm thời, không được lưu lên server.
  const [drag, setDrag] = useState<{ a: Pt; b: Pt } | null>(null)
  const [res, setRes] = useState<{ parts: RegionPart[]; top: boolean } | { hint: string } | null>(null)
  const id = useRef<number | null>(null)
  const ptr = useRef<Pt>({ x: 0, y: 0 })        // con trỏ theo toạ độ client (để tự cuộn khi sát mép)
  const raf = useRef(0)
  const stopLoop = useCallback(() => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0 }, [])
  const off = useCallback(() => { stopLoop(); setMode('off'); setDrag(null); setRes(null) }, [stopLoop])
  useEffect(() => stopLoop, [stopLoop])
  useEffect(() => {
    if (mode === 'off') return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') off() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [mode, off])

  // Tự cuộn khi kéo sát mép trên/dưới màn hình (cuộn nhanh dần theo độ sát mép); điểm cuối luôn bám theo con trỏ.
  const loopRef = useRef<() => void>(() => undefined)
  useEffect(() => {
    loopRef.current = () => {
      const y = ptr.current.y, h = window.innerHeight
      const dy = y < EDGE ? -Math.ceil((EDGE - y) / EDGE * MAX_STEP) : y > h - EDGE ? Math.ceil((y - (h - EDGE)) / EDGE * MAX_STEP) : 0
      if (dy) {
        const before = window.scrollY
        window.scrollBy({ top: dy, behavior: 'instant' as ScrollBehavior })
        if (window.scrollY !== before) setDrag(d => (d ? { ...d, b: { x: ptr.current.x + window.scrollX, y: ptr.current.y + window.scrollY } } : d))
      }
      raf.current = requestAnimationFrame(() => loopRef.current())
    }
  })

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    id.current = e.pointerId
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sự kiện không còn hoạt động */ }
    ptr.current = { x: e.clientX, y: e.clientY }
    const p = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY }
    setRes(null); setDrag({ a: p, b: p }); e.preventDefault()
    stopLoop(); raf.current = requestAnimationFrame(() => loopRef.current())
  }
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (id.current !== e.pointerId) return
    ptr.current = { x: e.clientX, y: e.clientY }
    setDrag(d => (d ? { ...d, b: { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY } } : d))
  }
  const up = (e: RPointerEvent<HTMLDivElement>) => {
    if (id.current !== e.pointerId || !drag || !root.current) return
    id.current = null; stopLoop()
    const sx = window.scrollX, sy = window.scrollY
    const g = normRect({ x: drag.a.x - sx, y: drag.a.y - sy }, { x: e.clientX, y: e.clientY })     // khung theo client lúc thả (các khối ngoài màn hình vẫn đo được)
    const r = buildParts(g, probeSections(root.current, sections))
    setDrag(null)
    // Thanh công cụ không che vùng vừa khoanh: vùng nằm thấp ⇒ đặt thanh ở đầu màn hình
    setRes(r.ok ? { parts: r.parts, top: g.y + g.h > window.innerHeight - 170 && g.y > 170 } : { hint: REGION_HINT[r.reason] })
  }

  const live = drag ? normRect({ x: drag.a.x - window.scrollX, y: drag.a.y - window.scrollY }, { x: drag.b.x - window.scrollX, y: drag.b.y - window.scrollY }) : null
  const parts = res && 'parts' in res ? res.parts : null
  return (
    <>
      {mode === 'off' && (
        <button type="button" className="lsn-rg-start no-print" data-testid="region-start" onClick={() => setMode('draw')}>
          <PenLine size={16} aria-hidden="true" /> Khoanh để hỏi
        </button>
      )}
      {mode !== 'off' && (
        <div className={'lsn-rg-capture no-print' + (mode === 'scroll' ? ' is-scroll' : '')} data-testid="region-capture"
          onPointerDown={mode === 'draw' ? down : undefined} onPointerMove={mode === 'draw' ? move : undefined}
          onPointerUp={mode === 'draw' ? up : undefined} onPointerCancel={() => { id.current = null; stopLoop(); setDrag(null) }}>
          {live && <div className="lsn-rg-live" style={{ left: live.x, top: live.y, width: live.w, height: live.h }} data-testid="region-live" />}
        </div>
      )}
      {parts && root.current && <RegionHighlight root={root} parts={parts} />}
      {mode !== 'off' && !drag && (
        <div className={'lsn-textbar lsn-rg-bar no-print' + (res && 'parts' in res && res.top ? ' is-top' : '')} role="region" aria-label="Khoanh để hỏi" data-testid="region-bar" data-anchor={parts ? JSON.stringify(parts) : undefined} data-state={parts ? 'ok' : res ? 'hint' : 'idle'}>
          <div className="lsn-textbar-in">
            {parts ? (
              <>
                <p className="lsn-textbar-q" data-testid="region-summary">{summarize(parts)}</p>
                <div className="lsn-textbar-acts">
                  <button type="button" className="lsn-share-btn is-primary" data-testid="region-ask" onClick={() => { onAsk(parts, summarize(parts)); off() }}>
                    <MessageCircleQuestion size={15} aria-hidden="true" /> Hỏi / Chia sẻ
                  </button>
                  <button type="button" className="lsn-share-btn" data-testid="region-redo" onClick={() => { setRes(null); setMode('draw') }}>Khoanh lại</button>
                  <button type="button" className="lsn-share-icon" aria-label="Huỷ khoanh" data-testid="region-cancel" onClick={off}><X size={16} aria-hidden="true" /></button>
                </div>
              </>
            ) : (
              <>
                <p className={res ? 'lsn-textbar-warn' : 'lsn-textbar-q'} role="status" data-testid="region-hint">
                  {res && 'hint' in res ? res.hint : mode === 'scroll' ? 'Đang ở chế độ Cuộn. Bấm "Vẽ" để khoanh tiếp.' : 'Kéo một khung quanh phần bạn muốn hỏi. Kéo sát mép màn hình để cuộn.'}
                </p>
                <div className="lsn-textbar-acts">
                  <button type="button" className="lsn-share-btn" data-testid="region-mode" onClick={() => setMode(m => (m === 'draw' ? 'scroll' : 'draw'))}>
                    {mode === 'draw' ? <><Hand size={15} aria-hidden="true" /> Cuộn</> : <><PenLine size={15} aria-hidden="true" /> Vẽ</>}
                  </button>
                  <button type="button" className="lsn-share-icon" aria-label="Thoát khoanh" data-testid="region-cancel" onClick={off}><X size={16} aria-hidden="true" /></button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
