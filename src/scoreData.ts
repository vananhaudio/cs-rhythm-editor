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

export const MOCK_SCORE: ScoreNote[] = [
  // Measure 1 — ascending G major
  n('n1',  0 * BEAT, BEAT, 3, 0,  'Sol',  3, 1, 1),
  n('n2',  1 * BEAT, BEAT, 3, 2,  'La',   3, 1, 2),
  n('n3',  2 * BEAT, BEAT, 4, 0,  'Si',   3, 1, 3),
  n('n4',  3 * BEAT, BEAT, 4, 1,  'Đô',   4, 1, 4),

  // Measure 2 — continuing up then turn
  n('n5',  4 * BEAT, BEAT, 4, 3,  'Rê',   4, 2, 1),
  n('n6',  5 * BEAT, BEAT, 5, 0,  'Mi',   4, 2, 2),
  n('n7',  6 * BEAT, BEAT, 5, 2,  'Fa#',  4, 2, 3),
  n('n8',  7 * BEAT, BEAT, 5, 3,  'Sol',  4, 2, 4),

  // Measure 3 — descending
  n('n9',  8 * BEAT, BEAT, 5, 2,  'Fa#',  4, 3, 1),
  n('n10', 9 * BEAT, BEAT, 5, 0,  'Mi',   4, 3, 2),
  n('n11',10 * BEAT, BEAT, 4, 3,  'Rê',   4, 3, 3),
  n('n12',11 * BEAT, BEAT, 4, 1,  'Đô',   4, 3, 4),

  // Measure 4 — return
  n('n13',12 * BEAT, BEAT, 4, 0,  'Si',   3, 4, 1),
  n('n14',13 * BEAT, BEAT, 3, 2,  'La',   3, 4, 2),
  n('n15',14 * BEAT, BEAT * 2, 3, 0, 'Sol', 3, 4, 3),
];

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
const SEMITONES_FROM_C4: Record<string, number> = {
  'Đô': 0, 'Đô#': 1, 'Rêb': 1,
  'Rê': 2, 'Rê#': 3, 'Mib': 3,
  'Mi': 4,
  'Fa': 5, 'Fa#': 6, 'Solb': 6,
  'Sol': 7, 'Sol#': 8, 'Lab': 8,
  'La': 9, 'La#': 10, 'Sib': 10,
  'Si': 11,
};

export function staffStep(pitch: string, octave: number): number {
  const base = SEMITONES_FROM_C4[pitch] ?? 0;
  return base + (octave - 4) * 12;
}
