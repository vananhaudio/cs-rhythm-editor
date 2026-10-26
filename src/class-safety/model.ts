// Class UGC Safety V1 (Apple Guideline 1.2) — phần THUẦN (không React, không mạng) để test được.
// Hợp đồng API: docs/CLASS-UGC-SAFETY-V1.md. Client chỉ gọi RPC theo hợp đồng; luật nằm ở server.

/** Loại nội dung báo cáo — khớp CHECK class_reports.kind */
export const REPORT_KINDS = ['post', 'comment', 'profile', 'dm_message', 'band_message', 'thread'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]

/** Lý do báo cáo — khớp CHECK class_reports.reason (thứ tự hiển thị) */
export const REPORT_REASONS = [
  { key: 'inappropriate', label: 'Nội dung phản cảm, không phù hợp' },
  { key: 'harassment', label: 'Quấy rối, công kích, xúc phạm' },
  { key: 'spam', label: 'Spam hoặc quảng cáo' },
  { key: 'hate', label: 'Kích động thù ghét, phân biệt đối xử' },
  { key: 'sexual', label: 'Nội dung nhạy cảm, khiêu dâm' },
  { key: 'violence', label: 'Bạo lực, đe doạ' },
  { key: 'other', label: 'Lý do khác' },
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]['key']

export const NOTE_MAX = 500

export const isReportKind = (k: unknown): k is ReportKind => typeof k === 'string' && (REPORT_KINDS as readonly string[]).includes(k)
export const isReportReason = (r: unknown): r is ReportReason => REPORT_REASONS.some(x => x.key === r)

/** Nhãn đối tượng báo cáo (cho tiêu đề hộp thoại) */
export const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  post: 'bài đăng', comment: 'bình luận', profile: 'trang cá nhân', dm_message: 'tin nhắn', band_message: 'tin nhắn nhóm', thread: 'lượt trao đổi',
}

export type ReportInput = { kind: ReportKind; targetId: string; reason: ReportReason; note?: string }

/** Kiểm tra đầu vào TRƯỚC khi gọi mạng; trả thông báo lỗi tiếng Việt hoặc null nếu hợp lệ. */
export function validateReport(i: { kind: unknown; targetId: unknown; reason: unknown; note?: unknown }): string | null {
  if (!isReportKind(i.kind)) return 'Không xác định được nội dung cần báo cáo.'
  if (typeof i.targetId !== 'string' || i.targetId.trim() === '') return 'Không xác định được nội dung cần báo cáo.'
  if (!isReportReason(i.reason)) return 'Hãy chọn một lý do.'
  if (typeof i.note === 'string' && i.note.length > NOTE_MAX) return `Ghi chú tối đa ${NOTE_MAX} ký tự.`
  return null
}

/** Chuẩn hoá ghi chú: cắt khoảng trắng, rỗng → null, tối đa NOTE_MAX */
export const cleanNote = (n: string | undefined): string | null => {
  const t = (n ?? '').trim().slice(0, NOTE_MAX)
  return t === '' ? null : t
}

// ── Ánh xạ lỗi ───────────────────────────────────────────────────────────────
export const UGC_BLOCKED_TEXT = 'Nội dung chưa phù hợp với quy tắc cộng đồng'
export const USER_BLOCKED_TEXT = 'Bạn không thể tương tác với người dùng này.'
export const ACCOUNT_SUSPENDED_TEXT = 'Tài khoản của bạn đang bị hạn chế đăng nội dung. Hãy liên hệ hỗ trợ nếu bạn cho rằng đây là nhầm lẫn.'

type ErrLike = { code?: string; message?: string; details?: string | null; hint?: string | null; status?: number } | null | undefined

/** Mã an toàn UGC server ném ra (raise exception) → thông báo tiếng Việt; không phải mã UGC → null. */
export function mapUgcError(err: ErrLike): string | null {
  const blob = `${err?.message ?? ''} ${err?.details ?? ''} ${err?.hint ?? ''}`.toLowerCase()
  if (blob.includes('ugc_blocked')) return UGC_BLOCKED_TEXT
  if (blob.includes('user_blocked')) return USER_BLOCKED_TEXT
  if (blob.includes('account_suspended')) return ACCOUNT_SUSPENDED_TEXT
  return null
}

const isNetwork = (err: ErrLike) => {
  const m = (err?.message ?? '').toLowerCase()
  return m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')
}

/** Lỗi bất kỳ của thao tác an toàn (báo cáo/chặn/đồng ý quy tắc) → thông báo tiếng Việt. Không bao giờ trả chuỗi rỗng. */
export function safetyErrorText(err: ErrLike, offline = false): string {
  const ugc = mapUgcError(err)
  if (ugc) return ugc
  if (offline || isNetwork(err)) return 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại.'
  if (err?.status === 401 || (err?.message ?? '').toLowerCase().includes('jwt')) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
  if (err?.code === '54000') return 'Bạn thao tác quá nhanh. Hãy chờ một chút rồi thử lại.'
  if (err?.code === '42883' || err?.code === 'PGRST202' || err?.status === 404) return 'Tính năng này đang được cập nhật. Hãy thử lại sau.'
  return 'Chưa thực hiện được. Hãy thử lại.'
}

