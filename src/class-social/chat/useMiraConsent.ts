// Trạng thái đồng ý tham gia Mira (V1.1). Nguồn sự thật = SERVER (ai_consent_status). Lỗi mạng ⇒ 'error' (KHÔNG BAO GIỜ coi là đã đồng ý).
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMiraConsent, grantMiraConsent, withdrawMiraConsent, type MiraConsent } from './miraApi'

export type MiraConsentView =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; consent: MiraConsent }

export function useMiraConsent() {
  const [view, setView] = useState<MiraConsentView>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const refresh = useCallback(async () => {
    const c = await fetchMiraConsent()
    if (alive.current) setView(c ? { status: 'ready', consent: c } : { status: 'error' })
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const grant = useCallback(async () => {
    if (view.status !== 'ready' || !view.consent.notice || busy) return false
    setBusy(true); setActionError(null)
    const c = await grantMiraConsent(view.consent.notice.version)
    if (!alive.current) return false
    setBusy(false)
    if (c && c.state === 'granted') { setView({ status: 'ready', consent: c }); return true }
    setActionError('Chưa ghi nhận được sự đồng ý. Bạn thử lại nhé.')
    void refresh()   // phiên bản có thể vừa đổi
    return false
  }, [view, busy, refresh])

  const withdraw = useCallback(async () => {
    if (busy) return false
    setBusy(true); setActionError(null)
    const ok = await withdrawMiraConsent()
    if (!alive.current) return false
    setBusy(false)
    if (!ok) { setActionError('Chưa rút lại được. Bạn thử lại nhé.'); return false }
    await refresh()
    return true
  }, [busy, refresh])

  return { view, busy, actionError, refresh, grant, withdraw }
}
