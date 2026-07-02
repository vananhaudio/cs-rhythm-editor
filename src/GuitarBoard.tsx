import { useState, useEffect, useRef, useCallback } from 'react';
import GuitarFretboard from './GuitarFretboard';
import TeachingBoard from './TeachingBoard';
import ScoreTabViewer from './components/ScoreTabViewerAlpha';
import { MOCK_SCORE, calcTotalDuration } from './scoreData';
import type { ScoreNote } from './scoreData';
import { getNoteForFret } from './guitarNotes';
import { playGuitarNote } from './audioEngine';

export type Theme = 'dark' | 'light';

interface ActiveNote { noteName: string; frequency: number; }

function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const isDark = theme === 'dark';

  const [notes, setNotes] = useState<ScoreNote[]>(MOCK_SCORE);
  const totalDuration = calcTotalDuration(notes);

  // Input mode: fretboard clicks write to score instead of playing audio
  const [inputMode, setInputMode] = useState(false);

  // Chế độ hiển thị: false = Chế độ 1 (cần đàn to trên), true = Chế độ 2 (khuông nhạc to trên, cần đàn nhỏ phụ dưới)
  const [scoreFocus, setScoreFocus] = useState(false);
  // Tỉ lệ cần đàn: Chế độ 1 (cần đàn to) 0.92 (giảm thêm 3%); Chế độ 2 (cần đàn phụ) 0.61
  const FB_SCALE = scoreFocus ? 0.61 : 0.92;
  const fbRef = useRef<HTMLDivElement>(null);
  const [fbNaturalH, setFbNaturalH] = useState(385);     // chiều cao tự nhiên cần đàn (đo runtime, transform không đổi scrollHeight)
  useEffect(() => {
    const el = fbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { const h = el.scrollHeight; if (h > 0) setFbNaturalH(h); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
  const playedRef    = useRef<Set<string>>(new Set());   // nốt đã phát tiếng trong lượt play này

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
        // Phát tiếng đúng lúc nốt bắt đầu (bỏ qua dấu lặng string === -1)
        if (note.string >= 0 && !playedRef.current.has(note.id)) {
          playGuitarNote(getNoteForFret(note.string, note.fret).frequency, note.string);
          playedRef.current.add(note.id);
        }
      } else {
        // Nốt đã trôi qua → cho phép phát lại nếu tua/lặp
        playedRef.current.delete(note.id);
      }
    }
    setScoreActiveNotes(nowActive);
    setActiveNoteIds(nowIds);
    rafRef.current = requestAnimationFrame(tickPlayback);
  }, [notes, totalDuration]);

  // Phát từ vị trí con trỏ (fromTime) nếu được truyền; nếu ở/quá cuối bài thì phát lại từ đầu
  const handlePlay = useCallback((fromTime?: number) => {
    let start = fromTime != null ? fromTime : currentTime;
    if (start >= totalDuration - 1e-6) start = 0;
    startTimeRef.current = start;
    setCurrentTime(start);
    startWallRef.current = performance.now();
    playedRef.current.clear();
    setIsPlaying(true);
  }, [currentTime, totalDuration]);

  const handlePause = useCallback(() => { setIsPlaying(false); cancelAnimationFrame(rafRef.current); }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false); cancelAnimationFrame(rafRef.current);
    setCurrentTime(0); setScoreActiveNotes(new Map()); setActiveNoteIds(new Set());
    playedRef.current.clear();
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

  const isMobile = window.innerWidth < 768;

  return (
    <div style={{ background: bg, transition: 'background 0.35s', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ background:'#14532D', borderBottom:'1px solid rgba(255,255,255,0.1)', padding:'0 16px', height: isMobile ? 44 : 48, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 6 : 10 }}>
          <svg width={isMobile ? 22 : 28} height={isMobile ? 22 : 28} viewBox="0 0 965 932" xmlns="http://www.w3.org/2000/svg">
            <path fill="rgba(255,255,255,0.9)" d="M485.5,5.14C230.7,5.14,24.14,211.7,24.14,466.5s206.56,461.37,461.36,461.37,461.36-206.56,461.36-461.37S740.3,5.14,485.5,5.14ZM485.5,883.81c-230.47,0-417.3-186.84-417.3-417.31S255.03,49.2,485.5,49.2s417.3,186.83,417.3,417.3-186.83,417.31-417.3,417.31Z"/>
            <path fill="rgba(255,255,255,0.9)" d="M871.98,503h-284.98s-.01-62.01-.01-62.01h234.96s.05-26.12.05-26.12l.94-6.87h-235.94s0-126.99,0-126.99h-31.01l.02,127h-70.02l.02-159h-32.02l.02,159-158-.02v33.02l158-.02v62.02l-158-.02v33.02l158-.02-.02,164h32.02l-.02-164h70.02v194.99s30.98,0,30.98,0l.04-194.98h284.96v-33ZM556,503h-70v-62h70v62Z"/>
            <path fill="rgba(255,255,255,0.9)" d="M437.1,352.53c-32.96-49.63-86.33-79.48-145.64-75.14-45,3.29-85.41,26.85-113.24,61.9-22.85,28.79-36.56,63.15-40.93,99.78l-1.09,13.87c-2.13,26.81,2.05,52.76,10.82,78.07,25.52,73.59,90.73,125.65,170.74,118.53,33.32-2.96,63.64-17.38,88.57-39.1l15.13-14.97,16.56-21.02v81.88c-32.45,23.82-70.48,39.73-110.86,43.64l-8.18.79-32.78-.18c-49.9-3.88-96.27-23.99-133.71-57.03l-19.99-20.07c-94.04-106-76.94-272.39,38.35-355.71,80.22-57.97,186.6-57.06,267.12,1.73l.06,81.08c1.61,1.44.72,3.12-.93,1.95Z"/>
          </svg>
          <span style={{ fontSize: isMobile ? 14 : 15, fontWeight:700, color:'#F4F1E8' }}>Thầy Văn Anh Guitar</span>
          {!isMobile && <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginLeft:8, letterSpacing:'0.05em' }}>Standard Tuning E A D G B E</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={() => setScoreFocus(v => !v)}
            title="Đổi bố cục: cần đàn to ↔ khuông nhạc to"
            style={{ display:'flex', alignItems:'center', gap:5, padding: isMobile ? '4px 10px' : '5px 12px', borderRadius:16, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.1)', cursor:'pointer', outline:'none', color:'rgba(255,255,255,0.85)', fontSize: isMobile ? 12 : 12, fontWeight:600 }}>
            ⇅ {scoreFocus ? 'Khuông to' : 'Cần đàn to'}
          </button>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
            style={{ display:'flex', alignItems:'center', gap:4, padding: isMobile ? '4px 10px' : '5px 12px', borderRadius:16, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.1)', cursor:'pointer', outline:'none', color:'rgba(255,255,255,0.8)', fontSize: isMobile ? 13 : 12, fontWeight:500 }}>
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Mobile: stack dọc. Chế độ 1 = cần đàn to trên / khuông dưới; Chế độ 2 = khuông to trên / cần đàn nhỏ phụ dưới.
          Đảo trên-dưới bằng CSS order để KHÔNG remount (giữ trạng thái cần đàn). */}
      {isMobile ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Fretboard — CĐ1 to (scale 0.95), CĐ2 thu nhỏ thành panel phụ (scale 0.61) */}
          <div style={{
            order: scoreFocus ? 3 : 1, flexShrink: 0,
            overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch',
            borderTop: scoreFocus ? `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}` : undefined,
          }}>
            {/* hộp đã thu/phóng — cuộn ngang khớp đúng bề rộng thực */}
            <div style={{ width: 600 * FB_SCALE, height: fbNaturalH * FB_SCALE, overflow: 'hidden' }}>
              <div ref={fbRef} style={{ width: 600, transform: `scale(${FB_SCALE})`, transformOrigin: 'top left' }}>
                <GuitarFretboard
                  theme={theme}
                  externalActiveNotes={scoreActiveNotes}
                  inputMode={inputMode}
                  onNoteInput={handleFretboardNoteInput}
                  controlsBelow={scoreFocus}
                  onToggleInputMode={() => setInputMode(v => !v)}
                />
              </div>
            </div>
          </div>

          {/* Sheet nhạc — Chế độ 2 chiếm phần lớn (to, trên) */}
          <div style={{ order: scoreFocus ? 1 : 3, flex: 1, overflowX: 'auto', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 8px 16px' }}>
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
              toolsOnTop={scoreFocus}
            />
          </div>
        </div>
      ) : (
        /* Desktop: Chế độ 1 = cần đàn trên / khuông dưới; Chế độ 2 = khuông trên / cần đàn nhỏ phụ dưới (đảo bằng order) */
        <main className="px-3 pb-4 max-w-7xl mx-auto" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            order: scoreFocus ? 3 : 1,
            overflow: 'hidden',
            height: fbNaturalH * FB_SCALE,
            borderTop: scoreFocus ? `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}` : undefined,
            marginTop: scoreFocus ? 10 : undefined,
          }}>
            {/* CĐ2: width 100/scale% phủ kín bề ngang, căn trái. CĐ1: 100% container, scale 0.92 = nhỏ ~8%, CĂN GIỮA */}
            <div ref={fbRef} style={{ transform: `scale(${FB_SCALE})`, transformOrigin: scoreFocus ? 'top left' : 'top center', width: scoreFocus ? `${100 / FB_SCALE}%` : undefined }}>
              <GuitarFretboard
                theme={theme}
                externalActiveNotes={scoreActiveNotes}
                inputMode={inputMode}
                onNoteInput={handleFretboardNoteInput}
                controlsBelow={scoreFocus}
                onToggleInputMode={() => setInputMode(v => !v)}
              />
            </div>
          </div>
          <div style={{ order: scoreFocus ? 1 : 3 }}>
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
              toolsOnTop={scoreFocus}
            />
          </div>
          <div className="mt-3" style={{ order: 4 }}>
            <TeachingBoard theme={theme} />
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
