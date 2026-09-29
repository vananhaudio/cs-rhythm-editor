// ── Thư viện âm hình đệm hát ──
// Mỗi âm hình định nghĩa MỘT lần ở đây; các điệu tham chiếu bằng id.
// Ký hiệu + trường độ do Owner đưa (26–28/09/2026) — không sửa khi chưa có Owner.
// Ký âm = StrumScore events (FigureStroke): mỗi phách một mảng event, tổng frac mỗi phách = 1.
//   frac: 1 = đen · .5 = móc đơn · .25 = móc kép · 1/3 = một nốt liên ba.
// Không ghi `dir` (hướng quạt) khi Owner chưa đưa quy ước — trừ `x` = đánh xuống nhẹ (Owner định nghĩa).
import type { FigureStroke, StrokeAct } from '../../elearn/strumPatterns.ts'
import type { Pattern, StrumNotation } from './types.ts'

const p = (x: Pattern) => x

// Event: trường độ (frac trong phách) + nhãn + hành động.
const ev = (frac: number, label: string, act: StrokeAct, extra: Partial<FigureStroke> = {}): FigureStroke =>
  ({ frac, label, act, ...extra })

// Nhãn guitar → hành động. Chỉ các nhãn Owner đã định nghĩa.
const ACT: Record<string, StrokeAct> = { B: 'bass', C: 'chord', x: 'strum', Chát: 'chat', Bùm: 'bum' }
const act = (label: string): StrokeAct => ACT[label] ?? 'pick'          // số dây / (21) = móc dây
const lab = (frac: number, label: string) => ev(frac, label, act(label), label === 'x' ? { dir: 'D' } : {})

/** Ô 4/4 từ nhãn theo phách: 'B 3 | (21) 3 | …' — mỗi phách chia đều theo số nhãn. */
const even = (bar: string): StrumNotation => {
  const beats = bar.split('|').map((b) => b.trim().split(/\s+/)).map((ls) => ls.map((l) => lab(1 / ls.length, l)))
  return { beatsPerBar: beats.length as 2 | 3 | 4, beats }
}

// Khung trường độ chung của hai kiểu móc Bolero: phách 1 = đơn + kép + kép, các phách sau = đơn + đơn.
const boleroBar = (labels: string[]): StrumNotation => ({
  beatsPerBar: 4,
  beats: [
    [lab(.5, labels[0]), lab(.25, labels[1]), lab(.25, labels[2])],
    [lab(.5, labels[3]), lab(.5, labels[4])],
    [lab(.5, labels[5]), lab(.5, labels[6])],
    [lab(.5, labels[7]), lab(.5, labels[8])],
  ],
})

// Quạt Ballad (mẫu 2 phách: ĐEN | ĐƠN – KÉP – KÉP) lặp 2 lần cho đủ ô 4/4. Chưa có hướng quạt → không nhãn.
const quatBallad = (accentFirst: boolean): StrumNotation => {
  const half = [
    [ev(1, '', 'strum', accentFirst ? { accent: true } : {})],
    [ev(.5, '', 'strum'), ev(.25, '', 'strum'), ev(.25, '', 'strum')],
  ]
  return { beatsPerBar: 4, beats: [...half, ...half] }
}

