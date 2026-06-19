import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { Theme } from '../GuitarBoard';
import { SCORE_BPM, SCORE_BEATS_PER_MEASURE } from '../scoreData';
import type { ScoreNote } from '../scoreData';
import { getNoteForFret } from '../guitarNotes';
import { playGuitarNote } from '../audioEngine';
import { notesToAlphaTex } from './notesToAlphaTex';
import { importScoreFile } from './scoreImporter';

// ─── Trường độ ─────────────────────────────────────────────────────────────────
const DURATIONS = [4, 2, 1, 0.5, 0.25];        // beats: Tròn → Móc đôi
const spb = (bpm = SCORE_BPM) => 60 / bpm;
const beatsToSec = (b: number, bpm = SCORE_BPM) => b * spb(bpm);
const tripletDur = (b: number, bpm = SCORE_BPM) => beatsToSec(b * 2 / 3, bpm);

interface DurClass { base: number; dotted: boolean; triplet: boolean }
function classifyBeats(beats: number): DurClass {
  for (const base of DURATIONS) {
    if (Math.abs(beats - base)        < 0.01) return { base, dotted: false, triplet: false };
    if (Math.abs(beats - base * 1.5)  < 0.01) return { base, dotted: true,  triplet: false };
    if (Math.abs(beats - base * 2 / 3) < 0.02) return { base, dotted: false, triplet: true };
  }
  let best = 1, bd = Infinity;
  for (const base of DURATIONS) { const d = Math.abs(beats - base); if (d < bd) { bd = d; best = base; } }
  return { base: best, dotted: false, triplet: false };
}
function composeBeats(c: DurClass): number {
  let b = c.base;
  if (c.dotted) b *= 1.5;
  else if (c.triplet) b *= 2 / 3;
  return b;
}
function reflowTimes(notes: ScoreNote[], bpm = SCORE_BPM): ScoreNote[] {
  const sec = spb(bpm);
  let t = notes.length ? notes[0].time : 0;
  return notes.map(n => {
    const out: ScoreNote = {
      ...n, time: t,
      measure: Math.floor(t / (sec * SCORE_BEATS_PER_MEASURE)) + 1,
      beat: ((t / sec) % SCORE_BEATS_PER_MEASURE) + 1,
    };
    t += n.duration;
    return out;
  });
}

// note-index → beat-index (các nốt cùng time là 1 beat trong boundsLookup)
function buildNoteToBeat(notes: ScoreNote[]): number[] {
  const map: number[] = [];
  let bi = -1, prevT = -Infinity;
  for (const n of notes) {
    if (n.time > prevT + 1e-6) { bi++; prevT = n.time; }
    map.push(bi);
  }
  return map;
}

interface Props {
  theme: Theme;
  currentTime: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  activeNoteIds: Set<string>;
  notes: ScoreNote[];
  totalDuration: number;
  onNotesChange: (notes: ScoreNote[]) => void;
  onRequestNoteInput?: (cb: (str: number, fret: number) => void) => void;
}

interface Box { x: number; y: number; w: number; h: number }

