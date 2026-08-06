// ── LUẬT SINH BÀI TẬP PIANO — thầy sửa ở file này, không đụng chỗ khác ────────
//
// ⚠️ ĐÂY LÀ BỘ LUẬT DEMO. Thầy Văn Anh sẽ thay bằng giáo trình thật.
// Suy từ PROJECT_CONTEXT.md + quy ước Faber/Alfred trong PEDAGOGY.md.
// Chưa qua kiểm định sư phạm.
//
// Kiến trúc: luật ở đây → gửi kèm khi gọi AI → AI sinh → hàm kiểm bên dưới soi
// và SỬA. Nhờ lớp kiểm mà bé không bao giờ nhận bài vượt bậc, kể cả khi AI ẩu.
// Vì luật nằm trong repo (không nằm trong prompt của edge function) nên sửa luật
// KHÔNG cần deploy lại `piano-generate`.
//
// ── THUẬT NGỮ — đọc trước khi sửa, hai chữ này TỪNG BỊ DÙNG LẪN ─────────────
//   BẬC  = level = ĐỘ KHÓ của bản nhạc (bậc 1 dễ nhất → bậc 10 khó nhất).
//   BƯỚC = khoảng cách giữa hai nốt liền nhau, đếm theo vị trí trong `pitches`.
//          1 bước = nốt liền kề (quãng hai) · 2 bước = quãng ba · 3 bước = quãng bốn.
//   Đừng dùng chữ "bậc" cho khoảng cách nốt.
//
// ĐƠN VỊ LÀ Ô NHỊP, KHÔNG PHẢI SỐ NỐT. Có vạch nhịp thì bài buộc phải đủ ô —
// tổng trường độ phải bằng đúng bars × beatsPerBar, không thừa không thiếu.

export interface PianoNote { pitch: string; startBeat: number; duration: number }
export interface Exercise {
  title: string
  bpm: number
  notes: PianoNote[]
  /** Số phách mỗi ô nhịp — NoteSheet dùng để kẻ vạch nhịp + số chỉ nhịp */
  beatsPerBar?: number
}

export interface PianoLevel {
  id: number
  name: string
  /** 'exercise' = bài tập kế thừa từng nốt, chưa thành tác phẩm.
   *  'piece'    = bản nhạc có câu có kết. */
  kind: 'exercise' | 'piece'
  /** Nốt được phép, xếp THẤP → CAO. Quãng nhảy đếm theo vị trí trong mảng này. */
  pitches: string[]
  /** Trường độ được phép: 0.5 móc đơn · 1 đen · 1.5 đen chấm dôi · 2 trắng ·
   *  3 trắng chấm · 4 tròn.
   *  ⚠️ 1.5 CHỈ được mở ở bậc đã có 0.5. Nốt 1.5 đặt ở đầu phách thì nốt sau rơi
   *  vào nửa phách, mà luật nửa phách chỉ cho phép móc đơn — không có 0.5 trong
   *  bậc thì bài kẹt giữa chừng, không lấp đủ ô nhịp. Đổi lại, ở bậc có cả hai
   *  thì luật đó TỰ SINH RA mẫu ♩. + ♪ mà thầy muốn, không cần luật riêng. */
  durations: number[]
  /** Số phách mỗi ô nhịp (4 = nhịp 4/4, 3 = nhịp 3/4) */
  beatsPerBar: number
  /** Số ô nhịp của bài */
  bars: number
  /** Số BƯỚC nhảy tối đa giữa 2 nốt liền nhau. 1 = chỉ đi liền kề (quãng hai),
   *  2 = được nhảy quãng ba, 3 = quãng bốn… Đếm theo vị trí trong `pitches`. */
  maxStep: number
  bpm: [number, number]
  /** Kết bài ở nốt chủ (nốt đầu tiên của `pitches`) */
  endOnTonic: boolean
  /** Nốt được phép rơi vào PHÁCH MẠNH (phách 1 mỗi ô). Bỏ trống = không ràng buộc.
   *  Đây là luật "phách mạnh phải là C hoặc E" của Ex.2 trở đi. */
  strongBeatPitches?: string[]
  /** Nốt áp chót phải LIỀN KỀ nốt kết — vào nhà bằng một bước, không nhảy vào.
   *  Bật cho bài tập; bản nhạc thì để tắt, vì kết Sol→Đô là cách kết kinh điển. */
  approachTonicByStep?: boolean
  // ── SÀN ĐỘ KHÓ ─────────────────────────────────────────────────────────────
  // Mọi ràng buộc ở trên đều là GIỚI HẠN TRÊN ("tối đa", "chỉ được"). Chỉ có
  // trần mà không có sàn thì một bài toàn nốt đen đi liền kề trong ba nốt
  // Đô–Rê–Mi vẫn hợp lệ tuyệt đối ở BẬC 15 — mà AI lại được dặn "đúng luật là
  // ưu tiên số một", nên nó luôn chọn đường an toàn nhất, tức là bài của bậc
  // thấp nhất. Đây chính là lý do bậc 15 vẫn ra bài dễ. Bốn trường dưới đây là
  // sàn: dưới mức này thì chưa phải bài của bậc.

  /** Nốt MỚI mà bậc này vừa mở — bắt buộc phải xuất hiện, không thì chỉ là bài bậc trước. */
  mustPitches?: string[]
  /** Trường độ MỚI mà bậc này vừa mở — bắt buộc phải xuất hiện. */
  mustDurations?: number[]
  /** Nốt cao nhất và nốt thấp nhất của bài phải cách nhau ít nhất bấy nhiêu bước. */
  minRange?: number
  /** Số lần phải đi cách nhau từ 2 bước trở lên (quãng ba trở lên). */
  minLeaps?: number
  /** Số ô nhịp mỗi CÂU. Bài chia thành các câu bằng nhau và CÂU THỨ BA NHẮC LẠI
   *  CÂU ĐẦU — luật "Hỏi – Đáp – Hỏi biến tấu – Kết" của thầy.
   *
   *  Đây là thứ làm một bài nghe ra bài chứ không phải một chuỗi nốt đúng luật.
   *  Bé năm tuổi nhớ được "Kìa con bướm vàng" chính vì câu 1 và câu 3 giống hệt
   *  nhau. Engine trước đây không có khái niệm câu, nên mọi bài đều là 8 ô trôi
   *  tuột không nhắc lại gì — đúng luật mà không ai nhớ nổi.
   *
   *  Chỉ có tác dụng khi bars chia hết cho phraseBars và ra từ 4 câu trở lên
   *  (cần có câu 3 mà câu 3 không phải câu kết). */
  phraseBars?: number
  /** Kỹ năng hôm nay — đưa vào prompt để AI sáng tác có mục đích sư phạm */
  skill: string
}

// ── BỘ LUẬT DEMO — 10 bậc ────────────────────────────────────────────────────
// Mỗi bậc chỉ mở THÊM MỘT thứ so với bậc trước: hoặc thêm nốt, hoặc thêm trường
// độ, hoặc nới quãng nhảy, hoặc đổi nhịp. Không mở hai thứ cùng lúc.
// Giới hạn cao độ: C4–B5 (ngoài khoảng này notationAdapter chưa có vị trí trên
// khuông nhạc, nốt sẽ vẽ sai chỗ).
const P5  = ['C4', 'D4', 'E4', 'F4', 'G4']
const P8  = [...P5, 'A4', 'B4', 'C5']
const P10 = [...P8, 'D5', 'E5']

// ── BÀI TẬP (Ex.0–Ex.4) — kế thừa từng nốt một ───────────────────────────────
// Theo tài liệu "Progressive Exercises" của thầy. Mỗi bài chỉ THÊM MỘT nốt so với
// bài trước, giữ nguyên phần cũ. Ngắn 2–4 ô, chưa phải tác phẩm, chỉ cần bé quen
// tay và cảm được phách.
//
// BA CHỖ LỆCH TÀI LIỆU, cố ý:
// 1. Ex.1 trong tài liệu kết ở Rê ở ví dụ nhưng luật ghi phải kết ở Đô — theo LUẬT.
// 2. Tài liệu có dấu "(nghỉ)" cuối ô; định dạng bài chưa có dấu lặng nên thay bằng
//    NỐT NGÂN DÀI cuối bài — với bé mới học tác dụng tương đương, mà máy vẫn chấm được.
// 3. Bè đệm tay trái (Ex.2+) CHƯA làm: app chỉ có một bè, thêm bè thứ hai là bộ dò
//    cao độ nghe lẫn và chấm sai. Để dành khi có phần đệm riêng.
const EX1 = ['C4']
const EX2 = ['C4', 'D4']
const EX3 = ['C4', 'D4', 'E4']
const EX5 = ['C4', 'D4', 'E4', 'F4', 'G4']
const EX7 = [...EX5, 'A4', 'B4']

