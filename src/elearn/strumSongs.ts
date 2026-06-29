// ── KHO BÀI "GẢY THEO" (do thầy soạn) — tiếng + ô nhịp (hợp âm) + tempo ─────────
// Hiển thị như sách: mỗi ô nhịp 1 hợp âm; ô lấy đà = không đàn. Tempo đều.
import type { StrumSong } from './ChordStrumPlayer'
import type { MelodyNote } from './backing/backingEngine'

// Giai điệu Jingle Bells (trích từ file Guitar Pro của thầy) — t,dur theo PHÁCH; midi: C4=60 D4=62 E4=64 F4=65 G4=67.
const E4 = 64, F4 = 65, G4 = 67, C4 = 60, D4 = 62
const JINGLE_MELODY: MelodyNote[] = [
  { t: 0, dur: 1, midi: E4 }, { t: 1, dur: 1, midi: E4 }, { t: 2, dur: 2, midi: E4 },
  { t: 4, dur: 1, midi: E4 }, { t: 5, dur: 1, midi: E4 }, { t: 6, dur: 2, midi: E4 },
  { t: 8, dur: 1, midi: E4 }, { t: 9, dur: 1, midi: G4 }, { t: 10, dur: 1, midi: C4 }, { t: 11, dur: 1, midi: D4 },
  { t: 12, dur: 4, midi: E4 },
  { t: 16, dur: 1, midi: F4 }, { t: 17, dur: 1, midi: F4 }, { t: 18, dur: 1, midi: F4 }, { t: 19, dur: 1, midi: F4 },
  { t: 20, dur: 1, midi: F4 }, { t: 21, dur: 1, midi: F4 }, { t: 22, dur: 1, midi: E4 }, { t: 23, dur: 1, midi: E4 },
  { t: 24, dur: 1, midi: E4 }, { t: 25, dur: 1, midi: D4 }, { t: 26, dur: 1, midi: D4 }, { t: 27, dur: 1, midi: E4 },
  { t: 28, dur: 2, midi: D4 }, { t: 30, dur: 2, midi: G4 },
  { t: 32, dur: 1, midi: E4 }, { t: 33, dur: 1, midi: E4 }, { t: 34, dur: 2, midi: E4 },
  { t: 36, dur: 1, midi: E4 }, { t: 37, dur: 1, midi: E4 }, { t: 38, dur: 2, midi: E4 },
  { t: 40, dur: 1, midi: E4 }, { t: 41, dur: 1, midi: G4 }, { t: 42, dur: 1, midi: C4 }, { t: 43, dur: 1, midi: D4 },
  { t: 44, dur: 4, midi: E4 },
  { t: 48, dur: 1, midi: F4 }, { t: 49, dur: 1, midi: F4 }, { t: 50, dur: 1, midi: F4 }, { t: 51, dur: 1, midi: F4 },
  { t: 52, dur: 1, midi: F4 }, { t: 53, dur: 1, midi: E4 }, { t: 54, dur: 1, midi: E4 }, { t: 55, dur: 1, midi: E4 },
  { t: 56, dur: 1, midi: G4 }, { t: 57, dur: 1, midi: G4 }, { t: 58, dur: 1, midi: F4 }, { t: 59, dur: 1, midi: D4 },
  { t: 60, dur: 4, midi: C4 },
]

const STORE = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/lessons/'

// Happy Birthday — 3/4, tempo 75, ô 1 LẤY ĐÀ (không hợp âm).
// Vòng hợp âm theo bản Guitar Pro của thầy: C · G · G · C · C · Fmaj7 · G · C (ô 2–9).
export const HBD_CHUM2: StrumSong = {
  title: 'Happy Birthday — quạt chùm 2',
  audioUrl: STORE + 'Happy%20Birthday%20to%20You%20metronome.mp3',
  bpm: 75,
  timeSignature: 3,
  gridOffset: 0,        // phách 1 ở 0s
  eighths: true,        // chùm 2 (Trình độ 2)
  bars: [
    { pickup: true },   // ô 1 — lấy đà, không đàn
    { chord: 'C' },     // ô 2
    { chord: 'G' },     // ô 3
    { chord: 'G' },     // ô 4
    { chord: 'C' },     // ô 5
    { chord: 'C' },     // ô 6
    { chord: 'Fmaj7' }, // ô 7
    { chord: 'G' },     // ô 8
    { chord: 'C' },     // ô 9 (kết)
    { rest: true },     // ô 10 — nghỉ (dấu lặng)
  ],
}

// Trình độ 1 — cùng bài, quạt NỐT ĐEN (mỗi phách 1 cú xuống), không chùm 2.
export const HBD_TD1: StrumSong = { ...HBD_CHUM2, title: 'Happy Birthday — quạt nốt đen', eighths: false }

// Jingle Bells (nhạc cổ điển công cộng) — quạt theo nền trống+bass synth. 4/4, 120bpm, Đô trưởng.
// Vòng hợp âm dò theo giai điệu: C C C C · F F C G · C C C C · F C G C
export const STRUM_JINGLE: StrumSong = {
  title: 'Jingle Bells — quạt theo nền',
  bpm: 120, timeSignature: 4, gridOffset: 0, patternId: 'chum2',
  backing: { styleId: 'ballad', tempo: 120 },
  melody: JINGLE_MELODY,
  loop: false,          // chơi 1 lượt hết bài rồi dừng (không lặp)
  bars: [
    { chord: 'C' }, { chord: 'C' }, { chord: 'C' }, { chord: 'C' },
    { chord: 'F' }, { chord: 'F' }, { chord: 'C' }, { chord: 'G' },
    { chord: 'C' }, { chord: 'C' }, { chord: 'C' }, { chord: 'C' },
    { chord: 'F' }, { chord: 'C' }, { chord: 'G' }, { chord: 'C' },
    { chord: 'C', oneStrum: true },   // ô cuối: quạt C nốt trắng + lặng trắng (nghỉ)
  ],
}

// Cơ bản — CÙNG bài Jingle Bells nhưng quạt NỐT ĐEN (mỗi phách 1 cú xuống); ô cuối vẫn nốt trắng + lặng.
export const STRUM_JINGLE_DEN: StrumSong = { ...STRUM_JINGLE, title: 'Jingle Bells — quạt nốt đen', patternId: 'den' }

// Bài tập quạt theo NỀN trống+bass synth (loop) — không cần thu âm, sạch bản quyền.
// timeSignature PHẢI khớp beatsPerBar của điệu (Ballad = 4/4).
export const STRUM_BALLAD: StrumSong = {
  title: 'Quạt chùm 2 trên nền Ballad',
  bpm: 70, timeSignature: 4, gridOffset: 0, eighths: true,
  backing: { styleId: 'ballad', tempo: 70 },
  bars: [{ chord: 'C' }, { chord: 'Am' }, { chord: 'F' }, { chord: 'G' }],
}
