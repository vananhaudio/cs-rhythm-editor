// ============================================================
// CS Rhythm Editor — Types
// TIME-BASED RHYTHM DATA SYSTEM
// TIME là hệ tọa độ gốc tuyệt đối.
// ============================================================

// ── Beat node ──
export interface Beat {
  time: number;     // giây — nguồn sự thật
  bar: number;      // ô nhịp (1-indexed)
  beat: number;     // phách trong ô nhịp (1-indexed)
  strong: boolean;  // phách mạnh (beat 1 của bar)
}

// ── Subbeat node (tùy chọn) ──
export interface SubBeat {
  time: number;
  bar: number;
  beat: number;
  sub: string;  // "&", "e", "a", "triplet-1"...
}

// ── Lyric event ──
export interface LyricEvent {
  id: string;
  text: string;
  time: number;  // rhythm anchor — nguồn sự thật
}

// ── Chord event ──
export interface ChordEvent {
  id: string;
  name: string;
  time: number;  // nguồn sự thật
}

// ── Toàn bộ bài ──
export interface RhythmSong {
  title: string;
  artist: string;
  tone: string;
  tempo: number;
  originalTempo?: number; // tempo gốc lúc import, dùng để render grid           // BPM
  timeSignature: 2 | 3 | 4 | 6;
  totalBars: number;

  // Timeline layers
  beats: Beat[];           // Beat Layer — generated từ tempo
  lyrics: LyricEvent[];    // Lyric Layer
  chords: ChordEvent[];    // Chord Layer

  createdAt: string;
  updatedAt: string;
  version: '2.0';
}

// ── Snap mode ──
export type SnapMode = 'beat' | 'subbeat' | 'free';

// ── Item đang được "cầm" để di chuyển ──
export interface PickedItem {
  kind: 'lyric' | 'chord';
  id: string;
  text: string;
}
