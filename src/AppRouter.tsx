import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import { PlayerView } from './PlayerView'
import { TapWithSong } from './TapWithSong'
import { GpEditor } from './GpEditor'
import App from './App'
import GuitarBoard from './GuitarBoard'
import YouTubeSyncPage from './YouTubeSyncPage'   // ← THÊM
import type { RhythmSong } from './types'
import { createEmptySong } from './utils'
import StudentList from './StudentList'
import StudentProfile from './StudentProfile'
import StudentOnboarding from './StudentOnboarding'
import GuitarTuner from './GuitarTuner'
import { NATIVE_LESSONS } from './elearn/nativeLessons'
import ChordStrumPlayer from './elearn/ChordStrumPlayer'
import { HBD_CHUM2, HBD_TD1, STRUM_BALLAD } from './elearn/strumSongs'
import ImportPage from './ImportPage'
import TapTempoTool from './TapTempoTool'
import SongBuilderPage from './SongBuilderPage'
import TeacherAdminPage from './TeacherAdminPage'
import CourseEditorPage from './CourseEditorPage'
import LessonViewerPage from './LessonViewerPage'
import FlowLabPage from './FlowLabPage'
import FlowMigratePage from './FlowMigratePage'
import JoinGroupPage from './JoinGroupPage'
import DeleteAccountPage from './DeleteAccountPage'
import ClassLandingPage from './ClassLandingPage'
type AppUser = {
  id: string
  role: string
  name: string
  email: string
}

function TapLandingPage({ onGuest }: { onGuest: () => void }) {
  const handleLogin = async () => {
    const email = prompt('Email:')
    const password = prompt('Mật khẩu:')
    if (email && password) await supabase.auth.signInWithPassword({ email, password })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F2EA',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 24,
      textAlign: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ fontSize: 56 }}>🥁</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#1F2A1F' }}>
        Luyện nhịp cùng Thầy Văn Anh
      </h1>
      <p style={{ color: '#8A8070', maxWidth: 420, lineHeight: 1.7, margin: 0, fontSize: 16 }}>
        Nếu bạn là{' '}
        <strong style={{ color: '#3F7D3A' }}>học sinh của Thầy Văn Anh</strong>,
        hãy đăng nhập để lưu điểm và theo dõi tiến độ học tập.
      </p>
      <button onClick={handleLogin} style={{
        background: '#3F7D3A', border: 'none', borderRadius: 12,
        color: 'white', cursor: 'pointer', padding: '13px 36px',
        fontSize: 16, fontWeight: 700,
      }}>
        Đăng nhập
      </button>
      <div style={{ color: '#B0A898', fontSize: 14 }}>hoặc</div>
      <button onClick={onGuest} style={{
        background: 'none', border: '1px solid #D8C8A8',
        borderRadius: 12, color: '#8A8070', cursor: 'pointer',
        padding: '11px 28px', fontSize: 14, lineHeight: 1.5,
      }}>
        Xem thử 3 bài<br />
        <span style={{ fontSize: 12, color: '#B0A898' }}>(không cần đăng nhập)</span>
      </button>
    </div>
  )
}

