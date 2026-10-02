// ─────────────────────────────────────────────────────────────────────────────
// Band — Tuyển thành viên V1: kiểu dữ liệu + hàm THUẦN (không React, không supabase) để test được.
// Mọi thứ riêng của một Band (tên, gu, lịch, bài tham chiếu, vị trí, câu hỏi, Rule) đến từ server
// (RPC band_recruitment_public). File này KHÔNG chứa nội dung của Band nào.
// Server (band_apply) kiểm tra lại toàn bộ — validate ở đây chỉ để báo lỗi sớm cho người dùng.
// ─────────────────────────────────────────────────────────────────────────────

export type BandOption = { value: string; label: string }
export type BandQuestion = {
  key: string
  label: string
  /** Nhãn ngắn cho cột Admin (mặc định = label) */
  shortLabel: string
  type: 'single'
  required: boolean
  options: BandOption[]
}
export type BandPosition = { key: string; label: string; /** chọn vị trí này → hỏi thêm mô tả */ other: boolean }
export type BandSong = { title: string; artist: string | null; url: string | null }
export type BandFact = { label: string; value: string }

export type BandProfile = {
  id: string
  slug: string
  name: string
  leaderName: string | null
  tagline: string | null
  musicStyle: string | null
  scheduleText: string | null
  referenceSongs: BandSong[]
  highlights: BandFact[]
  description: string | null
}
export type BandRecruitment = {
  id: string
  title: string
  intro: string | null
  positions: BandPosition[]
  questions: BandQuestion[]
  reasonLabel: string
  successMessage: string | null
}
export type BandRules = { id: string; version: number; title: string; items: string[]; agreeLabel: string }

/** Dữ liệu landing. recruitment/rules = null khi Band không có đợt tuyển đang mở. */
export type BandPublic = { band: BandProfile; recruitment: BandRecruitment | null; rules: BandRules | null }

// ── parse an toàn từ JSON server (thiếu/lỗi kiểu → bỏ qua phần tử, không crash) ──
type Json = Record<string, unknown>
const isObj = (x: unknown): x is Json => !!x && typeof x === 'object' && !Array.isArray(x)
const str = (x: unknown): string | null => (typeof x === 'string' && x.trim() ? x : null)
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])

export function parseOptions(x: unknown): BandOption[] {
  return arr(x).flatMap(o => (isObj(o) && str(o.value) && str(o.label) ? [{ value: o.value as string, label: o.label as string }] : []))
}

export function parseQuestions(x: unknown): BandQuestion[] {
  return arr(x).flatMap(q => {
    if (!isObj(q) || !str(q.key) || !str(q.label)) return []
    const options = parseOptions(q.options)
    if ((q.type ?? 'single') !== 'single' || options.length === 0) return []
    return [{ key: q.key as string, label: q.label as string, shortLabel: str(q.short_label) ?? (q.label as string),
      type: 'single' as const, required: q.required !== false, options }]
  })
}

export function parsePositions(x: unknown): BandPosition[] {
  return arr(x).flatMap(p => (isObj(p) && str(p.key) && str(p.label) ? [{ key: p.key as string, label: p.label as string, other: p.other === true }] : []))
}

export function parseBandPublic(x: unknown): BandPublic | null {
  if (!isObj(x) || !isObj(x.band) || !str(x.band.id) || !str(x.band.name)) return null
  const b = x.band
  const band: BandProfile = {
    id: b.id as string, slug: str(b.slug) ?? '', name: b.name as string,
    leaderName: str(b.leader_name), tagline: str(b.tagline), musicStyle: str(b.music_style), scheduleText: str(b.schedule_text),
    referenceSongs: arr(b.reference_songs).flatMap(s => (isObj(s) && str(s.title) ? [{ title: s.title as string, artist: str(s.artist), url: str(s.url) }] : [])),
    highlights: arr(b.highlights).flatMap(h => (isObj(h) && str(h.label) && str(h.value) ? [{ label: h.label as string, value: h.value as string }] : [])),
    description: str(b.description),
  }
  let recruitment: BandRecruitment | null = null
  let rules: BandRules | null = null
  const r = x.recruitment, v = x.rules
  if (isObj(r) && str(r.id) && isObj(v) && str(v.id)) {
    const positions = parsePositions(r.positions)
    const items = arr(v.items).flatMap(i => (str(i) ? [i as string] : []))
    if (positions.length > 0 && items.length > 0) {
      recruitment = {
        id: r.id as string, title: str(r.title) ?? 'Tuyển thành viên', intro: str(r.intro), positions,
        questions: parseQuestions(r.questions), reasonLabel: str(r.reason_label) ?? 'Vì sao bạn muốn tham gia?',
        successMessage: str(r.success_message),
      }
      rules = { id: v.id as string, version: Number(v.version) || 1, title: str(v.title) ?? 'Rule của Band', items,
        agreeLabel: str(v.agree_label) ?? 'Tôi đã đọc và đồng ý thực hiện' }
    }
  }
  return { band, recruitment, rules }
}

