// Trạng thái phiên "Hỏi Mira": CHỈ trong RAM (React state). Không localStorage/sessionStorage/IndexedDB, không DB. Đóng/rời màn là mất.
// Gửi kèm tối đa 6 lượt gần nhất; ctx_fp (dấu vân tay dữ liệu) để server bỏ lượt cũ của Mira khi dữ liệu đã đổi (vd. fact bị thu hồi).
import { useCallback, useRef, useState } from 'react'
import { askMira, MIRA_MAX_CHARS, type MiraAction, type MiraTurn } from './miraApi'

export interface MiraMessage { id: number; role: 'user' | 'assistant'; text: string; kind?: 'error' | 'notice'; actions?: MiraAction[] }
const KEEP = 40, HIST = 6, HIST_CHARS = 500

/** Lời chào ngắn (V1.3): các đoạn cách nhau bằng dòng trống; đoạn đầu in đậm. Thông tin AI chi tiết ở MiraInfo. */
export const MIRA_GREETING = [
  'Chào bạn, mình là Mira!',
  'Trợ lý AI của Thầy Văn Anh. Bạn cứ hỏi mình về hợp âm, bài học hay cách luyện tập nhé.',
].join('\n\n')
/** Thông báo minh bạch về AI (hiện gọn trong MiraInfo). */
export const MIRA_AI_NOTICE = [
  'Mira là trợ lý AI (trí tuệ nhân tạo), không phải người thật, và có thể trả lời sai. Mira không thay Thầy chấm bài.',
  'Câu bạn gõ được gửi tới nhà cung cấp AI (Anthropic) để tạo câu trả lời. Đừng gõ thông tin cá nhân nhạy cảm.',
  'Class không lưu cuộc trò chuyện: rời màn hình là mất.',
]
const STATUS_TEXT: Record<string, string> = {
  rate_limit: 'Bạn đã hỏi Mira khá nhiều trong thời gian ngắn. Nghỉ một lát rồi hỏi tiếp nhé.',
  forbidden: 'Mira chưa mở cho tài khoản của bạn.',
  consent_required: 'Mira không còn quyền dùng hồ sơ học tập của bạn. Bạn hỏi lại nhé — Mira vẫn trả lời câu hỏi chung.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Bạn đăng nhập lại để hỏi Mira nhé.',
  context_unavailable: 'Mira tạm thời chưa đọc được dữ liệu học tập của bạn. Bạn thử lại sau nhé.',
  model_error: 'Mira đang bận. Bạn thử lại sau ít phút nhé.',
  network: 'Chưa kết nối được. Kiểm tra mạng rồi thử lại nhé.',
  disabled: 'Mira chưa sẵn sàng.', wrong_user: 'Mira chưa trả lời được lúc này.', bad_request: 'Tin nhắn chưa hợp lệ (tối đa 1200 ký tự).',
}

export function useMiraChat({ onConsentRequired }: { onConsentRequired?: () => void } = {}) {
  const [messages, setMessages] = useState<MiraMessage[]>([])
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  const hist = useRef<MiraTurn[]>([])
  const fp = useRef('')
  const inflight = useRef(false)

  const push = (m: Omit<MiraMessage, 'id'>) => setMessages(xs => [...xs, { ...m, id: ++seq.current }].slice(-KEEP))

  const send = useCallback(async (text: string): Promise<boolean> => {
    const t = text.trim()
    if (!t || inflight.current) return false
    if ([...t].length > MIRA_MAX_CHARS) { push({ role: 'assistant', kind: 'error', text: STATUS_TEXT.bad_request }); return false }
    inflight.current = true; setBusy(true)
    push({ role: 'user', text: t })
    const r = await askMira({ message: t, history: hist.current, historyFp: fp.current })
    inflight.current = false; setBusy(false)
    if (r.status === 'consent_required') onConsentRequired?.()   // đồng ý vừa hết hiệu lực (rút ở thiết bị khác): làm mới trạng thái; trò chuyện phổ thông vẫn dùng được
    if (r.status === 'ok' && r.reply) {
      push({ role: 'assistant', text: r.reply, actions: r.actions })
      hist.current = [...hist.current, { role: 'user' as const, text: t.slice(0, HIST_CHARS) }, { role: 'assistant' as const, text: r.reply.slice(0, HIST_CHARS) }].slice(-HIST)
      fp.current = r.ctxFp
    } else {
      push({ role: 'assistant', kind: 'error', text: r.reply || STATUS_TEXT[r.status] || STATUS_TEXT.network })
      if (r.status === 'ok') fp.current = r.ctxFp
    }
    return true
  }, [onConsentRequired])
  const clear = useCallback(() => { setMessages([]); hist.current = []; fp.current = '' }, [])
  return { messages, busy, send, clear }
}
