// Ảnh đại diện / ảnh bìa / đăng xuất.
// ẢNH ĐẠI DIỆN = CÙNG NGUỒN với App học: bucket 'avatars' → public URL → edu_students.avatar_url
// (y hệt MobileStudentPortal.uploadAvatar). App học & Social đọc cùng cột → luôn đồng bộ.
// Ảnh bìa: cùng bucket, lưu URL ở public.profile_media (chỉ chính chủ ghi).
import { supabase } from '../../supabase'
import { friendlyError } from '../posts/postModel'
import type { Result } from '../posts/postsApi'
import { avatarPath, coverPath } from './imageFile'

const BUCKET = 'avatars'
const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
const devWarn = (what: string, e: { message?: string } | null) => { if (import.meta.env.DEV && e) console.warn(`[class-social] ${what}:`, e.message) }

async function upload(path: string, blob: Blob): Promise<Result<string>> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' })
  if (error) { devWarn('upload', error); return { ok: false, message: online() ? 'Chưa tải được ảnh lên. Hãy thử lại.' : 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.' } }
  return { ok: true, value: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}

/** Đổi ảnh đại diện: ghi vào edu_students.avatar_url của CHÍNH học sinh (nguồn chung với App học). */
export async function saveAvatar(studentId: string, blob: Blob): Promise<Result<string>> {
  try {
    const up = await upload(avatarPath(studentId), blob)
    if (!up.ok) return up
    const { error, status } = await supabase.from('edu_students').update({ avatar_url: up.value }).eq('id', studentId)
    if (error) { devWarn('avatar', error); return { ok: false, message: friendlyError({ ...error, status }, 'post', online()) } }
    return { ok: true, value: up.value }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'post', online()) }
  }
}

/** Đổi ảnh bìa: upsert hàng profile_media của CHÍNH tài khoản (RLS: user_id = auth.uid()). */
export async function saveCover(userId: string, blob: Blob): Promise<Result<string>> {
  try {
    const up = await upload(coverPath(userId), blob)
    if (!up.ok) return up
    const { error, status } = await supabase.from('profile_media').upsert({ user_id: userId, cover_url: up.value }, { onConflict: 'user_id' })
    if (error) { devWarn('cover', error); return { ok: false, message: friendlyError({ ...error, status }, 'post', online()) } }
    return { ok: true, value: up.value }
  } catch (e) {
    return { ok: false, message: friendlyError(e as Error, 'post', online()) }
  }
}

/** Ảnh bìa hiện tại (không có bảng / lỗi → null → ảnh bìa mặc định). */
export async function fetchCover(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('profile_media').select('cover_url').eq('user_id', userId).maybeSingle<{ cover_url: string | null }>()
    if (error) { devWarn('fetch cover', error); return null }
    return data?.cover_url ?? null
  } catch { return null }
}

/** Đăng xuất bằng Supabase auth sẵn có (App học dùng cùng cơ chế). */
export async function signOut(): Promise<void> {
  try { await supabase.auth.signOut() } catch { /* vẫn chuyển trang */ }
}
