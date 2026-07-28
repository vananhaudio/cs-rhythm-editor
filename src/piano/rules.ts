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
  /** Nốt được phép, xếp THẤP → CAO. Quãng nhảy đếm theo vị trí trong mảng này. */
  pitches: string[]
  /** Trường độ được phép: 0.5 = móc đơn, 1 = đen, 2 = trắng, 3 = trắng chấm, 4 = tròn */
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

export const LEVELS: PianoLevel[] = [
  { id: 1,  name: 'Ba nốt đầu',      pitches: ['C4','D4','E4'], durations: [1],
    beatsPerBar: 4, bars: 2, maxStep: 1, bpm: [60, 72], endOnTonic: true,
    skill: 'Ba nốt Đô Rê Mi tay phải, toàn nốt đen, đi liền kề' },

  { id: 2,  name: 'Năm nốt bàn tay',  pitches: P5, durations: [1],
    beatsPerBar: 4, bars: 2, maxStep: 1, bpm: [63, 76], endOnTonic: true,
    skill: 'Mở rộng ra năm nốt Đô–Sol, vẫn toàn nốt đen, đi liền kề' },

  { id: 3,  name: 'Nốt trắng',        pitches: P5, durations: [1, 2],
    beatsPerBar: 4, bars: 4, maxStep: 1, bpm: [66, 80], endOnTonic: true,
    skill: 'Làm quen nốt trắng — giữ tiếng ngân đủ hai phách' },

  { id: 4,  name: 'Nốt tròn',         pitches: P5, durations: [1, 2, 4],
    beatsPerBar: 4, bars: 4, maxStep: 1, bpm: [66, 80], endOnTonic: true,
    skill: 'Thêm nốt tròn ngân trọn một ô nhịp, tập đếm bốn phách' },

  { id: 5,  name: 'Quãng ba',         pitches: P5, durations: [1, 2],
    beatsPerBar: 4, bars: 4, maxStep: 2, bpm: [72, 86], endOnTonic: true,
    skill: 'Tập nhảy quãng ba, giữ nhịp đều khi đổi ngón' },

  { id: 6,  name: 'Nhịp ba bốn',      pitches: P5, durations: [1, 2, 3],
    beatsPerBar: 3, bars: 4, maxStep: 2, bpm: [72, 86], endOnTonic: true,
    skill: 'Nhịp 3/4 — cảm giác một–hai–ba, nhấn phách đầu mỗi ô' },

  { id: 7,  name: 'Trọn quãng tám',   pitches: P8, durations: [1, 2, 4],
    beatsPerBar: 4, bars: 4, maxStep: 3, bpm: [76, 92], endOnTonic: true,
    skill: 'Đi hết quãng tám Đô4–Đô5, câu nhạc có mở và có kết' },

  { id: 8,  name: 'Móc đơn',          pitches: P8, durations: [0.5, 1, 2],
    beatsPerBar: 4, bars: 4, maxStep: 2, bpm: [76, 92], endOnTonic: true,
    skill: 'Làm quen nốt móc đơn — hai nốt gọn trong một phách' },

  { id: 9,  name: 'Quãng rộng',       pitches: P10, durations: [1, 2, 3, 4],
    beatsPerBar: 4, bars: 4, maxStep: 4, bpm: [84, 100], endOnTonic: true,
    skill: 'Nhảy quãng bốn–quãng năm, tay phải mở rộng lên Mi5' },

  { id: 10, name: 'Tổng hợp',         pitches: P10, durations: [0.5, 1, 2, 3, 4],
    beatsPerBar: 4, bars: 8, maxStep: 4, bpm: [88, 108], endOnTonic: true,
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
const DUR_NAME: Record<number, string> = { 0.5: 'móc đơn', 1: 'đen', 2: 'trắng', 3: 'trắng chấm', 4: 'tròn' }

export function buildPrompt(chuDe: string, level: PianoLevel): string {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]
  const avoid = recentSignatures()
  const total = level.bars * level.beatsPerBar
  const durList = level.durations.map(d => `${d} (${DUR_NAME[d] ?? '?'})`).join(', ')
  return [
    `Bé muốn một bài về: "${chuDe}".`,
    `Mục tiêu sư phạm hôm nay: ${level.skill}.`,
    `Lần này hãy soạn theo DÁNG: ${shape}.`,
    avoid.length
      ? `KHÔNG được trùng với các bài vừa soạn: ${avoid.join(' | ')}. Hãy làm khác hẳn.`
      : '',
    `RÀNG BUỘC BẮT BUỘC (bậc ${level.id} — ${level.name}):`,
    `- Nhịp ${level.beatsPerBar}/4, đúng ${level.bars} ô nhịp.`,
    `- TỔNG trường độ tất cả các nốt phải bằng ĐÚNG ${total} phách — không thừa, không thiếu.`,
    `- CHỈ được dùng các nốt: ${level.pitches.join(' ')} — tuyệt đối không dùng nốt khác.`,
    `- duration chỉ được là: ${durList}.`,
    `- Hai nốt liền nhau cách nhau tối đa ${level.maxStep} bước trong thang nốt trên `
    + `(1 bước = hai nốt liền kề nhau trong danh sách, ví dụ C4→D4).`,
    `- bpm trong khoảng ${level.bpm[0]}–${level.bpm[1]}.`,
    level.endOnTonic ? `- Ô nhịp cuối kết ở nốt ${level.pitches[0]}, nên ngân dài.` : '',
    `- Không lặp cùng một nốt quá 3 lần liên tiếp.`,
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

export function checkAndRepair(raw: Exercise | null, level: PianoLevel, fallbackTitle: string): CheckResult {
  const problems: string[] = []
  const target = level.bars * level.beatsPerBar

  const notes: PianoNote[] = Array.isArray(raw?.notes) ? raw.notes.filter(n => n && typeof n.pitch === 'string') : []
  if (!notes.length) {
    problems.push('AI không trả về nốt nào')
    return { exercise: template(level, fallbackTitle), problems }
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
    const remain = fillTarget - total
    let d = rawDur[i]
    if (d > remain + 1e-9) {
      const fit = fitDur(level, remain)
      if (fit == null) break
      d = fit
    }
    idx.push(rawIdx[i]); durs.push(d); total += d
  }
  if (idx.length < rawIdx.length) problems.push(`bài dài quá ${level.bars} ô, đã cắt`)

  let guard = 0
  while (total < fillTarget - 1e-9 && guard++ < 400) {
    const fit = fitDur(level, fillTarget - total)
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

  // 5. Quãng nhảy — duyệt NGƯỢC từ nốt cuối. Mỗi vòng ép cặp (i, i+1) vào tầm với,
  //    duyệt ngược phủ hết mọi cặp đúng một lần ⇒ xong là chắc chắn không còn cặp
  //    nào vượt maxStep, mà nốt kết vẫn nguyên.
  for (let i = idx.length - 2; i >= 0; i--) {
    const lo = idx[i + 1] - level.maxStep
    const hi = idx[i + 1] + level.maxStep
    if (idx[i] < lo || idx[i] > hi) {
      problems.push(`nhảy ${Math.abs(idx[i] - idx[i + 1])} bước, quá ${level.maxStep}`)
      idx[i] = clamp(clamp(idx[i], lo, hi), 0, level.pitches.length - 1)
    }
  }

  // 6. Không lặp một nốt quá 3 lần — CHỈ sửa khi không phá vỡ quãng nhảy.
  //    Đây là yêu cầu mềm (nghe cho đỡ nhàm), không phải ràng buộc sư phạm cứng.
  let run = 1
  for (let i = 1; i < idx.length; i++) {
    if (idx[i] !== idx[i - 1]) { run = 1; continue }
    run++
    if (run <= 3) continue
    const thu = clamp(idx[i] + (idx[i] > 0 ? -1 : 1), 0, level.pitches.length - 1)
    const truocOk = Math.abs(thu - idx[i - 1]) <= level.maxStep
    const sauOk = i + 1 >= idx.length || Math.abs(idx[i + 1] - thu) <= level.maxStep
    const cuoiOk = !(level.endOnTonic && i === idx.length - 1)
    if (truocOk && sauOk && cuoiOk && thu !== idx[i]) {
      problems.push('lặp một nốt quá 3 lần')
      idx[i] = thu; run = 1
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
    if (dir === 1 && (i + 1 > peak || i + 1 > conLai - 1)) dir = -1
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
