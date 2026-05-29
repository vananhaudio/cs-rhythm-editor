import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ─── Theme ───────────────────────────────────────────────────────────────────
const T = {
  bg: '#EAD7B8', bgCard: '#F5EDD8', bgLight: '#FBF5EA',
  header: '#1B6B3A', headerDark: '#134D2B',
  gold: '#A07820', goldLight: '#C8A84B', goldBg: '#F5EDD8',
  text: '#2C1F0E', textMuted: '#7A6548', textDim: '#A08B6A',
  border: '#C8B090', borderLight: '#DDD0B0',
  green: '#1B6B3A', greenLight: '#E8F2EC', greenMid: '#2E6B40',
}

// ─── Level config ─────────────────────────────────────────────────────────────
const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Mới bắt đầu', elementary: 'Cơ bản',
  intermediate: 'Trung cấp', advanced: 'Nâng cao',
}
const LEVEL_COLOR: Record<string, string> = {
  beginner: '#2E6B40', elementary: '#5A8A2A',
  intermediate: '#A07820', advanced: '#8B3A1E',
}

// ─── Tool catalogue ────────────────────────────────────────────────────────────
type ToolItem = {
  id: string; icon: string; name: string; desc: string
  tier: 'free' | 'basic' | 'standard' | 'pro'
  category: string
}

const TOOLS: ToolItem[] = [
  // TAP
  { id: 'tap-tempo',  icon: '🎵', name: 'Tap Tempo',    desc: 'Gõ tìm BPM',              tier: 'free',     category: 'Luyện nhịp' },
  { id: 'tap-beat',   icon: '🥁', name: 'Tap Beat',     desc: 'Gõ theo nhịp bài hát',    tier: 'free',     category: 'Luyện nhịp' },
  { id: 'tap-beam',   icon: '🎼', name: 'Tap Beam',     desc: 'Nối phách nâng cao',       tier: 'basic',    category: 'Luyện nhịp' },
  { id: 'tap-sing',   icon: '🎤', name: 'Tap & Sing',   desc: 'Gõ nhịp và hát theo',     tier: 'basic',    category: 'Luyện nhịp' },
  { id: 'tap-strum',  icon: '🎸', name: 'Tap & Strum',  desc: 'Gõ nhịp và đệm guitar',   tier: 'standard', category: 'Luyện nhịp' },
  // PLAYER
  { id: 'scroll-kara',   icon: '📜', name: 'Scroll Kara',    desc: 'Lời cuộn + hợp âm',     tier: 'basic',    category: 'Player' },
  { id: 'chord-seeing',  icon: '👁', name: 'Chord Seeing',   desc: 'Karaoke cho nhạc sĩ',   tier: 'standard', category: 'Player' },
  { id: 'backing-track', icon: '🎧', name: 'Backing Track',  desc: 'Nhạc nền luyện tập',    tier: 'standard', category: 'Player' },
  // THEORY
  { id: 'note-sheet',  icon: '📖', name: 'Note Sheet',   desc: 'Đọc và viết nốt nhạc',   tier: 'standard', category: 'Nhạc lý' },
  { id: 'hoa-am',      icon: '🎹', name: 'Hòa âm',       desc: 'Diatonic · Triad',        tier: 'standard', category: 'Nhạc lý' },
  { id: 'scale-lead',  icon: '🎶', name: 'Scale – Lead', desc: 'Gam & giai điệu',         tier: 'pro',      category: 'Nhạc lý' },
  // EDITOR
  { id: 'editor',       icon: '✏️', name: 'Editor',        desc: 'Soạn bài + YouTube sync', tier: 'pro', category: 'Sáng tác' },
  { id: 'guitar-board', icon: '🎸', name: 'GuitarBoard',   desc: 'Bảng hợp âm trực quan',  tier: 'pro', category: 'Sáng tác' },
  { id: 'lyric-sheet',  icon: '📝', name: 'Lyric Sheet',   desc: 'Biên tập lời + hợp âm',  tier: 'pro', category: 'Sáng tác' },
  // STUDIO & AI
  { id: 'm-record',  icon: '🎬', name: 'M-Record',    desc: 'Ghi âm & video',             tier: 'pro', category: 'Studio' },
  { id: 'mj-chat',   icon: '🤖', name: 'MJ Chat Bot', desc: 'Trợ lý học nhạc AI',        tier: 'pro', category: 'Studio' },
  { id: 'book-tools',icon: '📚', name: 'Book & Tools',desc: 'Tài liệu & giáo trình',     tier: 'pro', category: 'Studio' },
]

