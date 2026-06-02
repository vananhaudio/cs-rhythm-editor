import type { NoteData, ChordData, WordData, ProjectMetadata } from '../xmlTypes';

interface ParseResult {
  notes: NoteData[];
  chords: ChordData[];
  metadata: Partial<ProjectMetadata>;
  embeddedWords: WordData[];
}

function getFirst(el: Element | Document, tag: string): Element | null {
  return el.getElementsByTagName(tag)[0] ?? null;
}

function getText(el: Element | Document, tag: string): string {
  return getFirst(el, tag)?.textContent?.trim() ?? '';
}

function getAttr(el: Element, attr: string): string {
  return el.getAttribute(attr) ?? '';
}

function pitchFromNote(noteEl: Element): string {
  const pitchEl = getFirst(noteEl, 'pitch');
  if (!pitchEl) return 'R';
  const step = getText(pitchEl, 'step') || 'C';
  const octave = getText(pitchEl, 'octave') || '4';
  const alter = getText(pitchEl, 'alter');
  const acc = alter === '1' ? '#' : alter === '-1' ? 'b' : '';
  return `${step}${acc}${octave}`;
}

// ─── Repeat / Barline structures ─────────────────────────────────────────────

interface BarlineInfo {
  repeatForward: boolean;   // ||: at start of this measure
  repeatBackward: boolean;  // :|| at end of this measure
  voltaStart: number | null; // 1 or 2 (or more) — opening bracket
  voltaEnd: boolean;        // closing bracket
}

function readBarlineInfo(measure: Element): BarlineInfo {
  const info: BarlineInfo = {
    repeatForward: false,
    repeatBackward: false,
    voltaStart: null,
    voltaEnd: false,
  };

  const barlines = measure.getElementsByTagName('barline');
  for (let i = 0; i < barlines.length; i++) {
    const bl = barlines[i];
    const loc = bl.getAttribute('location') ?? 'right';
    const repeatEl = getFirst(bl, 'repeat');
    if (repeatEl) {
      const dir = repeatEl.getAttribute('direction');
      if (dir === 'forward') info.repeatForward = true;
      if (dir === 'backward') info.repeatBackward = true;
    }
    const endingEl = getFirst(bl, 'ending');
    if (endingEl) {
      const endType = endingEl.getAttribute('type');
      const numStr = endingEl.getAttribute('number') ?? '1';
      // number can be "1" or "1, 2" etc — take the first
      const num = parseInt(numStr.split(',')[0].trim());
      if (endType === 'start') info.voltaStart = num;
      if ((endType === 'stop' || endType === 'discontinue') && loc === 'right') info.voltaEnd = true;
    }
  }

  return info;
}