export default function ScoreTabViewerAlpha({
  theme, currentTime, isPlaying, onPlay, onPause, onStop,
  activeNoteIds, notes, onNotesChange, onRequestNoteInput,
}: Props) {
  const isDark = theme === 'dark';

  const [cursorIdx, setCursorIdx] = useState(notes.length);
  const [selIdx, setSelIdx]       = useState<number | null>(null);
  const [durBeats, setDurBeats]   = useState(1);
  const [dotted, setDotted]       = useState(false);
  const [triplet, setTriplet]     = useState(false);
  const [fretBuf, setFretBuf]     = useState('');
  const [pendingStr, setPendingStr] = useState(3);
  const [focused, setFocused]     = useState(false);
  const [bpm, setBpm]             = useState(80);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const focusRef     = useRef<HTMLDivElement>(null);
  const wrapRef      = useRef<HTMLDivElement>(null);
  const alphaRef     = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRef       = useRef<any>(null);
  const commitNoteRef = useRef<(str: number, fret: number) => void>(() => {});
  const pendingStrRef = useRef(3);
  const moRef = useRef<MutationObserver | null>(null);

  const [renderTick, setRenderTick] = useState(0);   // tăng mỗi lần AlphaTab vẽ xong
  const [ready, setReady] = useState(false);

  // ── alphaTex từ notes ──────────────────────────────────────────────────────
  const tex = useMemo(() => notesToAlphaTex(notes, bpm), [notes, bpm]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const cursorTime = useMemo(() => {
    if (selIdx !== null && selIdx < notes.length) return notes[selIdx].time;
    if (cursorIdx <= 0 || notes.length === 0) return 0;
    const i = Math.min(cursorIdx - 1, notes.length - 1);
    return notes[i].time + notes[i].duration;
  }, [notes, cursorIdx, selIdx]);

  const effectiveDur = useMemo(() => {
    const base = dotted ? durBeats * 1.5 : durBeats;
    return triplet ? tripletDur(durBeats) : beatsToSec(base);
  }, [durBeats, dotted, triplet]);

  // ── Commit note ─────────────────────────────────────────────────────────────
  const commitNote = useCallback((str: number, fret: number) => {
    const nf = getNoteForFret(str, fret, 'sharp');
    playGuitarNote(nf.frequency, str);

    if (selIdx !== null && selIdx < notes.length) {
      // CHORD MODE: thêm/ghi đè nốt trong beat đang chọn
      const beatTime = notes[selIdx].time;
      const beatDur  = notes[selIdx].duration;
      const existOnStr = notes.findIndex(n => Math.abs(n.time - beatTime) < 1e-6 && n.string === str);
      const newNote: ScoreNote = {
        id: `n${Date.now()}-${Math.random().toString(36).slice(2)}`,
        time: beatTime, duration: beatDur, string: str, fret,
        pitch: nf.noteName, octave: nf.octave,
        measure: notes[selIdx].measure, beat: notes[selIdx].beat,
      };
      if (existOnStr >= 0) {
        // Ghi đè nốt đã có trên cùng dây
        onNotesChange(notes.map((n, i) => i === existOnStr ? newNote : n));
      } else {
        // Thêm nốt mới vào hợp âm — KHÔNG reflowTimes (chord note phải giữ cùng time với beat)
        let last = selIdx;
        for (let i = selIdx + 1; i < notes.length; i++) {
          if (Math.abs(notes[i].time - beatTime) < 1e-6) last = i; else break;
        }
        onNotesChange([...notes.slice(0, last + 1), newNote, ...notes.slice(last + 1)]);
      }
      setFretBuf('');
      // Giữ nguyên selIdx — ở lại beat để có thể thêm nốt tiếp
      return;
    }

    if (cursorIdx < notes.length) {
      // GHI ĐÈ nốt tại con trỏ — đổi dây/fret, giữ nguyên trường độ & thời điểm
      onNotesChange(notes.map((n, i) => i === cursorIdx
        ? { ...n, string: str, fret, pitch: nf.noteName, octave: nf.octave }
        : n));
      setSelIdx(cursorIdx);
      setFretBuf('');
      return;
    }

    // THÊM nốt mới ở cuối bài
    const t = cursorTime, sec = spb(bpm);
    const newNote: ScoreNote = {
      id: `n${Date.now()}-${Math.random().toString(36).slice(2)}`,
      time: t, duration: effectiveDur, string: str, fret,
      pitch: nf.noteName, octave: nf.octave,
      measure: Math.floor(t / (sec * SCORE_BEATS_PER_MEASURE)) + 1,
      beat: ((t / sec) % SCORE_BEATS_PER_MEASURE) + 1,
    };
    onNotesChange(reflowTimes([...notes, newNote]));
    setCursorIdx(cursorIdx + 1);
    setSelIdx(cursorIdx);
    setFretBuf('');
  }, [selIdx, notes, cursorIdx, cursorTime, effectiveDur, onNotesChange]);

  useEffect(() => { commitNoteRef.current = commitNote; }, [commitNote]);
  useEffect(() => { pendingStrRef.current = pendingStr; }, [pendingStr]);
  useEffect(() => { onRequestNoteInput?.((str, fret) => commitNote(str, fret)); }, [onRequestNoteInput, commitNote]);

  // Carry-forward: bút lấy trường độ nốt đang chọn
  useEffect(() => {
    if (selIdx !== null && selIdx < notes.length && notes[selIdx].string >= 0) {
      const cls = classifyBeats(notes[selIdx].duration / spb(bpm));
      setDurBeats(cls.base); setDotted(cls.dotted); setTriplet(cls.triplet);
    }
  }, [selIdx, notes]);

  // ── Hành động dùng chung ──────────────────────────────────────────────────────
  const insertRest = useCallback(() => {
    const t = cursorTime, sec = spb(bpm);
    const rest: ScoreNote = {
      id: `r${Date.now()}-${Math.random().toString(36).slice(2)}`,
      time: t, duration: effectiveDur, string: -1, fret: -1, pitch: 'R', octave: 0,
      measure: Math.floor(t / (sec * SCORE_BEATS_PER_MEASURE)) + 1,
      beat: ((t / sec) % SCORE_BEATS_PER_MEASURE) + 1,
    };
    onNotesChange(reflowTimes([...notes.slice(0, cursorIdx), rest, ...notes.slice(cursorIdx)]));
    setCursorIdx(cursorIdx + 1);
    setSelIdx(cursorIdx);
  }, [cursorTime, effectiveDur, notes, cursorIdx, onNotesChange]);

  const setSelDuration = useCallback((beats: number) => {
    onNotesChange(reflowTimes(notes.map((n, i) => i === selIdx ? { ...n, duration: beatsToSec(beats) } : n)));
  }, [selIdx, notes, onNotesChange]);

  const stepDuration = useCallback((shorter: boolean) => {
    const delta = shorter ? 1 : -1;
    if (selIdx !== null && selIdx < notes.length) {
      const cls = classifyBeats(notes[selIdx].duration / spb(bpm));
      const idx = DURATIONS.indexOf(cls.base);
      const ni = Math.min(DURATIONS.length - 1, Math.max(0, idx + delta));
      setSelDuration(composeBeats({ ...cls, base: DURATIONS[ni] }));
    } else {
      const idx = DURATIONS.indexOf(durBeats);
      const ni = Math.min(DURATIONS.length - 1, Math.max(0, idx + delta));
      setDurBeats(DURATIONS[ni]);
    }
  }, [selIdx, notes, durBeats, setSelDuration]);

  const toggleDot = useCallback(() => {
    if (selIdx !== null && selIdx < notes.length) {
      const cls = classifyBeats(notes[selIdx].duration / spb(bpm));
      setSelDuration(composeBeats({ ...cls, dotted: !cls.dotted, triplet: false }));
    } else { setDotted(v => !v); setTriplet(false); }
  }, [selIdx, notes, setSelDuration]);

  const toggleTrip = useCallback(() => {
    if (selIdx !== null && selIdx < notes.length) {
      const cls = classifyBeats(notes[selIdx].duration / spb(bpm));
      setSelDuration(composeBeats({ ...cls, triplet: !cls.triplet, dotted: false }));
    } else { setTriplet(v => !v); setDotted(false); }
  }, [selIdx, notes, setSelDuration]);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    setFocused(true);
    const k = e.key;
    if (k === '+' || k === '=') { e.preventDefault(); stepDuration(true);  return; }
    if (k === '-' || k === '_') { e.preventDefault(); stepDuration(false); return; }
    if (k === '.') { e.preventDefault(); toggleDot();  return; }
    if (k === '/') { e.preventDefault(); toggleTrip(); return; }

    if (k === 'ArrowLeft') {
      e.preventDefault(); setFretBuf('');
      // Nhảy về BEAT trước (bỏ qua các nốt chord cùng thời điểm)
      const fromIdx = selIdx !== null ? selIdx : cursorIdx - 1;
      if (fromIdx <= 0) { setCursorIdx(0); setSelIdx(notes.length > 0 ? 0 : null); return; }
      const curTime = fromIdx < notes.length ? notes[fromIdx].time : Infinity;
      // Tìm nốt đầu tiên của beat ngay trước
      let prevStart = fromIdx - 1;
      while (prevStart > 0 && Math.abs(notes[prevStart].time - curTime) < 1e-6) prevStart--;
      // Nếu vẫn cùng thời điểm thì ở lại đó
      const prevTime = notes[prevStart].time;
      let beatStart = prevStart;
      while (beatStart > 0 && Math.abs(notes[beatStart - 1].time - prevTime) < 1e-6) beatStart--;
      setCursorIdx(beatStart + 1);
      setSelIdx(beatStart);
      const s = notes[beatStart].string;
      if (s >= 0) { setPendingStr(s); pendingStrRef.current = s; }
      return;
    }
    if (k === 'ArrowRight') {
      e.preventDefault(); setFretBuf('');
      const fromIdx = selIdx !== null ? selIdx : cursorIdx;
      if (fromIdx < notes.length) {
        // Nhảy đến BEAT tiếp theo (bỏ qua các nốt chord cùng thời điểm)
        const curTime = notes[fromIdx].time;
        let nextIdx = fromIdx + 1;
        while (nextIdx < notes.length && Math.abs(notes[nextIdx].time - curTime) < 1e-6) nextIdx++;
        if (nextIdx < notes.length) {
          setCursorIdx(nextIdx + 1);
          setSelIdx(nextIdx);
          const s = notes[nextIdx].string;
          if (s >= 0) { setPendingStr(s); pendingStrRef.current = s; }
        } else {
          // Cuối bài → chuyển sang input cursor
          setCursorIdx(notes.length); setSelIdx(null);
        }
      } else {
        // Cuối bài → chèn dấu lặng theo trường độ bút
        const t = cursorTime, sec = spb(bpm);
        const rest: ScoreNote = {
          id: `r${Date.now()}-${Math.random().toString(36).slice(2)}`,
          time: t, duration: effectiveDur, string: -1, fret: -1, pitch: 'R', octave: 0,
          measure: Math.floor(t / (sec * SCORE_BEATS_PER_MEASURE)) + 1,
          beat: ((t / sec) % SCORE_BEATS_PER_MEASURE) + 1,
        };
        onNotesChange(reflowTimes([...notes, rest]));
        setCursorIdx(cursorIdx + 1);
        setSelIdx(null);
      }
      return;
    }
    // ArrowUp/Down: chỉ đổi dây, KHÔNG thoát chế độ chọn beat (để nhập hợp âm)
    if (k === 'ArrowUp')    { e.preventDefault(); setPendingStr(s => { const ns = Math.min(5, s + 1); pendingStrRef.current = ns; return ns; }); return; }
    if (k === 'ArrowDown')  { e.preventDefault(); setPendingStr(s => { const ns = Math.max(0, s - 1); pendingStrRef.current = ns; return ns; }); return; }

    if (k === 'Backspace' || k === 'Delete') {
      e.preventDefault();
      if (fretBuf) { setFretBuf(b => b.slice(0, -1)); return; }
      const di = k === 'Delete' ? (selIdx ?? cursorIdx - 1) : cursorIdx - 1;
      if (di < 0 || di >= notes.length) return;
      onNotesChange(reflowTimes(notes.filter((_, i) => i !== di)));
      setCursorIdx(Math.max(0, di)); setSelIdx(null);
      return;
    }

    if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      if (fretBuf === '') {
        if (k === '0') setFretBuf('0');
        else { commitNoteRef.current(pendingStrRef.current, parseInt(k, 10)); setFretBuf(''); }
      } else if (fretBuf === '0') {
        setFretBuf('0' + k);
      } else if (fretBuf.length === 2 && fretBuf[0] === '0') {
        const fret = parseInt(fretBuf[1] + k, 10);
        if (fret <= 24) commitNoteRef.current(pendingStrRef.current, fret);
        setFretBuf('');
      }
      return;
    }

    if (k === 'Enter') {
      e.preventDefault();
      if (fretBuf !== '') { commitNoteRef.current(pendingStrRef.current, parseInt(fretBuf, 10)); setFretBuf(''); }
      return;
    }
    if (k === 'r' || k === 'R') { e.preventDefault(); insertRest(); return; }
    if (k === ' ') { e.preventDefault(); isPlaying ? onPause() : onPlay(); return; }
    if (e.shiftKey && /^[1-6]$/.test(k)) {
      e.preventDefault();
      const ns = 6 - parseInt(k, 10);
      setPendingStr(ns); pendingStrRef.current = ns;
      return;
    }
  }, [notes, cursorIdx, fretBuf, selIdx, isPlaying, onPlay, onPause, onNotesChange, stepDuration, toggleDot, toggleTrip, insertRest, cursorTime, effectiveDur]);

  // ── AlphaTab init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let destroyed = false;
    (async () => {
      const at = await import('@coderline/alphatab');
      const { AlphaTabApi, Settings, LayoutMode, StaveProfile, LogLevel, NotationElement } = at;
      if (destroyed || !alphaRef.current) return;

      const settings = new Settings();
      settings.core.logLevel = LogLevel.None;
      settings.core.useWorkers = false;
      settings.core.fontDirectory = '/font/';
      settings.core.includeNoteBounds = true;   // cần để có noteHeadBounds (box quanh đầu nốt/số)
      settings.display.layoutMode = LayoutMode.Horizontal;
      settings.display.staveProfile = StaveProfile.ScoreTab;
      settings.display.scale = 1.0;
      // Ẩn các text thừa cho gọn (giữ khuông + TAB)
      const hide = [
        NotationElement.ScoreTitle, NotationElement.ScoreSubTitle, NotationElement.ScoreArtist,
        NotationElement.ScoreAlbum, NotationElement.ScoreWords, NotationElement.ScoreMusic,
        NotationElement.ScoreWordsAndMusic, NotationElement.ScoreCopyright,
        NotationElement.GuitarTuning, NotationElement.TrackNames, NotationElement.EffectDynamics,
      ];
      for (const el of hide) if (el !== undefined) settings.notation.elements.set(el, false);

      const api = new AlphaTabApi(alphaRef.current, settings);
      apiRef.current = api;

      // Ẩn dòng attribution "rendered by alphaTab" — MutationObserver bắt mọi lúc nó xuất hiện
      const hideAttribution = () => {
        alphaRef.current?.querySelectorAll<SVGTextElement>('text').forEach(t => {
          if (t.textContent && t.textContent.includes('alphaTab')) t.style.display = 'none';
        });
      };
      const mo = new MutationObserver(hideAttribution);
      mo.observe(alphaRef.current, { childList: true, subtree: true });
      moRef.current = mo;

      api.postRenderFinished.on(() => {
        if (destroyed) return;
        hideAttribution();
        setReady(true);
        setRenderTick(t => t + 1);
      });
      api.tex(tex);
    })();
    return () => { destroyed = true; moRef.current?.disconnect(); try { apiRef.current?.destroy(); } catch { /* */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render khi notes đổi
  useEffect(() => { if (apiRef.current) { try { apiRef.current.tex(tex); } catch { /* */ } } }, [tex]);

  // ── Overlay: con trỏ + highlight ──────────────────────────────────────────────
  const [selHeads, setSelHeads]     = useState<Box[]>([]);
  const [cursorCell, setCursorCell] = useState<Box | null>(null);            // ô vuông trên dây đang nhập
  const [cursorCol, setCursorCol]   = useState<{ x: number; y: number; h: number } | null>(null); // vạch dọc cột
  const [activeBoxes, setActiveBoxes] = useState<Box[]>([]);
  const [invalidBars, setInvalidBars] = useState<Box[]>([]);                  // ô nhịp sai tổng phách

  // Gom bounds: beats (col cao toàn phần, heads tất cả đầu nốt, headTab = box số fret ở TAB)
  //            + visualBounds 2 khuông (score, tab).
  const collect = useCallback((): { beats: { col: Box; onNotesX: number | null; heads: Box[]; headTab: Box | null }[]; score: Box | null; tab: Box | null; masterBars: { index: number; box: Box }[] } => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bl = (apiRef.current as any)?.renderer?.boundsLookup;
    if (!bl) return { beats: [], score: null, tab: null, masterBars: [] };
    const beats: { col: Box; onNotesX: number | null; heads: Box[]; headTab: Box | null }[] = [];
    const masterBars: { index: number; box: Box }[] = [];
    let score: Box | null = null, tab: Box | null = null;
    for (const sys of bl.staffSystems) {
      for (const mb of sys.bars) {                 // mỗi master bar
        const rb0 = mb.realBounds;
        masterBars.push({ index: mb.index, box: { x: rb0.x, y: rb0.y, w: rb0.w, h: rb0.h } });
        const staves = mb.bars;                    // [khuông, TAB]
        if (!score && staves[0]) { const v = staves[0].visualBounds; score = { x: v.x, y: v.y, w: v.w, h: v.h }; }
        if (!tab && staves[1])   { const v = staves[1].visualBounds; tab   = { x: v.x, y: v.y, w: v.w, h: v.h }; }
        const n = staves[0]?.beats?.length ?? 0;
        for (let j = 0; j < n; j++) {
          let x = Infinity, y = Infinity, r = -Infinity, b = -Infinity;
          let onNotesX: number | null = null;
          const heads: Box[] = [];
          let headTab: Box | null = null;
          staves.forEach((st: { beats: Record<number, { realBounds: Box; onNotesX?: number; notes?: { noteHeadBounds: Box }[] }> }, si: number) => {
            const bb = st.beats[j]; if (!bb) return;
            const rb = bb.realBounds;
            x = Math.min(x, rb.x); y = Math.min(y, rb.y);
            r = Math.max(r, rb.x + rb.w); b = Math.max(b, rb.y + rb.h);
            // onNotesX từ staff khuông (si=0) = X thật của dấu lặng/nốt
            if (si === 0 && onNotesX === null && bb.onNotesX != null) onNotesX = bb.onNotesX;
            if (bb.notes) for (const nb of bb.notes) {
              const hb = nb.noteHeadBounds;
              if (hb && hb.w > 0) {
                heads.push({ x: hb.x, y: hb.y, w: hb.w, h: hb.h });
                if (si === 1 && !headTab) headTab = { x: hb.x, y: hb.y, w: hb.w, h: hb.h };  // TAB = số fret
              }
            }
          });
          if (x !== Infinity) beats.push({ col: { x, y, w: r - x, h: b - y }, onNotesX, heads, headTab });
        }
      }
    }
    return { beats, score, tab, masterBars };
  }, []);

  const recomputeOverlays = useCallback(() => {
    const { beats, score, tab, masterBars } = collect();

    // Ô nhịp sai luật: tổng phách trong ô ≠ số phách của nhịp (4/4 → 4 phách) → báo đỏ
    const barDur = spb(bpm) * SCORE_BEATS_PER_MEASURE;
    const sums = new Map<number, number>();
    for (const n of notes) {
      const m = Math.floor((n.time + 1e-6) / barDur);
      sums.set(m, (sums.get(m) ?? 0) + n.duration / spb(bpm));
    }
    const maxM = sums.size ? Math.max(...sums.keys()) : -1;   // ô cuối có nội dung
    const inv: Box[] = [];
    for (const mb of masterBars) {
      const s = sums.get(mb.index);
      if (s === undefined) continue;
      const over = s > SCORE_BEATS_PER_MEASURE + 0.01;                       // tràn phách → đỏ
      const underFinalized = s < SCORE_BEATS_PER_MEASURE - 0.01 && mb.index < maxM;  // thiếu nhưng đã chốt (không phải ô cuối)
      if (over || underFinalized) inv.push(mb.box);
    }
    setInvalidBars(inv);

    // notes[] có thể có nhiều nốt cùng time (chord) → cần ánh xạ note-index → beat-index
    const noteToBeat = buildNoteToBeat(notes);

    const selBeatIdx = selIdx !== null && selIdx < notes.length ? noteToBeat[selIdx] : null;
    if (selBeatIdx !== null && selBeatIdx < beats.length) {
      const beat = beats[selBeatIdx];
      const note = notes[selIdx!];
      if (note && note.string >= 0) {
        // Nốt có sẵn → ô vuông quanh đầu nốt + số fret
        setSelHeads(beat.heads.length ? beat.heads : [beat.col]);
      } else {
        // Dấu lặng → ô vuông nhỏ quanh dấu lặng (dùng onNotesX để khớp vị trí thật)
        const restCx = beat.onNotesX ?? (beat.col.x + beat.col.w / 2);
        const boxes: Box[] = [];
        if (score) boxes.push({ x: restCx - 9, y: score.y - 2, w: 18, h: score.h + 4 });
        if (tab) {
          const gap = tab.h / 5;
          const lineY = tab.y + (5 - pendingStr) * gap;
          boxes.push({ x: restCx - 9, y: lineY - (gap + 3) / 2, w: 18, h: gap + 3 });
        }
        setSelHeads(boxes);
      }
      // Chord mode: thêm cursorCell trên dây pendingStr để chỉ vị trí nốt sẽ thêm
      if (focused && tab) {
        const gap = tab.h / 5;
        const lineY = tab.y + (5 - pendingStr) * gap;
        const cx = beat.onNotesX ?? (beat.col.x + beat.col.w / 2);
        const cellW = 18, cellH = gap + 3;
        setCursorCell({ x: cx - cellW / 2, y: lineY - cellH / 2, w: cellW, h: cellH });
      } else { setCursorCell(null); }
      setCursorCol(null);
    } else {
      setSelHeads([]);
      // Con trỏ nhập: ô vuông trên dây pendingStr tại cột hiện tại + vạch dọc
      if (focused && tab) {
        const gap = tab.h / 5;
        const lineY = tab.y + (5 - pendingStr) * gap;          // dây ta s → dòng (5-s) từ trên
        // Trục X thuần dữ liệu: lùi về → khớp X số fret của nốt; tiến qua cuối → X nốt cuối + bề rộng trường độ
        let colX: number;
        if (beats.length === 0) {
          colX = tab.x + 30;
        } else if (cursorIdx >= beats.length) {
          const c = beats[beats.length - 1];
          const baseX = c.headTab ? c.headTab.x + c.headTab.w / 2 : c.col.x;
          colX = baseX + c.col.w;                              // + bề rộng trường độ (col.w renderer cấp theo trường độ)
        } else {
          const c = beats[cursorIdx];
          colX = c.headTab ? c.headTab.x + c.headTab.w / 2 : c.col.x + c.col.w / 2;  // khớp đúng số fret
        }
        const cellW = 18, cellH = gap + 3;
        setCursorCell({ x: colX - cellW / 2, y: lineY - cellH / 2, w: cellW, h: cellH });
        const top = score ? score.y : tab.y - 60;
        const bottom = tab.y + tab.h;
        setCursorCol({ x: colX, y: top - 4, h: bottom - top + 8 });
      } else { setCursorCell(null); setCursorCol(null); }
    }

  }, [notes, selIdx, cursorIdx, pendingStr, focused, collect]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(recomputeOverlays, 20);
    return () => clearTimeout(t);
  }, [ready, renderTick, recomputeOverlays]);

  // Playback highlight (ô vuông quanh đầu nốt đang vang) — effect RIÊNG, chạy NGAY
  // mỗi frame, KHÔNG debounce. Nếu để chung recomputeOverlays thì setTimeout 20ms
  // bị raf (~16ms) huỷ liên tục → highlight đứng yên khi play.
  useEffect(() => {
    if (!ready) return;
    const { beats } = collect();
    const noteToBeat = buildNoteToBeat(notes);
    const ab: Box[] = [];
    notes.forEach((n, i) => {
      if (activeNoteIds.has(n.id)) {
        const bIdx = noteToBeat[i];
        if (bIdx < beats.length) {
          const { col, heads } = beats[bIdx];
          if (heads.length) ab.push(...heads); else ab.push(col);
        }
      }
    });
    setActiveBoxes(ab);
  }, [activeNoteIds, ready, notes, collect]);

  // Auto-scroll tới nốt đang phát
  useEffect(() => {
    if (!isPlaying || activeBoxes.length === 0) return;
    const wrap = wrapRef.current; if (!wrap) return;
    const b = activeBoxes[0];
    if (b.x > wrap.scrollLeft + wrap.clientWidth - 120) wrap.scrollLeft = b.x - 120;
    if (b.x < wrap.scrollLeft) wrap.scrollLeft = Math.max(0, b.x - 40);
  }, [activeBoxes, isPlaying]);

  // ── Import file GP / MusicXML ──────────────────────────────────────────────────
  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const result = await importScoreFile(file);
      setBpm(result.bpm);
      onNotesChange(result.notes);
      setCursorIdx(result.notes.length);
      setSelIdx(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Import lỗi:', msg, err);
      alert('Lỗi: ' + msg);
    } finally {
      setImporting(false);
    }
  }, [onNotesChange]);

  // ── Click chọn nốt ─────────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent) => {
    focusRef.current?.focus();
    setFocused(true);
    const wrap = wrapRef.current; if (!wrap) return;
    const { beats } = collect();
    if (beats.length === 0) return;
    const wr = wrap.getBoundingClientRect();
    const px = e.clientX - wr.left + wrap.scrollLeft;   // toạ độ nội dung
    let best = -1, bd = Infinity;
    beats.forEach((bi, i) => { const b = bi.col; const cx = b.x + b.w / 2; const d = Math.abs(px - cx); if (d < bd) { bd = d; best = i; } });
    if (best >= 0 && bd < 70 && notes[best] && notes[best].string >= 0) {
      setSelIdx(best); setCursorIdx(best);
    }
  }, [notes, collect]);

  // ── Styles ───────────────────────────────────────────────────────────────────
  const border = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)';
  const muted  = isDark ? 'rgba(255,255,255,0.4)'  : 'rgba(0,0,0,0.4)';

  const durLabel = ({ 4: 'Tròn', 2: 'Trắng', 1: 'Đen', 0.5: 'Móc đơn', 0.25: 'Móc đôi' } as Record<number, string>)[durBeats];
  const strLabel = ['Mi (6)', 'La (5)', 'Rê (4)', 'Sol (3)', 'Si (2)', 'Mi (1)'][pendingStr];

  return (
    <div
      ref={focusRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setFretBuf(''); }}
      style={{ outline: 'none', border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', background: '#fff' }}
    >
      {/* Thanh trạng thái + nút import */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '6px 12px', fontSize: 13, color: muted, borderBottom: `1px solid ${border}`, flexWrap: 'wrap' }}>
        <span>Trường độ: <b style={{ color: '#8a6500' }}>{durLabel}</b></span>
        <span>Dây: <b style={{ color: '#14532D' }}>{strLabel}</b></span>
        <span>BPM: <b style={{ color: '#555' }}>{bpm}</b></span>
        {dotted && <span style={{ color: '#8a6500' }}>• chấm dôi</span>}
        {triplet && <span style={{ color: '#8a6500' }}>• liên 3</span>}
        {fretBuf && <span style={{ color: '#1e64dc' }}>fret: {fretBuf}_</span>}
        <div style={{ marginLeft: 'auto' }}>
          <input ref={fileInputRef} type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml" style={{ display: 'none' }} onChange={handleImportFile} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            style={{ padding: '3px 10px', borderRadius: 8, border: `1px solid ${border}`, background: 'none', cursor: 'pointer', fontSize: 12, color: muted, opacity: importing ? 0.5 : 1 }}
          >
            {importing ? '⏳ Đang nạp…' : '📂 Nạp file'}
          </button>
        </div>
      </div>

      <div ref={wrapRef} onClick={handleClick}
        style={{ position: 'relative', overflowX: 'auto', overflowY: 'hidden', background: '#faf9f5', cursor: 'pointer', minHeight: 200 }}>
        <div ref={alphaRef} />

        {/* Ô nhịp sai luật (tổng phách ≠ nhịp) — nền đỏ nhạt + viền đỏ */}
        {invalidBars.map((b, i) => (
          <div key={`inv-${i}`} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, background: 'rgba(220,38,38,0.10)', borderLeft: '2px solid rgba(220,38,38,0.6)', borderRight: '2px solid rgba(220,38,38,0.6)', pointerEvents: 'none', zIndex: 1 }} />
        ))}

        {/* Playback highlight — ô vuông quanh đầu nốt đang vang */}
        {activeBoxes.map((b, i) => (
          <div key={i} style={{ position: 'absolute', left: b.x - 4, top: b.y - 4, width: b.w + 8, height: b.h + 8, background: 'rgba(200,153,26,0.30)', borderRadius: 3, pointerEvents: 'none', zIndex: 4 }} />
        ))}

        {/* Ô vuông quanh đầu nốt + số fret của nốt đang CHỌN */}
        {selHeads.map((b, i) => (
          <div key={i} style={{ position: 'absolute', left: b.x - 4, top: b.y - 4, width: b.w + 8, height: b.h + 8, border: '1.5px solid rgba(30,100,220,0.85)', background: 'rgba(30,100,220,0.14)', borderRadius: 3, pointerEvents: 'none', zIndex: 5 }} />
        ))}

        {/* Con trỏ NHẬP: vạch dọc cột + ô vuông trên dây đang chọn (đi theo ←→↑↓) */}
        {cursorCol && (
          <div style={{ position: 'absolute', left: cursorCol.x - 1, top: cursorCol.y, width: 2, height: cursorCol.h, background: 'rgba(30,100,220,0.45)', pointerEvents: 'none', zIndex: 5 }} />
        )}
        {cursorCell && (
          <div style={{ position: 'absolute', left: cursorCell.x, top: cursorCell.y, width: cursorCell.w, height: cursorCell.h, border: '1.5px solid rgba(30,100,220,0.9)', background: 'rgba(30,100,220,0.16)', borderRadius: 3, pointerEvents: 'none', zIndex: 6, animation: 'atbBlink 1.1s ease-in-out infinite' }} />
        )}
      </div>

      {notes.length === 0 && (
        <div style={{ padding: '10px 16px', textAlign: 'center', color: muted, fontSize: 13, borderTop: `1px solid ${border}` }}>
          Gõ số fret để nhập nốt · ↑↓ đổi dây · +/− trường độ · . chấm dôi · / liên 3 · R lặng · Space phát
        </div>
      )}

      <style>{`@keyframes atbBlink { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
    </div>
  );
}