// ── Form ─────────────────────────────────────────────────────────────────────
export type BandFormValues = {
  fullName: string
  phone: string
  positionKey: string
  positionOther: string
  answers: Record<string, string>
  reason: string
  rulesAccepted: boolean
  /** ô ẩn chống bot — người thật không thấy, luôn rỗng */
  website: string
}

export const emptyBandForm = (): BandFormValues => ({
  fullName: '', phone: '', positionKey: '', positionOther: '', answers: {}, reason: '', rulesAccepted: false, website: '',
})

export const REASON_MAX = 2000

/** 0912 345 678 / +84 912… / 84912… → 0912345678; không hợp lệ → null. Cùng luật với band_apply. */
export function normalizePhone(raw: string): string | null {
  let p = raw.replace(/[^0-9+]/g, '')
  if (p.startsWith('+84')) p = '0' + p.slice(3)
  else if (p.startsWith('84') && p.length >= 11) p = '0' + p.slice(2)
  return /^0[0-9]{8,10}$/.test(p) ? p : null
}

/** Khoá lỗi = tên trường ('fullName' | 'phone' | 'positionKey' | 'reason' | 'rules' | <question key>). */
export type BandFormErrors = Record<string, string>

export function validateBandForm(rec: BandRecruitment, v: BandFormValues): BandFormErrors {
  const e: BandFormErrors = {}
  const name = v.fullName.trim()
  if (name.length < 2 || name.length > 80) e.fullName = 'Vui lòng nhập họ và tên.'
  if (!normalizePhone(v.phone)) e.phone = 'Số điện thoại/Zalo chưa đúng.'
  if (!rec.positions.some(p => p.key === v.positionKey)) e.positionKey = 'Vui lòng chọn vị trí muốn tham gia.'
  for (const q of rec.questions) {
    const a = v.answers[q.key]
    if (!a) { if (q.required) e[q.key] = 'Vui lòng chọn một câu trả lời.' }
    else if (!q.options.some(o => o.value === a)) e[q.key] = 'Câu trả lời không hợp lệ.'
  }
  const reason = v.reason.trim()
  if (!reason) e.reason = 'Vui lòng cho biết lý do — Thầy đọc kỹ phần này.'
  else if (reason.length > REASON_MAX) e.reason = `Tối đa ${REASON_MAX} ký tự.`
  if (!v.rulesAccepted) e.rules = 'Bạn cần đọc và đồng ý Rule trước khi gửi đơn.'
  return e
}

/** Thứ tự trường trên form — để cuộn tới lỗi đầu tiên. */
export function firstErrorKey(rec: BandRecruitment, e: BandFormErrors): string | null {
  const order = ['fullName', 'phone', 'positionKey', ...rec.questions.map(q => q.key), 'rules', 'reason']
  return order.find(k => e[k]) ?? null
}

/** Payload cho band_apply. KHÔNG gửi danh tính — server tự lấy auth.uid(). */
export function buildApplyPayload(rec: BandRecruitment, rules: BandRules, v: BandFormValues, clientKey: string) {
  const pos = rec.positions.find(p => p.key === v.positionKey)
  const answers: Record<string, string> = {}
  for (const q of rec.questions) if (v.answers[q.key]) answers[q.key] = v.answers[q.key]
  return {
    full_name: v.fullName.trim(),
    phone: v.phone.trim(),
    position_key: v.positionKey,
    position_other: pos?.other ? v.positionOther.trim() || null : null,
    answers,
    reason: v.reason.trim(),
    rules_accepted: v.rulesAccepted,
    rule_version_id: rules.id,
    client_key: clientKey,
    website: v.website,
  }
}

export function newClientKey(): string {
  const c = globalThis.crypto
  if (c && 'randomUUID' in c) return c.randomUUID()
  return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
}

// ── Admin ────────────────────────────────────────────────────────────────────
export const APPLICATION_STATUSES = ['NEW', 'REVIEWING', 'ACCEPTED', 'REJECTED'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]
export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  NEW: 'Mới', REVIEWING: 'Đang xem xét', ACCEPTED: 'Chấp nhận', REJECTED: 'Từ chối',
}
export const isStatus = (x: unknown): x is ApplicationStatus => APPLICATION_STATUSES.includes(x as ApplicationStatus)

