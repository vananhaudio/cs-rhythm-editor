// Nhãn HIỂN THỊ cho class_sessions.status. Chỉ đổi cách hiển thị; giá trị lưu/so sánh vẫn là mã gốc.
// Từ vựng khớp Ht2027ScheduleAdmin (nguồn: src/journey/sessions.ts). Mã lạ → hiện nguyên giá trị, không đoán.
const LABELS: Record<string, string> = {
  scheduled: 'Dự kiến',
  confirmed: 'Đã xác nhận',
  completed: 'Đã hoàn thành',
  rescheduled: 'Dời buổi',
  makeup: 'Buổi bù',
  cancelled: 'Đã huỷ',
  holiday: 'Nghỉ',
}
export const sessionStatusLabel = (status: string | null | undefined): string =>
  status ? (LABELS[status] ?? status) : ''
