import { parseMusicXML } from '../musicxml-beats/parser.ts'
import { readScoreMetadata } from '../nhipphach/scoreMetadata.ts'
import { foldVi } from '../class-social/comments/khoAdapter.ts'

const TABLE = 'musicxml_library'
export const MAX_MUSICXML_BYTES = 5 * 1024 * 1024

export type LibraryItem = {
  id: string
  title: string
  composer: string | null
  created_at: string
  created_by?: string
}

export function prepareMusicXml(filename: string, xml: string) {
  if (!/\.(xml|musicxml)$/i.test(filename)) throw new Error('Chọn file .musicxml hoặc .xml.')
  const sizeBytes = new TextEncoder().encode(xml).byteLength
  if (sizeBytes < 1 || sizeBytes > MAX_MUSICXML_BYTES) throw new Error('File phải có dung lượng từ 1 byte đến 5 MB.')
  let score: ReturnType<typeof parseMusicXML>
  try { score = parseMusicXML(xml) }
  catch { throw new Error('File không phải MusicXML hợp lệ.') }
  if (!score.parts.length || !score.parts[0].measures.length) throw new Error('Bản nhạc không có ô nhịp.')
  return { xml, filename, sizeBytes, metadata: readScoreMetadata(xml, filename) }
}

/** Bỏ dấu + thường hoá + gộp khoảng trắng: "DIỄM  Xưa" và "diem xua" là một. */
const fold = (text: string) => foldVi(text).replace(/\s+/g, ' ').trim()

/** Tìm theo tên bài HOẶC tác giả, không phân biệt hoa/thường và dấu. */
export function matchesQuery(item: Pick<LibraryItem, 'title' | 'composer'>, query: string): boolean {
  const key = fold(query)
  return !key || fold(item.title).includes(key) || fold(item.composer ?? '').includes(key)
}

/**
 * Chỉ các cột metadata. KHÔNG bao giờ có musicxml_text / content_hash / size_bytes /
 * original_filename — bản nhạc và mã kiểm tra của nó giữ nguyên tuyệt đối.
 */
export function metadataPatch(title: string, composer: string) {
  const cleanTitle = title.trim()
  if (!cleanTitle) throw new Error('Vui lòng nhập Tên bài.')
  return { title: cleanTitle, composer: composer.trim() || null, updated_at: new Date().toISOString() }
}

async function sha256(xml: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(xml))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Người dùng có được THÊM bài vào thư viện không (chỉ để ẩn/hiện mục "Nạp bản nhạc mới"; quyền thật do RLS):
 * admin/teacher (isTeacher) hoặc người đang giữ vai Biên tập âm nhạc ở ít nhất một Band (teamlab_band_roles). Lỗi đọc → false.
 */
export async function canAddToLibrary(userId: string, isTeacher: boolean): Promise<boolean> {
  if (isTeacher) return true
  try {
    const { supabase } = await import('../supabase.ts')
    const { data, error } = await supabase.from('teamlab_band_roles').select('band_id')
      .eq('user_id', userId).eq('role', 'music_editor').limit(1)
    return !error && (data?.length ?? 0) > 0
  } catch { return false }
}

export const ADD_DENIED_MESSAGE = 'Tài khoản chưa có quyền thêm bản nhạc vào thư viện. Cần vai trò Biên tập âm nhạc của một Band (hoặc Admin/Giáo viên).'

export const EDITOR_UNKNOWN = 'Chưa xác định'

/** `get_user_profile` trả 0 hoặc 1 hàng; thiếu tên → "Chưa xác định". Chỉ lấy cột name. */
export function editorNameFromProfile(data: unknown): string {
  const row = (Array.isArray(data) ? data[0] : data) as { name?: unknown } | null | undefined
  const name = typeof row?.name === 'string' ? row.name.trim() : ''
  return name || EDITOR_UNKNOWN
}

const editorNames = new Map<string, Promise<string>>()

/**
 * Tên hiển thị của Người biên tập (= musicxml_library.created_by), qua RPC sẵn có get_user_profile:
 * đúng tên Class đang hiển thị (display_name → full_name → app_users.name, bỏ phần sau '@'), không email/số điện thoại.
 * Không có hàng (không lấy được / không còn là thành viên Class) hoặc lỗi → "Chưa xác định". Nhớ kết quả trong phiên trang.
 */
