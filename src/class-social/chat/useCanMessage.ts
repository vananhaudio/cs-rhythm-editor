import { useEffect, useState } from 'react'
import { canMessage } from './chatApi'

/** Server quyết mình có nhắn được người này không (dm_can_message). null = đang hỏi / lỗi → không hiện nút. `dep` đổi (vd. quan hệ bạn bè) → hỏi lại. */
export function useCanMessage(userId: string, enabled: boolean, dep?: unknown): boolean | null {
  const [state, setState] = useState<{ key: string; can: boolean } | null>(null)
  const key = `${userId}|${String(dep)}`
  useEffect(() => {
    if (!enabled) return
    let alive = true
    void canMessage(userId).then(r => { if (alive) setState({ key, can: r.ok && r.value }) })
    return () => { alive = false }
  }, [userId, enabled, key])
  return enabled && state?.key === key ? state.can : null
}
