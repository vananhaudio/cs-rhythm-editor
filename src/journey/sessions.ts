// ── JOURNEY OS — sinh & đọc "buổi học" (class_sessions) ──
// Mỗi lớp 1 buổi/tuần. Từ (ngày khai giảng + thứ + giờ + số buổi) → sinh N buổi cách nhau 7 ngày.
// Sinh Ở CLIENT khi lưu lớp (dễ kiểm soát hơn trigger SQL).

export const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] // 0..6

// Trạng thái lớp (spec Journey OS) — nhãn + màu chấm/khối
export const STATUS: { v: string; l: string; c: string }[] = [
  { v: 'draft',         l: 'Nháp',            c: '#A1A1AA' },
  { v: 'recruiting',    l: 'Đang tuyển',      c: '#F59E0B' },
  { v: 'ready_to_open', l: 'Đủ điều kiện mở', c: '#F59E0B' },
  { v: 'scheduled',     l: 'Đã lên lịch',     c: '#6366F1' },
  { v: 'upcoming',      l: 'Sắp khai giảng',  c: '#F59E0B' },
  { v: 'active',        l: 'Đang học',        c: '#16A34A' },
  { v: 'ending_soon',   l: 'Sắp kết thúc',    c: '#F59E0B' },
  { v: 'completed',     l: 'Đã hoàn thành',   c: '#71717A' },
  { v: 'paused',        l: 'Tạm dừng',        c: '#A1A1AA' },
  { v: 'cancelled',     l: 'Đã huỷ',          c: '#DC2626' },
  { v: 'merged',        l: 'Đã gộp',          c: '#A1A1AA' },
]
export const statusInfo = (v?: string | null) => STATUS.find(s => s.v === v) ?? STATUS[0]

export interface GenSession {
  session_number: number
  start_at: string   // ISO
  end_at: string     // ISO
}

// pad 2 chữ số
const p2 = (n: number) => String(n).padStart(2, '0')

// Ghép Date từ 'yyyy-mm-dd' + 'hh:mm' theo GIỜ ĐỊA PHƯƠNG (không lệch timezone)
const atLocal = (ymd: string, hm: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number)
  const [hh, mm] = (hm || '00:00').split(':').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0)
}

// Ngày đầu tiên >= startDate rơi vào đúng `weekday` (0=CN..6=T7). Nếu bản thân startDate đã đúng thứ → giữ nguyên.
const firstOnWeekday = (start: Date, weekday: number): Date => {
  const d = new Date(start)
  const diff = ((weekday - d.getDay()) % 7 + 7) % 7
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Sinh danh sách buổi. Trả [] nếu thiếu dữ liệu bắt buộc.
 * @param startDate 'yyyy-mm-dd' — ngày khai giảng mong muốn
 * @param weekday   0..6 (0=CN)
 * @param startTime 'hh:mm'
 * @param durationMin số phút mỗi buổi
 * @param total      số buổi
 */
export function generateSessions(
  startDate?: string | null,
  weekday?: number | null,
  startTime?: string | null,
  durationMin = 90,
  total = 8,
): GenSession[] {
  if (!startDate || weekday === null || weekday === undefined || !startTime) return []
  if (!total || total < 1) return []
  const first = firstOnWeekday(atLocal(startDate, startTime), weekday)
  const out: GenSession[] = []
  for (let i = 0; i < total; i++) {
    const s = new Date(first)
    s.setDate(first.getDate() + i * 7)
    const e = new Date(s.getTime() + durationMin * 60000)
    out.push({ session_number: i + 1, start_at: s.toISOString(), end_at: e.toISOString() })
  }
  return out
}

// Ngày khai giảng THẬT (buổi 1) dạng 'yyyy-mm-dd' — có thể lệch startDate nhập nếu chưa đúng thứ.
export function realStartDate(sessions: GenSession[]): string | null {
  if (!sessions.length) return null
  const d = new Date(sessions[0].start_at)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

// Ngày kết thúc dự kiến (buổi cuối) dạng 'yyyy-mm-dd'.
export function realEndDate(sessions: GenSession[]): string | null {
  if (!sessions.length) return null
  const d = new Date(sessions[sessions.length - 1].start_at)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

// Định dạng dd/mm/yyyy để hiển thị.
export function fmtDMY(ymd?: string | null): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

// Gợi ý text lịch cũ cho trang tuyển sinh, vd 'Thứ 3 · 19h00'. weekday 0=CN.
export function scheduleText(weekday?: number | null, startTime?: string | null): string {
  if (weekday === null || weekday === undefined || !startTime) return ''
  const thu = weekday === 0 ? 'Chủ nhật' : `Thứ ${weekday + 1}`
  const [hh, mm] = startTime.split(':')
  return `${thu} · ${hh}h${mm && mm !== '00' ? mm : '00'}`
}

// Buổi hiện tại / tổng, dựa vào thời điểm now. Trả {current, total, done}.
// current = số buổi ĐÃ tới (start_at <= now) — buổi đang/đã diễn ra; done = số buổi status='completed'.
export interface SessionRow { session_number: number; start_at: string; status: string }
export function progressInfo(sessions: SessionRow[], now = new Date()): { current: number; total: number; done: number } {
  const total = sessions.length
  const t = now.getTime()
  const current = sessions.filter(s => new Date(s.start_at).getTime() <= t && s.status !== 'cancelled').length
  const done = sessions.filter(s => s.status === 'completed').length
  return { current, total, done }
}
