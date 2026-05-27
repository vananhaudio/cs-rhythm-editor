// Standard guitar tuning: E2, A2, D3, G3, B3, E4
// Vietnamese note names: Mi, La, Re, Sol, Si, Mi
// Fret 0 = open string, frets 1-15

export interface GuitarNote {
  string: number; // 0 = low E (bottom), 5 = high E (top)
  fret: number;
  noteName: string;    // Vietnamese: Do, Re, Mi, Fa, Sol, La, Si
  noteNameEn: string;  // English: C, D, E, F, G, A, B
  frequency: number;
  octave: number;
  isSharp: boolean;
}

// Open string frequencies (Hz)
const openStringFrequencies = [
  82.41,  // String 0: E2 (Mi thấp)
  110.0,  // String 1: A2 (La)
  146.83, // String 2: D3 (Re)
  196.0,  // String 3: G3 (Sol)
  246.94, // String 4: B3 (Si)
  329.63, // String 5: E4 (Mi cao)
];

// Semitone offsets from E for open strings
const openStringSemitones = [0, 5, 10, 15, 19, 24];
// E=0, A=5, D=10, G=15, B=19, E=24

const chromaticSharpVi = ['Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si', 'Đô', 'Đô#', 'Rê', 'Rê#'];
const chromaticFlatVi  = ['Mi', 'Fa', 'Solb', 'Sol', 'Lab', 'La', 'Sib', 'Si', 'Đô', 'Rêb', 'Rê', 'Mib'];

const chromaticSharpEn = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];
const chromaticFlatEn  = ['E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb'];

export type AccidentalMode = 'sharp' | 'flat';

export function getNoteForFret(stringIndex: number, fret: number, accidental: AccidentalMode = 'sharp'): GuitarNote {
  const semitone = (openStringSemitones[stringIndex] + fret) % 12;
  const freq = openStringFrequencies[stringIndex] * Math.pow(2, fret / 12);
  const octaveOffset = Math.floor((openStringSemitones[stringIndex] + fret) / 12);
  const viNames = accidental === 'flat' ? chromaticFlatVi : chromaticSharpVi;
  const enNames = accidental === 'flat' ? chromaticFlatEn : chromaticSharpEn;
  const isSharp = viNames[semitone].includes('#') || viNames[semitone].includes('b');

  return {
    string: stringIndex,
    fret,
    noteName: viNames[semitone],
    noteNameEn: enNames[semitone],
    frequency: freq,
    octave: 2 + octaveOffset,
    isSharp,
  };
}

// Fret marker positions (standard guitar dots)
export const fretMarkers = [3, 5, 7, 9, 12, 15];
export const doubleDotFrets = [12];

export const stringLabels = ['Mi', 'La', 'Rê', 'Sol', 'Si', 'Mi'];
export const stringLabelColors = [
  '#6B7280', // Mi low - gray
  '#D97706', // La - amber
  '#DC2626', // Re - red
  '#7C3AED', // Sol - purple... wait no
  '#059669', // Si - green
  '#2563EB', // Mi high - blue
];

// Override colors to avoid purple
export const STRING_COLORS = [
  '#6B7280', // Mi low - slate
  '#D97706', // La - amber
  '#DC2626', // Re - red
  '#0891B2', // Sol - cyan
  '#059669', // Si - emerald
  '#2563EB', // Mi high - blue
];

export const NOTE_COLORS: Record<string, string> = {
  'Đô':  '#EF4444',
  'Đô#': '#F97316',
  'Rê':  '#EAB308',
  'Rê#': '#84CC16',
  'Mi':  '#3B82F6',
  'Fa':  '#EC4899',
  'Fa#': '#14B8A6',
  'Sol': '#F59E0B',
  'Sol#':'#10B981',
  'La':  '#8B5CF6',
  'La#': '#6366F1',
  'Si':  '#64748B',
};

// Rainbow spectrum: Đô→Si maps to Đỏ→Tím (red → violet)
// Natural notes = 7 rainbow colors, sharps = blended intermediates
export const NOTE_COLOR_MAP: Record<string, string> = {
  'Đô':   '#EF2020',
  'Đô#':  '#F45A10',
  'Rêb':  '#F45A10', // = Đô#
  'Rê':   '#F97316',
  'Rê#':  '#CBBB00',
  'Mib':  '#CBBB00', // = Rê#
  'Mi':   '#EAB308',
  'Fa':   '#22C55E',
  'Fa#':  '#0EA5C4',
  'Solb': '#0EA5C4', // = Fa#
  'Sol':  '#3B82F6',
  'Sol#': '#6054D8',
  'Lab':  '#6054D8', // = Sol#
  'La':   '#4F46B8',
  'La#':  '#7C3AED',
  'Sib':  '#7C3AED', // = La#
  'Si':   '#9333EA',
};