export const LEVELS: PianoLevel[] = [
  { id: 1, name: 'Chỉ nốt Đô', kind: 'exercise', pitches: EX1, durations: [1, 2],
    beatsPerBar: 4, bars: 2, maxStep: 1, bpm: [60, 66], endOnTonic: true, approachTonicByStep: true,
    skill: 'Chỉ một nốt Đô. Bé làm quen mặt nốt và cảm giác phách mạnh — phách nhẹ, đổi giữa nốt đen và nốt trắng' },

  { id: 2, name: 'Thêm nốt Rê', kind: 'exercise', pitches: EX2, durations: [1, 2],
    beatsPerBar: 4, bars: 2, maxStep: 1, bpm: [60, 69], endOnTonic: true, approachTonicByStep: true,
    mustPitches: ['D4'],
    skill: 'Hai nốt Đô–Rê. Bé cảm nhận đi lên và đi xuống một bậc, kết lại về Đô' },

  { id: 3, name: 'Thêm nốt Mi', kind: 'exercise', pitches: EX3, durations: [1, 2],
    beatsPerBar: 4, bars: 3, maxStep: 1, bpm: [63, 72], endOnTonic: true, approachTonicByStep: true,
    strongBeatPitches: ['C4', 'E4'],
    mustPitches: ['E4'],
    skill: 'Ba nốt Đô–Rê–Mi. Rê chỉ là nốt đi qua; phách mạnh rơi vào Đô hoặc Mi để bé quen trọng tâm hợp âm Đô trưởng' },

  { id: 4, name: 'Thêm Fa và Sol', kind: 'exercise', pitches: EX5, durations: [1, 2],
    beatsPerBar: 4, bars: 4, maxStep: 1, bpm: [66, 76], endOnTonic: true, approachTonicByStep: true,
    strongBeatPitches: ['C4', 'E4', 'G4'],
    mustPitches: ['F4', 'G4'], minRange: 3,
    skill: 'Đủ năm nốt Đô–Sol, trọn bàn tay. Câu nhạc đi lên tới đỉnh Sol rồi quay về Đô — có hỏi có đáp' },

  { id: 5, name: 'Đủ bảy nốt', kind: 'exercise', pitches: EX7, durations: [1, 2],
    beatsPerBar: 4, bars: 4, maxStep: 2, bpm: [69, 80], endOnTonic: true, approachTonicByStep: true,
    strongBeatPitches: ['C4', 'E4', 'G4'],
    mustPitches: ['A4', 'B4'], minRange: 4,
    skill: 'Thêm La và Si. Si là nốt hút về Đô — bài phải kết bằng Si rồi Đô để bé nghe ra cảm giác "về nhà"' },

// ── BẢN NHẠC (bậc 6–15) — đã thành tác phẩm có câu có kết ────────────────────
  { id: 6,  name: 'Ba nốt đầu',      kind: 'piece', pitches: ['C4','D4','E4'], durations: [1],
    beatsPerBar: 4, bars: 2, maxStep: 1, bpm: [60, 72], endOnTonic: true,
    skill: 'Ba nốt Đô Rê Mi tay phải, toàn nốt đen, đi liền kề' },

  { id: 7,  name: 'Năm nốt bàn tay',  kind: 'piece', pitches: P5, durations: [1],
    beatsPerBar: 4, bars: 2, maxStep: 1, bpm: [63, 76], endOnTonic: true,
    mustPitches: ['G4'], minRange: 3,
    skill: 'Mở rộng ra năm nốt Đô–Sol, vẫn toàn nốt đen, đi liền kề' },

  { id: 8,  name: 'Nốt trắng',        kind: 'piece', pitches: P5, durations: [1, 2],
    beatsPerBar: 4, bars: 4, maxStep: 1, bpm: [66, 80], endOnTonic: true,
    mustDurations: [2], minRange: 3,
    phraseBars: 1,
    skill: 'Làm quen nốt trắng — giữ tiếng ngân đủ hai phách' },

  { id: 9,  name: 'Nốt tròn',         kind: 'piece', pitches: P5, durations: [1, 2, 4],
    beatsPerBar: 4, bars: 4, maxStep: 1, bpm: [66, 80], endOnTonic: true,
    mustDurations: [4], minRange: 3,
    phraseBars: 1,
    skill: 'Thêm nốt tròn ngân trọn một ô nhịp, tập đếm bốn phách' },

  { id: 10,  name: 'Quãng ba',         kind: 'piece', pitches: P5, durations: [1, 2],
    beatsPerBar: 4, bars: 4, maxStep: 2, bpm: [72, 86], endOnTonic: true,
    mustDurations: [2], minRange: 4, minLeaps: 2,
    phraseBars: 1,
    skill: 'Tập nhảy quãng ba, giữ nhịp đều khi đổi ngón' },

  { id: 11,  name: 'Nhịp ba bốn',      kind: 'piece', pitches: P5, durations: [1, 2, 3],
    beatsPerBar: 3, bars: 4, maxStep: 2, bpm: [72, 86], endOnTonic: true,
    mustDurations: [3], minRange: 3,
    phraseBars: 1,
    skill: 'Nhịp 3/4 — cảm giác một–hai–ba, nhấn phách đầu mỗi ô' },

  { id: 12,  name: 'Trọn quãng tám',   kind: 'piece', pitches: P8, durations: [1, 2, 4],
    beatsPerBar: 4, bars: 4, maxStep: 3, bpm: [76, 92], endOnTonic: true,
    mustPitches: ['C5'], mustDurations: [4], minRange: 5,
    phraseBars: 1,
    skill: 'Đi hết quãng tám Đô4–Đô5, câu nhạc có mở và có kết' },

  { id: 13,  name: 'Móc đơn',          kind: 'piece', pitches: P8, durations: [0.5, 1, 1.5, 2],
    beatsPerBar: 4, bars: 4, maxStep: 2, bpm: [76, 92], endOnTonic: true,
    mustDurations: [0.5, 1.5], minRange: 4, minLeaps: 2,
    phraseBars: 1,
    skill: 'Làm quen nốt móc đơn — hai nốt gọn trong một phách' },

  { id: 14,  name: 'Quãng rộng',       kind: 'piece', pitches: P10, durations: [1, 2, 3, 4],
    beatsPerBar: 4, bars: 4, maxStep: 4, bpm: [84, 100], endOnTonic: true,
    mustPitches: ['D5'], mustDurations: [3], minRange: 6, minLeaps: 2,
    phraseBars: 1,
    skill: 'Nhảy quãng bốn–quãng năm, tay phải mở rộng lên Mi5' },

  { id: 15, name: 'Tổng hợp',         kind: 'piece', pitches: P10, durations: [0.5, 1, 1.5, 2, 3, 4],
    beatsPerBar: 4, bars: 8, maxStep: 4, bpm: [88, 108], endOnTonic: true,
    mustPitches: ['C5'], mustDurations: [0.5, 3], minRange: 6, minLeaps: 3,
    phraseBars: 2,
    skill: 'Bài dài tám ô, phối hợp mọi trường độ đã học, giữ nhịp từ đầu đến cuối' },
]

export const DEFAULT_LEVEL_ID = 1

export function getLevel(id: number): PianoLevel {
  return LEVELS.find(l => l.id === id) ?? LEVELS[0]
}

// ── Bậc hiện tại của bé ──────────────────────────────────────────────────────
// Tạm để localStorage cho giai đoạn thí nghiệm. Khi có dữ liệu học viên thật thì
// đổi sang cột trên bảng học viên, thầy đặt từ /admin — chữ ký hàm giữ nguyên.
const LEVEL_KEY = 'piano_level'

export function currentLevelId(): number {
  try {
    const v = parseInt(localStorage.getItem(LEVEL_KEY) || '', 10)
    if (LEVELS.some(l => l.id === v)) return v
  } catch { /* */ }
  return DEFAULT_LEVEL_ID
}

