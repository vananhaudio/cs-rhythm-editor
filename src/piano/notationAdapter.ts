// ── Adapter: Piano Note → TVA NoteItem (dùng chung NoteSheet renderer) ──
import type { NoteItem } from '../elearn/guitarRenderers'

interface PianoNote { pitch: string; startBeat: number; duration: number }
interface Exercise { title: string; bpm: number; notes: PianoNote[] }

// Pitch class → tên nốt tiếng Việt
const PC_LABEL: Record<string, string> = {
  'C': 'Đô', 'C#': 'Đô#', 'Db': 'Rê♭',
  'D': 'Rê', 'D#': 'Rê#', 'Eb': 'Mi♭',
  'E': 'Mi', 'F': 'Fa', 'F#': 'Fa#', 'Gb': 'Sol♭',
  'G': 'Sol', 'G#': 'Sol#', 'Ab': 'La♭',
  'A': 'La', 'A#': 'La#', 'Bb': 'Si♭',
  'B': 'Si',
}

// Base frequencies for octave 4 (A4 = 440)
const BASE_FREQ: Record<string, number> = {
  'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
  'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 391.99,
  'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88,
}

// Staff position: 0 = bottom line E4 (treble clef, concert pitch)
const STAFF_MAP: Record<string, number> = {
  'C4': -2, 'D4': -1, 'E4': 0, 'F4': 1, 'G4': 2, 'A4': 3, 'B4': 4,
  'C5': 5, 'D5': 6, 'E5': 7, 'F5': 8, 'G5': 9, 'A5': 10, 'B5': 11,
}

/** Parse "C#4" → { pc: "C#", octave: 4 } */
function parsePitch(pitch: string): { pc: string; octave: number } | null {
  const m = pitch.match(/^([A-G][#b]?)(\d)$/i)
  if (!m) return null
  return { pc: m[1].charAt(0).toUpperCase() + m[1].slice(1), octave: parseInt(m[2]) }
}

/** Calculate frequency for any pitch */
export function pitchToFreq(pitch: string): number {
  const p = parsePitch(pitch)
  if (!p) return 440
  const base = BASE_FREQ[p.pc] ?? 440
  return base * Math.pow(2, p.octave - 4)
}

/** Get staff position for a pitch (ledger lines auto-handled by NoteSheet) */
export function pitchToStaff(pitch: string): number {
  return STAFF_MAP[pitch] ?? 3
}

/** Get Vietnamese label (e.g. "C#4" → "Đô#") */
export function pitchToLabel(pitch: string): string {
  const p = parsePitch(pitch)
  if (!p) return pitch
  return PC_LABEL[p.pc] ?? pitch
}

/** Convert Piano Exercise notes → NoteItem[] for NoteSheet */
export function exerciseToNoteItems(ex: Exercise): NoteItem[] {
  return ex.notes.map(n => ({
    label: pitchToLabel(n.pitch),
    freq: pitchToFreq(n.pitch),
    staff: pitchToStaff(n.pitch),
    dur: n.duration,
  }))
}
