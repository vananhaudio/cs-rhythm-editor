import { useState, useEffect, useRef } from 'react'
import MobileStudentPortal from './MobileStudentPortal'
import ChordDiagramIcon from './ChordDiagramIcon'
import { supabase } from './supabase'
import { isNativeIOS } from './iap'

// Đồng bộ tông mobile app: primary indigo #4338CA, accent cam #EA580C, nền xám #F0F2F5
const T = {
  bg: '#F4F5FB', bgCard: '#FFFFFF', bgLight: '#F9FAFB',
  header: '#4F46E5', headerDark: '#4338CA',
  gold: '#4F46E5', goldLight: '#EEF2FF',
  text: '#111827', textMuted: '#6B7280', textDim: '#9CA3AF',
  border: '#E5E7EB', borderLight: '#EEF0F4',
  green: '#16A34A', greenLight: '#DCFCE7', greenMid: '#15803D',
  danger: '#B91C1C', dangerBg: '#FEE2E2',
}

const BUILD_DIAGNOSTIC = 'TVA 1.2.0 (10) · bundled'

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
  { id: 'chord-seeing',  icon: '🤟', name: 'Hợp âm',       desc: 'Luyện tập bấm hợp âm',   tier: 'standard', category: 'Player' },
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

const GUEST_STUDENT: Student = {
  id: 'guest-free',
  full_name: 'Bạn',
  phone: null,
  email: null,
  level: 'beginner',
  is_active: true,
  enrolled_at: null,
  display_name: 'Bạn',
}

type Step = 'welcome' | 'login' | 'portal'

