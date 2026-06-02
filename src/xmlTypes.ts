// ── Tick system ──
export const TICKS_PER_BEAT = 480 as const

export function posToTick(bar: number, beat: number, timeSig: number, subTick = 0): number {
  return ((bar - 1) * timeSig + (beat - 1)) * TICKS_PER_BEAT + subTick
}

export interface NoteData {
  id: string;
  bar: number;
  beat: number;
  tick: number;       // MIDI tick — nguồn sự thật
  startTime: number;  // giây — chỉ dùng cho playback legacy
  duration: number;   // giây
  durationTicks: number; // tick
  pitch: string;
  velocity: number;
  tieToNext: boolean;
  slurGroupId: string | null;
  source: 'musicxml' | 'midi';
}

export interface WordData {
  id: string;
  text: string;
  tick: number;       // MIDI tick — nguồn sự thật
  time: number;       // giây — legacy
  bar: number;
  beat: number;
  duration: number;
  durationTicks: number;
  linkedNotes: string[];
  isSlurGroup: boolean;
  confidence: number;
  source: 'auto' | 'manual';
}

export interface ChordData {
  id: string;
  name: string;
  tick: number;       // MIDI tick — nguồn sự thật
  time: number;       // giây — legacy
  bar: number;
  beat: number;
}

export interface MappingData {
  wordId: string;
  noteIds: string[];
  method: 'auto' | 'manual' | 'slur-detected';
  confidence: number;
}

export interface ProjectMetadata {
  title: string;
  artist: string;
  tone: string;
  tempo: number;
  timeSignature: number;
  totalBars: number;
}

export interface Project {
  metadata: ProjectMetadata;
  notes: NoteData[];
  words: WordData[];
  chords: ChordData[];
  mappings: MappingData[];
}

export type EditMode = 'view' | 'manual';
