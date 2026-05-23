import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import Auth from './Auth'
import App from './App'
import { PlayerView } from './PlayerView'

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

  useEffect(() => {
    // Check session hiện tại
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadAppUser(session.user.id)
      else setLoading(false)
    })

    // Lắng nghe thay đổi auth
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

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F1117', color: '#fff' }}>
      Đang tải...
    </div>
  )

  if (!user) return <Auth />

  // Phân quyền theo role
  const role = appUser?.role ?? 'student'
  if (role === 'teacher' || role === 'admin') {
    return <App />
  }

  // Student: chưa làm trang chọn bài, tạm thời hiện thông báo
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F1117', color: '#fff', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🎵</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>Xin chào, {appUser?.name ?? 'Học sinh'}!</div>
      <div style={{ color: '#6B7280' }}>Tính năng danh sách bài đang được phát triển...</div>
      <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 16, padding: '8px 20px', background: '#374151', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
        Đăng xuất
      </button>
    </div>
  )
}
