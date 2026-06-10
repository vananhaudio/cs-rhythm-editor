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

type Step = 'welcome' | 'search' | 'login' | 'portal'

export default function StudentOnboarding() {
  const [step, setStep]           = useState<Step>('welcome')
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<Student[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected]   = useState<Student | null>(null)
  const [student, setStudent]     = useState<Student | null>(null)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [showPass, setShowPass]   = useState(false)
  const [iapLoading, setIapLoading]   = useState(false)
  const [iapMsg, setIapMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const passRef  = useRef<HTMLInputElement>(null)

  // Auto-login nếu đã có session
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.id) {
        const { data } = await supabase
          .from('edu_students')
          .select('id,full_name,phone,email,level,is_active,enrolled_at,display_name,avatar_url')
          .eq('user_id', session.user.id)
          .single()
        if (data) { setStudent(data); setStep('portal') }
      }
    })
  }, [])

  // Debounce search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(() => {
      setSearching(true)
      const q = query.trim()
      supabase.from('edu_students')
        .select('id,full_name,phone,email,level,is_active,enrolled_at,display_name,avatar_url')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
        .eq('is_active', true)
        .limit(6)
        .then(({ data }) => { setResults(data ?? []); setSearching(false) })
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (step === 'search') setTimeout(() => inputRef.current?.focus(), 100)
    if (step === 'login')  setTimeout(() => passRef.current?.focus(), 100)
  }, [step])

  const handleSelectStudent = (s: Student) => {
    setSelected(s)
    setEmail(s.email ?? '')
    setLoginError('')
    setPassword('')
    setStep('login')
  }

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
    if (data) { setStudent(data); setStep('portal') }
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setStudent(null); setSelected(null)
    setQuery(''); setResults([])
    setEmail(''); setPassword('')
    setStep('welcome')
  }

  const handleIAPPurchase = async () => {
    setIapMsg(null)
    setIapLoading(true)
    try {
      await purchaseMonthly()
      setIapMsg({ type: 'ok', text: 'Đăng ký thành công! Liên hệ Thầy Văn Anh qua Zalo để kích hoạt tài khoản học ngay.' })
    } catch (e: any) {
      const msg: string = e?.message ?? ''
      if (msg.toLowerCase().includes('cancel') || msg.includes('SKErrorDomain error 2')) {
        setIapMsg(null) // user tự cancel — không hiện lỗi
      } else {
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
      setIapMsg({ type: 'ok', text: 'Đã khôi phục giao dịch. Liên hệ Thầy Văn Anh để kích hoạt tài khoản.' })
    } catch {
      setIapMsg({ type: 'err', text: 'Không tìm thấy giao dịch cần khôi phục.' })
    } finally {
      setIapLoading(false)
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
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: T.header, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, marginBottom: 24, boxShadow: `0 4px 24px rgba(27,107,58,.25)` }}>🎸</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: T.text, margin: '0 0 10px', lineHeight: 1.2 }}>
            Chào mừng đến với<br /><span style={{ color: T.header }}>Thầy Văn Anh Guitar</span>
          </h1>
          <p style={{ color: T.textMuted, fontSize: 15, lineHeight: 1.7, maxWidth: 380, margin: '0 0 32px' }}>
            Nơi hành trình âm nhạc của bạn bắt đầu. Học nhịp, hòa âm, và guitar theo lộ trình được thiết kế riêng cho bạn.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36 }}>
            {['🥁 Luyện nhịp', '🎸 Hợp âm', '📖 Nhạc lý', '🤖 AI trợ lý'].map(f => (
              <span key={f} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 20, padding: '5px 14px', fontSize: 13, color: T.textMuted }}>{f}</span>
            ))}
          </div>
          <Btn onClick={() => setStep('search')} style={{
            background: T.header, color: '#fff', border: 'none', borderRadius: 12,
            padding: '14px 40px', fontSize: 16, fontWeight: 700,
            boxShadow: `0 4px 16px rgba(27,107,58,.3)`,
          }}>Bắt đầu hành trình →</Btn>
          <p style={{ color: T.textDim, fontSize: 12, marginTop: 16 }}>Đã là học sinh? Tìm tên và đăng nhập bên dưới.</p>

          {/* ── IAP subscription (chỉ hiện trên native iOS) ── */}
          {isNativeIOS && (
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${T.borderLight}`, textAlign: 'center', maxWidth: 360 }}>
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
                  background: iapMsg.type === 'ok' ? '#E8F2EC' : '#F0D8D0',
                  color:      iapMsg.type === 'ok' ? '#1B4332'  : '#8B3A1E',
                  border: `1px solid ${iapMsg.type === 'ok' ? '#B0D4BC' : '#E4B8A8'}`,
                }}>
                  {iapMsg.type === 'ok' ? '✅ ' : '⚠️ '}{iapMsg.text}
                </div>
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

              <div style={{ fontSize: 11, color: T.textDim, marginTop: 10, lineHeight: 1.5 }}>
                Sau khi thanh toán, liên hệ Thầy Văn Anh qua Zalo để kích hoạt.{'\n'}
                Đăng ký tự động gia hạn mỗi tháng. Huỷ bất kỳ lúc nào trong Cài đặt iOS.
              </div>
            </div>
          )}
        </div>
      )}

      {/* SEARCH */}
      {step === 'search' && (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 24px', minHeight: 'calc(100vh - 56px)' }}>
          <Btn onClick={() => setStep('welcome')} style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 13, padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6 }}>← Quay lại</Btn>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Tìm tài khoản của bạn</h2>
          <p style={{ color: T.textMuted, fontSize: 14, margin: '0 0 24px', lineHeight: 1.6 }}>Nhập tên hoặc số điện thoại để tìm, sau đó đăng nhập.</p>

          <div style={{ position: 'relative', marginBottom: 20 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Nhập tên hoặc số điện thoại..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px 13px 42px', background: T.bgLight, border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 15, color: T.text, outline: 'none', fontFamily: 'inherit' }}
              onFocus={e => (e.currentTarget.style.borderColor = T.header)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border)}
            />
            {searching && <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: T.textDim, fontSize: 13 }}>⏳</span>}
          </div>

          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map(s => (
                <Btn key={s.id} onClick={() => handleSelectStudent(s)} style={{
                  background: T.bgCard, border: `1.5px solid ${T.borderLight}`, borderRadius: 12,
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
                  textAlign: 'left', width: '100%',
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: T.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: T.header, flexShrink: 0, border: `1px solid ${T.borderLight}` }}>
                    {displayName(s).charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: T.text }}>{displayName(s)}</div>
                    <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>
                      {s.phone ? `📱 ${s.phone}` : s.email ?? ''}
                      {s.level ? <span style={{ color: LEVEL_COLOR[s.level], marginLeft: 8 }}>{LEVEL_LABEL[s.level]}</span> : ''}
                    </div>
                  </div>
                  <span style={{ color: T.textDim, fontSize: 18 }}>›</span>
                </Btn>
              ))}
            </div>
          )}

          {query.length >= 2 && !searching && results.length === 0 && (
            <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 12, padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🤔</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Không tìm thấy "{query}"</div>
              <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>Liên hệ Thầy Văn Anh để được thêm vào hệ thống.</div>
            </div>
          )}

          {query.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👆</div>
              <div style={{ color: T.textMuted, fontSize: 14 }}>Gõ ít nhất 2 ký tự để tìm kiếm</div>
            </div>
          )}

          {/* Đăng nhập thẳng bằng email */}
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${T.borderLight}`, textAlign: 'center' }}>
            <div style={{ color: T.textDim, fontSize: 13, marginBottom: 10 }}>Biết email? Đăng nhập thẳng</div>
            <Btn onClick={() => { setSelected(null); setEmail(''); setStep('login') }} style={{
              background: 'none', border: `1px solid ${T.border}`, borderRadius: 10,
              color: T.textMuted, padding: '9px 24px', fontSize: 13,
            }}>Đăng nhập bằng email →</Btn>
          </div>
        </div>
      )}

      {/* LOGIN */}
      {step === 'login' && (
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '40px 24px', minHeight: 'calc(100vh - 56px)' }}>
          <Btn onClick={() => setStep('search')} style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 13, padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6 }}>← Quay lại tìm kiếm</Btn>

          {selected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.greenLight, border: `1px solid ${T.borderLight}`, borderRadius: 12, padding: '12px 16px', marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.header, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                {displayName(selected).charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{displayName(selected)}</div>
                {selected.level && <div style={{ fontSize: 12, color: LEVEL_COLOR[selected.level] }}>{LEVEL_LABEL[selected.level]}</div>}
              </div>
            </div>
          )}

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
              ⚠️ {loginError}
            </div>
          )}

          <Btn onClick={handleLogin} disabled={loggingIn || !email || !password} style={{
            width: '100%', background: loggingIn ? T.textDim : T.header, color: '#fff',
            border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700,
            opacity: (!email || !password) ? 0.6 : 1,
          }}>
            {loggingIn ? 'Đang đăng nhập...' : 'Đăng nhập →'}
          </Btn>
        </div>
      )}

      {/* PORTAL */}
      {step === 'portal' && student && (window.innerWidth < 768 ? <MobileStudentPortal student={student} onLogout={handleLogout} /> : <StudentPortalV2 student={student} onLogout={handleLogout} />)}
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
