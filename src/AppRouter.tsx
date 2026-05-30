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
import TeacherAdminPage from './TeacherAdminPage'
import CourseEditorPage from './CourseEditorPage'
import LessonViewerPage from './LessonViewerPage'
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
      <p style={{ color: '#8A8070', maxWidth: 420, lineHeight: 1.7, margin: 0, fontSize: 15 }}>
        Nếu bạn là{' '}
        <strong style={{ color: '#3F7D3A' }}>học sinh của Thầy Văn Anh</strong>,
        hãy đăng nhập để lưu điểm và theo dõi tiến độ học tập.
      </p>
      <button onClick={handleLogin} style={{
        background: '#3F7D3A', border: 'none', borderRadius: 12,
        color: 'white', cursor: 'pointer', padding: '13px 36px',
        fontSize: 15, fontWeight: 700,
      }}>
        Đăng nhập
      </button>
      <div style={{ color: '#B0A898', fontSize: 13 }}>hoặc</div>
      <button onClick={onGuest} style={{
        background: 'none', border: '1px solid #D8C8A8',
        borderRadius: 12, color: '#8A8070', cursor: 'pointer',
        padding: '11px 28px', fontSize: 13, lineHeight: 1.5,
      }}>
        Xem thử 3 bài<br />
        <span style={{ fontSize: 11, color: '#B0A898' }}>(không cần đăng nhập)</span>
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
    const { data } = await supabase.from('app_users').select('*').eq('id', userId).single()
    setAppUser(data)
    setLoading(false)
  }

  const isTeacher = appUser?.role === 'teacher' || appUser?.role === 'admin'

  // ── Route /guitarboard ──
  if (path === '/guitarboard' || path.startsWith('/guitarboard')) {
    return <GuitarBoard />
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
        onClose={handleClose}
        userRole={user ? (appUser?.role ?? 'student') : 'guest'}
      />
    )
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

  // ── Route / và /player — Player (trang chủ, chỉ teacher) ──
  const extraActions = (
    <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {!loading && !user && (
        <button onClick={async () => {
          const email = prompt('Email:')
          const password = prompt('Mật khẩu:')
          if (email && password) await supabase.auth.signInWithPassword({ email, password })
        }} style={{ border: '1px solid #374151', borderRadius: 8, color: '#9CA3AF', cursor: 'pointer', padding: '8px 16px', fontSize: 13, background: 'none' }}>
          Đăng nhập
        </button>
      )}
      {user && isTeacher && (
        <>
          <button onClick={() => { window.location.href = '/editor' }}
            style={{ border: '1px solid #374151', borderRadius: 8, color: '#9CA3AF', cursor: 'pointer', padding: '8px 16px', fontSize: 13, background: 'none' }}>
            ✏️ Editor
          </button>
          <button onClick={() => { window.location.href = '/youtube-sync' }}
            style={{ border: '1px solid #374151', borderRadius: 8, color: '#C99700', cursor: 'pointer', padding: '8px 16px', fontSize: 13, background: 'none' }}>
            🎵 YouTube Sync
          </button>
        </>
      )}
      <button onClick={() => { window.location.href = '/tap' }}
        style={{ border: '1px solid #374151', borderRadius: 8, color: '#10B981', cursor: 'pointer', padding: '8px 16px', fontSize: 13, background: 'none' }}>
        🥁 Tap nhịp
      </button>
      {user && (
        <button onClick={() => supabase.auth.signOut()}
          style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 13 }}>
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
