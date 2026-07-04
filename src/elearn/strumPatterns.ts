// ── THƯ VIỆN HÌNH TIẾT TẤU & KIỂU QUẠT cho Strum Score ────────────────────────
// Hình tiết tấu (RhythmFigure) = mẫu quạt trong ĐÚNG 1 PHÁCH — viên gạch nền tảng.
// Mỗi cú quạt mang tỉ lệ trường độ riêng (frac, cộng lại trong 1 hình = 1) → biểu diễn được
// cả hình CHIA ĐỀU (chùm 2, liên ba, móc kép) lẫn hình CHIA LỆCH (đơn kép kép: 2:1:1).
// Kiểu quạt (StrumPattern) = 1 hình tiết tấu lặp lại cho CẢ Ô NHỊP — nền tảng để sau này
// Fill In/Fill Out/Transition trộn nhiều hình khác nhau trong cùng 1 ô (CHƯA làm ở bước này).
export type Stroke = 'D' | 'U'
export interface FigureStroke { dir: Stroke; frac: number }   // frac = tỉ lệ trường độ trong phách
export type BeatGroup = FigureStroke[]

export interface RhythmFigure {
  id: string
  name: string
  strokes: FigureStroke[]
  note?: string
}

// Bộ tiết tấu cơ bản (hướng quạt do thầy chốt 2026-07-04) — sẽ bổ sung thêm hình sau.
export const RHYTHM_FIGURES: RhythmFigure[] = [
  { id: 'den', name: 'Đen', strokes: [{ dir: 'D', frac: 1 }],
    note: 'Mỗi phách 1 cú xuống — giữ phách (Trình độ 1)' },
  { id: 'chum2', name: 'Chùm 2', strokes: [{ dir: 'D', frac: .5 }, { dir: 'U', frac: .5 }],
    note: 'Móc đơn đều: xuống–lên — tạo dòng chảy' },
  { id: 'donkepkep', name: 'Chùm 3 — Đơn kép kép', strokes: [{ dir: 'D', frac: .5 }, { dir: 'D', frac: .25 }, { dir: 'U', frac: .25 }],
    note: '1 móc đơn + 2 móc kép (tỉ lệ 2:1:1): xuống–xuống–lên' },
  { id: 'lien3', name: 'Chùm 3 — Liên ba', strokes: [{ dir: 'D', frac: 1 / 3 }, { dir: 'D', frac: 1 / 3 }, { dir: 'D', frac: 1 / 3 }],
    note: '3 cú đều nhau: xuống–xuống–xuống — nền Slow Rock, Boléro' },
  { id: 'mockep', name: 'Chùm 4 — Móc kép', strokes: [{ dir: 'D', frac: .25 }, { dir: 'U', frac: .25 }, { dir: 'D', frac: .25 }, { dir: 'U', frac: .25 }],
    note: '4 cú đều nhau: xuống–lên–xuống–lên — dày, sôi động' },
]

export const getFigure = (id?: string | null): RhythmFigure | undefined =>
  id ? RHYTHM_FIGURES.find((f) => f.id === id) : undefined

const FIG = Object.fromEntries(RHYTHM_FIGURES.map((f) => [f.id, f])) as Record<string, RhythmFigure>

export interface StrumPattern {
  id: string
  name: string
  beatsPerBar: 2 | 3 | 4
  beats: BeatGroup[]                       // độ dài = beatsPerBar (hiện lặp CÙNG 1 hình cho cả ô)
  note?: string
}

const rep = (fig: RhythmFigure, n: number): BeatGroup[] => Array.from({ length: n }, () => fig.strokes)

export const STRUM_PATTERNS: StrumPattern[] = [
  // ── Nhịp 4/4 ──
  { id: 'den',       name: 'Nốt đen',              beatsPerBar: 4, beats: rep(FIG.den, 4),       note: FIG.den.note },
  { id: 'chum2',     name: 'Chùm 2',               beatsPerBar: 4, beats: rep(FIG.chum2, 4),      note: FIG.chum2.note },
  { id: 'donkepkep', name: 'Chùm 3 (đơn kép kép)', beatsPerBar: 4, beats: rep(FIG.donkepkep, 4),  note: FIG.donkepkep.note },
  { id: 'lien3',     name: 'Liên ba (chùm 3)',     beatsPerBar: 4, beats: rep(FIG.lien3, 4),      note: FIG.lien3.note },
  { id: 'mockep',    name: 'Móc kép (chùm 4)',     beatsPerBar: 4, beats: rep(FIG.mockep, 4),     note: FIG.mockep.note },
  // ── Nhịp 3/4 ──
  { id: 'den3',      name: 'Nốt đen — 3/4',        beatsPerBar: 3, beats: rep(FIG.den, 3),        note: 'Valse cơ bản: mỗi phách 1 xuống' },
  { id: 'chum2-3',   name: 'Chùm 2 — 3/4',         beatsPerBar: 3, beats: rep(FIG.chum2, 3),       note: 'Xuống–lên trong nhịp 3/4' },
  { id: 'lien3-3',   name: 'Liên ba — 3/4',        beatsPerBar: 3, beats: rep(FIG.lien3, 3),       note: '3 cú/phách trong nhịp 3/4' },
  // ── Nhịp 2/4 ──
  { id: 'den2',      name: 'Nốt đen — 2/4',        beatsPerBar: 2, beats: rep(FIG.den, 2),        note: 'Polka/Hành khúc: mỗi phách 1 xuống' },
  { id: 'chum2-2',   name: 'Chùm 2 — 2/4',         beatsPerBar: 2, beats: rep(FIG.chum2, 2),       note: 'Xuống–lên trong nhịp 2/4' },
]

export const getPattern = (id?: string | null): StrumPattern | undefined =>
  id ? STRUM_PATTERNS.find((p) => p.id === id) : undefined

// Suy ra pattern cho 1 bài: ưu tiên patternId; không thì từ cờ eighths cũ (chùm 2 / nốt đen).
export function resolvePattern(timeSignature: number, eighths: boolean, patternId?: string | null): StrumPattern {
  const p = getPattern(patternId)
  if (p) return p
  const fig = eighths ? FIG.chum2 : FIG.den
  return { id: eighths ? 'chum2' : 'den', name: '', beatsPerBar: timeSignature as 2 | 3 | 4, beats: rep(fig, timeSignature) }
}
