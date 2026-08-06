// ── Adapter: Piano Note → TVA NoteItem (dùng chung NoteSheet renderer) ──
import type { NoteItem } from '../elearn/guitarRenderers'

interface PianoNote { pitch: string; startBeat: number; duration: number }
interface LeftHandNote { pitch: string; startBeat: number; duration: number }
interface Exercise { title: string; bpm: number; notes: PianoNote[]; leftHand?: LeftHandNote[]; beatsPerBar?: number }

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

// Staff position: 0 = bottom line E4 (treble clef)
const STAFF_MAP: Record<string, number> = {
  'C4': -2, 'D4': -1, 'E4': 0, 'F4': 1, 'G4': 2, 'A4': 3, 'B4': 4,
  'C5': 5, 'D5': 6, 'E5': 7, 'F5': 8, 'G5': 9, 'A5': 10, 'B5': 11,
}

// Bass staff position (F clef): 0 = bottom line G2... but for simplicity,
// map bass notes to low staff positions
const BASS_STAFF_MAP: Record<string, number> = {
  'C3': -4, 'D3': -3, 'E3': -2, 'F3': -1, 'G2': -6, 'A2': -5, 'B2': -4,
  'C2': -8, 'D2': -7,
}

function parsePitch(pitch: string): { pc: string; octave: number } | null {
  const m = pitch.match(/^([A-G][#b]?)(\d)$/i)
  if (!m) return null
  return { pc: m[1].charAt(0).toUpperCase() + m[1].slice(1), octave: parseInt(m[2]) }
}

export function pitchToFreq(pitch: string): number {
  if (pitch === 'rest') return 0
  const p = parsePitch(pitch)
  if (!p) return 440
  const base = BASE_FREQ[p.pc] ?? 440
  return base * Math.pow(2, p.octave - 4)
}

export function pitchToStaff(pitch: string): number {
  if (pitch === 'rest') return 3  // rest sits on middle line
  return STAFF_MAP[pitch] ?? 3
}

export function pitchToLabel(pitch: string): string {
  if (pitch === 'rest') return 'Nghỉ'
  const p = parsePitch(pitch)
  if (!p) return pitch
  return PC_LABEL[p.pc] ?? pitch
}

/** Convert Piano Exercise notes → NoteItem[] for NoteSheet (tay phải + tay trái gộp) */
export function exerciseToNoteItems(ex: Exercise): NoteItem[] {
  const items: NoteItem[] = []

  // Tay phải (melody)
  for (const n of ex.notes) {
    const isRest = n.pitch === 'rest'
    items.push({
      label: isRest ? '' : pitchToLabel(n.pitch),
      freq: isRest ? 0 : pitchToFreq(n.pitch),
      staff: pitchToStaff(n.pitch),
      dur: n.duration,
      rest: isRest,
    })
  }

  return items
}

/** Convert left hand notes → NoteItem[] for separate bass display */
export function leftHandToNoteItems(ex: Exercise): NoteItem[] {
  if (!ex.leftHand?.length) return []
  return ex.leftHand.map(n => {
    const isRest = n.pitch === 'rest'
    return {
      label: isRest ? '' : pitchToLabel(n.pitch),
      freq: isRest ? 0 : pitchToFreq(n.pitch),
      staff: BASS_STAFF_MAP[n.pitch] ?? 0,
      dur: n.duration,
      rest: isRest,
    }
  })
}

/** Chỉ lấy note items cho tay phải (không rest) — dùng cho chấm điểm/pitch detect */
export function melodyNoteItems(ex: Exercise): NoteItem[] {
  return ex.notes
    .filter(n => n.pitch !== 'rest')
    .map(n => ({
      label: pitchToLabel(n.pitch),
      freq: pitchToFreq(n.pitch),
      staff: pitchToStaff(n.pitch),
      dur: n.duration,
      rest: false,
    }))
}

/** Tổng số nốt cần đánh (không tính rest). */
export function playableNoteCount(ex: Exercise): number {
  return ex.notes.filter(n => n.pitch !== 'rest').length
}
