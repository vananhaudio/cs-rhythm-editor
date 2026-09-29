import { useState } from 'react'

/**
 * Tab của một màn (Tường | Hành trình, Hoạt động | Thành viên) NHỚ trong mục lịch sử hiện tại
 * (history.state) → mở một cuộc trao đổi rồi "Quay lại" về đúng tab đang xem. Không đổi URL.
 */
export function useHistoryTab<T extends string>(key: string, initial: T, allowed: readonly T[]): [T, (t: T) => void] {
  const [tab, setTab] = useState<T>(() => {
    const saved = (window.history.state as Record<string, unknown> | null)?.[key]
    return allowed.includes(saved as T) ? saved as T : initial
  })
  const pick = (t: T) => {
    setTab(t)
    try { window.history.replaceState({ ...(window.history.state ?? {}), [key]: t }, '') } catch { /* bỏ qua */ }
  }
  return [tab, pick]
}
