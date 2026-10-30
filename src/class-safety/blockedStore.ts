// Danh sách người vừa bị chặn/bỏ chặn TRONG PHIÊN này — để ẩn nội dung ngay trên màn đang mở (không chờ nạp lại).
// Nguồn sự thật vẫn là server (class_user_blocks + hàm *_safe); store này chỉ là lớp phản hồi tức thì.
import { useSyncExternalStore } from 'react'

let blocked: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function markBlocked(userId: string) { if (!blocked.has(userId)) { blocked = new Set(blocked).add(userId); emit() } }
export function markUnblocked(userId: string) {
  if (blocked.has(userId)) { const n = new Set(blocked); n.delete(userId); blocked = n; emit() }
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

/** true nếu người này vừa bị chặn trong phiên (ẩn ngay nội dung của họ) */
export function useIsBlocked(userId: string | null | undefined): boolean {
  return useSyncExternalStore(subscribe, () => (userId ? blocked.has(userId) : false), () => false)
}

/** Tập người vừa bị chặn trong phiên (dùng khi cần lọc cả danh sách) */
export function useBlockedSet(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => blocked, () => blocked)
}
