// classOffer.ts — CANONICAL CHO "FLOW ĐĂNG KÝ /class" (preview vòng redesign 2/9/2026).
//
// MỤC ĐÍCH: một nơi duy nhất định nghĩa
//  1) số buổi/thời lượng học cùng Thầy (4 buổi/tháng · 8 buổi/khóa · 90 phút/buổi),
//  2) các DÒNG QUYỀN LỢI của bảng so sánh 3 hình thức,
//  3) tên key app_config để sau này Admin chỉnh số mà KHÔNG sửa code.
//
// NGUỒN CHỮ: đồng bộ với nội dung đang chạy trên /class (ClassLearningWays COPY,
// FAQ, modal 'Hai cách học'), KHÔNG tạo bộ wording thứ hai. Pricing KHÔNG nằm ở
// đây: đọc từ public_app_config (practice_monthly_fee / practice_6m_total /
// practice_6m_monthly / class_fee) như ClassLandingPage đang làm.
//
// QUY ƯỚC APP_CONFIG (sẽ thêm — xem db/class_offer_quantities_config.sql, CHƯA apply):
//   practice_sessions_per_month = '4'
//   practice_session_minutes    = '90'
//   class_sessions_per_course   = '8'
//   class_session_minutes       = '90'
// Nếu key chưa tồn tại trong allowlist → rơi về DEFAULT dưới đây (fail-safe, không vỡ UI).

export const OFFER_QTY_KEYS = {
  practicePerMonth: 'practice_sessions_per_month',
  practiceMinutes: 'practice_session_minutes',
  classPerCourse: 'class_sessions_per_course',
  classMinutes: 'class_session_minutes',
} as const

export interface OfferQty {
  practicePerMonth: number
  practiceMinutes: number
  classPerCourse: number
  classMinutes: number
}

export const OFFER_QTY_DEFAULT: OfferQty = {
  practicePerMonth: 4,
  practiceMinutes: 90,
  classPerCourse: 8,
  classMinutes: 90,
}

