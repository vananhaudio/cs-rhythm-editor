import type { WordData, ChordData } from '../xmlTypes';
import { posToTick } from '../xmlTypes';

interface LyricParseResult {
  words: WordData[];
  chords: ChordData[];
  // Map from chordId → wordIndex (0-based) of the word this chord precedes.
  // After autoMatch assigns timing to words, the caller resolves chord timings.
  chordWordIndex: Map<string, number>;
}

function extractChordsFromLine(line: string): {
  cleaned: string;
  lineChords: Array<{ name: string; beforeWordIndex: number }>;
} {
  // Split line into chord-markers and text segments alternately.
  // We need to know which text-token (word) follows each chord marker.
  const lineChords: Array<{ name: string; beforeWordIndex: number }> = [];

  // Replace [Chord] markers with a sentinel, collect chord names and their
  // position among text tokens.
  const segments: Array<{ type: 'text' | 'chord'; value: string }> = [];
  let remaining = line;
  while (remaining.length > 0) {
    const m = remaining.match(/\[([^\]]+)\]/);
    if (!m || m.index === undefined) {
      segments.push({ type: 'text', value: remaining });
      break;
    }
    if (m.index > 0) segments.push({ type: 'text', value: remaining.slice(0, m.index) });
    segments.push({ type: 'chord', value: m[1] });
    remaining = remaining.slice(m.index + m[0].length);
  }

  // Count how many words precede each chord to get beforeWordIndex.
  let wordCount = 0;
  const chordItems: Array<{ name: string; wordsBefore: number }> = [];
  for (const seg of segments) {
    if (seg.type === 'chord') {
      chordItems.push({ name: seg.value, wordsBefore: wordCount });
    } else {
      const tokens = seg.value.trim().split(/\s+/).filter(t => t.length > 0);
      wordCount += tokens.length;
    }
  }

  // cleaned text: strip chord markers
  const cleaned = segments
    .filter(s => s.type === 'text')
    .map(s => s.value)
    .join('')
    .trim();

  // beforeWordIndex is relative to this line; caller adds line offset
  for (const c of chordItems) {
    lineChords.push({ name: c.name, beforeWordIndex: c.wordsBefore });
  }

  return { cleaned, lineChords };
}

export function parseLyrics(text: string): LyricParseResult {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const words: WordData[] = [];
  const chords: ChordData[] = [];
  const chordWordIndex = new Map<string, number>();

  let wordCounter = 0;
  let chordCounter = 0;

  for (const line of lines) {
    const { cleaned, lineChords } = extractChordsFromLine(line);
    const lineWordOffset = words.length; // words already added before this line

    // Add chords with absolute word index = lineWordOffset + beforeWordIndex
    for (const lc of lineChords) {
      const cid = `chord_lyric_${String(++chordCounter).padStart(3, '0')}`;
      chords.push({
        id: cid,
        name: lc.name,
        tick: 0,
        time: 0,
        bar: 0,
        beat: 0,
      });
      // Absolute word index the chord sits before
      chordWordIndex.set(cid, lineWordOffset + lc.beforeWordIndex);
    }

    if (!cleaned) continue;

    const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);
    for (const token of tokens) {
      const clean = token.replace(/[.,!?;:"""''…]+$/, '').replace(/^["""'']+/, '');
      if (!clean) continue;

      const wordId = `word_${String(++wordCounter).padStart(3, '0')}`;
      words.push({
        id: wordId,
        text: clean,
        tick: 0,
        time: 0,
        bar: 0,
        beat: 0,
        duration: 0,
        durationTicks: 0,
        linkedNotes: [],
        isSlurGroup: false,
        confidence: 0,
        source: 'auto',
      });
    }
  }

  return { words, chords, chordWordIndex };
}

// Given matched words (with timing) and the chordWordIndex map, assign
// each chord the time/bar/beat of the word it precedes.
export function resolveChordTimings(
  chords: ChordData[],
  words: WordData[],
  chordWordIndex: Map<string, number>
): ChordData[] {
  return chords.map(chord => {
    const idx = chordWordIndex.get(chord.id);
    if (idx === undefined) return chord;
    const word = words[Math.min(idx, words.length - 1)];
    if (!word || (word.bar === 0 && word.beat === 0 && word.time === 0 && word.linkedNotes.length === 0)) return chord;
    return { ...chord, tick: word.tick, time: word.time, bar: word.bar, beat: word.beat };
  });
}