export type AdminBand = { id: string; slug: string; name: string; status: string; recruitmentStatus: string | null; total: number; fresh: number }
export type AdminRecruitment = { id: string; title: string; status: string; positions: BandPosition[]; questions: BandQuestion[]; reasonLabel: string }
export type AdminApplication = {
  id: string
  recruitmentId: string
  fullName: string
  phone: string
  positionKey: string
  positionOther: string | null
  answers: Record<string, string>
  reason: string
  ruleVersion: number
  rulesAcceptedAt: string
  status: ApplicationStatus
  hasAccount: boolean
  createdAt: string
}
export type AdminBandDetail = { band: { id: string; slug: string; name: string }; recruitments: AdminRecruitment[]; applications: AdminApplication[] }

export function parseAdminBands(x: unknown): AdminBand[] {
  return arr(x).flatMap(b => (isObj(b) && str(b.id) && str(b.slug) && str(b.name) ? [{
    id: b.id as string, slug: b.slug as string, name: b.name as string, status: str(b.status) ?? 'active',
    recruitmentStatus: str(b.recruitment_status), total: Number(b.total) || 0, fresh: Number(b.new) || 0,
  }] : []))
}

export function parseAdminDetail(x: unknown): AdminBandDetail | null {
  if (!isObj(x) || !isObj(x.band) || !str(x.band.id)) return null
  const recruitments = arr(x.recruitments).flatMap(r => (isObj(r) && str(r.id) ? [{
    id: r.id as string, title: str(r.title) ?? 'Tuyển thành viên', status: str(r.status) ?? 'open',
    positions: parsePositions(r.positions), questions: parseQuestions(r.questions), reasonLabel: str(r.reason_label) ?? 'Lý do tham gia',
  }] : []))
  const applications = arr(x.applications).flatMap(a => {
    if (!isObj(a) || !str(a.id)) return []
    const answers: Record<string, string> = {}
    if (isObj(a.answers)) for (const [k, val] of Object.entries(a.answers)) if (typeof val === 'string') answers[k] = val
    return [{
      id: a.id as string, recruitmentId: str(a.recruitment_id) ?? '', fullName: str(a.full_name) ?? '', phone: str(a.phone) ?? '',
      positionKey: str(a.position_key) ?? '', positionOther: str(a.position_other), answers, reason: str(a.reason) ?? '',
      ruleVersion: Number(a.rule_version) || 0, rulesAcceptedAt: str(a.rules_accepted_at) ?? '',
      status: isStatus(a.status) ? a.status : 'NEW', hasAccount: a.has_account === true, createdAt: str(a.created_at) ?? '',
    }]
  })
  return { band: { id: x.band.id as string, slug: str(x.band.slug) ?? '', name: str(x.band.name) ?? '' }, recruitments, applications }
}

/** Nhãn vị trí theo config của chính đợt tuyển; key lạ (config đổi sau) → hiện key, không mất dữ liệu. */
export function positionLabel(rec: AdminRecruitment | undefined, a: AdminApplication): string {
  const p = rec?.positions.find(x => x.key === a.positionKey)
  const base = p?.label ?? a.positionKey
  return a.positionOther ? `${base}: ${a.positionOther}` : base
}

export function answerLabel(q: BandQuestion, value: string | undefined): string {
  if (!value) return '—'
  return q.options.find(o => o.value === value)?.label ?? value
}

export function filterApplications(list: AdminApplication[], status: ApplicationStatus | 'ALL'): AdminApplication[] {
  return status === 'ALL' ? list : list.filter(a => a.status === status)
}

export function countByStatus(list: AdminApplication[]): Record<ApplicationStatus | 'ALL', number> {
  const c = { ALL: list.length, NEW: 0, REVIEWING: 0, ACCEPTED: 0, REJECTED: 0 }
  for (const a of list) c[a.status]++
  return c
}

// ── Route ────────────────────────────────────────────────────────────────────
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const BAND_PUBLIC_PREFIX = '/band/'

/** /band/<slug> (công khai) → slug; khác → null. */
export function bandSlugFromPublicPath(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '')
  if (!p.startsWith(BAND_PUBLIC_PREFIX)) return null
  const slug = p.slice(BAND_PUBLIC_PREFIX.length).toLowerCase()
  return SLUG_RE.test(slug) && slug.length <= 60 ? slug : null
}

export function bandPublicPath(slug: string): string {
  return BAND_PUBLIC_PREFIX + slug
}

export function isValidBandSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length <= 60
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}
