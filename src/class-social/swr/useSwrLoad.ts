// Hook nạp-có-đệm: có bản đệm → 'ready' NGAY ở lần render đầu (không "Đang tải…", không làm mờ), rồi hỏi server ở nền.
// Server trả OK → thay dữ liệu + ghi đệm. Server trả lỗi → xoá đệm và báo lỗi (an toàn khi mất quyền); riêng khi máy
// OFFLINE thì giữ bản đệm đang hiện. Đổi key = nạp lại (hiện đệm của key mới nếu có).
import { useCallback, useEffect, useRef, useState } from 'react'
import { dropSwr, peekSwr, putSwr } from './swrCache'

export type SwrLoad<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T }
type R<T> = { ok: true; value: T } | { ok: false; message: string }

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false

export function useSwrLoad<T>(key: string | null, fetcher: () => Promise<R<T>>, opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled !== false && key != null
  const seed = (k: string | null): SwrLoad<T> => {
    const c = k ? peekSwr<T>(k) : undefined
    return c !== undefined ? { status: 'ready', value: c } : { status: 'loading' }
  }
  const [state, setState] = useState<SwrLoad<T>>(() => seed(key))
  const [seenKey, setSeenKey] = useState(key)
  if (seenKey !== key) { setSeenKey(key); setState(seed(key)) }   // đổi key: hiện đệm của key mới ngay trong lượt render
  const fetchRef = useRef(fetcher)
  useEffect(() => { fetchRef.current = fetcher })
  const [rev, setRev] = useState(0)

  useEffect(() => {
    if (!enabled || !key) return
    let alive = true
    void fetchRef.current().then(r => {
      if (!alive) return
      if (r.ok) { putSwr(key, r.value); setState({ status: 'ready', value: r.value }); return }
      setState(s => {
        if (s.status === 'ready' && offline()) return s
        dropSwr(key)
        return { status: 'error', message: r.message }
      })
    })
    return () => { alive = false }
  }, [key, enabled, rev])

  const reload = useCallback(() => setRev(x => x + 1), [])
  /** Cập nhật cục bộ sau thao tác ghi (vd. đổi quan hệ bạn bè) — cũng cập nhật đệm. */
  const mutate = useCallback((fn: (v: T) => T) => {
    setState(s => {
      if (s.status !== 'ready') return s
      const value = fn(s.value)
      if (key) putSwr(key, value)
      return { status: 'ready', value }
    })
  }, [key])
  return { state, reload, mutate }
}
