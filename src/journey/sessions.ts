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
  session_number: number | null   // null = sự kiện KHÔNG phải buổi học (vd nghỉ giữa chặng)
  start_at: string   // ISO
  end_at: string     // ISO
  event_type: 'lesson' | 'break'  // buổi học | nghỉ giữa chặng
}

// Tuỳ chọn sinh lịch nâng cao (chỉ áp dụng khi truyền vào — mặc định giữ hành vi cũ):
//   breaksAfter: sau các buổi N trong danh sách sẽ nghỉ ĐÚNG 2 thứ liên tiếp
//                (vd [8,16,24,32] = nghỉ 2 tuần sau buổi 8/16/24/32; không có nghỉ sau buổi cuối).
//   skipDates:   các ngày 'yyyy-mm-dd' bỏ qua (nghỉ lễ / ngày bị khóa trong lịch chung Class)
//                — buổi rơi vào ngày này được dời sang thứ phù hợp tiếp theo, GIỮ NGUYÊN số thứ tự.
export interface GenerateOpts {
  breaksAfter?: number[]
  skipDates?: string[]
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
  opts?: GenerateOpts,
): GenSession[] {
  if (!startDate || weekday === null || weekday === undefined || !startTime) return []
  if (!total || total < 1) return []
  const breaksAfter = new Set((opts?.breaksAfter ?? []).map(n => Math.trunc(n)))
  const skip = new Set((opts?.skipDates ?? []).map(d => (d || '').slice(0, 10)))
  const first = firstOnWeekday(atLocal(startDate, startTime), weekday)
  const out: GenSession[] = []
  const d = new Date(first)
  const ymd = (x: Date) => `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`
  let lessons = 0
  while (lessons < total) {
    // Nghỉ giữa chặng: ĐÚNG 2 thứ liên tiếp ngay sau buổi N (không đánh số như buổi học)
    if (breaksAfter.has(lessons)) {
      breaksAfter.delete(lessons)
      for (let b = 0; b < 2; b++) {
        out.push({ session_number: null, event_type: 'break', start_at: d.toISOString(), end_at: new Date(d.getTime() + durationMin * 60000).toISOString() })
        d.setDate(d.getDate() + 7)
      }
      continue
    }
    // Ngày bị bỏ qua (nghỉ lễ / khóa lịch): dời sang thứ phù hợp tiếp theo, GIỮ số thứ tự buổi
    if (skip.has(ymd(d))) { d.setDate(d.getDate() + 7); continue }
    lessons++
    const e = new Date(d.getTime() + durationMin * 60000)
    out.push({ session_number: lessons, event_type: 'lesson', start_at: d.toISOString(), end_at: e.toISOString() })
    d.setDate(d.getDate() + 7)
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

// Buổi hiện tại / tổng / còn lại, dựa vào thời điểm now.
// Quy ước đếm:
//   - 'cancelled' (huỷ) + 'holiday' (nghỉ lễ): KHÔNG phải buổi dạy → loại khỏi cả "đã học" lẫn "tổng".
//   - 'rescheduled' (dời buổi): chưa dạy tại giờ gốc, sẽ dạy bù → KHÔNG tính "đã học", VẪN tính "còn lại".
//   - còn lại: đã qua giờ (hoặc 'completed') = đã học; total - current = còn lại.
export interface SessionRow { session_number: number | null; start_at: string; status: string; event_type?: string | null; title?: string | null }
const NON_TEACHING = new Set(['cancelled', 'holiday'])
export function progressInfo(sessions: SessionRow[], now = new Date()): { current: number; total: number; done: number; remaining: number } {
  const teach = sessions.filter(s => !NON_TEACHING.has(s.status))
  const total = teach.length
  const t = now.getTime()
  const current = teach.filter(s => s.status === 'completed' || (new Date(s.start_at).getTime() <= t && s.status !== 'rescheduled')).length
  const done = sessions.filter(s => s.status === 'completed').length
  return { current, total, done, remaining: Math.max(0, total - current) }
}
