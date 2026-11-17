// Phiên đăng nhập + danh tính cho Class Social.
// Dùng CHUNG client `supabase` (cookie .vananhaudio.com) với App học → không đăng nhập lại.
// Cùng cách nhận diện như StudentOnboarding (edu_students theo user_id; không có hồ sơ
// học sinh mà là thầy/admin → chế độ giáo viên). CHỈ ĐỌC — không ghi gì.
import { clearInboxCache } from './chat/inboxCache'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { fetchCover } from './profile/profileApi'
import { displayNameOf, loadSessionWith, type StudentRow } from './loadSessionCore'

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
  /** app_users.role = 'admin' (chỉ để quyết định HIỂN THỊ xem trước Mira; không cấp quyền gì) */
  isAdmin?: boolean
  /** Ảnh bìa (profile_media) — null → ảnh bìa mặc định */
  coverUrl: string | null
}

export type ClassSession =
  | { status: 'loading' }
  | { status: 'signed-out' }   // không có phiên → /me hiện trạng thái khách (đăng nhập ngay tại /me)
  | { status: 'no-profile'; userId: string; email: string | null }   // có phiên nhưng không phải học sinh/thầy
  | { status: 'ready'; me: ClassIdentity }

export { displayNameOf }

/** role + ảnh của tài khoản. Cột avatar_url chưa có (DB chưa migrate) → đọc lại chỉ role, không mất chế độ giáo viên. */
async function fetchAppUser(userId: string): Promise<{ role: string | null; avatar_url: string | null } | null> {
  const full = await supabase.from('app_users').select('role,avatar_url').eq('id', userId).maybeSingle<{ role: string | null; avatar_url: string | null }>()
  if (!full.error) return full.data
  const { data } = await supabase.from('app_users').select('role').eq('id', userId).maybeSingle<{ role: string | null }>()
  return data ? { role: data.role, avatar_url: null } : null
}

async function fetchStudent(userId: string): Promise<StudentRow | null | undefined> {
  const { data } = await supabase
    .from('edu_students')
    .select('id,full_name,display_name,email,avatar_url,level,enrolled_at,ht_member')
    .eq('user_id', userId)
    .order('enrolled_at', { ascending: false, nullsFirst: false })   // user_id không unique → lấy hồ sơ mới nhất
    .limit(1)
    .maybeSingle<StudentRow>()
  return data
}

const loadSession = (): Promise<ClassSession> => loadSessionWith({
  getUser: async () => (await supabase.auth.getSession()).data.session?.user,
  fetchAppUser, fetchCover, fetchStudent,
})

function userIdOf(s: ClassSession): string | null {
  if (s.status === 'ready') return s.me.userId
  if (s.status === 'no-profile') return s.userId
  return null
}

export function useClassSession(): ClassSession {
  const [state, setState] = useState<ClassSession>({ status: 'loading' })
  const loadedUser = useRef<string | null | undefined>(undefined)   // undefined = chưa tải xong lần nào
  useEffect(() => {
    let alive = true
    let seq = 0   // chỉ nhận kết quả của lần tải MỚI NHẤT
    const load = () => {
      const mine = ++seq
      loadSession()
        .catch((): ClassSession => ({ status: 'signed-out' }))
        .then(s => {
          if (!alive || mine !== seq) return
          loadedUser.current = userIdOf(s)
          setState(s)
        })
    }
    load()
    // Đăng nhập ngay tại /me (hoặc ở trang Class rồi quay lại) → tải danh tính; đăng xuất → trạng thái khách.
    // Chỉ tải lại khi ĐỔI người dùng: supabase-js có thể bắn lại SIGNED_IN (khôi phục phiên) cho cùng user.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      if (event === 'SIGNED_OUT') {
        clearInboxCache()   // không để lại danh sách trò chuyện của người vừa đăng xuất
        seq++
        loadedUser.current = null
        setState({ status: 'signed-out' })
        return
      }
      if (event === 'SIGNED_IN' && session?.user?.id && session.user.id !== loadedUser.current) {
        loadedUser.current = session.user.id
        setState({ status: 'loading' })
        // KHÔNG gọi supabase bên trong callback (supabase-js có thể treo) → dời sang lượt sau
        setTimeout(load, 0)
      }
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])
  return state
}
