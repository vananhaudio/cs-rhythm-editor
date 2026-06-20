// Mock score data — standard notation + TAB
// string: 0=low E, 5=high E (matches guitarNotes.ts convention)
// DISPLAY_STRINGS = [5,4,3,2,1,0] → row 0 = string 5 (high E), row 5 = string 0 (low E)

export interface ScoreNote {
  id: string;
  time: number;      // seconds from start
  duration: number;  // seconds
  string: number;    // 0=low E … 5=high E
  fret: number;
  pitch: string;     // Vietnamese name e.g. "Mi", "Fa#"
  octave: number;
  measure: number;   // 1-indexed
  beat: number;      // 1-indexed, fractional ok (e.g. 1.5 = and of beat 1)
  tie?: boolean;     // dấu nối: nối vào nốt cùng dây ngay trước (giữ ngân)
  hopo?: boolean;    // luyến: hammer-on/pull-off sang nốt kế (alphaTab tự chọn chiều)
}

// Tempo: 80 BPM → quarter note = 0.75s
// Time signature: 4/4
const BPM = 80;
const BEAT = 60 / BPM;

// G major scale run: G3→A3→B3→C4→D4→E4→F#4→G4 then back down
// string/fret positions in standard tuning:
//  G3  → string 3, fret 0 (open)
//  A3  → string 3, fret 2
//  B3  → string 4, fret 0 (open)  OR string 3, fret 4
//  C4  → string 4, fret 1  OR string 2, fret 5
//  D4  → string 4, fret 3  OR string 2, fret 7
//  E4  → string 5, fret 0 (open)
//  F#4 → string 5, fret 2
//  G4  → string 5, fret 3

function n(
  id: string, time: number, dur: number,
  str: number, fret: number, pitch: string, octave: number,
  measure: number, beat: number
): ScoreNote {
  return { id, time, duration: dur, string: str, fret, pitch, octave, measure, beat };
}

export const MOCK_SCORE: ScoreNote[] = [];

export const SCORE_TOTAL_DURATION = 16 * BEAT;
export const SCORE_BPM = BPM;
export const SCORE_BEATS_PER_MEASURE = 4;

export function calcTotalDuration(notes: ScoreNote[]): number {
  if (notes.length === 0) return SCORE_BEATS_PER_MEASURE * (60 / BPM); // 1 empty measure
  const last = notes.reduce((a, b) => a.time + a.duration > b.time + b.duration ? a : b);
  // Round up to next measure boundary
  const secPerMeasure = SCORE_BEATS_PER_MEASURE * (60 / BPM);
  return Math.ceil((last.time + last.duration) / secPerMeasure) * secPerMeasure;
}

// Pitch → staff line/space relative to middle C (C4 = 0)
// Positive = above middle C, negative = below
// We'll use semitone distance from C4 for vertical positioning
// Diatonic step: C=0 D=1 E=2 F=3 G=4 A=5 B=6 (7 per octave)
const DIATONIC_FROM_C4: Record<string, number> = {
  'Đô': 0, 'Đô#': 0,
  'Rê': 1, 'Rê#': 1, 'Rêb': 1,
  'Mi': 2, 'Mib': 2,
  'Fa': 3, 'Fa#': 3,
  'Sol': 4, 'Sol#': 4, 'Solb': 4,
  'La': 5, 'La#': 5, 'Lab': 5,
  'Si': 6, 'Sib': 6,
};

export function staffStep(pitch: string, octave: number): number {
  const base = DIATONIC_FROM_C4[pitch] ?? 0;
  return base + (octave - 4) * 7;
}
