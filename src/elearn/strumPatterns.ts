// ── THƯ VIỆN CHÙM TIẾT TẤU (kiểu quạt) cho Strum Score ────────────────────────
// Mỗi "kiểu quạt" = pattern: mỗi PHÁCH là một CHÙM gồm các cú quạt chia đều.
// Cú quạt: 'D' = xuống (↓), 'U' = lên (↑). (Dấu nghỉ trong phách để bản sau.)
export type Stroke = 'D' | 'U'
export type BeatGroup = Stroke[]          // số phần tử = số nốt trong phách: 1=đen, 2=chùm2, 3=liên ba, 4=móc kép
export interface StrumPattern {
  id: string
  name: string
  beatsPerBar: 2 | 3 | 4
  beats: BeatGroup[]                       // độ dài = beatsPerBar
  note?: string                            // mô tả ngắn (hiển thị khi chọn)
}

const rep = (g: BeatGroup, n: number): BeatGroup[] => Array.from({ length: n }, () => [...g])

export const STRUM_PATTERNS: StrumPattern[] = [
  // ── Nhịp 4/4 ──
  { id: 'den',      name: 'Nốt đen',        beatsPerBar: 4, beats: rep(['D'], 4),               note: 'Mỗi phách 1 cú xuống — giữ phách (Trình độ 1)' },
  { id: 'chum2',    name: 'Chùm 2',         beatsPerBar: 4, beats: rep(['D', 'U'], 4),          note: 'Mỗi phách xuống–lên (móc đơn) — tạo dòng chảy' },
  { id: 'lien3',    name: 'Liên ba (chùm 3)', beatsPerBar: 4, beats: rep(['D', 'U', 'D'], 4),   note: '3 cú/phách — nền của Slow Rock, Boléro' },
  { id: 'mockep',   name: 'Móc kép (chùm 4)', beatsPerBar: 4, beats: rep(['D', 'U', 'D', 'U'], 4), note: '4 cú/phách — dày, sôi động' },
  // ── Nhịp 3/4 ──
  { id: 'den3',     name: 'Nốt đen — 3/4',  beatsPerBar: 3, beats: rep(['D'], 3),               note: 'Valse cơ bản: mỗi phách 1 xuống' },
  { id: 'chum2-3',  name: 'Chùm 2 — 3/4',   beatsPerBar: 3, beats: rep(['D', 'U'], 3),          note: 'Xuống–lên trong nhịp 3/4' },
  { id: 'lien3-3',  name: 'Liên ba — 3/4',  beatsPerBar: 3, beats: rep(['D', 'U', 'D'], 3),     note: '3 cú/phách trong nhịp 3/4' },
  // ── Nhịp 2/4 ──
  { id: 'den2',     name: 'Nốt đen — 2/4',  beatsPerBar: 2, beats: rep(['D'], 2),               note: 'Polka/Hành khúc: mỗi phách 1 xuống' },
  { id: 'chum2-2',  name: 'Chùm 2 — 2/4',   beatsPerBar: 2, beats: rep(['D', 'U'], 2),          note: 'Xuống–lên trong nhịp 2/4' },
]

export const getPattern = (id?: string | null): StrumPattern | undefined =>
  id ? STRUM_PATTERNS.find((p) => p.id === id) : undefined

// Suy ra pattern cho 1 bài: ưu tiên patternId; không thì từ cờ eighths cũ (chùm 2 / nốt đen).
export function resolvePattern(timeSignature: number, eighths: boolean, patternId?: string | null): StrumPattern {
  const p = getPattern(patternId)
  if (p) return p
  const g: BeatGroup = eighths ? ['D', 'U'] : ['D']
  return { id: eighths ? 'chum2' : 'den', name: '', beatsPerBar: timeSignature as 2 | 3 | 4, beats: Array.from({ length: timeSignature }, () => [...g]) }
}
