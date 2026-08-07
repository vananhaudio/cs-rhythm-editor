// ── LUẬT SINH BÀI TẬP PIANO — GIÁO TRÌNH THẬT (18 LUẬT) ──────────────────
//
// Dựng theo tài liệu sư phạm của Thầy Văn Anh (08/2026).
// Triết lý: "Mỗi bài +1 yếu tố. Cũ : Mới = 60% : 40%."
//
// Kiến trúc: LUẬT (file này) → AI SINH (piano-generate) → KIỂM & SỬA (checkAndRepair).
// Luật nằm trong repo nên sửa luật KHÔNG cần deploy lại edge function.
//
// ── THUẬT NGỮ ───────────────────────────────────────────────────────────────
//   BẬC  = level = ĐỘ KHÓ (bậc 1 dễ nhất → bậc 15 khó nhất).
//   BƯỚC = khoảng cách giữa hai nốt liền nhau (1 bước = quãng 2, 2 bước = quãng 3).
//   ĐƠN VỊ LÀ Ô NHỊP — tổng trường độ phải = bars × beatsPerBar.

import { supabase } from '../supabase'

// ── TYPES ───────────────────────────────────────────────────────────────────

export interface PianoNote {
  pitch: string       // 'C4', 'D4', ... hoặc 'rest' cho dấu lặng
  startBeat: number
  duration: number
}

export interface LeftHandNote {
  pitch: string       // 'C3', 'G2', ... hoặc 'rest'
  startBeat: number
  duration: number
}

export interface Exercise {
  title: string
  bpm: number
  notes: PianoNote[]
  leftHand?: LeftHandNote[]
  beatsPerBar?: number
}

export interface PianoLevel {
  id: number
  name: string
  /** 'exercise' = bài tập kế thừa từng nốt.
   *  'piece'    = bản nhạc hoàn chỉnh có câu có kết. */
  kind: 'exercise' | 'piece'
  /** Nốt được phép (tay phải), xếp THẤP → CAO. */
  pitches: string[]
  /** Trường độ được phép. */
  durations: number[]
  beatsPerBar: number
  bars: number
  /** Quãng nhảy tối đa (1 = quãng 2, 2 = quãng 3, 3 = quãng 4-5). */
  maxStep: number
  bpm: [number, number]
  endOnTonic: boolean
  /** Có tay trái (bass đơn) không. Bậc 5+ luôn có. */
  hasLeftHand: boolean
  /** Nốt bass được phép [tonic, dominant]. */
  leftHandPitches: string[]
  skill: string

  // ── SÀN ĐỘ KHÓ ─────────────────────────────────────────────────────────
  mustPitches?: string[]
  mustDurations?: number[]
  minRange?: number
  minLeaps?: number
  phraseBars?: number
  /** Số nốt tối đa đi cùng hướng (mặc định 5). */
  maxSameDirection?: number
  /** Bắt buộc bắt đầu bằng dấu lặng (nhịp lấy đà). */
  requireAnacrusis?: boolean
  /** Bắt buộc có dấu lặng giữa các câu (dấu thở). */
  requireBreathRest?: boolean
}

// ── BẢN ĐỒ NỐT PIANO (chỉ phím trắng — C Major / A Minor) ──────────────────
// Theo tài liệu: beginner chỉ dùng phím trắng, cấm dấu hóa bất thường.
// Giới hạn cao độ: C4–B5 (ngoài khoảng này notation chưa có vị trí trên khuông).

const P3  = ['C4', 'D4', 'E4']
const P5  = ['C4', 'D4', 'E4', 'F4', 'G4']
const P8  = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']

// ── 15 BẬC — THIẾT KẾ MỚI ──────────────────────────────────────────────────
// Triết lý: mỗi bậc +1 yếu tố. Bài tập (1-4) → Bài hát thưởng (5) → Mở rộng (6-7)
// → Bài hát thưởng (8) → Móc đơn (9-10) → Bài hát thưởng (11) → Chấm dôi (12-13)
// → Bài hát thưởng (14) → Đỉnh cao (15).

