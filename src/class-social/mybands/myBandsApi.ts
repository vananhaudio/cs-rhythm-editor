// Đọc Band của CHÍNH tài khoản đăng nhập: teamlab_project_members (lọc user_id = mình) → projects (chỉ id, name).
// Hai bảng cùng dự án Supabase với TeamLab (SELECT cho authenticated — RLS hiện có, không đổi). Chỉ đọc.
// Lỗi truy vấn → ok:false (KHÔNG được coi là "chưa có Band").
import { toMyBands, type MyBand } from './myBandsModel'

type Result = { ok: true; value: MyBand[] } | { ok: false; message: string }
const db = () => import('../../supabase').then(m => m.supabase)
const FAIL = 'Chưa tải được Band của bạn. Kiểm tra mạng rồi thử lại.'

export async function fetchMyBands(userId: string): Promise<Result> {
  try {
    const sb = await db()
    const m = await sb.from('teamlab_project_members').select('project_id').eq('user_id', userId)
    if (m.error) return { ok: false, message: FAIL }
    const ids = [...new Set((m.data ?? []).map(r => String((r as { project_id: unknown }).project_id)))]
    if (ids.length === 0) return { ok: true, value: [] }
    const p = await sb.from('projects').select('id, name').in('id', ids)
    if (p.error) return { ok: false, message: FAIL }
    const bands = toMyBands(m.data, p.data)
    // Có quan hệ thành viên nhưng không đọc được Team nào = dữ liệu/quyền bất thường → báo lỗi, không nói "chưa có Band".
    if (bands.length === 0) return { ok: false, message: FAIL }
    return { ok: true, value: bands }
  } catch {
    return { ok: false, message: FAIL }
  }
}
