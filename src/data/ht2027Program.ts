// ── HÀNH TRÌNH 2027 — 40 BUỔI THỰC HÀNH: GIÁO TRÌNH (nội dung tĩnh) ──
// Nội dung chương trình (chặng · buổi · mục tiêu · kết quả) — KHÔNG chứa NGÀY.
// Ngày học lấy từ class_sessions (nguồn lịch dùng chung), seed sinh title từ file này.
// File này là nguồn DUY NHẤT cho nội dung: seed script + landing page cùng import.

export const HT2027 = {
  programCode: 'HT2027',          // mã chương trình (class_schedule.program_code)
  classCode: 'HT2027.TH01',       // mã lớp dự kiến (theo bộ luật mã: năng lực.dạng lớp.số)
  name: 'Hành trình 2027 — 40 buổi thực hành',
  totalSessions: 40,
  stages: 5,
  sessionsPerStage: 8,
  breaksAfter: [8, 16, 24, 32],   // nghỉ 2 tuần sau các buổi này (không có nghỉ sau buổi 40)
  weekday: 4,                     // thứ Năm (0=CN … 6=T7)
  startTime: '20:30',             // giờ bắt đầu cố định
  durationMinutes: 90,            // 20:30 → 22:00
  timezone: 'Asia/Ho_Chi_Minh',   // múi giờ chuẩn hệ thống
  // Ngày khai giảng dự kiến — chỉ dùng cho seed & dev fixture; landing page ĐỌC TỪ DB.
  proposedStartDate: '2026-09-10',
}

// Tiến trình chung của chương trình
export const HT2027_PROGRESSION = ['Hòa âm', 'Giai điệu', 'Tiết tấu', 'Kết hợp đệm và tỉa', 'Hoàn thiện tác phẩm Solo Guitar']

// Đối tượng tham gia — nối vào MÃ NĂNG LỰC chuẩn (không kiểm tra theo tên khoá):
//   • học viên đã đăng ký Hành trình 2027  → edu_students.ht_member = true
//   • tốt nghiệp Đệm hát 2                 → mã DH2 (edu_course_access active)
//   • tốt nghiệp Tỉa nốt 2                 → mã TN2 (edu_course_access active)
export const HT2027_ELIGIBLE_CODES = ['DH2', 'TN2']

export interface HtLesson { title: string; points?: string[]; doc?: string; unlockAt?: string }

export interface HtStage {
  no: number
  title: string
  goal: string
  /**
   * 8 buổi — cùng khuôn SOLO01_STAGES:
   * doc      = đường dẫn giáo trình buổi đó (khi đã soạn), vd '/hanhtrinh2027/buoi-01'
   * unlockAt = mốc MỞ BÀI (ISO kèm múi giờ). Chưa tới giờ → hiện 🔒 kèm giờ mở,
   *            tới giờ tự mở, KHÔNG cần deploy lại. Bỏ trống = mở sẵn.
   */
  lessons: HtLesson[]
  results: string[]          // kết quả cuối chặng
}

