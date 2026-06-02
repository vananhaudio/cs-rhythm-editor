import type { NoteData, ChordData, WordData, ProjectMetadata } from '../xmlTypes';
import { PPQ } from '../xmlTypes';

interface ParseResult {
  notes: NoteData[];
  chords: ChordData[];
  metadata: Partial<ProjectMetadata>;
  embeddedWords: WordData[];
}

const SEMITONE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToPitch(midi: number): string {
  const name = SEMITONE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

// Convert alphaTab internal ticks (960 PPQ) to our PPQ (480)
function atTicksToTicks(atTicks: number): number {
  return Math.round((atTicks / 960) * PPQ);
}

// Suppress unused import warning

export async function parseGuitarPro(buffer: ArrayBuffer): Promise<ParseResult> {
  const at = await import('@coderline/alphatab');
  const { importer, Settings, LogLevel } = at;

  const settings = new Settings();
  settings.core.logLevel = LogLevel.None;

  const bytes = new Uint8Array(buffer);
  let score: InstanceType<typeof at.model.Score>;
  try {
    score = importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
  } catch (e) {
    throw new Error(`Cannot read file: ${(e as Error).message}`);
  }

  const notes: NoteData[] = [];
  const chords: ChordData[] = [];
  const embeddedWords: WordData[] = [];
  let noteCounter = 0;
  let chordCounter = 0;
  let wordCounter = 0;

  const title = score.title ?? '';
  const artist = score.artist ?? '';

  // Build bar → absolute start tick (480 PPQ) map
  const barStartTicks: number[] = [];
  const barTempos: number[] = [];
  let globalTempo = score.tempo ?? 80;
  let absoluteTick = 0;

  for (const mb of score.masterBars) {
    const tempoAuto = mb.tempoAutomation;
    if (tempoAuto) globalTempo = tempoAuto.value ?? globalTempo;

    barStartTicks.push(absoluteTick);
    barTempos.push(globalTempo);

    // calculateDuration() returns alphaTab's internal ticks (960 PPQ)
    absoluteTick += atTicksToTicks(mb.calculateDuration());
  }

  const timeSignature = score.masterBars[0]?.timeSignatureNumerator ?? 4;
  const totalBars = score.masterBars.length;
  const finalTempo = score.tempo ?? 80;

  // Use first track (melody / vocal lead)
  const track = score.tracks[0];
  if (!track) {
    return { notes: [], chords: [], embeddedWords: [], metadata: { title, artist, tempo: finalTempo, timeSignature, totalBars } };
  }

  const staff = track.staves[0];
  if (!staff) {
    return { notes: [], chords: [], embeddedWords: [], metadata: { title, artist, tempo: finalTempo, timeSignature, totalBars } };
  }

  for (let barIdx = 0; barIdx < staff.bars.length; barIdx++) {
    const bar = staff.bars[barIdx];
    const barNum = barIdx + 1;
    const barStartTick = barStartTicks[barIdx] ?? 0;

    // Primary voice (voice 0)
    const voice = bar.voices[0];
    if (!voice || voice.isEmpty) continue;

    for (const beat of voice.beats) {
      if (beat.isEmpty) continue;

      // Absolute start tick of this beat (converted from alphaTab 960 PPQ to our 480 PPQ)
      const beatStartTick = barStartTick + atTicksToTicks(beat.playbackStart);
      const beatDurTicks = atTicksToTicks(beat.playbackDuration);

      // Beat position (1-based)
      const timeSigNum = score.masterBars[barIdx]?.timeSignatureNumerator ?? 4;
      const barDurAtTicks = score.masterBars[barIdx]?.calculateDuration() ?? 3840;
      const beatNum = parseFloat(((beat.playbackStart / barDurAtTicks) * timeSigNum + 1).toFixed(2));

      const lyricText = (beat.lyrics as string[] | null)?.[0]?.trim() ?? '';

      const isLegato = beat.isLegatoOrigin === true;
      const slurGroupId = isLegato ? `slur_${barNum}_${Math.floor(beatNum)}` : null;

      if (beat.chord?.name) {
        chords.push({
          id: `chord_${String(++chordCounter).padStart(3, '0')}`,
          name: beat.chord.name,
          time: beatStartTick,
          bar: barNum,
          beat: beatNum,
        });
      }

      const beatNoteIds: string[] = [];

      for (const note of beat.notes) {
        const midi = note.displayValue ?? 60;
        const pitch = midiToPitch(midi);
        const tieToNext = !!(note as any).tieDestination;

        const noteId = `note_${String(++noteCounter).padStart(3, '0')}`;
        beatNoteIds.push(noteId);
        notes.push({
          id: noteId,
          bar: barNum,
          beat: beatNum,
          startTime: beatStartTick,
          duration: beatDurTicks,
          pitch,
          velocity: 80,
          tieToNext,
          slurGroupId,
          source: 'musicxml',
        });
      }

      if (lyricText && beatNoteIds.length > 0) {
        const cleanText = lyricText.replace(/-$/, '');
        if (cleanText) {
          embeddedWords.push({
            id: `word_${String(++wordCounter).padStart(3, '0')}`,
            text: cleanText,
            time: beatStartTick,
            bar: barNum,
            beat: beatNum,
            duration: beatDurTicks,
            linkedNotes: beatNoteIds,
            isSlurGroup: !!slurGroupId,
            confidence: 1.0,
            source: 'auto',
          });
        }
      }
    }
  }

  const merged = mergeTiedNotes(notes);

  return {
    notes: merged,
    chords,
    metadata: { title, artist, tempo: finalTempo, timeSignature, totalBars },
    embeddedWords,
  };
}

function mergeTiedNotes(notes: NoteData[]): NoteData[] {
  const result: NoteData[] = [];
  let i = 0;
  while (i < notes.length) {
    const note = { ...notes[i] };
    while (note.tieToNext && i + 1 < notes.length && notes[i + 1].pitch === note.pitch) {
      i++;
      note.duration = note.duration + notes[i].duration;
      note.tieToNext = notes[i].tieToNext;
    }
    note.tieToNext = false;
    result.push(note);
    i++;
  }
  return result;
}

export function isGuitarProFile(filename: string): boolean {
  return /\.(gp[3-8x]|gpx)$/i.test(filename);
}
