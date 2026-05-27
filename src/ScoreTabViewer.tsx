import { useRef, useEffect, useState, useCallback } from 'react';
import { getNoteForFret } from './guitarNotes';
import type { Theme } from './GuitarBoard';
import type { ScoreNote } from './scoreData';
import { SCORE_BPM, SCORE_BEATS_PER_MEASURE } from './scoreData';

const spb = () => 60 / SCORE_BPM;
function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
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

const DURATIONS = [
  { beats: 4,    label: 'Tròn',     symbol: '𝅝',  key: '7' },
  { beats: 2,    label: 'Trắng',    symbol: '𝅗𝅥',  key: '6' },
  { beats: 1,    label: 'Đen',      symbol: '♩',  key: '5' },
  { beats: 0.5,  label: 'Móc đơn', symbol: '♪',  key: '4' },
  { beats: 0.25, label: 'Móc đôi', symbol: '𝅘𝅥𝅯',  key: '3' },
];
const STRING_SHORT  = ['E', 'A', 'D', 'G', 'B', 'e'];
const STRING_LABELS = ['E2·Dây6','A2·Dây5','D3·Dây4','G3·Dây3','B3·Dây2','E4·Dây1'];

export default function ScoreTabViewer({
  theme, currentTime, isPlaying, onPlay, onPause, onStop,
  activeNoteIds: _activeNoteIds, notes, totalDuration, onNotesChange, onRequestNoteInput,
}: Props) {
  const isDark = theme === 'dark';
  const atRef  = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  const [cursorIdx,  setCursorIdx]  = useState(notes.length);
  const [selIdx,     setSelIdx]     = useState<number | null>(null);
  const [durBeats,   setDurBeats]   = useState(1);
  const [dotted,     setDotted]     = useState(false);
  const [triplet,    setTriplet]    = useState(false);
  const [fretBuf,    setFretBuf]    = useState('');
  const [pendingStr, setPendingStr] = useState(3);
  const [focused,    setFocused]    = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const border  = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)';
  const panelBg = isDark ? 'rgba(20,20,30,0.95)' : '#f5f3ee';
  const muted   = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const accent  = isDark ? '#c8a84b' : '#8a6500';

  const effectiveDur = (() => {
    const base = dotted ? durBeats * 1.5 : durBeats;
    return triplet ? (base * 2 / 3) * spb() : base * spb();
  })();

  const cursorTime = (() => {
    if (cursorIdx <= 0 || notes.length === 0) return 0;
    const i = Math.min(cursorIdx - 1, notes.length - 1);
    return notes[i].time + notes[i].duration;
  })();

  // Build AlphaTex string
  function buildTex(notes: ScoreNote[], totalDuration: number): string {
    function secToDur(sec: number): number {
      const b = sec / spb();
      if (b >= 3.5) return 1;
      if (b >= 1.5) return 2;
      if (b >= 0.75) return 4;
      if (b >= 0.375) return 8;
      return 16;
    }
    const barDur = SCORE_BEATS_PER_MEASURE * spb();
    const numBars = Math.max(1, Math.ceil((totalDuration || barDur) / barDur));
    let tex = '\\title ""\n\\tempo ' + SCORE_BPM + '\n.\n';
    for (let m = 0; m < numBars; m++) {
      const barStart = m * barDur;
      const barNotes = notes.filter(n => n.time >= barStart && n.time < barStart + barDur);
      if (barNotes.length === 0) {
        tex += 'r:1 ';
      } else {
        for (const n of barNotes) {
          const str = 6 - n.string;
          const dur = secToDur(n.duration);
          tex += n.fret + '.' + str + ':' + dur + ' ';
        }
      }
      tex += '| ';
    }
    return tex;
  }

  // Init AlphaTab
  useEffect(() => {
    if (!atRef.current) return;
    let destroyed = false;

    import('@coderline/alphatab').then((at) => {
      if (destroyed || !atRef.current) return;
      const api = new at.AlphaTabApi(atRef.current, {
        core: { engine: "html5", logLevel: at.LogLevel.None, file: "/alphaTab.worker.js" } as any,
        display: {
          layoutMode: at.LayoutMode.Horizontal,
          staveProfile: at.StaveProfile.TabMixed,
          scale: 0.95,
        },
      });
      apiRef.current = api;
      setTimeout(() => {
        if (!destroyed) api.tex(buildTex(notes, totalDuration));
      }, 200);
    });

    return () => { destroyed = true; };
  }, []);

  // Re-render khi notes thay đổi
  useEffect(() => {
    if (!apiRef.current) return;
    apiRef.current.tex(buildTex(notes, totalDuration));
  }, [notes, totalDuration]);

  // Commit note
  const commitNote = useCallback((str: number, fret: number) => {
    const nf = getNoteForFret(str, fret, 'sharp');
    const newNote: ScoreNote = {
      id: 'n' + Date.now() + '-' + Math.random().toString(36).slice(2),
      time: cursorTime,
      duration: effectiveDur,
      string: str,
      fret,
      pitch:   nf.noteName,
      octave:  nf.octave,
      measure: Math.floor(cursorTime / (spb() * SCORE_BEATS_PER_MEASURE)) + 1,
      beat:    ((cursorTime / spb()) % SCORE_BEATS_PER_MEASURE) + 1,
    };
    const next = [...notes.slice(0, cursorIdx), newNote, ...notes.slice(cursorIdx)];
    onNotesChange(next);
    setCursorIdx(cursorIdx + 1);
    setSelIdx(cursorIdx);
    setFretBuf('');
  }, [notes, cursorIdx, cursorTime, effectiveDur, onNotesChange]);

  useEffect(() => {
    onRequestNoteInput?.((str, fret) => commitNote(str, fret));
  }, [onRequestNoteInput, commitNote]);

  // Keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const k = e.key;
    if (/^[3-7]$/.test(k) && !e.shiftKey) {
      e.preventDefault();
      const d = DURATIONS.find(d => d.key === k);
      if (d) { setDurBeats(d.beats); setDotted(false); } return;
    }
    if (k === '.') { e.preventDefault(); setDotted(v => !v); return; }
    if (k === '/') { e.preventDefault(); setTriplet(v => !v); return; }
    if (k === 'ArrowLeft') {
      e.preventDefault();
      const ni = Math.max(0, cursorIdx - 1);
      setCursorIdx(ni); setSelIdx(ni > 0 ? ni - 1 : null); setFretBuf(''); return;
    }
    if (k === 'ArrowRight') {
      e.preventDefault();
      const ni = Math.min(notes.length, cursorIdx + 1);
      setCursorIdx(ni); setSelIdx(ni > 0 ? ni - 1 : null); setFretBuf(''); return;
    }
    if (k === 'ArrowUp')   { e.preventDefault(); setPendingStr(s => Math.min(5, s + 1)); return; }
    if (k === 'ArrowDown') { e.preventDefault(); setPendingStr(s => Math.max(0, s - 1)); return; }
    if (k === 'Backspace' || k === 'Delete') {
      e.preventDefault();
      if (fretBuf) { setFretBuf(b => b.slice(0, -1)); return; }
      const di = k === 'Delete' ? (selIdx ?? cursorIdx - 1) : cursorIdx - 1;
      if (di < 0 || di >= notes.length) return;
      onNotesChange(notes.filter((_, i) => i !== di));
      setCursorIdx(Math.max(0, di)); setSelIdx(null); return;
    }
    if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      const buf = fretBuf + k;
      const fret = parseInt(buf, 10);
      if (buf.length === 1) { setFretBuf(buf); }
      else {
        if (fret <= 24) { commitNote(pendingStr, fret); }
        else { commitNote(pendingStr, parseInt(fretBuf, 10)); setFretBuf(k); }
      }
      return;
    }
    if (k === 'Enter') { e.preventDefault(); if (fretBuf) commitNote(pendingStr, parseInt(fretBuf, 10)); return; }
    if (k === ' ') { e.preventDefault(); isPlaying ? onPause() : onPlay(); return; }
    if (e.shiftKey && /^[1-6]$/.test(k)) { e.preventDefault(); setPendingStr(6 - parseInt(k, 10)); return; }
  }, [notes, cursorIdx, fretBuf, selIdx, pendingStr, isPlaying, onPlay, onPause, onNotesChange, commitNote]);

  const bs = (active: boolean, acc?: string): React.CSSProperties => ({
    width: 28, height: 26, borderRadius: 4, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid ' + (active && acc ? acc + '88' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')),
    background: active && acc ? acc + '22' : 'transparent',
    color: active && acc ? acc : muted,
  });

  const bb = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600 as const,
    cursor: 'pointer', border: '1px solid ' + (active ? 'rgba(30,100,220,0.6)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')),
    background: active ? 'rgba(30,100,220,0.15)' : 'transparent',
    color: active ? '#1e64dc' : muted,
  });

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setFretBuf(''); }}
      style={{ outline: 'none', border: '1px solid ' + border, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: panelBg }}
    >
      {/* Transport */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid ' + border, background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={onStop} style={bs(false)}>
            <svg width="9" height="9" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="currentColor" rx="1"/></svg>
          </button>
          <button onClick={isPlaying ? onPause : onPlay} style={bs(isPlaying, accent)}>
            {isPlaying
              ? <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="8" fill="currentColor" rx="0.5"/><rect x="6" y="1" width="3" height="8" fill="currentColor" rx="0.5"/></svg>
              : <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="2,1 9,5 2,9" fill="currentColor"/></svg>
            }
          </button>
        </div>
        <span style={{ fontSize: 10, color: muted, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
          {SCORE_BPM} BPM · 4/4 · {fmtTime(currentTime)}/{fmtTime(totalDuration)}
        </span>
        <div style={{ flex: 1, minWidth: 60, height: 3, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: (totalDuration > 0 ? Math.min(100, currentTime / totalDuration * 100) : 0) + '%', background: accent, borderRadius: 2, transition: 'width 0.08s linear' }} />
        </div>
        <span style={{ fontSize: 10, color: muted }}>{notes.length} nốt</span>
      </div>

      {/* Input toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '4px 10px', borderBottom: '1px solid ' + border, background: focused ? (isDark ? 'rgba(30,100,220,0.07)' : 'rgba(30,100,220,0.04)') : (isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)'), flexWrap: 'wrap', transition: 'background 0.15s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: focused ? '#1e64dc' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'), transition: 'background 0.15s' }} />
          <span style={{ fontSize: 10, color: focused ? '#1e64dc' : muted, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {focused ? 'Đang nhập' : 'Click để nhập'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 1, marginRight: 6 }}>
          {DURATIONS.map(d => (
            <button key={d.key} onClick={() => { setDurBeats(d.beats); setDotted(false); }} title={d.label + ' (' + d.key + ')'}
              style={{ ...bb(d.beats === durBeats && !dotted), width: 28, height: 26, fontSize: 14, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {d.symbol}
            </button>
          ))}
        </div>

        <button onClick={() => setDotted(v => !v)} title="Chấm dôi (.)"
          style={{ ...bb(dotted), width: 26, height: 26, fontSize: 16, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>·</button>

        <div style={{ width: 1, height: 18, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '0 4px' }} />

        <button onClick={() => setTriplet(v => !v)} title="Liên 3 (/)"
          style={{ ...bb(triplet), padding: '2px 8px', fontSize: 10 }}>3</button>

        <div style={{ width: 1, height: 18, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '0 4px' }} />

        <div style={{ display: 'flex', gap: 1 }}>
          {[5,4,3,2,1,0].map(s => (
            <button key={s} onClick={() => setPendingStr(s)} title={STRING_LABELS[s]}
              style={{ ...bb(s === pendingStr), width: 22, height: 22, padding: 0, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3 }}>
              {STRING_SHORT[s]}
            </button>
          ))}
        </div>

        {fretBuf && (
          <span style={{ marginLeft: 8, fontSize: 12, color: '#1e64dc', fontWeight: 800, fontFamily: 'monospace', background: 'rgba(30,100,220,0.12)', padding: '1px 8px', borderRadius: 4 }}>
            {fretBuf}_
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
          {[['3-7','Trường độ'],['.','.'],['/', '3:3'],['↑↓','Dây'],['←→','Di chuyển'],['⌫','Xóa']].map(([k,v]) => (
            <span key={k} style={{ fontSize: 9, color: muted, display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
              <kbd style={{ fontSize: 8, padding: '1px 3px', borderRadius: 2, border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'), background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', fontFamily: 'monospace' }}>{k}</kbd>
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* AlphaTab area */}
      <div style={{ background: '#faf9f5', overflowX: 'auto', minHeight: 160 }}
        onClick={() => containerRef.current?.focus()}>
        <div ref={atRef} style={{ padding: '8px 0', minHeight: 140 }} />
      </div>

      {notes.length === 0 && (
        <div style={{ padding: '10px 16px', textAlign: 'center', color: muted, fontSize: 12, borderTop: '1px solid ' + border }}>
          Click vào đây rồi gõ số fret, hoặc bấm nốt trên cần đàn
        </div>
      )}
    </div>
  );
}
