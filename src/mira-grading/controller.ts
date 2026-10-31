// Bộ điều khiển khung Mira — phần thuần (không DOM/React) để kiểm thử cách ly.
//   · Khi đổi bài trả: tăng epoch, huỷ kết quả vé cũ, cấp vé MỚI cho bài mới, báo iframe. Kết quả đến muộn của bài cũ bị bỏ.
//   · Vé sống 5 phút: gia hạn (cấp vé mới) trước khi hết; iframe báo hết hạn → cấp lại ngay.
//   · Thu hồi vé của bài cũ khi chuyển bài/đóng khung.
import type { ChildMessage, ClearMessage, ContextMessage } from './protocol'
import type { MiraGradingApi } from './api'

export const RENEW_MS = 3 * 60_000
/** Iframe xin vé lại: tối đa một lần / 5 giây cho mỗi bài — chặn vòng lặp xin-vé-liên-tục nếu Mira bị cấu hình sai. */
export const NEED_COOLDOWN_MS = 5_000

export type DockStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'denied' | 'error'
export type Deps = {
  api: MiraGradingApi
  post: (m: ContextMessage | ClearMessage) => void   // gửi tới iframe (đã ghim origin ở nơi gọi)
  onStatus: (s: DockStatus) => void
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (h: unknown) => void
  now?: () => number
}

export function createDockController(deps: Deps) {
  const setT = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clrT = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  let epoch = 0, seq = 0
  let thread: string | null = null
  let childReady = false
  let timer: unknown = null
  let disposed = false
  let lastIssue = -Infinity
  const now = deps.now ?? (() => Date.now())

  const stopTimer = () => { if (timer != null) { clrT(timer); timer = null } }

  async function issue(): Promise<void> {
    if (disposed || !thread || !childReady) return
    const my = epoch, id = thread
    lastIssue = now()
    deps.onStatus('loading')
    const r = await deps.api.ticket(id)
    if (disposed || my !== epoch || id !== thread) {
      // Đã chuyển bài/đóng trong lúc chờ: vé vừa cấp thuộc bài cũ → thu hồi, KHÔNG gửi cho iframe.
      if (r.ok) void deps.api.end(id)
      return
    }
    // 'forbidden' = server không cho (tài khoản không (còn) trong pilot, hoặc mất vai) → ẩn khung, không báo lỗi gây rối
    if (!r.ok) { deps.onStatus(r.reason === 'unavailable' ? 'unavailable' : r.reason === 'forbidden' ? 'denied' : 'error'); return }
    deps.post({ v: 1, type: 'mira-context', kind: 'learning_thread', id, ticket: r.value.ticket, expiresAt: r.value.expiresAt, seq: ++seq })
    deps.onStatus('ready')
    stopTimer()
    timer = setT(() => { timer = null; void issue() }, RENEW_MS)
  }

  return {
    /** Thầy mở/đổi sang một bài trả. */
    setThread(id: string | null) {
      if (id === thread) return
      const old = thread
      epoch++; stopTimer(); thread = id
      if (old) void deps.api.end(old)
      if (!id) { if (childReady) deps.post({ v: 1, type: 'mira-context-clear', seq: ++seq }); deps.onStatus('idle'); return }
      void issue()
    },
    /** Tin từ iframe (đã qua acceptChildMessage). */
    onChild(m: ChildMessage) {
      if (m.type === 'mira-grading-ready') { childReady = true; void issue(); return }
      if (m.type === 'mira-grading-need-ticket' && m.id.toLowerCase() === thread?.toLowerCase() && now() - lastIssue >= NEED_COOLDOWN_MS) void issue()
    },
    dispose() {
      disposed = true; epoch++; stopTimer()
      if (thread) void deps.api.end(thread)
      thread = null
    },
  }
}
