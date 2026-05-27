import { getNoteForFret } from './guitarNotes';
import { useRef, useEffect, useState, useCallback } from 'react';
import type { Theme } from './GuitarBoard';
import type { ScoreNote } from './scoreData';
import { SCORE_BPM, SCORE_BEATS_PER_MEASURE } from './scoreData';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const spb = () => 60 / SCORE_BPM;
function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

// ─── Props ───────────────────────────────────────────────────────────────────
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

// ─── Component ───────────────────────────────────────────────────────────────
export default function ScoreTabViewer({
  theme, currentTime, isPlaying, onPlay, onPause, onStop,
  activeNoteIds, notes, totalDuration, onNotesChange, onRequestNoteInput,
}: Props) {
  const isDark   = theme === 'dark';
  const atRef    = useRef<HTMLDivElement>(null);
  const apiRef   = useRef<any>(null);

  const [cursorIdx,  setCursorIdx]  = useState(notes.length);
  const [selIdx,     setSelIdx]     = useState<number | null>(null);
  const [durBeats,   setDurBeats]   = useState(1);
  const [dotted,     setDotted]     = useState(false);
  const [triplet,    setTriplet]    = useState(false);
  const [fretBuf,    setFretBuf]    = useState('');
  const [pendingStr, setPendingStr] = useState(3);
  const [focused,    setFocused]    = useState(false);
  const [atReady,    setAtReady]    = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Style tokens ─────────────────────────────────────────────────────────
  const border  = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)';
  const panelBg = isDark ? 'rgba(20,20,30,0.95)' : '#f5f3ee';
  const muted   = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const accent  = isDark ? '#c8a84b' : '#8a6500';

  // ── Effective duration ───────────────────────────────────────────────────
  const effectiveDur = (() => {
    const base = dotted ? durBeats * 1.5 : durBeats;
    return triplet ? (base * 2 / 3) * spb() : base * spb();
  })();

  // ── Cursor time ──────────────────────────────────────────────────────────
  const cursorTime = (() => {
    if (cursorIdx <= 0 || notes.length === 0) return 0;
    const i = Math.min(cursorIdx - 1, notes.length - 1);
    return notes[i].time + notes[i].duration;
  })();

  // ── AlphaTab init ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!atRef.current) return;
    let destroyed = false;

    import('@coderline/alphatab').then((at) => {
      if (destroyed || !atRef.current) return;

      const api = new at.AlphaTabApi(atRef.current, {
        core: { engine: 'html5', logLevel: at.LogLevel.None },
        display: {
          layoutMode: at.LayoutMode.Horizontal,
          staveProfile: at.StaveProfile.TabMixed,
          scale: 0.95,
        },
        notation: {
          smallGraceTabNotes: false,
          fingeringMode: at.FingeringMode.SingleNoteEffectBand,
        },
      });

      apiRef.current = api;
      api.scoreLoaded.on(() => setAtReady(true));
      renderScore(at, api, notes);
    });

    return () => {
      destroyed = true;
      apiRef.current?.destroy?.();
    };
  }, []);

  // ── Re-render khi notes thay đổi ────────────────────────────────────────
  useEffect(() => {
    if (!apiRef.current) return;
    import('@coderline/alphatab').then((at) => {
      renderScore(at, apiRef.current, notes);
    });
  }, [notes]);

  // ── Build AlphaTab score từ ScoreNote[] ──────────────────────────────────
  function renderScore(at: any, api: any, notes: ScoreNote[]) {
    const score = new at.model.Score();
    score.tempo = SCORE_BPM;

    const track = new at.model.Track();
    track.shortName = 'Gtr';
    score.tracks.push(track);

    const staff = new at.model.Staff();
    // Standard tuning MIDI: low E(40) A(45) D(50) G(55) B(59) high E(64)
    staff.tuning = [64, 59, 55, 50, 45, 40];
    track.staves.push(staff);

    const barDur = SCORE_BEATS_PER_MEASURE * spb();
    const numBars = Math.max(1, Math.ceil((totalDuration || barDur) / barDur));

    for (let m = 0; m < numBars; m++) {
      const bar = new at.model.Bar();
      bar.timeSignatureNumerator   = 4;
      bar.timeSignatureDenominator = 4;
      staff.bars.push(bar);

      const voice = new at.model.Voice();
      bar.voices.push(voice);

      const barStart = m * barDur;
      const barNotes = notes.filter(n => n.time >= barStart && n.time < barStart + barDur);

      if (barNotes.length === 0) {
        const beat = new at.model.Beat();
        beat.duration = at.model.Duration.Whole;
        beat.isEmpty  = true;
        voice.beats.push(beat);
      } else {
        for (const n of barNotes) {
          const beat = new at.model.Beat();
          beat.duration = secToDuration(at, n.duration);
          voice.beats.push(beat);

          const note = new at.model.Note();
          // AlphaTab: string 1=high E … 6=low E  |  ScoreNote: 0=low E … 5=high E
          note.string = 6 - n.string;
          note.fret   = n.fret;
          beat.notes.push(note);
        }
      }
    }

    api.renderScore(score);
  }

  function secToDuration(at: any, sec: number) {
    const b = sec / spb();
    if (b >= 3.5)   return at.model.Duration.Whole;
    if (b >= 1.5)   return at.model.Duration.Half;
    if (b >= 0.75)  return at.model.Duration.Quarter;
    if (b >= 0.375) return at.model.Duration.Eighth;
    return at.model.Duration.Sixteenth;
  }

  // ── Commit note ──────────────────────────────────────────────────────────

  const commitNote = useCallback((str: number, fret: number) => {
    const nf = getNoteForFret(str, fret, 'sharp');
    const newNote: ScoreNote = {
      id: `n${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

  // ── Keyboard ─────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const k = e.key;
    if (/^[3-7]$/.test(k) && !e.shiftKey) {
      e.preventDefault();
      const d = DURATIONS.find(d => d.key === k);
      if (d) { setDurBeats(d.beats); setDotted(false); }
      return;
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
    if (k === 'ArrowUp') { e.preventDefault(); setPendingStr(s => Math.min(5, s + 1)); return; }
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
  }, [notes, cursorIdx, durBeats, fretBuf, selIdx, pendingStr, isPlaying, onPlay, onPause, onNotesChange, commitNote]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setFretBuf(''); }}
      style={{ outline: 'none', border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: panelBg }}
    >
      {/* ── Transport bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={onStop} style={btnStyle(false, isDark)}>
            <svg width="9" height="9" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="currentColor" rx="1"/></svg>
          </button>
          <button onClick={isPlaying ? onPause : onPlay} style={btnStyle(isPlaying, isDark, accent)}>
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
          <div style={{ height: '100%', width: `${totalDuration > 0 ? Math.min(100, currentTime / totalDuration * 100) : 0}%`, background: accent, borderRadius: 2, transition: 'width 0.08s linear' }} />
        </div>
        <span style={{ fontSize: 10, color: muted }}>{notes.length} nốt</span>
      </div>

      {/* ── Input toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '4px 10px', borderBottom: `1px solid ${border}`, background: focused ? (isDark ? 'rgba(30,100,220,0.07)' : 'rgba(30,100,220,0.04)') : (isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)'), flexWrap: 'wrap', transition: 'background 0.15s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: focused ? '#1e64dc' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'), transition: 'background 0.15s' }} />
          <span style={{ fontSize: 10, color: focused ? '#1e64dc' : muted, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {focused ? 'Đang nhập' : 'Click để nhập'}
          </span>
        </div>

        {/* Duration buttons */}
        <div style={{ display: 'flex', gap: 1, marginRight: 6 }}>
          {DURATIONS.map(d => (
            <button key={d.key} onClick={() => { setDurBeats(d.beats); setDotted(false); }} title={`${d.label} (${d.key})`}
              style={{ width: 28, height: 26, borderRadius: 4, cursor: 'pointer',
                border: `1px solid ${d.beats === durBeats && !dotted ? 'rgba(30,100,220,0.6)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                background: d.beats === durBeats && !dotted ? 'rgba(30,100,220,0.15)' : 'transparent',
                color: d.beats === durBeats && !dotted ? '#1e64dc' : muted,
                fontSize: 14, fontWeight: 600, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {d.symbol}
            </button>
          ))}
        </div>

        {/* Dotted */}
        <button onClick={() => setDotted(v => !v)} title="Chấm dôi (.)"
          style={{ width: 26, height: 26, borderRadius: 4, cursor: 'pointer', fontSize: 16, fontWeight: 700,
            border: `1px solid ${dotted ? 'rgba(30,100,220,0.6)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
            background: dotted ? 'rgba(30,100,220,0.15)' : 'transparent',
            color: dotted ? '#1e64dc' : muted,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ·
        </button>

        <div style={{ width: 1, height: 18, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '0 4px' }} />

        {/* Triplet */}
        <button onClick={() => setTriplet(v => !v)} title="Liên 3 (/)"
          style={{ padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700,
            border: `1px solid ${triplet ? 'rgba(30,100,220,0.6)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
            background: triplet ? 'rgba(30,100,220,0.15)' : 'transparent',
            color: triplet ? '#1e64dc' : muted }}>
          3
        </button>

        <div style={{ width: 1, height: 18, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '0 4px' }} />

        {/* String selector */}
        <div style={{ display: 'flex', gap: 1 }}>
          {[5,4,3,2,1,0].map(s => (
            <button key={s} onClick={() => setPendingStr(s)} title={STRING_LABELS[s]}
              style={{ width: 22, height: 22, borderRadius: 3, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                border: `1px solid ${s === pendingStr ? 'rgba(30,100,220,0.6)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                background: s === pendingStr ? 'rgba(30,100,220,0.15)' : 'transparent',
                color: s === pendingStr ? '#1e64dc' : muted }}>
              {STRING_SHORT[s]}
            </button>
          ))}
        </div>

        {fretBuf && (
          <span style={{ marginLeft: 8, fontSize: 12, color: '#1e64dc', fontWeight: 800, fontFamily: 'monospace', background: 'rgba(30,100,220,0.12)', padding: '1px 8px', borderRadius: 4 }}>
            {fretBuf}<span style={{ opacity: 0.5 }}>_</span>
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
          {[['3–7','Trường độ'],['.','.'],['/', '3:3'],['↑↓','Dây'],['←→','Di chuyển'],['⌫','Xóa']].map(([k,v]) => (
            <span key={k} style={{ fontSize: 9, color: muted, display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
              <kbd style={{ fontSize: 8, padding: '1px 3px', borderRadius: 2, border: `1px solid ${isDark?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.12)'}`, background: isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)', fontFamily: 'monospace' }}>{k}</kbd>
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* ── AlphaTab render area ── */}
      <div style={{ background: '#faf9f5', overflowX: 'auto', minHeight: 160, position: 'relative' }}
        onClick={() => containerRef.current?.focus()}>
        {!atReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted, fontSize: 12 }}>
            Đang tải...
          </div>
        )}
        <div ref={atRef} style={{ padding: '8px 0' }} />
      </div>

      {notes.length === 0 && atReady && (
        <div style={{ padding: '10px 16px', textAlign: 'center', color: muted, fontSize: 12, borderTop: `1px solid ${border}` }}>
          Click vào khuông nhạc rồi gõ số fret hoặc bấm nốt trên cần đàn
        </div>
      )}
    </div>
  );
}

function btnStyle(active: boolean, isDark: boolean, accent?: string): React.CSSProperties {
  return {
    width: 28, height: 26, borderRadius: 4, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${active && accent ? accent + '88' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
    background: active && accent ? accent + '22' : 'transparent',
    color: active && accent ? accent : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'),
  };
}
