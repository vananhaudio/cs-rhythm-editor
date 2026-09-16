// ── Khung xem có chế độ TOÀN MÀN HÌNH ──
// Bản nhạc và sơ đồ cần đàn không vừa màn dọc điện thoại, mà phóng to trong một ô
// nhỏ thì vẫn khó đọc. "Xem lớn" ở đây phủ kín màn hình, cuộn được cả hai chiều,
// và có nút phóng to / thu nhỏ để tự chỉnh cho vừa mắt.
//
// KHÔNG dùng CSS `zoom` để phóng: nó làm alphaTab đo sai bề ngang khung (nốt dồn
// cục) và làm kẹt thao tác kéo trên máy cảm ứng. Sơ đồ phóng bằng bề rộng của SVG,
// bản nhạc phóng bằng chính cỡ khắc nhạc của alphaTab (xem LessonScore).
import { useEffect, useState, type ReactNode } from 'react'

const STEPS = [1, 1.4, 1.8, 2.4]

export default function ZoomFrame(
  { children, hint, onZoom, enabled = true }:
  { children: ReactNode; hint?: string; onZoom?: (big: boolean, factor: number) => void; enabled?: boolean },
) {
  const [big, setBig] = useState(false)
  const [step, setStep] = useState(1)
  const factor = STEPS[step]

  useEffect(() => { onZoom?.(big, factor) }, [big, factor])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!big) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBig(false) }
    window.addEventListener('keydown', onKey)
    const saved = document.body.style.overflow
    document.body.style.overflow = 'hidden'          // khoá cuộn nền khi đang xem lớn
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = saved }
  }, [big])

  return (
    <div className={`lsn-zoom-frame${big ? ' is-big' : ''}`}
         style={{ ['--zoom' as string]: factor }}>
      <div className="lsn-zoom-inner">{children}</div>
      {hint && !big && <p className="lsn-zoom-hint no-print">{hint}</p>}

      {big && (
        <div className="lsn-zoom-tools no-print">
          <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
                  aria-label="Thu nhỏ">−</button>
          <span>{Math.round(factor * 100)}%</span>
          <button type="button" onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                  disabled={step === STEPS.length - 1} aria-label="Phóng to">+</button>
          <button type="button" className="lsn-zoom-close" onClick={() => setBig(false)}>✕ Đóng</button>
        </div>
      )}
      {!big && enabled && (
        <button type="button" className="lsn-zoom-btn no-print" onClick={() => setBig(true)}>↗ Xem lớn</button>
      )}
    </div>
  )
}
