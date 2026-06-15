// ============================================================
// Thư viện thế bấm hợp âm guitar phổ biến (port từ ChordLibrary.swift).
// frets[]: 6 dây theo thứ tự dây 6 (Mi trầm) → dây 1 (Mi cao).
//   -1 = không gảy (x) · 0 = dây buông (O) · n = phím thứ n.
// ============================================================

export interface ChordShape {
  name: string
  frets: number[] // 6 phần tử, dây 6 → dây 1
  barre?: boolean
}

export const CHORD_LIBRARY: ChordShape[] = [
  { name: 'C',     frets: [-1, 3, 2, 0, 1, 0] },
  { name: 'G',     frets: [ 3, 2, 0, 0, 0, 3] },
  { name: 'D',     frets: [-1,-1, 0, 2, 3, 2] },
  { name: 'A',     frets: [-1, 0, 2, 2, 2, 0] },
  { name: 'E',     frets: [ 0, 2, 2, 1, 0, 0] },
  { name: 'Am',    frets: [-1, 0, 2, 2, 1, 0] },
  { name: 'Em',    frets: [ 0, 2, 2, 0, 0, 0] },
  { name: 'Dm',    frets: [-1,-1, 0, 2, 3, 1] },
  { name: 'F',     frets: [ 1, 3, 3, 2, 1, 1], barre: true },
  { name: 'Fmaj7', frets: [-1,-1, 3, 2, 1, 0] },
  { name: 'Bm',    frets: [-1, 2, 4, 4, 3, 2], barre: true },
  { name: 'F#m',   frets: [ 2, 4, 4, 2, 2, 2], barre: true },
  { name: 'B7',    frets: [-1, 2, 1, 2, 0, 2] },
  { name: 'A7',    frets: [-1, 0, 2, 0, 2, 0] },
  { name: 'E7',    frets: [ 0, 2, 0, 1, 0, 0] },
  { name: 'D7',    frets: [-1,-1, 0, 2, 1, 2] },
  { name: 'G7',    frets: [ 3, 2, 0, 0, 0, 1] },
  { name: 'C7',    frets: [-1, 3, 2, 3, 1, 0] },
  { name: 'Cadd9', frets: [-1, 3, 2, 0, 3, 0] },
  { name: 'Dsus4', frets: [-1,-1, 0, 2, 3, 3] },
  { name: 'Asus2', frets: [-1, 0, 2, 2, 0, 0] },
]

export function chordShape(name: string): ChordShape | undefined {
  const n = name.trim().toLowerCase()
  return CHORD_LIBRARY.find(c => c.name.toLowerCase() === n)
}