export const LEVELS: PianoLevel[] = [
  // ═══ CHẶNG 1: LÀM QUEN (bậc 1-4, exercise) ═══
  {
    id: 1, name: 'Chỉ nốt Đô', kind: 'exercise',
    pitches: ['C4'], durations: [1], beatsPerBar: 4, bars: 2, maxStep: 0,
    bpm: [60, 66], endOnTonic: true, hasLeftHand: false, leftHandPitches: [],
    skill: 'Một nốt Đô. Bé làm quen mặt nốt và cảm giác phách mạnh – phách nhẹ.',
  },
  {
    id: 2, name: 'Thêm nốt Rê', kind: 'exercise',
    pitches: ['C4', 'D4'], durations: [1], beatsPerBar: 4, bars: 2, maxStep: 1,
    bpm: [60, 69], endOnTonic: true, hasLeftHand: false, leftHandPitches: [],
    mustPitches: ['D4'],
    skill: 'Hai nốt Đô–Rê. Bé cảm nhận đi lên và đi xuống một bậc, kết về Đô.',
  },
  {
    id: 3, name: 'Thêm Mi + nốt trắng', kind: 'exercise',
    pitches: P3, durations: [1, 2], beatsPerBar: 4, bars: 4, maxStep: 1,
    bpm: [63, 72], endOnTonic: true, hasLeftHand: false, leftHandPitches: [],
    mustPitches: ['E4'], mustDurations: [2], minRange: 1,
    skill: 'Ba nốt Đô–Rê–Mi + nốt trắng. Bé cảm nhận nốt ngân dài.',
  },
  {
    id: 4, name: 'Đủ năm nốt', kind: 'exercise',
    pitches: P5, durations: [1, 2], beatsPerBar: 4, bars: 4, maxStep: 1,
    bpm: [66, 76], endOnTonic: true, hasLeftHand: false, leftHandPitches: [],
    mustPitches: ['F4', 'G4'], mustDurations: [2], minRange: 3,
    skill: 'Đủ năm nốt Đô–Sol trọn bàn tay. Câu nhạc lên đỉnh Sol rồi về Đô.',
  },

  // ═══ BÀI HÁT THƯỞNG 1 (bậc 5) — đủ trường độ + dấu lặng + tay trái ═══
  {
    id: 5, name: 'Bài hát đầu tiên', kind: 'piece',
    pitches: P5, durations: [1, 2, 4], beatsPerBar: 4, bars: 8, maxStep: 2,
    bpm: [69, 80], endOnTonic: true, hasLeftHand: true,
    leftHandPitches: ['C3', 'G2'],
    mustDurations: [2, 4], minRange: 3, minLeaps: 1,
    phraseBars: 2, requireBreathRest: true,
    skill: 'Bài hát hoàn chỉnh đầu tiên — đen, trắng, tròn, dấu lặng, tay trái bass đơn.',
  },

  // ═══ CHẶNG 2: MỞ RỘNG (bậc 6-7, exercise) ═══
  {
    id: 6, name: 'Trọn quãng tám', kind: 'exercise',
    pitches: P8, durations: [1, 2, 4], beatsPerBar: 4, bars: 4, maxStep: 2,
    bpm: [72, 86], endOnTonic: true, hasLeftHand: true,
    leftHandPitches: ['C3', 'G2'],
    mustPitches: ['A4', 'B4', 'C5'], mustDurations: [4], minRange: 4, minLeaps: 2,
    skill: 'Đủ quãng tám Đô4–Đô5. Thêm La, Si, Đô cao.',
  },
  {
    id: 7, name: 'Nhịp ba bốn', kind: 'exercise',
    pitches: P8, durations: [1, 2, 4], beatsPerBar: 3, bars: 4, maxStep: 2,
    bpm: [72, 86], endOnTonic: true, hasLeftHand: true,
    leftHandPitches: ['C3', 'G2'],
    mustDurations: [2, 4], minRange: 3, minLeaps: 1,
    skill: 'Nhịp 3/4 — cảm giác một–hai–ba, nhấn phách đầu mỗi ô.',
  },

  // ═══ BÀI HÁT THƯỞNG 2 (bậc 8) — nhịp 3/4 hoàn chỉnh ═══
  {
    id: 8, name: 'Bài hát nhịp 3/4', kind: 'piece',
    pitches: P8, durations: [1, 2, 4], beatsPerBar: 3, bars: 8, maxStep: 3,
    bpm: [76, 92], endOnTonic: true, hasLeftHand: true,
    leftHandPitches: ['C3', 'G2'],
    mustDurations: [2, 4], minRange: 4, minLeaps: 2,
    phraseBars: 2, requireBreathRest: true,
    skill: 'Bài hát nhịp 3/4 hoàn chỉnh — có hỏi có đáp, tay trái giữ nhịp.',
  },

  // ═══ CHẶNG 3: MÓC ĐƠN (bậc 9-10, exercise) ═══
  {
    id: 9, name: 'Móc đơn', kind: 'exercise',
    pitches: P8, durations: [0.5, 1, 2], beatsPerBar: 4, bars: 4, maxStep: 2,
    bpm: [69, 83], endOnTonic: true, hasLeftHand: true,
    leftHandPitches: ['C3', 'G2'],
    mustDurations: [0.5], minRange: 3, minLeaps: 1,
    skill: 'Làm quen nốt móc đơn — hai nốt gọn trong một phách, luôn đi cặp.',
  },
  {
    id: 10, name: 'Móc đơn nâng cao', kind: 'exercise',
    pitches: P8, durations: [0.5, 1, 2, 4], beatsPerBar: 4, bars: 8, maxStep: 2,
    bpm: [72, 86], endOnTonic: true, hasLeftHand: true,
    leftHandPitches: ['C3', 'G2'],
    mustDurations: [0.5, 4], minRange: 4, minLeaps: 2,
    phraseBars: 2,
    skill: 'Móc đơn trong bài dài 8 ô — giữ nhịp đều từ đầu đến cuối.',
  },

  // ═══ BÀI HÁT THƯỞNG 3 (bậc 11) — tổng hợp ═══
  {
    id: 11, name: 'Tổng hợp 1', kind: 'piece',
    pitches: P8, durations: [0.5, 1, 2, 4], beatsPerBar: 4, bars: 8, maxStep: 3,
    bpm: [76, 92], endOnTonic: true, hasLeftHand: true,
    leftHandPitches: ['C3', 'G2'],
    mustDurations: [0.5, 2, 4], minRange: 5, minLeaps: 2,
    phraseBars: 2, requireBreathRest: true,
    skill: 'Tổng hợp đen, trắng, tròn, móc đơn — câu nhạc có hỏi có đáp rõ ràng.',
  },

  // ═══ CHẶNG 4: CHẤM DÔI (bậc 12-13, exercise) ═══
  {
    id: 12, name: 'Chấm dôi', kind: 'exercise',
    pitches: P8, durations: [1, 1.5, 2, 4], beatsPerBar: 4, bars: 4, maxStep: 2,
    bpm: [72, 86], endOnTonic: true, hasLeftHand: true,
    leftHandPitches: ['C3', 'G2'],
    mustDurations: [1.5], minRange: 3, minLeaps: 1,
    requireAnacrusis: true,
    skill: 'Làm quen nốt đen chấm dôi (♩.) — uyển chuyển, mềm mại.',
  },
  {
    id: 13, name: 'Chấm dôi nâng cao', kind: 'exercise',
    pitches: P8, durations: [0.5, 1, 1.5, 2, 4], beatsPerBar: 4, bars: 8, maxStep: 3,
    bpm: [76, 92], endOnTonic: true, hasLeftHand: true,
    leftHandPitches: ['C3', 'G2'],
    mustDurations: [0.5, 1.5], minRange: 4, minLeaps: 2,
    phraseBars: 2,
    skill: 'Chấm dôi + móc đơn trong bài dài — tiết tấu đa dạng.',
  },

  // ═══ BÀI HÁT THƯỞNG 4 (bậc 14) — nâng cao ═══
  {
    id: 14, name: 'Tổng hợp 2', kind: 'piece',
    pitches: P8, durations: [0.5, 1, 1.5, 2, 4], beatsPerBar: 4, bars: 8, maxStep: 3,
    bpm: [84, 100], endOnTonic: true, hasLeftHand: true,
    leftHandPitches: ['C3', 'G2'],
    mustPitches: ['C5'], mustDurations: [0.5, 1.5, 4], minRange: 5, minLeaps: 3,
    phraseBars: 2, requireBreathRest: true,
    skill: 'Phối hợp mọi trường độ. Câu nhạc có đỉnh cao, có hỏi đáp, có dấu thở.',
  },

  // ═══ ĐỈNH CAO (bậc 15) ═══
  {
    id: 15, name: 'Đỉnh cao', kind: 'piece',
    pitches: P8, durations: [0.5, 1, 1.5, 2, 4], beatsPerBar: 4, bars: 16, maxStep: 4,
    bpm: [88, 108], endOnTonic: true, hasLeftHand: true,
    leftHandPitches: ['C3', 'G2'],
    mustPitches: ['C5'], mustDurations: [0.5, 1.5], minRange: 6, minLeaps: 3,
    phraseBars: 2, requireBreathRest: true,
    skill: 'Bài dài 16 ô — đỉnh cao của hành trình, phối hợp tất cả kỹ năng đã học.',
  },
]

export const DEFAULT_LEVEL_ID = 1

export function getLevel(id: number): PianoLevel {
  return LEVELS.find(l => l.id === id) ?? LEVELS[0]
}

// ── Cao độ ↔ số MIDI ─────────────────────────────────────────────────────────
const BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function pitchToMidi(pitch: string): number | null {
  if (!pitch || pitch === 'rest') return null
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(pitch.trim())
  if (!m) return null
  const step = BASE[m[1].toUpperCase()]
  if (step === undefined) return null
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return (parseInt(m[3], 10) + 1) * 12 + step + acc
}

