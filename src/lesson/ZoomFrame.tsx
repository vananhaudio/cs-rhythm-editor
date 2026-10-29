// ── Khung xem có chế độ TOÀN MÀN HÌNH ──
// Bản nhạc và sơ đồ cần đàn không vừa màn dọc điện thoại, mà phóng to trong một ô
// nhỏ thì vẫn khó đọc. "Xem lớn" ở đây phủ kín màn hình, cuộn được cả hai chiều,
// và có nút phóng to / thu nhỏ để tự chỉnh cho vừa mắt.
//
// KHÔNG dùng CSS `zoom` để phóng: nó làm alphaTab đo sai bề ngang khung (nốt dồn
// cục) và làm kẹt thao tác kéo trên máy cảm ứng. Sơ đồ phóng bằng bề rộng của SVG,
// bản nhạc phóng bằng chính cỡ khắc nhạc của alphaTab (xem LessonScore).
//
// Chế độ LUYỆN ĐÀN (lát 2): thanh công cụ tự ẩn sau vài giây, chạm một lần để hiện lại;
// chạm hai lần = phóng / về vừa màn hình; chụm hai ngón = đổi mức phóng (nhảy theo bậc);
// nút ▲▼ cuộn nửa màn hình; nhớ mức phóng + vị trí đang đọc; giữ màn hình sáng (Wake Lock).
// Mọi phần phụ trợ (Wake Lock, localStorage) lỗi thì lặng lẽ bỏ qua — không bao giờ cản việc đọc nhạc.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

const STEPS = [1, 1.4, 1.8, 2.4]
const OPEN_STEP = 1      // mở "Xem lớn" ở 140% — mở ra mà vẫn 100% thì chẳng lớn hơn bản nhạc đang xem
const HIDE_MS = 3000     // thanh công cụ tự ẩn sau ngần ấy
const DOUBLE_MS = 300    // hai lần chạm cách nhau không quá ngần ấy = chạm đúp
const STORE = 'tva.score.read.v1:'

type Saved = { step: number; r: number }
const load = (key?: string): Saved | null => {
  if (!key) return null
  try {
    const v = JSON.parse(localStorage.getItem(STORE + key) || 'null')
    if (v && Number.isInteger(v.step) && v.step >= 0 && v.step < STEPS.length && typeof v.r === 'number') return { step: v.step, r: Math.min(1, Math.max(0, v.r)) }
  } catch { /* */ }
  return null
}
const save = (key: string | undefined, v: Saved) => {
  if (!key) return
  try { localStorage.setItem(STORE + key, JSON.stringify(v)) } catch { /* */ }
}

// Chụm hai ngón: tỉ lệ khoảng cách cuối/đầu → số bậc nhảy (không phóng liên tục vì mỗi lần đổi alphaTab phải khắc lại)
const pinchSteps = (ratio: number) => (ratio > 1.7 ? 2 : ratio > 1.15 ? 1 : ratio < 0.55 ? -2 : ratio < 0.87 ? -1 : 0)

