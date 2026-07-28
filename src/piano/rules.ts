// ── LUẬT SINH BÀI TẬP PIANO — thầy sửa ở file này, không đụng chỗ khác ────────
//
// ⚠️ ĐÂY LÀ BỘ LUẬT DEMO. Thầy Văn Anh sẽ thay bằng giáo trình thật.
// Suy từ PROJECT_CONTEXT.md (3 nốt C-D-E, tay phải, nhịp đơn giản) + quy ước
// Faber/Alfred trong PEDAGOGY.md. Chưa qua kiểm định sư phạm.
//
// Kiến trúc: luật ở đây → gửi kèm khi gọi AI → AI sinh → hàm kiểm bên dưới soi
// và SỬA. Nhờ lớp kiểm mà bé không bao giờ nhận bài vượt bậc, kể cả khi AI ẩu.
// Vì luật nằm trong repo (không nằm trong prompt của edge function) nên sửa luật
// KHÔNG cần deploy lại `piano-generate` — key thật trong function đó vẫn an toàn.

export interface PianoNote { pitch: string; startBeat: number; duration: number }
export interface Exercise { title: string; bpm: number; notes: PianoNote[] }

export interface PianoLevel {
  id: number
  name: string
  /** Nốt được phép, xếp THẤP → CAO. Quãng nhảy đếm theo vị trí trong mảng này. */
  pitches: string[]
  /** Trường độ được phép: 1 = đen, 2 = trắng, 4 = tròn */
  durations: number[]
  minNotes: number
  maxNotes: number
  /** Quãng nhảy tối đa giữa 2 nốt liền nhau (1 = chỉ được đi liền bậc) */
  maxStep: number
  bpm: [number, number]
  /** Bắt buộc kết ở nốt chủ (nốt đầu tiên của `pitches`) */
  endOnTonic: boolean
  /** Kỹ năng hôm nay — đưa vào prompt để AI sáng tác có mục đích sư phạm */
  skill: string
}