export default function AppRouter() {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [guestMode, setGuestMode] = useState(false)
  const [showEditor, setShowEditor] = useState(() => {
    const f = localStorage.getItem('csre-open-editor')
    if (f) { localStorage.removeItem('csre-open-editor'); return true }
    return false
  })
  const [playerSong, setPlayerSong] = useState<RhythmSong>(createEmptySong())

  const path = window.location.pathname

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadAppUser(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadAppUser(session.user.id)
      else { setAppUser(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadAppUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('app_users').select('*').eq('id', userId).single()
      if (!error && data) setAppUser(data)
      // Nếu query lỗi (network, RLS...) → KHÔNG set appUser = null
      // Giữ nguyên trạng thái cũ, tránh bị redirect sai sang /tap
    } catch (_) {
      // Silently ignore — user vẫn logged in, chỉ không load được role
    } finally {
      setLoading(false)
    }
  }

  const isTeacher = appUser?.role === 'teacher' || appUser?.role === 'admin'

  // ── Domain class.vananhaudio.com → luôn hiện trang tuyển sinh (mọi path) ──
  if (typeof window !== 'undefined' && window.location.hostname.startsWith('class.')) {
    return <ClassLandingPage />
  }

  // ── Route /delete-account — xóa tài khoản ──
  if (path === '/delete-account' || path.startsWith('/delete-account')) {
    return <DeleteAccountPage />
  }

  // ── Route /join-group/<token> — học viên tự xác nhận nhóm (tự xử lý auth) ──
  if (path.startsWith('/join-group/')) {
    return <JoinGroupPage />
  }

  // ── Route /class — trang tuyển sinh công khai (class.vananhaudio.com) ──
  if (path === '/class' || path.startsWith('/class')) {
    return <ClassLandingPage />
  }

  // ── Route /guitarboard ──
  if (path === '/guitarboard' || path.startsWith('/guitarboard')) {
    return <GuitarBoard />
  }

  // ── Route /chord-trainer (THỬ NGHIỆM bài học C↔G7 hoàn chỉnh) ──
  if (path === '/chord-trainer' || path.startsWith('/chord-trainer')) {
    const C = NATIVE_LESSONS['chord-cg7'].Component
    return <C onClose={() => { window.location.href = '/start' }} />
  }
  // ── Route /chord-ame (THỬ NGHIỆM bài Am & E) ──
  if (path === '/chord-ame' || path.startsWith('/chord-ame')) {
    const C = NATIVE_LESSONS['chord-am-e'].Component
    return <C onClose={() => { window.location.href = '/start' }} />
  }
  // ── Route /chord-basic1 (THỬ NGHIỆM Chuyển hợp âm cơ bản 1) ──
  if (path === '/chord-basic1' || path.startsWith('/chord-basic1')) {
    const C = NATIVE_LESSONS['chord-basic-1'].Component
    return <C onClose={() => { window.location.href = '/start' }} />
  }
  // ── Route /welcome-td2 (THỬ NGHIỆM slide chào mừng Trình độ 2) ──
  if (path === '/welcome-td2' || path.startsWith('/welcome-td2')) {
    const C = NATIVE_LESSONS['welcome-td2'].Component
    return <C onClose={() => { window.location.href = '/start' }} />
  }
  // ── Route /strum-test (THỬ NGHIỆM màn quạt hợp âm — audio + mốc giả) ──
  if (path === '/strum-test' || path.startsWith('/strum-test')) {
    const STORE = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/lessons/'
    const sample = {
      title: 'Test · quạt hợp âm', audioUrl: STORE + 'Chum%202%20not%20moc%20don.wav',
      bpm: 80, timeSignature: 4, gridOffset: 0, eighths: true,
      bars: [{ pickup: true }, { chord: 'C' }, { chord: 'G7' }, { chord: 'Am' }, { chord: 'Fmaj7' }, { chord: 'C' }, { chord: 'G7' }, { chord: 'C' }],
    }
    return <ChordStrumPlayer song={sample} onClose={() => { window.location.href = '/start' }} />
  }
  // ── Route /hbd (Happy Birthday — quạt chùm 2, gảy theo) ──
  if (path === '/strum-backing' || path.startsWith('/strum-backing')) {
    return <ChordStrumPlayer song={STRUM_BALLAD} onClose={() => { window.location.href = '/start' }} />
  }
  if (path === '/hbd-td1' || path.startsWith('/hbd-td1')) {
    return <ChordStrumPlayer song={HBD_TD1} onClose={() => { window.location.href = '/start' }} />
  }
  if (path === '/hbd' || path.startsWith('/hbd')) {
    return <ChordStrumPlayer song={HBD_CHUM2} onClose={() => { window.location.href = '/start' }} />
  }
  // ── Route /chum2 (THỬ NGHIỆM slide Chùm 2 Nốt Móc Đơn) ──
  if (path === '/chum2-strum' || path.startsWith('/chum2-strum')) {
    const C = NATIVE_LESSONS['chord-strum-chum2'].Component
    return <C onClose={() => { window.location.href = '/start' }} />
  }
  if (path === '/chum2' || path.startsWith('/chum2')) {
    const C = NATIVE_LESSONS['chum-2-moc-don'].Component
    return <C onClose={() => { window.location.href = '/start' }} />
  }

  // ── Route /gp-editor ──
  if (path === '/gp-editor') {
    return <GpEditor onClose={() => { window.location.href = '/tap' }} />
  }

  // ── Route /youtube-sync — chỉ teacher ──          ← THÊM BLOCK NÀY
  if (path === '/youtube-sync' || path.startsWith('/youtube-sync')) {
    if (loading) return null
    if (!user || !isTeacher) {
      window.location.href = '/tap'
      return null
    }
    return <YouTubeSyncPage />
  }

// ── Route /course ── Lesson viewer (students)
if (path === '/course' && !path.startsWith('/course-editor')) {
  return <LessonViewerPage />
}
if (path === '/chords' || path.startsWith('/chords')) {
  const params = window.location.search
  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
      <iframe
        src={'https://chords-vananhaudio.netlify.app' + params}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow='microphone'
        title='Luyen hop am'
      />
    </div>
  )
}
// ── Route /course-editor ──
if (path === '/course-editor' || path.startsWith('/course-editor')) {
  if (loading) return null
  if (!user || !isTeacher) { window.location.href = '/tap'; return null }
  return <CourseEditorPage />
}

// ── Route /admin — Teacher admin panel ──
if (path === '/admin' || path.startsWith('/admin')) {
  if (loading) return null
  if (!user || !isTeacher) { window.location.href = '/start'; return null }
  return <TeacherAdminPage />
}

// ── Route /flow-lab — Xem thử engine Flow mới (mọi người đã đăng nhập; chỉ dữ liệu mẫu) ──
if (path === '/flow-lab' || path.startsWith('/flow-lab')) {
  if (loading) return null
  if (!user) { window.location.href = '/start'; return null }
  return <FlowLabPage />
}

// ── Route /flow-migrate — Migrate 11 bài Nhập Môn → Flow (teacher) ──
if (path === '/flow-migrate' || path.startsWith('/flow-migrate')) {
  if (loading) return null
  if (!user || !isTeacher) { window.location.href = '/start'; return null }
  return <FlowMigratePage />
}

// ── Route /start — Student onboarding ──
if (path === '/start' || path.startsWith('/start')) {
  return <StudentOnboarding />
}

// ── Route /student ──
if (path.startsWith('/student') && !path.startsWith('/students')) {
  if (loading) return null
  if (!user || !isTeacher) { window.location.href = '/tap'; return null }
  const id = new URLSearchParams(window.location.search).get('id')
  if (!id) { window.location.href = '/students'; return null }
  return <StudentProfile studentId={id} onBack={() => { window.location.href = '/students' }} />
}

// ── Route /students ──
if (path === '/students') {
  if (loading) return null

  return <StudentList onSelect={id => { window.location.href = `/student?id=${id}` }} />
}
  // ── Route /player — chỉ teacher ──
  if (path === '/player' || path.startsWith('/player')) {
    if (loading) return null
    if (!user || !isTeacher) { window.location.href = '/tap'; return null }
    // fall through → render PlayerView
  }

  // embedded=1 → tool mở trong iframe overlay của MobileStudentPortal → ẩn nút ✕ bên trong tool
  const embedded = new URLSearchParams(window.location.search).get('embedded') === '1'

  // ── Route /tempo — Tap Tempo Tool ──
  if (path === '/tempo' || path.startsWith('/tempo')) {
    return <TapTempoTool onClose={embedded ? undefined : () => { window.history.back() }} />
  }

  // ── Route /song-builder — Song Builder V1 ──
  if (path === '/song-builder' || path.startsWith('/song-builder')) {
    const standalone = new URLSearchParams(window.location.search).get('standalone') === '1'
    return <SongBuilderPage onClose={standalone || embedded ? undefined : () => { window.location.href = '/start' }} />
  }

  // ── Route /tuner ──
  if (path === "/tuner" || path.startsWith("/tuner")) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0d0d0d", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px 16px 40px" }}>
        <GuitarTuner />
      </div>
    )
  }

    // ── Route /tap ──
  if (path === '/tap' || path.startsWith('/tap')) {
    if (loading) return null

    if (!user && !guestMode) {
      return <TapLandingPage onGuest={() => setGuestMode(true)} />
    }

    const handleClose = () => {
      if (!user && guestMode) {
        setGuestMode(false)
      } else {
        window.location.href = '/'
      }
    }

    return (
      <TapWithSong
        onClose={embedded ? undefined : handleClose}
        userRole={user ? (appUser?.role ?? 'student') : 'guest'}
      />
    )
  }

  // ── Route /import — chỉ teacher ──
  if (path === '/import') {
    if (!loading && (!user || !isTeacher)) { window.location.href = '/tap'; return null }
    return <ImportPage onClose={() => window.location.href = '/editor'} />
  }

  // ── Route /editor — chỉ teacher ──
  if (path === '/editor' || path.startsWith('/editor')) {
    if (loading) return null
    if (!user || !isTeacher) {
      window.location.href = '/tap'
      return null
    }
    return <App />
  }

  // ── Route / — Trang chủ: mở thẳng cổng học viên (app vào đây) ──
  if (path === '/') {
    // Teacher vào trang chủ → đưa thẳng về player (tránh mở sai màn hình)
    if (!loading && user && isTeacher) {
      window.location.href = '/player'
      return null
    }
    if (loading) return null   // chờ xác thực xong mới render
    return <StudentOnboarding />
  }

  // ── Route /player — Player (chỉ teacher) ──
  const extraActions = (
    <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {!loading && !user && (
        <button onClick={async () => {
          const email = prompt('Email:')
          const password = prompt('Mật khẩu:')
          if (email && password) await supabase.auth.signInWithPassword({ email, password })
        }} style={{ border: '1px solid #374151', borderRadius: 8, color: '#9CA3AF', cursor: 'pointer', padding: '8px 16px', fontSize: 14, background: 'none' }}>
          Đăng nhập
        </button>
      )}
      {user && isTeacher && (
        <>
          <button onClick={() => { window.location.href = '/editor' }}
            style={{ border: '1px solid #374151', borderRadius: 8, color: '#9CA3AF', cursor: 'pointer', padding: '8px 16px', fontSize: 14, background: 'none' }}>
            ✏️ Editor
          </button>
          <button onClick={() => { window.location.href = '/youtube-sync' }}
            style={{ border: '1px solid #374151', borderRadius: 8, color: '#C99700', cursor: 'pointer', padding: '8px 16px', fontSize: 14, background: 'none' }}>
            🎵 YouTube Sync
          </button>
        </>
      )}
      <button onClick={() => { window.location.href = '/tap' }}
        style={{ border: '1px solid #374151', borderRadius: 8, color: '#10B981', cursor: 'pointer', padding: '8px 16px', fontSize: 14, background: 'none' }}>
        🥁 Tap nhịp
      </button>
      {user && (
        <button onClick={() => supabase.auth.signOut()}
          style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 14 }}>
          Đăng xuất ({appUser?.name ?? user.email})
        </button>
      )}
    </div>
  )

  return <PlayerView
    song={playerSong}
    onClose={() => setPlayerSong(createEmptySong())}
    onImportSong={s => setPlayerSong(s)}
    extraActions={extraActions}
  />
}
