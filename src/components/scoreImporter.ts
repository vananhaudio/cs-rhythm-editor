// Đọc file GP / MusicXML qua AlphaTab ScoreLoader → chuyển thành ScoreNote[]
import type { ScoreNote } from '../scoreData';
import { SCORE_BEATS_PER_MEASURE } from '../scoreData';
import { getNoteForFret } from '../guitarNotes';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as alphaTabModule from '@coderline/alphatab';

// AlphaTab dùng 960 ticks per quarter note
const TICKS_PER_QUARTER = 960;

// MIDI nốt buông từng dây (model ta): 0=Mi trầm E2(40) … 5=Mi cao E4(64)
const OPEN_MIDI = [40, 45, 50, 55, 59, 64];

// Suy dây/phím guitar từ số MIDI (cho file ký âm không có TAB).
// Chọn dây cao nhất còn cho phím >= 0 → vị trí phím thấp nhất, tự nhiên nhất.
function midiToStringFret(midi: number): { str: number; fret: number } | null {
  for (let s = 5; s >= 0; s--) {
    const fret = midi - OPEN_MIDI[s];
    if (fret >= 0 && fret <= 24) return { str: s, fret };
  }
  return null;
}

export interface ImportResult {
  notes: ScoreNote[];
  bpm: number;
}

export async function importScoreFile(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const at = alphaTabModule as any;
  const ScoreLoader = at.importer?.ScoreLoader ?? at.ScoreLoader;
  if (!ScoreLoader) throw new Error('AlphaTab ScoreLoader not found. Keys: ' + Object.keys(at).join(', '));

  const score = ScoreLoader.loadScoreFromBytes(data);

  const bpm: number = score.tempo ?? 80;
  const spb = 60 / bpm;   // seconds per quarter note (beat)

  const track = score.tracks?.[0];
  if (!track) return { notes: [], bpm };

  const staff = track.staves?.[0];
  if (!staff) return { notes: [], bpm };

  const notes: ScoreNote[] = [];
  let idCounter = 0;

  for (const bar of (staff.bars ?? [])) {
    const voice = bar.voices?.[0];
    if (!voice) continue;
    const timeSigNum: number = bar.masterBar?.timeSignatureNumerator ?? SCORE_BEATS_PER_MEASURE;

    for (const beat of (voice.beats ?? [])) {
      const startTick: number = beat.absoluteDisplayStart ?? 0;
      const timeSec = (startTick / TICKS_PER_QUARTER) * spb;

      const durTicks: number = beat.displayDuration ?? TICKS_PER_QUARTER;
      const durSec = (durTicks / TICKS_PER_QUARTER) * spb;

      const measure = Math.floor(timeSec / (timeSigNum * spb)) + 1;
      const beat1 = ((timeSec / spb) % timeSigNum) + 1;

      if (beat.isRest) {
        notes.push({
          id: `imp-r${idCounter++}`,
          time: timeSec, duration: durSec,
          string: -1, fret: -1, pitch: 'R', octave: 0,
          measure, beat: beat1,
        });
        continue;
      }

      for (const note of (beat.notes ?? [])) {
        const rawStr = note.string;
        const rawFret = note.fret;

        let ourStr: number;
        let fret: number;
        if (rawStr != null && rawStr >= 1 && rawStr <= 6 && rawFret != null && rawFret >= 0) {
          // Nốt có TAB: AlphaTab dây 1=Mi trầm…6=Mi cao → ta 0=Mi trầm…5=Mi cao
          ourStr = rawStr - 1;
          fret = Math.floor(rawFret);
        } else {
          // Nốt ký âm (không TAB): suy từ cao độ MIDI
          const midi = note.realValue;
          if (midi == null || isNaN(midi)) continue;
          const sf = midiToStringFret(midi);
          if (!sf) continue;   // ngoài tầm guitar
          ourStr = sf.str;
          fret = sf.fret;
        }
        const nf = getNoteForFret(ourStr, fret, 'sharp');
        notes.push({
          id: `imp-n${idCounter++}`,
          time: timeSec, duration: durSec,
          string: ourStr, fret,
          pitch: nf.noteName, octave: nf.octave,
          measure, beat: beat1,
        });
      }
    }
  }

  return { notes, bpm };
}
