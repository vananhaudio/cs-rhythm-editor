export interface NoteData {
  id: string;
  bar: number;
  beat: number;
  startTime: number;
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
  time: number;
  bar: number;
  beat: number;
  duration: number;
  linkedNotes: string[];
  isSlurGroup: boolean;
  confidence: number;
  source: 'auto' | 'manual';
}

export interface ChordData {
  id: string;
  name: string;
  time: number;
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