export const PATTERNS: Record<string, Pattern> = {
  // ── Ballad (BẢN NHÁP — Owner sẽ sửa nội dung quạt; không dùng làm chuẩn) ──
  'ballad-moc-chum-2': p({
    id: 'ballad-moc-chum-2',
    name: 'Móc Chùm 2',
    strum: even('B 3 | (21) 3 | B 3 | (21) 3'),
    guitar: 'B – 3 – (21) – 3',
    legend: 'B = Bass · 3 = dây 3 · (21) = móc dây 2 và dây 1 cùng lúc',
    length: 'Mẫu dài 2 phách, đàn 2 lần là đủ một ô nhịp.',
    howTo: 'Mỗi phách chia 2: mỗi phách móc 2 lần đều nhau.',
  }),
  'ballad-moc-chum-4': p({
    id: 'ballad-moc-chum-4',
    name: 'Móc Chùm 4',
    strum: even('B 3 2 3 | 1 3 2 3 | B 3 2 3 | 1 3 2 3'),
    guitar: 'B3231323',
    legend: 'B = Bass · các số = dây',
    length: 'Mẫu dài 2 phách, đàn 2 lần là đủ một ô nhịp.',
    howTo: 'Mỗi phách chia 4: mỗi phách móc 4 lần đều nhau.',
  }),
  'quat-ballad-1': p({
    id: 'quat-ballad-1',
    name: 'Quạt Ballad 1',
    family: 'Quạt Ballad',
    strum: quatBallad(false),
    guitar: 'ĐEN | MÓC ĐƠN – MÓC KÉP – MÓC KÉP',
    legend: 'Đếm: 1 | 2 và',
    length: 'Mẫu dài 2 phách, đàn 2 lần là đủ một ô nhịp.',
    howTo: 'Phách 1 quạt một tiếng dài; phách 2 quạt ba tiếng: một móc đơn rồi hai móc kép nhanh.',
  }),
  'quat-ballad-2': p({
    id: 'quat-ballad-2',
    name: 'Quạt Ballad 2',
    family: 'Quạt Ballad',
    strum: quatBallad(true),
    guitar: 'ĐEN | MÓC ĐƠN – MÓC KÉP – MÓC KÉP',
    legend: 'Dấu > = quạt mạnh (rasgueado)',
    length: 'Mẫu dài 2 phách, đàn 2 lần là đủ một ô nhịp.',
    howTo: 'Cùng tiết tấu với Quạt Ballad 1; tiếng đầu của mẫu là quạt mạnh (rasgueado).',
  }),

  // ── Bolero ──
  'bolero-moc-1': p({
    id: 'bolero-moc-1',
    name: 'Bolero Móc Kiểu 1',
    strum: boleroBar(['B', '3', '2', '1', '2', '3', '1', '2', '3']),
    guitar: 'B 32 | 1 2 | 3 1 | 2 3',
    legend: 'Viết gọn: B32123123 · B = Bass · các số = dây',
    durations: 'Đơn – Kép – Kép – Đơn – Đơn – Đơn – Đơn – Đơn – Đơn',
    length: 'Đủ một ô nhịp.',
    howTo: 'Phách 1: Bass rồi móc 3–2 thật gọn — hai móc kép 3–2 cộng lại bằng một móc đơn.',
  }),
  'bolero-moc-2': p({
    id: 'bolero-moc-2',
    name: 'Bolero Móc Kiểu 2',
    // Chát / Bùm là EVENT móc đơn, cùng khung trường độ với Kiểu 1.
    strum: boleroBar(['B', '3', '2', '1', 'Chát', 'Bùm', 'Chát', 'Bùm', 'Chát']),
    guitar: 'B 32 | 1 Chát | Bùm Chát | Bùm Chát',
    legend: 'Viết gọn: B321 – Chát – Bùm – Chát – Bùm – Chát',
    durations: 'Đơn – Kép – Kép – Đơn – Đơn – Đơn – Đơn – Đơn – Đơn',
    length: 'Đủ một ô nhịp.',
    howTo: 'Giữ nguyên nhịp của Kiểu 1; từ nửa sau phách 2, thay tiếng móc bằng Chát – Bùm – Chát – Bùm – Chát.',
  }),
  // Owner: điệp khúc Bolero dùng một mẫu thuộc họ Quạt Ballad (không có "Quạt Bolero").
  // CHƯA có trường độ, CHƯA định nghĩa I/X/x → không ký âm (xem bolero.ts editorial).
  'quat-ballad-bolero-mini': p({
    id: 'quat-ballad-bolero-mini',
    name: 'Quạt Ballad',
    family: 'Quạt Ballad',
    guitar: 'Bùm – Chát – I – X – I – x – Chát',
    tempo: '♩ = 65',
    howTo: 'Đây là mẫu quạt thầy dạy ở buổi “Đệm cho điệp khúc” (lớp Bolero Mini).',
  }),

  // ── Slow Rock ──
  'slowrock-1': p({
    id: 'slowrock-1',
    name: 'Slow Rock Kiểu 1 — Móc nhẹ',
    strum: even('B 3 2 | 1 2 3 | B 3 2 | 1 2 3'),
    guitar: 'B-3-2 | 1-2-3 | B-3-2 | 1-2-3',
    legend: 'B = Bass · các số = dây',
    length: 'Mẫu B – 3 – 2 – 1 – 2 – 3 dài 2 phách, đàn 2 lần là đủ một ô nhịp.',
    howTo: 'Mỗi phách móc 3 tiếng đều nhau.',
  }),
  'slowrock-2': p({
    id: 'slowrock-2',
    name: 'Slow Rock Kiểu 2 — Quạt nhẹ',
    strum: even('B x x | C x x | B x x | C x x'),
    guitar: 'B x x | C x x | B x x | C x x',
    legend: 'B = Bass · C = hợp âm · x = đánh xuống nhẹ',
    length: 'Mẫu B x x | C x x dài 2 phách, đàn 2 lần là đủ một ô nhịp.',
    howTo: 'Mỗi phách 3 tiếng đều nhau; tiếng đầu phách là Bass hoặc hợp âm, hai tiếng sau đánh xuống nhẹ.',
  }),
  'slowrock-3': p({
    id: 'slowrock-3',
    name: 'Slow Rock Kiểu 3 — Quạt pha Blues',
    strum: even('B x B | C x B | B x B | C x x'),
    guitar: 'B x B | C x B | B x B | C x x',
    legend: 'B = Bass · C = hợp âm · x = đánh xuống nhẹ',
    length: 'Cả mẫu dài đúng một ô nhịp.',
    howTo: 'Mỗi phách 3 tiếng đều nhau, đàn đúng thứ tự Bass / hợp âm / x như ký hiệu.',
  }),
}