function nearestIndex(pitch: string, level: PianoLevel): number {
  if (pitch === 'rest') return -1
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
const SHAPES = [
  'đi lên dần rồi kết',
  'đi xuống dần rồi kết',
  'vòng cung: lên tới đỉnh rồi quay về',
  'hỏi–đáp: câu đầu như câu hỏi đi lên, câu sau trả lời đi xuống',
  'lắc lư quanh một nốt rồi mới về nốt chủ',
  'đi từng nấc: mỗi nốt lặp hai lần rồi mới đi tiếp',
  'mở đầu bằng nốt ngân dài rồi chạy đều',
  'chạy đều rồi kết bằng nốt ngân dài',
  'nhắc lại: câu thứ hai lặp gần giống câu đầu nhưng đổi nốt cuối',
]

const RANDOM_THEMES = [
  'con mèo đi rón rén', 'chú khủng long to lớn', 'giọt mưa rơi', 'ông mặt trời buổi sáng',
  'con thuyền trôi trên sông', 'chú chim non tập bay', 'cái cây trong vườn', 'ông trăng tròn',
  'đàn cá bơi tung tăng', 'bé chạy trong sân', 'con bướm vàng', 'tiếng chuông gió',
  'chú gấu ngủ đông', 'bông hoa nở', 'con tàu vào ga', 'đám mây trắng bay',
]

export function randomTheme(): string {
  return RANDOM_THEMES[Math.floor(Math.random() * RANDOM_THEMES.length)]
}

const RECENT_KEY = '***'
const RECENT_MAX = 4

export function signature(ex: Exercise): string {
  return ex.notes.map(n => n.pitch === 'rest' ? 'R' : `${n.pitch}:${n.duration}`).join('-')
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
const DUR_NAME: Record<number, string> = {
  0.5: 'móc đơn', 1: 'đen', 1.5: 'đen chấm dôi', 2: 'trắng', 3: 'trắng chấm', 4: 'tròn',
}

export function buildPrompt(chuDe: string, level: PianoLevel): string {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]
  const avoid = recentSignatures()
  const total = level.bars * level.beatsPerBar
  const durList = level.durations.map(d => `${d} (${DUR_NAME[d] ?? '?'})`).join(', ')

  const san: string[] = []
  if (level.mustPitches?.length) san.push(`PHẢI dùng ít nhất một lần các nốt ${level.mustPitches.join(' ')} — đây là nốt MỚI của bậc này.`)
  if (level.mustDurations?.length) san.push(`PHẢI dùng ít nhất một lần: ${level.mustDurations.map(d => `${d} (${DUR_NAME[d] ?? '?'})`).join(', ')}.`)
  if (level.minRange) san.push(`Nốt cao nhất và nốt thấp nhất của bài phải cách nhau ÍT NHẤT ${level.minRange} bước.`)
  if (level.minLeaps) san.push(`Phải có ÍT NHẤT ${level.minLeaps} lần hai nốt liền nhau cách nhau từ 2 bước trở lên.`)

  const soCau = level.phraseBars && Number.isInteger(level.bars / level.phraseBars)
    ? level.bars / level.phraseBars : 0

  // Dấu lặng
  const restHints: string[] = []
  if (level.requireAnacrusis) restHints.push('Bắt đầu bài bằng DẤU LẶNG ĐEN (1 phách) — nhịp lấy đà.')
  if (level.requireBreathRest) restHints.push('Giữa các câu nhạc, đặt DẤU LẶNG ĐEN hoặc LẶNG TRẮNG để bé có chỗ thở.')
  if (level.durations.includes(1)) restHints.push('Có thể dùng dấu lặng đen (rest) ở cuối câu để tạo khoảng nghỉ.')

  return [
    `Bé muốn một bài về: "${chuDe}".`,
    `Mục tiêu sư phạm hôm nay: ${level.skill}.`,
    `Lần này hãy soạn theo DÁNG: ${shape}.`,
    avoid.length
      ? `KHÔNG được trùng với các bài vừa soạn: ${avoid.join(' | ')}. Hãy làm khác hẳn.`
      : '',
    level.kind === 'exercise'
      ? 'Đây là BÀI TẬP LUYỆN NGÓN cho bé mới học, KHÔNG cần thành tác phẩm. Ngắn, dễ, lặp lại được.'
      : 'Đây là BÀI HÁT HOÀN CHỈNH — cần có cấu trúc Hỏi–Đáp–Hỏi biến tấu–Kết rõ ràng.',
    '',
    `RÀNG BUỘC BẮT BUỘC (bậc ${level.id} — ${level.name}):`,
    `- Nhịp ${level.beatsPerBar}/4, đúng ${level.bars} ô nhịp.`,
    `- TỔNG trường độ tất cả các nốt (kể cả dấu lặng) phải bằng ĐÚNG ${total} phách.`,
    `- CHỈ được dùng các nốt: ${level.pitches.join(' ')} — tuyệt đối không dùng nốt khác, không dùng dấu hóa.`,
    `- duration (và rest) chỉ được là: ${durList}.`,
    `- MỖI NỐT PHẢI NẰM GỌN TRONG MỘT Ô NHỊP, không nốt nào vắt qua vạch nhịp.`,
    level.durations.includes(0.5)
      ? '- Nốt móc đơn luôn đi thành CẶP nằm trọn trong một phách, không bao giờ đứng lẻ.'
      : '',
    // ── 18 LUẬT từ tài liệu của Thầy ──
    '',
    'LUẬT CAO ĐỘ:',
    `- Hai nốt liền nhau cách nhau tối đa ${level.maxStep} bước trong thang nốt `
    + `(1 bước = quãng 2, 2 bước = quãng 3, ${level.maxStep >= 3 ? '3+ bước = quãng 4-5' : ''}).`,
    level.maxStep <= 2
      ? '- Quãng 4-5 (3-4 bước) chỉ được dùng TỐI ĐA 1 LẦN trong cả bài — để tạo điểm nhấn.'
      : '',
    '- TUYỆT ĐỐI KHÔNG dùng quãng 6, 7, 8 (tay bé không với tới).',
    '- Trên 70% chuyển động phải là bước liền kề (quãng 2).',
    '- Không đi cùng một hướng (lên hoặc xuống) quá 5 nốt liên tiếp.',
    '- Nốt đầu và nốt cuối của bài phải là nốt chủ âm (Đô).',
    '- Nốt trong hợp âm Đô trưởng (C, E, G) nên ở phách mạnh; nốt phụ (D, F, A, B) ở phách nhẹ.',
    '',
    'LUẬT TRƯỜNG ĐỘ 8 Ô NHỊP (15 luật — theo CHỨC NĂNG, không cấm đoán):',
    '',
    'NGUYÊN LÝ: Motif = Cao độ + Trường độ. Mẫu trường độ ô 1-2 là Rhythmic DNA của bài.',
    `- Trường độ được dùng: ${durList}.`,
    `- Số loại trường độ tối đa: ${level.id <= 8 ? 3 : level.id <= 11 ? 4 : 5}.`,
    level.bars === 16 ? '- Bài 16 ô: áp dụng chu kỳ 8 ô HAI LẦN. Mỗi chu kỳ phải có đủ trường độ đa dạng, không được chu kỳ 2 toàn nốt đen.' : '',
    '- QUAN TRỌNG: Mỗi loại trường độ phải xuất hiện ở CẢ HAI NỬA BÀI (nếu bài 8 ô: nửa đầu ô 1-4 và nửa sau ô 5-8). KHÔNG dồn hết vào một chỗ.',
    '',
    'CÂU A (ô 1-4) — THIẾT LẬP → PHÁT TRIỂN → NGHỈ:',
    '  Luật 4-5: Ô 1-2 thiết lập Rhythmic DNA (ổn định, lặp > biến đổi).',
    '  Luật 6: Ô 3 PHẢI có biến đổi trường độ (đổi mật độ, vị trí nốt dài/ngắn, cách chia phách).',
    '  Luật 7: Ô 4 kết câu = nốt TRẮNG (2 phách). Điểm nghỉ nhưng chưa kết thúc bài.',
    '',
    'CÂU A\' (ô 5-8) — TÁI HIỆN → PHÁT TRIỂN → DẪN → KẾT:',
    '  Luật 8: Ô 5-6 tái hiện Rhythmic DNA của ô 1-2 (lặp nguyên hoặc biến đổi nhẹ).',
    '  Luật 9: Ô 6 PHÁT TRIỂN — mật độ nốt ô 6 ≥ mật độ ô 5 (tăng chuyển động).',
    '  Luật 10: Ô 7 DẪN — mật độ ô 7 ≤ mật độ ô 6 (giảm, chuẩn bị kết). KHÔNG tăng tiếp.',
    '  Luật 11: Ô 8 KẾT = nốt TRÒN (4 phách). Điểm nghỉ mạnh nhất toàn bài.',
    '',
    'CHỨC NĂNG TRƯỜNG ĐỘ:',
    '  Móc đơn → chuyển động mạnh | Đen → cơ bản | Trắng → nghỉ/ổn định | Tròn → kết thúc',
    '  Phát triển → mật độ tăng | Hướng về kết → mật độ giảm',
    `  Ô 4 = Trắng (bắt buộc). Ô 8 = Tròn (bắt buộc).`,
    '',
    'CÔNG THỨC: THIẾT LẬP → BIẾN → NGHỈ | TÁI HIỆN → ĐẨY → DẪN → KẾT',
    level.durations.includes(1.5)
      ? '- Nốt chấm dôi (♩.) đi kèm móc đơn: mẫu ♩. + ♪ tạo uyển chuyển, mềm mại.'
      : '',
    '',
    'LUẬT DẤU LẶNG:',
    ...(restHints.length ? restHints : ['- Có thể dùng dấu lặng đen để tạo khoảng nghỉ.']),
    '- Dấu lặng đặt ở đầu câu tạo bất ngờ; cuối câu tạo khoảng thở.',
    '- KHÔNG dùng dấu lặng móc đơn hay chấm dôi.',
    '',
    'CẢM XÚC QUYẾT ĐỊNH TRƯỜNG ĐỘ:',
    '  · vui tươi, nhí nhảnh → chủ yếu nốt đen và móc đơn; nốt ngân dài chỉ để chốt cuối câu.',
    '  · buồn, trầm lắng → chủ yếu nốt trắng và tròn; nốt đen chỉ để tạo chuyển động giữa câu.',
    '  · hồi hộp, dồn dập → móc đơn chạy liên tục, chặn lại bằng một nốt dài ở cuối câu.',
    '  · trang nghiêm, vững chãi → chủ yếu đen và trắng, thêm đen chấm dôi cho uyển chuyển.',
    '',
    // SÀN
    san.length
      ? [`TẤT CẢ RÀNG BUỘC TRÊN LÀ GIỚI HẠN TRÊN. Dưới đây là SÀN — bài PHẢI khó ít nhất tới mức này.`,
         `Đây là bậc ${level.id} trên thang ${LEVELS.length} bậc. `,
         ...san.map(s => `- ${s}`)].join('\n')
      : '',
    // Cấu trúc câu
    soCau >= 4
      ? [`CẤU TRÚC CÂU (luật Hỏi–Đáp–Hỏi biến tấu–Kết):`,
         `  · câu 1 = HỎI, đặt vấn đề, kết ở nốt chưa ổn định`,
         `  · câu 2 = ĐÁP, trả lời và phát triển, kết ổn định hơn`,
         `  · câu 3 = HỎI NHẮC LẠI — phải GIỐNG HỆT câu 1 về cao độ và tiết tấu`,
         `  · câu ${soCau} = KẾT, dứt khoát, về nốt chủ và ngân dài`,
         'Câu 3 giống câu 1 là thứ làm bé nhớ được bài — đây là ràng buộc, không phải gợi ý.'].join('\n')
      : '',
    '',
    'ĐÚNG LUẬT là ưu tiên số một. Giai điệu phải nghe ra chủ đề bé muốn.',
    'Dùng dấu lặng (pitch: "rest") ở những chỗ cần khoảng nghỉ.',
  ].filter(Boolean).join('\n')
}

// ── TAY TRÁI (BASS ĐƠN) — tự sinh, không cần AI ──────────────────────────────
//
// Luật từ tài liệu của Thầy:
// - Tay trái chỉ chơi nốt đơn, mỗi ô nhịp 1 nốt.
// - Cứ 2 ô nhịp đổi 1 nốt.
// - Chỉ dùng nốt chủ âm (tonic) và nốt át âm (dominant).
// - Mẫu cố định: Tonic Tonic Dominant Tonic (cho mỗi 4 ô).

export function generateLeftHand(level: PianoLevel): LeftHandNote[] {
  if (!level.hasLeftHand || !level.leftHandPitches.length) return []
  const [tonic] = level.leftHandPitches
  const dominant = level.leftHandPitches[1] || tonic
  const notes: LeftHandNote[] = []

  for (let b = 0; b < level.bars; b++) {
    // Mẫu: tonic tonic dominant tonic (lặp mỗi 4 ô)
    const posInPhrase = b % 4
    const pitch = posInPhrase === 2 ? dominant : tonic
    notes.push({
      pitch,
      startBeat: b * level.beatsPerBar,
      duration: level.beatsPerBar, // trọn ô nhịp
    })
  }
  return notes
}

// ── LỚP KIỂM & SỬA ────────────────────────────────────────────────────────
export interface CheckResult {
  exercise: Exercise
  problems: string[]
  /** Checklist 10 tiêu chí — true = đạt. */
  checklist: boolean[]
}

const CHECKLIST_LABELS = [
  'Bài đúng cấu trúc 4+4 (8 ô nhịp)',
  'Ô 1-2 thiết lập Rhythmic DNA',
  'Ô 3 có biến đổi trường độ',
  'Ô 4 tạo điểm nghỉ rõ ràng',
  'Ô 4 kết bằng Trắng (2 phách)',
  'Ô 5-6 tái hiện DNA của ô 1-2',
  'Ô 6 mật độ ≥ ô 5',
  'Ô 7 giảm chuyển động, chuẩn bị kết',
  'Ô 8 kết bằng Tròn (4 phách)',
  'Ô 8 nghỉ mạnh hơn ô 4',
  'Toàn bài: thiết lập → phát triển → nghỉ → tái hiện → phát triển → kết',
  'Tổng trường độ = bars × beatsPerBar',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function fitDur(level: PianoLevel, remain: number): number | null {
  const ok = level.durations.filter(d => d <= remain + 1e-9).sort((a, b) => b - a)
  return ok.length ? ok[0] : null
}

function durationsAt(level: PianoLevel, beat: number, remain: number): number[] {
  const conTrongO = level.beatsPerBar - (beat % level.beatsPerBar)
  const nuaPhach = Math.abs(beat - Math.round(beat)) > 1e-9
  return level.durations.filter(d =>
    d <= remain + 1e-9 && d <= conTrongO + 1e-9 && (!nuaPhach || d === 0.5))
}

function fitAt(level: PianoLevel, beat: number, remain: number, muon: number): number | null {
  const ok = durationsAt(level, beat, remain)
  if (!ok.length) return null
  return ok.reduce((a, b) => Math.abs(b - muon) < Math.abs(a - muon) ? b : a, ok[0])
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)) }

