import type { useEffect, useRef, useState, useCallback } from 'react';
import type { Music, Loader2, MousePointer, AlertCircle } from 'lucide-react';
import type { NoteData, WordData, ChordData, MappingData } from '../xmlTypes';

interface SheetMusicProps {
  source: { type: 'gp'; buffer: ArrayBuffer } | { type: 'xml'; text: string } | null;
  notes?: NoteData[];
  words?: WordData[];
  chords?: ChordData[];
  mappings?: MappingData[];
  selectedWordId?: string | null;
  selectedNoteId?: string | null;
  editMode?: boolean;
  isVisible?: boolean;
  onSelectNote?: (noteId: string) => void;
  onLinkNoteToWord?: (wordId: string, noteId: string) => void;
}

interface NoteOverlay {
  noteId: string;
  pitch: string;
  bar: number;
  beat: number;
  wordText: string | null;
  chordName: string | null;
  isSelected: boolean;
  isLinked: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function SheetMusic({
  source,
  notes = [],
  words = [],
  chords = [],
  mappings = [],
  selectedWordId = null,
  selectedNoteId = null,
  editMode = false,
  isVisible = true,
  onSelectNote,
  onLinkNoteToWord,
}: SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRef = useRef<any>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [overlays, setOverlays] = useState<NoteOverlay[]>([]);
  const [hoverNoteId, setHoverNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setStatus('idle');
      setOverlays([]);
      return;
    }
    if (!containerRef.current) return;

    setStatus('loading');
    setErrorMsg('');
    setOverlays([]);

    let destroyed = false;

    (async () => {
      try {
        const at = await import('@coderline/alphatab');
        const { AlphaTabApi, Settings, LayoutMode, StaveProfile, LogLevel } = at;

        if (destroyed) return;

        if (apiRef.current) {
          try { apiRef.current.destroy(); } catch { /* ignore */ }
          apiRef.current = null;
        }

        const container = containerRef.current!;
        container.innerHTML = '';

        const settings = new Settings();
        settings.core.logLevel = LogLevel.None;
        settings.core.useWorkers = false;
        settings.core.fontDirectory = '/font/';
        settings.display.layoutMode = LayoutMode.Page;
        settings.display.staveProfile = StaveProfile.ScoreTab;
        settings.display.scale = 0.85;
        settings.display.barsPerRow = 4;

        const api = new AlphaTabApi(container, settings);
        apiRef.current = api;

        api.postRenderFinished.on(() => {
          if (!destroyed) setStatus('ready');
        });

        api.error.on((err: unknown) => {
          if (!destroyed) {
            setStatus('error');
            setErrorMsg((err as Error)?.message ?? String(err));
          }
        });

        if (source.type === 'gp') {
          api.load(new Uint8Array(source.buffer));
        } else {
          api.load(new TextEncoder().encode(source.text));
        }
      } catch (e) {
        if (!destroyed) {
          setStatus('error');
          setErrorMsg((e as Error).message ?? String(e));
        }
      }
    })();

    return () => {
      destroyed = true;
      if (apiRef.current) {
        try { apiRef.current.destroy(); } catch { /* ignore */ }
        apiRef.current = null;
      }
    };
  }, [source]);

  const buildOverlays = useCallback(() => {
    if (!containerRef.current || notes.length === 0) {
      setOverlays([]);
      return;
    }

    const wrap = wrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();

    // Build lookup: note id → word text
    const noteToWord = new Map<string, string>();
    for (const m of mappings) {
      const w = words.find(ww => ww.id === m.wordId);
      if (!w) continue;
      for (const nid of m.noteIds) noteToWord.set(nid, w.text);
    }

    // Build chord lookup: only show each chord once at the nearest note
    // Sort chords by time, then find the first note in that bar/beat range
    const usedChords = new Set<string>();
    // Map: noteId → chord name (only the first note that "owns" a chord)
    const noteToChord = new Map<string, string>();
    const scoreOrderNotes = [...notes].sort((a, b) =>
      a.bar !== b.bar ? a.bar - b.bar : a.beat - b.beat
    );
    for (const chord of chords) {
      if (chord.bar === 0 && chord.beat === 0) continue; // untimed
      // Find the closest note in the same bar
      const candidates = scoreOrderNotes.filter(
        n => n.bar === chord.bar && Math.abs(n.beat - chord.beat) < 1.0
      );
      if (candidates.length === 0) continue;
      candidates.sort((a, b) => Math.abs(a.beat - chord.beat) - Math.abs(b.beat - chord.beat));
      const best = candidates[0];
      if (!usedChords.has(chord.id)) {
        usedChords.add(chord.id);
        // Don't overwrite if already assigned (keep first chord per note)
        if (!noteToChord.has(best.id)) {
          noteToChord.set(best.id, chord.name);
        }
      }
    }

    const noteHeads = containerRef.current.querySelectorAll<SVGElement>('.at-note-head');
    const heads = Array.from(noteHeads);

    const newOverlays: NoteOverlay[] = [];

    heads.forEach((head, idx) => {
      const note = scoreOrderNotes[idx];
      if (!note) return;

      const rect = head.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const x = rect.left - wrapRect.left + wrap.scrollLeft;
      const y = rect.top - wrapRect.top + wrap.scrollTop;

      newOverlays.push({
        noteId: note.id,
        pitch: note.pitch,
        bar: note.bar,
        beat: note.beat,
        wordText: noteToWord.get(note.id) ?? null,
        chordName: noteToChord.get(note.id) ?? null,
        isSelected: note.id === selectedNoteId,
        isLinked: noteToWord.has(note.id),
        x,
        y,
        w: rect.width,
        h: rect.height,
      });
    });

    setOverlays(newOverlays);
  }, [notes, words, chords, mappings, selectedNoteId]);

  useEffect(() => {
    if (status === 'ready' && isVisible) {
      const t = setTimeout(buildOverlays, 200);
      return () => clearTimeout(t);
    }
  }, [status, buildOverlays, isVisible]);

  useEffect(() => {
    if (isVisible && status === 'ready') {
      const t = setTimeout(buildOverlays, 50);
      return () => clearTimeout(t);
    }
  }, [isVisible, status, buildOverlays]);

  useEffect(() => {
    setOverlays(prev =>
      prev.map(o => ({ ...o, isSelected: o.noteId === selectedNoteId }))
    );
  }, [selectedNoteId]);

  useEffect(() => {
    if (status === 'ready' && isVisible) buildOverlays();
  }, [mappings, words, chords, status, isVisible, buildOverlays]);

  function handleOverlayClick(noteId: string) {
    onSelectNote?.(noteId);
    if (editMode && selectedWordId) {
      onLinkNoteToWord?.(selectedWordId, noteId);
    }
  }

  const selectedWord = words.find(w => w.id === selectedWordId) ?? null;

  return (
    <div className="relative w-full h-full bg-white overflow-auto" ref={wrapRef}>
      {/* Mode banner */}
      {editMode && status === 'ready' && (
        <div className="sticky top-0 z-20 flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 font-medium">
          <MousePointer size={12} />
          {selectedWord
            ? <>Click a note to link <span className="font-bold mx-1">"{selectedWord.text}"</span> — or click empty area to deselect</>
            : <>Edit mode — select a word from the lyrics panel first</>
          }
        </div>
      )}

      {/* Loading overlay */}
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-green-700" />
            <span className="text-sm text-stone-500 font-medium">Rendering sheet music…</span>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
          <div className="text-center max-w-sm px-4">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-red-700 mb-1">Could not render sheet music</p>
            <p className="text-xs text-stone-400 leading-relaxed">{errorMsg}</p>
            <p className="text-xs text-stone-400 mt-2">The timeline view still works — switch to the Timeline tab.</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {status === 'idle' && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Music size={40} className="text-stone-200 mx-auto mb-3" />
            <p className="text-sm text-stone-400 font-medium">No file loaded</p>
            <p className="text-xs text-stone-300 mt-1">Import a MusicXML or Guitar Pro file to see the sheet music</p>
          </div>
        </div>
      )}

      {/* alphaTab SVG content */}
      <div ref={containerRef} className="w-full" />

      {/* ── Annotation layer — lời + hợp âm, không bị clip ── */}
      {status === 'ready' && overlays.map(o => (
        <AnnotationLayer key={o.noteId} overlay={o} />
      ))}

      {/* ── Hit area layer — click/hover, không clip annotation ── */}
      {status === 'ready' && overlays.map(o => (
        <NoteHitArea
          key={`hit-${o.noteId}`}
          overlay={o}
          isHovered={hoverNoteId === o.noteId}
          editMode={editMode}
          hasSelectedWord={!!selectedWord}
          onClick={() => handleOverlayClick(o.noteId)}
          onMouseEnter={() => setHoverNoteId(o.noteId)}
          onMouseLeave={() => setHoverNoteId(null)}
          showTooltip={hoverNoteId === o.noteId}
        />
      ))}
    </div>
  );
}

