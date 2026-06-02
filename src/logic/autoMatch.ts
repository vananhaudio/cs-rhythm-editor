import type { NoteData, WordData, MappingData } from '../xmlTypes';

/**
 * Build note "slots" for matching — one slot per word needed.
 *
 * Rules:
 * - Tied notes are already merged by the parser into a single NoteData.
 * - Slur groups: only the FIRST note in the slur counts as a timing anchor.
 *   The remaining slur notes are consumed but not assigned to extra words.
 * - Individual notes: one slot each.
 */
interface NoteSlot {
  noteIds: string[];   // first note id (+ slur tail ids for reference)
  anchorNoteId: string;
  startTime: number;
  duration: number;
  bar: number;
  beat: number;
  isSlurGroup: boolean;
}

function buildNoteSlots(notes: NoteData[]): NoteSlot[] {
  const slots: NoteSlot[] = [];
  const consumed = new Set<string>();

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (consumed.has(note.id)) continue;

    if (note.slurGroupId) {
      // Collect ALL notes in this slur group (in order)
      const slurNotes = notes.filter(n => n.slurGroupId === note.slurGroupId);
      slurNotes.forEach(n => consumed.add(n.id));

      // Only the first note is the timing anchor; rest are "slurred over"
      const first = slurNotes[0];
      slots.push({
        noteIds: slurNotes.map(n => n.id),
        anchorNoteId: first.id,
        startTime: first.startTime,
        duration: slurNotes.reduce((s, n) => s + n.duration, 0),
        bar: first.bar,
        beat: first.beat,
        isSlurGroup: true,
      });
    } else {
      consumed.add(note.id);
      slots.push({
        noteIds: [note.id],
        anchorNoteId: note.id,
        startTime: note.startTime,
        duration: note.duration,
        bar: note.bar,
        beat: note.beat,
        isSlurGroup: false,
      });
    }
  }

  return slots;
}

export interface AutoMatchResult {
  updatedWords: WordData[];
  mappings: MappingData[];
  matched: number;
  totalSlots: number;
  totalWords: number;
}

/**
 * Automatically match words to note slots sequentially.
 *
 * If the MusicXML already embedded lyrics (words already have linkedNotes),
 * those are kept as-is and only unlinked words are re-matched against
 * remaining unoccupied slots.
 */
export function autoMatch(notes: NoteData[], words: WordData[]): AutoMatchResult {
  if (notes.length === 0 || words.length === 0) {
    return { updatedWords: words, mappings: [], matched: 0, totalSlots: 0, totalWords: words.length };
  }

  const slots = buildNoteSlots(notes);
  const updatedWords = words.map(w => ({ ...w }));
  const mappings: MappingData[] = [];

  // Check if words already have embedded note links (from MusicXML parser)
  const hasEmbeddedLinks = words.some(w => w.linkedNotes.length > 0);

  if (hasEmbeddedLinks) {
    // Trust embedded links but fix slur groups:
    // For each word linked to a slur group, ensure only the first note's timing is used
    const occupiedSlotsByNote = new Set<string>();

    for (const word of updatedWords) {
      if (word.linkedNotes.length === 0) continue;

      // Find the slot this word belongs to
      const slot = slots.find(s => s.noteIds.some(id => word.linkedNotes.includes(id)));
      if (!slot) continue;

      // Fix timing to use anchor note (first note of slur group)
      const anchorNote = notes.find(n => n.id === slot.anchorNoteId);
      if (anchorNote) {
        word.time = anchorNote.startTime;
        word.bar = anchorNote.bar;
        word.beat = anchorNote.beat;
        word.duration = slot.duration;
        word.isSlurGroup = slot.isSlurGroup;
        // Only link the anchor note (not entire slur tail) for timing purposes
        word.linkedNotes = [slot.anchorNoteId];
      }

      slot.noteIds.forEach(id => occupiedSlotsByNote.add(id));

      mappings.push({
        wordId: word.id,
        noteIds: [slot.anchorNoteId],
        method: slot.isSlurGroup ? 'slur-detected' : 'auto',
        confidence: slot.isSlurGroup ? 0.88 : 0.95,
      });
    }

    // Match remaining unlinked words to unoccupied slots sequentially
    const freeSlots = slots.filter(s => !occupiedSlotsByNote.has(s.anchorNoteId));
    const unmatchedWords = updatedWords.filter(w => w.linkedNotes.length === 0);
    const count = Math.min(freeSlots.length, unmatchedWords.length);

    for (let i = 0; i < count; i++) {
      const slot = freeSlots[i];
      const word = unmatchedWords[i];
      const anchorNote = notes.find(n => n.id === slot.anchorNoteId)!;

      word.time = anchorNote.startTime;
      word.bar = anchorNote.bar;
      word.beat = anchorNote.beat;
      word.duration = slot.duration;
      word.linkedNotes = [slot.anchorNoteId];
      word.isSlurGroup = slot.isSlurGroup;
      word.confidence = 0.70;
      word.source = 'auto';

      mappings.push({
        wordId: word.id,
        noteIds: [slot.anchorNoteId],
        method: 'auto',
        confidence: 0.70,
      });
    }

    return {
      updatedWords,
      mappings,
      matched: mappings.length,
      totalSlots: slots.length,
      totalWords: words.length,
    };
  }

  // No embedded links — pure sequential matching
  const matchCount = Math.min(slots.length, updatedWords.length);
  const confidence = slots.length === updatedWords.length ? 0.92 : 0.70;

  for (let i = 0; i < matchCount; i++) {
    const slot = slots[i];
    const word = updatedWords[i];
    const anchorNote = notes.find(n => n.id === slot.anchorNoteId)!;

    word.time = parseFloat(anchorNote.startTime.toFixed(4));
    word.bar = anchorNote.bar;
    word.beat = anchorNote.beat;
    word.duration = parseFloat(slot.duration.toFixed(4));
    word.linkedNotes = [slot.anchorNoteId];
    word.isSlurGroup = slot.isSlurGroup;
    word.confidence = slot.isSlurGroup ? 0.85 : confidence;
    word.source = 'auto';

    mappings.push({
      wordId: word.id,
      noteIds: [slot.anchorNoteId],
      method: slot.isSlurGroup ? 'slur-detected' : 'auto',
      confidence: word.confidence,
    });
  }

  return {
    updatedWords,
    mappings,
    matched: matchCount,
    totalSlots: slots.length,
    totalWords: words.length,
  };
}

export function analyzeMatchIssues(notes: NoteData[], words: WordData[]): string[] {
  const issues: string[] = [];
  const slots = buildNoteSlots(notes);

  if (slots.length > words.length) {
    issues.push(`${slots.length - words.length} note slot(s) have no matching word — consider adding more words.`);
  } else if (words.length > slots.length) {
    issues.push(`${words.length - slots.length} word(s) have no matching note slot — consider removing extra words.`);
  }

  const slurCount = slots.filter(s => s.isSlurGroup).length;
  if (slurCount > 0) {
    issues.push(`${slurCount} slur group(s) detected — each mapped to the first note of the group.`);
  }

  return issues;
}
