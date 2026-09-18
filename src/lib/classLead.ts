// Lưu đăng ký lớp từ landing — BẤT BIẾN: chỉ đi tiếp sang thanh toán khi lead ĐÃ lưu thành công.
// (Phase 1 từng nuốt lỗi INSERT: leads.phone NOT NULL làm mất mọi lead mà khách vẫn thấy "thành công".)
// Module thuần, không import supabase, để test được bằng node --test.

// Các cột form ghi vào public.leads. db/tests/class_lead_insert_test.sql kiểm tra đúng tập này
// với quyền anon trên schema thật — thêm cột ở đây thì cập nhật test SQL đó.
export const CLASS_LEAD_FIELDS = ['name', 'email', 'class_name', 'path', 'intent', 'note', 'source', 'status'] as const
export type ClassLeadPayload = Record<(typeof CLASS_LEAD_FIELDS)[number], string>

export function buildClassLead(p: { name: string; email: string; className: string; path: string; product: string; plan: string }): ClassLeadPayload {
  return {
    name: p.name, email: p.email, class_name: p.className, path: p.path,
    intent: 'dang_ky', note: `[public-product:${p.product}][plan:${p.plan}]`, source: 'landing', status: 'Mới đăng ký',
  }
}

export type LeadInsert = (payload: ClassLeadPayload) => PromiseLike<{ error: { message: string } | null }>

// Trả lỗi thân thiện nếu không lưu được; null = đã lưu. Không bao giờ nuốt lỗi.
export async function saveClassLead(insert: LeadInsert, payload: ClassLeadPayload): Promise<string | null> {
  try {
    const { error } = await insert(payload)
    if (!error) return null
    console.error('Ghi leads lỗi:', error)
  } catch (e) {
    console.error('Ghi leads lỗi:', e)
  }
  return 'Chưa gửi được đăng ký — vui lòng thử lại, hoặc nhắn Zalo Thầy để giữ chỗ.'
}
