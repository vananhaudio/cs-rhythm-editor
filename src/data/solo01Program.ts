// ── SOLO-01 — SOLO GUITAR CĂN BẢN: GIÁO TRÌNH (nội dung tĩnh) ──
// Nội dung chương trình (chặng · buổi · mục tiêu) — KHÔNG chứa NGÀY.
// Cùng khuôn với data/ht2027Program.ts để 2 landing page dùng chung design system.
// Landing: class.vananhaudio.com/solo01 (src/Solo01Page.tsx).

export const SOLO01 = {
  programCode: 'SOLO01',
  classCode: 'SOLO01.TH01',
  name: 'Solo Guitar Căn Bản',
  totalSessions: 24,
  stages: 3,
  sessionsPerStage: 8,
  months: 6,
  weekdayLabel: 'Thứ Năm',
  weekday: 4,                     // thứ Năm (0=CN … 6=T7)
  startTime: '19:00',
  durationMinutes: 90,            // 19:00 → 20:30
  breaksAfter: [8, 16],           // nghỉ 2 tuần sau buổi 8 và 16 (không nghỉ sau buổi 24)
  timezone: 'Asia/Ho_Chi_Minh',
  // Ngày khai giảng dự kiến — chỉ dùng cho seed & dev fixture; landing page ĐỌC TỪ DB.
  proposedStartDate: '2026-09-17',
}

// Tiến trình mỗi buổi học
export const SOLO01_PROGRESSION = ['Kiến thức', 'Kỹ thuật', 'Melody', 'Bass / Hòa âm', 'Tác phẩm thực tế']

export interface SoloStage {
  no: number
  title: string
  goal: string
  works?: string[]                                   // tác phẩm mẫu (nếu có)
  note?: string                                      // ghi chú riêng của chặng
  /**
   * doc      = đường dẫn tài liệu học của buổi đó (nếu đã soạn), vd '/solo01/buoi-01'
   * unlockAt = mốc MỞ BÀI (ISO kèm múi giờ, vd '2026-09-17T20:00:00+07:00').
   *            Chưa tới giờ thì bài vẫn hiện trên chương trình nhưng đánh dấu khoá;
   *            tới giờ là tự mở, KHÔNG cần deploy lại. Bỏ trống = mở sẵn.
   */
  lessons: { title: string; points?: string[]; doc?: string; unlockAt?: string }[]    // 8 buổi
}

export const SOLO01_STAGES: SoloStage[] = [
  {
    no: 1,
    title: 'TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR',
    goal: 'Làm chủ melody cơ bản trên cần đàn và bắt đầu kết hợp Bass + kỹ thuật ngay từ những buổi đầu.',
    lessons: [
      { title: 'Bản đồ nốt giản lược C–Am', points: ['Bản đồ nốt trên cần đàn.', 'Chạy ngón liên thông.', 'Ứng dụng vào bài hát.', 'Bài mẫu: Diễm Xưa / Thành Phố Buồn.'], doc: '/solo01/buoi-01' },
      { title: 'Ép ngón tay phải & Bass đầu tiên', points: ['Ép ngón i–m.', 'Làm tiếng melody chắc, rõ.', 'Thêm Bass đơn giản vào giai điệu.'], doc: '/solo01/buoi-02', unlockAt: '2026-09-17T20:00:00+07:00' },
      { title: 'Melody + Bass và kỹ thuật Slide', points: ['Bass + melody luân phiên, phân vai p và i–m.', 'Slide làm câu melody liền tiếng.', 'Nâng chính tác phẩm cũ thành đoạn Solo sơ khai.'], doc: '/solo01/buoi-03', unlockAt: '2026-09-24T20:00:00+07:00' },
      { title: 'Xếp ngón giai điệu & nốt ngoài âm giai', points: ['Nhìn cả câu để chọn vị trí và ngón.', 'Ngón hôm nay chuẩn bị cho nốt tiếp theo.', 'Tay phải i – m – a cho giai điệu.', 'Nốt ♯/♭: dịch nửa cung từ nốt đã biết.'], doc: '/solo01/buoi-04', unlockAt: '2026-10-01T20:00:00+07:00' },
      { title: 'Bass theo hợp âm & Pull-off', points: ['Hợp âm nào → Bass nào.', 'Bass gốc.', 'Pull-off.'] },
      { title: 'Melody + Bass cùng lúc', points: ['Phối hợp ngón cái p với i–m.', 'Bắt đầu xử lý xếp ngón tay trái.', 'Kết hợp các kỹ thuật đã học.'] },
      { title: 'Bản đồ G–Em', points: ['Mở rộng sang giọng mới.', 'C–Am → G–Em.', 'Nhận diện F♯.', 'Melody + Bass + kỹ thuật.'] },
      { title: 'Hoàn thiện đoạn Solo Guitar đầu tiên', points: ['Melody.', 'Bass.', 'Hợp âm.', 'Kỹ thuật.', 'Hoàn thiện một đoạn Solo Guitar.'] },
    ],
  },
  {
    no: 2,
    title: 'PHÁT TRIỂN SOLO GUITAR & BOLERO',
    goal: 'Từ Melody + Bass phát triển thành một bản Solo Guitar đầy đặn và có phong cách.',
    works: ['Con đường xưa em đi', 'Giọt lệ đài trang'],
    lessons: [
      { title: 'Bass Bolero căn bản.' },
      { title: 'Từ hợp âm đến đường Bass.' },
      { title: 'Melody trong thế hợp âm.' },
      { title: 'Làm đầy khoảng trống giữa các câu.' },
      { title: 'Trang trí Melody', points: ['Slide', 'Hammer-on', 'Pull-off', 'Grace note', 'Nhấn / ngân.'] },
      { title: 'Melody + Bass + Hòa âm.' },
      { title: 'Intro – Fill – chuyển đoạn – Ending.' },
      { title: 'Hoàn thiện một bản Bolero Solo Guitar.' },
    ],
  },
  {
    no: 3,
    title: 'TỰ DỰNG BÀI SOLO GUITAR',
    goal: 'Mỗi học viên chọn một bài hát mình thực sự yêu thích và từng bước tự dựng tác phẩm đó.',
    note: 'Đây là chặng quan trọng nhất của khóa học.',
    lessons: [
      { title: 'Chọn bài & dựng bản đồ tác phẩm' },
      { title: 'Tìm và chép Melody' },
      { title: 'Đặt hợp âm & Bass' },
      { title: 'Xếp ngón & chọn thế đàn' },
      { title: 'Kỹ thuật & sắc thái' },
      { title: 'Intro – Fill – Ending' },
      { title: 'Xưởng biên tập Solo Guitar' },
      { title: 'Đồ án: Bài hát yêu thích của tôi', points: ['Học viên trình bày tác phẩm do chính mình dựng.'] },
    ],
  },
]

