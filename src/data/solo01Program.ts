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
  startTime: '19:00',
  durationMinutes: 90,
  timezone: 'Asia/Ho_Chi_Minh',
}

// Tiến trình mỗi buổi học
export const SOLO01_PROGRESSION = ['Kiến thức', 'Kỹ thuật', 'Melody', 'Bass / Hòa âm', 'Tác phẩm thực tế']

export interface SoloStage {
  no: number
  title: string
  goal: string
  works?: string[]                                   // tác phẩm mẫu (nếu có)
  note?: string                                      // ghi chú riêng của chặng
  lessons: { title: string; points?: string[] }[]    // 8 buổi
}

export const SOLO01_STAGES: SoloStage[] = [
  {
    no: 1,
    title: 'TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR',
    goal: 'Làm chủ melody cơ bản trên cần đàn và bắt đầu kết hợp Bass + kỹ thuật ngay từ những buổi đầu.',
    lessons: [
      { title: 'Bản đồ nốt giản lược C–Am', points: ['Bản đồ nốt trên cần đàn.', 'Chạy ngón liên thông.', 'Ứng dụng vào bài hát.', 'Bài mẫu: Diễm xưa / Thành phố buồn.'] },
      { title: 'Ép ngón tay phải & Bass đầu tiên', points: ['Ép ngón i–m.', 'Làm tiếng melody chắc, rõ.', 'Thêm Bass đơn giản vào giai điệu.'] },
      { title: 'Cao độ – quãng tám & Slide', points: ['Đúng tên nốt chưa đủ, phải đúng cao độ.', 'Làm quen Slide.', 'Ứng dụng trực tiếp vào câu nhạc.'] },
      { title: 'Nốt ♯/♭ & Hammer-on', points: ['Nhận diện nốt ngoài âm giai.', 'Hammer-on.', 'Melody + Bass.'] },
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
