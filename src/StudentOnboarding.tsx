import { useState, useEffect, useRef } from 'react'
import StudentPortalV2 from './StudentPortalV2'
import MobileStudentPortal from './MobileStudentPortal'
import { supabase } from './supabase'
import { isNativeIOS, purchaseMonthly, restorePurchases } from './iap'

const T = {
  bg: '#EAD7B8', bgCard: '#F5EDD8', bgLight: '#FBF5EA',
  header: '#1B6B3A', headerDark: '#134D2B',
  gold: '#A07820', goldLight: '#C8A84B',
  text: '#2C1F0E', textMuted: '#7A6548', textDim: '#A08B6A',
  border: '#C8B090', borderLight: '#DDD0B0',
  green: '#1B6B3A', greenLight: '#E8F2EC', greenMid: '#2E6B40',
  danger: '#8B3A1E', dangerBg: '#F0D8D0',
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Mới bắt đầu', elementary: 'Cơ bản',
  intermediate: 'Trung cấp', advanced: 'Nâng cao',
}
const LEVEL_COLOR: Record<string, string> = {
  beginner: '#2E6B40', elementary: '#5A8A2A',
  intermediate: '#A07820', advanced: '#8B3A1E',
}

type ToolItem = { id: string; icon: string; name: string; desc: string; tier: string; category: string }
const TOOLS: ToolItem[] = [
  { id: 'tap-tempo',     icon: '🎵', name: 'Tap Tempo',    desc: 'Gõ tìm BPM',             tier: 'free',     category: 'Luyện nhịp' },
  { id: 'tap-beat',      icon: '🥁', name: 'Tap Beat',     desc: 'Gõ theo nhịp bài hát',   tier: 'free',     category: 'Luyện nhịp' },
  { id: 'tap-beam',      icon: '🎼', name: 'Tap Beam',     desc: 'Nối phách nâng cao',      tier: 'basic',    category: 'Luyện nhịp' },
  { id: 'tap-sing',      icon: '🎤', name: 'Tap & Sing',   desc: 'Gõ nhịp và hát theo',    tier: 'basic',    category: 'Luyện nhịp' },
  { id: 'tap-strum',     icon: '🎸', name: 'Tap & Strum',  desc: 'Gõ nhịp và đệm guitar',  tier: 'standard', category: 'Luyện nhịp' },
  { id: 'scroll-kara',   icon: '📜', name: 'Scroll Kara',  desc: 'Lời cuộn + hợp âm',      tier: 'basic',    category: 'Player' },
  { id: 'chord-seeing',  icon: '👁',  name: 'Chord Seeing', desc: 'Karaoke cho nhạc sĩ',    tier: 'standard', category: 'Player' },
  { id: 'backing-track', icon: '🎧', name: 'Backing Track',desc: 'Nhạc nền luyện tập',     tier: 'standard', category: 'Player' },
  { id: 'note-sheet',    icon: '📖', name: 'Note Sheet',   desc: 'Đọc và viết nốt nhạc',   tier: 'standard', category: 'Nhạc lý' },
  { id: 'hoa-am',        icon: '🎹', name: 'Hòa âm',       desc: 'Diatonic · Triad',        tier: 'standard', category: 'Nhạc lý' },
  { id: 'scale-lead',    icon: '🎶', name: 'Scale – Lead', desc: 'Gam & giai điệu',         tier: 'pro',      category: 'Nhạc lý' },
  { id: 'editor',        icon: '✏️', name: 'Editor',       desc: 'Soạn bài + YouTube sync', tier: 'pro',      category: 'Sáng tác' },
  { id: 'guitar-board',  icon: '🎸', name: 'GuitarBoard',  desc: 'Bảng hợp âm trực quan',  tier: 'pro',      category: 'Sáng tác' },
  { id: 'lyric-sheet',   icon: '📝', name: 'Lyric Sheet',  desc: 'Biên tập lời + hợp âm',  tier: 'pro',      category: 'Sáng tác' },
  { id: 'm-record',      icon: '🎬', name: 'M-Record',     desc: 'Ghi âm & video',          tier: 'pro',      category: 'Studio' },
  { id: 'mj-chat',       icon: '🤖', name: 'MJ Chat Bot',  desc: 'Trợ lý học nhạc AI',     tier: 'pro',      category: 'Studio' },
  { id: 'book-tools',    icon: '📚', name: 'Book & Tools', desc: 'Tài liệu & giáo trình',  tier: 'pro',      category: 'Studio' },
]
const UNLOCKED_TIERS: Record<string, string[]> = {
  beginner:     ['free'],
  elementary:   ['free', 'basic'],
  intermediate: ['free', 'basic', 'standard'],
  advanced:     ['free', 'basic', 'standard', 'pro'],
}
const TIER_LABEL: Record<string, string> = {
  free: 'Miễn phí', basic: 'Cơ bản', standard: 'Chuẩn', pro: 'Hành trình',
}

