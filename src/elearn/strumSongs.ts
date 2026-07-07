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

// Amazing Grace (thánh ca — công cộng) — VALSE 3/4 nốt đen, tông Đô. Nền synth Valse.
// Vòng hợp âm chuẩn (I–IV–V): mỗi câu 4 ô. Melody để trống — thêm chuẩn khi có file (tránh 'gầy').
export const STRUM_AMAZING: StrumSong = {
  title: 'Amazing Grace — quạt theo nền (Valse)',
  bpm: 96, timeSignature: 3, gridOffset: 0, patternId: 'den',
  backing: { styleId: 'valse', tempo: 96 },
  loop: false,
  bars: [
    { chord: 'C' }, { chord: 'C' }, { chord: 'F' }, { chord: 'C' },   // Amazing grace how sweet the sound
    { chord: 'C' }, { chord: 'C' }, { chord: 'G' }, { chord: 'G' },   // that saved a wretch like me
    { chord: 'C' }, { chord: 'C' }, { chord: 'F' }, { chord: 'C' },   // I once was lost but now am found
    { chord: 'C' }, { chord: 'G' }, { chord: 'C' },                    // was blind but now I see
    { chord: 'C', oneStrum: true },                                    // ô kết
  ],
}

// Scarborough Fair (dân ca — công cộng) — VALSE 3/4, tông Mi (Em/E Dorian), tiết tấu TRỘN
// "Đen – đon đon – đon đon" (1 nốt đen + 2 chùm 2), qua bar.figures. Melody từ file MusicXML của thầy
// (Rê Dorian) dịch lên +2 nửa cung. Hợp âm theo bản lời Việt của thầy. Không loop.
const SF_TRON = ['den', 'chum2', 'chum2']   // mỗi ô: phách 1 nốt đen, phách 2&3 chùm 2
const sfBar = (chord: string) => ({ chord, figures: SF_TRON })
// Melody CHUẨN (đủ nốt luyến/âm tiết) — trích bè Voice bản voice+accompaniment của thầy, dịch +2 lên Em.
const SCARBOROUGH_MELODY: MelodyNote[] = [
  { t: 0, dur: 2, midi: 64 }, { t: 2, dur: 1, midi: 64 }, { t: 3, dur: 0.5, midi: 71 }, { t: 3.5, dur: 1.5, midi: 71 }, { t: 5, dur: 0.5, midi: 71 }, { t: 5.5, dur: 0.5, midi: 71 }, { t: 6, dur: 1.5, midi: 66 }, { t: 7.5, dur: 0.5, midi: 67 },
  { t: 8, dur: 1, midi: 66 }, { t: 9, dur: 3, midi: 64 }, { t: 13, dur: 1, midi: 71 }, { t: 14, dur: 1, midi: 74 }, { t: 15, dur: 2, midi: 76 }, { t: 17, dur: 1, midi: 74 }, { t: 18, dur: 1, midi: 71 }, { t: 19, dur: 1, midi: 73 },
  { t: 20, dur: 1, midi: 69 }, { t: 21, dur: 3, midi: 71 }, { t: 24, dur: 2, midi: 76 }, { t: 26, dur: 1, midi: 76 }, { t: 27, dur: 2, midi: 74 }, { t: 29, dur: 1, midi: 71 }, { t: 30, dur: 1, midi: 71 }, { t: 31, dur: 1, midi: 69 },
  { t: 32, dur: 1, midi: 67 }, { t: 33, dur: 3, midi: 66 }, { t: 36, dur: 2, midi: 64 }, { t: 38, dur: 1, midi: 71 }, { t: 39, dur: 2, midi: 69 }, { t: 41, dur: 1, midi: 67 }, { t: 42, dur: 1, midi: 66 }, { t: 43, dur: 1, midi: 64 },
  { t: 44, dur: 1, midi: 62 }, { t: 45, dur: 3, midi: 64 },
]
export const STRUM_SCARBOROUGH: StrumSong = {
  title: 'Scarborough Fair — quạt theo nền (Valse)',
  bpm: 104, timeSignature: 3, gridOffset: 0, patternId: 'chum2',
  backing: { styleId: 'valse', tempo: 104 },
  melody: SCARBOROUGH_MELODY,
  loop: false,
  bars: [
    sfBar('Em'), sfBar('Em'), sfBar('D'), sfBar('Em'),
    sfBar('G'), sfBar('Em'), sfBar('A'), sfBar('Em'),
    sfBar('Em'), sfBar('G'), sfBar('G'), sfBar('D'),
    sfBar('Em'), sfBar('D'), sfBar('Em'),
    { chord: 'Em', oneStrum: true },   // ô kết
  ],
}

