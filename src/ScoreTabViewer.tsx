import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { Theme } from './GuitarBoard';
import { SCORE_BPM, SCORE_BEATS_PER_MEASURE, staffStep } from './scoreData';
import type { ScoreNote } from './scoreData';
import { getNoteForFret } from './guitarNotes';

// ─── Layout (single unified canvas) ──────────────────────────────────────────
const SLG        = 14;          // staff line gap
const STAFF_H    = SLG * 4;    // 48px (5 lines)
const STAFF_TOP  = 50;          // from canvas top to first staff line
const STAFF_BOT  = STAFF_TOP + STAFF_H;

const TSG        = 18;          // TAB string gap
const TAB_STRINGS = 6;
const TAB_TOP    = STAFF_BOT + 42;   // khoảng cách staff-TAB
const TAB_BOT    = TAB_TOP + (TAB_STRINGS - 1) * TSG;

const CANVAS_H   = TAB_BOT + 28;    // total canvas height

const RULER_H    = 22;
const CLEF_W     = 42;
const TSIG_W     = 22;
const HEADER_W   = CLEF_W + TSIG_W;
const BEAT_W     = 96;          // px per beat
const BAR_PAD    = 28;          // khoảng hở sau vạch nhịp

// Treble clef bottom line = E4 = diatonic step 2 from C4
const TREBLE_BOT = 2;
const NHX = 7, NHY = 5;        // notehead radii
const STEM_LEN   = SLG * 3.5;

// Duration palette (beats at BPM)
const DURATIONS: { beats: number; label: string; symbol: string; key: string }[] = [
  { beats: 4,    label: 'Tròn',        symbol: '𝅝',  key: '7' },
  { beats: 2,    label: 'Trắng',       symbol: '𝅗𝅥',  key: '6' },
  { beats: 1,    label: 'Đen',         symbol: '♩',  key: '5' },
  { beats: 0.5,  label: 'Móc đơn',    symbol: '♪',  key: '4' },
  { beats: 0.25, label: 'Móc đôi',    symbol: '𝅘𝅥𝅯',  key: '3' },
];
// Dotted multiplier = 1.5
const DOTTED_BEATS = DURATIONS.map(d => ({ ...d, beats: d.beats * 1.5, label: d.label + '.', symbol: d.symbol + '.', key: '' }));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const spb = () => 60 / SCORE_BPM;

function semY(step: number) {
  return STAFF_TOP + STAFF_H - ((step - TREBLE_BOT) * SLG) / 2;
}
function noteY(pitch: string, oct: number) { return semY(staffStep(pitch, oct)); }
function barlineX(m: number) {
  return HEADER_W + m * (BAR_PAD + SCORE_BEATS_PER_MEASURE * BEAT_W);
}
function noteX(time: number) {
  const beatPos    = time / spb();
  const bar        = Math.floor(beatPos / SCORE_BEATS_PER_MEASURE);
  const beatInBar  = beatPos % SCORE_BEATS_PER_MEASURE;
  // Nốt = vạch nhịp trước + khoảng hở + vị trí trong nhịp
  return barlineX(bar) + BAR_PAD + beatInBar * BEAT_W;
}
function tabStrY(str: number) {
  // str: 0=low E … 5=high E  →  display row 0=high E at top
  return TAB_TOP + (5 - str) * TSG;
}
function totalCanvasW(dur: number) { return noteX(dur) + 140; }
function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}
function beatsToSec(b: number) { return b * spb(); }
function tripletDur(beats: number) { return beatsToSec(beats * 2 / 3); }
function accChar(p: string) {
  if (p.includes('#')) return '♯';
  if (p !== 'Si' && p.endsWith('b')) return '♭';
  return null;
}

const STRING_SHORT = ['E', 'A', 'D', 'G', 'B', 'e'];
const STRING_LABELS = ['E2 · Dây 6', 'A2 · Dây 5', 'D3 · Dây 4', 'G3 · Dây 3', 'B3 · Dây 2', 'E4 · Dây 1'];

// ─── Props ────────────────────────────────────────────────────────────────────
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

