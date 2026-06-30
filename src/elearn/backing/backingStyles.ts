// ── DỮ LIỆU ĐIỆU + nhạc lý hợp âm→bass (port từ Groove Lab, đã chốt nhạc lý) ────
// Nguồn: docs/groove-backing-track-engine.md (mục 1–3). Web Audio thuần.
export type Feel = 'straight' | 'triplet'
export type HH = 0 | 1 | 'o'                 // hi-hat: 0 nghỉ, 1 đóng, 'o' mở
// Bass: R=gốc, 3=bậc 3, 5=quãng 5, 8=octave, null=nghỉ. A/A1/A2/A3=nốt dẫn chromatic dưới gốc hợp âm KẾ.
export type BassDegree = 'R' | '3' | '5' | '8' | 'A' | 'A1' | 'A2' | 'A3' | null

export interface Style {
  id: string; name: string
  beatsPerBar: 2 | 3 | 4
  feel: Feel
  stepsPerBar: number        // 8 (4/4 straight) | 12 (4/4 triplet) | 6 (3/4) | 4 (2/4)
  defaultTempo: number
  drum: { hh: HH[]; snare: (0 | 1)[]; kick: (0 | 1)[] }  // độ dài = stepsPerBar
  bass: BassDegree[]
  bassFinal?: BassDegree[]    // pattern riêng cho Ô CUỐI vòng
  bassAlt?: BassDegree[]      // biến tấu định kỳ
  altEvery?: number
}

export const STYLES: Style[] = [
  {
    id: 'ballad', name: 'Ballad', beatsPerBar: 4, feel: 'straight', stepsPerBar: 8, defaultTempo: 70,
    drum: { hh: [1, 1, 1, 1, 1, 1, 1, 1], snare: [0, 0, 1, 0, 0, 0, 1, 0], kick: [1, 0, 0, 0, 1, 0, 0, 0] },
    bass: ['R', null, null, 'R', 'R', null, null, null],
    bassFinal: ['R', null, null, 'R', 'R', null, null, 'A'],
  },
  {
    id: 'disco', name: 'Disco', beatsPerBar: 4, feel: 'straight', stepsPerBar: 8, defaultTempo: 115,
    drum: { hh: ['o', 1, 'o', 1, 'o', 1, 'o', 1], snare: [0, 0, 1, 0, 0, 0, 1, 0], kick: [1, 0, 1, 0, 1, 0, 1, 0] },
    bass: ['R', '8', 'R', '8', 'R', '8', 'R', '8'],
    bassAlt: ['R', '8', '5', '8', 'R', '8', '5', '8'], altEvery: 4,
  },
  {
    id: 'bolero', name: 'Bolero', beatsPerBar: 4, feel: 'straight', stepsPerBar: 8, defaultTempo: 75,
    drum: { hh: [1, 1, 1, 1, 1, 1, 1, 1], snare: [0, 0, 1, 0, 0, 0, 1, 0], kick: [1, 0, 0, 1, 0, 0, 1, 0] },
    bass: ['R', null, null, 'R', 'R', null, '5', '5'],
  },
  {
    id: 'slowrock', name: 'Slow Rock', beatsPerBar: 4, feel: 'triplet', stepsPerBar: 12, defaultTempo: 66,
    drum: {
      hh: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      snare: [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    },
    bass: ['R', null, null, null, null, 'R', 'R', null, null, 'R', null, null],
    bassFinal: ['R', null, null, null, null, 'R', 'R', null, null, 'A3', 'A2', 'A1'],
  },
  {
    id: 'valse', name: 'Valse', beatsPerBar: 3, feel: 'straight', stepsPerBar: 6, defaultTempo: 140,
    drum: { hh: [0, 0, 1, 0, 1, 0], snare: [0, 0, 1, 0, 1, 0], kick: [1, 0, 0, 0, 0, 0] },
    bass: ['R', null, null, null, null, null],
  },
  {
    // Polka — nhịp 2/4: oom–pah (kick phách 1, snare phách 2; bass gốc–quãng 5)
    id: 'polka', name: 'Polka', beatsPerBar: 2, feel: 'straight', stepsPerBar: 4, defaultTempo: 100,
    drum: { hh: [1, 1, 1, 1], snare: [0, 0, 1, 0], kick: [1, 0, 0, 0] },
    bass: ['R', null, '5', null],
  },
]

// Vòng hợp âm mẫu cho "Nền tập quạt" (1 hợp âm / 1 ô nhịp).
export interface Preset {
  id: string
  name: string
  styleId: string
  key: string
  tempo?: number
  chords: string[]
}

export const PRESETS: Preset[] = [
  { id: 'pop-1645', name: 'Pop 1–6–4–5', styleId: 'ballad', key: 'C', chords: ['C', 'Am', 'F', 'G'] },
  { id: 'disco-1645', name: 'Disco 1–6–4–5', styleId: 'disco', key: 'C', chords: ['C', 'Am', 'F', 'G'] },
  { id: 'canon', name: 'Canon', styleId: 'ballad', key: 'C', chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'] },
  { id: 'bolero-am', name: 'Bolero buồn', styleId: 'bolero', key: 'Am', chords: ['Am', 'Dm', 'E', 'Am'] },
  { id: 'valse-c', name: 'Valse', styleId: 'valse', key: 'C', chords: ['C', 'F', 'G', 'C'] },
  { id: 'polka-c', name: 'Polka', styleId: 'polka', key: 'C', chords: ['C', 'G', 'C', 'G'] },
]

export const getStyle = (id: string): Style => STYLES.find((s) => s.id === id) ?? STYLES[0]

// ── Hợp âm → tần số nốt bass ──
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
type Quality = 'maj' | 'min' | 'dim' | 'aug'

export function chordRootPitchClass(chord: string): number | null {
  if (!chord) return null
  let pc = PC[chord[0].toUpperCase()]
  if (pc === undefined) return null
  const next = chord[1]
  if (next === '#') pc = (pc + 1) % 12
  else if (next === 'b') pc = (pc + 11) % 12
  return pc
}

export function chordQuality(chord: string): Quality {
  const rest = chord.replace(/^[A-Ga-g][#b]?/, '')
  if (/^(dim|°|o)/i.test(rest) || /b5/.test(rest)) return 'dim'
  if (/^(aug|\+)/i.test(rest) || /#5/.test(rest)) return 'aug'
  if (/^(m(?!aj)|min|-)/i.test(rest)) return 'min'
  return 'maj'
}
const thirdSemis = (q: Quality) => (q === 'min' || q === 'dim' ? 3 : 4)
const fifthSemis = (q: Quality) => (q === 'dim' ? 6 : q === 'aug' ? 8 : 7)

// Gốc đặt octave 2 (C2 = MIDI 36). 'A*' cần nextChord.
export function bassFreq(chord: string, degree: Exclude<BassDegree, null>, nextChord?: string): number | null {
  const pc = chordRootPitchClass(chord)
  if (pc === null) return null
  const rootMidi = 36 + pc
  let midi: number
  if (degree === 'R') midi = rootMidi
  else if (degree === '8') midi = rootMidi + 12
  else if (degree === '3') midi = rootMidi + thirdSemis(chordQuality(chord))
  else if (degree === '5') midi = rootMidi + fifthSemis(chordQuality(chord))
  else {
    const npc = nextChord ? chordRootPitchClass(nextChord) : null
    if (npc === null) return null
    const off = degree === 'A3' ? 3 : degree === 'A2' ? 2 : 1
    let am = 36 + npc - off
    if (am < 33) am += 12
    midi = am
  }
  return midiToFreq(midi)
}
