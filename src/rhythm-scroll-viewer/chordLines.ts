// ── RHYTHM SCROLL VIEWER — văn bản chuẩn → dòng hiển thị ──
// Định dạng canonical V1: hợp âm trong ngoặc vuông chen trong lời.
//   "Chiều [Am] nao, tiễn nhau [E7] đi khi bóng ngả xế [Am] tàn"
// Hợp âm gắn vào TỪ đứng ngay sau nó; viewer vẽ hợp âm phía trên từ đó (chỉ là trình bày).
// Dùng lại parser [Chord] sẵn có của Song Builder — không có parser thứ hai ở đây.
import { parseLyricsWithChords } from '../logic/lyricsChordParser'

export interface ChordWord {
  text: string
  chord: string | null
}

export interface ChordLine {
  /** Chỉ số dòng (0-based) trong văn bản chuẩn, tính CẢ dòng trống — đúng số mà `segment.line` trỏ tới. */
  index: number
  words: ChordWord[]
}

/**
 * Tách từng dòng riêng: chỉ số dòng luôn khớp văn bản gốc (parser không được gộp "dòng hợp âm" với dòng lời
 * bên dưới — đó là định dạng khác, V1 không dùng).
 */
export function parseChordLines(text: string): ChordLine[] {
  return text.split(/\r?\n/).map((raw, index) => {
    const { lyrics, chords } = parseLyricsWithChords(raw)
    const names = new Map(chords.map(chord => [chord.wordIndex, chord.name]))
    const words = lyrics.split(/\s+/).filter(Boolean).map((word, at) => ({ text: word, chord: names.get(at) ?? null }))
    return { index, words }
  })
}
