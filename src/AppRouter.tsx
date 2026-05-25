import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import { PlayerView } from './PlayerView'
import { TapWithSong } from './TapWithSong'
import { GpEditor } from './GpEditor'
import App from './App'
import type { RhythmSong } from './types'
import { createEmptySong } from './utils'

type AppUser = {
  id: string
  role: string
  name: string
  email: string
}

// ── Trang chào /tap cho khách chưa đăng nhập ──
function TapLandingPage({ onGuest }: { onGuest: () => void }) {
  const handleLogin = async () => {
    const email = prompt('Email:')
    const password = prompt('Mật khẩu:')
    if (email && password) await supabase.auth.signInWithPassword({ email, password })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F172A',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 24,
      color: 'white',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 56 }}>🥁</div>

      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
        Luyện nhịp cùng Thầy Văn Anh
      </h1>

      <p style={{ color: '#9CA3AF', maxWidth: 420, lineHeight: 1.7, margin: 0 }}>
        Nếu bạn là{' '}
        <strong style={{ color: '#10B981' }}>học sinh của Thầy Văn Anh</strong>,
        hãy đăng nhập để lưu điểm và theo dõi tiến độ học tập của bạn.
      </p>

      <button
        onClick={handleLogin}
        style={{
          background: '#10B981',
          border: 'none',
          borderRadius: 10,
          color: 'white',
          cursor: 'pointer',
          padding: '13px 36px',
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        🔑 Đăng nhập
      </button>

      <div style={{ color: '#4B5563', fontSize: 13 }}>hoặc</div>

      <button
        onClick={onGuest}
        style={{
          background: 'none',
          border: '1px solid #374151',
          borderRadius: 10,
          color: '#9CA3AF',
          cursor: 'pointer',
          padding: '11px 28px',
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        🎵 Xem thử 3 bài <br />
        <span style={{ fontSize: 12, color: '#6B7280' }}>(không cần đăng nhập)</span>
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
    const { data } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', userId)
      .single()
    setAppUser(data)
    setLoading(false)
  }

  const isTeacher = appUser?.role === 'teacher' || appUser?.role === 'admin'

  // ── Route /gp-editor ──
  if (path === '/gp-editor') {
    return <GpEditor onClose={() => { window.location.href = '/tap' }} />
  }

  // ── Route /tap ──
  if (path === '/tap' || path.startsWith('/tap')) {
    if (loading) return null

    // Chưa đăng nhập + chưa chọn guest → hiện trang chào
    if (!user && !guestMode) {
      return <TapLandingPage onGuest={() => setGuestMode(true)} />
    }

    // Đã đăng nhập hoặc chọn guest → vào TapWithSong
    return (
      <TapWithSong
        onClose={() => { window.location.href = '/tap' }}
        userRole={user ? (appUser?.role ?? 'student') : 'guest'}
      />
    )
  }

  // ── Route /editor — chỉ teacher ──
  if ((path === '/editor' || showEditor) && isTeacher) {
    return <App />
  }

  // ── Route / — Player (trang chủ) ──
  const extraActions = (
    <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {!loading && !user && (
        <button
          onClick={async () => {
            const email = prompt('Email:')
            const password = prompt('Mật khẩu:')
            if (email && password) await supabase.auth.signInWithPassword({ email, password })
          }}
          style={{ border: '1px solid #374151', borderRadius: 8, color: '#9CA3AF', cursor: 'pointer', padding: '8px 16px', fontSize: 13, background: 'none' }}
        >
          Đăng nhập
        </button>
      )}
      {user && isTeacher && (
        <button
          onClick={() => setShowEditor(true)}
          style={{ border: '1px solid #374151', borderRadius: 8, color: '#9CA3AF', cursor: 'pointer', padding: '8px 16px', fontSize: 13, background: 'none' }}
        >
          ✏️ Editor
        </button>
      )}
      {user && isTeacher && (
        <button
          onClick={() => { window.location.href = '/gp-editor' }}
          style={{ border: '1px solid #374151', borderRadius: 8, color: '#10B981', cursor: 'pointer', padding: '8px 16px', fontSize: 13, background: 'none' }}
        >
          🎸 GP Import
        </button>
      )}
      <button
        onClick={() => { window.location.href = '/tap' }}
        style={{ border: '1px solid #374151', borderRadius: 8, color: '#10B981', cursor: 'pointer', padding: '8px 16px', fontSize: 13, background: 'none' }}
      >
        🥁 Tap nhịp
      </button>
      {user && (
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 13 }}
        >
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
