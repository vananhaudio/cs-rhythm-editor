// Tải ảnh bìa entity (Band / Công cụ / Lớp) — Entity Cover V1. Bucket course-logos SẴN CÓ, cùng cách
// CourseEditorContent tải logo khoá; không có hệ upload riêng. UI: EntityImageField.tsx.
export const ENTITY_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const BUCKET = 'course-logos'
// Nạp client khi GỌI → component render được trong test Node (như band/bandApi.ts).
const db = () => import('./supabase').then(m => m.supabase)

/** Tải ảnh lên bucket course-logos, trả URL công khai (https). prefix vd 'band-<id>'. */
export async function uploadEntityImage(prefix: string, file: File): Promise<string> {
  // JPG/PNG: định dạng mọi crawler (Zalo, Facebook, iMessage) đọc được làm thumbnail
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Chỉ nhận ảnh JPG hoặc PNG.')
  if (file.size > ENTITY_IMAGE_MAX_BYTES) throw new Error('Ảnh quá lớn (tối đa 5 MB).')
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${prefix.replace(/[^a-zA-Z0-9-]/g, '-')}-${Date.now()}.${ext}`
  const supabase = await db()
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(error.message)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