// Cơ bản — CÙNG bài Jingle Bells nhưng quạt NỐT ĐEN (mỗi phách 1 cú xuống); ô cuối vẫn nốt trắng + lặng.
export const STRUM_JINGLE_DEN: StrumSong = { ...STRUM_JINGLE, title: 'Jingle Bells — quạt nốt đen', patternId: 'den' }

// Ode to Joy (Beethoven — nhạc công cộng) — Ballad chùm 2, 4/4, Đô trưởng. Nền synth, không loop.
// Hợp âm bản dễ (I–V): C · G · C · G7 · C · G · C · C(kết). Melody theo chủ đề gốc.
const ODE_MELODY: MelodyNote[] = [
  { t: 0, dur: 1, midi: E4 }, { t: 1, dur: 1, midi: E4 }, { t: 2, dur: 1, midi: F4 }, { t: 3, dur: 1, midi: G4 },
  { t: 4, dur: 1, midi: G4 }, { t: 5, dur: 1, midi: F4 }, { t: 6, dur: 1, midi: E4 }, { t: 7, dur: 1, midi: D4 },
  { t: 8, dur: 1, midi: C4 }, { t: 9, dur: 1, midi: C4 }, { t: 10, dur: 1, midi: D4 }, { t: 11, dur: 1, midi: E4 },
  { t: 12, dur: 1.5, midi: E4 }, { t: 13.5, dur: 0.5, midi: D4 }, { t: 14, dur: 2, midi: D4 },
  { t: 16, dur: 1, midi: E4 }, { t: 17, dur: 1, midi: E4 }, { t: 18, dur: 1, midi: F4 }, { t: 19, dur: 1, midi: G4 },
  { t: 20, dur: 1, midi: G4 }, { t: 21, dur: 1, midi: F4 }, { t: 22, dur: 1, midi: E4 }, { t: 23, dur: 1, midi: D4 },
  { t: 24, dur: 1, midi: C4 }, { t: 25, dur: 1, midi: C4 }, { t: 26, dur: 1, midi: D4 }, { t: 27, dur: 1, midi: E4 },
  { t: 28, dur: 1.5, midi: D4 }, { t: 29.5, dur: 0.5, midi: C4 }, { t: 30, dur: 2, midi: C4 },
]
export const STRUM_ODE: StrumSong = {
  title: 'Ode to Joy — quạt theo nền',
  bpm: 72, timeSignature: 4, gridOffset: 0, patternId: 'chum2',
  backing: { styleId: 'ballad', tempo: 72 },
  melody: ODE_MELODY,
  loop: false,
  bars: [
    { chord: 'C' }, { chord: 'G' }, { chord: 'C' }, { chord: 'G7' },
    { chord: 'C' }, { chord: 'G' }, { chord: 'C' },
    { chord: 'C', oneStrum: true },   // ô kết — nốt trắng (hình thoi)
  ],
}

// Bài tập quạt theo NỀN trống+bass synth (loop) — không cần thu âm, sạch bản quyền.
// timeSignature PHẢI khớp beatsPerBar của điệu (Ballad = 4/4).
export const STRUM_BALLAD: StrumSong = {
  title: 'Quạt chùm 2 trên nền Ballad',
  bpm: 70, timeSignature: 4, gridOffset: 0, eighths: true,
  backing: { styleId: 'ballad', tempo: 70 },
  bars: [{ chord: 'C' }, { chord: 'Am' }, { chord: 'F' }, { chord: 'G' }],
}
