import { useState, useCallback, useRef, useEffect } from 'react';
import { getNoteForFret, NOTE_COLOR_MAP, stringLabels, fretMarkers, doubleDotFrets, type AccidentalMode } from './guitarNotes';
import { playGuitarNote } from './audioEngine';
import type { Theme } from './GuitarBoard';

const NUM_FRETS = 15;
const DISPLAY_STRINGS = [5, 4, 3, 2, 1, 0]; // high E at top

// String visual thickness (display row 0=high E .. 5=low E)
const STRING_THICKNESS = [0.9, 1.3, 1.8, 2.6, 3.3, 4.0];
const WOUND_ROWS = new Set([3, 4, 5]);

// Phosphor bronze string colors
const STRING_BASE_COLOR = ['#d4c8a0', '#cec298', '#c8bc90', '#b8a870', '#a89858', '#988848'];
const STRING_SHADOW_COLOR = ['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.32)', 'rgba(0,0,0,0.36)'];

interface ActiveNote { noteName: string; frequency: number; }

function fretWidthPercent(fret: number) {
  return 1 - fret * 0.011;
}

// Abalone/pearl inlay positions
const INLAY_FRETS = [3, 5, 7, 9, 12, 15];
const DOUBLE_INLAY = [12];

interface SavedScale {
  id: string;
  name: string;
  pattern: Record<string, string>; // key → noteColor
}

interface GuitarFretboardProps {
  theme?: Theme;
  externalActiveNotes?: Map<string, { noteName: string; frequency: number }>;
  // When set, clicking a fret calls this instead of playing audio
  onNoteInput?: (stringIndex: number, fret: number) => void;
  inputMode?: boolean;
}