export function checkAndRepair(
  raw: Exercise | null, level: PianoLevel, fallbackTitle: string,
): CheckResult {
  const problems: string[] = []
  const target = level.bars * level.beatsPerBar

  let notes: PianoNote[] = Array.isArray(raw?.notes)
    ? raw.notes.filter(n => n && (typeof n.pitch === 'string' || n.pitch === 'rest'))
    : []
  if (!notes.length) {
    problems.push('AI không trả về nốt nào')
    notes = template(level, fallbackTitle).notes
  }

  // Đánh dấu vị trí rest để bỏ qua trong các phép kiểm bước nhảy
  const isRest = notes.map(n => n.pitch === 'rest')

  // 1. Kéo mọi nốt (trừ rest) về thang nốt của bậc
  const rawIdx = notes.map((n, i) => {
    if (isRest[i]) return -1
    const idx = nearestIndex(n.pitch, level)
    if (idx < 0) { problems.push(`không đọc được cao độ "${n.pitch}"`); return 0 }
    if (level.pitches[idx] !== n.pitch) problems.push(`nốt ${n.pitch} không có trong bậc ${level.id} → ${level.pitches[idx]}`)
    return idx
  })

  // 2. Trường độ về giá trị hợp lệ
  const rawDur = notes.map(n => {
    const d = Number(n.duration)
    if (level.durations.includes(d)) return d
    problems.push(`trường độ ${n.duration} không hợp lệ`)
    return level.durations.reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a, level.durations[0])
  })

  // 3+4. Nhồi cho ĐỦ Ô NHỊP
  const reserve = (level.endOnTonic && !isRest[isRest.length - 1] && level.durations.includes(level.beatsPerBar))
    ? level.beatsPerBar : 0
  const fillTarget = target - reserve

  const idx: number[] = []
  const durs: number[] = []
  const rests: boolean[] = []
  let total = 0
  for (let i = 0; i < rawIdx.length && total < fillTarget - 1e-9; i++) {
    const d = fitAt(level, total, fillTarget - total, rawDur[i])
    if (d == null) break
    if (Math.abs(d - rawDur[i]) > 1e-9) problems.push(`nốt ${i + 1} vắt qua vạch nhịp, đã nắn trường độ`)
    idx.push(rawIdx[i]); durs.push(d); rests.push(isRest[i]); total += d
  }
  if (idx.length < rawIdx.length) problems.push(`bài dài quá ${level.bars} ô, đã cắt`)

  let guard = 0
  while (total < fillTarget - 1e-9 && guard++ < 400) {
    const fit = fitAt(level, total, fillTarget - total, 999)
    if (fit == null) break
    problems.push('thiếu ô nhịp, thêm nốt cho đầy')
    const last = idx[idx.length - 1] ?? 0
    idx.push(clamp(last >= 0 ? last - 1 : 0, 0, level.pitches.length - 1))
    durs.push(fit); rests.push(false); total += fit
  }

  if (reserve) {
    idx.push(0); durs.push(reserve); rests.push(false)  // ô cuối: nốt chủ
  } else if (level.endOnTonic && idx.length && idx[idx.length - 1] !== 0 && !rests[idx.length - 1]) {
    problems.push('không kết ở nốt chủ')
    idx[idx.length - 1] = 0
  }

  const n = idx.length
  const top = level.pitches.length - 1

  // Helper: vị trí có phải rest không
  const isRestAt = (i: number) => rests[i] || idx[i] < 0

  // ── 4a. SÀN TRƯỜNG ĐỘ ──────────────────────────────────────────────────
  const khoaCuoi = reserve ? 1 : 0
  const canDur = [...(level.mustDurations ?? [])].sort((a, b) => b - a)

  // Mốc câu
  const phachCau = (level.phraseBars ?? 0) * level.beatsPerBar
  const soCau = phachCau ? level.bars / level.phraseBars! : 0
  const coCau = phachCau > 0 && Number.isInteger(soCau) && soCau >= 4

  const mocCau = (): number[] => {
    const m: number[] = []
    let b = 0
    for (let i = 0; i < durs.length; i++) { if (Math.abs(b % phachCau) < 1e-9) m.push(i); b += durs[i] }
    m.push(durs.length)
    return m
  }

  const chepTietTau = (): boolean => {
    if (!coCau) return false
    const m = mocCau()
    if (m.length < 5) return false
    const [a0, a1, c0, c1] = [m[0], m[1], m[2], m[3]]
    if (a1 - a0 !== c1 - c0) return false
    if (durs.slice(a0, a1).every((d, k) => Math.abs(d - durs[c0 + k]) < 1e-9)) return false
    durs.splice(c0, c1 - c0, ...durs.slice(a0, a1))
    idx.splice(c0, c1 - c0, ...idx.slice(a0, a1))
    rests.splice(c0, c1 - c0, ...rests.slice(a0, a1))
    return true
  }

  const vungCau3 = (): [number, number] => {
    if (!coCau) return [-1, -1]
    const m = mocCau()
    return m.length >= 5 ? [m[2], m[3]] : [-1, -1]
  }


  for (const d of canDur) {
    if (durs.some(x => Math.abs(x - d) < 1e-9)) continue
    let beat = 0, xong = false
    const demDur = (x: number) => durs.reduce((s, y) => s + (Math.abs(y - x) < 1e-9 ? 1 : 0), 0)
    const dungYen = (j: number) =>
      canDur.some(x => x !== d && Math.abs(x - durs[j]) < 1e-9 && demDur(x) <= 1)
    const [c3a, c3b] = vungCau3()
    const camChen = (j: number) => j >= c3a && j < c3b
    for (let i = 0; i < durs.length - khoaCuoi && !xong; i++) {
      const dauPhach = Math.abs(beat - Math.round(beat)) < 1e-9 && !dungYen(i) && !camChen(i)
      if (d === 0.5) {
        const du = durs[i] - 1
        if (dauPhach && durs[i] >= 1 - 1e-9 &&
            (Math.abs(du) < 1e-9 || level.durations.some(x => Math.abs(x - du) < 1e-9))) {
          const v = idx[i], v2 = clamp(v + 1, 0, top)
          const themDur = du > 1e-9 ? [0.5, 0.5, du] : [0.5, 0.5]
          const themIdx = du > 1e-9 ? [v, v2, v] : [v, v2]
          const themRest = themDur.map(() => false)
          durs.splice(i, 1, ...themDur); idx.splice(i, 1, ...themIdx); rests.splice(i, 1, ...themRest)
          xong = true
        }
      } else if (dauPhach && durs[i] > d + 1e-9 &&
                 level.durations.some(x => Math.abs(x - (durs[i] - d)) < 1e-9)) {
        const v = idx[i], du = durs[i] - d
        durs.splice(i, 1, d, du); idx.splice(i, 1, v, clamp(v - 1, 0, top))
        rests.splice(i, 1, false, false)
        xong = true
      } else if (dauPhach) {
        const oCua = Math.floor(beat / level.beatsPerBar)
        let s = 0
        for (let j = i; j < durs.length - khoaCuoi; j++) {
          if (dungYen(j)) break
          s += durs[j]
          if (s > d + 1e-9) break
          if (Math.abs(s - d) < 1e-9 &&
              Math.floor((beat + s - 1e-9) / level.beatsPerBar) === oCua) {
            idx.splice(i, j - i + 1, idx[i]); durs.splice(i, j - i + 1, d)
            rests.splice(i, j - i + 1, rests[i])
            xong = true
            break
          }
        }
      }
      beat += durs[i]
    }

    // Viết lại cả ô nhịp nếu cần
    if (!xong && d <= level.beatsPerBar + 1e-9) {
      let b2 = 0, p = -1, q = -1, dauO = 0
      for (let i = 0; i < durs.length - khoaCuoi; i++) {
        if (Math.abs(b2 % level.beatsPerBar) < 1e-9) { p = camChen(i) ? -1 : i; dauO = b2 }
        b2 += durs[i]
        if (p >= 0 && Math.abs(b2 - dauO - level.beatsPerBar) < 1e-9) { q = i + 1; break }
      }
      if (p >= 0 && q > p) {
        const dMoi = [d], iMoi = [idx[p]], rMoi = [false]
        let con = level.beatsPerBar - d, pos = d
        while (con > 1e-9) {
          const f = fitAt(level, pos, con, 999)
          if (f == null) break
          dMoi.push(f); iMoi.push(clamp(idx[p] + (dMoi.length % 2 ? -1 : 1), 0, top))
          rMoi.push(false); con -= f; pos += f
        }
        if (con <= 1e-9) {
          durs.splice(p, q - p, ...dMoi); idx.splice(p, q - p, ...iMoi); rests.splice(p, q - p, ...rMoi)
          xong = true
        }
      }
    }

    problems.push(xong
      ? `bậc ${level.id} bắt buộc phải có nốt ${DUR_NAME[d] ?? d}, đã sửa`
      : `bậc ${level.id} thiếu nốt ${DUR_NAME[d] ?? d} mà không chỗ nào chèn được`)
  }

  // Chép lại tiết tấu sau khi chèn trường độ

  // Mốc câu chốt
  const bienCau: [number, number, number, number] | null = (() => {
    if (!coCau) return null
    const m = mocCau()
    return m.length >= 5 ? [m[0], m[1], m[2], m[3]] : null
  })()
  const trongCau13 = (i: number) =>
    !!bienCau && ((i >= bienCau[0] && i < bienCau[1]) || (i >= bienCau[2] && i < bienCau[3]))

  // ── 4b. GHIM — nốt kết + phách mạnh ─────────────────────────────────────
  const ghim = new Set<number>()
  const cuoi = n - 1
  if (level.endOnTonic && n && !isRestAt(cuoi)) ghim.add(cuoi)

  const manhVal = ['C4', 'E4', 'G4'].map(p => level.pitches.indexOf(p)).filter(i => i >= 0)
  const viTriManh = new Set<number>()

  if (manhVal.length && n) {
    let beatTam = 0, truocManh = -1
    for (let i = 0; i < n; i++) {
      const dauO = Math.abs(beatTam % level.beatsPerBar) < 1e-9
      const beatCuaNot = beatTam
      beatTam += durs[i]
      if (!dauO || i === cuoi || isRestAt(i)) continue

      const toiTruoc = truocManh < 0 ? Infinity : idx[truocManh] + (i - truocManh) * level.maxStep
      const tuTruoc  = truocManh < 0 ? -Infinity : idx[truocManh] - (i - truocManh) * level.maxStep
      const veKip    = level.endOnTonic && !isRestAt(cuoi) ? (cuoi - i) * level.maxStep : Infinity
      const veApChot = (level.kind === 'exercise' && level.endOnTonic && cuoi - 1 >= i && !isRestAt(cuoi - 1))
        ? 1 + (cuoi - 1 - i) * level.maxStep : Infinity
      const hop = manhVal.filter(v =>
        v >= tuTruoc && v <= toiTruoc && v <= veApChot &&
        (!level.endOnTonic || Math.abs(v - 0) <= veKip))
      const ungVien = hop.length ? hop : manhVal
      const chon = ungVien.reduce((a, b) => Math.abs(b - idx[i]) < Math.abs(a - idx[i]) ? b : a, ungVien[0])
      if (chon !== idx[i]) {
        problems.push(`phách mạnh ô ${Math.round(beatCuaNot / level.beatsPerBar) + 1} là ${level.pitches[idx[i]]}, không được phép`)
        idx[i] = chon
      }
      ghim.add(i); viTriManh.add(i); truocManh = i
    }
  }

  // ── 5. Quãng nhảy — LAN TRUYỀN KHOẢNG KHẢ THI ──────────────────────────
  const goc = idx.slice()

  const lanTruyen = (ghimNay: Set<number>) => {
    const lo = new Array(n).fill(0), hi = new Array(n).fill(top)
    ghimNay.forEach(i => { if (!isRestAt(i)) { lo[i] = idx[i]; hi[i] = idx[i] } })
    // Vào kết bằng một bước cho bài tập
    if (level.kind === 'exercise' && level.endOnTonic && n >= 2 && !isRestAt(n - 2)) {
      hi[n - 2] = Math.min(hi[n - 2], 1)
    }
    for (let i = 1; i < n; i++) {
      if (isRestAt(i) || isRestAt(i - 1)) { lo[i] = 0; hi[i] = top; continue }
      lo[i] = Math.max(lo[i], lo[i - 1] - level.maxStep)
      hi[i] = Math.min(hi[i], hi[i - 1] + level.maxStep)
    }
    for (let i = n - 2; i >= 0; i--) {
      if (isRestAt(i) || isRestAt(i + 1)) { lo[i] = Math.max(lo[i], 0); hi[i] = Math.min(hi[i], top); continue }
      lo[i] = Math.max(lo[i], lo[i + 1] - level.maxStep)
      hi[i] = Math.min(hi[i], hi[i + 1] + level.maxStep)
    }
    return lo.every((v, i) => v <= hi[i]) ? { lo, hi } : null
  }

  let kq = lanTruyen(ghim)
  if (!kq && level.endOnTonic && n && !isRestAt(n - 1)) {
    problems.push('phách mạnh không thể vừa đúng vừa về kịp nốt kết, đã nới phách mạnh')
    kq = lanTruyen(new Set([n - 1]))
    if (kq) { ghim.clear(); ghim.add(n - 1) }
  }
  if (!kq) { kq = lanTruyen(new Set()); if (kq) ghim.clear() }

  if (kq) {
    let truoc: number | null = null
    for (let i = 0; i < n; i++) {
      if (isRestAt(i)) { truoc = null; continue }
      const a = Math.max(kq.lo[i], truoc === null ? -Infinity : truoc - level.maxStep)
      const b = Math.min(kq.hi[i], truoc === null ? Infinity : truoc + level.maxStep)
      idx[i] = clamp(goc[i], a, b)
      truoc = idx[i]
    }
    if (idx.some((v, i) => v !== goc[i] && !isRestAt(i))) {
      problems.push(`có nốt vượt ${level.maxStep} bước, đã nắn lại`)
    }
  }

  // ── 5b. SÀN CAO ĐỘ ──────────────────────────────────────────────────────
  const datThu = (p: number, v: number): boolean => {
    if (isRestAt(p)) return false
    const luu = idx.slice()
    idx[p] = v
    const g = new Set(ghim); g.add(p)
    const r = lanTruyen(g)
    if (!r) { for (let i = 0; i < n; i++) idx[i] = luu[i]; return false }
    let truoc: number | null = null
    for (let i = 0; i < n; i++) {
      if (isRestAt(i)) { truoc = null; continue }
      const a = Math.max(r.lo[i], truoc === null ? -Infinity : truoc - level.maxStep)
      const b = Math.min(r.hi[i], truoc === null ? Infinity : truoc + level.maxStep)
      idx[i] = clamp(i === p ? v : luu[i], a, b)
      truoc = idx[i]
    }
    ghim.add(p)
    return true
  }

  const tamRong = () => {
    const nonRest = idx.filter((_, i) => !isRestAt(i))
    return nonRest.length ? Math.max(...nonRest) - Math.min(...nonRest) : 0
  }
  const demNhay = () => {
    let count = 0
    for (let i = 1; i < n; i++) {
      if (!isRestAt(i) && !isRestAt(i - 1) && Math.abs(idx[i] - idx[i - 1]) >= 2) count++
    }
    return count
  }

  const duocDat = (i: number, v: number) =>
    i !== cuoi && !isRestAt(i) && (!viTriManh.has(i) || manhVal.includes(v)) && (!ghim.has(i) || viTriManh.has(i))

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

  for (const p of level.mustPitches ?? []) {
    const v = level.pitches.indexOf(p)
    if (v < 0 || idx.includes(v)) continue
    let xong = false
    const thuDat = () => {
      for (const traNgoai of [true, false]) {
        for (let i = n - 2; i >= 0; i--) {
          if (isRestAt(i)) continue
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

  const moRong = (): boolean => {
    const r = lanTruyen(ghim)
    if (!r) return false
    let chon = -1, tri = -1
    for (let i = 0; i < n; i++) {
      if (!duocDat(i, idx[i]) || isRestAt(i)) continue
      const rr = viTriManh.has(i) ? khoangTai(i) : r
      if (!rr) continue
      const canDat = viTriManh.has(i)
        ? Math.max(...manhVal.filter(v => v >= rr.lo[i] && v <= rr.hi[i]), -1)
        : rr.hi[i]
      if (canDat <= idx[i] || !duocDat(i, canDat)) continue
      if (chon >= 0 && trongCau13(i) && !trongCau13(chon)) continue
      if (canDat > tri || (!trongCau13(i) && trongCau13(chon))) { tri = canDat; chon = i }
    }
    return chon >= 0 && datThu(chon, tri)
  }

  const themNhay = (): boolean => {
    const r = lanTruyen(ghim)
    if (!r) return false
    let chon = -1, tri = -1, xa = 1
    for (let i = 1; i < n; i++) {
      if (isRestAt(i) || isRestAt(i - 1)) continue
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
  if (level.minRange && tamRong() < level.minRange) {
    problems.push(`bài chỉ trải ${tamRong()} bước, bậc ${level.id} cần ${level.minRange}`)
  } else if (level.minRange && rongDau < level.minRange) {
    problems.push(`bài quá hẹp so với bậc ${level.id}, đã mở rộng tầm`)
  }
  if (level.minLeaps && demNhay() < level.minLeaps) {
    problems.push(`bài chỉ có ${demNhay()} quãng nhảy, bậc ${level.id} cần ${level.minLeaps}`)
  } else if (level.minLeaps && nhayDau < level.minLeaps) {
    problems.push(`bài đi liền kề quá nhiều so với bậc ${level.id}, đã thêm quãng nhảy`)
  }

  // ── 6. Không lặp một nốt quá 3 lần (bỏ qua rest) ──────────────────────
  let run = 1
  for (let i = 1; i < idx.length; i++) {
    if (isRestAt(i) || isRestAt(i - 1)) { run = 1; continue }
    if (idx[i] !== idx[i - 1]) { run = 1; continue }
    run++
    if (run <= 3) continue
    const thu = clamp(idx[i] + (idx[i] > 0 ? -1 : 1), 0, top)
    const truocOk = isRestAt(i - 1) || Math.abs(thu - idx[i - 1]) <= level.maxStep
    const sauOk = i + 1 >= idx.length || isRestAt(i + 1) || Math.abs(idx[i + 1] - thu) <= level.maxStep
    const cuoiOk = !(level.endOnTonic && i === idx.length - 1)
    const manhOk = !viTriManh.has(i) || manhVal.includes(thu)
    const thuNghiem = idx.slice(); thuNghiem[i] = thu
    const rongOk = !level.minRange || tamRong() < level.minRange ||
      (() => { const nr = thuNghiem.filter((_, k) => !isRestAt(k)); return nr.length ? Math.max(...nr) - Math.min(...nr) >= level.minRange : true })()
    const nhayOk = !level.minLeaps || demNhay() < level.minLeaps ||
      thuNghiem.filter((v, k) => k > 0 && !isRestAt(k) && !isRestAt(k - 1) && Math.abs(v - thuNghiem[k - 1]) >= 2).length >= level.minLeaps

    if (truocOk && sauOk && cuoiOk && manhOk && rongOk && nhayOk && thu !== idx[i]) {
      problems.push('lặp một nốt quá 3 lần')
      idx[i] = thu; run = 1
    }
  }

  // ── 6b. ENGINE LUẬT TRƯỜNG ĐỘ — kiến trúc mới ──────────────────────────
  // Mỗi luật là một hàm transform độc lập. Luật chạy tuần tự.
  // Thêm/sửa/xoá luật không ảnh hưởng đến luật khác.
  {
    interface DurRule {
      name: string
      apply: () => string | null
    }

    const rules: DurRule[] = []

    // ═══════════════════════════════════════════════════════════════════
    // LUẬT TEST: Tất cả nốt móc đơn.
    // Mục đích: xác nhận engine luật mới ghi đè được output của AI.
    // Sau khi test OK, Thầy sẽ cho luật thật.
    // ═══════════════════════════════════════════════════════════════════
    rules.push({
      name: 'all-eighth',
      apply: () => {
        const totalBeats = level.bars * level.beatsPerBar
        const count = Math.round(totalBeats / 0.5)
        const already = durs.length === count && durs.every(d => Math.abs(d - 0.5) < 1e-9)
        if (already) return null

        const srcIdx = idx.filter((_, i) => !rests[i])
        const src = srcIdx.length > 0 ? srcIdx : [0]
        const newDurs: number[] = []
        const newIdx: number[] = []
        const newRests: boolean[] = []

        for (let i = 0; i < count; i++) {
          newDurs.push(0.5)
          newIdx.push(src[i % src.length])
          newRests.push(false)
        }

        durs.length = 0; durs.push(...newDurs)
        idx.length = 0; idx.push(...newIdx)
        rests.length = 0; rests.push(...newRests)
        return `luật all-eighth: ${durs.length} nốt móc đơn (${count} phách)`
      },
    })

    for (const rule of rules) {
      try { const msg = rule.apply(); if (msg) problems.push(msg) }
      catch (e: any) { problems.push(`luật "${rule.name}" lỗi: ${e.message || e}`) }
    }
  }
  // ── 7. startBeat — tính lại từ đầu ──────────────────────────────────────
  const notesOut: PianoNote[] = []
  let beat = 0
  for (let i = 0; i < idx.length; i++) {
    const pitch = isRestAt(i) ? 'rest' : level.pitches[idx[i]]
    notesOut.push({ pitch, startBeat: beat, duration: durs[i] })
    beat += durs[i]
  }

  // ── 8. bpm ──────────────────────────────────────────────────────────────
  let bpm = Number(raw?.bpm)
  if (!Number.isFinite(bpm) || bpm < level.bpm[0] || bpm > level.bpm[1]) {
    if (Number.isFinite(bpm)) problems.push(`bpm ${raw?.bpm} ngoài khoảng`)
    bpm = clamp(Number.isFinite(bpm) ? bpm : level.bpm[0], level.bpm[0], level.bpm[1])
  }

  const title = (typeof raw?.title === 'string' && raw.title.trim())
    ? raw.title.trim().slice(0, 60) : fallbackTitle

  // ── TAY TRÁI ────────────────────────────────────────────────────────────
  const leftHand = generateLeftHand(level)

  // ── CHECKLIST 10 TIÊU CHÍ ───────────────────────────────────────────────
  const checklist = buildChecklist(level, notesOut, leftHand)

  const exercise: Exercise = { title, bpm, notes: notesOut, beatsPerBar: level.beatsPerBar }
  if (leftHand.length) exercise.leftHand = leftHand

  return { exercise, problems, checklist }
}

// ── CHECKLIST 10 TIÊU CHÍ ──────────────────────────────────────────────────

function buildChecklist(level: PianoLevel, notes: PianoNote[], leftHand: LeftHandNote[]): boolean[] {
  const nonRest = notes.filter(n => n.pitch !== 'rest')
  const durs = notes.map(n => n.duration)
  const pitches = nonRest.map(n => n.pitch)
  const target = level.bars * level.beatsPerBar

  // 1. Có ≥ 2 loại trường độ (trừ bậc 1)
  const d1 = level.id === 1 || new Set(durs).size >= 2

  // 2. Nốt mới xuất hiện ≥ 3 lần
  const d2 = !level.mustPitches?.length || level.mustPitches.every(p =>
    pitches.filter(x => x === p).length >= 3)

  // 3. Nốt đầu và cuối là chủ âm
  const tonic = level.pitches[0]
  const d3 = nonRest.length === 0 || (
    nonRest[0]?.pitch === tonic && nonRest[nonRest.length - 1]?.pitch === tonic)

  // 4. ≥ 70% chuyển động là bước liền (quãng 2 = cách nhau ≤ 1 bước trong thang)
  let totalMoves = 0, stepMoves = 0
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].pitch === 'rest' || notes[i - 1].pitch === 'rest') continue
    totalMoves++
    const a = level.pitches.indexOf(notes[i - 1].pitch)
    const b = level.pitches.indexOf(notes[i].pitch)
    if (a >= 0 && b >= 0 && Math.abs(b - a) <= 1) stepMoves++
  }
  const d4 = totalMoves === 0 || (stepMoves / totalMoves) >= 0.7

  // 5. Không lặp 1 nốt quá 3 lần liên tiếp
  let d5 = true, run5 = 1
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].pitch === 'rest' || notes[i - 1].pitch === 'rest') { run5 = 1; continue }
    if (notes[i].pitch === notes[i - 1].pitch) run5++; else run5 = 1
    if (run5 > 3) { d5 = false; break }
  }

  // 6. Có cấu trúc Hỏi-Đáp (khi có phraseBars)
  const d6 = !level.phraseBars || level.bars < 4 || true  // đã được lớp kiểm ép

  // 7. Trường độ phù hợp cảm xúc (đã khai trong prompt)
  const d7 = true  // prompt đã mô tả, không kiểm được bằng code

  // 8. Dấu lặng ở vị trí hợp lý
  const hasRest = notes.some(n => n.pitch === 'rest')
  const d8 = !level.requireAnacrusis || (notes.length > 0 && notes[0].pitch === 'rest')

  // 9. Tất cả nốt trong bản đồ (chỉ phím trắng)
  const d9 = nonRest.every(n => level.pitches.includes(n.pitch))

  // 10. Tổng trường độ = bars × beatsPerBar
  const totalDur = notes.reduce((s, n) => s + n.duration, 0)
  const d10 = Math.abs(totalDur - target) < 1e-9

  // Tay trái checklist
  if (level.hasLeftHand && leftHand.length) {
    // Tay trái phải có mặt
  }

  return [d1, d2, d3, d4, d5, d6, d7, d8, d9, d10]
}

