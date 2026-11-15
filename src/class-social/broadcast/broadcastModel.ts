// Broadcast V1 — mô hình thuần (không mạng/DOM) để test được. Quyền, đếm người nhận, chống trùng… do DB quyết; ở đây chỉ dựng giao diện.
export type Channel = 'notice' | 'chat'
export type AudienceKind = 'all' | 'students' | 'class' | 'band'
export type CampaignStatus = 'draft' | 'ready' | 'sending' | 'completed' | 'partial_failed' | 'failed' | 'cancelled'

export const BODY_MAX = 2000
export const TITLE_MAX = 80

export const CHANNELS: { id: Channel; label: string; hint: string }[] = [
  { id: 'notice', label: 'Thông báo', hint: 'Hiện ở chuông Thông báo của từng người, có tiêu đề và liên kết tuỳ chọn.' },
  { id: 'chat', label: 'Trò chuyện', hint: 'Mỗi người nhận một tin riêng từ bạn trong Trò chuyện 1–1. Người đã chặn bạn sẽ không nhận.' },
]
export const AUDIENCES: { id: AudienceKind; label: string }[] = [
  { id: 'all', label: 'Tất cả người dùng' },
  { id: 'students', label: 'Tất cả học viên' },
  { id: 'class', label: 'Theo lớp' },
  { id: 'band', label: 'Theo Band' },
]

export type AudienceOption = { kind: 'class' | 'band'; id: string; label: string; members: number }
export type AudienceRow = { kind: string | null; id: string | null; label: string | null; members: number | null }
export function toAudienceOptions(rows: AudienceRow[] | null | undefined): AudienceOption[] {
  return (rows ?? []).filter(r => (r?.kind === 'class' || r?.kind === 'band') && !!r.id)
    .map(r => ({ kind: r.kind as 'class' | 'band', id: r.id as string, label: (r.label ?? '').trim() || 'Không tên', members: Math.max(0, Number(r.members) || 0) }))
}

export type Preview = { eligible: number; excluded: number; reasons: Record<string, number>; label: string }
export type PreviewRow = { eligible: number | null; excluded: number | null; reasons: Record<string, number> | null; label: string | null }
export function toPreview(row: PreviewRow | null | undefined): Preview | null {
  if (!row) return null
  return { eligible: Math.max(0, Number(row.eligible) || 0), excluded: Math.max(0, Number(row.excluded) || 0), reasons: row.reasons ?? {}, label: row.label ?? '' }
}

const REASONS: Record<string, string> = {
  self: 'Chính bạn', no_account: 'Không có tài khoản', deleted: 'Tài khoản đã xoá', disabled: 'Tài khoản bị vô hiệu hoá',
  not_class_member: 'Chưa là thành viên Class', not_student: 'Không phải học viên', inactive: 'Học viên đã nghỉ',
  suspended: 'Đang bị tạm dừng tương tác', blocked: 'Đã chặn bạn (Trò chuyện)',
}
export const reasonLabel = (k: string) => REASONS[k] ?? k
export function reasonList(reasons: Record<string, number> | null | undefined): { key: string; label: string; count: number }[] {
  return Object.entries(reasons ?? {}).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, label: reasonLabel(key), count }))
}

// ── Soạn thảo ────────────────────────────────────────────────────────────────
export type Draft = { channel: Channel; audience: AudienceKind; ref: string | null; title: string; body: string; link: string }
export const EMPTY_DRAFT: Draft = { channel: 'notice', audience: 'all', ref: null, title: '', body: '', link: '' }

/** Đường dẫn nội bộ: bắt đầu bằng đúng một dấu / (khớp CHECK trên DB) */
export const validLink = (v: string) => v === '' || (/^\/(?![/\\])\S*$/.test(v) && v.length <= 300)

export function draftProblems(d: Draft): string[] {
  const out: string[] = []
  const body = d.body.trim()
  if (!body) out.push('Hãy nhập nội dung.')
  if (body.length > BODY_MAX) out.push(`Nội dung tối đa ${BODY_MAX} ký tự.`)
  if (d.channel === 'notice' && d.title.trim().length > TITLE_MAX) out.push(`Tiêu đề tối đa ${TITLE_MAX} ký tự.`)
  if (d.channel === 'notice' && !validLink(d.link.trim())) out.push('Liên kết phải là đường dẫn nội bộ, bắt đầu bằng / (ví dụ /me/friends).')
  if ((d.audience === 'class' || d.audience === 'band') && !d.ref) out.push(d.audience === 'class' ? 'Hãy chọn lớp.' : 'Hãy chọn Band.')
  return out
}

/** Dữ liệu gửi lên RPC (server vẫn kiểm lại tất cả) */
export function toRpcArgs(d: Draft) {
  return {
    p_channel: d.channel, p_audience: d.audience, p_ref: d.audience === 'class' || d.audience === 'band' ? d.ref : null,
    p_title: d.channel === 'notice' ? d.title.trim() || null : null, p_body: d.body.trim(), p_link: d.channel === 'notice' ? d.link.trim() || null : null,
  }
}

/** Câu trên nút xác nhận cuối: N là số do SERVER báo ở bước xem trước */
export const confirmLabel = (n: number) => `Xác nhận gửi tới ${n.toLocaleString('vi-VN')} người`