export default function ZoomFrame(
  { children, hint, onZoom, enabled = true, memoryKey, limitFactor }:
  { children: ReactNode; hint?: string; onZoom?: (big: boolean, factor: number) => void; enabled?: boolean; memoryKey?: string;
    /** hệ số phóng tối đa an toàn cho nội dung (vd. bản có lời: lời chồng nhau nếu phóng quá bề rộng khung); hỏi lại mỗi lần mở */
    limitFactor?: () => number },
) {
  const [big, setBig] = useState(false)
  const [step, setStep] = useState(1)
  const [tools, setTools] = useState(true)
  const [top, setTop] = useState(STEPS.length - 1)      // bậc phóng cao nhất được phép
  const topRef = useRef(top)
  const factor = STEPS[Math.min(step, top)]
  const innerRef = useRef<HTMLDivElement>(null)
  const hideT = useRef<number | undefined>(undefined)
  const tapT = useRef<number | undefined>(undefined)
  const lastTap = useRef(0)
  const restore = useRef<{ r: number; until: number } | null>(null)
  const pinch = useRef<{ d0: number; d: number } | null>(null)
  const pinchedAt = useRef(0)
  const stepRef = useRef(step)
  useEffect(() => { stepRef.current = step }, [step])

  useEffect(() => { onZoom?.(big, factor) }, [big, factor])   // eslint-disable-line react-hooks/exhaustive-deps

  const ratio = () => { const el = innerRef.current; return el && el.scrollHeight > 0 ? el.scrollTop / el.scrollHeight : 0 }
  const remember = useCallback(() => save(memoryKey, { step: stepRef.current, r: ratio() }), [memoryKey])

  // Đổi mức phóng: alphaTab khắc lại nên chiều cao đổi — giữ đúng đoạn đang đọc
  const changeStep = (next: number) => {
    const n = Math.max(0, Math.min(topRef.current, next))
    if (n === stepRef.current) return
    restore.current = { r: ratio(), until: Date.now() + 4000 }
    setStep(n)
  }

  // Tự ẩn thanh công cụ
  const poke = useCallback(() => {
    setTools(true)
    window.clearTimeout(hideT.current)
    hideT.current = window.setTimeout(() => setTools(false), HIDE_MS)
  }, [])
  const openBig = () => {
    const sv = load(memoryKey)
    const lim = limitFactor ? limitFactor() : Infinity
    const t = Math.max(0, STEPS.reduce((a, f, i) => (f <= lim ? i : a), 0))
    topRef.current = t; setTop(t)
    setStep(Math.min(t, sv ? sv.step : OPEN_STEP))
    restore.current = sv && sv.r > 0 ? { r: sv.r, until: Date.now() + 4000 } : null
    poke()
    setBig(true)
  }
  const closeBig = () => { remember(); setBig(false) }

  useEffect(() => () => { window.clearTimeout(hideT.current); window.clearTimeout(tapT.current) }, [])

  useEffect(() => {
    if (!big) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeBig() }
    window.addEventListener('keydown', onKey)
    const saved = document.body.style.overflow
    document.body.style.overflow = 'hidden'          // khoá cuộn nền khi đang xem lớn
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = saved }
  }, [big])   // eslint-disable-line react-hooks/exhaustive-deps

  // Giữ màn hình sáng khi Luyện đàn; tự nhả khi đóng / khi app xuống nền (hệ thống nhả, quay lại thì xin lại)
  useEffect(() => {
    if (!big) return
    let lock: { release: () => Promise<void> } | null = null
    let dead = false
    const ask = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
        if (!wl || document.visibilityState !== 'visible') return
        const l = await wl.request('screen')
        if (dead) { l.release().catch(() => {}); return }
        lock = l
      } catch { /* không hỗ trợ / bị từ chối — bỏ qua */ }
    }
    const onVis = () => { if (document.visibilityState === 'visible') ask() }
    ask()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      dead = true
      document.removeEventListener('visibilitychange', onVis)
      try { lock?.release().catch(() => {}) } catch { /* */ }
    }
  }, [big])

  // Khôi phục vị trí đọc: bản nhạc khắc xong mới có chiều cao, nên bám theo mỗi lần nội dung đổi cỡ
  useEffect(() => {
    if (!big || typeof ResizeObserver === 'undefined') return
    const el = innerRef.current
    if (!el) return
    const apply = () => {
      const r = restore.current
      if (!r) return
      if (Date.now() > r.until) { restore.current = null; return }
      if (el.scrollHeight > el.clientHeight + 1) el.scrollTop = r.r * el.scrollHeight
    }
    const ro = new ResizeObserver(apply)
    ;[...el.children].forEach(c => ro.observe(c))
    apply()
    const stop = () => { restore.current = null }       // người học đã tự cuộn → thôi can thiệp
    el.addEventListener('touchstart', stop, { passive: true })
    el.addEventListener('wheel', stop, { passive: true })
    return () => { ro.disconnect(); el.removeEventListener('touchstart', stop); el.removeEventListener('wheel', stop) }
  }, [big, step])

  // Lưu vị trí khi cuộn (thưa) và khi rời trang
  useEffect(() => {
    if (!big) return
    const el = innerRef.current
    if (!el) return
    let t: number | undefined
    const onScroll = () => { window.clearTimeout(t); t = window.setTimeout(remember, 400) }
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', remember)
    return () => { window.clearTimeout(t); el.removeEventListener('scroll', onScroll); window.removeEventListener('pagehide', remember) }
  }, [big, remember])

  // Chụm hai ngón
  useEffect(() => {
    if (!big) return
    const el = innerRef.current
    if (!el) return
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const start = (e: TouchEvent) => { if (e.touches.length === 2) { const d = dist(e.touches); pinch.current = { d0: d, d } } }
    const move = (e: TouchEvent) => { if (pinch.current && e.touches.length === 2) pinch.current.d = dist(e.touches) }
    const end = (e: TouchEvent) => {
      const p = pinch.current
      if (!p || e.touches.length >= 2) return
      pinch.current = null
      pinchedAt.current = Date.now()
      const n = pinchSteps(p.d / (p.d0 || 1))
      if (n) changeStep(stepRef.current + n)
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: true })
    el.addEventListener('touchend', end, { passive: true })
    el.addEventListener('touchcancel', end, { passive: true })
    return () => {
      el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end)
    }
  }, [big])   // eslint-disable-line react-hooks/exhaustive-deps

  // Chạm một lần = hiện / ẩn thanh công cụ; chạm hai lần = phóng ↔ vừa màn hình. Chờ hết DOUBLE_MS mới coi là chạm đơn.
  const onTap = () => {
    if (Date.now() - pinchedAt.current < 400) return
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_MS) {
      lastTap.current = 0
      window.clearTimeout(tapT.current)
      changeStep(stepRef.current === 0 ? 2 : 0)   // 2 vượt bậc tối đa thì tự bị kẹp lại
      return
    }
    lastTap.current = now
    window.clearTimeout(tapT.current)
    tapT.current = window.setTimeout(() => {
      if (tools) { window.clearTimeout(hideT.current); setTools(false) } else poke()
    }, DOUBLE_MS)
  }

  const page = (dir: 1 | -1) => {
    const el = innerRef.current
    if (!el) return
    restore.current = null
    el.scrollBy({ top: dir * Math.round(el.clientHeight * 0.5), behavior: 'smooth' })
    poke()
  }

  return (
    <div className={`lsn-zoom-frame${big ? ' is-big' : ''}${big && !tools ? ' tools-off' : ''}`}
         style={{ ['--zoom' as string]: factor }}>
      <div className="lsn-zoom-inner" ref={innerRef} onClick={big ? onTap : undefined}>{children}</div>
      {hint && !big && <p className="lsn-zoom-hint no-print">{hint}</p>}

      {big && (
        <>
          <div className="lsn-zoom-tools no-print" onPointerDown={poke}>
            <button type="button" onClick={() => changeStep(step - 1)} disabled={step === 0}
                    aria-label="Thu nhỏ">−</button>
            <span>{Math.round(factor * 100)}%</span>
            <button type="button" onClick={() => changeStep(step + 1)}
                    disabled={step >= top} aria-label="Phóng to">+</button>
            <button type="button" className="lsn-zoom-close" onClick={closeBig}>✕ Đóng</button>
          </div>
          <div className="lsn-zoom-pager no-print" onPointerDown={poke}>
            <button type="button" onClick={() => page(-1)} aria-label="Lên nửa màn hình">▲</button>
            <button type="button" onClick={() => page(1)} aria-label="Xuống nửa màn hình">▼</button>
          </div>
        </>
      )}
      {!big && enabled && (
        <button type="button" className="lsn-zoom-btn no-print" onClick={openBig}>↗ Xem lớn</button>
      )}
    </div>
  )
}