export default function StudentOnboarding() {
  const [step, setStep]           = useState<Step>('portal')
  const [student, setStudent]     = useState<Student | null>(GUEST_STUDENT)
  const [preview, setPreview]     = useState(false)   // tài khoản thầy xem khoá (mở khoá hết, không ghi tiến độ)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [showPass, setShowPass]   = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
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
      if (!session?.user?.id) return
      const { data } = await supabase
        .from('edu_students')
        .select('id,full_name,phone,email,level,is_active,enrolled_at,display_name,avatar_url')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (data) { setStudent(data); setStep('portal'); claimPendingGroup(); return }
      // Không có hồ sơ học sinh → tài khoản thầy: khôi phục CHẾ ĐỘ XEM (giữ phiên khi F5)
      const { data: appUser } = await supabase.from('app_users').select('role').eq('id', session.user.id).maybeSingle()
      if (appUser?.role === 'teacher' || appUser?.role === 'admin') {
        setStudent({ id: session.user.id, full_name: 'Thầy Văn Anh (xem khoá)', email: session.user.email ?? null, level: 'advanced' } as Student)
        setPreview(true); setStep('portal')
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
        // Tài khoản thầy → vào cổng học ở CHẾ ĐỘ XEM (mở khoá tất cả, không ghi tiến độ)
        setStudent({ id: authData.user.id, full_name: 'Thầy Văn Anh (xem khoá)', email: authData.user.email ?? null, level: 'advanced' } as Student)
        setPreview(true)
        setStep('portal')
        setLoggingIn(false)
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
    setStudent(GUEST_STUDENT)
    setEmail(''); setPassword('')
    setStep('portal')
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
      {/* Header — chỉ hiện ở màn đăng nhập; màn welcome dùng logo ở giữa cho gọn */}
      {step === 'login' && (
      <header style={{
        background: T.header, padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 20px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/tva-logo.png" alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>Thầy Văn Anh Guitar</div>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12 }}>Học · Tập · Sống cùng âm nhạc</div>
          </div>
        </div>
        {student && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{displayName(student)}</div>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12 }}>
                {student.level ? LEVEL_LABEL[student.level] : 'Học sinh'}
              </div>
            </div>
            <Btn onClick={handleLogout} style={{
              background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
              borderRadius: 8, color: 'rgba(255,255,255,.7)', padding: '6px 12px', fontSize: 13,
            }}>Đăng xuất</Btn>
          </div>
        )}
      </header>
      )}

      {/* WELCOME */}
      {step === 'welcome' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 'calc(env(safe-area-inset-top, 0px) + 40px) 32px calc(env(safe-area-inset-bottom, 0px) + 32px)', textAlign: 'center' }}>
          <img src="/tva-logo.png" alt="Thầy Văn Anh Guitar" style={{ width: 88, height: 88, borderRadius: 20, objectFit: 'cover', marginBottom: 24, boxShadow: '0 8px 24px rgba(17,24,39,.12)' }} />
          <h1 style={{ fontSize: 27, fontWeight: 800, color: T.text, margin: '0 0 10px', lineHeight: 1.25 }}>
            Chào mừng đến với<br /><span style={{ color: T.header }}>Thầy Văn Anh Guitar</span>
          </h1>
          <p style={{ color: T.textMuted, fontSize: 15, lineHeight: 1.6, maxWidth: 380, margin: '0 0 30px' }}>
            Học · Tập · Sống cùng âm nhạc
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 34 }}>
            {['Bài học', 'Luyện tập', 'Nhạc lý', 'AI trợ lý'].map(f => (
              <span key={f} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 20, padding: '5px 14px', fontSize: 14, color: T.textMuted }}>{f}</span>
            ))}
          </div>
          <Btn onClick={() => setStep('login')} style={{
            background: T.header, color: '#fff', border: 'none', borderRadius: 14,
            padding: '14px 44px', fontSize: 17, fontWeight: 700, width: '100%', maxWidth: 360,
            boxShadow: `0 8px 20px rgba(79,70,229,.26)`,
          }}>Đăng nhập →</Btn>
          <p style={{ color: T.textDim, fontSize: 13, marginTop: 10 }}>Dành cho học viên đã có tài khoản.</p>

          {/* ── IAP subscription (chỉ hiện trên native iOS) ── */}
          {isNativeIOS && (
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${T.borderLight}`, textAlign: 'center', maxWidth: 360, width: '100%' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 3 }}>
                Đăng ký học qua App Store
              </div>
              <div style={{ fontSize: 13.5, color: T.textMuted, marginBottom: 14, lineHeight: 1.55 }}>
                Chọn Free, Khởi đầu, Căn bản hoặc Nâng cao. Giá và ưu đãi được lấy trực tiếp từ App Store.
              </div>
              <Btn
                onClick={() => { window.location.href = '/subscribe' }}
                style={{
                  background: '#1B4332', color: '#fff', border: 'none', borderRadius: 12,
                  padding: '12px 24px', fontSize: 15, fontWeight: 600, width: '100%',
                }}
              >
                Xem các gói học
              </Btn>
            </div>
          )}
          <div style={{ marginTop: 18, fontSize: 11, color: T.textDim }}>
            {BUILD_DIAGNOSTIC}
          </div>
        </div>
      )}

      {/* LOGIN */}
      {step === 'login' && (
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '40px 24px', minHeight: 'calc(100vh - 56px)' }}>
          <Btn onClick={() => setStep('welcome')} style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 14, padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6 }}>← Quay lại</Btn>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 20px' }}>Đăng nhập</h2>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 14, color: T.textMuted, marginBottom: 6, fontWeight: 500 }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com" type="email"
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: T.bgLight, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 16, color: T.text, outline: 'none', fontFamily: 'inherit' }}
              onFocus={e => (e.currentTarget.style.borderColor = T.header)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, color: T.textMuted, marginBottom: 6, fontWeight: 500 }}>Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input ref={passRef} value={password} onChange={e => setPassword(e.target.value)}
                type={showPass ? 'text' : 'password'} placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 44px 12px 14px', background: T.bgLight, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 16, color: T.text, outline: 'none', fontFamily: 'inherit' }}
                onFocus={e => (e.currentTarget.style.borderColor = T.header)}
                onBlur={e => (e.currentTarget.style.borderColor = T.border)}
              />
              <Btn onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.textDim, fontSize: 17, padding: 4 }}>
                {showPass ? '🙈' : '👁'}
              </Btn>
            </div>
          </div>

          {loginError && (
            <div style={{ background: T.dangerBg, border: `1px solid #F0C4B0`, borderRadius: 8, padding: '10px 14px', fontSize: 14, color: T.danger, marginBottom: 16 }}>
              {loginError}
            </div>
          )}

          <Btn onClick={handleLogin} disabled={loggingIn || !email || !password} style={{
            width: '100%', background: loggingIn ? T.textDim : T.header, color: '#fff',
            border: 'none', borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 700,
            opacity: (!email || !password) ? 0.6 : 1,
          }}>
            {loggingIn ? 'Đang đăng nhập...' : 'Đăng nhập →'}
          </Btn>

          {resetSent ? (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: '#E8F2EC', border: '1px solid #B0D4BC', fontSize: 14, color: '#1B4332', textAlign: 'center' }}>
              ✅ Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư.
            </div>
          ) : (
            <Btn onClick={handleForgotPassword} disabled={resetLoading} style={{
              marginTop: 12, width: '100%', background: 'none', border: 'none',
              color: T.textDim, fontSize: 14, textDecoration: 'underline', cursor: 'pointer',
            }}>
              {resetLoading ? 'Đang gửi...' : 'Quên mật khẩu?'}
            </Btn>
          )}
        </div>
      )}

      {/* PORTAL */}
      {/* Tạm thời: web DÙNG CHUNG giao diện mobile (cột giữa 430px) để đồng bộ hết cải tiến với app. Desktop riêng để cải tiến sau. */}
      {step === 'portal' && student && (
        <div style={{ minHeight: '100dvh', background: 'radial-gradient(120% 80% at 50% 0%, #EDEAFB 0%, #F0F2F5 55%)' }}>
          <MobileStudentPortal
            student={student}
            onLogout={handleLogout}
            preview={preview}
            guest={student.id === GUEST_STUDENT.id}
            onLoginRequired={() => setStep('login')}
          />
        </div>
      )}
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
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginBottom: 4 }}>Chào mừng trở lại 👋</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 6 }}>{displayName(student)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {student.level && (
              <span style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 600 }}>
                {LEVEL_LABEL[student.level]}
              </span>
            )}
            <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 13 }}>{unlockedCount}/{TOOLS.length} công cụ mở khoá</span>
          </div>
        </div>
        <div style={{ minWidth: 160 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,.6)', fontSize: 12, marginBottom: 6 }}>
            <span>Tiến độ</span><span>{unlockedCount * 10} XP</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: '#C8A84B', width: `${Math.min(100, (unlockedCount / TOOLS.length) * 100)}%` }} />
          </div>
          <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11, marginTop: 4 }}>{TOOLS.length - unlockedCount} công cụ chờ mở khoá</div>
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
            <span style={{ fontSize: 14, fontWeight: 600, color: a.hot ? '#fff' : T.text }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Tools */}
      {categories.map(cat => {
        const catTools = TOOLS.filter(t => t.category === cat)
        return (
          <div key={cat} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${T.borderLight}` }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{cat}</span>
              <span style={{ fontSize: 13, color: T.textDim }}>{catTools.filter(t => unlockedTiers.includes(t.tier)).length}/{catTools.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {catTools.map(tool => {
                const unlocked = unlockedTiers.includes(tool.tier)
                return (
                  <button key={tool.id} onClick={() => handleToolClick(tool)} disabled={!unlocked}
                    style={{ background: unlocked ? T.bgLight : T.bgCard, border: `1.5px solid ${unlocked ? T.border : T.borderLight}`, borderRadius: 10, padding: '12px', display: 'flex', flexDirection: 'column', gap: 5, cursor: unlocked ? 'pointer' : 'default', opacity: unlocked ? 1 : 0.6, textAlign: 'left', fontFamily: 'inherit', position: 'relative', transition: 'transform .1s' }}>
                    {!unlocked && <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 13, opacity: .5 }}>🔒</span>}
                    {unlocked && <span style={{ position: 'absolute', top: 8, right: 8, background: T.greenLight, borderRadius: 4, padding: '1px 6px', fontSize: 11, color: T.greenMid, fontWeight: 600, border: `1px solid ${T.borderLight}` }}>Mở</span>}
                    {tool.id === 'chord-seeing'
                      ? <ChordDiagramIcon />
                      : <span style={{ fontSize: 22 }}>{tool.icon}</span>}
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{tool.name}</span>
                    <span style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>{tool.desc}</span>
                    {!unlocked && <span style={{ fontSize: 11, color: '#A07820', fontWeight: 600, marginTop: 2 }}>Cần: {TIER_LABEL[tool.tier]}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center', marginTop: 8 }}>
        <div style={{ fontSize: 20, marginBottom: 6 }}>💡</div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Muốn mở khoá thêm công cụ?</div>
        <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6 }}>Hoàn thành bài tập và học chăm chỉ để lên cấp. Thầy sẽ cấp quyền thêm khi bạn tiến bộ!</div>
      </div>
    </div>
  )
}