// ── Quy tắc cộng đồng (CommunityRulesGate) ───────────────────────────────────
export type UgcStatus = { acceptedVersion: number; requiredVersion: number }
export type GateState = 'ok' | 'needs-accept' | 'error'

/** Chuẩn hoá hàng trả về của class_ugc_status() (mảng 1 hàng hoặc object). Sai dạng → null. */
export function parseUgcStatus(data: unknown): UgcStatus | null {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  const r = row as { accepted_version?: unknown; required_version?: unknown }
  const req = Number(r.required_version)
  if (!Number.isFinite(req) || req < 1) return null
  const acc = r.accepted_version == null ? 0 : Number(r.accepted_version)
  return { acceptedVersion: Number.isFinite(acc) ? acc : 0, requiredVersion: req }
}

/**
 * Quyết định cổng: đã chấp nhận version hiện hành → 'ok' (không hỏi lại); chưa → 'needs-accept';
 * lỗi mạng / RPC chưa có / dữ liệu sai dạng → 'error' (hiện Thử lại — KHÔNG coi là đã đồng ý, KHÔNG khoá vĩnh viễn).
 */
export function gateState(r: { ok: true; status: UgcStatus } | { ok: false }): GateState {
  if (!r.ok) return 'error'
  return r.status.acceptedVersion >= r.status.requiredVersion ? 'ok' : 'needs-accept'
}

// ── Liên hệ hỗ trợ — CHỈ dùng liên hệ chính thức đã có trong repo (MobileStudentPortal / DeleteAccountPage) ──
export const SUPPORT_ZALO_URL = 'https://zalo.me/vananhguitarist'
export const SUPPORT_EMAIL = 'vananhaudio@gmail.com'
export const PRIVACY_URL = 'https://timming.vananhaudio.com/tvaprivacy'
export const REPORT_RESPONSE_HOURS = 24

export const COMMUNITY_RULES: { title: string; body: string }[] = [
  { title: 'Tôn trọng nhau', body: 'Không đăng nội dung phản cảm, khiêu dâm, bạo lực, kích động thù ghét. Không quấy rối, công kích hay xúc phạm người khác.' },
  { title: 'Không spam', body: 'Không quảng cáo, gửi tin rác, lặp nội dung hoặc đính kèm liên kết lừa đảo.' },
  { title: 'Báo cáo và chặn', body: 'Thấy nội dung không phù hợp, bấm nút ⋯ để Báo cáo hoặc Chặn người dùng. Người bị chặn không còn xuất hiện với bạn.' },
  { title: 'Thầy xử lý trong 24 giờ', body: `Thầy xem lại mọi báo cáo trong vòng ${REPORT_RESPONSE_HOURS} giờ và gỡ nội dung, hạn chế tài khoản nếu vi phạm.` },
]

// ── Điểm đặt "⋯ Báo cáo / Chặn" (chốt chặn cấu trúc trong test: file phải import từ class-safety) ──
export const SAFETY_PLACEMENTS: { file: string; kind: ReportKind; note: string }[] = [
  { file: 'src/class-social/sections/PostCard.tsx', kind: 'post', note: 'Bài đăng của người khác' },
  { file: 'src/class-social/sections/comments/CommentItem.tsx', kind: 'comment', note: 'Bình luận của người khác' },
  { file: 'src/class-social/sections/ProfilePage.tsx', kind: 'profile', note: 'Hồ sơ người khác' },
  { file: 'src/class-social/chat/MessageList.tsx', kind: 'dm_message', note: 'Tin DM / tin Band của người khác' },
  { file: 'src/learning-thread/ThreadView.tsx', kind: 'thread', note: 'Lượt trao đổi của học viên khác' },
]

/** Hàm đọc GỐC bị cấm gọi trực tiếp từ client → bản bọc _safe */
export const SAFE_READ_REPLACEMENTS: Record<string, string> = {
  class_feed: 'class_feed_safe',
  class_comments_for_posts: 'class_comments_for_posts_safe',
  dm_messages: 'dm_messages_safe',
  bandchat_messages: 'bandchat_messages_safe',
  dm_conversations: 'dm_conversations_safe',
  social_feed: 'social_feed_safe',
  social_feed_scoped: 'social_feed_scoped_safe',
}

/** Kind báo cáo cho tin nhắn chat: Band hay DM */
export const messageReportKind = (isBand: boolean): ReportKind => (isBand ? 'band_message' : 'dm_message')

// ── Quản trị (tab Class trong /story/reports) ────────────────────────────────
export const RESOLVE_ACTIONS = ['dismiss', 'hide', 'hide_and_block', 'handled'] as const
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number]
export const isResolveAction = (a: unknown): a is ResolveAction => (RESOLVE_ACTIONS as readonly string[]).includes(a as string)
export const REASON_LABEL: Record<string, string> = Object.fromEntries(REPORT_REASONS.map(r => [r.key, r.label]))