// ── BỘ LUẬT DEMO — 3 bậc đầu ─────────────────────────────────────────────────
export const LEVELS: PianoLevel[] = [
  {
    id: 1,
    name: 'Ba nốt đầu',
    pitches: ['C4', 'D4', 'E4'],
    durations: [1, 2],
    minNotes: 6,
    maxNotes: 8,
    maxStep: 1,                 // chỉ đi liền bậc — ngón chưa phải nhảy
    bpm: [60, 80],
    endOnTonic: true,
    skill: 'Chơi 3 nốt Đô Rê Mi tay phải, đi liền bậc, giữ đều nhịp đen',
  },
  {
    id: 2,
    name: 'Năm nốt bàn tay',
    pitches: ['C4', 'D4', 'E4', 'F4', 'G4'],
    durations: [1, 2],
    minNotes: 8,
    maxNotes: 12,
    maxStep: 2,                 // được nhảy qua 1 nốt
    bpm: [70, 90],
    endOnTonic: true,
    skill: 'Mở rộng ra 5 nốt Đô–Sol, tập nhảy quãng ba, giữ nhịp khi đổi ngón',
  },
  {
    id: 3,
    name: 'Trọn quãng tám',
    pitches: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    durations: [1, 2, 4],
    minNotes: 8,
    maxNotes: 16,
    maxStep: 3,
    bpm: [80, 100],
    endOnTonic: true,
    skill: 'Đi hết quãng tám Đô4–Đô5, phối hợp nốt đen/trắng/tròn, câu nhạc có mở và kết',
  },
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

/** Vị trí trong thang nốt của bậc; -1 nếu không đọc được cao độ. */
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

// ── Ràng buộc gửi kèm cho AI ─────────────────────────────────────────────────
// Gộp vào `prompt` gửi tới piano-generate, KHÔNG sửa prompt cứng của function.
export function buildPrompt(chuDe: string, level: PianoLevel): string {
  return [
    `Bé muốn một bài về: "${chuDe}".`,
    `Mục tiêu sư phạm hôm nay: ${level.skill}.`,
    `RÀNG BUỘC BẮT BUỘC (bậc ${level.id} — ${level.name}):`,
    `- CHỈ được dùng các nốt: ${level.pitches.join(' ')} — tuyệt đối không dùng nốt khác.`,
    `- duration chỉ được là: ${level.durations.join(' hoặc ')}.`,
    `- Tổng số nốt từ ${level.minNotes} đến ${level.maxNotes}.`,
    `- Hai nốt liền nhau cách nhau tối đa ${level.maxStep} bậc trong thang nốt trên.`,
    `- bpm trong khoảng ${level.bpm[0]}–${level.bpm[1]}.`,
    level.endOnTonic ? `- Nốt cuối phải là ${level.pitches[0]} và ngân dài hơn các nốt khác.` : '',
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

export function checkAndRepair(raw: Exercise | null, level: PianoLevel, fallbackTitle: string): CheckResult {
  const problems: string[] = []
  const maxDur = Math.max(...level.durations)

  const notes: PianoNote[] = Array.isArray(raw?.notes) ? raw!.notes.filter(n => n && typeof n.pitch === 'string') : []
  if (!notes.length) {
    problems.push('AI không trả về nốt nào')
    return { exercise: template(level, fallbackTitle), problems }
  }

  // 1. Kéo mọi nốt về thang nốt của bậc
  let idx = notes.map(n => {
    const i = nearestIndex(n.pitch, level)
    if (i < 0) { problems.push(`không đọc được cao độ "${n.pitch}"`); return 0 }
    if (level.pitches[i] !== n.pitch) problems.push(`nốt ${n.pitch} ngoài bậc → ${level.pitches[i]}`)
    return i
  })

  // 2. Trường độ về giá trị hợp lệ
  let durs = notes.map(n => {
    const d = Number(n.duration)
    if (level.durations.includes(d)) return d
    problems.push(`trường độ ${n.duration} không hợp lệ`)
    return level.durations.reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a, level.durations[0])
  })

  // 3. Số nốt
  if (idx.length > level.maxNotes) {
    problems.push(`${idx.length} nốt, quá ${level.maxNotes}`)
    idx = idx.slice(0, level.maxNotes); durs = durs.slice(0, level.maxNotes)
  }
  while (idx.length < level.minNotes) {
    problems.push('thiếu nốt, thêm cho đủ')
    const last = idx[idx.length - 1] ?? 0
    idx.push(Math.max(0, last - 1)); durs.push(level.durations[0])
  }

  // ⚠️ THỨ TỰ DƯỚI ĐÂY QUAN TRỌNG. Bản đầu đặt "kết ở nốt chủ" và "phá lặp" SAU
  // bước quãng nhảy nên chúng phá lại chính nó — fuzz 300 bài rác thì 134 bài vẫn
  // nhảy quá xa. Nay: chốt nốt kết TRƯỚC, rồi duyệt NGƯỢC để nắn quãng nhảy.

  // 4. Kết ở nốt chủ và ngân dài — chốt trước để bước sau nắn đường đi tới nó
  const last = idx.length - 1
  if (level.endOnTonic) {
    if (idx[last] !== 0) { problems.push('không kết ở nốt chủ'); idx[last] = 0 }
    if (durs[last] < maxDur) durs[last] = maxDur
  }

  // 5. Quãng nhảy — duyệt NGƯỢC từ nốt cuối. Mỗi vòng ép cặp (i, i+1) vào tầm
  // với, và duyệt ngược phủ hết mọi cặp liền nhau đúng một lần ⇒ xong là chắc
  // chắn không còn cặp nào vượt maxStep, mà nốt kết vẫn nguyên.
  for (let i = last - 1; i >= 0; i--) {
    const lo = idx[i + 1] - level.maxStep
    const hi = idx[i + 1] + level.maxStep
    if (idx[i] < lo || idx[i] > hi) {
      problems.push(`nhảy ${Math.abs(idx[i] - idx[i + 1])} bậc, quá ${level.maxStep}`)
      idx[i] = clamp(clamp(idx[i], lo, hi), 0, level.pitches.length - 1)
    }
  }

  // 6. Không lặp một nốt quá 3 lần — CHỈ sửa khi không phá vỡ quãng nhảy.
  // Đây là yêu cầu mềm (nghe cho đỡ nhàm), không phải ràng buộc sư phạm cứng,
  // nên thà để lặp còn hơn đẩy bé vào một quãng nhảy quá tầm.
  let run = 1
  for (let i = 1; i < idx.length; i++) {
    if (idx[i] !== idx[i - 1]) { run = 1; continue }
    run++
    if (run <= 3) continue
    const thu = clamp(idx[i] + (idx[i] > 0 ? -1 : 1), 0, level.pitches.length - 1)
    const truocOk = Math.abs(thu - idx[i - 1]) <= level.maxStep
    const sauOk = i + 1 >= idx.length || Math.abs(idx[i + 1] - thu) <= level.maxStep
    const cuoiOk = !(level.endOnTonic && i === last)
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
  const beatSai = notes.some((n, i) => notesOut[i] && n.startBeat !== notesOut[i].startBeat)
  if (beatSai) problems.push('startBeat sai, đã tính lại')

  // 8. bpm
  let bpm = Number(raw?.bpm)
  if (!Number.isFinite(bpm) || bpm < level.bpm[0] || bpm > level.bpm[1]) {
    if (Number.isFinite(bpm)) problems.push(`bpm ${raw?.bpm} ngoài khoảng`)
    bpm = clamp(Number.isFinite(bpm) ? bpm : level.bpm[0], level.bpm[0], level.bpm[1])
  }

  const title = (typeof raw?.title === 'string' && raw.title.trim()) ? raw.title.trim().slice(0, 60) : fallbackTitle
  return { exercise: { title, bpm, notes: notesOut }, problems }
}

/** Bài mẫu đúng luật — dùng khi AI hỏng hẳn hoặc chưa đăng nhập.
 *  Hình vòng cung: đi lên rồi quay về nốt chủ, mỗi bước 1 bậc. Phải TỰ QUAY ĐẦU
 *  đúng lúc để về kịp nốt chủ — bản đầu chỉ ép nốt cuối về 0 nên tạo ra cú nhảy
 *  xa y hệt lỗi đã sửa ở checkAndRepair. */
export function template(level: PianoLevel, title: string): Exercise {
  const n = Math.min(level.maxNotes, Math.max(level.minNotes, 8))
  const peak = level.pitches.length - 1
  const idx: number[] = []
  let i = 0, dir = 1
  for (let k = 0; k < n - 1; k++) {
    idx.push(i)
    const conLai = n - 1 - k          // số bước còn lại để về nốt chủ
    if (dir === 1 && (i + 1 > peak || i + 1 > conLai - 1)) dir = -1
    i = clamp(i + dir, 0, peak)
  }
  idx.push(0)                          // nốt kết — giờ chỉ cách nốt trước 1 bậc

  let beat = 0
  const notes: PianoNote[] = idx.map((v, k) => {
    const dur = k === idx.length - 1 ? Math.max(...level.durations) : level.durations[0]
    const nt = { pitch: level.pitches[v], startBeat: beat, duration: dur }
    beat += dur
    return nt
  })
  return { title: title || `Bài bậc ${level.id}`, bpm: level.bpm[0], notes }
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)) }