export function setLevelId(id: number) {
  try { localStorage.setItem(LEVEL_KEY, String(id)) } catch { /* */ }
}

// ── Cao độ ↔ số MIDI ─────────────────────────────────────────────────────────
const BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function pitchToMidi(pitch: string): number | null {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(pitch.trim())
  if (!m) return null
  const step = BASE[m[1].toUpperCase()]
  if (step === undefined) return null
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return (parseInt(m[3], 10) + 1) * 12 + step + acc
}

/** Vị trí của một cao độ trong thang nốt của bậc; -1 nếu không đọc được. */
function nearestIndex(pitch: string, level: PianoLevel): number {
  const midi = pitchToMidi(pitch)
  if (midi == null) return -1
  let best = 0, bestD = Infinity
  level.pitches.forEach((p, i) => {
    const d = Math.abs((pitchToMidi(p) ?? 0) - midi)
    if (d < bestD) { bestD = d; best = i }
  })
  return best
}

// ── Chống ra mãi một bài ─────────────────────────────────────────────────────
// Bậc thấp có không gian giai điệu rất hẹp nên với cùng một prompt, AI luôn trả
// về đúng một lời giải hiển nhiên — đo thật: gọi 3 lần ra y hệt nhau. Hai cách
// chữa, đều ở client: (1) mỗi lần giao một DÁNG khác, (2) kèm bài vừa ra để tránh.
const SHAPES = [
  'đi lên dần rồi kết',
  'đi xuống dần rồi kết',
  'vòng cung: lên tới đỉnh rồi quay về',
  'hỏi–đáp: ô nhịp đầu như câu hỏi đi lên, ô sau trả lời đi xuống',
  'lắc lư quanh một nốt rồi mới về nốt chủ',
  'đi từng nấc: mỗi nốt lặp hai lần rồi mới đi tiếp',
  'mở đầu bằng nốt ngân dài rồi chạy đều',
  'chạy đều rồi kết bằng nốt ngân dài',
  'nhắc lại: ô nhịp thứ hai lặp gần giống ô đầu nhưng đổi nốt cuối',
]

/** Chủ đề cho nút "Bài bất kỳ" — khi bé chưa nghĩ ra muốn gì. */
const RANDOM_THEMES = [
  'con mèo đi rón rén', 'chú khủng long to lớn', 'giọt mưa rơi', 'ông mặt trời buổi sáng',
  'con thuyền trôi trên sông', 'chú chim non tập bay', 'cái cây trong vườn', 'ông trăng tròn',
  'đàn cá bơi tung tăng', 'bé chạy trong sân', 'con bướm vàng', 'tiếng chuông gió',
  'chú gấu ngủ đông', 'bông hoa nở', 'con tàu vào ga', 'đám mây trắng bay',
]

export function randomTheme(): string {
  return RANDOM_THEMES[Math.floor(Math.random() * RANDOM_THEMES.length)]
}

const RECENT_KEY = 'piano_recent'
const RECENT_MAX = 4

/** Chữ ký giai điệu để so trùng, ví dụ "C4-D4-E4-C4". */
export function signature(ex: Exercise): string {
  return ex.notes.map(n => n.pitch).join('-')
}

export function recentSignatures(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, RECENT_MAX) } catch { return [] }
}

export function rememberExercise(ex: Exercise) {
  try {
    const sig = signature(ex)
    const list = [sig, ...recentSignatures().filter(s => s !== sig)].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch { /* */ }
}

// ── Ràng buộc gửi kèm cho AI ─────────────────────────────────────────────────
// Gộp vào `prompt` gửi tới piano-generate, KHÔNG sửa prompt cứng của function.
const DUR_NAME: Record<number, string> = { 0.5: 'móc đơn', 1: 'đen', 1.5: 'đen chấm dôi', 2: 'trắng', 3: 'trắng chấm', 4: 'tròn' }

export function buildPrompt(chuDe: string, level: PianoLevel): string {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]
  const avoid = recentSignatures()
  const total = level.bars * level.beatsPerBar
  const durList = level.durations.map(d => `${d} (${DUR_NAME[d] ?? '?'})`).join(', ')
  const san = [
    level.mustPitches?.length
      ? `PHẢI dùng ít nhất một lần các nốt ${level.mustPitches.join(' ')} — đây là nốt mới của bậc này.`
      : '',
    level.mustDurations?.length
      ? `PHẢI dùng ít nhất một lần: ${level.mustDurations.map(d => `${d} (${DUR_NAME[d] ?? '?'})`).join(', ')}.`
      : '',
    level.minRange
      ? `Nốt cao nhất và nốt thấp nhất của bài phải cách nhau ÍT NHẤT ${level.minRange} bước.`
      : '',
    level.minLeaps
      ? `Phải có ÍT NHẤT ${level.minLeaps} lần hai nốt liền nhau cách nhau từ 2 bước trở lên.`
      : '',
  ].filter(Boolean)
  const soCau = level.phraseBars && Number.isInteger(level.bars / level.phraseBars)
    ? level.bars / level.phraseBars : 0
  return [
    `Bé muốn một bài về: "${chuDe}".`,
    `Mục tiêu sư phạm hôm nay: ${level.skill}.`,
    `Lần này hãy soạn theo DÁNG: ${shape}.`,
    avoid.length
      ? `KHÔNG được trùng với các bài vừa soạn: ${avoid.join(' | ')}. Hãy làm khác hẳn.`
      : '',
    level.kind === 'exercise'
      ? `Đây là BÀI TẬP LUYỆN NGÓN cho bé mới học, KHÔNG cần thành tác phẩm. Ngắn, dễ, lặp lại được.`
      : '',
    `RÀNG BUỘC BẮT BUỘC (bậc ${level.id} — ${level.name}):`,
    `- Nhịp ${level.beatsPerBar}/4, đúng ${level.bars} ô nhịp.`,
    `- TỔNG trường độ tất cả các nốt phải bằng ĐÚNG ${total} phách — không thừa, không thiếu.`,
    `- CHỈ được dùng các nốt: ${level.pitches.join(' ')} — tuyệt đối không dùng nốt khác.`,
    `- duration chỉ được là: ${durList}.`,
    `- MỖI NỐT PHẢI NẰM GỌN TRONG MỘT Ô NHỊP, không nốt nào vắt qua vạch nhịp. `
    + `Cộng dồn trường độ từ đầu bài, mỗi ${level.beatsPerBar} phách là một vạch nhịp; `
    + `một nốt bắt đầu ở phách thứ k trong ô thì trường độ tối đa là ${level.beatsPerBar}−k+1.`,
    level.durations.includes(0.5)
      ? `- Nốt móc đơn luôn đi thành CẶP nằm trọn trong một phách, không bao giờ đứng lẻ.`
      : '',
    `- Hai nốt liền nhau cách nhau tối đa ${level.maxStep} bước trong thang nốt trên `
    + `(1 bước = hai nốt liền kề nhau trong danh sách, ví dụ C4→D4).`,
    `- bpm trong khoảng ${level.bpm[0]}–${level.bpm[1]}.`,
    level.strongBeatPitches?.length
      ? `- PHÁCH MẠNH (phách đầu mỗi ô nhịp) chỉ được là: ${level.strongBeatPitches.join(' ')}. `
        + `Các nốt khác chỉ dùng làm nốt đi qua ở phách yếu.`
      : '',
    level.endOnTonic ? `- Ô nhịp cuối kết ở nốt ${level.pitches[0]}, nên ngân dài.` : '',
    `- Không lặp cùng một nốt quá 3 lần liên tiếp.`,
    // SÀN — không có mấy dòng này thì AI luôn nộp bài của bậc thấp nhất, vì bài
    // dễ nhất bao giờ cũng thoả mọi ràng buộc "tối đa" ở trên.
    san.length
      ? [`TẤT CẢ RÀNG BUỘC TRÊN LÀ GIỚI HẠN TRÊN. Dưới đây là SÀN — bài PHẢI khó ít nhất tới mức này.`,
         `Đây là bậc ${level.id} trên thang ${LEVELS.length} bậc; một bài toàn nốt đen đi liền kề `
         + `là bài của bậc 6, nộp cho bậc này là SAI.`,
         ...san.map(s => `- ${s}`)].join('\n')
      : '',
    // ── Luật soạn nhạc của thầy ────────────────────────────────────────────
    // Hai luật này không phải ràng buộc kỹ thuật mà là thứ làm bài NGHE RA BÀI.
    // Lớp KIỂM ép được cấu trúc câu, nhưng ép xong thì máy móc; nói trước với AI
    // thì bản nó viết ra đã có sẵn hình dáng, đỡ phải vá.
    soCau >= 4
      ? [`CẤU TRÚC CÂU (luật của thầy) — bài chia ${soCau} câu, mỗi câu ${level.phraseBars} ô nhịp:`,
         `  · câu 1 = HỎI, đặt vấn đề`,
         `  · câu 2 = ĐÁP, trả lời và phát triển`,
         `  · câu 3 = HỎI NHẮC LẠI — phải GIỐNG HỆT câu 1, cùng nốt cùng trường độ`,
         `  · câu ${soCau} = KẾT, dứt khoát, về nốt chủ và ngân dài`,
         `Câu 3 giống câu 1 chính là thứ làm bé nhớ được bài — đây là ràng buộc, không phải gợi ý.`]
        .join('\n')
      : '',
    `CẢM XÚC QUYẾT ĐỊNH TRƯỜNG ĐỘ (luật của thầy). Đọc chủ đề "${chuDe}", chọn ĐÚNG MỘT nhóm rồi soạn theo — đừng rải trường độ ngẫu nhiên:`,
    `  · vui tươi, nhí nhảnh → chủ yếu nốt đen và móc đơn; nốt ngân dài chỉ để chốt cuối câu.`,
    `  · buồn, trầm lắng → chủ yếu nốt trắng và tròn; nốt đen chỉ dùng để tạo chuyển động giữa câu.`,
    `  · hồi hộp, dồn dập → móc đơn chạy liên tục, chặn lại bằng một nốt dài ở cuối câu.`,
    `  · trang nghiêm, vững chãi → chủ yếu đen và trắng, thêm đen chấm dôi cho uyển chuyển.`,
    `- Không dùng toàn một loại nốt cho cả bài; mỗi câu nên trộn ít nhất hai loại trường độ.`,
    `- Hai câu liền nhau nên TƯƠNG PHẢN: câu này thong thả thì câu kia dồn hơn.`,
    `- Giai điệu phải nghe ra chủ đề bé muốn, nhưng ĐÚNG LUẬT là ưu tiên số một.`,
  ].filter(Boolean).join('\n')
}

