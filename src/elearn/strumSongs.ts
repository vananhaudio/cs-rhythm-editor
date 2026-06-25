// ── KHO BÀI "GẢY THEO" (do thầy soạn) — tiếng + ô nhịp (hợp âm) + tempo ─────────
// Hiển thị như sách: mỗi ô nhịp 1 hợp âm; ô lấy đà = không đàn. Tempo đều.
import type { StrumSong } from './ChordStrumPlayer'

const STORE = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/lessons/'

// Happy Birthday — 3/4, tempo 75, ô 1 LẤY ĐÀ (không hợp âm).
// Vòng hợp âm theo bản Guitar Pro của thầy: C · G · G · C · C · Fmaj7 · G · C (ô 2–9).
export const HBD_CHUM2: StrumSong = {
  title: 'Happy Birthday — quạt chùm 2',
  audioUrl: STORE + 'Happy%20Birthday%20to%20You%202.mp3',
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
  ],
}

// Trình độ 1 — cùng bài, quạt NỐT ĐEN (mỗi phách 1 cú xuống), không chùm 2.
export const HBD_TD1: StrumSong = { ...HBD_CHUM2, title: 'Happy Birthday — quạt nốt đen', eighths: false }