interface Student {
  id: string; full_name: string; phone: string | null
  email: string | null; level: string | null; is_active: boolean
  enrolled_at: string | null; display_name?: string | null; avatar_url?: string | null
}

// Hiện tên đẹp: nếu full_name là email thì dùng phần trước @
function displayName(s: Student) {
  const name = s.full_name ?? ''
  if (name.includes('@')) return name.split('@')[0]
  return name
}

type Step = 'welcome' | 'login' | 'portal'

export default function StudentOnboarding() {
  const [step, setStep]           = useState<Step>('welcome')
  const [student, setStudent]     = useState<Student | null>(null)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [showPass, setShowPass]   = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [iapLoading, setIapLoading]   = useState(false)
  const [iapMsg, setIapMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [iapPurchased, setIapPurchased] = useState(false)
  const [iapRegEmail, setIapRegEmail]   = useState('')
  const [iapRegPass, setIapRegPass]     = useState('')
  const [iapRegLoading, setIapRegLoading] = useState(false)
  const [iapRegError, setIapRegError]   = useState('')
  const passRef  = useRef<HTMLInputElement>(null)

  // Xác nhận nhóm đang chờ (học viên bấm link /join-group/<token> rồi mới đăng nhập)
  const claimPendingGroup = async () => {
    let tok = ''
    try { tok = localStorage.getItem('pendingClaimToken') || '' } catch { /* bỏ qua */ }
    if (!tok) return
    try { localStorage.removeItem('pendingClaimToken') } catch { /* bỏ qua */ }
    const { error } = await supabase.rpc('claim_group', { p_token: tok })
    if (error) console.error('Xác nhận nhóm lỗi:', error.message)
  }

  // Auto-login nếu đã có session
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.id) {
        const { data } = await supabase
          .from('edu_students')
          .select('id,full_name,phone,email,level,is_active,enrolled_at,display_name,avatar_url')
          .eq('user_id', session.user.id)
          .single()
        if (data) { setStudent(data); setStep('portal'); claimPendingGroup() }
      }
    })
  }, [])

  useEffect(() => {
    if (step === 'login')  setTimeout(() => passRef.current?.focus(), 100)
  }, [step])

  const handleLogin = async () => {
    if (!email || !password) return
    setLoggingIn(true)
    setLoginError('')
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoginError('Sai mật khẩu hoặc tài khoản không tồn tại.')
      setLoggingIn(false)
      return
    }
    const { data } = await supabase
      .from('edu_students')
      .select('id,full_name,phone,email,level,is_active,enrolled_at,display_name,avatar_url')
      .eq('user_id', authData.user.id)
      .single()
    if (data) { setStudent(data); setStep('portal'); claimPendingGroup() }
    else {
      // Kiểm tra xem có phải tài khoản thầy không
      const { data: appUser } = await supabase
        .from('app_users')
        .select('role')
        .eq('id', authData.user.id)
        .single()
      if (appUser?.role === 'teacher' || appUser?.role === 'admin') {
        window.location.href = '/students'
        return
      }
      setLoginError('Tài khoản chưa được liên kết với hồ sơ học sinh. Liên hệ thầy.')
    }
    setLoggingIn(false)
  }

  const handleForgotPassword = async () => {
    if (!email) { setLoginError('Nhập email trước rồi bấm quên mật khẩu.'); return }
    setResetLoading(true)
    setLoginError('')
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://timming.vananhaudio.com' })
    setResetSent(true)
    setResetLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setStudent(null)
    setEmail(''); setPassword('')
    setStep('welcome')
  }

  const handleIAPPurchase = async () => {
    setIapMsg(null)
    setIapLoading(true)
    try {
      await purchaseMonthly()
      setIapPurchased(true)
    } catch (e: any) {
      const msg: string = e?.message ?? ''
      if (!msg.toLowerCase().includes('cancel') && !msg.includes('SKErrorDomain error 2')) {
        setIapMsg({ type: 'err', text: msg || 'Không thể hoàn tất. Thử lại sau.' })
      }
    } finally {
      setIapLoading(false)
    }
  }

  const handleIAPRestore = async () => {
    setIapMsg(null)
    setIapLoading(true)
    try {
      await restorePurchases()
      setIapPurchased(true)
    } catch {
      setIapMsg({ type: 'err', text: 'Không tìm thấy giao dịch cần khôi phục.' })
    } finally {
      setIapLoading(false)
    }
  }

  const handleIAPRegister = async () => {
    if (!iapRegEmail || !iapRegPass) return
    setIapRegLoading(true)
    setIapRegError('')
    try {
      // Thử sign up (nếu đã có tài khoản thì bỏ qua lỗi duplicate)
      await supabase.auth.signUp({ email: iapRegEmail, password: iapRegPass })

      // Sign in để lấy session (quan trọng: đảm bảo có session dù Supabase có bật email confirm hay không)
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: iapRegEmail, password: iapRegPass })
      if (signInErr) throw new Error('Đăng nhập thất bại: ' + signInErr.message)

      const userId = signInData.user.id

      // Tạo hoặc cập nhật hồ sơ học sinh
      const { error: upsertErr } = await supabase.from('edu_students').upsert({
        user_id: userId,
        full_name: iapRegEmail.split('@')[0],
        email: iapRegEmail,
        is_active: true,
        level: 'beginner',
        enrolled_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (upsertErr) throw new Error('Tạo hồ sơ thất bại: ' + upsertErr.message)

      const { data: studentData } = await supabase
        .from('edu_students')
        .select('id,full_name,phone,email,level,is_active,enrolled_at,display_name,avatar_url')
        .eq('user_id', userId)
        .single()
      if (!studentData) throw new Error('Không tải được hồ sơ. Thử đăng nhập lại.')

      // Auto-enroll vào tất cả khoá học đang có
      const { data: courses } = await supabase.from('edu_courses').select('id')
      if (courses && courses.length > 0) {
        const enrollments = courses.map((c: { id: string }) => ({
          student_id: studentData.id,
          course_id: c.id,
          enrolled_by: userId,
          is_active: true,
        }))
        const { error: enrollError } = await supabase.from('edu_enrollments').upsert(enrollments, { onConflict: 'student_id,course_id', ignoreDuplicates: true })
        if (enrollError) console.error('Auto-enroll thất bại:', enrollError.message)
      }

      setStudent(studentData)
      setStep('portal')
    } catch (e: any) {
      setIapRegError(e.message || 'Không thể tạo tài khoản. Thử lại sau.')
    } finally {
      setIapRegLoading(false)
    }
  }

  const Btn = ({ style, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      {...p}
      style={{
        fontFamily: 'inherit', cursor: 'pointer',
        transition: 'transform .1s, opacity .1s',
        ...style,
      }}
      onMouseEnter={e => { if (!p.disabled) e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    />
  )

  return (
    <div style={{ minHeight: step === 'portal' ? undefined : '100vh', background: step === 'portal' ? 'transparent' : T.bg, fontFamily: '"Segoe UI", Inter, system-ui, sans-serif', color: T.text }}>
      {/* Header — ẩn khi đang ở portal (portal tự có header riêng) */}
      {step !== 'portal' && (
      <header style={{
        background: T.header, padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.headerDark}`,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎸</span>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Thầy Văn Anh Guitar</div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>Music Learning System</div>
          </div>
        </div>
        {student && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{displayName(student)}</div>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>
                {student.level ? LEVEL_LABEL[student.level] : 'Học sinh'}
              </div>
            </div>
            <Btn onClick={handleLogout} style={{
              background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
              borderRadius: 8, color: 'rgba(255,255,255,.7)', padding: '6px 12px', fontSize: 12,
            }}>Đăng xuất</Btn>
          </div>
        )}
      </header>
      )}

      {/* WELCOME */}
      {step === 'welcome' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 56px)', padding: 32, textAlign: 'center' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: T.header, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, marginBottom: 24, boxShadow: `0 4px 24px rgba(27,107,58,.25)` }}></div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: T.text, margin: '0 0 10px', lineHeight: 1.2 }}>
            Chào mừng đến với<br /><span style={{ color: T.header }}>Thầy Văn Anh Guitar</span>
          </h1>
          <p style={{ color: T.textMuted, fontSize: 15, lineHeight: 1.7, maxWidth: 380, margin: '0 0 32px' }}>
            Nơi hành trình âm nhạc của bạn bắt đầu. Học nhịp, hòa âm, và guitar theo lộ trình được thiết kế riêng cho bạn.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36 }}>
            {['Luyện nhịp', 'Hợp âm', 'Nhạc lý', 'AI trợ lý'].map(f => (
              <span key={f} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 20, padding: '5px 14px', fontSize: 13, color: T.textMuted }}>{f}</span>
            ))}
          </div>
          <Btn onClick={() => setStep('login')} style={{
            background: T.header, color: '#fff', border: 'none', borderRadius: 12,
            padding: '14px 40px', fontSize: 16, fontWeight: 700,
            boxShadow: `0 4px 16px rgba(27,107,58,.3)`,
          }}>Bắt đầu hành trình →</Btn>
          <p style={{ color: T.textDim, fontSize: 12, marginTop: 16 }}>Đã là học sinh? Đăng nhập bên dưới.</p>

          {/* ── IAP subscription (chỉ hiện trên native iOS) ── */}
          {isNativeIOS && (
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${T.borderLight}`, textAlign: 'center', maxWidth: 360, width: '100%' }}>
              {!iapPurchased ? (
                <>
                  <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 14 }}>
                    Chưa có tài khoản? Đăng ký trực tiếp qua App Store:
                  </div>
                  <Btn
                    onClick={handleIAPPurchase}
                    disabled={iapLoading}
                    style={{
                      background: '#1B4332', color: '#fff', border: 'none', borderRadius: 12,
                      padding: '12px 28px', fontSize: 15, fontWeight: 700, width: '100%',
                      opacity: iapLoading ? 0.6 : 1,
                    }}
                  >
                    {iapLoading ? 'Đang xử lý...' : '🍎 Đăng ký học — $49.99 / tháng'}
                  </Btn>

                  {iapMsg && (
                    <div style={{
                      marginTop: 12, padding: '12px 16px', borderRadius: 10, fontSize: 13,
                      background: '#F0D8D0', color: '#8B3A1E', border: '1px solid #E4B8A8',
                    }}>{iapMsg.text}</div>
                  )}

                  <Btn
                    onClick={handleIAPRestore}
                    disabled={iapLoading}
                    style={{
                      marginTop: 10, background: 'none', border: 'none',
                      color: T.textDim, fontSize: 12, cursor: 'pointer',
                      textDecoration: 'underline', padding: '4px 0',
                    }}
                  >Khôi phục giao dịch đã mua</Btn>

                  <div style={{ fontSize: 11, color: T.textDim, marginTop: 10, lineHeight: 1.7 }}>
                    Đăng ký tự động gia hạn mỗi tháng với giá $49.99/tháng. Tài khoản Apple ID của bạn sẽ bị tính phí khi xác nhận mua hàng. Đăng ký tự động gia hạn trừ khi tắt ít nhất 24 giờ trước khi hết kỳ thanh toán hiện tại.<br />
                    Huỷ bất kỳ lúc nào trong Cài đặt &gt; Apple ID &gt; Đăng ký.<br />
                    <a href="https://timming.vananhaudio.com/tvaprivacy"
                       target="_blank" rel="noreferrer"
                       style={{ color: T.textDim }}>Chính sách bảo mật</a>
                    {' · '}
                    <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                       target="_blank" rel="noreferrer"
                       style={{ color: T.textDim }}>Điều khoản sử dụng (EULA)</a>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 17, textAlign: 'center', marginBottom: 4 }}>Thanh toán thành công!</div>
                  <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', marginBottom: 20 }}>Tạo tài khoản để bắt đầu học ngay.</div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 13, color: T.textMuted, marginBottom: 5, fontWeight: 500 }}>Email</label>
                    <input
                      value={iapRegEmail}
                      onChange={e => setIapRegEmail(e.target.value)}
                      placeholder="email@example.com"
                      type="email"
                      autoFocus
                      style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: T.bgLight, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 15, color: T.text, outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, color: T.textMuted, marginBottom: 5, fontWeight: 500 }}>Mật khẩu</label>
                    <input
                      value={iapRegPass}
                      onChange={e => setIapRegPass(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                      type="password"
                      onKeyDown={e => e.key === 'Enter' && handleIAPRegister()}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: T.bgLight, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 15, color: T.text, outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>

                  {iapRegError && (
                    <div style={{ background: '#F0D8D0', border: '1px solid #E4B8A8', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#8B3A1E', marginBottom: 12 }}>
                      {iapRegError}
                    </div>
                  )}

                  <Btn
                    onClick={handleIAPRegister}
                    disabled={iapRegLoading || !iapRegEmail || !iapRegPass}
                    style={{
                      width: '100%', background: T.header, color: '#fff', border: 'none',
                      borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700,
                      opacity: (!iapRegEmail || !iapRegPass) ? 0.6 : 1,
                    }}
                  >
                    {iapRegLoading ? 'Đang tạo tài khoản...' : 'Bắt đầu học ngay →'}
                  </Btn>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* LOGIN */}
      {step === 'login' && (
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '40px 24px', minHeight: 'calc(100vh - 56px)' }}>
          <Btn onClick={() => setStep('welcome')} style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 13, padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6 }}>← Quay lại</Btn>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 20px' }}>Đăng nhập</h2>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, color: T.textMuted, marginBottom: 6, fontWeight: 500 }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com" type="email"
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: T.bgLight, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 15, color: T.text, outline: 'none', fontFamily: 'inherit' }}
              onFocus={e => (e.currentTarget.style.borderColor = T.header)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: T.textMuted, marginBottom: 6, fontWeight: 500 }}>Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input ref={passRef} value={password} onChange={e => setPassword(e.target.value)}
                type={showPass ? 'text' : 'password'} placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 44px 12px 14px', background: T.bgLight, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 15, color: T.text, outline: 'none', fontFamily: 'inherit' }}
                onFocus={e => (e.currentTarget.style.borderColor = T.header)}
                onBlur={e => (e.currentTarget.style.borderColor = T.border)}
              />
              <Btn onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.textDim, fontSize: 16, padding: 4 }}>
                {showPass ? '🙈' : '👁'}
              </Btn>
            </div>
          </div>

          {loginError && (
            <div style={{ background: T.dangerBg, border: `1px solid #F0C4B0`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: T.danger, marginBottom: 16 }}>
              {loginError}
            </div>
          )}

          <Btn onClick={handleLogin} disabled={loggingIn || !email || !password} style={{
            width: '100%', background: loggingIn ? T.textDim : T.header, color: '#fff',
            border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700,
            opacity: (!email || !password) ? 0.6 : 1,
          }}>
            {loggingIn ? 'Đang đăng nhập...' : 'Đăng nhập →'}
          </Btn>

          {resetSent ? (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: '#E8F2EC', border: '1px solid #B0D4BC', fontSize: 13, color: '#1B4332', textAlign: 'center' }}>
              ✅ Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư.
            </div>
          ) : (
            <Btn onClick={handleForgotPassword} disabled={resetLoading} style={{
              marginTop: 12, width: '100%', background: 'none', border: 'none',
              color: T.textDim, fontSize: 13, textDecoration: 'underline', cursor: 'pointer',
            }}>
              {resetLoading ? 'Đang gửi...' : 'Quên mật khẩu?'}
            </Btn>
          )}
        </div>
      )}

      {/* PORTAL */}
      {step === 'portal' && student && (window.innerWidth < 1024 ? <MobileStudentPortal student={student} onLogout={handleLogout} /> : <StudentPortalV2 student={student} onLogout={handleLogout} />)}
    </div>
  )
}

