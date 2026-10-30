// Class Mobile V1.2 — bàn phím mở thì ẩn thanh tab (iOS: thanh tab cố định dưới đáy bị bàn phím đẩy/che, mất chỗ nhập).
// Suy ra từ ô nhập đang được chọn, không cần plugin Keyboard (không thêm phụ thuộc native).
import { useEffect, useState } from 'react'

const NON_TEXT_INPUT = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'image', 'range', 'color'])

/** Phần tử này có gọi bàn phím chữ không (pure — dùng để test). */
export function isTextEntry(tag: string, type?: string | null, editable?: boolean): boolean {
  const t = tag.toLowerCase()
  if (t === 'textarea') return true
  if (t === 'input') return !NON_TEXT_INPUT.has((type ?? 'text').toLowerCase())
  return !!editable
}

const entry = (el: Element | null) =>
  !!el && isTextEntry(el.tagName, el.getAttribute('type'), (el as HTMLElement).isContentEditable)

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onIn = (e: FocusEvent) => { if (entry(e.target as Element)) setOpen(true) }
    // chuyển ô nhập → ô nhập khác không được nhấp nháy: đợi một nhịp rồi xem ô nào đang được chọn
    const onOut = () => { window.setTimeout(() => setOpen(entry(document.activeElement)), 60) }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut) }
  }, [])
  return open
}
