// Giữ vị trí đọc khi danh sách bình luận đổi (Lát D). Safari/WebKit KHÔNG hỗ trợ CSS overflow-anchor → tự bù.
// Cách làm: ngay lúc render có dữ liệu mới (DOM vẫn là bản CŨ) đo bình luận đầu tiên đang nằm trong khung nhìn; sau khi commit
// (useLayoutEffect, trước khi vẽ) đo lại và cuộn bù đúng phần lệch. Chỉ bù khi có lệch → không tự cuộn, không nhảy trang.
import { useLayoutEffect, useRef, type RefObject } from 'react'

type Snap = { el: Element; top: number; sc: HTMLElement | null }

export function scrollParent(el: Element | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const o = window.getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll' || o === 'overlay') && p.scrollHeight > p.clientHeight) return p
  }
  return null   // cuộn theo cửa sổ
}

export function measureAnchor(root: Element | null, selector = '[data-comment-id]'): Snap | null {
  if (!root) return null
  const sc = scrollParent(root)
  const bound = sc ? sc.getBoundingClientRect().top : 0
  for (const el of Array.from(root.querySelectorAll(selector))) {
    const r = el.getBoundingClientRect()
    if (r.bottom > bound + 1) return { el, top: r.top, sc }
  }
  return null
}

export function applyAnchor(s: Snap | null) {
  if (!s || !s.el.isConnected) return
  const d = s.el.getBoundingClientRect().top - s.top
  if (Math.abs(d) < 0.5) return
  if (s.sc) s.sc.scrollTop += d
  else window.scrollBy(0, d)
}

/** `deps` đổi (danh sách / số dòng đang hiện đổi) → bù cuộn để bình luận đang đọc đứng yên. */
export function useScrollAnchor(ref: RefObject<Element | null>, deps: readonly unknown[]) {
  const last = useRef(deps)
  const snap = useRef<Snap | null>(null)
  if (last.current.length !== deps.length || last.current.some((d, i) => d !== deps[i])) { last.current = deps; snap.current = measureAnchor(ref.current) }   // render-phase: DOM chưa commit
  useLayoutEffect(() => { const s = snap.current; snap.current = null; applyAnchor(s) })
}
