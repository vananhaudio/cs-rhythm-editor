// Gọi RPC cấp/thu hồi vé bằng JWT của CHÍNH Thầy (Supabase client dùng chung). Vé là chuỗi ngẫu nhiên 64 hex, sống 5 phút,
// gắn đúng một bài trả; KHÔNG phải credential Class. Xem db/mira_grading_v1_setup.sql.
export type RpcResult = { data: unknown; error: { message?: string; code?: string } | null }
export type RpcFn = (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>

export type Ticket = { ticket: string; expiresAt: string }
export type TicketResult = { ok: true; value: Ticket } | { ok: false; reason: 'unavailable' | 'forbidden' | 'not_found' | 'rate_limited' | 'error' }

export function createMiraGradingApi(rpc: RpcFn) {
  return {
    async ticket(threadId: string): Promise<TicketResult> {
      let r: RpcResult
      try { r = await rpc('mira_grading_ticket', { p_thread: threadId }) } catch { return { ok: false, reason: 'error' } }
      if (r.error) {
        const raw = `${r.error.message ?? ''} ${r.error.code ?? ''}`
        // Chưa áp migration (hàm chưa có) → "unavailable": khung Mira báo chưa sẵn sàng, màn chấm bài vẫn dùng bình thường.
        if (/PGRST202|42883|could not find|does not exist/i.test(raw)) return { ok: false, reason: 'unavailable' }
        if (/forbidden|42501/i.test(raw)) return { ok: false, reason: 'forbidden' }
        if (/not_found|P0002/i.test(raw)) return { ok: false, reason: 'not_found' }
        if (/rate_limited|54000/i.test(raw)) return { ok: false, reason: 'rate_limited' }
        return { ok: false, reason: 'error' }
      }
      const j = r.data as { ticket?: unknown; expires_at?: unknown } | null
      if (!j || typeof j.ticket !== 'string' || !/^[0-9a-f]{64}$/.test(j.ticket)) return { ok: false, reason: 'error' }
      return { ok: true, value: { ticket: j.ticket, expiresAt: String(j.expires_at ?? '') } }
    },
    /** "Tôi có được dùng Mira không?" — RPC chỉ trả trạng thái của CHÍNH người gọi, KHÔNG tạo vé. Hàm chưa có / lỗi / không rõ → false (ẩn). */
    async pilotEnabled(): Promise<boolean> {
      try {
        const r = await rpc('mira_grading_pilot_enabled', {})
        return !r.error && r.data === true
      } catch { return false }
    },
    async end(threadId: string): Promise<void> {
      try { await rpc('mira_grading_end', { p_thread: threadId }) } catch { /* vé tự hết hạn sau 5 phút */ }
    },
  }
}
export type MiraGradingApi = ReturnType<typeof createMiraGradingApi>
