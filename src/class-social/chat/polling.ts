// Vòng lặp polling THUẦN (không mạng/supabase) — tách riêng để test được trong Node.
export type Unsubscribe = () => void

export const POLL_MS = { unread: 30_000, list: 15_000, conversation: 4_000, maxBackoff: 60_000 } as const

/** Vòng lặp polling dùng chung. tick trả true = thành công. Trả về hàm dừng. */
export function startPolling(tick: () => Promise<boolean>, everyMs: number): Unsubscribe {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let running = false
  let delay = everyMs
  const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  const clear = () => { if (timer) { clearTimeout(timer); timer = null } }
  const schedule = () => { clear(); if (!stopped && visible()) timer = setTimeout(run, delay) }
  const run = async () => {
    clear()
    if (stopped || running || !visible()) return
    running = true
    const ok = await tick().catch(() => false)
    running = false
    delay = ok ? everyMs : Math.min(delay * 2, POLL_MS.maxBackoff)
    schedule()
  }
  const wake = () => { if (visible()) { delay = everyMs; void run() } else clear() }
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('focus', wake)
  void run()
  return () => {
    stopped = true
    clear()
    document.removeEventListener('visibilitychange', wake)
    window.removeEventListener('focus', wake)
  }
}