/** Đọc số lượng từ app_config (nếu allowlist có key) — nếu thiếu → default. */
export function offerQtyFromCfg(pubCfg: Record<string, string> | null): OfferQty {
  const num = (k: string): number | null => {
    const v = pubCfg?.[k]
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return {
    practicePerMonth: num(OFFER_QTY_KEYS.practicePerMonth) ?? OFFER_QTY_DEFAULT.practicePerMonth,
    practiceMinutes: num(OFFER_QTY_KEYS.practiceMinutes) ?? OFFER_QTY_DEFAULT.practiceMinutes,
    classPerCourse: num(OFFER_QTY_KEYS.classPerCourse) ?? OFFER_QTY_DEFAULT.classPerCourse,
    classMinutes: num(OFFER_QTY_KEYS.classMinutes) ?? OFFER_QTY_DEFAULT.classMinutes,
  }
}

// ─── HÌNH THỨC ĐĂNG KÝ ─────────────────────────────────────────────────────
export type OfferMode = 'practice' | 'class' | 'both'
export type PracticeDuration = '1_month' | '6_month'

export const OFFER_META: Record<OfferMode, { title: string; sub: string; color: 'mem' | 'cls' | 'both' }> = {
  practice: { title: 'Gói Thực hành', sub: 'Linh hoạt · đi sâu', color: 'mem' },
  class: { title: 'Học theo lớp', sub: 'Cố định · đi lên', color: 'cls' },
  both: { title: 'Học cả hai', sub: 'Đi lên + đi sâu', color: 'both' },
}

// ─── DÒNG QUYỀN LỢI CỦA BẢNG SO SÁNH ───────────────────────────────────────
// Mỗi dòng: label + cell cho 3 cột. Cell = chuỗi (có thể nhiều dòng) hoặc true = ✓.
// Wording bám nguyên nội dung /class đang chạy (không viết lại ý mới).
export interface CompareCell {
  lines: string[]
  check?: boolean
  dash?: boolean   // hiện '—' (không áp dụng cho hình thức này)
}
export interface CompareRow {
  label: string
  practice: CompareCell
  cls: CompareCell
  both: CompareCell
}

export function buildCompareRows(qty: OfferQty): CompareRow[] {
  const pSess = `${qty.practicePerMonth} buổi/tháng`
  const pMin = `${qty.practiceMinutes} phút/buổi`
  const cSess = `${qty.classPerCourse} buổi/khóa`
  const cMin = `${qty.classMinutes} phút/buổi`
  return [
    // 3 dòng TÁCH RÕ (feedback 3): số buổi từng bên + thời lượng — không nhồi 1 cell
    {
      label: 'Thực hành cùng Thầy',
      practice: { lines: [pSess] },
      cls: { dash: true, lines: [] },
      both: { lines: [pSess] },
    },
    {
      label: 'Học theo lớp cùng Thầy',
      practice: { dash: true, lines: [] },
      cls: { lines: [cSess] },
      both: { lines: [cSess] },
    },
    {
      label: 'Thời lượng mỗi buổi',
      practice: { lines: [pMin] },
      cls: { lines: [cMin] },
      both: { lines: [pMin] },
    },
    {
      label: 'Nội dung học',
      practice: { lines: ['Tự chọn hướng học trên App:', 'Đệm hát · Tỉa nốt · Solo…'] },
      cls: { lines: ['Lớp đi theo chương trình khoá', 'từ đầu đến cuối'] },
      both: { lines: ['Theo chương trình lớp', '+ tự chọn hướng trên App'] },
    },
    {
      label: 'Lịch tham gia',
      practice: { lines: ['Chủ động chọn buổi phù hợp', 'theo lịch hàng tuần'] },
      cls: { lines: ['Cố định theo lịch lớp thật', '(ngày khai giảng cụ thể)'] },
      both: { lines: ['Lịch lớp cố định', '+ chọn buổi thực hành linh hoạt'] },
    },
    { label: 'Kho bài giảng + App luyện tập mỗi ngày', practice: { check: true, lines: [] }, cls: { check: true, lines: [] }, both: { check: true, lines: [] } },
    { label: 'Hỏi đáp cùng Thầy qua Zalo', practice: { check: true, lines: [] }, cls: { check: true, lines: [] }, both: { check: true, lines: [] } },
    {
      label: 'Nhóm đồng hành',
      practice: { lines: ['Nhóm thực hành theo trình độ:', 'Cơ bản · Trung cấp · Nâng cao'] },
      cls: { lines: ['Nhóm lớp học cùng nhịp'] },
      both: { lines: ['Nhóm lớp + nhóm thực hành'] },
    },
    {
      label: 'Hướng phát triển',
      practice: { lines: ['Đi sâu — luyện kỹ năng', 'đến khi làm được'] },
      cls: { lines: ['Đi lên — tiếp nhận kiến thức', 'mới theo lộ trình'] },
      both: { lines: ['Đi lên + đi sâu cùng lúc'] },
    },
  ]
}

// ─── TÓM TẮT LỰA CHỌN (dùng cho Step 1 confirm + Step 2 "Bạn đã chọn") ────
export interface OfferSelection {
  mode: OfferMode
  duration: PracticeDuration
  className: string // key lớp (name·code) — '' nếu chưa chọn
}

export function offerSummaryLabel(sel: OfferSelection, classTitle: string | null): string {
  const base = OFFER_META[sel.mode].title
  if (sel.mode === 'practice') return `${base} · ${sel.duration === '1_month' ? '1 tháng' : '6 tháng'}`
  if (sel.mode === 'class') return sel.className ? `${base} · ${classTitle ?? sel.className}` : `${base} (chưa chọn lớp)`
  return `${base} · ${classTitle ?? sel.className ?? 'lớp'}`
}
