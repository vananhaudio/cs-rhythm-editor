import { useState, useEffect, useRef, useCallback } from 'react';
import GuitarFretboard from './GuitarFretboard';
import TeachingBoard from './TeachingBoard';
import ScoreTabViewer from './ScoreTabViewer';
import { MOCK_SCORE, calcTotalDuration } from './scoreData';
import type { ScoreNote } from './scoreData';

export type Theme = 'dark' | 'light';

interface ActiveNote { noteName: string; frequency: number; }

function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const isDark = theme === 'dark';

  const [notes, setNotes] = useState<ScoreNote[]>(MOCK_SCORE);
  const totalDuration = calcTotalDuration(notes);

  // Input mode: fretboard clicks write to score instead of playing audio
  const [inputMode, setInputMode] = useState(false);

  // Callback registered by ScoreTabViewer so App can forward fretboard clicks
  const noteInputCbRef = useRef<((str: number, fret: number) => void) | null>(null);

  const handleRequestNoteInput = useCallback((cb: (str: number, fret: number) => void) => {
    noteInputCbRef.current = cb;
  }, []);

  const handleFretboardNoteInput = useCallback((str: number, fret: number) => {
    noteInputCbRef.current?.(str, fret);
  }, []);

  // Playback
  const [isPlaying, setIsPlaying]         = useState(false);
  const [currentTime, setCurrentTime]     = useState(0);
  const [scoreActiveNotes, setScoreActiveNotes] = useState<Map<string, ActiveNote>>(new Map());
  const [activeNoteIds, setActiveNoteIds] = useState<Set<string>>(new Set());

  const rafRef       = useRef<number>(0);
  const startWallRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const tickPlayback = useCallback(() => {
    const elapsed = (performance.now() - startWallRef.current) / 1000;
    const t = startTimeRef.current + elapsed;
    if (t >= totalDuration) {
      setCurrentTime(totalDuration);
      setIsPlaying(false);
      setScoreActiveNotes(new Map());
      setActiveNoteIds(new Set());
      return;
    }
    setCurrentTime(t);
    const nowActive = new Map<string, ActiveNote>();
    const nowIds    = new Set<string>();
    for (const note of notes) {
      if (t >= note.time && t < note.time + note.duration) {
        nowActive.set(`${note.string}-${note.fret}`, { noteName: note.pitch, frequency: 0 });
        nowIds.add(note.id);
      }
    }
    setScoreActiveNotes(nowActive);
    setActiveNoteIds(nowIds);
    rafRef.current = requestAnimationFrame(tickPlayback);
  }, [notes, totalDuration]);

  const handlePlay = useCallback(() => {
    if (currentTime >= totalDuration) { startTimeRef.current = 0; setCurrentTime(0); }
    else startTimeRef.current = currentTime;
    startWallRef.current = performance.now();
    setIsPlaying(true);
  }, [currentTime, totalDuration]);

  const handlePause = useCallback(() => { setIsPlaying(false); cancelAnimationFrame(rafRef.current); }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false); cancelAnimationFrame(rafRef.current);
    setCurrentTime(0); setScoreActiveNotes(new Map()); setActiveNoteIds(new Set());
  }, []);

  useEffect(() => {
    if (isPlaying) rafRef.current = requestAnimationFrame(tickPlayback);
    else cancelAnimationFrame(rafRef.current);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, tickPlayback]);

  const handleNotesChange = useCallback((next: ScoreNote[]) => {
    setNotes(next);
    setIsPlaying(false); cancelAnimationFrame(rafRef.current);
    setCurrentTime(0); setScoreActiveNotes(new Map()); setActiveNoteIds(new Set());
  }, []);

  const bg = isDark
    ? 'linear-gradient(160deg, #0a0a0f 0%, #111118 40%, #0d0d14 100%)'
    : 'linear-gradient(160deg, #f4f1eb 0%, #ede9e0 40%, #f0ece3 100%)';

  return (
    <div className="min-h-screen" style={{ background: bg, transition: 'background 0.35s' }}>

      {/* Header */}
      <header className="pt-3 pb-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Thầy Văn Anh Guitar" style={{ width: 30, height: 30, objectFit: 'contain', filter: isDark ? 'drop-shadow(0 0 6px rgba(201,151,0,0.3))' : 'drop-shadow(0 0 4px rgba(160,110,0,0.2))', opacity: 0.92, transition: 'filter 0.35s' }} />
            <div className="flex items-baseline gap-2">
              <span style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#c8a84b' : '#a07820', letterSpacing: '0.02em', lineHeight: 1, fontFamily: 'system-ui, sans-serif', transition: 'color 0.35s' }}>Thầy Văn Anh</span>
              <span style={{ fontSize: 9, fontWeight: 400, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', letterSpacing: '0.35em', textTransform: 'uppercase', transition: 'color 0.35s' }}>Guitar</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)', fontSize: 10, letterSpacing: '0.05em', transition: 'color 0.35s' }}>Standard Tuning E A D G B E</span>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 16, border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.25s', outline: 'none' }}>
              {isDark
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
              <span style={{ fontSize: 11, fontWeight: 500, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', letterSpacing: '0.03em' }}>{isDark ? 'Sáng' : 'Tối'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="px-3 pb-4 max-w-7xl mx-auto">
        <GuitarFretboard
          theme={theme}
          externalActiveNotes={scoreActiveNotes}
          inputMode={inputMode}
          onNoteInput={handleFretboardNoteInput}
        />

        {/* Input mode toggle button between fretboard and score */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
          <button
            onClick={() => setInputMode(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 16px', borderRadius: 20,
              border: `1px solid ${inputMode ? (isDark ? 'rgba(200,153,26,0.6)' : 'rgba(200,153,26,0.5)') : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
              background: inputMode ? (isDark ? 'rgba(200,153,26,0.15)' : 'rgba(200,153,26,0.1)') : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
              color: inputMode ? (isDark ? '#c8a84b' : '#a07820') : (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'),
              fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
              letterSpacing: '0.04em',
            }}
          >
            {inputMode ? (
              <>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                Tắt nhập nốt từ cần đàn
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
                Nhập nốt từ cần đàn
              </>
            )}
          </button>
        </div>

        <div>
          <ScoreTabViewer
            theme={theme}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            activeNoteIds={activeNoteIds}
            notes={notes}
            totalDuration={totalDuration}
            onNotesChange={handleNotesChange}
            onRequestNoteInput={handleRequestNoteInput}
          />
        </div>

        <div className="mt-3">
          <TeachingBoard theme={theme} />
        </div>
      </main>

    </div>
  );
}

export default App;