export const HT2027_STAGES: HtStage[] = [
  {
    no: 1,
    title: 'Làm chủ bộ hợp âm, vòng hòa âm và màu sắc hòa âm',
    goal: 'Chuyển từ việc đánh lại hợp âm có sẵn sang hiểu và chủ động lựa chọn hòa âm cho bài hát.',
    lessons: [
      { title: 'Xây dựng bộ hợp âm trong một giọng', doc: '/hanhtrinh2027/buoi-01' },
      { title: 'Chức năng của hợp âm', doc: '/hanhtrinh2027/buoi-02' },
      { title: 'Phân tích vòng hòa âm', doc: '/hanhtrinh2027/buoi-03' },
      { title: 'Dịch chuyển vòng hòa âm' },
      { title: 'Thay thế hợp âm' },
      { title: 'Hợp âm đảo và đường bass' },
      { title: 'Phối lại hòa âm cho bài hát' },
      { title: 'Trình bày sản phẩm cuối chặng' },
    ],
    results: [
      'Xây dựng được bộ hợp âm của một giọng',
      'Hiểu chức năng của từng hợp âm',
      'Nhận diện và dịch chuyển vòng hòa âm',
      'Sử dụng hợp âm thay thế và hợp âm đảo',
      'Chủ động xây dựng phương án hòa âm cho bài hát',
    ],
  },
  {
    no: 2,
    title: 'Làm chủ khuôn hình và phát triển giai điệu trên cần đàn',
    goal: 'Nhìn thấy mối quan hệ giữa âm chủ, khuôn hình và giai điệu; không phụ thuộc hoàn toàn vào tab hoặc một vị trí cố định.',
    lessons: [
      { title: 'Âm chủ và cấu trúc khuôn hình' },
      { title: 'Khuôn hình trong giọng trưởng' },
      { title: 'Khuôn hình trong giọng thứ' },
      { title: 'Kết nối các khuôn hình' },
      { title: 'Xây dựng câu nhạc' },
      { title: 'Tìm giai điệu bằng tai' },
      { title: 'Biến đổi và phát triển giai điệu' },
      { title: 'Trình bày sản phẩm cuối chặng' },
    ],
    results: [
      'Nhận diện âm chủ và cấu trúc khuôn hình trên cần đàn',
      'Chơi giai điệu ở nhiều vị trí, kết nối được các khuôn hình',
      'Tự tìm giai điệu bằng tai',
      'Biến đổi và phát triển giai điệu thành câu nhạc có hồn',
    ],
  },
  {
    no: 3,
    title: 'Làm chủ điệu đệm, tiết tấu và cách phát triển bài hát',
    goal: 'Thoát khỏi cách sử dụng một mẫu đệm từ đầu đến cuối; biết điều khiển tiết tấu, sắc thái và cao trào theo cấu trúc bài hát.',
    lessons: [
      { title: 'Phân tích tiết tấu của bài hát' },
      { title: 'Biến đổi mẫu đệm' },
      { title: 'Nhấn phách và đảo phách' },
      { title: 'Dồn nhịp và chuyển câu' },
      { title: 'Ngắt tiếng và kiểm soát âm thanh' },
      { title: 'Xây dựng sắc thái và cao trào' },
      { title: 'Kết hợp nhiều phương pháp đệm' },
      { title: 'Trình bày sản phẩm cuối chặng' },
    ],
    results: [
      'Phân tích được tiết tấu của bài hát',
      'Biến đổi và kết hợp linh hoạt các mẫu đệm',
      'Điều khiển nhấn phách, đảo phách, dồn nhịp',
      'Xây dựng sắc thái và cao trào theo cấu trúc bài hát',
    ],
  },
  {
    no: 4,
    title: 'Solo Guitar: Kết hợp giai điệu, bass và hòa âm',
    goal: 'Solo Guitar là sự kết hợp giữa năng lực Đệm hát và Tỉa nốt — làm chủ ba lớp âm thanh trên cây đàn.',
    lessons: [
      { title: 'Phân tích ba lớp âm thanh' },
      { title: 'Đặt hợp âm dưới giai điệu' },
      { title: 'Làm nổi bật giai điệu' },
      { title: 'Xây dựng đường bass' },
      { title: 'Kết hợp giai điệu, bass và hợp âm' },
      { title: 'Kỹ thuật tay phải trong Solo Guitar' },
      { title: 'Nối câu và chuyển vị trí' },
      { title: 'Trình bày sản phẩm cuối chặng' },
    ],
    results: [
      'Phân tích được ba lớp âm thanh: giai điệu, bass, hòa âm',
      'Đặt hợp âm và đường bass dưới giai điệu',
      'Kết hợp ba lớp âm thanh thành bản Solo Guitar',
      'Kiểm soát kỹ thuật tay phải, nối câu và chuyển vị trí mượt mà',
    ],
  },
  {
    no: 5,
    title: 'Solo Guitar: Xây dựng và hoàn thiện tác phẩm',
    goal: 'Đi từ một bản nhạc hoặc giai điệu có sẵn đến một tác phẩm Solo Guitar hoàn chỉnh, có bố cục, sắc thái và khả năng biểu diễn.',
    lessons: [
      { title: 'Phân tích và lựa chọn tác phẩm' },
      { title: 'Xây dựng phần mở đầu' },
      { title: 'Phát triển và trang trí giai điệu' },
      { title: 'Phát triển hòa âm và đường bass' },
      { title: 'Xử lý điệp khúc và cao trào' },
      { title: 'Xây dựng phần kết' },
      { title: 'Chỉnh sửa và hoàn thiện phần trình diễn' },
      { title: 'Biểu diễn tổng kết Hành trình 2027' },
    ],
    results: [
      'Lựa chọn và phân tích được tác phẩm phù hợp',
      'Xây dựng đủ bố cục: mở đầu, phát triển, điệp khúc, cao trào, kết',
      'Hoàn thiện một tác phẩm Solo Guitar có thể biểu diễn',
      'Trình diễn tổng kết trước lớp — chốt lại toàn bộ hành trình',
    ],
  },
]

// Tiêu đề buổi theo số thứ tự toàn chương trình (1..40) — dùng cho seed class_sessions.title
export const ht2027LessonTitle = (n: number): string => {
  const st = HT2027_STAGES.find(s => s.no === Math.ceil(n / 8))
  if (!st) return `Buổi ${n}`
  return st.lessons[(n - 1) % 8].title
}

// ── Mở bài theo lịch — nguồn DUY NHẤT là HT2027_STAGES (landing + trang giáo trình cùng hỏi) ──
const htLesson = (n: number): HtLesson | undefined =>
  HT2027_STAGES[Math.floor((n - 1) / HT2027.sessionsPerStage)]?.lessons[(n - 1) % HT2027.sessionsPerStage]

export const ht2027LessonUnlock = (n: number): string | null => htLesson(n)?.unlockAt ?? null

export function ht2027LessonOpen(n: number, now: Date = new Date()): boolean {
  const at = ht2027LessonUnlock(n)
  return !at || now.getTime() >= new Date(at).getTime()
}