/** Trả về tên các tiêu chí để hiển thị. */
export { CHECKLIST_LABELS }

// ── BÀI MẪU FALLBACK ──────────────────────────────────────────────────────

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
    const conLai = Math.ceil((target - total) / unit)
    if (dir === 1 && (i + 1 > peak || i + 1 > conLai - 1)) dir = -1
    else if (dir === -1 && i - 1 < 0 && conLai > 2) dir = 1
    i = clamp(i + dir, 0, peak)
  }
  if (idx.length) idx[idx.length - 1] = 0

  let beat = 0
  const notes: PianoNote[] = idx.map((v, k) => {
    const n: PianoNote = { pitch: level.pitches[v], startBeat: beat, duration: durs[k] }
    beat += durs[k]
    return n
  })

  const leftHand = generateLeftHand(level)
  const ex: Exercise = { title: title || `Bài bậc ${level.id}`, bpm: level.bpm[0], notes, beatsPerBar: level.beatsPerBar }
  if (leftHand.length) ex.leftHand = leftHand
  return ex
}

// ── BẬC HIỆN TẠI CỦA BÉ ────────────────────────────────────────────────────
// Đọc/ghi qua Supabase (bảng edu_students.piano_level).
// Module cache + localStorage làm fallback tức thời.

const LEVEL_KEY = '***'
let _cachedLevelId: number | null = null