export function editorName(userId: string | null | undefined): Promise<string> {
  if (!userId) return Promise.resolve(EDITOR_UNKNOWN)
  const cached = editorNames.get(userId)
  if (cached) return cached
  const request = (async () => {
    try {
      const { supabase } = await import('../supabase.ts')
      const { data, error } = await supabase.rpc('get_user_profile', { p_user: userId })
      if (error) { editorNames.delete(userId); return EDITOR_UNKNOWN }
      return editorNameFromProfile(data)
    } catch { editorNames.delete(userId); return EDITOR_UNKNOWN }
  })()
  editorNames.set(userId, request)
  return request
}

export async function listLibrary(): Promise<LibraryItem[]> {
  const { supabase } = await import('../supabase.ts')
  const { data, error } = await supabase.from(TABLE)
    .select('id,title,composer,created_at,created_by').is('archived_at', null)
    .order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  return data ?? []
}

export async function updateLibraryMetadata(id: string, title: string, composer: string): Promise<LibraryItem> {
  const patch = metadataPatch(title, composer)
  const { supabase } = await import('../supabase.ts')
  // `.single()`: RLS chặn hoặc id không còn thì báo lỗi, không bao giờ "lưu thành công" giả.
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id)
    .select('id,title,composer,created_at,created_by').single()
  // 0 dòng được cập nhật (RLS không cho sửa, hoặc bài không còn) → PGRST116.
  if (error?.code === 'PGRST116') throw new Error('Không lưu được: tài khoản không có quyền sửa, hoặc bản nhạc không còn trong thư viện.')
  if (error && (error.code === '42501' || /row-level security|Biên tập chỉ được/i.test(error.message ?? ''))) throw new Error(MANAGE_DENIED_MESSAGE)
  if (error) throw new Error(error.message || 'Không lưu được thông tin bản nhạc.')
  return data
}

/** Gỡ bản nhạc khỏi danh sách (lưu trữ, KHÔNG xoá): chỉ đặt archived_at. Quyền thật do RLS + trigger (chỉ bài của mình / admin / teacher). */
export async function archiveLibraryItem(id: string): Promise<void> {
  const { supabase } = await import('../supabase.ts')
  const { data, error } = await supabase.from(TABLE).update({ archived_at: new Date().toISOString() }).eq('id', id).select('id')
  if (error) throw new Error(error.message || 'Không gỡ được bản nhạc.')
  if (!data?.length) throw new Error(MANAGE_DENIED_MESSAGE)
}

/** Ẩn/hiện nút Sửa/Gỡ (quyền thật do RLS): admin/teacher, hoặc Biên tập hiện tại với bài do chính mình tạo. */
export function canManageItem(item: Pick<LibraryItem, 'created_by'> | null | undefined, userId: string | null, isTeacher: boolean, isEditor: boolean): boolean {
  if (!item || !userId) return false
  return isTeacher || (isEditor && item.created_by === userId)
}

export const MANAGE_DENIED_MESSAGE = 'Không thực hiện được: chỉ người tạo bài (đang giữ vai Biên tập âm nhạc), Admin hoặc Giáo viên được sửa/gỡ bài này.'
export const ARCHIVED_DUPLICATE_MESSAGE = (title: string) => `Bản nhạc này đã từng có trong thư viện (“${title}”) nhưng đã được gỡ. Cần Admin khôi phục.`

export async function importMusicXml(input: ReturnType<typeof prepareMusicXml>, title: string, composer: string): Promise<LibraryItem> {
  const cleanTitle = title.trim()
  if (!cleanTitle) throw new Error('Vui lòng nhập Tên bài.')
  const { supabase } = await import('../supabase.ts')
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('Vui lòng đăng nhập lại.')
  const contentHash = await sha256(input.xml)
  const { data: existing, error: lookupError } = await supabase.from(TABLE)
    .select('id,title,archived_at').eq('content_hash', contentHash).limit(1)
  if (lookupError) throw lookupError
  if (existing?.length) {
    if (existing[0].archived_at) throw new Error(ARCHIVED_DUPLICATE_MESSAGE(existing[0].title))
    throw new Error(`Bản nhạc này đã có trong thư viện: ${existing[0].title}.`)
  }
  const { data, error } = await supabase.from(TABLE).insert({
    title: cleanTitle,
    composer: composer.trim() || null,
    original_filename: input.filename,
    musicxml_text: input.xml,
    content_hash: contentHash,
    size_bytes: input.sizeBytes,
    created_by: auth.user.id,
  }).select('id,title,composer,created_at,created_by').single()
  // RLS từ chối (không phải Biên tập / mất vai): báo rõ, không lộ thông báo kỹ thuật.
  if (error && (error.code === '42501' || /row-level security/i.test(error.message ?? ''))) throw new Error(ADD_DENIED_MESSAGE)
  if (error) throw error
  return data
}