function PortalView({ student, onLogout }: { student: Student; onLogout: () => void }) {
  const level = student.level ?? 'beginner'
  const unlockedTiers = UNLOCKED_TIERS[level] ?? ['free']
  const unlockedCount = TOOLS.filter(t => unlockedTiers.includes(t.tier)).length
  const categories = [...new Set(TOOLS.map(t => t.category))]

  const handleToolClick = (tool: ToolItem) => {
    if (!unlockedTiers.includes(tool.tier)) return
    const routes: Record<string, string> = {
      'tap-tempo': '/tap', 'tap-beat': '/tap', 'tap-beam': '/tap',
      'scroll-kara': '/tap', 'chord-seeing': '/tap',
    }
    const route = routes[tool.id]
    if (route) window.location.href = route
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>
      {/* Welcome banner */}
      <div style={{ background: T.header, borderRadius: 16, padding: '22px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, marginBottom: 4 }}>Chào mừng trở lại 👋</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 6 }}>{displayName(student)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {student.level && (
              <span style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                {LEVEL_LABEL[student.level]}
              </span>
            )}
            <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>{unlockedCount}/{TOOLS.length} công cụ mở khoá</span>
          </div>
        </div>
        <div style={{ minWidth: 160 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,.6)', fontSize: 11, marginBottom: 6 }}>
            <span>Tiến độ</span><span>{unlockedCount * 10} XP</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: '#C8A84B', width: `${Math.min(100, (unlockedCount / TOOLS.length) * 100)}%` }} />
          </div>
          <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 10, marginTop: 4 }}>{TOOLS.length - unlockedCount} công cụ chờ mở khoá</div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 28 }}>
        {[
          { icon: '🥁', label: 'Tap nhịp ngay', route: '/tap', hot: true },
          { icon: '🎵', label: 'Bài hát',        route: '/tap', hot: false },
          { icon: '📋', label: 'Bài tập',         route: '#',   hot: false },
        ].map(a => (
          <button key={a.label} onClick={() => a.route !== '#' && (window.location.href = a.route)}
            style={{ background: a.hot ? T.header : T.bgCard, border: `1.5px solid ${a.hot ? T.header : T.borderLight}`, borderRadius: 12, padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit', transition: 'transform .1s' }}>
            <span style={{ fontSize: 22 }}>{a.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: a.hot ? '#fff' : T.text }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Tools */}
      {categories.map(cat => {
        const catTools = TOOLS.filter(t => t.category === cat)
        return (
          <div key={cat} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${T.borderLight}` }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{cat}</span>
              <span style={{ fontSize: 12, color: T.textDim }}>{catTools.filter(t => unlockedTiers.includes(t.tier)).length}/{catTools.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {catTools.map(tool => {
                const unlocked = unlockedTiers.includes(tool.tier)
                return (
                  <button key={tool.id} onClick={() => handleToolClick(tool)} disabled={!unlocked}
                    style={{ background: unlocked ? T.bgLight : T.bgCard, border: `1.5px solid ${unlocked ? T.border : T.borderLight}`, borderRadius: 10, padding: '12px', display: 'flex', flexDirection: 'column', gap: 5, cursor: unlocked ? 'pointer' : 'default', opacity: unlocked ? 1 : 0.6, textAlign: 'left', fontFamily: 'inherit', position: 'relative', transition: 'transform .1s' }}>
                    {!unlocked && <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 12, opacity: .5 }}>🔒</span>}
                    {unlocked && <span style={{ position: 'absolute', top: 8, right: 8, background: T.greenLight, borderRadius: 4, padding: '1px 6px', fontSize: 10, color: T.greenMid, fontWeight: 600, border: `1px solid ${T.borderLight}` }}>Mở</span>}
                    <span style={{ fontSize: 22 }}>{tool.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{tool.name}</span>
                    <span style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>{tool.desc}</span>
                    {!unlocked && <span style={{ fontSize: 10, color: '#A07820', fontWeight: 600, marginTop: 2 }}>Cần: {TIER_LABEL[tool.tier]}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center', marginTop: 8 }}>
        <div style={{ fontSize: 20, marginBottom: 6 }}>💡</div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Muốn mở khoá thêm công cụ?</div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>Hoàn thành bài tập và học chăm chỉ để lên cấp. Thầy sẽ cấp quyền thêm khi bạn tiến bộ!</div>
      </div>
    </div>
  )
}
