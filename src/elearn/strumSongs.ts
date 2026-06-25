// ── KHO BÀI "GẢY THEO" (do thầy soạn) — tiếng + mốc hợp âm (giây) + tempo ──────
// Mốc tính từ tempo đều (bản thu xuất từ Guitar Pro nên đều tuyệt đối).
import type { StrumSong } from './ChordStrumPlayer'

const STORE = 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/lessons/'

// Happy Birthday — 3/4, tempo 75, ô đầu LẤY ĐÀ (1 phách) → phách 1 thật ở 0.8s.
// Vòng hợp âm (theo bản Guitar Pro của thầy): C · G · G · C · C · Fmaj7 · G · C.
// Đã gộp các ô trùng hợp âm liền nhau cho hiển thị gọn.
export const HBD_CHUM2: StrumSong = {
  title: 'Happy Birthday — quạt chùm 2',
  audioUrl: STORE + 'Happy%20Birthday%20to%20You%202.mp3',
  bpm: 75,
  timeSignature: 3,
  gridOffset: 0,        // phách 1 ở 0s (ô lấy đà là ô đủ, đầu ô có lặng)
  eighths: true,        // chùm 2 (Trình độ 2)
  // Mỗi ô 2.4s (75bpm, 3/4). Vòng C·G·G·C·C·Fmaj7·G·C → gộp ô trùng:
  chords: [
    { t: 0.0, name: 'C' },       // ô 1
    { t: 2.4, name: 'G' },       // ô 2–3
    { t: 7.2, name: 'C' },       // ô 4–5
    { t: 12.0, name: 'Fmaj7' },  // ô 6
    { t: 14.4, name: 'G' },      // ô 7
    { t: 16.8, name: 'C' },      // ô 8–9 (kết)
  ],
}

// Trình độ 1 — cùng bài, quạt NỐT ĐEN (mỗi phách 1 cú xuống), không chùm 2.
export const HBD_TD1: StrumSong = { ...HBD_CHUM2, title: 'Happy Birthday — quạt nốt đen', eighths: false }
