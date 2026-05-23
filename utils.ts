// ============================================================
// CS Rhythm Editor — Utils
// TIME là nguồn sự thật. Mọi thứ derive từ TIME.
// ============================================================

import type { Beat, LyricEvent, ChordEvent, RhythmSong, SnapMode } from './types';

// ── ID ──
let _id = 0;
export function genId(): string {
  return `ev-${Date.now()}-${++_id}`;
}

// ── Beat duration ──
export function beatDuration(tempo: number): number {
  return 60 / tempo;
}

// ── Bar duration ──
export function barDuration(tempo: number, timeSig: number): number {
  return beatDuration(tempo) * timeSig;
}

// ── Time của một beat cụ thể ──
export function beatTime(bar: number, beat: number, tempo: number, timeSig: number): number {
  // bar, beat đều 1-indexed
  return ((bar - 1) * timeSig + (beat - 1)) * beatDuration(tempo);
}

// ── Generate toàn bộ Beat Layer từ tempo + timeSig + totalBars ──
export function generateBeats(tempo: number, timeSig: number, totalBars: number): Beat[] {
  const beats: Beat[] = [];
  for (let bar = 1; bar <= totalBars; bar++) {
    for (let beat = 1; beat <= timeSig; beat++) {
      beats.push({
        time: beatTime(bar, beat, tempo, timeSig),
        bar,
        beat,
        strong: beat === 1,
      });
    }
  }
  return beats;
}

// ── Từ TIME → tìm bar và beat gần nhất ──
export function timeToPosition(
  time: number,
  tempo: number,
  timeSig: number
): { bar: number; beat: number; beatFraction: number } {
  const bd = beatDuration(tempo);
  const totalBeats = time / bd;
  const beatIndex = Math.floor(totalBeats); // 0-indexed beat toàn bài
  const beatFraction = totalBeats - beatIndex;
  const bar = Math.floor(beatIndex / timeSig) + 1;
  const beat = (beatIndex % timeSig) + 1;
  return { bar, beat, beatFraction };
}

// ── Snap time về beat/subbeat gần nhất ──
export function snapTime(time: number, tempo: number, timeSig: number, mode: SnapMode): number {
  if (mode === 'free') return time;
  const bd = beatDuration(tempo);
  if (mode === 'beat') {
    return Math.round(time / bd) * bd;
  }
  // subbeat = chia đôi beat
  const sub = bd / 2;
  return Math.round(time / sub) * sub;
}

// ── Format time ──
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

// ── Tạo bài trống ──
export function createEmptySong(overrides?: Partial<RhythmSong>): RhythmSong {
  const tempo = overrides?.tempo ?? 80;
  const timeSignature = overrides?.timeSignature ?? 4;
  const totalBars = overrides?.totalBars ?? 16;
  return {
    title: '',
    artist: '',
    tone: 'Am',
    tempo,
    timeSignature,
    totalBars,
    beats: generateBeats(tempo, timeSignature, totalBars),
    lyrics: [],
    chords: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '2.0',
    ...overrides,
  };
}

// ── Rebuild beats khi tempo/timeSig/totalBars thay đổi ──
export function rebuildSong(song: RhythmSong): RhythmSong {
  return {
    ...song,
    beats: generateBeats(song.tempo, song.timeSignature, song.totalBars),
    updatedAt: new Date().toISOString(),
  };
}

// ── Token từ parse inline HợpÂmViệt ──
export interface ParseToken {
  kind: 'chord' | 'lyric';
  text: string;
  beatOffset: number; // beat toàn bài (0-indexed)
}