// ─── Component ───────────────────────────────────────────────────────────────
export default function ScoreTabViewer({
  theme, currentTime, isPlaying, onPlay, onPause, onStop,
  activeNoteIds, notes, totalDuration, onNotesChange, onRequestNoteInput,
}: Props) {
  const isDark = theme === 'dark';

  // ── State ───────────────────────────────────────────────────────────────────
  // cursorIdx: note index the cursor is AT (cursor is BEFORE this note)
  const [cursorIdx, setCursorIdx]     = useState(notes.length);
  const [selIdx, setSelIdx]           = useState<number | null>(null);
  const [durBeats, setDurBeats]       = useState(1);
  const [dotted, setDotted]           = useState(false);
  const [triplet, setTriplet]         = useState(false);
  const [fretBuf, setFretBuf]         = useState('');   // digit buffer while typing
  const [pendingStr, setPendingStr]   = useState(3);    // active TAB string
  const [focused, setFocused]         = useState(false);

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rulerRef    = useRef<HTMLCanvasElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitNoteRef = useRef<(str: number, fret: number) => void>(() => {});
  const pendingStrRef = useRef(3);

  const W = totalCanvasW(totalDuration);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const barlineXs = useMemo(() => {
    const xs: number[] = [];
    const bars = Math.ceil(totalDuration / (spb() * SCORE_BEATS_PER_MEASURE));
    for (let m = 0; m <= bars; m++) xs.push(barlineX(m));
    return xs;
  }, [totalDuration]);

  // X position of the cursor (= start time of next note to insert)
  const cursorTime = useMemo(() => {
    // Nếu đang select nốt → cursor tại đầu nốt đó
    if (selIdx !== null && selIdx < notes.length) return notes[selIdx].time;
    if (cursorIdx <= 0 || notes.length === 0) return 0;
    const i = Math.min(cursorIdx - 1, notes.length - 1);
    return notes[i].time + notes[i].duration;
  }, [notes, cursorIdx, selIdx]);

  // Effective duration of next note
  const effectiveDur = useMemo(() => {
    const base = dotted ? durBeats * 1.5 : durBeats;
    return triplet ? tripletDur(durBeats) : beatsToSec(base);
  }, [durBeats, dotted, triplet]);

  // ── Commit note ─────────────────────────────────────────────────────────────
  const commitNote = useCallback((str: number, fret: number) => {
    const nf  = getNoteForFret(str, fret, 'sharp');
    const t   = cursorTime;
    const sec = spb();
    const newNote: ScoreNote = {
      id: `n${Date.now()}-${Math.random().toString(36).slice(2)}`,
      time: t,
      duration: effectiveDur,
      string: str,
      fret,
      pitch: nf.noteName,
      octave: nf.octave,
      measure: Math.floor(t / (sec * SCORE_BEATS_PER_MEASURE)) + 1,
      beat: ((t / sec) % SCORE_BEATS_PER_MEASURE) + 1,
    };
    const next = [...notes.slice(0, cursorIdx), newNote, ...notes.slice(cursorIdx)];
    onNotesChange(next);
    setCursorIdx(cursorIdx + 1);
    setSelIdx(cursorIdx);
    setFretBuf('');
  }, [notes, cursorIdx, cursorTime, effectiveDur, onNotesChange]);

  // Sync refs để dùng trong setTimeout
  useEffect(() => { commitNoteRef.current = commitNote; }, [commitNote]);
  useEffect(() => { pendingStrRef.current = pendingStr; }, [pendingStr]);

  // Expose to parent for fretboard input
  useEffect(() => {
    onRequestNoteInput?.((str, fret) => commitNote(str, fret));
  }, [onRequestNoteInput, commitNote]);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const k = e.key;

    // +/- đổi trường độ nốt đang chọn; nếu không có nốt chọn thì đổi durBeats
    if (k === '+' || k === '=') {
      e.preventDefault();
      if (selIdx !== null && selIdx < notes.length) {
        const curBeats = notes[selIdx].duration / spb();
        const idx = DURATIONS.findIndex(d => Math.abs(d.beats - curBeats) < 0.01);
        if (idx > 0) onNotesChange(notes.map((n, i) => i === selIdx ? { ...n, duration: beatsToSec(DURATIONS[idx - 1].beats) } : n));
      } else {
        const idx = DURATIONS.findIndex(d => d.beats === durBeats);
        if (idx > 0) setDurBeats(DURATIONS[idx - 1].beats);
      }
      return;
    }
    if (k === '-') {
      e.preventDefault();
      if (selIdx !== null && selIdx < notes.length) {
        const curBeats = notes[selIdx].duration / spb();
        const idx = DURATIONS.findIndex(d => Math.abs(d.beats - curBeats) < 0.01);
        if (idx < DURATIONS.length - 1) onNotesChange(notes.map((n, i) => i === selIdx ? { ...n, duration: beatsToSec(DURATIONS[idx + 1].beats) } : n));
      } else {
        const idx = DURATIONS.findIndex(d => d.beats === durBeats);
        if (idx < DURATIONS.length - 1) setDurBeats(DURATIONS[idx + 1].beats);
      }
      return;
    }

    // . → dotted
    if (k === '.') { e.preventDefault(); setDotted(v => !v); return; }
    // / → triplet
    if (k === '/') { e.preventDefault(); setTriplet(v => !v); return; }

    // Navigation — mũi tên trái/phải: di chuyển cursor
    if (k === 'ArrowLeft') {
      e.preventDefault();
      if (digitTimerRef.current) { clearTimeout(digitTimerRef.current); setFretBuf(''); }
      setCursorIdx(c => Math.max(0, c - 1));
      setSelIdx(null);
      setFretBuf('');
      return;
    }
    if (k === 'ArrowRight') {
      e.preventDefault();
      if (digitTimerRef.current) { clearTimeout(digitTimerRef.current); setFretBuf(''); }
      setCursorIdx(c => Math.min(notes.length, c + 1));
      setSelIdx(null);
      setFretBuf('');
      return;
    }
    // Mũi tên lên/xuống: đổi dây đàn
    if (k === 'ArrowUp') {
      e.preventDefault();
      setPendingStr(s => { const ns = Math.min(5, s + 1); pendingStrRef.current = ns; return ns; });
      return;
    }
    if (k === 'ArrowDown') {
      e.preventDefault();
      setPendingStr(s => { const ns = Math.max(0, s - 1); pendingStrRef.current = ns; return ns; });
      return;
    }

    // Delete / Backspace
    if (k === 'Backspace' || k === 'Delete') {
      e.preventDefault();
      if (fretBuf) { setFretBuf(b => b.slice(0, -1)); return; }
      const di = k === 'Delete' ? (selIdx ?? cursorIdx - 1) : cursorIdx - 1;
      if (di < 0 || di >= notes.length) return;
      const next = notes.filter((_, i) => i !== di);
      onNotesChange(next);
      setCursorIdx(Math.max(0, di));
      setSelIdx(null);
      return;
    }

    // Digit input — Guitar Pro style: số đơn tự commit sau 400ms, số đôi commit ngay
    if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      const buf = fretBuf + k;
      const fret = parseInt(buf, 10);

      if (digitTimerRef.current) clearTimeout(digitTimerRef.current);

      if (buf.length === 1) {
        if (fret === 0) {
          // Phím 0 = dây buông → commit ngay
          commitNoteRef.current(pendingStrRef.current, 0);
          setFretBuf('');
          return;
        }
        setFretBuf(buf);
        // Tự commit sau 400ms nếu không có số thứ 2
        digitTimerRef.current = setTimeout(() => {
          commitNoteRef.current(pendingStrRef.current, parseInt(buf, 10));
          setFretBuf('');
        }, 400);
      } else {
        // 2 chữ số
        if (fret <= 24) {
          commitNoteRef.current(pendingStrRef.current, fret);
          setFretBuf('');
        } else {
          // Không hợp lệ: commit chữ số đầu, bắt đầu buffer mới
          commitNoteRef.current(pendingStrRef.current, parseInt(fretBuf, 10));
          setFretBuf(k);
          digitTimerRef.current = setTimeout(() => {
            commitNoteRef.current(pendingStrRef.current, parseInt(k, 10));
            setFretBuf('');
          }, 400);
        }
      }
      return;
    }

    // Enter → confirm pending buffer ngay
    if (k === 'Enter') {
      e.preventDefault();
      if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
      if (fretBuf !== '') {
        commitNoteRef.current(pendingStrRef.current, parseInt(fretBuf, 10));
        setFretBuf('');
      }
      return;
    }

    // R → dấu lặng (rest): chèn nốt lặng vào vị trí con trỏ
    if (k === 'r' || k === 'R') {
      e.preventDefault();
      const t   = cursorTime;
      const sec = spb();
      const rest: ScoreNote = {
        id: `r${Date.now()}-${Math.random().toString(36).slice(2)}`,
        time: t,
        duration: effectiveDur,
        string: -1,      // -1 = rest
        fret: -1,
        pitch: 'R',
        octave: 0,
        measure: Math.floor(t / (sec * SCORE_BEATS_PER_MEASURE)) + 1,
        beat: ((t / sec) % SCORE_BEATS_PER_MEASURE) + 1,
      };
      const next = [...notes.slice(0, cursorIdx), rest, ...notes.slice(cursorIdx)];
      onNotesChange(next);
      setCursorIdx(cursorIdx + 1);
      setSelIdx(cursorIdx);
      return;
    }

    // Space → play/pause
    if (k === ' ') { e.preventDefault(); isPlaying ? onPause() : onPlay(); return; }

    // Shift+1-6 → chọn dây nhanh
    if (e.shiftKey && /^[1-6]$/.test(k)) {
      e.preventDefault();
      const ns = 6 - parseInt(k, 10);
      setPendingStr(ns);
      pendingStrRef.current = ns;
      return;
    }
  }, [notes, cursorIdx, durBeats, fretBuf, selIdx, pendingStr, isPlaying, onPlay, onPause, onNotesChange, commitNote]);

  // ── Draw unified canvas ───────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const w = c.width;

    // Background
    ctx.fillStyle = '#faf9f5';
    ctx.fillRect(0, 0, w, CANVAS_H);

    // ── Guitar Pro-style cursor block ──────────────────────────────────────────
    if (focused) {
      const cx = noteX(cursorTime);
      const cw = BEAT_W * (dotted ? durBeats * 1.5 : durBeats) - 2;

      // Cursor column chỉ ở TAB area
      ctx.fillStyle = 'rgba(30,100,220,0.08)';
      ctx.fillRect(cx - 2, TAB_TOP - 4, Math.max(cw, 16), TAB_BOT - TAB_TOP + 8);

      // Đường kẻ dọc mỏng xuyên suốt staff+TAB
      ctx.fillStyle = 'rgba(30,100,220,0.4)';
      ctx.fillRect(cx - 1, STAFF_TOP - 6, 2, TAB_BOT - STAFF_TOP + 12);

      // Cursor cell on active TAB string
      const strY = tabStrY(pendingStr);
      ctx.fillStyle = 'rgba(30,100,220,0.18)';
      ctx.beginPath();
      ctx.roundRect(cx - 8, strY - 7, 18, 14, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,100,220,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Ghost fret number in buffer
      if (fretBuf) {
        ctx.fillStyle = '#1e64dc';
        ctx.font = 'bold 11px system-ui, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(fretBuf, cx + 1, strY);
      }
    }

    // ── Staff lines ────────────────────────────────────────────────────────────
    for (let i = 0; i < 5; i++) {
      const y = STAFF_TOP + i * SLG;
      ctx.strokeStyle = '#7a7268';
      ctx.lineWidth = i === 0 || i === 4 ? 1.8 : 1.2;
      ctx.beginPath(); ctx.moveTo(CLEF_W - 4, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Treble clef
    ctx.save();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `${STAFF_H + 36}px "Times New Roman", Georgia, serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('𝄞', 2, STAFF_TOP + STAFF_H + 10);
    ctx.restore();

    // Time signature
    ctx.save();
    ctx.fillStyle = '#222';
    ctx.font = `bold ${SLG * 2 + 2}px "Times New Roman", Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const tx = CLEF_W + TSIG_W / 2;
    ctx.fillText('4', tx, STAFF_TOP + SLG * 2 + 1);
    ctx.fillText('4', tx, STAFF_TOP + SLG * 4 + 2);
    ctx.restore();

    // ── Đường phân cách staff / TAB ─────────────────────────────────────────────
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(CLEF_W, TAB_TOP - 14);
    ctx.lineTo(w, TAB_TOP - 14);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── TAB lines ──────────────────────────────────────────────────────────────
    for (let s = 0; s < TAB_STRINGS; s++) {
      const y = TAB_TOP + s * TSG;
      const isActive = s === (5 - pendingStr);
      ctx.strokeStyle = focused && isActive ? 'rgba(30,100,220,0.7)' : '#8a847a';
      ctx.lineWidth   = focused && isActive ? 1.6 : 1.1;
      ctx.beginPath(); ctx.moveTo(CLEF_W, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // TAB label
    ctx.save();
    ctx.fillStyle = '#666'; ctx.font = 'bold 11px "Times New Roman", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tabMid = (TAB_TOP + TAB_BOT) / 2;
    ['T','A','B'].forEach((ch, i) => ctx.fillText(ch, CLEF_W / 2, tabMid - 11 + i * 11));
    ctx.restore();

    // String labels (left of TAB)
    ctx.fillStyle = '#aaa'; ctx.font = '8px system-ui'; ctx.textAlign = 'right';
    for (let s = 0; s < 6; s++) {
      ctx.fillStyle = focused && s === pendingStr ? 'rgba(30,100,220,0.7)' : '#aaa';
      ctx.fillText(STRING_SHORT[s], CLEF_W - 5, tabStrY(s) + 3);
    }

    // ── Barlines ───────────────────────────────────────────────────────────────
    barlineXs.forEach(x => {
      ctx.strokeStyle = '#555'; ctx.lineWidth = 2.0;
      ctx.beginPath(); ctx.moveTo(x, STAFF_TOP); ctx.lineTo(x, STAFF_BOT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, TAB_TOP - 2); ctx.lineTo(x, TAB_BOT + 2); ctx.stroke();
    });

    // ── Notes ──────────────────────────────────────────────────────────────────
    for (let ni = 0; ni < notes.length; ni++) {
      const note = notes[ni];
      const isAct = activeNoteIds.has(note.id);
      const isSel = ni === selIdx;
      const x = noteX(note.time);

      // Selection / active highlight
      if (isSel) {
        // Highlight nhạc nhẹ
        ctx.fillStyle = 'rgba(30,100,220,0.07)';
        ctx.fillRect(x - 14, STAFF_TOP - 4, 28, STAFF_H + 8);
        // Highlight TAB đậm hơn
        ctx.fillStyle = 'rgba(30,100,220,0.14)';
        ctx.fillRect(x - 14, TAB_TOP - 4, 28, TAB_BOT - TAB_TOP + 8);
        // Đường dọc xanh
        ctx.fillStyle = 'rgba(30,100,220,0.6)';
        ctx.fillRect(x - 1, STAFF_TOP - 4, 2, TAB_BOT - STAFF_TOP + 8);
      } else if (isAct) {
        ctx.fillStyle = 'rgba(200,153,26,0.1)';
        ctx.fillRect(x - 14, STAFF_TOP - 4, 28, TAB_BOT - STAFF_TOP + 8);
      }

      // ── Dấu lặng (rest) ──────────────────────────────────────────────────────
      if (note.string === -1) {
        const rx = x;
        const ry = STAFF_TOP + SLG * 1.5;
        const rf = isAct ? '#c8991a' : isSel ? '#1e64dc' : '#555';
        ctx.fillStyle = rf;
        ctx.font = `bold ${SLG * 2 + 4}px "Times New Roman", serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // Ký hiệu lặng theo trường độ
        const restSym =
          note.duration >= beatsToSec(4)   ? '𝄻' :
          note.duration >= beatsToSec(2)   ? '𝄼' :
          note.duration >= beatsToSec(1)   ? '𝄽' :
          note.duration >= beatsToSec(0.5) ? '𝄾' : '𝄿';
        ctx.fillText(restSym, rx, ry);
        // TAB: dấu gạch ngang
        const ty2 = tabStrY(3);
        ctx.strokeStyle = rf; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(rx - 8, ty2); ctx.lineTo(rx + 8, ty2); ctx.stroke();
        continue;
      }

      // ── Staff note ───────────────────────────────────────────────────────────
      const y    = noteY(note.pitch, note.octave + 1);  // guitar: written 8va higher
      const step = staffStep(note.pitch, note.octave + 1);
      const fill = isAct ? '#c8991a' : isSel ? '#1e64dc' : '#1a1a1a';
      const acc  = accChar(note.pitch);

      // Ledger lines
      ctx.strokeStyle = '#666'; ctx.lineWidth = 1.3;
      for (let ly = STAFF_BOT + SLG; ly <= y + 2; ly += SLG) {
        ctx.beginPath(); ctx.moveTo(x - NHX - 4, ly); ctx.lineTo(x + NHX + 4, ly); ctx.stroke();
      }
      for (let ly = STAFF_TOP - SLG; ly >= y - 2; ly -= SLG) {
        ctx.beginPath(); ctx.moveTo(x - NHX - 4, ly); ctx.lineTo(x + NHX + 4, ly); ctx.stroke();
      }

      // Notehead
      ctx.save();
      if (isAct) { ctx.shadowColor = 'rgba(200,153,26,0.5)'; ctx.shadowBlur = 7; }
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.ellipse(x, y, NHX, NHY, -0.3, 0, Math.PI * 2); ctx.fill();
      // Open notehead (half / whole)
      if (note.duration >= beatsToSec(2)) {
        ctx.fillStyle = '#faf9f5';
        ctx.beginPath(); ctx.ellipse(x, y, NHX - 1.8, NHY - 1.4, -0.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // Stem
      const stemUp = step < 11;
      const sx = stemUp ? x + NHX - 1.2 : x - NHX + 1.2;
      ctx.strokeStyle = fill; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx, stemUp ? y - STEM_LEN : y + STEM_LEN);
      ctx.stroke();

      // Flags for 8th and shorter
      const sy = stemUp ? y - STEM_LEN : y + STEM_LEN;
      const flags = note.duration < beatsToSec(0.5) ? 2 : note.duration < beatsToSec(1) ? 1 : 0;
      for (let f = 0; f < flags; f++) {
        const fy = stemUp ? sy + f * 6 : sy - f * 6;
        ctx.save(); ctx.strokeStyle = fill; ctx.lineWidth = 1.4;
        ctx.beginPath();
        if (stemUp) {
          ctx.moveTo(sx, fy);
          ctx.bezierCurveTo(sx + 12, fy + 4, sx + 12, fy + 11, sx, fy + 14);
        } else {
          ctx.moveTo(sx, fy);
          ctx.bezierCurveTo(sx + 12, fy - 4, sx + 12, fy - 11, sx, fy - 14);
        }
        ctx.stroke(); ctx.restore();
      }

      // Dot
      if (note.duration === beatsToSec(note.duration) && Math.abs(note.duration / spb() % 0.5) < 0.01) {
        const baseDur = note.duration / spb();
        const isDot = [1.5, 0.75, 3, 6].includes(baseDur);
        if (isDot) {
          ctx.fillStyle = fill;
          ctx.beginPath(); ctx.arc(x + NHX + 5, y - 2, 2.2, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Accidental
      if (acc) {
        ctx.fillStyle = fill;
        ctx.font = '11px "Times New Roman", serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(acc, x - NHX - 8, y);
      }

      // Triplet "3"
      const isTriplet = Math.abs(note.duration - tripletDur(durBeats)) < 0.005 ||
                        Math.abs(note.duration - tripletDur(1)) < 0.005;
      if (isTriplet) {
        ctx.fillStyle = '#888'; ctx.font = '8px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('3', x, STAFF_TOP - 14);
      }



      // ── TAB number ───────────────────────────────────────────────────────────
      const ty  = tabStrY(note.string);
      const txt = String(note.fret);
      const bw  = txt.length > 1 ? 18 : 14;

      // Erase line behind number
      ctx.fillStyle = '#faf9f5';
      ctx.fillRect(x - bw / 2 - 1, ty - 7, bw + 2, 13);

      // Box on selection / active
      if (isSel || isAct) {
        ctx.fillStyle = isAct ? 'rgba(200,153,26,0.2)' : 'rgba(30,100,220,0.15)';
        ctx.beginPath();
        ctx.roundRect(x - bw / 2 - 2, ty - 7, bw + 4, 14, 2);
        ctx.fill();
      }

      ctx.save();
      if (isAct) { ctx.shadowColor = 'rgba(200,153,26,0.45)'; ctx.shadowBlur = 5; }
      ctx.fillStyle = isAct ? '#9a6800' : isSel ? '#1e64dc' : '#1a1a1a';
      ctx.font = `${isAct || isSel ? 'bold' : '600'} 11px system-ui, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, x, ty);
      ctx.restore();
    }

    ctx.textBaseline = 'alphabetic';
  }, [notes, activeNoteIds, selIdx, barlineXs, cursorTime, focused, fretBuf, pendingStr, durBeats, dotted, triplet]);

  // ── Draw ruler ───────────────────────────────────────────────────────────────
  const drawRuler = useCallback(() => {
    const c = rulerRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const w = c.width;

    ctx.fillStyle = isDark ? '#13131a' : '#eae7de';
    ctx.fillRect(0, 0, w, RULER_H);
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, RULER_H - 1); ctx.lineTo(w, RULER_H - 1); ctx.stroke();

    const total = totalDuration / spb();
    for (let b = 0; b <= total + 0.01; b += 0.5) {
      const x = HEADER_W + BAR_PAD + b * BEAT_W;
      const isBar  = b % SCORE_BEATS_PER_MEASURE === 0;
      const isBeat = b % 1 === 0;
      ctx.strokeStyle = isDark
        ? (isBar ? 'rgba(200,168,75,0.7)' : isBeat ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)')
        : (isBar ? 'rgba(110,75,0,0.7)'   : isBeat ? 'rgba(0,0,0,0.22)'       : 'rgba(0,0,0,0.08)');
      ctx.lineWidth = isBar ? 1.3 : 0.6;
      ctx.beginPath(); ctx.moveTo(x, isBar ? 1 : isBeat ? 7 : 13); ctx.lineTo(x, RULER_H - 1); ctx.stroke();
      if (isBar) {
        ctx.fillStyle = isDark ? 'rgba(200,168,75,0.85)' : 'rgba(100,70,0,0.8)';
        ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(`${b / SCORE_BEATS_PER_MEASURE + 1}`, x, 12);
      }
    }
  }, [isDark, totalDuration]);

  useEffect(() => { draw(); },      [draw]);
  useEffect(() => { drawRuler(); }, [drawRuler]);

  // Auto-scroll to cursor when editing
  useEffect(() => {
    const el = scrollRef.current; if (!el || !focused) return;
    const cx = noteX(cursorTime);
    if (cx > el.scrollLeft + el.clientWidth - 100) el.scrollLeft = cx - 100;
    if (cx < el.scrollLeft + HEADER_W + 10) el.scrollLeft = Math.max(0, cx - HEADER_W - 10);
  }, [cursorTime, focused]);

  // Auto-scroll playhead
  useEffect(() => {
    const el = scrollRef.current; if (!el || !isPlaying) return;
    const px = noteX(currentTime);
    if (px > el.scrollLeft + el.clientWidth - 120) el.scrollLeft = px - 120;
  }, [currentTime, isPlaying]);

  // ── Click handling ───────────────────────────────────────────────────────────
  function canvasXY(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    // Scale CSS coords → canvas pixel coords (quan trọng cho Retina/zoom)
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return {
      cx: (e.clientX - r.left) * scaleX,
      cy: (e.clientY - r.top) * scaleY,
    };
  }

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { cx, cy } = canvasXY(e);

    // CHỈ xử lý click trong vùng TAB — staff là vùng chỉ đọc
    const inTabArea = cy >= TAB_TOP - TSG;
    if (!inTabArea) return;

    // Xác định dây được click
    let bestStr = 0; let bestStrD = Infinity;
    for (let s = 0; s < 6; s++) {
      const d = Math.abs(cy - tabStrY(s));
      if (d < bestStrD) { bestStrD = d; bestStr = s; }
    }
    setPendingStr(bestStr);
    pendingStrRef.current = bestStr;

    // Tìm nốt gần nhất theo X
    let bestNi: number | null = null; let bestD = Infinity;
    notes.forEach((note, i) => {
      const d = Math.abs(cx - noteX(note.time));
      if (d < bestD) { bestD = d; bestNi = i; }
    });

    if (bestNi !== null && bestD < BEAT_W * 0.6) {
      setSelIdx(bestNi);
      setCursorIdx(bestNi as number);
    } else {
      // Click vào chỗ trống — snap đến beat gần nhất
      const rawBeat = (cx - HEADER_W - BAR_PAD) / BEAT_W;
      const snapBeat = Math.max(0, Math.round(rawBeat * 2) / 2);
      const snapTime = beatsToSec(snapBeat);
      let insertAt = notes.length;
      for (let i = 0; i < notes.length; i++) {
        if (notes[i].time >= snapTime) { insertAt = i; break; }
      }
      setCursorIdx(insertAt);
      setSelIdx(null);
    }

    containerRef.current?.focus();
  }, [notes]);

  // ── Styles ───────────────────────────────────────────────────────────────────
  const border  = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)';
  const panelBg = isDark ? 'rgba(20,20,30,0.95)' : '#f5f3ee';
  const muted   = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const accent  = isDark ? '#c8a84b' : '#8a6500';

  // Duration selector
  const activeDur = DURATIONS.find(d => d.beats === durBeats) ?? DURATIONS[2];

  const totalH = RULER_H + CANVAS_H;
  const px     = noteX(currentTime);

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

        {/* Stop / Play */}
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={onStop} title="Dừng"
            style={btnStyle(false, isDark)}>
            <svg width="9" height="9" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="currentColor" rx="1"/></svg>
          </button>
          <button onClick={isPlaying ? onPause : onPlay} title={isPlaying ? 'Tạm dừng (Space)' : 'Phát (Space)'}
            style={btnStyle(isPlaying, isDark, accent)}>
            {isPlaying
              ? <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="8" fill="currentColor" rx="0.5"/><rect x="6" y="1" width="3" height="8" fill="currentColor" rx="0.5"/></svg>
              : <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="2,1 9,5 2,9" fill="currentColor"/></svg>
            }
          </button>
        </div>

        <span style={{ fontSize: 10, color: muted, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
          {SCORE_BPM} BPM · 4/4 · {fmtTime(currentTime)}/{fmtTime(totalDuration)}
        </span>

        {/* Progress */}
        <div style={{ flex: 1, minWidth: 60, height: 3, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${totalDuration > 0 ? Math.min(100, currentTime / totalDuration * 100) : 0}%`, background: accent, borderRadius: 2, transition: 'width 0.08s linear' }} />
        </div>

        <span style={{ fontSize: 10, color: muted }}>{notes.length} nốt</span>
      </div>



      {/* ── Canvas ── */}
      <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', background: '#faf9f5', position: 'relative' }}>
        <div style={{ width: W, height: totalH, position: 'relative' }}>

          {/* Ruler */}
          <canvas ref={rulerRef} width={W} height={RULER_H}
            style={{ position: 'absolute', top: 0, left: 0, display: 'block' }} />

          {/* Main canvas (staff + TAB) */}
          <canvas ref={canvasRef} width={W} height={CANVAS_H}
            style={{ position: 'absolute', top: RULER_H, left: 0, display: 'block', cursor: 'default' }}
            onClick={handleCanvasClick} />

          {/* Overlay TAB vùng tương tác — cursor text, hover highlight */}
          <div
            onClick={handleCanvasClick as any}
            style={{
              position: 'absolute',
              top: RULER_H + TAB_TOP - TSG,
              left: 0,
              width: W,
              height: TAB_BOT - TAB_TOP + TSG * 2,
              cursor: 'text',
              zIndex: 5,
            }}
          />

          {/* Playhead */}
          <div style={{
            position: 'absolute', top: 0, left: px, width: 2, height: totalH,
            background: '#e05000', opacity: 0.85, pointerEvents: 'none',
            boxShadow: '0 0 5px rgba(224,80,0,0.5)',
            transition: isPlaying ? 'left 0.08s linear' : 'none',
            zIndex: 10,
          }}>
            <div style={{ position: 'absolute', top: 0, left: -4, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '8px solid #e05000' }} />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {notes.length === 0 && (
        <div style={{ padding: '10px 16px', textAlign: 'center', color: muted, fontSize: 12, borderTop: `1px solid ${border}` }}>
          Click vào khuông nhạc để đặt con trỏ, rồi gõ số fret hoặc bấm nốt trên cần đàn
        </div>
      )}

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

// ─── Button style helper ──────────────────────────────────────────────────────
function btnStyle(active: boolean, isDark: boolean, accent?: string): React.CSSProperties {
  return {
    width: 28, height: 26, borderRadius: 4, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${active && accent ? accent + '88' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
    background: active && accent ? accent + '22' : 'transparent',
    color: active && accent ? accent : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'),
  };
}