// ── Lớp KIỂM: soi bài AI trả về và SỬA cho đúng luật ─────────────────────────
export interface CheckResult {
  exercise: Exercise
  /** Những chỗ AI làm sai luật (đã được sửa). Rỗng = AI làm đúng hết. */
  problems: string[]
}

/** Trường độ hợp lệ LỚN NHẤT còn nhét vừa `remain` phách; null nếu không có. */
function fitDur(level: PianoLevel, remain: number): number | null {
  const ok = level.durations.filter(d => d <= remain + 1e-9).sort((a, b) => b - a)
  return ok.length ? ok[0] : null
}

/** Những trường độ đặt được TẠI phách `beat`. Ba điều kiện:
 *  1. còn nhét vừa phần bài chưa lấp;
 *  2. NẰM GỌN TRONG MỘT Ô NHỊP — không vắt qua vạch nhịp. Nốt vắt vạch thì
 *     phải viết bằng dấu nối, mà bản nhạc cho bé chưa có dấu nối, nên khuông
 *     vẽ ra sai và bé đếm ô cũng không khớp;
 *  3. đang đứng ở nửa phách thì CHỈ được móc đơn — nhờ vậy móc đơn luôn đi
 *     thành cặp, không có nốt lẻ làm lệch nửa phách toàn bộ phần sau.
 */
function durationsAt(level: PianoLevel, beat: number, remain: number): number[] {
  const conTrongO = level.beatsPerBar - (beat % level.beatsPerBar)
  const nuaPhach = Math.abs(beat - Math.round(beat)) > 1e-9
  return level.durations.filter(d =>
    d <= remain + 1e-9 && d <= conTrongO + 1e-9 && (!nuaPhach || d === 0.5))
}

/** Trường độ hợp lệ tại `beat` gần ý AI nhất; null nếu không còn chỗ nào đặt được. */
function fitAt(level: PianoLevel, beat: number, remain: number, muon: number): number | null {
  const ok = durationsAt(level, beat, remain)
  if (!ok.length) return null
  return ok.reduce((a, b) => Math.abs(b - muon) < Math.abs(a - muon) ? b : a, ok[0])
}

