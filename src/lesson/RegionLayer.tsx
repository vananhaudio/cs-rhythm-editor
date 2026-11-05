// Contextual Share V3 — "Khoanh vùng để hỏi": kéo KHUNG CHỮ NHẬT trên giáo trình đang nhìn thấy (chữ, bản nhạc, bảng, hình… lẫn lộn).
// • Bật chế độ → lớp phủ nhận kéo (chuột / cảm ứng / bút). Cảm ứng: nút "Cuộn" để cuộn trang giữa chừng (lớp phủ trả cuộn cho trình duyệt).
// • Thả chuột → biến khung thành NEO TÀI LIỆU (regionAnchor.buildParts) rồi VẼ LẠI từ chính neo đó bằng cùng bộ vẽ mà người nhận dùng
//   (RegionHighlight) ⇒ cái người soạn thấy sau khi thả = cái người nhận sẽ thấy; phần chỉ vẽ gần đúng được ghi rõ.
// • Khung kéo chỉ là toạ độ tạm thời trong lúc kéo; không lưu pixel.
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { PenLine, X, Hand, MessageCircleQuestion } from 'lucide-react'
import { buildParts, drawParts, normRect, REGION_HINT, summarize, type DrawnPart, type Rect, type RegionPart } from '../share/regionAnchor'
import { lookupFor, partsReady, probeSections } from './regionDom'

const pageRect = (r: Rect): Rect => ({ x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.w, h: r.h })   // client → toạ độ trang (cuộn không làm lệch khi vẽ)

/** Vẽ vùng theo NEO (người soạn sau khi thả + người nhận khi mở liên kết). Tính lại từ DOM hiện tại: đổi bề rộng / xuống dòng / alphaTab khắc lại đều tự đi theo. */
export function RegionHighlight({ root, parts, focus = false, onShown }: { root: RefObject<HTMLElement | null>; parts: RegionPart[]; focus?: boolean; onShown?: (el: HTMLElement) => void }) {
  const [drawn, setDrawn] = useState<DrawnPart[]>([])
  const sig = useRef('')
  const shown = useRef(false)
  useEffect(() => {
    shown.current = false
    const tick = () => {
      const el = root.current
      if (!el) return
      const d = drawParts(parts, lookupFor(el)).map(p => ({ ...p, rects: p.rects.map(pageRect), outline: p.outline && pageRect(p.outline) }))
      const s = JSON.stringify(d.map(p => [p.rects.map(r => [r.x, r.y, r.w, r.h].map(Math.round)), p.approx]))
      if (s !== sig.current) { sig.current = s; setDrawn(d) }
    }
    tick()
    const iv = window.setInterval(tick, 250)          // bố cục đổi âm thầm (ảnh/alphaTab tải muộn, xoay máy): 250 ms/lần, chỉ khi CÓ vùng đang hiển thị
    window.addEventListener('resize', tick)
    return () => { window.clearInterval(iv); window.removeEventListener('resize', tick); sig.current = '' }
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

export default function RegionLayer({ root, onAsk }: { root: RefObject<HTMLElement | null>; onAsk: (parts: RegionPart[], summary: string) => void }) {
  const [mode, setMode] = useState<'off' | 'draw' | 'scroll'>('off')
  const [drag, setDrag] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null)
  const [res, setRes] = useState<{ parts: RegionPart[] } | { hint: string } | null>(null)
  const id = useRef<number | null>(null)
  const off = useCallback(() => { setMode('off'); setDrag(null); setRes(null) }, [])
  useEffect(() => {
    if (mode === 'off') return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') off() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [mode, off])

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    id.current = e.pointerId
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sự kiện không còn hoạt động */ }
    setRes(null); setDrag({ a: { x: e.clientX, y: e.clientY }, b: { x: e.clientX, y: e.clientY } }); e.preventDefault()
  }
  const move = (e: RPointerEvent<HTMLDivElement>) => { if (id.current === e.pointerId) setDrag(d => (d ? { ...d, b: { x: e.clientX, y: e.clientY } } : d)) }
  const up = (e: RPointerEvent<HTMLDivElement>) => {
    if (id.current !== e.pointerId || !drag || !root.current) return
    id.current = null
    const r = buildParts(normRect(drag.a, { x: e.clientX, y: e.clientY }), probeSections(root.current))
    setDrag(null)
    setRes(r.ok ? { parts: r.parts } : { hint: REGION_HINT[r.reason] })
  }

  const live = drag ? normRect(drag.a, drag.b) : null
  const parts = res && 'parts' in res ? res.parts : null
  return (
    <>
      {mode === 'off' && (
        <button type="button" className="lsn-rg-start no-print" data-testid="region-start" onClick={() => setMode('draw')}>
          <PenLine size={16} aria-hidden="true" /> Khoanh vùng để hỏi
        </button>
      )}
      {mode !== 'off' && (
        <div ref={undefined} className={'lsn-rg-capture no-print' + (mode === 'scroll' ? ' is-scroll' : '')} data-testid="region-capture"
          onPointerDown={mode === 'draw' ? down : undefined} onPointerMove={mode === 'draw' ? move : undefined}
          onPointerUp={mode === 'draw' ? up : undefined} onPointerCancel={() => { id.current = null; setDrag(null) }}>
          {live && <div className="lsn-rg-live" style={{ left: live.x, top: live.y, width: live.w, height: live.h }} data-testid="region-live" />}
        </div>
      )}
      {parts && root.current && <RegionHighlight root={root} parts={parts} />}
      {mode !== 'off' && (
        <div className="lsn-textbar lsn-rg-bar no-print" role="region" aria-label="Khoanh vùng để hỏi" data-testid="region-bar" data-state={parts ? 'ok' : res ? 'hint' : 'idle'}>
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
                  {res && 'hint' in res ? res.hint : mode === 'scroll' ? 'Đang ở chế độ Cuộn. Bấm "Vẽ" để khoanh tiếp.' : 'Kéo một khung chữ nhật quanh phần bạn muốn hỏi.'}
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
