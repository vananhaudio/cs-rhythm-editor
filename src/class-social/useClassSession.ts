// Phiên đăng nhập + danh tính cho Class Social.
// Dùng CHUNG client `supabase` (cookie .vananhaudio.com) với App học → không đăng nhập lại.
// Cùng cách nhận diện như StudentOnboarding (edu_students theo user_id; không có hồ sơ
// học sinh mà là thầy/admin → chế độ giáo viên). CHỈ ĐỌC — không ghi gì.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fetchCover } from './profile/profileApi'

export type ClassIdentity = {
  role: 'student' | 'teacher'
  userId: string
  studentId: string | null
  name: string
  email: string | null
  avatarUrl: string | null
  level: string | null
  enrolledAt: string | null
  htMember: boolean
  /** teacher|admin theo app_users.role — CHỈ để hiện công cụ của Thầy; quyền thật do server kiểm */
  isTeacher: boolean
  /** Ảnh bìa (profile_media) — null → ảnh bìa mặc định */
  coverUrl: string | null
}

export type ClassSession =
  | { status: 'loading' }
  | { status: 'signed-out' }   // không có phiên → P0: về App học (/learn) như hành vi cũ
  | { status: 'no-profile' }   // có phiên nhưng không phải học sinh/thầy → cũng về /learn
  | { status: 'ready'; me: ClassIdentity }

type StudentRow = {
  id: string
  full_name: string | null
  display_name: string | null
  email: string | null
  avatar_url: string | null
  level: string | null
  enrolled_at: string | null
  ht_member: boolean | null
}

/** Tên hiển thị: ưu tiên display_name, bỏ phần @… nếu tên là email. */
export function displayNameOf(r: { display_name?: string | null; full_name?: string | null; email?: string | null }): string {
  const raw = (r.display_name || r.full_name || r.email || '').trim()
  if (!raw) return 'Học viên'
  return raw.includes('@') ? raw.split('@')[0] : raw
}

async function loadSession(): Promise<ClassSession> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user?.id) return { status: 'signed-out' }

  const { data: appUser } = await supabase.from('app_users').select('role').eq('id', user.id).maybeSingle<{ role: string | null }>()
  const isTeacher = appUser?.role === 'teacher' || appUser?.role === 'admin'
  const coverUrl = await fetchCover(user.id)

  const { data: stu } = await supabase
    .from('edu_students')
    .select('id,full_name,display_name,email,avatar_url,level,enrolled_at,ht_member')
    .eq('user_id', user.id)
    .order('enrolled_at', { ascending: false, nullsFirst: false })   // user_id không unique → lấy hồ sơ mới nhất
    .limit(1)
    .maybeSingle<StudentRow>()
  if (stu) {
    return {
      status: 'ready',
      me: {
        role: 'student', userId: user.id, studentId: stu.id,
        name: displayNameOf(stu), email: stu.email ?? user.email ?? null,
        avatarUrl: stu.avatar_url, level: stu.level, enrolledAt: stu.enrolled_at,
        htMember: !!stu.ht_member, isTeacher, coverUrl,
      },
    }
  }

  if (isTeacher) {
    const meta = (user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string }
    return {
      status: 'ready',
      me: {
        role: 'teacher', userId: user.id, studentId: null,
        name: meta.full_name?.trim() || 'Thầy Văn Anh', email: user.email ?? null,
        avatarUrl: meta.avatar_url ?? null, level: null, enrolledAt: null, htMember: false, isTeacher: true, coverUrl,
      },
    }
  }
  return { status: 'no-profile' }
}

export function useClassSession(): ClassSession {
  const [state, setState] = useState<ClassSession>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    loadSession()
      .then(s => { if (alive) setState(s) })
      .catch(() => { if (alive) setState({ status: 'signed-out' }) })
    // Đăng xuất ở tab khác / hết phiên → về lại trạng thái đúng
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' && alive) setState({ status: 'signed-out' })
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])
  return state
}