export function checkAndRepair(raw: Exercise | null, level: PianoLevel, fallbackTitle: string): CheckResult {
  const problems: string[] = []
  const target = level.bars * level.beatsPerBar

  let notes: PianoNote[] = Array.isArray(raw?.notes) ? raw.notes.filter(n => n && typeof n.pitch === 'string') : []
  if (!notes.length) {
    problems.push('AI không trả về nốt nào')
    // KHÔNG thoát sớm: bài mẫu cũng phải đi qua lớp KIỂM. Bản cũ trả thẳng
    // template ra ngoài nên khi AI hỏng, bậc 15 nhận đúng một gam chạy lên rồi
    // chạy xuống toàn nốt đen — dễ y như bậc 6.
    notes = template(level, fallbackTitle).notes
  }

  // 1. Kéo mọi nốt về thang nốt của bậc
  const rawIdx = notes.map(n => {
    const i = nearestIndex(n.pitch, level)
    if (i < 0) { problems.push(`không đọc được cao độ "${n.pitch}"`); return 0 }
    if (level.pitches[i] !== n.pitch) problems.push(`nốt ${n.pitch} không có trong bậc ${level.id} → ${level.pitches[i]}`)
    return i
  })

  // 2. Trường độ về giá trị hợp lệ
  const rawDur = notes.map(n => {
    const d = Number(n.duration)
    if (level.durations.includes(d)) return d
    problems.push(`trường độ ${n.duration} không hợp lệ`)
    return level.durations.reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a, level.durations[0])
  })

  // 3+4. Nhồi cho ĐỦ Ô NHỊP — tổng phải bằng đúng bars × beatsPerBar.
  //
  // DÀNH SẴN ô nhịp cuối cho nốt chủ TRƯỚC KHI nhồi, rồi mới lấp phần còn lại.
  // Bản đầu làm ngược (nhồi đầy rồi cắt ô cuối để thay nốt chủ) — phần cắt ra
  // thường NHIỀU HƠN một ô nên bài bị hụt phách: fuzz 800 bài thì 242 bài sai
  // tổng phách. Dành trước thì phép cộng luôn khớp.
  const reserve = (level.endOnTonic && level.durations.includes(level.beatsPerBar))
    ? level.beatsPerBar : 0
  const fillTarget = target - reserve

  const idx: number[] = []
  const durs: number[] = []
  let total = 0
  for (let i = 0; i < rawIdx.length && total < fillTarget - 1e-9; i++) {
    // `total` chính là phách bắt đầu của nốt này — dùng nó để soi vạch nhịp.
    const d = fitAt(level, total, fillTarget - total, rawDur[i])
    if (d == null) break
    if (Math.abs(d - rawDur[i]) > 1e-9) problems.push(`nốt ${i + 1} vắt qua vạch nhịp, đã nắn trường độ`)
    idx.push(rawIdx[i]); durs.push(d); total += d
  }
  if (idx.length < rawIdx.length) problems.push(`bài dài quá ${level.bars} ô, đã cắt`)

  let guard = 0
  while (total < fillTarget - 1e-9 && guard++ < 400) {
    const fit = fitAt(level, total, fillTarget - total, 999)   // lấy nốt dài nhất còn vừa
    if (fit == null) break
    problems.push('thiếu ô nhịp, thêm nốt cho đầy')
    const last = idx[idx.length - 1] ?? 0
    idx.push(clamp(last - 1, 0, level.pitches.length - 1))
    durs.push(fit); total += fit
  }

  if (reserve) {
    idx.push(0); durs.push(reserve)          // ô cuối: nốt chủ ngân trọn ô
  } else if (level.endOnTonic && idx.length && idx[idx.length - 1] !== 0) {
    problems.push('không kết ở nốt chủ')
    idx[idx.length - 1] = 0
  }

  // 4a. SÀN TRƯỜNG ĐỘ — bậc 13 mà không có nốt móc đơn nào thì đó là bài bậc 9.
  //     Sửa bằng hai phép đúng-theo-định-nghĩa, không đụng tới tổng phách:
  //     · cần móc đơn → TÁCH một nốt đen ở đầu phách thành hai móc đơn;
  //     · cần nốt dài → GỘP một dãy nốt nằm gọn trong cùng một ô nhịp thành một nốt.
  //     Cả hai đều giữ nguyên vạch nhịp, nên không phá luật vừa dựng ở trên.
  //     Xử lý từ trường độ DÀI xuống NGẮN: làm ngược lại thì phép gộp nuốt luôn
  //     cặp móc đơn vừa tách ra (bậc 15 tách được 0.5 rồi gộp 4 nốt thành trắng
  //     chấm, ăn mất cả hai móc đơn — đo thật, bài ra vẫn không có móc đơn nào).
  const khoaCuoi = reserve ? 1 : 0          // đừng đụng vào ô kết đã dành sẵn
  const canDur = [...(level.mustDurations ?? [])].sort((a, b) => b - a)

  // Mốc câu phải biết TRƯỚC khi chèn trường độ, để không chèn vào đúng câu 3 —
  // câu 3 lát nữa bị chép đè bằng tiết tấu câu 1 là mất trắng. Bậc 14 hụt nốt
  // trắng chấm 131/1500 bài đúng vì thế.
  const phachCau = (level.phraseBars ?? 0) * level.beatsPerBar
  const soCau = phachCau ? level.bars / level.phraseBars! : 0
  const coCau = phachCau > 0 && Number.isInteger(soCau) && soCau >= 4
  /** Chỉ số nốt mở đầu từng câu, kèm phần tử cuối = hết bài. */
  const mocCau = (): number[] => {
    const m: number[] = []
    let b = 0
    for (let i = 0; i < durs.length; i++) {
      if (Math.abs(b % phachCau) < 1e-9) m.push(i)
      b += durs[i]
    }
    m.push(durs.length)
    return m
  }
  /** Chép TIẾT TẤU câu 1 sang câu 3. Gọi lại được nhiều lần, lần sau là vô hại. */
  const chepTietTau = (): boolean => {
    if (!coCau) return false
    const m = mocCau()
    if (m.length < 5) return false
    const [a0, a1, c0, c1] = [m[0], m[1], m[2], m[3]]
    if (a1 - a0 === c1 - c0 && durs.slice(a0, a1).every((d, k) => Math.abs(d - durs[c0 + k]) < 1e-9)) return false
    durs.splice(c0, c1 - c0, ...durs.slice(a0, a1))
    idx.splice(c0, c1 - c0, ...idx.slice(a0, a1))
    return true
  }
  /** Khoảng chỉ số của câu 3 ở trạng thái hiện tại — vùng cấm chèn. */
  const vungCau3 = (): [number, number] => {
    if (!coCau) return [-1, -1]
    const m = mocCau()
    return m.length >= 5 ? [m[2], m[3]] : [-1, -1]
  }

  if (chepTietTau()) problems.push('câu 3 phải nhắc lại câu 1, đã chép tiết tấu câu 1 sang')

  for (const d of canDur) {
    if (durs.some(x => Math.abs(x - d) < 1e-9)) continue
    let beat = 0, xong = false
    // Nốt đang mang một trường độ bắt buộc KHÁC thì đừng đụng vào, không thì
    // phép sau ăn mất thành quả của phép trước (bậc 15 tách móc đơn ra từ chính
    // nốt trắng chấm vừa tạo — hụt 419/1500 bài).
    // …nhưng chỉ giữ khi đó là BẢN SAO CUỐI CÙNG. Cấm tuyệt đối là quá tay: mẫu
    // ♩. + ♪ phải gộp đúng một nốt đen với một móc đơn, mà cấm đụng vào móc đơn
    // thì không bao giờ gộp được — bậc 13 hụt nốt đen chấm dôi 415/1500 bài.
    const demDur = (x: number) => durs.reduce((s, y) => s + (Math.abs(y - x) < 1e-9 ? 1 : 0), 0)
    const dungYen = (j: number) =>
      canDur.some(x => x !== d && Math.abs(x - durs[j]) < 1e-9 && demDur(x) <= 1)
    const [c3a, c3b] = vungCau3()
    const camChen = (j: number) => j >= c3a && j < c3b
    for (let i = 0; i < durs.length - khoaCuoi && !xong; i++) {
      const dauPhach = Math.abs(beat - Math.round(beat)) < 1e-9 && !dungYen(i) && !camChen(i)
      if (d === 0.5) {
        // Cắt một nốt ≥1 phách ở đầu phách thành cặp móc đơn + phần dư.
        // Bản đầu chỉ nhận đúng nốt đen, nên ô nhịp toàn nốt trắng và nốt tròn
        // thì chịu — bậc 13 hụt móc đơn 57/1500 bài vì thế.
        const du = durs[i] - 1
        if (dauPhach && durs[i] >= 1 - 1e-9 &&
            (Math.abs(du) < 1e-9 || level.durations.some(x => Math.abs(x - du) < 1e-9))) {
          const v = idx[i], v2 = clamp(v + 1, 0, level.pitches.length - 1)
          const themDur = du > 1e-9 ? [0.5, 0.5, du] : [0.5, 0.5]
          const themIdx = du > 1e-9 ? [v, v2, v] : [v, v2]
          durs.splice(i, 1, ...themDur)
          idx.splice(i, 1, ...themIdx)
          xong = true
        }
      } else if (dauPhach && durs[i] > d + 1e-9 &&
                 level.durations.some(x => Math.abs(x - (durs[i] - d)) < 1e-9)) {
        // Nốt đang dài hơn mức cần → CẮT thành d + phần dư. Cả hai vẫn nằm trong
        // ô nhịp cũ vì tổng không đổi.
        const v = idx[i], du = durs[i] - d
        durs.splice(i, 1, d, du); idx.splice(i, 1, v, clamp(v - 1, 0, level.pitches.length - 1))
        xong = true
      } else if (dauPhach) {
        const oCua = Math.floor(beat / level.beatsPerBar)
        let s = 0
        for (let j = i; j < durs.length - khoaCuoi; j++) {
          if (dungYen(j)) break                    // đừng nuốt bản sao cuối cùng của trường độ bắt buộc khác
          s += durs[j]
          if (s > d + 1e-9) break
          if (Math.abs(s - d) < 1e-9 &&
              Math.floor((beat + s - 1e-9) / level.beatsPerBar) === oCua) {
            idx.splice(i, j - i + 1, idx[i]); durs.splice(i, j - i + 1, d); xong = true
            break
          }
        }
      }
      beat += durs[i]
    }

    // Lối cuối: VIẾT LẠI HẲN MỘT Ô NHỊP — đặt nốt cần ở đầu ô rồi lấp cho đủ ô.
    // Tách và gộp đều làm việc tại chỗ nên có ô chịu chết: ô toàn nốt trắng thì
    // không tách ra nổi trắng chấm (2 < 3) mà gộp cũng không ra (2+2 = 4). Viết
    // lại cả ô thì luôn được, miễn nốt cần không dài hơn một ô.
    if (!xong && d <= level.beatsPerBar + 1e-9) {
      let b2 = 0, p = -1, q = -1, dauO = 0
      for (let i = 0; i < durs.length - khoaCuoi; i++) {
        if (Math.abs(b2 % level.beatsPerBar) < 1e-9) { p = camChen(i) ? -1 : i; dauO = b2 }
        b2 += durs[i]
        if (p >= 0 && Math.abs(b2 - dauO - level.beatsPerBar) < 1e-9) { q = i + 1; break }
      }
      if (p >= 0 && q > p) {
        const dMoi = [d], iMoi = [idx[p]]
        let con = level.beatsPerBar - d, pos = d
        while (con > 1e-9) {
          const f = fitAt(level, pos, con, 999)
          if (f == null) break
          dMoi.push(f)
          iMoi.push(clamp(idx[p] + (dMoi.length % 2 ? -1 : 1), 0, level.pitches.length - 1))
          con -= f; pos += f
        }
        if (con <= 1e-9) {
          durs.splice(p, q - p, ...dMoi); idx.splice(p, q - p, ...iMoi); xong = true
        }
      }
    }

    problems.push(xong
      ? `bậc ${level.id} bắt buộc phải có nốt ${DUR_NAME[d] ?? d}, đã sửa`
      : `bậc ${level.id} thiếu nốt ${DUR_NAME[d] ?? d} mà không chỗ nào chèn được`)
  }

  // 4a2. Chèn trường độ ở trên chỉ động vào câu 1 / câu 2 / câu 4, nên chép lại
  //      một lần nữa để câu 3 mang đúng tiết tấu mới của câu 1. Lần này chắc
  //      chắn là lần cuối: từ đây xuống dưới không bước nào đổi trường độ.
  chepTietTau()

  // Từ đây trở đi trường độ không đổi nữa (các bước sau chỉ nắn cao độ), nên mốc
  // câu chốt được luôn. Phần nâng sàn sẽ TRÁNH hai câu này ra để giữ nguyên chỗ
  // nhắc lại; chỉ khi ngoài đó hết chỗ mới đụng vào.
  const bienCau: [number, number, number, number] | null = (() => {
    if (!coCau) return null
    const m = mocCau()
    return m.length >= 5 ? [m[0], m[1], m[2], m[3]] : null
  })()
  const trongCau13 = (i: number) =>
    !!bienCau && ((i >= bienCau[0] && i < bienCau[1]) || (i >= bienCau[2] && i < bienCau[3]))

  // 4b. PHÁCH MẠNH — nốt rơi đúng đầu ô nhịp phải nằm trong strongBeatPitches.
  //
  //     KHÓ Ở CHỖ TẦM VỚI: ghim hai đầu rồi mới nắn quãng nhảy là hỏng. Bậc 4 đi
  //     liền kề (maxStep 1), nếu phách mạnh ô cuối là Sol mà bài phải kết ở Đô thì
  //     chỉ còn 3 nốt ở giữa — không cách nào đi hết 4 bước. Fuzz bắt đúng ca này.
  //     Nên chọn phách mạnh phải thoả CẢ HAI phía: với tới được từ phách mạnh
  //     trước, VÀ còn kịp về nốt kết.
  const ghim = new Set<number>()
  const cuoi = idx.length - 1
  if (level.endOnTonic && idx.length) ghim.add(cuoi)

  // Phách mạnh được ghim, NHƯNG phần nâng độ khó bên dưới vẫn đổi được — miễn là
  // đổi sang một nốt phách mạnh khác. Không cho đổi thì bài lười (toàn Đô–Rê) bị
  // ghim hết phách mạnh vào Đô, khoá cả bài xuống đáy và không cách nào với tới
  // Fa–Sol của bậc 4. Nên nhớ lại đây vị trí nào là phách mạnh và được thay bằng gì.
  const manhVal = (level.strongBeatPitches ?? []).map(p => level.pitches.indexOf(p)).filter(i => i >= 0)
  const viTriManh = new Set<number>()

  if (level.strongBeatPitches?.length && idx.length) {
    const manh = manhVal
    if (manh.length) {
      let beatTam = 0, truoc = -1
      for (let i = 0; i < idx.length; i++) {
        const dauO = Math.abs(beatTam % level.beatsPerBar) < 1e-9
        const beatCuaNot = beatTam
        beatTam += durs[i]
        if (!dauO || i === cuoi) continue

        const toiTruoc = truoc < 0 ? Infinity : idx[truoc] + (i - truoc) * level.maxStep
        const tuTruoc  = truoc < 0 ? -Infinity : idx[truoc] - (i - truoc) * level.maxStep
        const veKip    = level.endOnTonic ? (cuoi - i) * level.maxStep : Infinity
        // Luật vào-kết-một-bước ép nốt ÁP CHÓT xuống ≤1. Không tính vào đây thì
        // phách mạnh ô cuối bị ghim vào Mi hoặc Sol, chỏi với nó, cả bài vô nghiệm
        // và phải nới phách mạnh — bậc 5 nới tới 2190/4000 bài vì đúng chỗ này.
        const veApChot = (level.approachTonicByStep && level.endOnTonic && cuoi - 1 >= i)
          ? 1 + (cuoi - 1 - i) * level.maxStep
          : Infinity
        const hop = manh.filter(v =>
          v >= tuTruoc && v <= toiTruoc && v <= veApChot &&
          (!level.endOnTonic || Math.abs(v - 0) <= veKip))
        const ungVien = hop.length ? hop : manh
        const chon = ungVien.reduce((a, b) => Math.abs(b - idx[i]) < Math.abs(a - idx[i]) ? b : a, ungVien[0])
        if (chon !== idx[i]) {
          problems.push(`phách mạnh ô ${Math.round(beatCuaNot / level.beatsPerBar) + 1} là ${level.pitches[idx[i]]}, không được phép`)
          idx[i] = chon
        }
        ghim.add(i); viTriManh.add(i); truoc = i
      }
    }
  }

  // 5. Quãng nhảy — LAN TRUYỀN KHOẢNG KHẢ THI, không nắn theo từng cặp.
  //
  //    Nắn từng cặp là sai: sửa cặp này lại phá cặp kia, và khi cả hai đầu đều
  //    ghim thì buộc phải ghi đè lên nốt đã ghim. Fuzz bắt được cả hai (38/1200).
  //
  //    Cách đúng: mỗi vị trí có một khoảng [lo, hi] các nốt còn dùng được. Ghim
  //    thì khoảng thu về đúng một giá trị. Lan truyền xuôi rồi ngược là mọi khoảng
  //    đều tính tới ràng buộc của cả hai phía. Sau đó đi một lượt chọn nốt gần ý
  //    AI nhất trong khoảng — chắc chắn không cặp nào vượt maxStep.
  const n = idx.length
  const top = level.pitches.length - 1
  const goc = idx.slice()

  const lanTruyen = (ghimNay: Set<number>) => {
    const lo = new Array(n).fill(0), hi = new Array(n).fill(top)
    ghimNay.forEach(i => { lo[i] = idx[i]; hi[i] = idx[i] })
    // Vào nốt kết bằng MỘT BƯỚC: nốt áp chót không được xa nốt chủ quá 1 bậc.
    if (level.approachTonicByStep && level.endOnTonic && n >= 2) hi[n - 2] = Math.min(hi[n - 2], 1)
    for (let i = 1; i < n; i++) {
      lo[i] = Math.max(lo[i], lo[i - 1] - level.maxStep)
      hi[i] = Math.min(hi[i], hi[i - 1] + level.maxStep)
    }
    for (let i = n - 2; i >= 0; i--) {
      lo[i] = Math.max(lo[i], lo[i + 1] - level.maxStep)
      hi[i] = Math.min(hi[i], hi[i + 1] + level.maxStep)
    }
    return lo.every((v, i) => v <= hi[i]) ? { lo, hi } : null
  }

  // Ghim đầy đủ mà bí thì nới: bỏ ghim phách mạnh, chỉ giữ nốt kết.
  let kq = lanTruyen(ghim)
  if (!kq && level.endOnTonic && n) {
    problems.push('phách mạnh không thể vừa đúng vừa về kịp nốt kết, đã nới phách mạnh')
    kq = lanTruyen(new Set([n - 1]))
    // Đã nới thì `ghim` cũ vô nghiệm — phải bỏ theo, không thì phần nâng độ khó
    // bên dưới lần nào lan truyền cũng thất bại và im lặng không làm gì.
    if (kq) { ghim.clear(); ghim.add(n - 1) }
  }
  if (!kq) { kq = lanTruyen(new Set()); if (kq) ghim.clear() }

  if (kq) {
    let truoc: number | null = null
    for (let i = 0; i < n; i++) {
      const a = Math.max(kq.lo[i], truoc === null ? -Infinity : truoc - level.maxStep)
      const b = Math.min(kq.hi[i], truoc === null ? Infinity : truoc + level.maxStep)
      idx[i] = clamp(goc[i], a, b)
      truoc = idx[i]
    }
    if (idx.some((v, i) => v !== goc[i])) problems.push(`có nốt vượt ${level.maxStep} bước, đã nắn lại`)
  }

  // 5b. SÀN CAO ĐỘ — kéo bài lên cho xứng bậc.
  //
  //     Mọi phép ở đây đều đi qua `datThu`: ghim thêm một nốt rồi LAN TRUYỀN LẠI.
  //     Lan truyền thất bại thì trả nguyên trạng. Nhờ vậy việc nâng độ khó không
  //     bao giờ phá được luật trần (maxStep, phách mạnh, nốt kết) — sàn chỉ được
  //     lấp bằng những chỗ mà luật trần còn cho phép.
  const datThu = (p: number, v: number): boolean => {
    const luu = idx.slice()
    idx[p] = v
    const g = new Set(ghim); g.add(p)
    const r = lanTruyen(g)
    if (!r) { for (let i = 0; i < n; i++) idx[i] = luu[i]; return false }
    let truoc: number | null = null
    for (let i = 0; i < n; i++) {
      const a = Math.max(r.lo[i], truoc === null ? -Infinity : truoc - level.maxStep)
      const b = Math.min(r.hi[i], truoc === null ? Infinity : truoc + level.maxStep)
      idx[i] = clamp(i === p ? v : luu[i], a, b)
      truoc = idx[i]
    }
    ghim.add(p)
    return true
  }
  const tamRong = () => n ? Math.max(...idx) - Math.min(...idx) : 0
  const demNhay = () => idx.filter((v, i) => i > 0 && Math.abs(v - idx[i - 1]) >= 2).length
  /** Vị trí i có được phép mang giá trị v không. Nốt kết thì bất khả xâm phạm;
   *  phách mạnh thì đổi được nhưng chỉ sang một nốt phách mạnh khác. */
  const duocDat = (i: number, v: number) =>
    i !== cuoi && (!viTriManh.has(i) || manhVal.includes(v)) && (!ghim.has(i) || viTriManh.has(i))

  /** Nâng một phách mạnh lên nốt phách mạnh cao nhất còn hợp lệ. Có việc này thì
   *  các nốt quanh nó mới với lên được — bài lười ghim hết phách mạnh vào Đô làm
   *  trần cao độ cả bài tụt xuống, bậc 5 không cách nào chạm tới La và Si. */
  /** Khoảng khả thi của vị trí i khi TẠM BỎ ghim của chính nó. Không bỏ ra thì
   *  khoảng thu về đúng giá trị đang có, và mọi phép nâng đều thấy "không còn chỗ". */
  const khoangTai = (i: number) => {
    const g = new Set(ghim); g.delete(i)
    return lanTruyen(g)
  }
  const nangPhachManh = (): boolean => {
    let chon = -1, tri = -1
    for (const i of viTriManh) {
      const r = khoangTai(i)
      if (!r) continue
      const cao = Math.max(...manhVal.filter(x => x >= r.lo[i] && x <= r.hi[i]), -1)
      if (cao > idx[i] && cao > tri) { tri = cao; chon = i }
    }
    return chon >= 0 && datThu(chon, tri)
  }

  // Nốt mới của bậc phải có mặt — không thì bài bậc 5 chẳng khác gì bài bậc 4.
  // Giữ đúng thứ tự thầy khai báo (thấp → cao). Đã thử đặt nốt cao nhất trước cho
  // "khó trước dễ sau" nhưng đo ra tệ hơn: bậc 5 hụt 128/1500 thay vì 83/1500 —
  // đặt La trước thì Si chỉ còn cách một bước, còn đặt Si trước thì thường không
  // có chỗ nào nhận nổi Si ngay từ đầu.
  for (const p of level.mustPitches ?? []) {
    const v = level.pitches.indexOf(p)
    if (v < 0 || idx.includes(v)) continue
    let xong = false
    // Ưu tiên đặt NGOÀI câu 1 và câu 3 để không phá chỗ nhắc lại; hết chỗ mới vào.
    const thuDat = () => {
      for (const traNgoai of [true, false]) {
        for (let i = n - 2; i >= 0; i--) {
          if (traNgoai && trongCau13(i)) continue
          if (duocDat(i, v) && datThu(i, v)) return true
        }
      }
      return false
    }
    xong = thuDat()
    for (let lan = 0; !xong && lan < 6; lan++) {
      if (!nangPhachManh()) break
      xong = thuDat()
    }
    problems.push(xong
      ? `bài chưa dùng nốt ${p} của bậc ${level.id}, đã thêm`
      : `bài thiếu nốt ${p} mà không chỗ nào đặt được`)
  }

  /** Một nhịp mở rộng tầm: đẩy một nốt lên trần khả thi. */
  const moRong = (): boolean => {
    const r = lanTruyen(ghim)
    if (!r) return false
    let chon = -1, tri = -1
    for (let i = 0; i < n; i++) {
      if (!duocDat(i, idx[i])) continue
      // Ở phách mạnh phải đo bằng khoảng ĐÃ BỎ GHIM CỦA CHÍNH NÓ, và trần là
      // nốt phách mạnh cao nhất còn vừa khoảng đó.
      const rr = viTriManh.has(i) ? khoangTai(i) : r
      if (!rr) continue
      const canDat = viTriManh.has(i)
        ? Math.max(...manhVal.filter(v => v >= rr.lo[i] && v <= rr.hi[i]), -1)
        : rr.hi[i]
      if (canDat <= idx[i] || !duocDat(i, canDat)) continue
      // Ngoài câu 1/câu 3 luôn được ưu tiên, dù trần có thấp hơn một chút.
      if (chon >= 0 && trongCau13(i) && !trongCau13(chon)) continue
      if (canDat > tri || (!trongCau13(i) && trongCau13(chon))) { tri = canDat; chon = i }
    }
    return chon >= 0 && datThu(chon, tri)
  }

  /** Một nhịp thêm quãng nhảy: kéo một nốt ra mép khoảng khả thi. */
  const themNhay = (): boolean => {
    const r = lanTruyen(ghim)
    if (!r) return false
    let chon = -1, tri = -1, xa = 1
    for (let i = 1; i < n; i++) {
      const ung = viTriManh.has(i)
        ? manhVal.filter(v => v >= r.lo[i] && v <= r.hi[i])
        : [r.lo[i], r.hi[i]]
      for (const v of ung) {
        if (!duocDat(i, v)) continue
        const cach = Math.abs(v - idx[i - 1])
        if (cach < 2) continue
        if (chon >= 0 && trongCau13(i) && !trongCau13(chon)) continue
        if (cach > xa || (!trongCau13(i) && trongCau13(chon))) { xa = cach; chon = i; tri = v }
      }
    }
    return chon >= 0 && datThu(chon, tri)
  }

  // Tầm rộng và quãng nhảy phải nâng TRONG CÙNG MỘT VÒNG.
  // Chạy nối tiếp là hỏng: phần thêm quãng nhảy kéo nốt ra mép khoảng, mà mép
  // dưới thì thấp — nó kéo tụt đúng cái đỉnh mà phần mở rộng tầm vừa dựng lên,
  // xong không ai kiểm lại. Đo thật: bậc 10 hụt tầm 106/1500 bài mà lỗi báo ra
  // lại chỉ nói "đã thêm quãng nhảy".
  const rongDau = tamRong(), nhayDau = demNhay()
  for (let vong = 0; vong < 8; vong++) {
    const thieuNhay = demNhay() < (level.minLeaps ?? 0)
    const thieuRong = tamRong() < (level.minRange ?? 0)
    if (!thieuNhay && !thieuRong) break
    let tienBo = false
    if (thieuNhay) tienBo = themNhay() || tienBo
    if (thieuRong) tienBo = moRong()  || tienBo
    if (!tienBo) break
  }
  if (level.minRange) {
    if (tamRong() < level.minRange) problems.push(`bài chỉ trải ${tamRong()} bước, bậc ${level.id} cần ${level.minRange}`)
    else if (rongDau < level.minRange) problems.push(`bài quá hẹp so với bậc ${level.id}, đã mở rộng tầm`)
  }
  if (level.minLeaps) {
    if (demNhay() < level.minLeaps) problems.push(`bài chỉ có ${demNhay()} quãng nhảy, bậc ${level.id} cần ${level.minLeaps}`)
    else if (nhayDau < level.minLeaps) problems.push(`bài đi liền kề quá nhiều so với bậc ${level.id}, đã thêm quãng nhảy`)
  }

  // 6. Không lặp một nốt quá 3 lần — CHỈ sửa khi không phá vỡ thứ gì.
  //    Đây là yêu cầu MỀM (nghe cho đỡ nhàm), nên nó phải nhường mọi luật cứng.
  //    Bản cũ chỉ soi quãng nhảy nên vẫn đẩy được một nốt phách mạnh sang nốt
  //    cấm: bậc 3 sai phách mạnh 1077/3000 bài, mà không hề báo lỗi gì.
  let run = 1
  for (let i = 1; i < idx.length; i++) {
    if (idx[i] !== idx[i - 1]) { run = 1; continue }
    run++
    if (run <= 3) continue
    const thu = clamp(idx[i] + (idx[i] > 0 ? -1 : 1), 0, level.pitches.length - 1)
    const truocOk = Math.abs(thu - idx[i - 1]) <= level.maxStep
    const sauOk = i + 1 >= idx.length || Math.abs(idx[i + 1] - thu) <= level.maxStep
    const cuoiOk = !(level.endOnTonic && i === idx.length - 1)
    const manhOk = !viTriManh.has(i) || manhVal.includes(thu)
    // Không được kéo bài tụt xuống dưới sàn vừa dựng ở 5b.
    const thuNghiem = idx.slice(); thuNghiem[i] = thu
    const rongOk = !level.minRange || tamRong() < level.minRange ||
      Math.max(...thuNghiem) - Math.min(...thuNghiem) >= level.minRange
    const nhayOk = !level.minLeaps || demNhay() < level.minLeaps ||
      thuNghiem.filter((v, k) => k > 0 && Math.abs(v - thuNghiem[k - 1]) >= 2).length >= level.minLeaps
    const apChotOk = !(level.approachTonicByStep && level.endOnTonic && i === idx.length - 2 && thu > 1)
    if (truocOk && sauOk && cuoiOk && manhOk && rongOk && nhayOk && apChotOk && thu !== idx[i]) {
      problems.push('lặp một nốt quá 3 lần')
      idx[i] = thu; run = 1
    }
  }

  // 6b. CÂU NHẠC, chặng hai: chép CAO ĐỘ câu 1 sang câu 3.
  //
  //     Tiết tấu đã giống nhau từ 4a2 nên đây chỉ là ghi đè một mảng cùng độ dài.
  //     Nhưng bước 5 và 5b nắn cao độ theo khoảng khả thi của TỪNG vị trí, mà câu 3
  //     ở gần nốt kết hơn nên khoảng của nó hẹp hơn — hai câu vì thế đã trôi ra
  //     khác nhau. Chép lại rồi SOI LẠI TOÀN BỘ: chỗ nối có vượt bước không, phách
  //     mạnh có còn đúng không, sàn có tụt không. Hỏng bất cứ điều gì thì trả nguyên
  //     trạng — nhắc lại câu là luật MỀM, không được phép đạp lên luật cứng.
  if (bienCau) {
    const [a0, a1, c0, c1] = bienCau
    if (a1 - a0 === c1 - c0 && idx.slice(a0, a1).some((v, k) => v !== idx[c0 + k])) {
      const luu = idx.slice()
      /** Chép cao độ từ câu bắt đầu ở `tu` sang câu bắt đầu ở `den`, rồi GHIM CẢ
       *  HAI CÂU và lan truyền lại để câu 2 tự bắc cầu giữa chúng.
       *
       *  Chỉ soi chỗ nối rồi bỏ cuộc là hỏng ở bậc đi liền kề: maxStep 1 thì câu 1
       *  và câu 3 tự nhiên trôi cách nhau vài bước, chép xong bao giờ cũng gãy chỗ
       *  nối — bậc 9 chỉ nhắc lại được 14% số bài. Lan truyền lại thì câu 2 được
       *  phép đi đường khác để nối hai đầu, và chỗ nhắc lại giữ nguyên. */
      const chep = (tu: number, den: number) => {
        for (let i = 0; i < idx.length; i++) idx[i] = luu[i]
        for (let k = 0; k < a1 - a0; k++) idx[den + k] = idx[tu + k]
        const g = new Set(ghim)
        for (let k = 0; k < a1 - a0; k++) { g.add(a0 + k); g.add(c0 + k) }
        const r = lanTruyen(g)
        if (!r) return false
        let truoc: number | null = null
        for (let i = 0; i < n; i++) {
          const lo = Math.max(r.lo[i], truoc === null ? -Infinity : truoc - level.maxStep)
          const hi = Math.min(r.hi[i], truoc === null ? Infinity : truoc + level.maxStep)
          idx[i] = clamp(idx[i], lo, hi)
          truoc = idx[i]
        }
        return idx.slice(a0, a1).every((v, k) => v === idx[c0 + k]) &&
          [...viTriManh].every(i => manhVal.includes(idx[i])) &&
          (!level.minRange || tamRong() >= level.minRange) &&
          (!level.minLeaps || demNhay() >= level.minLeaps) &&
          (level.mustPitches ?? []).every(p => idx.includes(level.pitches.indexOf(p)))
      }
      // Thử CẢ HAI CHIỀU. Chép câu 1 sang câu 3 là chiều tự nhiên, nhưng phần nâng
      // sàn nhiều khi đã cắm nốt bắt buộc vào đúng câu 3 — chép đè lên là mất nó,
      // trong khi chép ngược lại thì vừa giữ được nốt đó vừa có chỗ nhắc lại.
      if (chep(a0, c0)) problems.push('câu 3 chưa nhắc lại câu 1, đã chép cao độ câu 1 sang')
      else if (chep(c0, a0)) problems.push('câu 3 chưa nhắc lại câu 1, đã chép ngược cao độ câu 3 về câu 1')
      else {
        for (let i = 0; i < idx.length; i++) idx[i] = luu[i]
        problems.push('câu 3 không nhắc lại câu 1 được mà không phá luật khác')
      }
    }
  }

  // 7. startBeat — tính lại từ đầu. LLM sai chỗ này thường xuyên nhất.
  const notesOut: PianoNote[] = []
  let beat = 0
  for (let i = 0; i < idx.length; i++) {
    notesOut.push({ pitch: level.pitches[idx[i]], startBeat: beat, duration: durs[i] })
    beat += durs[i]
  }
  if (notes.some((n, i) => notesOut[i] && n.startBeat !== notesOut[i].startBeat)) {
    problems.push('startBeat sai, đã tính lại')
  }

  // 8. bpm
  let bpm = Number(raw?.bpm)
  if (!Number.isFinite(bpm) || bpm < level.bpm[0] || bpm > level.bpm[1]) {
    if (Number.isFinite(bpm)) problems.push(`bpm ${raw?.bpm} ngoài khoảng`)
    bpm = clamp(Number.isFinite(bpm) ? bpm : level.bpm[0], level.bpm[0], level.bpm[1])
  }

  const title = (typeof raw?.title === 'string' && raw.title.trim()) ? raw.title.trim().slice(0, 60) : fallbackTitle
  return { exercise: { title, bpm, notes: notesOut, beatsPerBar: level.beatsPerBar }, problems }
}