// ── Chiến dịch ───────────────────────────────────────────────────────────────
export type Stats = { sent: number; failed: number; pending: number; skipped: number; cancelled: number; read: number | null }
export type Campaign = {
  id: string; channel: Channel; audienceLabel: string; title: string | null; body: string; link: string | null; status: CampaignStatus
  createdAt: string; finishedAt: string | null; eligible: number; stats: Stats; excluded: Record<string, number>
}
type StatsRaw = Partial<Record<'sent' | 'failed' | 'pending' | 'skipped' | 'cancelled' | 'read', number | null>> | null
export type CampaignRow = {
  id: string; channel: string; audience_label: string; title: string | null; body: string; link?: string | null; status: string
  created_at: string; finished_at?: string | null; eligible_total: number; stats: StatsRaw; excluded?: Record<string, number> | null
}
const STATUSES: CampaignStatus[] = ['draft', 'ready', 'sending', 'completed', 'partial_failed', 'failed', 'cancelled']
const n0 = (v: unknown) => Math.max(0, Number(v) || 0)
export function toStats(s: StatsRaw): Stats {
  return { sent: n0(s?.sent), failed: n0(s?.failed), pending: n0(s?.pending), skipped: n0(s?.skipped), cancelled: n0(s?.cancelled), read: s?.read == null ? null : n0(s.read) }
}
export function toCampaign(r: CampaignRow | null | undefined): Campaign | null {
  if (!r?.id) return null
  return {
    id: r.id, channel: r.channel === 'chat' ? 'chat' : 'notice', audienceLabel: r.audience_label ?? '', title: r.title ?? null, body: r.body ?? '',
    link: r.link ?? null, status: (STATUSES as string[]).includes(r.status) ? (r.status as CampaignStatus) : 'sending',
    createdAt: r.created_at, finishedAt: r.finished_at ?? null, eligible: n0(r.eligible_total), stats: toStats(r.stats), excluded: r.excluded ?? {},
  }
}
export const toCampaigns = (rows: CampaignRow[] | null | undefined) => (rows ?? []).map(toCampaign).filter((c): c is Campaign => !!c)

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Nháp', ready: 'Sẵn sàng', sending: 'Đang gửi', completed: 'Đã gửi xong', partial_failed: 'Xong, có lỗi', failed: 'Thất bại', cancelled: 'Đã hủy',
}
export const isActive = (s: CampaignStatus) => s === 'sending'
export const channelLabel = (c: Channel) => (c === 'chat' ? 'Trò chuyện' : 'Thông báo')

/** % hoàn tất = (đã gửi + lỗi cuối) / người nhận hợp lệ. Không bao giờ vượt 100. */
export function progressPct(c: Campaign): number {
  if (c.eligible <= 0) return 100
  return Math.min(100, Math.floor(((c.stats.sent + c.stats.failed + c.stats.cancelled) / c.eligible) * 100))
}

/** Câu tóm tắt kết quả — phân biệt rõ đã gửi / chờ / lỗi / hủy; KHÔNG nói "đã nhận 100%" khi chưa có bằng chứng */
export function resultLine(c: Campaign): string {
  const p: string[] = [`${c.stats.sent.toLocaleString('vi-VN')} đã gửi`]
  if (c.stats.pending) p.push(`${c.stats.pending.toLocaleString('vi-VN')} đang chờ`)
  if (c.stats.failed) p.push(`${c.stats.failed.toLocaleString('vi-VN')} lỗi`)
  if (c.stats.cancelled) p.push(`${c.stats.cancelled.toLocaleString('vi-VN')} đã hủy`)
  if (c.stats.skipped) p.push(`${c.stats.skipped.toLocaleString('vi-VN')} bị loại`)
  if (c.channel === 'notice' && c.stats.read != null) p.push(`${c.stats.read.toLocaleString('vi-VN')} đã đọc`)
  return p.join(' · ')
}

export type RecipientRow = { user_id: string; name: string | null; status: string; error: string | null; attempts: number | null; delivered_at: string | null }
export type Recipient = { userId: string; name: string; status: string; error: string | null; attempts: number; deliveredAt: string | null }
export const toRecipients = (rows: RecipientRow[] | null | undefined): Recipient[] =>
  (rows ?? []).filter(r => !!r?.user_id).map(r => ({ userId: r.user_id, name: (r.name ?? '').trim() || 'Thành viên', status: r.status, error: r.error, attempts: n0(r.attempts), deliveredAt: r.delivered_at }))
export const RECIPIENT_STATUS: Record<string, string> = { pending: 'Chờ gửi', sent: 'Đã gửi', failed: 'Lỗi', skipped: 'Bị loại', cancelled: 'Đã hủy' }

/** Lỗi RPC → câu tiếng Việt. Lỗi nghiệp vụ (22023/42501/P0002) đã là câu dễ hiểu. */
export function broadcastError(e: { code?: string; message?: string } | null, offline = false): { text: string; countChanged: boolean } {
  if (offline) return { text: 'Không có mạng. Hãy thử lại khi có kết nối.', countChanged: false }
  if (e?.message?.startsWith('BROADCAST_COUNT_CHANGED')) return { text: e.message.replace('BROADCAST_COUNT_CHANGED: ', ''), countChanged: true }
  if ((e?.code === '22023' || e?.code === '42501' || e?.code === 'P0002') && e.message) return { text: e.message, countChanged: false }
  return { text: 'Chưa thực hiện được. Hãy thử lại.', countChanged: false }
}
