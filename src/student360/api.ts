// Lớp gọi RPC student_360_* có kiểu dữ liệu. KHÔNG import supabase ở đây (để test được) — xem client.ts.
// Không có đường nào ghi trực tiếp bảng: chỉ RPC SECURITY DEFINER; danh tính luôn là auth.uid() phía server.
import type { Fact, HistoryEntry, NewFactInput, Student360, Student360Api, Verification, Visibility } from './types'

export type RpcResult = { data: unknown; error: { message?: string; code?: string } | null }
export type RpcFn = (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>

export class Student360Error extends Error {
  readonly code: string
  constructor(code: string, message: string) { super(message); this.name = 'Student360Error'; this.code = code }
}

const MESSAGES: [RegExp, string, string][] = [
  [/forbidden|42501/i, 'forbidden', 'Bạn không có quyền thực hiện thao tác này.'],
  [/not_authenticated|28000|JWT/i, 'not_authenticated', 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'],
  [/not_found|P0002/i, 'not_found', 'Không tìm thấy mục này (có thể đã bị xoá).'],
  [/revoked/i, 'revoked', 'Mục này đã được thu hồi nên không sửa được nữa.'],
  [/content_required/i, 'content_required', 'Nội dung không được để trống.'],
  [/too_many_facts|54000/i, 'too_many_facts', 'Hồ sơ đã đạt số mục tối đa.'],
  [/violates check constraint|22023|bad_/i, 'invalid', 'Nội dung không hợp lệ (tối đa 500 ký tự).'],
]

export function toStudent360Error(e: { message?: string; code?: string } | null | undefined): Student360Error {
  const raw = `${e?.message ?? ''} ${e?.code ?? ''}`
  for (const [re, code, text] of MESSAGES) if (re.test(raw)) return new Student360Error(code, text)
  return new Student360Error('unknown', 'Chưa thực hiện được. Hãy thử lại.')
}

export function createStudent360Api(rpc: RpcFn): Student360Api {
  async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    let res: RpcResult
    try { res = await rpc(name, args) } catch (e) { throw toStudent360Error({ message: (e as Error)?.message }) }
    if (res.error) throw toStudent360Error(res.error)
    return res.data as T
  }
  return {
    get: (userId, includeRevoked) => call<Student360>('student_360_get', { p_user: userId, p_include_revoked: includeRevoked }),
    add: (i: NewFactInput) => call<Fact>('student_360_add_fact', {
      p_user: i.userId, p_category: i.category, p_content: i.content, p_origin: i.origin, p_source_kind: i.sourceKind,
      ...(i.visibility ? { p_visibility: i.visibility } : {}),
    }),
    edit: (factId, content) => call<Fact>('student_360_edit_fact', { p_fact: factId, p_content: content }),
    setVerification: (factId, level: Verification) => call<Fact>('student_360_set_verification', { p_fact: factId, p_level: level }),
    setVisibility: (factId, v: Visibility) => call<Fact>('student_360_set_visibility', { p_fact: factId, p_visibility: v }),
    revoke: (factId, reason) => call<Fact>('student_360_revoke_fact', { p_fact: factId, p_reason: reason }),
    history: (factId) => call<HistoryEntry[]>('student_360_fact_history', { p_fact: factId }),
  }
}
