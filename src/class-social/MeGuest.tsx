// /me khi CHƯA vào được trang chủ học sinh — vẫn ở /me, không chuyển sang /start hay /learn.
//  • MeGuestGate  : chưa đăng nhập → đăng nhập ngay tại đây (Supabase auth chung với trang Class).
//  • MeNoProfile  : đã đăng nhập nhưng tài khoản chưa có hồ sơ học sinh → đăng xuất / App học / Trang Class.
// Đăng nhập xong, useClassSession nhận sự kiện SIGNED_IN và tự hiện trang chủ học sinh.
import { useState, type FormEvent, type ReactNode } from 'react'
import { CLASS_HOME_PATH, LEARN_PATH } from './resolveMeRoute'
import { ClassHomeLink } from './ui'

function GuestFrame({ children }: { children: ReactNode }) {
  return (
    <div className="cs-root">
      <header className="cs-topbar">
        <a className="cs-brand" href={CLASS_HOME_PATH} aria-label="Thầy Văn Anh Guitar — Trang Class">
          <img className="cs-brand-logo" src="/logo-green.svg" alt="" width={30} height={29} />
          <span className="cs-brand-text">Thầy Văn Anh Guitar</span>
        </a>
        <div className="cs-topbar-spacer" />
        <ClassHomeLink />
      </header>
      <main className="cs-guest">
        <section className="cs-card cs-guest-card">{children}</section>
      </main>
    </div>
  )
}

export function MeGuestGate({ signIn }: {
  /** Đăng nhập bằng Supabase auth dùng chung (profileApi.signInWithPassword) — trả lỗi hoặc null */
  signIn: (email: string, password: string) => Promise<string | null>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setErr('')
    setBusy(true)
    const msg = await signIn(email, password)
    setBusy(false)
    if (msg) setErr(msg)
    // Thành công: không chuyển trang — /me tự đổi sang trang chủ học sinh.
  }

  return (
    <GuestFrame>
      <div className="cs-guest-kicker">Class · Hành trình học sinh</div>
      <h1 className="cs-guest-title">Đăng nhập vào Hành trình của bạn</h1>
      <p className="cs-guest-lead">Trang chủ học sinh của lớp Thầy Văn Anh Guitar: bài trả, cộng đồng lớp và công cụ luyện tập.</p>
      <form className="cs-guest-form" onSubmit={e => void submit(e)} noValidate>
        <label className="cs-guest-label" htmlFor="cs-login-email">Email</label>
        <input id="cs-login-email" className="cs-guest-input" type="email" autoComplete="email" inputMode="email"
          placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        <label className="cs-guest-label" htmlFor="cs-login-pass">Mật khẩu</label>
        <input id="cs-login-pass" className="cs-guest-input" type="password" autoComplete="current-password"
          placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} />
        {err && <div className="cs-guest-err" role="alert">{err}</div>}
        <button type="submit" className="cs-btn cs-btn-primary cs-guest-submit" disabled={busy}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
      <p className="cs-guest-foot">
        Chưa có tài khoản? <a href={CLASS_HOME_PATH}>Xem các lớp đang tuyển ở Trang Class</a>
      </p>
    </GuestFrame>
  )
}

export function MeNoProfile({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  return (
    <GuestFrame>
      <div className="cs-guest-kicker">Class · Hành trình học sinh</div>
      <h1 className="cs-guest-title">Tài khoản chưa có hồ sơ học sinh</h1>
      <p className="cs-guest-lead">
        {email ? <>Bạn đang đăng nhập bằng <b>{email}</b>. </> : null}
        Tài khoản này chưa gắn với lớp nào nên chưa có trang Hành trình. Bạn vẫn có thể vào App học,
        hoặc đăng xuất để đăng nhập bằng tài khoản khác.
      </p>
      <div className="cs-guest-actions">
        <a className="cs-btn cs-btn-primary" href={LEARN_PATH}>Mở App học</a>
        <button type="button" className="cs-btn cs-btn-ghost" onClick={onSignOut}>Đăng xuất</button>
      </div>
    </GuestFrame>
  )
}
