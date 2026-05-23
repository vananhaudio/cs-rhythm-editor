import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import { PlayerView } from './PlayerView'
import App from './App'
import type { RhythmSong } from './types'

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
  const [playerSong, setPlayerSong] = useState<RhythmSong | null>(null)

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

  // Teacher bấm vào Editor
  if (showEditor && isTeacher) {
    return <App onBackToPlayer={() => setShowEditor(false)} />
  }

  // Tất cả đều thấy Player (trang chủ)
  if (!playerSong) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F1117', color: '#fff', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 56 }}>🎵</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>Timming</div>
      <div style={{ color: '#6B7280', fontSize: 14 }}>Chọn bài hát để bắt đầu</div>

      <label style={{ padding: '12px 28px', background: '#10B981', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
        📂 Mở file bài hát (.json)
        <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = ev => {
            try { setPlayerSong(JSON.parse(ev.target?.result as string)) } catch {}
          }
          reader.readAsText(file)
        }} />
      </label>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {!loading && !user && (
          <button
            onClick={async () => {
              const email = prompt('Email:')
              const password = prompt('Mật khẩu:')
              if (email && password) await supabase.auth.signInWithPassword({ email, password })
            }}
            style={{ background: 'none', border: '1px solid #374151', borderRadius: 8, color: '#9CA3AF', cursor: 'pointer', padding: '8px 16px', fontSize: 13 }}
          >
            Đăng nhập
          </button>
        )}
        {user && isTeacher && (
          <button
            onClick={() => setShowEditor(true)}
            style={{ background: 'none', border: '1px solid #374151', borderRadius: 8, color: '#9CA3AF', cursor: 'pointer', padding: '8px 16px', fontSize: 13 }}
          >
            ✏️ Editor
          </button>
        )}
        {user && (
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 13 }}
          >
            Đăng xuất
          </button>
        )}
      </div>
    </div>
  )

  return <PlayerView song={playerSong} onClose={() => setPlayerSong(null)} />
}