// ── Parse inline: [Am]Gọi nàng [F]trên vai ──
// Quy tắc:
//   - Chord → gán beat 0 của bar tiếp theo (mặc định beat 1)
//   - Lời sau chord → beat 0, 1, 2... của bar đó
//   - Lời tràn bar → sang bar tiếp
export function parseHopAmViet(text: string, timeSig: number): ParseToken[] {
  const CHORD_RE = /[\[(]([A-Ga-g][#b]?(?:maj7|maj|min7|min|m7b5|m7|dim7|dim|aug|sus4|sus2|sus|add9|add|m)?[0-9]?(?:\/[A-G][#b]?)?)[\])]/g;
  const tokens: ParseToken[] = [];
  let currentBar = 0;
  let beatInBar = 0;
  let firstChordSeen = false;

  const lines = text.split('\n').filter(l => l.trim());

  for (const line of lines) {
    CHORD_RE.lastIndex = 0;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = CHORD_RE.exec(line)) !== null) {
      // Lời trước chord — luôn gán vào bar/beat hiện tại
      const lyricBefore = line.slice(lastIdx, match.index).trim();
      if (lyricBefore) {
        for (const w of lyricBefore.split(/\s+/).filter(Boolean)) {
          tokens.push({ kind: 'lyric', text: w, beatOffset: currentBar * timeSig + beatInBar });
          beatInBar++;
          if (beatInBar >= timeSig) { currentBar++; beatInBar = 0; }
        }
      }

      // Chord:
      // - Chord đầu tiên: luôn nhảy về beat 0 của bar tiếp theo
      //   (lời lấy đà trước đó ở bar 1, chord đầu tiên ở bar 2 nếu có lời trước)
      //   Nếu không có lời trước → chord đầu tiên ở bar 1
      // - Chord tiếp theo: nhảy về beat 0 của bar mới nếu không đang ở beat 0
      if (!firstChordSeen) {
        firstChordSeen = true;
        // Nếu đã có lời lấy đà → chord sang bar mới
        // Nếu chưa có lời → chord ở bar 1
        if (beatInBar !== 0) { currentBar++; beatInBar = 0; }
      } else if (beatInBar !== 0) {
        currentBar++;
        beatInBar = 0;
      }

      tokens.push({ kind: 'chord', text: match[1], beatOffset: currentBar * timeSig });
      lastIdx = match.index + match[0].length;
    }

    // Lời sau chord cuối dòng
    const lyricAfter = line.slice(lastIdx).trim();
    if (lyricAfter) {
      for (const w of lyricAfter.split(/\s+/).filter(Boolean)) {
        tokens.push({ kind: 'lyric', text: w, beatOffset: currentBar * timeSig + beatInBar });
        beatInBar++;
        if (beatInBar >= timeSig) { currentBar++; beatInBar = 0; }
      }
    }
  }
  return tokens;
}

// ── Parse với beatsPerChord tùy chỉnh (hỗ trợ 2 chords/bar) ──
export function parseHopAmVietWithBeatsPerChord(
  text: string, timeSig: number, beatsPerChord: number
): ParseToken[] {
  const CHORD_RE = /[\[(]([A-Ga-g][#b]?(?:maj7|maj|min7|min|m7b5|m7|dim7|dim|aug|sus4|sus2|sus|add9|add|m)?[0-9]?(?:\/[A-G][#b]?)?)[\])]/g;
  const tokens: ParseToken[] = [];
  let chordCount = 0;       // số chord đã gặp
  let hasPickup = false;    // có lời lấy đà trước chord đầu không
  let pickupBeats = 0;      // số beats lời lấy đà

  // Pass 1: đếm lời lấy đà (trước chord đầu tiên)
  const firstMatch = CHORD_RE.exec(text);
  if (firstMatch && firstMatch.index > 0) {
    const before = text.slice(0, firstMatch.index).trim();
    if (before) {
      hasPickup = true;
      pickupBeats = before.split(/\s+/).filter(Boolean).length;
    }
  }
  CHORD_RE.lastIndex = 0;

  // Hàm tính beat của chord thứ n (0-indexed)
  const chordBeat = (n: number): number => {
    if (hasPickup) {
      // Chord đầu ở đầu bar 2 (timeSig beats)
      return timeSig + n * beatsPerChord;
    } else {
      return n * beatsPerChord;
    }
  };

  // Pass 2: thu thập tất cả segments (chord + lời đi kèm)
  // Mỗi segment: { chord, lyrics[] }
  // Lời lấy đà (trước chord đầu) là segment đặc biệt
  interface Segment {
    chordName: string | null;
    lyrics: string[];
  }
  const segments: Segment[] = [];
  const lines = text.split('\n').filter(l => l.trim());
  let currentSegment: Segment = { chordName: null, lyrics: [] };
  let passedFirstChord = false;

  for (const line of lines) {
    CHORD_RE.lastIndex = 0;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = CHORD_RE.exec(line)) !== null) {
      const lyricBefore = line.slice(lastIdx, match.index).trim();
      if (lyricBefore) {
        const words = lyricBefore.split(/\s+/).filter(Boolean);
        if (!passedFirstChord) {
          // Lời lấy đà — thuộc segment pickup
          currentSegment.lyrics.push(...words);
        } else {
          currentSegment.lyrics.push(...words);
        }
      }

      // Lưu segment hiện tại, bắt đầu segment mới với chord này
      if (passedFirstChord || currentSegment.lyrics.length > 0) {
        segments.push(currentSegment);
      }
      currentSegment = { chordName: match[1], lyrics: [] };
      passedFirstChord = true;
      lastIdx = match.index + match[0].length;
    }

    const lyricAfter = line.slice(lastIdx).trim();
    if (lyricAfter) {
      currentSegment.lyrics.push(...lyricAfter.split(/\s+/).filter(Boolean));
    }
  }
  // Push segment cuối
  if (currentSegment.chordName || currentSegment.lyrics.length > 0) {
    segments.push(currentSegment);
  }

  // Pass 3: gán beatOffset
  // Segment 0 nếu không có chord = pickup (lời lấy đà)
  // Segment có chord = chord beat + lời chia đều trong slot
  let chordIdx = 0;
  for (const seg of segments) {
    if (seg.chordName === null) {
      // Pickup lyrics — beat 0,1,2... (không quan trọng, user tự kéo)
      seg.lyrics.forEach((w, i) => {
        tokens.push({ kind: 'lyric', text: w, beatOffset: i });
      });
    } else {
      const cb = chordBeat(chordIdx);
      tokens.push({ kind: 'chord', text: seg.chordName, beatOffset: cb });
      // Lời trong slot: tất cả bắt đầu từ cb (cùng beat với chord)
      // Phân bổ đều trong beatsPerChord nếu muốn, hoặc tất cả = cb
      const slotBeats = beatsPerChord;
      seg.lyrics.forEach((w, i) => {
        const lyricBeat = cb + (seg.lyrics.length > 1 ? Math.floor(i * slotBeats / seg.lyrics.length) : 0);
        tokens.push({ kind: 'lyric', text: w, beatOffset: lyricBeat });
      });
      chordIdx++;
    }
  }

  return tokens;
}

// ── Convert tokens → events với time thật ──
export function importFromHopAmViet(
  text: string,
  song: RhythmSong,
  chordsPerBar: number = 1
): { lyrics: LyricEvent[]; chords: ChordEvent[]; tokens: ParseToken[] } {
  // chordsPerBar=1: chord nhảy sang bar mới (timeSig beats/chord)
  // chordsPerBar=2: chord nhảy sang nửa bar (timeSig/2 beats/chord)
  const beatsPerChord = Math.max(1, Math.floor(song.timeSignature / chordsPerBar));

  // Parse vẫn dùng timeSig thật để giữ nhịp lấy đà đúng
  // Nhưng override khoảng cách nhảy bar của chord = beatsPerChord
  const tokens = parseHopAmVietWithBeatsPerChord(text, song.timeSignature, beatsPerChord);
  const bd = beatDuration(song.tempo);
  const maxBeats = song.totalBars * song.timeSignature;
  const chords: ChordEvent[] = [];
  const lyrics: LyricEvent[] = [];

  for (const tok of tokens) {
    if (tok.beatOffset >= maxBeats) continue;
    const time = tok.beatOffset * bd;
    if (tok.kind === 'chord') {
      chords.push({ id: genId(), name: tok.text, time });
    } else {
      lyrics.push({ id: genId(), text: tok.text, time });
    }
  }
  return { chords, lyrics, tokens };
}

// ── Export JSON ──
export function exportToJson(song: RhythmSong): string {
  // Export chỉ data quan trọng, không export beats (generated)
  const { beats: _beats, ...rest } = song;
  return JSON.stringify(rest, null, 2);
}

export function downloadJson(song: RhythmSong): void {
  const json = exportToJson(song);
  const filename = `${song.title || 'bai-hat'}.cs-rhythm.json`;
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function importFromJson(json: string): RhythmSong {
  const data = JSON.parse(json);
  // Rebuild beats khi import
  const song = { ...data, beats: generateBeats(data.tempo, data.timeSignature, data.totalBars) };
  return song as RhythmSong;
}

export const CHORD_SUGGESTIONS = [
  'Am','A','A7','Am7','Bm','B','B7','C','Cmaj7','C7',
  'Dm','D','D7','Em','E','E7','F','Fmaj7','G','G7',
];
