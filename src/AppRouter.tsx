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
    return <App />
  }

  // Tất cả đều thấy Player (trang chủ)
  return <PlayerView
    song={playerSong}
    onClose={() => setPlayerSong(null)}
    onImportSong={s => setPlayerSong(s)}
  />
}
