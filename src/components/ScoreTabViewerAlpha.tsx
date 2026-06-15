import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { Theme } from '../GuitarBoard';
import { SCORE_BPM, SCORE_BEATS_PER_MEASURE } from '../scoreData';
import type { ScoreNote } from '../scoreData';
import { getNoteForFret } from '../guitarNotes';
import { playGuitarNote } from '../audioEngine';
import { notesToAlphaTex } from './notesToAlphaTex';

// ─── Trường độ ─────────────────────────────────────────────────────────────────
const DURATIONS = [4, 2, 1, 0.5, 0.25];        // beats: Tròn → Móc đôi
const spb = () => 60 / SCORE_BPM;
const beatsToSec = (b: number) => b * spb();
const tripletDur = (b: number) => beatsToSec(b * 2 / 3);

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
function reflowTimes(notes: ScoreNote[]): ScoreNote[] {
  const sec = spb();
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
  const tex = useMemo(() => notesToAlphaTex(notes), [notes]);

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
    const t = cursorTime, sec = spb();
    const newNote: ScoreNote = {
      id: `n${Date.now()}-${Math.random().toString(36).slice(2)}`,
      time: t, duration: effectiveDur, string: str, fret,
      pitch: nf.noteName, octave: nf.octave,
      measure: Math.floor(t / (sec * SCORE_BEATS_PER_MEASURE)) + 1,
      beat: ((t / sec) % SCORE_BEATS_PER_MEASURE) + 1,
    };
    onNotesChange(reflowTimes([...notes.slice(0, cursorIdx), newNote, ...notes.slice(cursorIdx)]));
    setCursorIdx(cursorIdx + 1);
    setSelIdx(cursorIdx);
    setFretBuf('');
  }, [notes, cursorIdx, cursorTime, effectiveDur, onNotesChange]);

  useEffect(() => { commitNoteRef.current = commitNote; }, [commitNote]);
  useEffect(() => { pendingStrRef.current = pendingStr; }, [pendingStr]);
  useEffect(() => { onRequestNoteInput?.((str, fret) => commitNote(str, fret)); }, [onRequestNoteInput, commitNote]);

  // Carry-forward: bút lấy trường độ nốt đang chọn
  useEffect(() => {
    if (selIdx !== null && selIdx < notes.length && notes[selIdx].string >= 0) {
      const cls = classifyBeats(notes[selIdx].duration / spb());
      setDurBeats(cls.base); setDotted(cls.dotted); setTriplet(cls.triplet);
    }
  }, [selIdx, notes]);

  // ── Hành động dùng chung ──────────────────────────────────────────────────────
  const insertRest = useCallback(() => {
    const t = cursorTime, sec = spb();
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
      const cls = classifyBeats(notes[selIdx].duration / spb());
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
      const cls = classifyBeats(notes[selIdx].duration / spb());
      setSelDuration(composeBeats({ ...cls, dotted: !cls.dotted, triplet: false }));
    } else { setDotted(v => !v); setTriplet(false); }
  }, [selIdx, notes, setSelDuration]);

  const toggleTrip = useCallback(() => {
    if (selIdx !== null && selIdx < notes.length) {
      const cls = classifyBeats(notes[selIdx].duration / spb());
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

    if (k === 'ArrowLeft')  { e.preventDefault(); setCursorIdx(c => Math.max(0, c - 1)); setSelIdx(null); setFretBuf(''); return; }
    if (k === 'ArrowRight') { e.preventDefault(); setCursorIdx(c => Math.min(notes.length, c + 1)); setSelIdx(null); setFretBuf(''); return; }
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
  }, [notes, cursorIdx, fretBuf, selIdx, isPlaying, onPlay, onPause, onNotesChange, stepDuration, toggleDot, toggleTrip, insertRest]);

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
  const [selBox, setSelBox]   = useState<Box | null>(null);
  const [caret, setCaret]     = useState<{ x: number; h: number; y: number } | null>(null);
  const [activeBoxes, setActiveBoxes] = useState<Box[]>([]);

  // Gom box mỗi beat (gộp staff khuông + TAB → 1 box cao toàn phần), thứ tự = notes[]
  const beatBoxes = useCallback((): Box[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bl = (apiRef.current as any)?.renderer?.boundsLookup;
    if (!bl) return [];
    const boxes: Box[] = [];
    for (const sys of bl.staffSystems) {
      for (const mb of sys.bars) {                 // mỗi master bar
        const staves = mb.bars;                    // [khuông, TAB]
        const n = staves[0]?.beats?.length ?? 0;
        for (let j = 0; j < n; j++) {
          let x = Infinity, y = Infinity, r = -Infinity, b = -Infinity;
          for (const st of staves) {
            const bb = st.beats[j]; if (!bb) continue;
            const rb = bb.realBounds;
            x = Math.min(x, rb.x); y = Math.min(y, rb.y);
            r = Math.max(r, rb.x + rb.w); b = Math.max(b, rb.y + rb.h);
          }
          if (x !== Infinity) boxes.push({ x, y, w: r - x, h: b - y });
        }
      }
    }
    return boxes;
  }, []);

  const recomputeOverlays = useCallback(() => {
    const boxes = beatBoxes();

    // Selection box
    setSelBox(selIdx !== null && selIdx < boxes.length ? boxes[selIdx] : null);

    // Caret tại vị trí chèn (cursorIdx)
    if (selIdx === null && focused && boxes.length > 0) {
      if (cursorIdx >= boxes.length) {
        const b = boxes[boxes.length - 1];
        setCaret({ x: b.x + b.w + 3, y: b.y, h: b.h });
      } else {
        const b = boxes[cursorIdx];
        setCaret({ x: b.x - 4, y: b.y, h: b.h });
      }
    } else setCaret(null);

    // Playback highlight
    const ab: Box[] = [];
    notes.forEach((n, i) => { if (activeNoteIds.has(n.id) && i < boxes.length) ab.push(boxes[i]); });
    setActiveBoxes(ab);
  }, [notes, selIdx, cursorIdx, focused, activeNoteIds, beatBoxes]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(recomputeOverlays, 20);
    return () => clearTimeout(t);
  }, [ready, renderTick, recomputeOverlays]);

  // Auto-scroll tới nốt đang phát
  useEffect(() => {
    if (!isPlaying || activeBoxes.length === 0) return;
    const wrap = wrapRef.current; if (!wrap) return;
    const b = activeBoxes[0];
    if (b.x > wrap.scrollLeft + wrap.clientWidth - 120) wrap.scrollLeft = b.x - 120;
    if (b.x < wrap.scrollLeft) wrap.scrollLeft = Math.max(0, b.x - 40);
  }, [activeBoxes, isPlaying]);

  // ── Click chọn nốt ─────────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent) => {
    focusRef.current?.focus();
    setFocused(true);
    const wrap = wrapRef.current; if (!wrap) return;
    const boxes = beatBoxes();
    if (boxes.length === 0) return;
    const wr = wrap.getBoundingClientRect();
    const px = e.clientX - wr.left + wrap.scrollLeft;   // toạ độ nội dung
    let best = -1, bd = Infinity;
    boxes.forEach((b, i) => { const cx = b.x + b.w / 2; const d = Math.abs(px - cx); if (d < bd) { bd = d; best = i; } });
    if (best >= 0 && bd < 70 && notes[best] && notes[best].string >= 0) {
      setSelIdx(best); setCursorIdx(best);
    }
  }, [notes, beatBoxes]);

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
      {/* Thanh trạng thái nhỏ (read-only, không phải nút) */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '6px 12px', fontSize: 12, color: muted, borderBottom: `1px solid ${border}`, flexWrap: 'wrap' }}>
        <span>Trường độ: <b style={{ color: '#8a6500' }}>{durLabel}</b></span>
        <span>Dây: <b style={{ color: '#14532D' }}>{strLabel}</b></span>
        {dotted && <span style={{ color: '#8a6500' }}>• chấm dôi</span>}
        {triplet && <span style={{ color: '#8a6500' }}>• liên 3</span>}
        {fretBuf && <span style={{ color: '#1e64dc' }}>fret: {fretBuf}_</span>}
      </div>

      <div ref={wrapRef} onClick={handleClick}
        style={{ position: 'relative', overflowX: 'auto', overflowY: 'hidden', background: '#faf9f5', cursor: 'pointer', minHeight: 200 }}>
        <div ref={alphaRef} />

        {/* Playback highlight */}
        {activeBoxes.map((b, i) => (
          <div key={i} style={{ position: 'absolute', left: b.x - 4, top: b.y - 6, width: b.w + 8, height: b.h + 12, background: 'rgba(200,153,26,0.28)', borderRadius: 4, pointerEvents: 'none', zIndex: 4 }} />
        ))}

        {/* Selection box */}
        {selBox && (
          <div style={{ position: 'absolute', left: selBox.x - 4, top: selBox.y - 7, width: selBox.w + 8, height: selBox.h + 14, border: '2px solid rgba(30,100,220,0.7)', background: 'rgba(30,100,220,0.12)', borderRadius: 4, pointerEvents: 'none', zIndex: 5 }} />
        )}

        {/* Caret chèn */}
        {caret && (
          <div style={{ position: 'absolute', left: caret.x, top: caret.y, width: 2, height: caret.h, background: 'rgba(30,100,220,0.8)', pointerEvents: 'none', zIndex: 5, animation: 'atbBlink 1s step-end infinite' }} />
        )}
      </div>

      {notes.length === 0 && (
        <div style={{ padding: '10px 16px', textAlign: 'center', color: muted, fontSize: 12, borderTop: `1px solid ${border}` }}>
          Gõ số fret để nhập nốt · ↑↓ đổi dây · +/− trường độ · . chấm dôi · / liên 3 · R lặng · Space phát
        </div>
      )}

      <style>{`@keyframes atbBlink { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
    </div>
  );
}