/** Bài mẫu đúng luật — dùng khi AI hỏng hẳn hoặc chưa đăng nhập.
 *  Hình vòng cung: đi lên rồi quay về nốt chủ, mỗi lần 1 bước, lấp đủ số ô nhịp. */
export function template(level: PianoLevel, title: string): Exercise {
  const target = level.bars * level.beatsPerBar
  const unit = Math.min(...level.durations.filter(d => d >= 1)) || Math.min(...level.durations)
  const peak = level.pitches.length - 1

  const idx: number[] = []
  const durs: number[] = []
  let total = 0, i = 0, dir = 1
  while (total < target - 1e-9) {
    const fit = fitDur(level, target - total)
    if (fit == null) break
    const d = Math.min(fit, unit)
    idx.push(i); durs.push(d); total += d
    const conLai = Math.ceil((target - total) / unit)     // còn mấy nốt nữa để về nốt chủ
    // Đang lên mà chạm trần, hoặc không còn kịp xuống → quay đầu.
    if (dir === 1 && (i + 1 > peak || i + 1 > conLai - 1)) dir = -1
    // Đang xuống mà chạm đáy và bài còn dài → đi lên lại, đừng nằm im trên nốt chủ.
    else if (dir === -1 && i - 1 < 0 && conLai > 2) dir = 1
    i = clamp(i + dir, 0, peak)
  }
  if (idx.length) idx[idx.length - 1] = 0                  // chốt nốt kết ở nốt chủ

  let beat = 0
  const notes: PianoNote[] = idx.map((v, k) => {
    const n = { pitch: level.pitches[v], startBeat: beat, duration: durs[k] }
    beat += durs[k]
    return n
  })
  return { title: title || `Bài bậc ${level.id}`, bpm: level.bpm[0], notes, beatsPerBar: level.beatsPerBar }
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)) }
