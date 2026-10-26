// Cổng Quy tắc cộng đồng (Guideline 1.2): chặn khung Class Mobile sau đăng nhập tới khi chấp nhận version hiện hành.
// Chỉ hỏi 1 lần (server nhớ accepted_version). Lỗi mạng / RPC chưa có → hiện lỗi + Thử lại (+ Đăng xuất), KHÔNG khoá vĩnh viễn.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { acceptUgc, fetchUgcStatus } from './api'
import { COMMUNITY_RULES, PRIVACY_URL, SUPPORT_EMAIL, SUPPORT_ZALO_URL, gateState, type UgcStatus } from './model'

type St = { s: 'loading' } | { s: 'error'; msg: string } | { s: 'needs'; status: UgcStatus } | { s: 'ok' }

export default function CommunityRulesGate({ children, onSignOut }: { children: ReactNode; onSignOut?: () => void }) {
  const [st, setSt] = useState<St>({ s: 'loading' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const lock = useRef(false)

  const [rev, setRev] = useState(0)
  const retry = () => { setSt({ s: 'loading' }); setRev(x => x + 1) }
  useEffect(() => {
    let alive = true
    void fetchUgcStatus().then(r => {
      if (!alive) return
      const g = gateState(r.ok ? { ok: true, status: r.value } : { ok: false })
      if (g === 'ok') setSt({ s: 'ok' })
      else if (g === 'needs-accept' && r.ok) setSt({ s: 'needs', status: r.value })
      else setSt({ s: 'error', msg: r.ok ? '' : r.message })
    })
    return () => { alive = false }
  }, [rev])

  if (st.s === 'ok') return <>{children}</>

  const accept = async (version: number) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setErr('')
    const r = await acceptUgc(version)
    lock.current = false; setBusy(false)
    if (r.ok) setSt({ s: 'ok' }); else setErr(r.message)
  }

  return (
    <div className="csafe-gate" role="dialog" aria-modal="true" aria-label="Quy tắc cộng đồng">
      <div className="csafe-gate-in">
        {st.s === 'loading' && <p role="status" style={{ textAlign: 'center', marginTop: 80 }}>Đang mở Class…</p>}
        {st.s === 'error' && (
          <>
            <h1>Chưa kết nối được</h1>
            <p className="csafe-sub" role="alert">{st.msg || 'Chưa kiểm tra được quy tắc cộng đồng.'} Bạn thử lại nhé.</p>
            <button type="button" className="csafe-btn primary" onClick={retry}>Thử lại</button>
            {onSignOut && <button type="button" className="csafe-btn" onClick={onSignOut}>Đăng xuất</button>}
          </>
        )}
        {st.s === 'needs' && (
          <>
            <h1>Quy tắc cộng đồng</h1>
            <p className="csafe-sub">Class là nơi học và chia sẻ âm nhạc. Để mọi người cùng thấy an toàn, bạn vui lòng đồng ý các quy tắc sau.</p>
            {COMMUNITY_RULES.map(r => <div key={r.title} className="csafe-rule"><b>{r.title}</b><span>{r.body}</span></div>)}
            <p className="csafe-sub" style={{ marginTop: 12 }}>
              Cần hỗ trợ? Nhắn <a href={SUPPORT_ZALO_URL} target="_blank" rel="noopener noreferrer">Zalo của Thầy</a> hoặc email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.{' '}
              <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Chính sách bảo mật</a>.
            </p>
            {err && <div className="csafe-err" role="alert">{err}</div>}
            <button type="button" className="csafe-btn primary" disabled={busy} onClick={() => void accept(st.status.requiredVersion)}>
              {busy ? 'Đang lưu…' : err ? 'Thử lại' : 'Tôi đồng ý và tiếp tục'}
            </button>
            {onSignOut && <button type="button" className="csafe-btn" onClick={onSignOut} disabled={busy}>Đăng xuất</button>}
          </>
        )}
      </div>
    </div>
  )
}