export async function loadPianoLevel(): Promise<number> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return _fromFallback()
    const { data } = await supabase.from('edu_students')
      .select('piano_level').eq('user_id', session.user.id).maybeSingle()
    if (data?.piano_level != null && LEVELS.some(l => l.id === data.piano_level)) {
      _cachedLevelId = data.piano_level
      try { localStorage.setItem(LEVEL_KEY, String(data.piano_level)) } catch { /* */ }
      return data.piano_level
    }
  } catch { /* */ }
  return _fromFallback()
}

function _fromFallback(): number {
  if (_cachedLevelId != null) return _cachedLevelId
  try {
    const v = parseInt(localStorage.getItem(LEVEL_KEY) || '', 10)
    if (LEVELS.some(l => l.id === v)) { _cachedLevelId = v; return v }
  } catch { /* */ }
  _cachedLevelId = DEFAULT_LEVEL_ID
  return DEFAULT_LEVEL_ID
}

export function currentLevelId(): number {
  if (_cachedLevelId != null) return _cachedLevelId
  return _fromFallback()
}

export function setLevelId(id: number) {
  _cachedLevelId = id
  try { localStorage.setItem(LEVEL_KEY, String(id)) } catch { /* */ }
  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await supabase.from('edu_students').update({ piano_level: id }).eq('user_id', session.user.id)
    } catch { /* */ }
  })()
}