// Build the ordered list of [measureIndex, pass] to play.
// pass=1 → use lyric number="1" (or un-numbered); pass=2 → use lyric number="2"
// Supports: simple repeat ||: … :||, with optional 1./2. volta brackets.
// Does NOT support nested repeats or DS/Coda (rare in pop/folk sheets).
function buildPlayOrder(
  barlines: BarlineInfo[]
): Array<{ mi: number; pass: number }> {
  const order: Array<{ mi: number; pass: number }> = [];
  const n = barlines.length;

  let i = 0;
  // Stack of repeat-start positions for nested support (we handle 1 level deep)
  let repeatStart = 0;
  let insideRepeat = false;
  let repeatDone = false; // have we already jumped back once?

  while (i < n) {
    const bl = barlines[i];

    // Mark repeat start
    if (bl.repeatForward) {
      repeatStart = i;
      insideRepeat = true;
      repeatDone = false;
    }

    const pass = 1; // default first pass

    // Volta: skip volta-1 on second pass, skip volta-2 on first pass
    // We handle this inside the backward-repeat logic below.

    order.push({ mi: i, pass });
    i++;

    if (bl.repeatBackward && insideRepeat && !repeatDone) {
      // Jump back to repeatStart for second pass
      repeatDone = true;
      // Second pass: re-emit repeatStart..i-1 with pass=2, skipping volta-1, including volta-2
      let j = repeatStart;
      while (j < i) {
        const bj = barlines[j];
        // Skip volta-1 bars on second pass
        if (bj.voltaStart === 1) {
          // advance past the entire volta-1 bracket
          while (j < i && !barlines[j].voltaEnd) j++;
          j++; // skip the closing bar of volta-1
          continue;
        }
        order.push({ mi: j, pass: 2 });
        j++;
      }
    }
  }

  return order;
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseMusicXML(xmlText: string): ParseResult {
  const parser = new DOMParser();
  let doc = parser.parseFromString(xmlText, 'application/xml');

  const parseErr = doc.querySelector('parsererror') ?? doc.getElementsByTagName('parsererror')[0];
  if (parseErr) {
    doc = parser.parseFromString(xmlText, 'text/html') as unknown as XMLDocument;
  }

  const notes: NoteData[] = [];
  const chords: ChordData[] = [];
  const embeddedWords: WordData[] = [];

  const title =
    getText(doc, 'work-title') ||
    getText(doc, 'movement-title') ||
    '';
  const partName = getText(doc, 'part-name') || '';

  let tempo = 80;
  let divisions = 1;
  let beatsPerBar = 4;
  let noteCounter = 0;
  let chordCounter = 0;
  let wordCounter = 0;

  const measures = doc.getElementsByTagName('measure');
  if (measures.length === 0) {
    return { notes: [], chords: [], embeddedWords: [], metadata: { title, artist: partName } };
  }

  // ── Pass 0: collect per-measure attributes (divisions, tempo, beatsPerBar)
  // so that when we unroll repeats we use the correct values at each measure.
  interface MeasureAttribs {
    divisions: number;
    beatsPerBar: number;
    tempo: number;
  }
  const measureAttribs: MeasureAttribs[] = [];
  {
    let d = 1, bpb = 4, t = 80;
    for (let mi = 0; mi < measures.length; mi++) {
      const m = measures[mi];
      const a = m.getElementsByTagName('attributes');
      if (a.length > 0) {
        const dv = getText(a[0], 'divisions');
        if (dv) d = parseInt(dv);
        const bt = getText(a[0], 'beats');
        if (bt) bpb = parseInt(bt);
      }
      const sv = m.getElementsByTagName('sound');
      for (let si = 0; si < sv.length; si++) {
        const ta = sv[si].getAttribute('tempo');
        if (ta) { t = parseFloat(ta); break; }
      }
      measureAttribs.push({ divisions: d, beatsPerBar: bpb, tempo: t });
    }
  }

  // ── Pass 1: detect pickup measure using measure[0] attribs
  let pickupOffsetSec = 0;
  {
    const { divisions: d0, beatsPerBar: bpb0, tempo: tempo0 } = measureAttribs[0];
    const quarterSec0 = 60 / tempo0;
    const fullBarTicks0 = bpb0 * d0;
    let actualTicks = 0;
    for (let ci = 0; ci < measures[0].children.length; ci++) {
      const child = measures[0].children[ci];
      if (child.tagName.replace(/^.*:/, '') !== 'note') continue;
      if (child.getElementsByTagName('chord').length > 0) continue;
      actualTicks += parseInt(getText(child, 'duration') || '0');
    }
    if (actualTicks > 0 && actualTicks < fullBarTicks0) {
      pickupOffsetSec = ((fullBarTicks0 - actualTicks) / d0) * quarterSec0;
    }
  }

  // ── Pass 2: read barline info per measure
  const barlineInfos: BarlineInfo[] = [];
  for (let mi = 0; mi < measures.length; mi++) {
    barlineInfos.push(readBarlineInfo(measures[mi]));
  }

  // ── Pass 3: build play order (unroll repeats)
  const playOrder = buildPlayOrder(barlineInfos);

  // ── Pass 4: emit notes/chords/words following play order
  // Compute per-measure duration (seconds) for time accumulation
  function measureDurSec(mi: number): number {
    const { beatsPerBar: bpb, tempo: t } = measureAttribs[mi];
    return bpb * (60 / t);
  }

  // For the pickup bar, the measure only contributes its actual note ticks in duration
  function pickupMeasureDurSec(): number {
    const { divisions: d0, beatsPerBar: bpb0, tempo: t0 } = measureAttribs[0];
    const quarterSec0 = 60 / t0;
    const fullBarSec = bpb0 * quarterSec0;
    // The measure "starts" at pickupOffsetSec, and ends at fullBarSec
    return fullBarSec - pickupOffsetSec;
  }

  // Build cumulative start time for each step in playOrder
  let globalTime = pickupOffsetSec;
  // We need startTime per playOrder step, so precompute them
  const stepStartTimes: number[] = [];
  {
    let t = pickupOffsetSec;
    for (let pi = 0; pi < playOrder.length; pi++) {
      stepStartTimes.push(t);
      const { mi } = playOrder[pi];
      if (mi === 0 && pickupOffsetSec > 0) {
        t += pickupMeasureDurSec();
      } else {
        t += measureDurSec(mi);
      }
    }
    globalTime = t;
  }

  // Track volta pass: on first pass emit volta-1, skip volta-2.
  // On second pass emit volta-2, skip volta-1.
  // (Already handled by buildPlayOrder — volta-1 bars are excluded from pass=2 steps)

  // Per-measure: track slur state across measures
  let openSlurId: string | null = null;

  for (let pi = 0; pi < playOrder.length; pi++) {
    const { mi, pass } = playOrder[pi];
    const measure = measures[mi];
    const measureNum = parseInt(getAttr(measure, 'number') || String(mi + 1));
    const measureStartTime = stepStartTimes[pi];

    const { divisions: divs, tempo: tmp } = measureAttribs[mi];
    divisions = divs;
    tempo = tmp;
    beatsPerBar = measureAttribs[mi].beatsPerBar;
    const quarterSec = 60 / tempo;

    let timeInMeasureTicks = 0;
    let lastNonChordTickStart = 0;

    for (let ci = 0; ci < measure.children.length; ci++) {
      const child = measure.children[ci];
      const tag = child.tagName.replace(/^.*:/, '');

      if (tag === 'harmony') {
        const root = getText(child, 'root-step');
        const alter = getText(child, 'root-alter');
        const kindEl = getFirst(child, 'kind');
        const kindText = kindEl?.getAttribute('text')?.trim() ?? '';
        const kindContent = kindEl?.textContent?.trim() ?? '';
        const acc = alter === '1' ? '#' : alter === '-1' ? 'b' : '';

        let suffix = kindText;
        if (!suffix) {
          if (kindContent.includes('minor-seventh')) suffix = 'm7';
          else if (kindContent.includes('major-seventh')) suffix = 'maj7';
          else if (kindContent.includes('minor')) suffix = 'm';
          else if (kindContent.includes('dominant')) suffix = '7';
          else if (kindContent.includes('diminished')) suffix = 'dim';
          else if (kindContent.includes('augmented')) suffix = 'aug';
          else if (kindContent.includes('suspended-fourth')) suffix = 'sus4';
          else if (kindContent.includes('suspended-second')) suffix = 'sus2';
          else suffix = '';
        }

        const chordName = `${root}${acc}${suffix}`;
        if (root.trim()) {
          const offsetTicks = parseInt(getText(child, 'offset') || '0');
          const tickStart = timeInMeasureTicks + offsetTicks;
          const beatPos = parseFloat(((tickStart / divisions) + 1).toFixed(2));
          const startTimeSec = measureStartTime + (tickStart / divisions) * quarterSec;
          chords.push({
            id: `chord_${String(++chordCounter).padStart(3, '0')}`,
            name: chordName,
            time: parseFloat(startTimeSec.toFixed(4)),
            bar: measureNum,
            beat: beatPos,
          });
        }
        continue;
      }

      if (tag !== 'note') continue;
      const noteEl = child;

      const isRest = noteEl.getElementsByTagName('rest').length > 0;
      const isChordNote = noteEl.getElementsByTagName('chord').length > 0;
      const durationTicks = parseInt(getText(noteEl, 'duration') || '0');
      const durSec = (durationTicks / divisions) * quarterSec;

      const tickStart = isChordNote ? lastNonChordTickStart : timeInMeasureTicks;
      const beatPos = parseFloat(((tickStart / divisions) + 1).toFixed(2));
      const startTimeSec = measureStartTime + (tickStart / divisions) * quarterSec;

      if (!isChordNote) {
        lastNonChordTickStart = timeInMeasureTicks;
        timeInMeasureTicks += durationTicks;
      }

      if (isRest) continue;

      // Tie detection
      const tieEls = noteEl.getElementsByTagName('tie');
      let tieToNext = false;
      for (let ti = 0; ti < tieEls.length; ti++) {
        if (tieEls[ti].getAttribute('type') === 'start') { tieToNext = true; break; }
      }

      // Slur detection — maintain open slur across measures
      const notationsEls = noteEl.getElementsByTagName('notations');
      let slurGroupId: string | null = openSlurId;
      if (notationsEls.length > 0) {
        const slurEls = notationsEls[0].getElementsByTagName('slur');
        for (let si2 = 0; si2 < slurEls.length; si2++) {
          const sType = slurEls[si2].getAttribute('type');
          if (sType === 'start') {
            // pass index included so repeat-unrolled slurs get unique IDs
            openSlurId = `slur_m${measureNum}_b${Math.floor(beatPos)}_p${pass}`;
            slurGroupId = openSlurId;
          } else if (sType === 'stop') {
            slurGroupId = openSlurId; // this note still belongs to the slur
            openSlurId = null;
          }
        }
      }

      // Lyric: pick correct verse based on repeat pass
      // MusicXML uses <lyric number="1"> for verse 1, <lyric number="2"> for verse 2
      const lyricEls = noteEl.getElementsByTagName('lyric');
      let lyricText = '';
      if (lyricEls.length > 0) {
        // Find lyric matching the current pass; fall back to any lyric
        let matched: Element | null = null;
        let fallback: Element | null = null;
        for (let li = 0; li < lyricEls.length; li++) {
          const lNum = parseInt(lyricEls[li].getAttribute('number') ?? '1');
          if (lNum === pass) { matched = lyricEls[li]; break; }
          if (!fallback) fallback = lyricEls[li];
        }
        const lyricEl = matched ?? fallback;
        if (lyricEl) lyricText = getText(lyricEl, 'text');
      }

      // On second pass, skip notes that have no lyric at all (instrumental fills)
      // but still emit the note so timing stays correct.
      const noteId = `note_${String(++noteCounter).padStart(3, '0')}`;
      notes.push({
        id: noteId,
        bar: measureNum,
        beat: beatPos,
        startTime: parseFloat(startTimeSec.toFixed(4)),
        duration: parseFloat(durSec.toFixed(4)),
        pitch: pitchFromNote(noteEl),
        velocity: 80,
        tieToNext,
        slurGroupId,
        source: 'musicxml',
      });

      if (lyricText && !isChordNote) {
        // Strip syllable hyphens/underscores used in MusicXML for melisma
        const cleanText = lyricText.replace(/[-_]$/, '');
        if (cleanText) {
          embeddedWords.push({
            id: `word_${String(++wordCounter).padStart(3, '0')}`,
            text: cleanText,
            time: parseFloat(startTimeSec.toFixed(4)),
            bar: measureNum,
            beat: beatPos,
            duration: parseFloat(durSec.toFixed(4)),
            linkedNotes: [noteId],
            isSlurGroup: !!slurGroupId,
            confidence: 1.0,
            source: 'auto',
          });
        }
      }
    }
  }

  const merged = mergeTiedNotes(notes);

  // Count unique original measures (not unrolled)
  const uniqueBars = new Set(playOrder.map(p => p.mi)).size;

  return {
    notes: merged,
    chords,
    metadata: {
      title,
      artist: partName,
      tempo,
      timeSignature: beatsPerBar,
      totalBars: uniqueBars,
    },
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