// Which tools unlocked at each level
const UNLOCKED_TIERS: Record<string, string[]> = {
  beginner:     ['free'],
  elementary:   ['free', 'basic'],
  intermediate: ['free', 'basic', 'standard'],
  advanced:     ['free', 'basic', 'standard', 'pro'],
}
const TIER_LABEL: Record<string, string> = {
  free: 'Miễn phí', basic: 'Cơ bản',
  standard: 'Chuẩn', pro: 'Hành trình',
}
const TIER_COLOR: Record<string, string> = {
  free: T.greenMid, basic: '#5A8A2A',
  standard: '#A07820', pro: '#8B3A1E',
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student {
  id: string; full_name: string; phone: string | null
  email: string | null; level: string | null; is_active: boolean
  enrolled_at: string | null
}

type Step = 'welcome' | 'search' | 'confirm' | 'portal'

// ─── Storage helpers ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'csre-student-id'
function saveStudentId(id: string) { localStorage.setItem(STORAGE_KEY, id) }
function loadStudentId() { return localStorage.getItem(STORAGE_KEY) }
function clearStudentId() { localStorage.removeItem(STORAGE_KEY) }

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StudentOnboarding() {
  const [step, setStep] = useState<Step>('welcome')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Student[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Student | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-login if already identified
  useEffect(() => {
    const savedId = loadStudentId()
    if (savedId) {
      supabase.from('edu_students')
        .select('id,full_name,phone,email,level,is_active,enrolled_at')
        .eq('id', savedId).single()
        .then(({ data }) => {
          if (data) { setStudent(data); setStep('portal') }
        })
    }
  }, [])

  // Debounce search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(() => {
      setSearching(true)
      const q = query.trim()
      supabase.from('edu_students')
        .select('id,full_name,phone,email,level,is_active,enrolled_at')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .eq('is_active', true)
        .limit(6)
        .then(({ data }) => {
          setResults(data ?? [])
          setSearching(false)
        })
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  const handleConfirm = () => {
    if (!selected) return
    saveStudentId(selected.id)
    setStudent(selected)
    setStep('portal')
  }

  const handleLogout = () => {
    clearStudentId()
    setStudent(null)
    setSelected(null)
    setQuery('')
    setResults([])
    setStep('welcome')
  }

  // Focus search input when step changes to search
  useEffect(() => {
    if (step === 'search') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [step])

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '"Segoe UI", Inter, system-ui, sans-serif',
      color: T.text,
    }}>
      {/* Header */}
      <header style={{
        background: T.header, padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.headerDark}`,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎸</span>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
              Thầy Văn Anh Guitar
            </div>
            <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 11 }}>
              Music Learning System
            </div>
          </div>
        </div>
        {student && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{student.full_name}</div>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>
                {student.level ? LEVEL_LABEL[student.level] : 'Học sinh'}
              </div>
            </div>
            <button onClick={handleLogout} style={{
              background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
              borderRadius: 8, color: 'rgba(255,255,255,.7)', cursor: 'pointer',
              padding: '6px 12px', fontSize: 12,
            }}>
              Đổi TK
            </button>
          </div>
        )}
      </header>

      {/* ── STEP: WELCOME ──────────────────────────────────────────────────── */}
      {step === 'welcome' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: 'calc(100vh - 56px)',
          padding: 32, textAlign: 'center', gap: 0,
        }}>
          {/* Hero illustration */}
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: T.header, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 42, marginBottom: 24,
            boxShadow: `0 4px 24px rgba(27,107,58,.25)`,
          }}>
            🎸
          </div>

          <h1 style={{
            fontSize: 28, fontWeight: 800, color: T.text,
            margin: '0 0 10px', lineHeight: 1.2,
          }}>
            Chào mừng đến với<br />
            <span style={{ color: T.header }}>Thầy Văn Anh Guitar</span>
          </h1>

          <p style={{
            color: T.textMuted, fontSize: 15, lineHeight: 1.7,
            maxWidth: 380, margin: '0 0 32px',
          }}>
            Nơi hành trình âm nhạc của bạn bắt đầu. Học nhịp, hòa âm, và guitar
            theo lộ trình được thiết kế riêng cho bạn.
          </p>

          {/* Feature pills */}
          <div style={{
            display: 'flex', gap: 8, flexWrap: 'wrap',
            justifyContent: 'center', marginBottom: 36,
          }}>
            {['🥁 Luyện nhịp', '🎸 Hợp âm', '📖 Nhạc lý', '🤖 AI trợ lý'].map(f => (
              <span key={f} style={{
                background: T.bgCard, border: `1px solid ${T.border}`,
                borderRadius: 20, padding: '5px 14px', fontSize: 13, color: T.textMuted,
              }}>
                {f}
              </span>
            ))}
          </div>

          <button
            onClick={() => setStep('search')}
            style={{
              background: T.header, color: '#fff', border: 'none',
              borderRadius: 12, padding: '14px 40px', fontSize: 16,
              fontWeight: 700, cursor: 'pointer', letterSpacing: '.01em',
              boxShadow: `0 4px 16px rgba(27,107,58,.3)`,
              transition: 'transform .1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            Bắt đầu hành trình →
          </button>

          <p style={{ color: T.textDim, fontSize: 12, marginTop: 16 }}>
            Đã là học sinh? Tìm tài khoản của bạn trong hệ thống.
          </p>
        </div>
      )}

      {/* ── STEP: SEARCH ───────────────────────────────────────────────────── */}
      {step === 'search' && (
        <div style={{
          maxWidth: 480, margin: '0 auto',
          padding: '40px 24px', minHeight: 'calc(100vh - 56px)',
        }}>
          <button onClick={() => setStep('welcome')} style={{
            background: 'none', border: 'none', color: T.textMuted,
            cursor: 'pointer', fontSize: 13, padding: '0 0 20px', display: 'flex',
            alignItems: 'center', gap: 6,
          }}>
            ← Quay lại
          </button>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: T.text }}>
            Tìm tài khoản của bạn
          </h2>
          <p style={{ color: T.textMuted, fontSize: 14, margin: '0 0 24px', lineHeight: 1.6 }}>
            Nhập tên hoặc số điện thoại. Thầy đã thêm bạn vào hệ thống rồi — chỉ cần tìm tên mình!
          </p>

          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 16,
            }}>🔍</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Nhập tên hoặc số điện thoại..."
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '13px 16px 13px 42px',
                background: T.bgLight, border: `1.5px solid ${T.border}`,
                borderRadius: 12, fontSize: 15, color: T.text,
                outline: 'none', fontFamily: 'inherit',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = T.header)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border)}
            />
            {searching && (
              <span style={{
                position: 'absolute', right: 14, top: '50%',
                transform: 'translateY(-50%)', color: T.textDim, fontSize: 13,
              }}>
                ⏳
              </span>
            )}
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelected(s); setStep('confirm') }}
                  style={{
                    background: T.bgCard, border: `1.5px solid ${T.borderLight}`,
                    borderRadius: 12, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'border-color .15s, transform .1s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = T.header
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = T.borderLight
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: T.greenLight, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 16, fontWeight: 700,
                    color: T.header, flexShrink: 0,
                    border: `1px solid ${T.borderLight}`,
                  }}>
                    {s.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: T.text }}>
                      {s.full_name}
                    </div>
                    <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>
                      {s.phone ? `📱 ${s.phone}` : ''}{s.phone && s.level ? '  ·  ' : ''}
                      {s.level ? (
                        <span style={{ color: LEVEL_COLOR[s.level] || T.textMuted }}>
                          {LEVEL_LABEL[s.level]}
                        </span>
                      ) : ''}
                    </div>
                  </div>
                  <span style={{ color: T.textDim, fontSize: 18 }}>›</span>
                </button>
              ))}
            </div>
          )}

          {query.length >= 2 && !searching && results.length === 0 && (
            <div style={{
              background: T.bgCard, border: `1px solid ${T.borderLight}`,
              borderRadius: 12, padding: '24px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🤔</div>
              <div style={{ fontWeight: 600, marginBottom: 6, color: T.text }}>
                Không tìm thấy "{query}"
              </div>
              <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
                Thầy cần thêm bạn vào hệ thống trước.<br />
                Liên hệ Thầy Văn Anh để được hỗ trợ.
              </div>
            </div>
          )}

          {query.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👆</div>
              <div style={{ color: T.textMuted, fontSize: 14 }}>
                Gõ ít nhất 2 ký tự để tìm kiếm
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP: CONFIRM ──────────────────────────────────────────────────── */}
      {step === 'confirm' && selected && (
        <div style={{
          maxWidth: 440, margin: '0 auto',
          padding: '40px 24px', minHeight: 'calc(100vh - 56px)',
        }}>
          <button onClick={() => setStep('search')} style={{
            background: 'none', border: 'none', color: T.textMuted,
            cursor: 'pointer', fontSize: 13, padding: '0 0 20px', display: 'flex',
            alignItems: 'center', gap: 6,
          }}>
            ← Quay lại tìm kiếm
          </button>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: T.text }}>
            Xác nhận tài khoản
          </h2>
          <p style={{ color: T.textMuted, fontSize: 14, margin: '0 0 28px' }}>
            Đây có phải là bạn không?
          </p>

          {/* Student card */}
          <div style={{
            background: T.bgCard, border: `2px solid ${T.header}`,
            borderRadius: 16, padding: '24px 20px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: T.header, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 24, color: '#fff', fontWeight: 700,
              }}>
                {selected.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, color: T.text }}>
                  {selected.full_name}
                </div>
                {selected.level && (
                  <div style={{
                    display: 'inline-block', marginTop: 4,
                    background: LEVEL_COLOR[selected.level] + '18',
                    color: LEVEL_COLOR[selected.level],
                    borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                    border: `1px solid ${LEVEL_COLOR[selected.level]}40`,
                  }}>
                    {LEVEL_LABEL[selected.level]}
                  </div>
                )}
              </div>
            </div>

            <div style={{
              borderTop: `1px solid ${T.borderLight}`,
              paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {selected.phone && (
                <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                  <span style={{ color: T.textDim }}>📱</span>
                  <span style={{ color: T.textMuted }}>{selected.phone}</span>
                </div>
              )}
              {selected.enrolled_at && (
                <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                  <span style={{ color: T.textDim }}>📅</span>
                  <span style={{ color: T.textMuted }}>
                    Học từ {new Date(selected.enrolled_at).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tools preview */}
          <div style={{
            background: T.greenLight, borderRadius: 10,
            border: `1px solid ${T.borderLight}`,
            padding: '12px 16px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 12, color: T.greenMid, fontWeight: 600, marginBottom: 8 }}>
              🎁 Tài nguyên được mở khoá cho bạn
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TOOLS.filter(t => {
                const unlockedTiers = UNLOCKED_TIERS[selected.level ?? 'beginner'] ?? ['free']
                return unlockedTiers.includes(t.tier)
              }).map(t => (
                <span key={t.id} style={{
                  background: '#fff', border: `1px solid ${T.borderLight}`,
                  borderRadius: 6, padding: '3px 9px', fontSize: 12, color: T.textMuted,
                }}>
                  {t.icon} {t.name}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={handleConfirm}
            style={{
              width: '100%', background: T.header, color: '#fff',
              border: 'none', borderRadius: 12, padding: '14px',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: `0 4px 16px rgba(27,107,58,.25)`,
            }}
          >
            ✓ Đúng rồi, đây là tôi!
          </button>

          <button
            onClick={() => { setSelected(null); setStep('search') }}
            style={{
              width: '100%', background: 'none', border: 'none',
              color: T.textMuted, fontSize: 13, cursor: 'pointer', marginTop: 12, padding: 8,
            }}
          >
            Không phải tôi → Tìm lại
          </button>
        </div>
      )}

      {/* ── STEP: PORTAL ───────────────────────────────────────────────────── */}
      {step === 'portal' && student && (
        <PortalView student={student} />
      )}
    </div>
  )
}

// ─── Portal View ──────────────────────────────────────────────────────────────
function PortalView({ student }: { student: Student }) {
  const level = student.level ?? 'beginner'
  const unlockedTiers = UNLOCKED_TIERS[level] ?? ['free']
  const unlockedCount = TOOLS.filter(t => unlockedTiers.includes(t.tier)).length

  const categories = [...new Set(TOOLS.map(t => t.category))]

  const handleToolClick = (tool: ToolItem) => {
    const isUnlocked = unlockedTiers.includes(tool.tier)
    if (!isUnlocked) return
    // Route to tools
    const routes: Record<string, string> = {
      'tap-tempo': '/tap',
      'tap-beat':  '/tap',
      'scroll-kara': '/tap',
      'chord-seeing': '/tap',
    }
    const route = routes[tool.id]
    if (route) window.location.href = route
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>

      {/* Welcome banner */}
      <div style={{
        background: `linear-gradient(135deg, ${T.header} 0%, ${T.headerDark} 100%)`,
        borderRadius: 16, padding: '22px 24px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, marginBottom: 4 }}>
            Chào mừng trở lại 👋
          </div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 6 }}>
            {student.full_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {student.level && (
              <span style={{
                background: 'rgba(255,255,255,.15)', color: '#fff',
                borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600,
              }}>
                {LEVEL_LABEL[student.level]}
              </span>
            )}
            <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>
              {unlockedCount}/{TOOLS.length} công cụ mở khoá
            </span>
          </div>
        </div>

        {/* XP Progress */}
        <div style={{ minWidth: 160 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            color: 'rgba(255,255,255,.6)', fontSize: 11, marginBottom: 6,
          }}>
            <span>Tiến độ cấp độ</span>
            <span>{unlockedCount * 10} XP</span>
          </div>
          <div style={{
            height: 6, background: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: T.goldLight,
              width: `${Math.min(100, (unlockedCount / TOOLS.length) * 100)}%`,
              transition: 'width .5s ease',
            }} />
          </div>
          <div style={{
            color: 'rgba(255,255,255,.5)', fontSize: 10, marginTop: 4,
          }}>
            {TOOLS.length - unlockedCount} công cụ đang chờ được mở khoá
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10, marginBottom: 28,
      }}>
        {[
          { icon: '🥁', label: 'Tap nhịp ngay', route: '/tap', hot: true },
          { icon: '🎵', label: 'Bài hát mới', route: '/tap', hot: false },
          { icon: '📋', label: 'Bài tập của tôi', route: '#', hot: false },
        ].map(a => (
          <button
            key={a.label}
            onClick={() => a.route !== '#' && (window.location.href = a.route)}
            style={{
              background: a.hot ? T.header : T.bgCard,
              border: `1.5px solid ${a.hot ? T.header : T.borderLight}`,
              borderRadius: 12, padding: '14px 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 6, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'transform .1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <span style={{ fontSize: 22 }}>{a.icon}</span>
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: a.hot ? '#fff' : T.text,
            }}>
              {a.label}
            </span>
          </button>
        ))}
      </div>

      {/* Tools by category */}
      {categories.map(cat => {
        const catTools = TOOLS.filter(t => t.category === cat)
        return (
          <div key={cat} style={{ marginBottom: 28 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 12, paddingBottom: 8,
              borderBottom: `1px solid ${T.borderLight}`,
            }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{cat}</span>
              <span style={{ fontSize: 12, color: T.textDim }}>
                {catTools.filter(t => unlockedTiers.includes(t.tier)).length}/{catTools.length}
              </span>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 10,
            }}>
              {catTools.map(tool => {
                const unlocked = unlockedTiers.includes(tool.tier)
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolClick(tool)}
                    disabled={!unlocked}
                    style={{
                      background: unlocked ? T.bgLight : T.bgCard,
                      border: `1.5px solid ${unlocked ? T.border : T.borderLight}`,
                      borderRadius: 10, padding: '12px 12px',
                      display: 'flex', flexDirection: 'column', gap: 5,
                      cursor: unlocked ? 'pointer' : 'default',
                      opacity: unlocked ? 1 : 0.65,
                      textAlign: 'left', fontFamily: 'inherit',
                      position: 'relative', transition: 'transform .1s',
                    }}
                    onMouseEnter={e => { if (unlocked) e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    {/* Lock icon */}
                    {!unlocked && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        fontSize: 13, opacity: .5,
                      }}>🔒</div>
                    )}
                    {unlocked && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: T.greenLight, borderRadius: 4,
                        padding: '1px 6px', fontSize: 10,
                        color: T.greenMid, fontWeight: 600,
                        border: `1px solid ${T.borderLight}`,
                      }}>
                        Mở
                      </div>
                    )}
                    <span style={{ fontSize: 22 }}>{tool.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                      {tool.name}
                    </span>
                    <span style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>
                      {tool.desc}
                    </span>
                    {!unlocked && (
                      <span style={{
                        fontSize: 10, color: TIER_COLOR[tool.tier],
                        fontWeight: 600, marginTop: 2,
                      }}>
                        Cần: {TIER_LABEL[tool.tier]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Footer nudge */}
      <div style={{
        background: T.bgCard, border: `1px solid ${T.borderLight}`,
        borderRadius: 12, padding: '16px 20px', textAlign: 'center',
        marginTop: 8,
      }}>
        <div style={{ fontSize: 20, marginBottom: 6 }}>💡</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: T.text, marginBottom: 4 }}>
          Muốn mở khoá thêm công cụ?
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
          Hoàn thành bài tập và học chăm chỉ để lên cấp.
          Thầy sẽ cấp quyền truy cập thêm khi bạn tiến bộ!
        </div>
      </div>
    </div>
  )
}