export default function GuitarFretboard({ theme = 'dark', externalActiveNotes, onNoteInput, inputMode = false }: GuitarFretboardProps) {
  const isDark = theme === 'dark';
  const t = {
    toolbarBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    toolbarBorder: isDark ? 'border-white/15' : 'border-black/10',
    textMuted: isDark ? 'text-white/40' : 'text-black/40',
    textMuted2: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)',
    textMuted3: isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.28)',
    textMain: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.70)',
    clearBtn: isDark ? 'border-white/15 text-white/50 hover:bg-white/8' : 'border-black/12 text-black/45 hover:bg-black/5',
    scalePanelBg: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    scalePanelBorder: isDark ? 'border-white/12 bg-white/4 hover:border-white/25' : 'border-black/10 bg-black/3 hover:border-black/20',
    scalePanelLoaded: isDark ? 'border-sky-500/70 bg-sky-500/12' : 'border-sky-500/60 bg-sky-100/60',
    lastPlayedBg: isDark ? 'bg-white/5 border-white/10' : 'bg-black/4 border-black/8',
    savedLabel: isDark ? 'text-white/30' : 'text-black/35',
    scaleText: isDark ? 'text-white/65 hover:text-white' : 'text-black/60 hover:text-black',
    inputBg: isDark ? 'bg-white/8' : 'bg-black/5',
    fretboardBg: isDark ? 'linear-gradient(180deg, #1e1410 0%, #221610 100%)' : 'linear-gradient(180deg, #1e1410 0%, #221610 100%)',
    topStripBg: isDark ? '#0e0e14' : '#14532D',
    fretNumInactive: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.22)',
  };
  type PlayMode = 'auto' | 'persist' | 'scale' | 'playScale';
  const [activeNotes, setActiveNotes] = useState<Map<string, ActiveNote>>(new Map());

  // Merge internal + external active notes for rendering
  const displayActiveNotes: Map<string, ActiveNote> = externalActiveNotes
    ? new Map([...activeNotes, ...externalActiveNotes])
    : activeNotes;
  const [showNotes, setShowNotes] = useState(true);
  const [playMode, setPlayMode] = useState<PlayMode>('auto');
  const [scalePattern, setScalePattern] = useState<Map<string, string>>(new Map()); // key → noteColor
  const [savedScales, setSavedScales] = useState<SavedScale[]>(() => {
    try { return JSON.parse(localStorage.getItem('guitar-scales') ?? '[]'); } catch { return []; }
  });
  const [activeScaleId, setActiveScaleId] = useState<string | null>(null);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [lastPlayed, setLastPlayed] = useState<{ noteName: string; freq: number } | null>(null);
  // key = `${stringIndex}-${fret}` of the cell the mouse is resting on (null while moving)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [accidental, setAccidental] = useState<AccidentalMode>('sharp');

  const persistScales = useCallback((scales: SavedScale[]) => {
    localStorage.setItem('guitar-scales', JSON.stringify(scales));
    setSavedScales(scales);
  }, []);

  const saveScale = useCallback(() => {
    const name = saveNameInput.trim() || `Scale ${savedScales.length + 1}`;
    const newScale: SavedScale = {
      id: Date.now().toString(),
      name,
      pattern: Object.fromEntries(scalePattern),
    };
    persistScales([...savedScales, newScale]);
    setSaveNameInput('');
    setShowSaveInput(false);
  }, [saveNameInput, savedScales, scalePattern, persistScales]);

  const loadScale = useCallback((scale: SavedScale) => {
    setScalePattern(new Map(Object.entries(scale.pattern)));
    setActiveScaleId(scale.id);
    setPlayMode('playScale');
    setActiveNotes(new Map());
  }, []);

  const deleteScale = useCallback((id: string) => {
    const next = savedScales.filter(s => s.id !== id);
    persistScales(next);
    if (activeScaleId === id) { setActiveScaleId(null); setPlayMode('auto'); setScalePattern(new Map()); }
  }, [savedScales, activeScaleId, persistScales]);

  // Trail canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<{ x: number; y: number; alpha: number; color: string }[]>([]);
  const rafRef = useRef<number>(0);
  const isMouseDownRef = useRef(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  const animateTrail = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    trailRef.current = trailRef.current.filter(p => p.alpha > 0.01);

    for (let i = 0; i < trailRef.current.length; i++) {
      const p = trailRef.current[i];
      const r = 10 + (1 - p.alpha) * 6; // grows as it fades
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grd.addColorStop(0, p.color.replace(')', `,${p.alpha * 0.7})`).replace('rgb', 'rgba'));
      grd.addColorStop(1, p.color.replace(')', ',0)').replace('rgb', 'rgba'));
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // connect with previous point
      if (i > 0) {
        const prev = trailRef.current[i - 1];
        const avgAlpha = (p.alpha + prev.alpha) / 2;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = p.color.replace(')', `,${avgAlpha * 0.35})`).replace('rgb', 'rgba');
        ctx.lineWidth = 3 + avgAlpha * 4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      p.alpha *= 0.93; // fade rate
    }

    // Punch a clear hole around the current cursor so the hover dot and note name are never obscured
    const mp = mousePosRef.current;
    if (mp) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const clearR = 32;
      const grd = ctx.createRadialGradient(mp.x, mp.y, 8, mp.x, mp.y, clearR);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, clearR, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.restore();

      // Draw custom cursor — thin ring + tiny crosshair, semi-transparent
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 7, 0, Math.PI * 2);
      ctx.stroke();
      // crosshair lines
      const arm = 4;
      ctx.beginPath();
      ctx.moveTo(mp.x - arm - 3, mp.y);
      ctx.lineTo(mp.x - 3, mp.y);
      ctx.moveTo(mp.x + 3, mp.y);
      ctx.lineTo(mp.x + arm + 3, mp.y);
      ctx.moveTo(mp.x, mp.y - arm - 3);
      ctx.lineTo(mp.x, mp.y - 3);
      ctx.moveTo(mp.x, mp.y + 3);
      ctx.lineTo(mp.x, mp.y + arm + 3);
      ctx.stroke();
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(animateTrail);
  }, [isDark]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animateTrail);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animateTrail]);

  // Keep canvas pixel size in sync with its CSS layout size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, []);

  const handleFretboardMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mousePosRef.current = { x, y };

    // sample color — for headstock area use open string color (fret 0)
    const row = Math.floor(y / ROW_HEIGHT);
    const clampedRow = Math.max(0, Math.min(DISPLAY_STRINGS.length - 1, row));
    const stringIndex = DISPLAY_STRINGS[clampedRow];
    const headstockWidth = HS_W + NUT_W;
    const isInHeadstock = x < headstockWidth;
    const fretboardX = x - headstockWidth;
    const fretboardPixelWidth = canvas.width - headstockWidth;
    const fretEstimate = isInHeadstock
      ? 0
      : Math.max(1, Math.min(NUM_FRETS, Math.round(fretboardX / (fretboardPixelWidth / NUM_FRETS))));
    const note = getNoteForFret(stringIndex, fretEstimate, accidental);
    const hex = NOTE_COLOR_MAP[note.noteName] ?? '#ffffff';
    const bigint = parseInt(hex.replace('#', ''), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    trailRef.current.push({ x, y, alpha: 0.85, color: `rgb(${r},${g},${b})` });
    if (trailRef.current.length > 120) trailRef.current.shift();
  }, [accidental]);

  const handleFretboardMouseLeave = useCallback(() => {
    isMouseDownRef.current = false;
    mousePosRef.current = null;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredKey(null);
  }, []);

  const handleFretEnter = useCallback((key: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredKey(key), 160);
  }, []);

  const handleFretLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredKey(null);
  }, []);

  const triggerNote = useCallback((stringIndex: number, fret: number) => {
    // In input mode, forward to score instead of playing audio
    if (inputMode && onNoteInput) {
      onNoteInput(stringIndex, fret);
      return;
    }

    const note = getNoteForFret(stringIndex, fret, accidental);
    const key = `${stringIndex}-${fret}`;

    if (playMode === 'scale') {
      setScalePattern(prev => {
        const next = new Map(prev);
        if (next.has(key)) { next.delete(key); } else { next.set(key, NOTE_COLOR_MAP[note.noteName] ?? '#6B7280'); }
        return next;
      });
      return;
    }

    if (playMode === 'playScale') {
      // Only play if this fret is part of the loaded scale
      if (!scalePattern.has(key)) return;
      playGuitarNote(note.frequency, stringIndex);
      setLastPlayed({ noteName: note.noteName, freq: note.frequency });
      setActiveNotes(prev => {
        const next = new Map(prev);
        next.set(key, { noteName: note.noteName, frequency: note.frequency });
        return next;
      });
      setTimeout(() => {
        setActiveNotes(prev => { const next = new Map(prev); next.delete(key); return next; });
      }, 1800);
      return;
    }

    if (playMode === 'persist' && activeNotes.has(key)) {
      // Toggle off — just remove, no sound
      setActiveNotes(prev => { const next = new Map(prev); next.delete(key); return next; });
      return;
    }

    playGuitarNote(note.frequency, stringIndex);
    setLastPlayed({ noteName: note.noteName, freq: note.frequency });
    setActiveNotes(prev => {
      const next = new Map(prev);
      next.set(key, { noteName: note.noteName, frequency: note.frequency });
      return next;
    });
    if (playMode === 'auto') {
      setTimeout(() => {
        setActiveNotes(prev => { const next = new Map(prev); next.delete(key); return next; });
      }, 1800);
    }
  }, [playMode, scalePattern, activeNotes, inputMode, onNoteInput]);

  const ROW_HEIGHT = 44;
  const HS_W = 88;    // headstock width
  const NUT_W = 10;   // nut width
  const FRET_BASE = 54;
  const TOTAL_STRINGS = DISPLAY_STRINGS.length;
  const BOARD_H = TOTAL_STRINGS * ROW_HEIGHT;

  // Fretboard: ebony-style dark wood
  // Headstock: satin natural maple — Taylor modern style

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" as const }}>
        {/* Input mode badge */}
        {inputMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: 'rgba(200,153,26,0.18)', border: '1px solid rgba(200,153,26,0.45)', color: '#c8991a', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8991a', display: 'inline-block', animation: 'pulse 1s infinite' }} />
            Nhập nốt nhạc
          </div>
        )}
        {/* Mode toggle */}
        <div style={{ display:"flex", alignItems:"center", borderRadius:20, border:`1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`, overflow:"hidden", background:t.toolbarBg }}>
          {(['auto', 'persist', 'scale'] as const).map((m) => {
            const labels = { auto: 'Tự tắt', persist: 'Giữ nốt', scale: 'Tạo Scale' };
            const isCurrent = playMode === m || (m === 'scale' && playMode === 'playScale');
            const activeBg = m === 'scale' ? '#16a34a' : '#3a8cff';
            return (
              <button
                key={m}
                onClick={() => {
                  setPlayMode(m);
                  setActiveNotes(new Map());
                  if (m !== 'scale') { setScalePattern(new Map()); setActiveScaleId(null); }
                }}
                style={{ padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer", border:"none", transition:"all 0.2s",
                  background: isCurrent ? activeBg : "transparent",
                  color: isCurrent ? "#fff" : t.textMuted2,
                  borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}
              >
                {labels[m]}
              </button>
            );
          })}
        </div>

        {/* Sharp / Flat toggle */}
        <div style={{ display:"flex", alignItems:"center", borderRadius:20, border:`1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`, overflow:"hidden", background:t.toolbarBg }}>
          {(['sharp', 'flat'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setAccidental(mode)}
              style={{ padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer", border:"none", transition:"all 0.2s",
                background: accidental === mode ? "#3a8cff" : "transparent",
                color: accidental === mode ? "#fff" : t.textMuted2,
                borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}
            >
              {mode === 'sharp' ? '# Thăng' : 'b Giáng'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowNotes(v => !v)}
          style={{ padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.2s",
            background: showNotes ? "#c8a84b" : "transparent",
            border: `1px solid ${showNotes ? "#c8a84b" : "rgba(200,168,75,0.6)"}`,
            color: showNotes ? "#1a1208" : "#c8a84b" }}
        >
          {showNotes ? 'Ẩn tên nốt' : 'Hiện tên nốt'}
        </button>
        <button
          onClick={() => { setActiveNotes(new Map()); if (playMode !== 'playScale') setScalePattern(new Map()); }}
          style={{ padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.2s",
            background:"transparent",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`,
            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }}
        >
          Xóa tất cả
        </button>

        {/* Save scale button — only in scale edit mode */}
        {playMode === 'scale' && scalePattern.size > 0 && (
          <div className="flex items-center gap-2">
            {showSaveInput ? (
              <>
                <input
                  autoFocus
                  value={saveNameInput}
                  onChange={e => setSaveNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveScale(); if (e.key === 'Escape') setShowSaveInput(false); }}
                  placeholder="Tên scale..."
                  className={`px-3 py-1.5 rounded-full text-sm ${t.inputBg} border border-emerald-500/50 outline-none focus:border-emerald-400 w-36 transition-colors`}
                  style={{ color: t.textMain }}
                />
                <button onClick={saveScale} className="px-4 py-1.5 rounded-full text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors">
                  Lưu
                </button>
                <button onClick={() => setShowSaveInput(false)} className={`px-3 py-1.5 rounded-full text-sm transition-colors ${t.textMuted}`}>
                  Hủy
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="px-4 py-2 rounded-full text-sm font-semibold border border-emerald-500/60 text-emerald-500 hover:bg-emerald-500/15 transition-all duration-200 flex items-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Lưu Scale
              </button>
            )}
          </div>
        )}

        {playMode === 'scale' && (
          <span className="text-xs text-emerald-500/70 font-medium tracking-wide">
            Click nốt để đặt / bỏ &bull; Di chuột để xem tên
          </span>
        )}
        {playMode === 'playScale' && (
          <span className="text-xs text-sky-500/70 font-medium tracking-wide">
            Chỉ các nốt trong scale mới phát âm
          </span>
        )}

        {lastPlayed && (
          <div className={`ml-auto flex items-center gap-2.5 ${t.lastPlayedBg} rounded-full px-4 py-2`}>
            <span className="text-xs tracking-wide uppercase" style={{ color: t.textMuted2 }}>Nốt</span>
            <span
              className="font-bold text-sm px-3 py-0.5 rounded-full text-white"
              style={{ backgroundColor: NOTE_COLOR_MAP[lastPlayed.noteName] ?? '#6B7280' }}
            >
              {lastPlayed.noteName}
            </span>
            <span className="text-xs font-mono" style={{ color: t.textMuted3 }}>{lastPlayed.freq.toFixed(1)} Hz</span>
          </div>
        )}
      </div>

      {/* Saved Scales Panel */}
      {savedScales.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2 items-center">
          <span className={`text-xs font-medium tracking-wider uppercase mr-1 ${t.savedLabel}`}>Scales đã lưu</span>
          {savedScales.map(scale => {
            const isLoaded = activeScaleId === scale.id;
            const colors = [...new Set(Object.values(scale.pattern))].slice(0, 8);
            return (
              <div
                key={scale.id}
                className={`flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 border transition-all duration-200 group ${
                  isLoaded ? t.scalePanelLoaded : t.scalePanelBorder
                }`}
              >
                {/* Color swatches */}
                <div className="flex items-center gap-0.5 ml-0.5">
                  {colors.map((c, i) => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}88` }} />
                  ))}
                </div>
                <button
                  onClick={() => isLoaded && playMode === 'playScale' ? (setPlayMode('scale'), setActiveScaleId(null)) : loadScale(scale)}
                  className={`text-sm font-semibold transition-colors px-1 ${isLoaded ? 'text-sky-500' : t.scaleText}`}
                >
                  {scale.name}
                </button>
                {isLoaded && (
                  <span className="text-[10px] font-bold text-sky-400/80 tracking-wide uppercase">
                    {playMode === 'playScale' ? 'Đang chơi' : 'Đang sửa'}
                  </span>
                )}
                <button
                  onClick={() => deleteScale(scale.id)}
                  className="w-4 h-4 flex items-center justify-center rounded-full text-white/20 hover:text-red-400 hover:bg-red-400/15 transition-all opacity-0 group-hover:opacity-100 ml-0.5"
                  title="Xóa scale"
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Fretboard scroll wrapper */}
      <div className="overflow-x-auto" style={{ borderRadius: 16, boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)' : '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ minWidth: 860, display: 'flex', flexDirection: 'column', position: 'relative', borderRadius: 16, overflow: 'hidden' }}>

          {/* Watermark */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.07 }}>
              <img
                src="/logo.png"
                alt=""
                style={{ width: 72, height: 72, objectFit: 'contain', filter: 'grayscale(1) brightness(3)' }}
              />
              <span style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#ffffff',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                fontFamily: 'system-ui, sans-serif',
              }}>
                Thầy Văn Anh Guitar
              </span>
            </div>
          </div>

          {/* Top fret number strip */}
          <div style={{ display: 'flex', height: isDark ? 28 : 17, background: t.topStripBg, borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ width: HS_W + NUT_W, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 16 }}>
              <span style={{ fontSize: 9, letterSpacing: '0.18em', color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 600 }}>Fret</span>
            </div>
            {Array.from({ length: NUM_FRETS }, (_, i) => i + 1).map(fret => (
              <div key={fret} style={{ flex: fretWidthPercent(fret), minWidth: FRET_BASE * 0.68, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, color: INLAY_FRETS.includes(fret) ? (isDark ? 'rgba(200,168,75,0.7)' : '#C99700') : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.45)'), fontWeight: 700, fontFamily: 'monospace' }}>{fret}</span>
              </div>
            ))}
          </div>

          {/* Body row: headstock + fretboard */}
          <div
            style={{ display: 'flex', position: 'relative', cursor: 'none' }}
            onMouseMove={handleFretboardMouseMove}
            onMouseLeave={handleFretboardMouseLeave}>

            {/* ── HEADSTOCK ── */}
            <Headstock
              hsW={HS_W}
              nutW={NUT_W}
              boardH={BOARD_H}
              rowHeight={ROW_HEIGHT}
              displayStrings={DISPLAY_STRINGS}
              activeNotes={displayActiveNotes}
              stringLabels={stringLabels}
              triggerNote={triggerNote}
              getNoteForFret={getNoteForFret}
              noteColorMap={NOTE_COLOR_MAP}
              isDark={isDark}
              accidental={accidental}
            />

            {/* ── FRETBOARD ── */}
            <div
              style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                background: isDark
                  ? 'linear-gradient(180deg, #1e1410 0%, #221610 100%)'
                  : 'linear-gradient(180deg, #f5f2ed 0%, #ede8e0 50%, #f0ece5 100%)',
                cursor: 'none',
              }}
            >
              {/* Side binding */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0, left: 0, width: 3,
                background: isDark
                  ? 'linear-gradient(180deg, #e8dfc0, #d4c898, #e8dfc0)'
                  : 'linear-gradient(180deg, #c8c0a8, #b8b098, #c8c0a8)',
                zIndex: 5, pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', top: 0, bottom: 0, right: 0, width: 3,
                background: isDark
                  ? 'linear-gradient(180deg, #d8cf98, #c8bf80, #d8cf98)'
                  : 'linear-gradient(180deg, #b8b098, #a8a088, #b8b098)',
                zIndex: 5, pointerEvents: 'none',
              }} />

              {/* Wood grain overlay */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} preserveAspectRatio="none">
                {[0.08,0.19,0.27,0.35,0.44,0.53,0.61,0.70,0.79,0.88,0.95].map((p, i) => (
                  <line key={i}
                    x1="0" y1={`${p * 100}%`} x2="100%" y2={`${p * 100}%`}
                    stroke={isDark
                      ? (i % 4 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.012)')
                      : (i % 4 === 0 ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.02)')}
                    strokeWidth={i % 4 === 0 ? 1.2 : 0.8}
                  />
                ))}
              </svg>

              {/* Inlay dots layer */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none', zIndex: 3 }}>
                {Array.from({ length: NUM_FRETS }, (_, i) => i + 1).map(fret => (
                  <div key={fret} style={{ flex: fretWidthPercent(fret), minWidth: FRET_BASE * 0.68, position: 'relative' }}>
                    {INLAY_FRETS.includes(fret) && !DOUBLE_INLAY.includes(fret) && (
                      isDark
                        ? <AbaloneInlay style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} size={13} />
                        : <SimpleInlay style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} size={13} />
                    )}
                    {DOUBLE_INLAY.includes(fret) && (
                      <>
                        {isDark
                          ? <AbaloneInlay style={{ position: 'absolute', top: '29%', left: '50%', transform: 'translate(-50%,-50%)' }} size={13} />
                          : <SimpleInlay style={{ position: 'absolute', top: '29%', left: '50%', transform: 'translate(-50%,-50%)' }} size={13} />}
                        {isDark
                          ? <AbaloneInlay style={{ position: 'absolute', top: '71%', left: '50%', transform: 'translate(-50%,-50%)' }} size={13} />
                          : <SimpleInlay style={{ position: 'absolute', top: '71%', left: '50%', transform: 'translate(-50%,-50%)' }} size={13} />}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* String rows */}
              {DISPLAY_STRINGS.map((stringIndex, row) => {
                const thickness = STRING_THICKNESS[row];
                const isWound = WOUND_ROWS.has(row);
                const baseColor = STRING_BASE_COLOR[row];

                return (
                  <div key={stringIndex} style={{ height: ROW_HEIGHT, display: 'flex', position: 'relative', alignItems: 'center', zIndex: 4 }}>
                    {/* String shadow */}
                    <div style={{
                      position: 'absolute', left: 0, right: 0,
                      height: thickness + 2,
                      top: '50%',
                      transform: `translateY(-50%) translateY(${thickness * 0.4}px)`,
                      background: isDark ? STRING_SHADOW_COLOR[row] : `rgba(0,0,0,${0.08 + row * 0.02})`,
                      filter: 'blur(1.5px)',
                      pointerEvents: 'none',
                      zIndex: 2,
                    }} />
                    {/* String itself */}
                    <div style={{
                      position: 'absolute', left: 0, right: 0,
                      height: thickness,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: isDark
                        ? (isWound
                            ? `repeating-linear-gradient(90deg, ${baseColor} 0px, #d0b878 1.5px, #a08848 3px, #c8a058 4.5px, ${baseColor} 6px)`
                            : `linear-gradient(180deg, #f0e8d0 0%, ${baseColor} 45%, #c8b878 100%)`)
                        : (isWound
                            ? `repeating-linear-gradient(90deg, #a8a098 0px, #c8c0b0 1.5px, #888078 3px, #b0a898 4.5px, #a8a098 6px)`
                            : `linear-gradient(180deg, #d8d0c0 0%, #b8b0a0 45%, #989088 100%)`),
                      boxShadow: isDark
                        ? (isWound
                            ? `0 1px 0 rgba(255,255,230,0.25), 0 ${thickness * 0.6}px ${thickness}px rgba(0,0,0,0.4)`
                            : `0 0.5px 0 rgba(255,255,230,0.4), 0 ${thickness * 0.5}px ${thickness}px rgba(0,0,0,0.3)`)
                        : `0 ${thickness * 0.4}px ${thickness}px rgba(0,0,0,0.18)`,
                      pointerEvents: 'none',
                      zIndex: 3,
                    }} />

                    {/* Fret cells */}
                    {Array.from({ length: NUM_FRETS }, (_, i) => i + 1).map(fret => {
                      const key = `${stringIndex}-${fret}`;
                      const isActive = displayActiveNotes.has(key);
                      const isInScale = scalePattern.has(key);
                      const note = getNoteForFret(stringIndex, fret, accidental);
                      const noteColor = NOTE_COLOR_MAP[note.noteName] ?? '#6B7280';
                      const scaleColor = scalePattern.get(key) ?? noteColor;
                      const isFirstFret = fret === 1;
                      const isHovered = hoveredKey === key;

                      const isPlayable = playMode !== 'playScale' || isInScale;

                      return (
                        <button
                          key={fret}
                          onClick={() => triggerNote(stringIndex, fret)}
                          onMouseEnter={() => handleFretEnter(key)}
                          onMouseLeave={handleFretLeave}
                          style={{
                            flex: fretWidthPercent(fret),
                            minWidth: FRET_BASE * 0.68,
                            height: '100%',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'none',
                            zIndex: 5,
                          }}
                          className="fret-btn"
                        >
                          {/* Fret wire — nickel-silver */}
                          {!isFirstFret && (
                            <div style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0,
                              width: 2,
                              background: isDark
                                ? 'linear-gradient(90deg, #6a6a6a 0%, #d0d0d0 25%, #e8e8e8 50%, #d0d0d0 75%, #888 100%)'
                                : 'linear-gradient(90deg, #606060 0%, #909090 25%, #b0b0b0 50%, #909090 75%, #606060 100%)',
                              boxShadow: isDark
                                ? '1px 0 3px rgba(0,0,0,0.5), -1px 0 2px rgba(255,255,255,0.08)'
                                : '1px 0 2px rgba(0,0,0,0.25)',
                              pointerEvents: 'none',
                              zIndex: 6,
                            }} />
                          )}
                          {/* Fret wire right edge */}
                          <div style={{
                            position: 'absolute', right: 0, top: 0, bottom: 0,
                            width: 2,
                            background: isDark
                              ? 'linear-gradient(90deg, #6a6a6a 0%, #d0d0d0 25%, #e8e8e8 50%, #d0d0d0 75%, #888 100%)'
                              : 'linear-gradient(90deg, #606060 0%, #909090 25%, #b0b0b0 50%, #909090 75%, #606060 100%)',
                            boxShadow: isDark
                              ? '1px 0 3px rgba(0,0,0,0.5), -1px 0 2px rgba(255,255,255,0.08)'
                              : '1px 0 2px rgba(0,0,0,0.25)',
                            pointerEvents: 'none',
                            zIndex: 6,
                          }} />

                          {/* ── Scale editor dot (always visible when in scale) ── */}
                          {playMode === 'scale' && isInScale && (
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: `radial-gradient(circle at 38% 32%, ${scaleColor}ff, ${scaleColor}aa)`,
                              boxShadow: `0 0 0 2px ${scaleColor}55, 0 2px 10px ${scaleColor}88`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, position: 'relative', zIndex: 8,
                              animation: 'pop 0.15s ease-out',
                            }}>
                              <div style={{
                                position: 'absolute', top: 5, left: 6, width: 8, height: 5,
                                borderRadius: '50%', background: 'rgba(255,255,255,0.28)',
                                transform: 'rotate(-18deg)', pointerEvents: 'none',
                              }} />
                              {isHovered && (
                                <span style={{
                                  color: '#fff', fontWeight: 800,
                                  fontSize: note.noteName.length > 2 ? 9 : 11,
                                  lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                                  position: 'relative', zIndex: 9,
                                }}>
                                  {note.noteName}
                                </span>
                              )}
                            </div>
                          )}

                          {/* ── Play Scale: scale dot always visible, brighter on hover ── */}
                          {playMode === 'playScale' && isInScale && !isActive && (
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: isHovered
                                ? `radial-gradient(circle at 38% 32%, ${scaleColor}ff, ${scaleColor}cc)`
                                : `radial-gradient(circle at 38% 32%, ${scaleColor}88, ${scaleColor}44)`,
                              boxShadow: isHovered
                                ? `0 0 0 2px ${scaleColor}88, 0 2px 12px ${scaleColor}aa`
                                : `0 0 0 1.5px ${scaleColor}44, 0 1px 5px ${scaleColor}33`,
                              border: isHovered ? 'none' : `1.5px solid ${scaleColor}55`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, position: 'relative', zIndex: 8,
                              transition: 'background 0.12s, box-shadow 0.12s',
                            }}>
                              <div style={{
                                position: 'absolute', top: 4, left: 6, width: 7, height: 4,
                                borderRadius: '50%', background: 'rgba(255,255,255,0.22)',
                                transform: 'rotate(-18deg)', pointerEvents: 'none',
                              }} />
                              {isHovered && (
                                <span style={{
                                  color: '#fff', fontWeight: 800,
                                  fontSize: note.noteName.length > 2 ? 9 : 11,
                                  lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                                  position: 'relative', zIndex: 9,
                                }}>
                                  {note.noteName}
                                </span>
                              )}
                            </div>
                          )}

                          {/* ── Active note dot (triggered — big bright dot with name) ── */}
                          {playMode !== 'scale' && isActive && (
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%',
                              background: `radial-gradient(circle at 38% 32%, ${noteColor}ff, ${noteColor}cc)`,
                              boxShadow: `0 0 0 2px ${noteColor}44, 0 2px 14px ${noteColor}bb, 0 0 24px ${noteColor}55`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              zIndex: 10, animation: 'pop 0.15s ease-out',
                              flexShrink: 0, position: 'relative',
                            }}>
                              <div style={{
                                position: 'absolute', top: 5, left: 8, width: 10, height: 6,
                                borderRadius: '50%', background: 'rgba(255,255,255,0.32)',
                                transform: 'rotate(-18deg)', pointerEvents: 'none',
                              }} />
                              {showNotes && (
                                <span style={{
                                  color: '#fff', fontWeight: 800,
                                  fontSize: note.noteName.length > 2 ? 11 : 13,
                                  lineHeight: 1, textAlign: 'center',
                                  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                                  letterSpacing: '-0.01em', position: 'relative',
                                }}>
                                  {note.noteName}
                                </span>
                              )}
                            </div>
                          )}

                          {/* ── Hover dot — only when cell is not already active ── */}
                          {isHovered && isPlayable && !isActive && playMode !== 'scale' && playMode !== 'playScale' && (
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: `radial-gradient(circle at 38% 32%, ${noteColor}ee, ${noteColor}aa)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              zIndex: 25, flexShrink: 0, position: 'relative',
                              boxShadow: `0 0 0 2px ${noteColor}66, 0 2px 12px ${noteColor}88`,
                            }}>
                              <span style={{
                                color: '#fff', fontWeight: 800,
                                fontSize: note.noteName.length > 2 ? 11 : 13,
                                lineHeight: 1, textAlign: 'center',
                                textShadow: '0 1px 3px rgba(0,0,0,0.55)',
                                position: 'relative', zIndex: 26,
                              }}>
                                {note.noteName}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}


              {/* String dividers (subtle) */}
              {DISPLAY_STRINGS.map((_, row) =>
                row < DISPLAY_STRINGS.length - 1 ? (
                  <div key={`div-${row}`} style={{
                    position: 'absolute', left: 0, right: 0,
                    top: (row + 1) * ROW_HEIGHT,
                    height: 1,
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }} />
                ) : null
              )}
            </div>

            {/* Mouse trail canvas — spans full body row incl. headstock */}
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
                zIndex: 30,
              }}
              width={NUM_FRETS * FRET_BASE}
              height={BOARD_H}
            />
          </div>

          {/* Bottom fret marker strip */}
          <div style={{ display: 'flex', height: isDark ? 24 : 14, background: t.topStripBg, borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ width: HS_W + NUT_W, flexShrink: 0 }} />
            {Array.from({ length: NUM_FRETS }, (_, i) => i + 1).map(fret => (
              <div key={fret} style={{ flex: fretWidthPercent(fret), minWidth: FRET_BASE * 0.68, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {INLAY_FRETS.includes(fret) && !DOUBLE_INLAY.includes(fret) && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isDark ? 'rgba(200,168,75,0.5)' : '#C99700' }} />
                )}
                {DOUBLE_INLAY.includes(fret) && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: isDark ? 'rgba(200,168,75,0.5)' : '#C99700' }} />
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: isDark ? 'rgba(200,168,75,0.5)' : '#C99700' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Headstock component ──
interface HeadstockProps {
  hsW: number; nutW: number; boardH: number; rowHeight: number;
  displayStrings: number[];
  activeNotes: Map<string, { noteName: string; frequency: number }>;
  stringLabels: string[];
  triggerNote: (s: number, f: number) => void;
  getNoteForFret: (s: number, f: number, acc?: AccidentalMode) => { noteName: string; frequency: number };
  noteColorMap: Record<string, string>;
  isDark: boolean;
  accidental: AccidentalMode;
}

function Headstock({ hsW, nutW, boardH, rowHeight, displayStrings, activeNotes, stringLabels, triggerNote, getNoteForFret, noteColorMap, isDark, accidental }: HeadstockProps) {
  const totalW = hsW + nutW;
  const NUT_X = hsW;
  const stringY = (row: number) => row * rowHeight + rowHeight / 2;

  const W = totalW;
  const H = boardH;
  // Clean rectangular headstock — Taylor modern flat-top style
  // Slight corner radius, straight left edge
  const r = 8;
  const hsPath = [
    `M ${r} 0`,
    `L ${W} 0`,
    `L ${W} ${H}`,
    `L ${r} ${H}`,
    `Q 0 ${H} 0 ${H - r}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`,
    'Z',
  ].join(' ');

  return (
    <div style={{ width: totalW, flexShrink: 0, position: 'relative', zIndex: 10 }}>
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }}
        viewBox={`0 0 ${totalW} ${H}`}
        preserveAspectRatio="none"
      >
        <defs>
          {/* Maple — darker in dark mode, lighter/warmer in light mode */}
          <linearGradient id="hsWood" x1="0%" y1="0%" x2="100%" y2="0%">
            {isDark ? <>
              <stop offset="0%"   stopColor="#a87830" />
              <stop offset="8%"   stopColor="#c89848" />
              <stop offset="22%"  stopColor="#e0b860" />
              <stop offset="38%"  stopColor="#f0d07a" />
              <stop offset="52%"  stopColor="#f8e090" />
              <stop offset="66%"  stopColor="#f0d078" />
              <stop offset="80%"  stopColor="#d8b058" />
              <stop offset="100%" stopColor="#b07830" />
            </> : <>
              <stop offset="0%"   stopColor="#c8a060" />
              <stop offset="8%"   stopColor="#ddb870" />
              <stop offset="22%"  stopColor="#f0cc88" />
              <stop offset="38%"  stopColor="#f8dca0" />
              <stop offset="52%"  stopColor="#fce8b0" />
              <stop offset="66%"  stopColor="#f8dca0" />
              <stop offset="80%"  stopColor="#e8c888" />
              <stop offset="100%" stopColor="#c8a060" />
            </>}
          </linearGradient>
          {/* Top-down satin sheen */}
          <linearGradient id="hsSatin" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.18)" />
            <stop offset="30%"  stopColor="rgba(255,255,255,0.06)" />
            <stop offset="60%"  stopColor="rgba(0,0,0,0.0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.10)" />
          </linearGradient>
          {/* Left-edge shadow (depth) */}
          <linearGradient id="hsEdgeShadow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"  stopColor="rgba(0,0,0,0.55)" />
            <stop offset="14%" stopColor="rgba(0,0,0,0.08)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.0)" />
          </linearGradient>
          {/* Nut (TUSQ/bone) */}
          <linearGradient id="nutG" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#d8d0b0" />
            <stop offset="20%"  stopColor="#f0ead8" />
            <stop offset="55%"  stopColor="#faf6e8" />
            <stop offset="85%"  stopColor="#ece4cc" />
            <stop offset="100%" stopColor="#c8c0a0" />
          </linearGradient>
          <clipPath id="hsClip">
            <path d={hsPath} />
          </clipPath>
        </defs>

        {/* Wood fill */}
        <path d={hsPath} fill="url(#hsWood)" />

        {/* Wood grain lines — horizontal, clipped to shape */}
        <g clipPath="url(#hsClip)">
          {[0.035,0.075,0.115,0.155,0.20,0.245,0.29,0.335,0.38,0.425,0.47,0.515,0.56,0.605,0.65,0.695,0.74,0.785,0.83,0.875,0.92,0.96].map((p, i) => {
            const y = p * H;
            const op = i % 7 === 0 ? 0.18 : i % 3 === 0 ? 0.10 : 0.05;
            return <line key={i} x1="2" y1={y} x2={hsW} y2={y} stroke={`rgba(100,55,8,${op})`} strokeWidth={i % 7 === 0 ? 1.2 : 0.75} />;
          })}
          {/* Flame figure — diagonal shimmer stripes */}
          {[0.18, 0.38, 0.58, 0.78].map((p, i) => {
            const cy = p * H;
            return (
              <path key={i}
                d={`M 4 ${cy - 8} Q ${hsW * 0.25} ${cy + 10} ${hsW * 0.55} ${cy - 5} Q ${hsW * 0.78} ${cy + 7} ${hsW - 2} ${cy + 1}`}
                fill="none" stroke="rgba(170,95,18,0.065)" strokeWidth={7}
              />
            );
          })}
        </g>

        {/* Satin sheen */}
        <path d={hsPath} fill="url(#hsSatin)" />
        {/* Left edge depth shadow */}
        <path d={hsPath} fill="url(#hsEdgeShadow)" />

        {/* Headstock outline stroke */}
        <path d={hsPath} fill="none" stroke="rgba(60,35,5,0.55)" strokeWidth={1.2} />

        {/* ── NUT ── */}
        <rect x={NUT_X} y={0} width={nutW} height={H} fill="url(#nutG)" />
        <line x1={NUT_X + 1} y1={0} x2={NUT_X + 1} y2={H} stroke="rgba(255,255,255,0.4)" strokeWidth={1.2} />
        <line x1={NUT_X} y1={0} x2={NUT_X} y2={H} stroke="rgba(100,70,20,0.5)" strokeWidth={1} />
        <line x1={NUT_X + nutW} y1={0} x2={NUT_X + nutW} y2={H} stroke="rgba(0,0,0,0.75)" strokeWidth={3} />
        {/* Nut string slots */}
        {displayStrings.map((_, row) => {
          const y = stringY(row);
          return <line key={row} x1={NUT_X} y1={y} x2={NUT_X + nutW} y2={y} stroke="rgba(80,60,20,0.35)" strokeWidth={1} />;
        })}
      </svg>

      {/* ── Open string buttons ── */}
      {displayStrings.map((stringIndex, row) => {
        const isActive = activeNotes.has(`${stringIndex}-0`);
        const noteColor = noteColorMap[getNoteForFret(stringIndex, 0, accidental).noteName] ?? '#c8a84b';
        const label = stringLabels[stringIndex];
        return (
          <button
            key={stringIndex}
            onClick={() => triggerNote(stringIndex, 0)}
            title={`Dây buông ${label}`}
            className="open-string-btn"
            style={{
              position: 'absolute',
              right: nutW + 3,
              top: row * rowHeight,
              height: rowHeight,
              width: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              background: 'transparent',
              border: 'none',
              cursor: 'none',
              zIndex: 20,
              padding: 0,
            }}
          >
            {isActive ? (
              <div style={{
                width: 34, height: 34,
                borderRadius: '50%',
                background: `radial-gradient(circle at 38% 35%, ${noteColor}ee, ${noteColor}bb)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 0 2px ${noteColor}55, 0 0 16px ${noteColor}88, 0 2px 6px rgba(0,0,0,0.4)`,
                animation: 'pop 0.15s ease-out',
                flexShrink: 0, position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: 5, left: 7, width: 9, height: 5,
                  borderRadius: '50%', background: 'rgba(255,255,255,0.3)',
                  transform: 'rotate(-20deg)',
                }} />
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: '-0.01em', position: 'relative' }}>
                  {label}
                </span>
              </div>
            ) : (
              <div className="open-string-idle" style={{
                width: 34, height: 34,
                borderRadius: '50%',
                border: isDark ? `2px solid rgba(255,255,255,0.45)` : `2px solid rgba(0,0,0,0.35)`,
                background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                boxShadow: isDark ? '0 1px 5px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.12)',
              }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isDark ? 'rgba(255,255,255,0.97)' : 'rgba(0,0,0,0.75)',
                  letterSpacing: '0.01em',
                  lineHeight: 1,
                  textShadow: isDark ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
                }}>
                  {label}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Abalone / shell inlay dot component
function AbaloneInlay({ style, size }: { style: React.CSSProperties; size: number }) {
  const id = `ab-${size}`;
  return (
    <div style={{ ...style, width: size, height: size, borderRadius: '50%', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.2)' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id={`${id}-rg`} cx="40%" cy="35%" r="70%">
            <stop offset="0%"   stopColor="#e8f4f0" />
            <stop offset="20%"  stopColor="#b8e0d8" />
            <stop offset="40%"  stopColor="#78c8c0" />
            <stop offset="55%"  stopColor="#48a8b8" />
            <stop offset="70%"  stopColor="#7890c0" />
            <stop offset="85%"  stopColor="#a070a8" />
            <stop offset="100%" stopColor="#c09880" />
          </radialGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id}-rg)`} />
        {/* Iridescent shimmer lines */}
        <line x1={size * 0.15} y1={size * 0.35} x2={size * 0.85} y2={size * 0.65} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
        <line x1={size * 0.2} y1={size * 0.55} x2={size * 0.75} y2={size * 0.3} stroke="rgba(180,240,230,0.25)" strokeWidth={0.8} />
        <circle cx={size / 2} cy={size / 2} r={size / 2} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.8} />
        {/* Highlight */}
        <circle cx={size * 0.38} cy={size * 0.35} r={size * 0.18} fill="rgba(255,255,255,0.22)" />
      </svg>
    </div>
  );
}

// Simple grey inlay dot for light mode
function SimpleInlay({ style, size }: { style: React.CSSProperties; size: number }) {
  return (
    <div style={{
      ...style,
      width: size, height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 38% 35%, #a0a0a0, #707070)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.15)',
    }} />
  );
}
