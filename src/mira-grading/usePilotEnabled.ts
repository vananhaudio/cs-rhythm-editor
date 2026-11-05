import { useEffect, useState } from 'react'
import type { MiraGradingApi } from './api'

/** Hỏi server "tôi có được dùng Mira không" (một lần). Chưa biết / không được / lỗi → false. */
export function usePilotEnabled(api: MiraGradingApi, wanted: boolean): boolean {
  const [state, setState] = useState<{ api: MiraGradingApi; value: boolean } | null>(null)
  useEffect(() => {
    if (!wanted) return
    let alive = true
    void api.pilotEnabled().then(v => { if (alive) setState({ api, value: v }) })
    return () => { alive = false }
  }, [api, wanted])
  return wanted && state?.api === api && state.value
}