// Học phí — cùng khuôn thẻ giá của /hanhtrinh2027 (nguồn giá của riêng khoá SOLO-01).
export interface SoloPrice { name: string; priceVnd: number; unit: string; desc: string; highlight?: boolean }
export const SOLO01_PRICES: SoloPrice[] = [
  { name: 'Đóng từng tháng', priceVnd: 499000, unit: 'tháng', desc: 'Linh hoạt theo từng tháng — học đến đâu đóng đến đó.' },
  { name: 'Gói 6 tháng', priceVnd: 396000, unit: 'tháng', desc: 'Trọn 24 buổi / 3 chặng — mức học phí tối ưu cho cả khoá.', highlight: true },
]

// Đích đến cuối khoá — chuỗi phương pháp
export const SOLO01_METHOD = [
  'Nghe', 'Tìm Melody', 'Xác định hợp âm', 'Thêm Bass', 'Chọn thế đàn',
  'Thêm kỹ thuật', 'Ghi lại bản dựng', 'Biên tập',
]

// Cách ghi bản dựng — kỹ năng "bàn giấy"
export const SOLO01_NOTATION = ['Lời bài hát + hợp âm', 'Lời + tên nốt', 'TAB', 'Sheet nhạc', 'Sheet + TAB', 'Cách ghi chú riêng mà bản thân đọc lại được']

// Tiêu đề ngắn của buổi thứ n (1..24) — dùng cho seed class_sessions.title
export const solo01LessonTitle = (n: number): string => {
  const st = SOLO01_STAGES.find(s => s.no === Math.ceil(n / 8))
  if (!st) return `Buổi ${n}`
  return st.lessons[(n - 1) % 8].title.replace(/\.$/, '')
}

// ── Mở bài theo lịch ──
// Nguồn DUY NHẤT của mốc mở bài là SOLO01_STAGES ở trên; landing và trang tài liệu
// học cùng hỏi hàm này, không ai tự giữ ngày riêng.
export function soloLessonUnlock(sessionNo: number): string | null {
  const st = SOLO01_STAGES[Math.floor((sessionNo - 1) / SOLO01.sessionsPerStage)]
  const l = st?.lessons[(sessionNo - 1) % SOLO01.sessionsPerStage]
  return l?.unlockAt ?? null
}

/** Buổi học đã tới giờ mở chưa (dùng giờ máy của người xem). */
export function soloLessonOpen(sessionNo: number, now: Date = new Date()): boolean {
  const at = soloLessonUnlock(sessionNo)
  return !at || now.getTime() >= new Date(at).getTime()
}

/** 'Thứ Năm 17/09/2026 · 20:00' — nhãn giờ mở, luôn quy về giờ Việt Nam. */
export function soloUnlockLabel(iso: string): string {
  const d = new Date(iso)
  const tz = 'Asia/Ho_Chi_Minh'
  const wd = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const g = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const wdIndex = new Date(`${g('year')}-${g('month')}-${g('day')}T12:00:00+07:00`).getUTCDay()
  return `${wd[wdIndex]} ${g('day')}/${g('month')}/${g('year')} · ${g('hour')}:${g('minute')}`
}
