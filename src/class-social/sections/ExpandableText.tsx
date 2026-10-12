// Văn bản dài mặc định thu gọn (line-clamp) + "Xem thêm" / "Thu gọn" — kiểu Facebook.
// Chỉ hiện nút khi nội dung THỰC SỰ bị cắt (đo bằng scrollHeight) → bài/bình luận ngắn không đổi gì.
// Plain text: React tự escape, xuống dòng giữ bằng CSS (pre-wrap, qua className).
import { useLayoutEffect, useRef, useState } from 'react'

export default function ExpandableText({ text, className, lines }: { text: string; className: string; lines: number }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  // Đo khi đang thu gọn (nội dung/độ rộng đổi → đo lại). Khi đã mở giữ kết quả đo cũ để còn nút "Thu gọn".
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => { if (!open) setOverflowing(el.scrollHeight > el.clientHeight + 1) }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, open, lines])

  const toggle = () => {
    const el = ref.current
    if (open && el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'nearest' })   // thu gọn bài đang cuộn qua → không bị nhảy mất ngữ cảnh
    setOpen(o => !o)
  }

  const clamped = !open
  return (
    <>
      <p ref={ref} className={`${className} cs-clamp${clamped ? ' is-clamped' : ''}`} style={{ ['--cs-clamp-lines' as string]: lines }}>{text}</p>
      {(overflowing || open) && (
        <button type="button" className="cs-link-btn cs-clamp-toggle" aria-expanded={open} onClick={toggle}>
          {open ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </>
  )
}
