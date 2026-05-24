import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import { PlayerView } from './PlayerView'
import { TapMode } from './TapMode'
import App from './App'
import type { RhythmSong } from './types'
import { createEmptySong } from './utils'

type AppUser = {
  id: string
  role: string
  name: string
  email: string
}

export default function AppRouter() {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
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

  // ── Route /tap — trang độc lập ──
  if (path === '/tap' || path.startsWith('/tap')) {
    return (
      <TapMode
        song={playerSong}
        onClose={() => { window.location.href = '/' }}
        userRole={appUser?.role}
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
