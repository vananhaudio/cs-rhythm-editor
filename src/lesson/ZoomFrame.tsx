// ── Khung xem có nút phóng TOÀN MÀN HÌNH ──
// Trên điện thoại, bản nhạc và sơ đồ cần đàn không thể vừa màn dọc. Phóng to trong
// một ô nhỏ thì vẫn khó đọc, nên ở đây "Xem lớn" = phủ kín màn hình, cuộn được cả
// hai chiều, xoay ngang máy là đọc thoải mái.
import { useEffect, useState, type ReactNode } from 'react'

export default function ZoomFrame(
  { children, hint, onZoom }: { children: ReactNode; hint?: string; onZoom?: (big: boolean) => void },
) {
  const [big, setBig] = useState(false)
  useEffect(() => { onZoom?.(big) }, [big])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!big) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBig(false) }
    window.addEventListener('keydown', onKey)
    const saved = document.body.style.overflow
    document.body.style.overflow = 'hidden'          // khoá cuộn nền khi đang xem lớn
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = saved }
  }, [big])

  return (
    <div className={`lsn-zoom-frame${big ? ' is-big' : ''}`}>
      <div className="lsn-zoom-inner">{children}</div>
      {hint && !big && <p className="lsn-zoom-hint no-print">{hint}</p>}
      {big && <p className="lsn-zoom-rotate no-print">Xoay ngang điện thoại để xem rộng hơn</p>}
      <button type="button" className="lsn-zoom-btn no-print" onClick={() => setBig(v => !v)}>
        {big ? '✕ Đóng' : '↗ Xem lớn'}
      </button>
    </div>
  )
}