// ── Annotation layer: lời (trên nốt) và hợp âm (dưới nốt) ────────────────
function AnnotationLayer({ overlay }: { overlay: NoteOverlay }) {
  const PAD = 6;
  // Khoảng cách từ nốt lên/xuống — đủ xa để không che ký hiệu nhạc
  const WORD_OFFSET = 18;   // px phía trên nốt
  const CHORD_OFFSET = 16;  // px phía dưới nốt

  if (!overlay.wordText && !overlay.chordName) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: overlay.x + overlay.w / 2,
        top: overlay.y - PAD,
        width: 0,
        height: overlay.h + PAD * 2,
        zIndex: 5,
      }}
    >
      {/* Lời — trên nốt */}
      {overlay.wordText && (
        <div
          className="absolute"
          style={{
            bottom: overlay.h + PAD + WORD_OFFSET,
            left: 0,
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            className={[
              'inline-block px-1.5 py-[2px] rounded text-[10px] font-semibold leading-none shadow-sm',
              overlay.isSelected
                ? 'bg-amber-500 text-white'
                : 'bg-emerald-600 text-white',
            ].join(' ')}
          >
            {overlay.wordText}
          </span>
        </div>
      )}

      {/* Hợp âm — dưới nốt, màu khác biệt */}
      {overlay.chordName && (
        <div
          className="absolute"
          style={{
            top: overlay.h + PAD + CHORD_OFFSET,
            left: 0,
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="inline-block px-1.5 py-[2px] rounded text-[10px] font-bold leading-none shadow-sm bg-sky-600 text-white tracking-wide">
            {overlay.chordName}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Hit area layer: click/hover interaction ───────────────────────────────
function NoteHitArea({
  overlay,
  isHovered,
  editMode,
  hasSelectedWord,
  onClick,
  onMouseEnter,
  onMouseLeave,
  showTooltip,
}: {
  overlay: NoteOverlay;
  isHovered: boolean;
  editMode: boolean;
  hasSelectedWord: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  showTooltip: boolean;
}) {
  const PAD = 6;
  const canLink = editMode && hasSelectedWord;

  const ringColor = overlay.isSelected
    ? 'ring-2 ring-amber-400'
    : overlay.isLinked
    ? 'ring-1 ring-emerald-400'
    : isHovered && canLink
    ? 'ring-2 ring-blue-400'
    : '';

  const bgColor = overlay.isSelected
    ? 'bg-amber-400/20'
    : overlay.isLinked
    ? 'bg-emerald-400/15'
    : isHovered && canLink
    ? 'bg-blue-400/20'
    : 'bg-transparent';

  return (
    <div
      className="absolute"
      style={{
        left: overlay.x - PAD,
        top: overlay.y - PAD,
        width: overlay.w + PAD * 2,
        height: overlay.h + PAD * 2,
        zIndex: 10,
      }}
    >
      <div
        className={[
          'absolute inset-0 rounded-sm transition-all duration-100',
          ringColor,
          bgColor,
          canLink ? 'cursor-cell' : 'cursor-pointer',
        ].join(' ')}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute pointer-events-none z-30"
          style={{ top: -38, left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="bg-stone-800 text-white text-[10px] px-2 py-1 rounded-md shadow-lg whitespace-nowrap">
            <span className="font-bold">{overlay.pitch}</span>
            <span className="text-stone-400 ml-1.5">bar {overlay.bar} beat {overlay.beat}</span>
            {overlay.wordText && <span className="ml-1.5 text-emerald-400">→ {overlay.wordText}</span>}
            {overlay.chordName && <span className="ml-1.5 text-sky-400">[{overlay.chordName}]</span>}
          </div>
        </div>
      )}
    </div>
  );
}
