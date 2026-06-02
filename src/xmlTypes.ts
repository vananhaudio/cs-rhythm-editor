/** Ticks per quarter note (PPQ). All timing values in this project use this unit. */
export const PPQ = 480;

/** Convert ticks → seconds given tempo (BPM). */
export function ticksToSeconds(ticks: number, tempo: number): number {
  return (ticks / PPQ) * (60 / tempo);
}

/** Convert seconds → ticks given tempo (BPM). */
export function secondsToTicks(seconds: number, tempo: number): number {
  return Math.round((seconds * tempo * PPQ) / 60);
}

export interface NoteData {
  id: string;
  bar: number;
  /** 1-based fractional beat within bar (e.g. 1.0, 1.5, 2.25) */
  beat: number;
  /** Absolute start position in ticks (PPQ = 480) */
  startTime: number;
  /** Duration in ticks */
  duration: number;
  pitch: string;
  velocity: number;
  tieToNext: boolean;
  slurGroupId: string | null;
  source: 'musicxml' | 'midi';
}

export interface WordData {
  id: string;
  text: string;
  /** Absolute start position in ticks (PPQ = 480) */
  time: number;
  bar: number;
  /** 1-based fractional beat within bar */
  beat: number;
  /** Duration in ticks */
  duration: number;
  linkedNotes: string[];
  isSlurGroup: boolean;
  confidence: number;
  source: 'auto' | 'manual';
}

export interface ChordData {
  id: string;
  name: string;
  /** Absolute start position in ticks (PPQ = 480) */
  time: number;
  bar: number;
  /** 1-based fractional beat within bar */
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
