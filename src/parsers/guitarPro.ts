import type { NoteData, ChordData, WordData, ProjectMetadata } from '../xmlTypes';

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

// Convert ticks to seconds given tempo (BPM), at 960 ticks per quarter note
function ticksToSeconds(ticks: number, tempo: number): number {
  return (ticks / 960) * (60 / tempo);
}

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

  // Build bar → absolute start time (seconds) map
  // Each masterBar has tempoAutomations and calculateDuration() in ticks
  const barStartTimes: number[] = [];
  const barTempos: number[] = [];
  let globalTempo = score.tempo ?? 80;
  let absoluteTime = 0;

  for (const mb of score.masterBars) {
    // Tempo at this bar
    const tempoAuto = mb.tempoAutomation;
    if (tempoAuto) globalTempo = tempoAuto.value ?? globalTempo;

    barStartTimes.push(absoluteTime);
    barTempos.push(globalTempo);

    const barTicks = mb.calculateDuration();
    absoluteTime += ticksToSeconds(barTicks, globalTempo);
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
    const barStart = barStartTimes[barIdx] ?? 0;
    const barTempo = barTempos[barIdx] ?? finalTempo;

    // Primary voice (voice 0)
    const voice = bar.voices[0];
    if (!voice || voice.isEmpty) continue;

    for (const beat of voice.beats) {
      if (beat.isEmpty) continue;

      // Absolute start time of this beat
      const beatStartSec = barStart + ticksToSeconds(beat.playbackStart, barTempo);
      const beatDurSec = ticksToSeconds(beat.playbackDuration, barTempo);

      // Beat position (1-based)
      const timeSigNum = score.masterBars[barIdx]?.timeSignatureNumerator ?? 4;
      const barDurTicks = score.masterBars[barIdx]?.calculateDuration() ?? 3840;
      const beatNum = parseFloat(((beat.playbackStart / barDurTicks) * timeSigNum + 1).toFixed(2));

      // Lyrics on this beat (array of strings, one per lyric line)
      const lyricText = (beat.lyrics as string[] | null)?.[0]?.trim() ?? '';

      // Slur / legato detection
      const isLegato = beat.isLegatoOrigin === true;
      const slurGroupId = isLegato ? `slur_${barNum}_${Math.floor(beatNum)}` : null;

      // Chord name
      if (beat.chord?.name) {
        chords.push({
          id: `chord_${String(++chordCounter).padStart(3, '0')}`,
          name: beat.chord.name,
          time: parseFloat(beatStartSec.toFixed(4)),
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
          startTime: parseFloat(beatStartSec.toFixed(4)),
          duration: parseFloat(beatDurSec.toFixed(4)),
          pitch,
          velocity: 80,
          tieToNext,
          slurGroupId,
          source: 'musicxml',
        });
      }

      // Attach embedded lyric word to this beat
      if (lyricText && beatNoteIds.length > 0) {
        const cleanText = lyricText.replace(/-$/, ''); // strip trailing hyphen (syllable continuation)
        if (cleanText) {
          embeddedWords.push({
            id: `word_${String(++wordCounter).padStart(3, '0')}`,
            text: cleanText,
            time: parseFloat(beatStartSec.toFixed(4)),
            bar: barNum,
            beat: beatNum,
            duration: parseFloat(beatDurSec.toFixed(4)),
            linkedNotes: beatNoteIds,
            isSlurGroup: !!slurGroupId,
            confidence: 1.0,
            source: 'auto',
          });
        }
      }
    }
  }

  // Merge tied notes (same pitch, adjacent, tieToNext=true)
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
      note.duration = parseFloat((note.duration + notes[i].duration).toFixed(4));
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
