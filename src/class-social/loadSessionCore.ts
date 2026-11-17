// Lõi nạp danh tính của useClassSession — KHÔNG import supabase (phụ thuộc được truyền vào) để kiểm thử được.
// Ba truy vấn app_users / profile_media / edu_students độc lập nhau (chỉ cần user.id) → chạy SONG SONG.
import type { ClassIdentity, ClassSession } from './useClassSession'

export type StudentRow = {
  id: string
  full_name: string | null
  display_name: string | null
  email: string | null
  avatar_url: string | null
  level: string | null
  enrolled_at: string | null
  ht_member: boolean | null
}

export type AppUserRow = { role: string | null; avatar_url: string | null }

export type SessionDeps = {
  getUser: () => Promise<{ id?: string; email?: string | null; user_metadata?: unknown } | null | undefined>
  fetchAppUser: (userId: string) => Promise<AppUserRow | null>
  fetchCover: (userId: string) => Promise<string | null>
  fetchStudent: (userId: string) => Promise<StudentRow | null | undefined>
}

/** Tên hiển thị: ưu tiên display_name, bỏ phần @… nếu tên là email. */
export function displayNameOf(r: { display_name?: string | null; full_name?: string | null; email?: string | null }): string {
  const raw = (r.display_name || r.full_name || r.email || '').trim()
  if (!raw) return 'Học viên'
  return raw.includes('@') ? raw.split('@')[0] : raw
}

export async function loadSessionWith(deps: SessionDeps): Promise<ClassSession> {
  const user = await deps.getUser()
  if (!user?.id) return { status: 'signed-out' }

  // Lỗi của bất kỳ truy vấn nào vẫn làm cả lần nạp thất bại (như khi chạy tuần tự) → nơi gọi đưa về 'signed-out'.
  const [appUser, coverUrl, stu] = await Promise.all([
    deps.fetchAppUser(user.id),
    deps.fetchCover(user.id),
    deps.fetchStudent(user.id),
  ])
  const isTeacher = appUser?.role === 'teacher' || appUser?.role === 'admin'
  const isAdmin = appUser?.role === 'admin'

  if (stu) {
    const me: ClassIdentity = {
      role: 'student', userId: user.id, studentId: stu.id,
      name: displayNameOf(stu), email: stu.email ?? user.email ?? null,
      avatarUrl: stu.avatar_url, level: stu.level, enrolledAt: stu.enrolled_at,
      htMember: !!stu.ht_member, isTeacher, isAdmin, coverUrl,
    }
    return { status: 'ready', me }
  }

  if (isTeacher) {
    // Ảnh của tài khoản không có hồ sơ học sinh = app_users.avatar_url (bậc dự phòng của class_public_identity)
    const meta = (user.user_metadata ?? {}) as { full_name?: string }
    return {
      status: 'ready',
      me: {
        role: 'teacher', userId: user.id, studentId: null,
        name: meta.full_name?.trim() || 'Thầy Văn Anh', email: user.email ?? null,
        avatarUrl: appUser?.avatar_url ?? null, level: null, enrolledAt: null, htMember: false, isTeacher: true, isAdmin, coverUrl,
      },
    }
  }
  return { status: 'no-profile', userId: user.id, email: user.email ?? null }
}
