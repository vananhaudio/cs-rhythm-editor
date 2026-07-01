// ── BỘ LUẬT HÀNH TRÌNH 2027 — mã hoá phần CỐ ĐỊNH (xem docs/HANHTRINH-2027-BO-LUAT.md) ──
// Quản lý theo MÃ NĂNG LỰC. Từ mã suy ra: dạng lớp, nhánh, tiên quyết, mã lớp.

// Mã năng lực → mã dạng lớp (mục 8). Chưa cần mã lớp: NM, NL*, DHNC, SOLO.
export const DANG_LOP: Record<string, string> = {
  DH1: 'KD', DH2: 'KD', DH3: 'BP',
  TN1: 'GL', TN2: 'GL', TN3: 'GL',
}

// Tên năng lực đầy đủ (mục 9) — hiển thị rõ cấp độ
export const TEN_NANG_LUC: Record<string, string> = {
  NM: 'Nhập môn',
  DH1: 'Đệm hát 1', DH2: 'Đệm hát 2', DH3: 'Đệm hát 3', DHNC: 'Đệm hát nâng cao',
  TN1: 'Tỉa nốt 1', TN2: 'Tỉa nốt 2', TN3: 'Tỉa nốt 3',
  NL1: 'Nhạc lý 1', NL2: 'Nhạc lý 2', NL3: 'Nhạc lý 3',
  SOLO: 'Solo Guitar',
}
export const tenNangLuc = (code?: string | null): string | null =>
  code ? (TEN_NANG_LUC[code.trim().toUpperCase()] ?? null) : null

// Nhánh (mục 2)
export const BRANCH: Record<string, string> = {
  NM: 'Nhập môn',
  DH1: 'Đệm hát', DH2: 'Đệm hát', DH3: 'Đệm hát', DHNC: 'Đệm hát',
  TN1: 'Tỉa nốt', TN2: 'Tỉa nốt', TN3: 'Tỉa nốt',
  NL1: 'Nhạc lý', NL2: 'Nhạc lý', NL3: 'Nhạc lý',
  SOLO: 'Solo',
}

// Tiên quyết mở khoá — hoàn thành các mã này mới mở (mục 4). NL2 chưa có nội dung (thầy tạm bỏ).
export const PREREQ: Record<string, string[]> = {
  DH1: ['NM'], TN1: ['NM'], NL1: ['NM'],
  DH2: ['DH1', 'NL1'], DH3: ['DH2', 'NL2'],
  TN2: ['TN1', 'NL1'], TN3: ['TN2', 'NL2'],
  NL2: ['NL1'], NL3: ['NL2'],
  DHNC: ['DH1', 'DH2', 'DH3', 'TN1', 'TN2', 'TN3', 'NL1', 'NL2'],
  SOLO: ['DHNC'],
}

export const dangLop = (code?: string | null): string | null =>
  code ? (DANG_LOP[code.trim().toUpperCase()] ?? null) : null

// Ghép MÃ LỚP: mã năng lực + dạng lớp + số 2 chữ số → 'DH2.KD16'. Trả null nếu năng lực không có dạng lớp.
export const buildClassCode = (nangLuc?: string | null, so?: number | string): string | null => {
  const nl = (nangLuc || '').trim().toUpperCase()
  const dl = DANG_LOP[nl]
  if (!dl || so === undefined || so === '' || so === null) return null
  const n = String(so).replace(/\D/g, '')
  if (!n) return null
  return `${nl}.${dl}${n.padStart(2, '0')}`
}

// Tách số khoá từ mã lớp: 'DH2.KD16' → '16'
export const soFromClassCode = (code?: string | null): string => {
  const m = (code || '').match(/(\d+)\s*$/)
  return m ? m[1] : ''
}
