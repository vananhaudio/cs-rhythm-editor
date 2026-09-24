// Định dạng hiển thị dùng trong Class Social (hàm thuần).

/** "tháng 9/2026" — dùng cho "Tham gia …". */
export function monthYear(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `tháng ${d.getMonth() + 1}/${d.getFullYear()}`
}

// Cùng nhãn với StudentOnboarding/StudentProfile; mức lạ → không hiển thị (không đoán)
const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Mới bắt đầu',
  elementary: 'Cơ bản',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
}
export function levelLabel(level: string | null): string | null {
  return level ? LEVEL_LABEL[level] ?? null : null
}
