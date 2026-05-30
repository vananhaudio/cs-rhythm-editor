import { useCallback, useRef, useState } from 'react';
import { Play, Square, Mic, MicOff, RotateCcw, CheckCircle, Music2, Waves, Volume2, Loader2 } from 'lucide-react';
import {
  useStringDetector,
  E_SEQUENCE, EM_SEQUENCE,
  A_SEQUENCE, AM_SEQUENCE,
  D_SEQUENCE, DM_SEQUENCE,
  G_SEQUENCE, C_SEQUENCE, F_SEQUENCE,
  B7_SEQUENCE, E7_SEQUENCE, A7_SEQUENCE, D7_SEQUENCE, G7_SEQUENCE,
  ChordStep, StringStatus,
  RATING_LABELS, RATING_COLORS, AccuracyRating,
} from './useStringDetector';
import { useChordDetector } from './useChordDetector';

const STRUM_FRAMES_NEEDED = 10;

// ── Chord config ───────────────────────────────────────────────────────────
interface DiagramString {
  label: string;
  noteLabel: string;
  muted: boolean;
  open: boolean;
  fret: number;
  finger: string | null;
  seqIdx: number;
}

interface ChordConfig {
  name: string;
  viName: string;    // e.g. "Mi trưởng"
  type: string;
  tag: string;       // 'major' | 'minor' | 'dom7' | 'barre'
  sequence: ChordStep[];
  strings: DiagramString[];
  doneText: string;
  startFret?: number;
}

// ── 14 basic chords ────────────────────────────────────────────────────────
const ALL_CHORDS: ChordConfig[] = [
  // ── E major: 022100 ──
  {
    name: 'E', viName: 'Mi trưởng', type: 'MAJOR · E–G#–B', tag: 'major',
    sequence: E_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm E!',
    strings: [
      { label: 'E', noteLabel: 'E2',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 0 },
      { label: 'A', noteLabel: 'B2',  muted: false, open: false, fret: 2, finger: '3',  seqIdx: 1 },
      { label: 'D', noteLabel: 'E3',  muted: false, open: false, fret: 2, finger: '2',  seqIdx: 2 },
      { label: 'G', noteLabel: 'G#3', muted: false, open: false, fret: 1, finger: '1',  seqIdx: 3 },
      { label: 'B', noteLabel: 'B3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 4 },
      { label: 'e', noteLabel: 'E4',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 5 },
    ],
  },
  // ── Em: 022000 ──
  {
    name: 'Em', viName: 'Mi thứ', type: 'MINOR · E–G–B', tag: 'minor',
    sequence: EM_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm Em!',
    strings: [
      { label: 'E', noteLabel: 'E2',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 0 },
      { label: 'A', noteLabel: 'B2',  muted: false, open: false, fret: 2, finger: '2',  seqIdx: 1 },
      { label: 'D', noteLabel: 'E3',  muted: false, open: false, fret: 2, finger: '3',  seqIdx: 2 },
      { label: 'G', noteLabel: 'G3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 3 },
      { label: 'B', noteLabel: 'B3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 4 },
      { label: 'e', noteLabel: 'E4',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 5 },
    ],
  },
  // ── A major: x02220 ──
  {
    name: 'A', viName: 'La trưởng', type: 'MAJOR · A–C#–E', tag: 'major',
    sequence: A_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm A!',
    strings: [
      { label: 'E', noteLabel: 'E2',  muted: true,  open: false, fret: 0, finger: null, seqIdx: -1 },
      { label: 'A', noteLabel: 'A2',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 0 },
      { label: 'D', noteLabel: 'E3',  muted: false, open: false, fret: 2, finger: '1',  seqIdx: 1 },
      { label: 'G', noteLabel: 'A3',  muted: false, open: false, fret: 2, finger: '2',  seqIdx: 2 },
      { label: 'B', noteLabel: 'C#4', muted: false, open: false, fret: 2, finger: '3',  seqIdx: 3 },
      { label: 'e', noteLabel: 'E4',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 4 },
    ],
  },
  // ── Am: x02210 ──
  {
    name: 'Am', viName: 'La thứ', type: 'MINOR · A–C–E', tag: 'minor',
    sequence: AM_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm Am!',
    strings: [
      { label: 'E', noteLabel: 'E2',  muted: true,  open: false, fret: 0, finger: null, seqIdx: -1 },
      { label: 'A', noteLabel: 'A2',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 0 },
      { label: 'D', noteLabel: 'E3',  muted: false, open: false, fret: 2, finger: '2',  seqIdx: 1 },
      { label: 'G', noteLabel: 'A3',  muted: false, open: false, fret: 2, finger: '3',  seqIdx: 2 },
      { label: 'B', noteLabel: 'C4',  muted: false, open: false, fret: 1, finger: '1',  seqIdx: 3 },
      { label: 'e', noteLabel: 'E4',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 4 },
    ],
  },
  // ── D major: xx0232 ──
  {
    name: 'D', viName: 'Rê trưởng', type: 'MAJOR · D–F#–A', tag: 'major',
    sequence: D_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm D!',
    strings: [
      { label: 'E', noteLabel: 'E2',  muted: true,  open: false, fret: 0, finger: null, seqIdx: -1 },
      { label: 'A', noteLabel: 'A2',  muted: true,  open: false, fret: 0, finger: null, seqIdx: -1 },
      { label: 'D', noteLabel: 'D3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 0 },
      { label: 'G', noteLabel: 'A3',  muted: false, open: false, fret: 2, finger: '1',  seqIdx: 1 },
      { label: 'B', noteLabel: 'D4',  muted: false, open: false, fret: 3, finger: '3',  seqIdx: 2 },
      { label: 'e', noteLabel: 'F#4', muted: false, open: false, fret: 2, finger: '2',  seqIdx: 3 },
    ],
  },
  // ── Dm: xx0231 ──
  {
    name: 'Dm', viName: 'Rê thứ', type: 'MINOR · D–F–A', tag: 'minor',
    sequence: DM_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm Dm!',
    strings: [
      { label: 'E', noteLabel: 'E2',  muted: true,  open: false, fret: 0, finger: null, seqIdx: -1 },
      { label: 'A', noteLabel: 'A2',  muted: true,  open: false, fret: 0, finger: null, seqIdx: -1 },
      { label: 'D', noteLabel: 'D3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 0 },
      { label: 'G', noteLabel: 'A3',  muted: false, open: false, fret: 2, finger: '2',  seqIdx: 1 },
      { label: 'B', noteLabel: 'D4',  muted: false, open: false, fret: 3, finger: '3',  seqIdx: 2 },
      { label: 'e', noteLabel: 'F4',  muted: false, open: false, fret: 1, finger: '1',  seqIdx: 3 },
    ],
  },
  // ── G major: 320003 ──
  {
    name: 'G', viName: 'Sol trưởng', type: 'MAJOR · G–B–D', tag: 'major',
    sequence: G_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm G!',
    strings: [
      { label: 'E', noteLabel: 'G2',  muted: false, open: false, fret: 3, finger: '2',  seqIdx: 0 },
      { label: 'A', noteLabel: 'B2',  muted: false, open: false, fret: 2, finger: '1',  seqIdx: 1 },
      { label: 'D', noteLabel: 'D3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 2 },
      { label: 'G', noteLabel: 'G3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 3 },
      { label: 'B', noteLabel: 'B3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 4 },
      { label: 'e', noteLabel: 'G4',  muted: false, open: false, fret: 3, finger: '4',  seqIdx: 5 },
    ],
  },
  // ── C major: x32010 ──
  {
    name: 'C', viName: 'Đô trưởng', type: 'MAJOR · C–E–G', tag: 'major',
    sequence: C_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm C!',
    strings: [
      { label: 'E', noteLabel: 'E2',  muted: true,  open: false, fret: 0, finger: null, seqIdx: -1 },
      { label: 'A', noteLabel: 'C3',  muted: false, open: false, fret: 3, finger: '3',  seqIdx: 0 },
      { label: 'D', noteLabel: 'E3',  muted: false, open: false, fret: 2, finger: '2',  seqIdx: 1 },
      { label: 'G', noteLabel: 'G3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 2 },
      { label: 'B', noteLabel: 'C4',  muted: false, open: false, fret: 1, finger: '1',  seqIdx: 3 },
      { label: 'e', noteLabel: 'E4',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 4 },
    ],
  },
  // ── F major barre: 133211 ──
  {
    name: 'F', viName: 'Fa trưởng', type: 'MAJOR · F–A–C', tag: 'barre',
    sequence: F_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm F!',
    strings: [
      { label: 'E', noteLabel: 'F2',  muted: false, open: false, fret: 1, finger: '1',  seqIdx: 0 },
      { label: 'A', noteLabel: 'C3',  muted: false, open: false, fret: 3, finger: '3',  seqIdx: 1 },
      { label: 'D', noteLabel: 'F3',  muted: false, open: false, fret: 3, finger: '4',  seqIdx: 2 },
      { label: 'G', noteLabel: 'A3',  muted: false, open: false, fret: 2, finger: '2',  seqIdx: 3 },
      { label: 'B', noteLabel: 'C4',  muted: false, open: false, fret: 1, finger: '1',  seqIdx: 4 },
      { label: 'e', noteLabel: 'F4',  muted: false, open: false, fret: 1, finger: '1',  seqIdx: 5 },
    ],
  },
  // ── E7: 020100 ──
  {
    name: 'E7', viName: 'Mi bảy', type: 'DOM 7 · E–G#–B–D', tag: 'dom7',
    sequence: E7_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm E7!',
    strings: [
      { label: 'E', noteLabel: 'E2',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 0 },
      { label: 'A', noteLabel: 'B2',  muted: false, open: false, fret: 2, finger: '2',  seqIdx: 1 },
      { label: 'D', noteLabel: 'D3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 2 },
      { label: 'G', noteLabel: 'G#3', muted: false, open: false, fret: 1, finger: '1',  seqIdx: 3 },
      { label: 'B', noteLabel: 'B3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 4 },
      { label: 'e', noteLabel: 'E4',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 5 },
    ],
  },
  // ── A7: x02020 ──
  {
    name: 'A7', viName: 'La bảy', type: 'DOM 7 · A–C#–E–G', tag: 'dom7',
    sequence: A7_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm A7!',
    strings: [
      { label: 'E', noteLabel: 'E2',  muted: true,  open: false, fret: 0, finger: null, seqIdx: -1 },
      { label: 'A', noteLabel: 'A2',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 0 },
      { label: 'D', noteLabel: 'E3',  muted: false, open: false, fret: 2, finger: '2',  seqIdx: 1 },
      { label: 'G', noteLabel: 'G3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 2 },
      { label: 'B', noteLabel: 'C#4', muted: false, open: false, fret: 2, finger: '3',  seqIdx: 3 },
      { label: 'e', noteLabel: 'E4',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 4 },
    ],
  },
  // ── D7: xx0212 ──
  {
    name: 'D7', viName: 'Rê bảy', type: 'DOM 7 · D–F#–A–C', tag: 'dom7',
    sequence: D7_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm D7!',
    strings: [
      { label: 'E', noteLabel: 'E2',  muted: true,  open: false, fret: 0, finger: null, seqIdx: -1 },
      { label: 'A', noteLabel: 'A2',  muted: true,  open: false, fret: 0, finger: null, seqIdx: -1 },
      { label: 'D', noteLabel: 'D3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 0 },
      { label: 'G', noteLabel: 'A3',  muted: false, open: false, fret: 2, finger: '1',  seqIdx: 1 },
      { label: 'B', noteLabel: 'C4',  muted: false, open: false, fret: 1, finger: '2',  seqIdx: 2 },
      { label: 'e', noteLabel: 'F#4', muted: false, open: false, fret: 2, finger: '3',  seqIdx: 3 },
    ],
  },
  // ── G7: 320001 ──
  {
    name: 'G7', viName: 'Sol bảy', type: 'DOM 7 · G–B–D–F', tag: 'dom7',
    sequence: G7_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm G7!',
    strings: [
      { label: 'E', noteLabel: 'G2',  muted: false, open: false, fret: 3, finger: '3',  seqIdx: 0 },
      { label: 'A', noteLabel: 'B2',  muted: false, open: false, fret: 2, finger: '2',  seqIdx: 1 },
      { label: 'D', noteLabel: 'D3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 2 },
      { label: 'G', noteLabel: 'G3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 3 },
      { label: 'B', noteLabel: 'B3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 4 },
      { label: 'e', noteLabel: 'F4',  muted: false, open: false, fret: 1, finger: '1',  seqIdx: 5 },
    ],
  },
  // ── B7: x-2-1-2-0-2 (B D# F# A) ──
  {
    name: 'B7', viName: 'Si bảy', type: 'DOM 7 · B–D#–F#–A', tag: 'dom7',
    sequence: B7_SEQUENCE,
    doneText: 'Bạn đã rải đúng hợp âm B7!',
    strings: [
      { label: 'E', noteLabel: 'E2',  muted: true,  open: false, fret: 0, finger: null, seqIdx: -1 },
      { label: 'A', noteLabel: 'B2',  muted: false, open: false, fret: 2, finger: '1',  seqIdx: 0 },
      { label: 'D', noteLabel: 'D#3', muted: false, open: false, fret: 1, finger: '2',  seqIdx: 1 },
      { label: 'G', noteLabel: 'A3',  muted: false, open: false, fret: 2, finger: '3',  seqIdx: 2 },
      { label: 'B', noteLabel: 'B3',  muted: false, open: true,  fret: 0, finger: null, seqIdx: 3 },
      { label: 'e', noteLabel: 'F#4', muted: false, open: false, fret: 2, finger: '4',  seqIdx: 4 },
    ],
  },
];

const TAG_LABEL: Record<string, string> = {
  major: 'Trưởng',
  minor: 'Thứ',
  dom7:  'Bảy',
  barre: 'Barre',
};

const TAG_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  major: { bg: 'rgba(34,197,94,0.07)',  border: '#14532d', text: '#4ade80' },
  minor: { bg: 'rgba(59,130,246,0.07)', border: '#1e3a5f', text: '#60a5fa' },
  dom7:  { bg: 'rgba(245,158,11,0.07)', border: '#78350f', text: '#fbbf24' },
  barre: { bg: 'rgba(239,68,68,0.07)',  border: '#7f1d1d', text: '#f87171' },
};

// ── Karplus-Strong synth ───────────────────────────────────────────────────
function synthNote(ctx: AudioContext, freq: number, t: number, dur: number) {
  const size = Math.floor(ctx.sampleRate / freq);
  const buf = ctx.createBuffer(1, size, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = freq * 5; lp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.3, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(lp); lp.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur);
}

// ── Chord diagram ──────────────────────────────────────────────────────────
const STRING_WIDTHS = [3.8, 3.0, 2.4, 1.8, 1.4, 1.1];

interface DiagramProps {
  chord: ChordConfig;
  statuses: StringStatus[];
  currentStep: number;
  listening: boolean;
  done: boolean;
  refLitIdx: number;
  refFadingIdx: number;
}

function ChordDiagram({ chord, statuses, currentStep, listening, done, refLitIdx, refFadingIdx }: DiagramProps) {
  const { strings, name, type } = chord;

  const maxFret = Math.max(...strings.map(s => s.fret));
  const N_FRETS   = Math.max(3, maxFret);
  const N_STRINGS = 6;
  const STR_GAP   = 36;
  const FRET_H    = 44;
  const NUT_H     = 7;
  const MARGIN_L  = 24;
  const MARGIN_R  = 30;
  const TOP_SYM   = 12;
  const TOP_LABEL = TOP_SYM + 20;
  const TOP_GRID  = TOP_LABEL + 15;
  const BOT_LABEL = TOP_GRID + NUT_H + N_FRETS * FRET_H + 18;
  const SVG_W     = MARGIN_L + (N_STRINGS - 1) * STR_GAP + MARGIN_R;
  const SVG_H     = BOT_LABEL + 14;
  const GRID_W    = (N_STRINGS - 1) * STR_GAP;
  const GRID_H    = N_FRETS * FRET_H;
  const DOT_R     = 13;

  const sx = (i: number) => MARGIN_L + i * STR_GAP;

  const idle = !listening && !done && refLitIdx < 0;

  const strState = (seqI: number) => {
    if (seqI < 0) return { isRef: false, isFading: false, isCur: false, isDone: false, isPending: false };
    const isRef    = refLitIdx >= 0 && seqI === refLitIdx;
    const isFading = !isRef && refFadingIdx >= 0 && seqI === refFadingIdx;
    const isCur    = seqI === currentStep && !done && listening;
    const isDone   = statuses[seqI] === 'correct';
    const isPending = !isCur && !isDone;
    return { isRef, isFading, isCur, isDone, isPending };
  };

  return (
    <svg
      width={SVG_W} height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}
    >
      <text x={MARGIN_L + GRID_W / 2} y={TOP_SYM - 1}
        textAnchor="middle" fontSize={19} fontWeight="900"
        fill="#f1f5f9" letterSpacing="0.5"
      >{name}</text>
      <text x={MARGIN_L + GRID_W / 2} y={TOP_SYM + 10}
        textAnchor="middle" fontSize={8.5} fontWeight="500"
        fill="#1e4a32" letterSpacing="0.5"
      >{type}</text>

      {strings.map((s, i) => (
        <text key={`lbl-${i}`}
          x={sx(i)} y={TOP_LABEL}
          textAnchor="middle" fontSize={10} fontWeight="700"
          fill={s.muted ? '#6b7280' : '#9ca3af'}
        >{s.label}</text>
      ))}

      {strings.map((s, i) => {
        const { isRef, isFading, isCur, isDone } = strState(s.seqIdx);
        const highlight = isRef || isCur;
        const x = sx(i);
        const y = TOP_SYM + 33;

        if (s.muted) {
          const d = 6;
          return (
            <g key={`sym-${i}`}>
              <line x1={x-d} y1={y-d} x2={x+d} y2={y+d} stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round"/>
              <line x1={x+d} y1={y-d} x2={x-d} y2={y+d} stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round"/>
            </g>
          );
        }
        if (s.open) {
          const col = highlight ? '#f59e0b' : isFading ? '#f59e0b' : isDone ? '#22c55e' : '#9ca3af';
          const glowOp = highlight ? 0.22 : isFading ? 0.10 : 0;
          return (
            <g key={`sym-${i}`}>
              <circle cx={x} cy={y} r={10} fill="#f59e0b" fillOpacity={glowOp}
                style={{ transition: 'fill-opacity 380ms ease-out' }}/>
              {isDone && !highlight && !isFading && (
                <circle cx={x} cy={y} r={10} fill="#22c55e" fillOpacity={0.15}/>
              )}
              <circle cx={x} cy={y} r={7} fill="none" stroke={col} strokeWidth={2}
                style={{ transition: 'stroke 380ms ease-out' }}/>
            </g>
          );
        }
        return <g key={`sym-${i}`}/>;
      })}

      <rect x={MARGIN_L} y={TOP_GRID} width={GRID_W} height={NUT_H} rx={2} fill="#e5e7eb"/>
      <rect x={MARGIN_L} y={TOP_GRID + NUT_H} width={GRID_W} height={GRID_H} fill="#0d1520"/>

      {Array.from({ length: N_FRETS + 1 }).map((_, f) => (
        <line key={`fret-${f}`}
          x1={MARGIN_L} y1={TOP_GRID + NUT_H + f * FRET_H}
          x2={MARGIN_L + GRID_W} y2={TOP_GRID + NUT_H + f * FRET_H}
          stroke={f === 0 ? 'transparent' : '#1e3a5f'}
          strokeWidth={f === 0 ? 0 : 1.5}
        />
      ))}

      {Array.from({ length: N_FRETS }).map((_, f) => (
        <text key={`fnum-${f}`}
          x={MARGIN_L + GRID_W + 14}
          y={TOP_GRID + NUT_H + (f + 0.5) * FRET_H + 4}
          textAnchor="middle" fontSize={10}
          fill="#4b5563" fontWeight="700"
        >{f + 1}</text>
      ))}

      {strings.map((s, i) => {
        const { isRef, isFading, isCur, isDone, isPending } = strState(s.seqIdx);
        const highlight = isRef || isCur;
        const x = sx(i);
        const y1 = TOP_GRID + NUT_H;
        const y2 = TOP_GRID + NUT_H + GRID_H;
        const col = s.muted   ? '#374151'
          : highlight  ? '#f59e0b'
          : isFading   ? '#f59e0b'
          : isDone     ? '#22c55e'
          : '#4b6280';
        const glowOp = highlight ? 0.20 : isFading ? 0.08 : isDone ? 0.18 : 0;
        const op = s.muted    ? 0.55
          : highlight  ? 1
          : isFading   ? 0.35
          : isDone     ? 1
          : (isPending && listening && !idle) ? 0.55
          : 1;
        const sw = STRING_WIDTHS[i];
        return (
          <g key={`str-${i}`} opacity={op} style={{ transition: 'opacity 380ms ease-out' }}>
            <line x1={x} y1={y1} x2={x} y2={y2}
              stroke={highlight || isFading ? '#f59e0b' : '#22c55e'}
              strokeWidth={sw + 14} strokeOpacity={glowOp}
              style={{ transition: 'stroke-opacity 380ms ease-out' }}
            />
            <line x1={x} y1={y1} x2={x} y2={y2}
              stroke={col} strokeWidth={sw} strokeLinecap="round"
              style={{ transition: 'stroke 380ms ease-out' }}
            />
          </g>
        );
      })}

      {strings.map((s, i) => {
        if (s.muted || s.open || s.fret === 0) return null;
        const { isRef, isFading, isCur, isDone, isPending } = strState(s.seqIdx);
        const highlight = isRef || isCur;
        const x = sx(i);
        const cy = TOP_GRID + NUT_H + (s.fret - 0.5) * FRET_H;
        const dotFill = highlight  ? '#f59e0b'
          : isFading   ? '#f59e0b'
          : isDone     ? '#22c55e'
          : '#f1f5f9';
        const numFill = (highlight || isFading) ? '#1a0a00'
          : isDone ? '#022c22' : '#111827';
        const r = highlight ? DOT_R + 2 : DOT_R;
        const glowOp = highlight ? 0.20 : isFading ? 0.08 : 0;
        const dotOp  = highlight ? 1 : isFading ? 0.45 : (isPending && listening && !idle) ? 0.55 : 1;
        return (
          <g key={`dot-${i}`} opacity={dotOp} style={{ transition: 'opacity 380ms ease-out' }}>
            <circle cx={x} cy={cy} r={r + 9} fill="#f59e0b" fillOpacity={glowOp}
              style={{ transition: 'fill-opacity 380ms ease-out' }}/>
            {isDone && !highlight && !isFading && (
              <circle cx={x} cy={cy} r={r + 6} fill="#22c55e" fillOpacity={0.2}/>
            )}
            <circle cx={x} cy={cy} r={r} fill={dotFill}
              style={{ transition: 'fill 380ms ease-out' }}/>
            <text x={x} y={cy + 4}
              textAnchor="middle" fontSize={11} fontWeight="800" fill={numFill}
            >{s.finger}</text>
          </g>
        );
      })}

      {strings.map((s, i) => {
        const { isRef, isFading, isCur, isDone } = strState(s.seqIdx);
        const highlight = isRef || isCur;
        const col = s.muted ? '#4b5563'
          : highlight  ? '#f59e0b'
          : isFading   ? '#f59e0b'
          : isDone     ? '#22c55e'
          : '#6b7280';
        const op = isFading ? 0.45 : 1;
        return (
          <text key={`note-${i}`}
            x={sx(i)} y={BOT_LABEL}
            textAnchor="middle" fontSize={9.5} fontWeight="700"
            fill={col} opacity={op}
            style={{ transition: 'opacity 380ms ease-out, fill 380ms ease-out' }}
          >{s.noteLabel}</text>
        );
      })}
    </svg>
  );
}

// ── Accuracy badge ─────────────────────────────────────────────────────────
function AccuracyBadge({ rating, cents, detectedFreq, targetFreq }: {
  rating: AccuracyRating;
  cents: number | null;
  detectedFreq: number;
  targetFreq: number;
}) {
  const visible = rating !== null && cents !== null;
  const label = rating ? RATING_LABELS[rating] : '';
  const color = rating ? RATING_COLORS[rating] : 'transparent';
  const centsStr = cents !== null ? (cents >= 0 ? `+${cents}` : `${cents}`) : '';
  const isPositive = rating === 'perfect' || rating === 'great' || rating === 'good';

  return (
    <div
      className="flex flex-col items-center gap-1 py-2 px-4 rounded-2xl border transition-all duration-300"
      style={{
        background: visible
          ? (isPositive ? 'rgba(34,197,94,0.07)' : 'rgba(251,191,36,0.07)')
          : 'transparent',
        borderColor: visible ? color + '40' : 'transparent',
        opacity: visible ? 1 : 0,
        minHeight: 52,
        justifyContent: 'center',
      }}
    >
      <span className="text-sm font-bold" style={{ color }}>{label || '\u00a0'}</span>
      <span className="text-[11px] font-mono" style={{ color: '#334155' }}>
        {visible ? `${detectedFreq}Hz → ${targetFreq}Hz · ${centsStr} cents` : '\u00a0'}
      </span>
    </div>
  );
}

// ── Hint text ──────────────────────────────────────────────────────────────
function HintText({ state, chord }: {
  state: ReturnType<typeof useStringDetector>['state'];
  chord: ChordConfig;
}) {
  const seq = chord.sequence;
  const cur = state.currentStep < seq.length ? seq[state.currentStep] : null;

  if (state.done) {
    return <p className="text-emerald-400 font-bold text-base text-center">{chord.doneText}</p>;
  }

  if (!cur) return <p className="text-transparent text-sm select-none">&nbsp;</p>;

  if (!state.listening) {
    return (
      <p className="text-center text-slate-500 text-sm">
        Nhấn <span className="text-slate-300 font-semibold">Bắt đầu</span> rồi gảy dây {cur.stringNum}
      </p>
    );
  }

  if (state.wrongHint) {
    return (
      <p className="text-center text-amber-400 text-sm font-medium">
        Hãy gảy chính xác dây <span className="font-bold">{cur.stringNum}</span>
      </p>
    );
  }

  if (state.lastRating && state.currentStep > 0) {
    return (
      <p className="text-center text-emerald-400 text-sm font-semibold">
        Đúng rồi! Tiếp tục gảy dây số{' '}
        <span className="font-bold text-white">{cur.stringNum}</span>
        <span className="text-slate-500 font-normal"> ({cur.note})</span>
      </p>
    );
  }

  return (
    <p className="text-center text-amber-300 text-sm font-medium">
      Hãy gảy dây số <span className="text-amber-400 font-bold">{cur.stringNum}</span>
      <span className="text-slate-500"> ({cur.note})</span>
    </p>
  );
}

// ── Signal bar ─────────────────────────────────────────────────────────────
function SignalBar({ rmsDb, detectedFreq, visible }: {
  rmsDb: number;
  detectedFreq: number;
  visible: boolean;
}) {
  const BAR = 20;
  const norm = Math.max(0, Math.min(1, (rmsDb + 65) / 55));
  const lit = Math.round(norm * BAR);

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-opacity duration-300"
      style={{
        background: '#06101c',
        border: '1px solid #0f1f36',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <span className="text-[11px] text-slate-600 font-medium flex-shrink-0">App đang nghe</span>
      <div className="flex gap-[2.5px] items-end flex-1" style={{ height: 16 }}>
        {Array.from({ length: BAR }).map((_, i) => {
          const on = i < lit;
          const col = i < BAR * 0.6 ? '#22c55e' : i < BAR * 0.85 ? '#f59e0b' : '#ef4444';
          return (
            <div key={i} className="flex-1 rounded-[2px] transition-all duration-75"
              style={{ height: on ? `${30 + (i / BAR) * 70}%` : '12%', background: on ? col : '#0d1d30' }}
            />
          );
        })}
      </div>
      <span className="text-[11px] font-mono text-sky-500 flex-shrink-0 tabular-nums w-14 text-right">
        {visible && detectedFreq > 0 ? `${detectedFreq}Hz` : ''}
      </span>
    </div>
  );
}

// ── CSS ────────────────────────────────────────────────────────────────────
const PULSE_CSS = `
@keyframes stringPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.72; }
}
.string-pulse { animation: stringPulse 1.6s ease-in-out infinite; }
`;

// ── Guitar voicings: MIDI notes per string (E2=40 A2=45 D3=50 G3=55 B3=59 E4=64) ──
// Standard open-position fingerings verified against chord formulas.
// -1 = muted string. Fret = MIDI - open_string_MIDI.
const CHORD_VOICINGS: Record<string, number[]> = {
  // E major (E G# B): frets 0-2-2-1-0-0
  'E':  [40, 47, 52, 56, 59, 64],
  // E minor (E G B): frets 0-2-2-0-0-0
  'Em': [40, 47, 52, 55, 59, 64],
  // A major (A C# E): frets x-0-2-2-2-0
  'A':  [-1, 45, 52, 57, 61, 64],
  // A minor (A C E): frets x-0-2-2-1-0
  'Am': [-1, 45, 52, 57, 60, 64],
  // D major (D F# A): frets x-x-0-2-3-2
  'D':  [-1, -1, 50, 57, 62, 66],
  // D minor (D F A): frets x-x-0-2-3-1
  'Dm': [-1, -1, 50, 57, 62, 65],
  // G major (G B D): frets 3-2-0-0-0-3
  'G':  [43, 47, 50, 55, 59, 67],
  // C major (C E G): frets x-3-2-0-1-0
  'C':  [-1, 48, 52, 55, 60, 64],
  // F major barre (F A C): frets 1-3-3-2-1-1
  'F':  [41, 48, 53, 57, 60, 65],
  // B7 (B D# F# A): frets x-2-1-2-0-2
  'B7': [-1, 47, 51, 57, 59, 66],
  // E7 (E G# B D): frets 0-2-0-1-0-0
  'E7': [40, 47, 50, 56, 59, 64],
  // A7 (A C# E G): frets x-0-2-0-2-0
  'A7': [-1, 45, 52, 55, 61, 64],
  // D7 (D F# A C): frets x-x-0-2-1-2
  'D7': [-1, -1, 50, 57, 60, 66],
  // G7 (G B D F): frets 3-2-0-0-0-1
  'G7': [43, 47, 50, 55, 59, 65],
};

// ── Karplus-Strong: renders a plucked string into a Float32Array ─────────────
// Classic algorithm used in guitar synthesisers:
// 1) Fill a ring buffer (length = 1/freq seconds) with white noise
// 2) Each output sample = average of two consecutive ring-buffer samples * decay
// The low-pass averaging mimics the string's mechanical damping.
function buildKarplusBuffer(sampleRate: number, freq: number, stringIdx: number): Float32Array {
  const N = Math.max(2, Math.round(sampleRate / freq)); // ring length ≈ 1 period
  // Higher strings decay faster (lower decay → faster fade)
  // Decay range: 0.996 (low E, ~3s) to 0.991 (high e, ~1.5s)
  const decay = 0.996 - stringIdx * 0.001;
  const durationSec = 3.0;
  const totalLen = Math.ceil(sampleRate * durationSec);

  // Ring buffer seeded with white noise
  const ring = new Float32Array(N);
  const brightness = 0.6 + (stringIdx / 5) * 0.35;
  for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * brightness;

  const out = new Float32Array(totalLen);
  for (let n = 0; n < totalLen; n++) {
    const i0 = n % N;
    const i1 = (n + 1) % N;
    const v = decay * (ring[i0] + ring[i1]) * 0.5;
    ring[i0] = v;
    out[n] = v;
  }
  return out;
}

// Cache pre-rendered chord AudioBuffers (keyed by chord name)
const chordBufferCache = new Map<string, AudioBuffer>();

async function buildChordBuffer(chordName: string): Promise<AudioBuffer | null> {
  if (chordBufferCache.has(chordName)) return chordBufferCache.get(chordName)!;

  const voicing = CHORD_VOICINGS[chordName];
  if (!voicing) return null;

  const SR = 44100;
  const STRUM_GAP = 0.038; // seconds between each string
  const STRING_DUR = 3.0;
  const activeStrings = voicing.map((m, i) => ({ midi: m, idx: i })).filter(s => s.midi >= 0);
  const totalLen = Math.ceil(SR * (STRUM_GAP * (voicing.length - 1) + STRING_DUR));

  const offCtx = new OfflineAudioContext(1, totalLen, SR);

  const masterGain = offCtx.createGain();
  masterGain.gain.value = 1.0 / Math.sqrt(activeStrings.length); // normalise by string count
  masterGain.connect(offCtx.destination);

  activeStrings.forEach(({ midi, idx }) => {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const ksData = buildKarplusBuffer(SR, freq, idx);

    const buf = offCtx.createBuffer(1, ksData.length, SR);
    buf.copyToChannel(ksData, 0);

    const src = offCtx.createBufferSource();
    src.buffer = buf;

    // Per-string velocity: bass strings louder, add slight randomness
    const vel = (0.72 - idx * 0.035) * (0.88 + Math.random() * 0.12);
    const g = offCtx.createGain();
    g.gain.value = vel;

    src.connect(g);
    g.connect(masterGain);
    src.start(idx * STRUM_GAP);
  });

  const rendered = await offCtx.startRendering();
  chordBufferCache.set(chordName, rendered);
  return rendered;
}

// ── useChordPreview ──────────────────────────────────────────────────────────
function useChordPreview() {
  const ctxRef = useRef<AudioContext | null>(null);

  function getCtx() {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }

  const play = useCallback(async (chordName: string) => {
    const ctx = getCtx();
    // Always resume — browsers suspend AudioContext until user gesture
    if (ctx.state !== 'running') await ctx.resume();

    const buf = await buildChordBuffer(chordName);
    if (!buf) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(ctx.currentTime);
  }, []);

  return play;
}

// ── StrumPractice ──────────────────────────────────────────────────────────
function StrumPractice({ chord }: { chord: ChordConfig }) {
  const { state, start, stop, reset } = useChordDetector(chord.name);
  const tagStyle   = TAG_COLOR[chord.tag] ?? TAG_COLOR.major;
  const playPreview = useChordPreview();
  const [previewing, setPreviewing] = useState(false);

  const isListening = state.phase === 'listening';
  const isCorrect   = state.phase === 'correct';
  const isIncorrect = state.phase === 'incorrect';
  const isIdle      = state.phase === 'idle';

  const CHROMA_LABELS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  // Ring: ~10% smaller than before (220 → 198)
  const SIZE = 198;
  const cx = SIZE / 2, cy = SIZE / 2;
  const ringR = 68;

  const handleBtn = () => {
    if (isListening)             { stop();  return; }
    if (isCorrect || isIncorrect){ reset(); return; }
    start();
  };

  const handlePreview = async () => {
    if (previewing) return;
    setPreviewing(true);
    try {
      await playPreview(chord.name);
    } finally {
      setTimeout(() => setPreviewing(false), 1600);
    }
  };

  const progressArc = () => {
    const frac = Math.min(state.confirmedFrames / STRUM_FRAMES_NEEDED, 1);
    if (frac <= 0) return '';
    const r = ringR + 11;
    const a0 = -Math.PI / 2;
    const a1 = a0 + frac * 2 * Math.PI;
    if (frac >= 1) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
    return `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;
  };

  const BAR = 22;
  const norm = Math.max(0, Math.min(1, (state.rmsDb + 65) / 55));
  const lit  = Math.round(norm * BAR);

  const accentCol = isCorrect ? '#22c55e' : isIncorrect ? '#ef4444' : '#f59e0b';
  const borderCol = isCorrect ? '#059669' : isIncorrect ? '#dc2626' : isListening ? '#92400e' : '#0f1e33';

  // Diagram natural size: W = 24 + 5*36 + 30 = 234, H ≈ 228
  // Scale to fit the right column (~46% of card width after ring+gap)
  const DIAGRAM_SCALE = 0.62;
  const DIAGRAM_W = 234 * DIAGRAM_SCALE; // ~145
  const DIAGRAM_H = 228 * DIAGRAM_SCALE; // ~141

  // Desktop: bigger ring and diagram
  const SIZE_LG = 280;
  const cx_lg = SIZE_LG / 2, cy_lg = SIZE_LG / 2;
  const ringR_lg = 96;

  const progressArcLg = () => {
    const frac = Math.min(state.confirmedFrames / STRUM_FRAMES_NEEDED, 1);
    if (frac <= 0) return '';
    const r = ringR_lg + 15;
    const a0 = -Math.PI / 2;
    const a1 = a0 + frac * 2 * Math.PI;
    if (frac >= 1) return `M ${cx_lg} ${cy_lg - r} A ${r} ${r} 0 1 1 ${cx_lg - 0.01} ${cy_lg - r} Z`;
    return `M ${cx_lg + r * Math.cos(a0)} ${cy_lg + r * Math.sin(a0)} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${cx_lg + r * Math.cos(a1)} ${cy_lg + r * Math.sin(a1)}`;
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header row: chord name + tag ── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-baseline gap-3">
          <span className="text-4xl lg:text-5xl font-black text-white tracking-tight">{chord.name}</span>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: tagStyle.bg, border: `1px solid ${tagStyle.border}`, color: tagStyle.text }}
          >
            {chord.viName}
          </span>
          <span className="hidden lg:block text-sm text-slate-600 font-medium">{chord.type}</span>
        </div>
        <span className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest">Chế độ quạt</span>
      </div>

      {/* ── Desktop: 2-column | Mobile: single column ── */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-5">

        {/* ── LEFT: chroma ring + diagram ── */}
        <div
          className="rounded-3xl border transition-all duration-500 overflow-hidden flex-shrink-0"
          style={{
            background: '#07101d',
            borderColor: borderCol,
            boxShadow: isCorrect ? '0 0 48px #05966924' : isListening ? '0 0 32px #f59e0b0e' : 'none',
          }}
        >
          {/* Desktop visual */}
          <div className="hidden lg:flex flex-col items-center px-6 pt-6 pb-5 gap-6">
            {/* Big chroma ring */}
            <svg width={SIZE_LG} height={SIZE_LG} viewBox={`0 0 ${SIZE_LG} ${SIZE_LG}`}>
              <circle cx={cx_lg} cy={cy_lg} r={ringR_lg + 15} fill="none" stroke="#0d1d30" strokeWidth={8} />
              {isListening && state.confirmedFrames > 0 && (
                <path d={progressArcLg()} fill="none"
                  stroke={state.score > 0.65 ? '#22c55e' : '#f59e0b'}
                  strokeWidth={8} strokeLinecap="round"
                  style={{ transition: 'stroke 300ms' }}
                />
              )}
              {isCorrect   && <circle cx={cx_lg} cy={cy_lg} r={ringR_lg + 15} fill="none" stroke="#22c55e" strokeWidth={8} opacity={0.85} />}
              {isIncorrect && <circle cx={cx_lg} cy={cy_lg} r={ringR_lg + 15} fill="none" stroke="#ef4444" strokeWidth={8} opacity={0.6} />}
              {CHROMA_LABELS.map((label, i) => {
                const angle    = (i / 12) * 2 * Math.PI - Math.PI / 2;
                const val      = state.chroma[i] ?? 0;
                const isActive = val > 0.12;
                const inner    = ringR_lg - 2;
                const outer    = inner + val * 58;
                const x1 = cx_lg + inner * Math.cos(angle);
                const y1 = cy_lg + inner * Math.sin(angle);
                const x2 = cx_lg + outer * Math.cos(angle);
                const y2 = cy_lg + outer * Math.sin(angle);
                const lx = cx_lg + (ringR_lg + 30) * Math.cos(angle);
                const ly = cy_lg + (ringR_lg + 30) * Math.sin(angle);
                return (
                  <g key={label}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={isActive ? accentCol : '#1a2f4a'}
                      strokeWidth={isActive ? 4 : 2} strokeLinecap="round"
                      style={{ transition: 'stroke 200ms' }}
                    />
                    <text x={lx} y={ly + 4} textAnchor="middle" fontSize={10}
                      fontWeight={isActive ? '800' : '500'}
                      fill={isActive ? accentCol : '#263d56'}
                      style={{ transition: 'fill 200ms' }}
                    >{label}</text>
                  </g>
                );
              })}
              <circle cx={cx_lg} cy={cy_lg} r={ringR_lg - 16} fill="#040c16" />
              {isIdle && <>
                <text x={cx_lg} y={cy_lg + 4} textAnchor="middle" fontSize={34} fontWeight="900" fill="#1a3050">{chord.name}</text>
                <text x={cx_lg} y={cy_lg + 24} textAnchor="middle" fontSize={11} fill="#1a3050">nhấn bắt đầu</text>
              </>}
              {isListening && <>
                <text x={cx_lg} y={cy_lg + 6} textAnchor="middle" fontSize={28} fontWeight="900"
                  fill={state.score > 0.5 ? '#4ade80' : '#f59e0b'} style={{ transition: 'fill 300ms' }}
                >{state.topGuess || '···'}</text>
                <text x={cx_lg} y={cy_lg + 26} textAnchor="middle" fontSize={13} fill="#374151">
                  {state.score > 0 ? `${Math.round(state.score * 100)}%` : ''}
                </text>
              </>}
              {isCorrect && <>
                <text x={cx_lg} y={cy_lg + 4} textAnchor="middle" fontSize={32} fontWeight="900" fill="#22c55e">{chord.name}</text>
                <text x={cx_lg} y={cy_lg + 24} textAnchor="middle" fontSize={12} fill="#4ade80">Chính xác!</text>
              </>}
              {isIncorrect && <>
                <text x={cx_lg} y={cy_lg + 4} textAnchor="middle" fontSize={18} fontWeight="700" fill="#ef4444">Hết giờ</text>
                <text x={cx_lg} y={cy_lg + 22} textAnchor="middle" fontSize={11} fill="#7f1d1d">thử lại nhé</text>
              </>}
            </svg>

            {/* Big diagram below ring */}
            <div style={{ transform: 'scale(1.15)', transformOrigin: 'top center', width: 234, height: 228 * 1.15, overflow: 'visible' }}>
              <ChordDiagram
                chord={chord}
                statuses={chord.strings.map(() => 'pending' as StringStatus)}
                currentStep={-1}
                listening={false}
                done={false}
                refLitIdx={-1}
                refFadingIdx={-1}
              />
            </div>
          </div>

          {/* Mobile: original full card layout */}
          <div className="lg:hidden">
            {/* Ring + diagram row */}
            <div className="flex items-center px-3 pt-4 pb-3 gap-3">
              {/* Chroma ring */}
              <div className="flex-shrink-0" style={{ width: SIZE }}>
                <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                  <circle cx={cx} cy={cy} r={ringR + 11} fill="none" stroke="#0d1d30" strokeWidth={6} />
                  {isListening && state.confirmedFrames > 0 && (
                    <path d={progressArc()} fill="none"
                      stroke={state.score > 0.65 ? '#22c55e' : '#f59e0b'}
                      strokeWidth={6} strokeLinecap="round"
                      style={{ transition: 'stroke 300ms' }}
                    />
                  )}
                  {isCorrect   && <circle cx={cx} cy={cy} r={ringR + 11} fill="none" stroke="#22c55e" strokeWidth={6} opacity={0.85} />}
                  {isIncorrect && <circle cx={cx} cy={cy} r={ringR + 11} fill="none" stroke="#ef4444" strokeWidth={6} opacity={0.6} />}
                  {CHROMA_LABELS.map((label, i) => {
                    const angle    = (i / 12) * 2 * Math.PI - Math.PI / 2;
                    const val      = state.chroma[i] ?? 0;
                    const isActive = val > 0.12;
                    const inner    = ringR - 2;
                    const outer    = inner + val * 42;
                    const x1 = cx + inner * Math.cos(angle);
                    const y1 = cy + inner * Math.sin(angle);
                    const x2 = cx + outer * Math.cos(angle);
                    const y2 = cy + outer * Math.sin(angle);
                    const lx = cx + (ringR + 23) * Math.cos(angle);
                    const ly = cy + (ringR + 23) * Math.sin(angle);
                    return (
                      <g key={label}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2}
                          stroke={isActive ? accentCol : '#1a2f4a'}
                          strokeWidth={isActive ? 3 : 1.5} strokeLinecap="round"
                          style={{ transition: 'stroke 200ms' }}
                        />
                        <text x={lx} y={ly + 3.5} textAnchor="middle" fontSize={8}
                          fontWeight={isActive ? '800' : '500'}
                          fill={isActive ? accentCol : '#263d56'}
                          style={{ transition: 'fill 200ms' }}
                        >{label}</text>
                      </g>
                    );
                  })}
                  <circle cx={cx} cy={cy} r={ringR - 13} fill="#040c16" />
                  {isIdle && <>
                    <text x={cx} y={cy + 2} textAnchor="middle" fontSize={26} fontWeight="900" fill="#1a3050">{chord.name}</text>
                    <text x={cx} y={cy + 19} textAnchor="middle" fontSize={8.5} fill="#1a3050">nhấn bắt đầu</text>
                  </>}
                  {isListening && <>
                    <text x={cx} y={cy + 4} textAnchor="middle" fontSize={20} fontWeight="900"
                      fill={state.score > 0.5 ? '#4ade80' : '#f59e0b'} style={{ transition: 'fill 300ms' }}
                    >{state.topGuess || '···'}</text>
                    <text x={cx} y={cy + 20} textAnchor="middle" fontSize={10} fill="#374151">
                      {state.score > 0 ? `${Math.round(state.score * 100)}%` : ''}
                    </text>
                  </>}
                  {isCorrect && <>
                    <text x={cx} y={cy + 2} textAnchor="middle" fontSize={24} fontWeight="900" fill="#22c55e">{chord.name}</text>
                    <text x={cx} y={cy + 18} textAnchor="middle" fontSize={9.5} fill="#4ade80">Chính xác!</text>
                  </>}
                  {isIncorrect && <>
                    <text x={cx} y={cy + 2} textAnchor="middle" fontSize={13} fontWeight="700" fill="#ef4444">Hết giờ</text>
                    <text x={cx} y={cy + 17} textAnchor="middle" fontSize={9} fill="#7f1d1d">thử lại nhé</text>
                  </>}
                </svg>
              </div>

              {/* Chord diagram */}
              <div className="flex-1 flex items-center justify-center opacity-90" style={{ minWidth: 0 }}>
                <div style={{ transform: `scale(${DIAGRAM_SCALE})`, transformOrigin: 'top center', width: 234, height: DIAGRAM_H / DIAGRAM_SCALE, overflow: 'visible' }}>
                  <ChordDiagram
                    chord={chord}
                    statuses={chord.strings.map(() => 'pending' as StringStatus)}
                    currentStep={-1}
                    listening={false}
                    done={false}
                    refLitIdx={-1}
                    refFadingIdx={-1}
                  />
                </div>
              </div>
            </div>

            {/* Status banner */}
            <div className="mx-3 mb-3 px-4 py-3 rounded-2xl flex items-center justify-center"
              style={{
                background: isCorrect ? 'rgba(34,197,94,0.08)' : isIncorrect ? 'rgba(239,68,68,0.08)' : isListening ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isCorrect ? '#14532d' : isIncorrect ? '#7f1d1d' : isListening ? '#78350f' : '#0f1e33'}`,
                minHeight: 46,
              }}
            >
              {isIdle && <p className="text-center text-slate-500 text-sm leading-snug">Nhấn <span className="text-slate-200 font-semibold">Bắt đầu</span> rồi quạt hợp âm <span className="text-amber-400 font-bold">{chord.name}</span></p>}
              {isListening && <p className="text-center text-amber-300 text-base font-semibold leading-snug">Quạt hợp âm <span className="text-white font-black">{chord.name}</span><span className="text-slate-500 text-sm font-normal"> · {chord.type}</span></p>}
              {isCorrect && <p className="text-emerald-400 font-black text-lg text-center">{chord.doneText.replace('rải', 'quạt')}</p>}
              {isIncorrect && <p className="text-red-400 font-semibold text-sm text-center leading-snug">Hết giờ — nhớ bấm đúng thế tay <span className="font-black text-white">{chord.name}</span></p>}
            </div>

            {/* Volume meter */}
            <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: isListening ? 56 : 0, opacity: isListening ? 1 : 0 }}>
              <div className="px-3 pb-3">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl" style={{ background: '#050e1a', border: '1px solid #0c1a2e' }}>
                  <Mic size={12} color="#374151" className="flex-shrink-0" />
                  <div className="flex gap-[2px] items-end flex-1" style={{ height: 18 }}>
                    {Array.from({ length: BAR }).map((_, i) => {
                      const on  = i < lit;
                      const col = i < BAR * 0.55 ? '#22c55e' : i < BAR * 0.8 ? '#f59e0b' : '#ef4444';
                      return <div key={i} className="flex-1 rounded-[2px] transition-all duration-75" style={{ height: on ? `${25 + (i / BAR) * 75}%` : '10%', background: on ? col : '#0c1b2e' }} />;
                    })}
                  </div>
                  <span className="text-[10px] text-slate-700 font-mono flex-shrink-0">{state.rmsDb > -90 ? `${Math.round(state.rmsDb)} dB` : '––'}</span>
                </div>
              </div>
            </div>

            {/* Candidate chords */}
            <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: isListening && state.allScores.length > 0 ? 52 : 0, opacity: isListening && state.allScores.length > 0 ? 1 : 0 }}>
              <div className="px-3 pb-3">
                <div className="flex gap-1.5 justify-center flex-wrap">
                  {state.allScores.map(({ name, score: s }) => {
                    const isTarget = name === chord.name;
                    return (
                      <div key={name} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200"
                        style={{ background: isTarget ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isTarget ? '#14532d' : '#0f1e33'}`, color: isTarget ? '#4ade80' : '#374151' }}
                      >
                        <span>{name}</span>
                        <span className="font-mono opacity-60">{Math.round(s * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Rogue note warning */}
            <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: isListening && state.rogueNotes.length > 0 ? 64 : 0, opacity: isListening && state.rogueNotes.length > 0 ? 1 : 0 }}>
              <div className="px-3 pb-3">
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid #7f1d1d' }}>
                  <span className="text-red-500 flex-shrink-0" style={{ fontSize: 15, lineHeight: 1 }}>⚠</span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-bold text-red-400">Nốt lạ — không thuộc {chord.name}</span>
                    <span className="text-[11px] text-red-700 font-mono tracking-wide">{state.rogueNotes.join(' · ')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: controls panel (desktop only) ── */}
        <div className="hidden lg:flex flex-col gap-3 flex-1 min-w-0">

          {/* Status banner */}
          <div
            className="rounded-2xl border px-5 py-4 flex items-center justify-center"
            style={{
              background: isCorrect ? 'rgba(34,197,94,0.08)'
                : isIncorrect ? 'rgba(239,68,68,0.08)'
                : isListening ? 'rgba(245,158,11,0.06)'
                : '#07101d',
              borderColor: isCorrect ? '#14532d' : isIncorrect ? '#7f1d1d' : isListening ? '#78350f' : '#0f1e33',
              minHeight: 60,
            }}
          >
            {isIdle && (
              <p className="text-center text-slate-500 text-sm leading-snug">
                Nhấn <span className="text-slate-200 font-semibold">Bắt đầu</span> rồi quạt hợp âm{' '}
                <span className="text-amber-400 font-bold">{chord.name}</span>
              </p>
            )}
            {isListening && (
              <p className="text-center text-amber-300 text-base font-semibold">
                Quạt hợp âm <span className="text-white font-black">{chord.name}</span>
                <span className="text-slate-500 text-sm font-normal"> · {chord.type}</span>
              </p>
            )}
            {isCorrect && (
              <p className="text-emerald-400 font-black text-lg text-center">
                {chord.doneText.replace('rải', 'quạt')}
              </p>
            )}
            {isIncorrect && (
              <p className="text-red-400 font-semibold text-sm text-center">
                Hết giờ — nhớ bấm đúng thế tay <span className="font-black text-white">{chord.name}</span>
              </p>
            )}
          </div>

          {/* Volume meter */}
          <div className="overflow-hidden transition-all duration-300"
            style={{ maxHeight: isListening ? 64 : 0, opacity: isListening ? 1 : 0 }}>
            <div className="rounded-2xl border px-4 py-3" style={{ background: '#07101d', borderColor: '#0f1e33' }}>
              <div className="flex items-center gap-3">
                <Mic size={12} color="#374151" className="flex-shrink-0" />
                <div className="flex gap-[2px] items-end flex-1" style={{ height: 20 }}>
                  {Array.from({ length: BAR }).map((_, i) => {
                    const on  = i < lit;
                    const col = i < BAR * 0.55 ? '#22c55e' : i < BAR * 0.8 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={i} className="flex-1 rounded-[2px] transition-all duration-75"
                        style={{ height: on ? `${25 + (i / BAR) * 75}%` : '10%', background: on ? col : '#0c1b2e' }}
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-700 font-mono flex-shrink-0">
                  {state.rmsDb > -90 ? `${Math.round(state.rmsDb)} dB` : '––'}
                </span>
              </div>
            </div>
          </div>

          {/* Candidate chords */}
          <div className="overflow-hidden transition-all duration-300"
            style={{ maxHeight: isListening && state.allScores.length > 0 ? 64 : 0, opacity: isListening && state.allScores.length > 0 ? 1 : 0 }}>
            <div className="rounded-2xl border px-4 py-3" style={{ background: '#07101d', borderColor: '#0f1e33' }}>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {state.allScores.map(({ name, score: s }) => {
                  const isTarget = name === chord.name;
                  return (
                    <div key={name}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200"
                      style={{
                        background: isTarget ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isTarget ? '#14532d' : '#0f1e33'}`,
                        color: isTarget ? '#4ade80' : '#374151',
                      }}
                    >
                      <span>{name}</span>
                      <span className="font-mono opacity-60">{Math.round(s * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rogue notes (desktop duplicate for right column) */}
          <div className="overflow-hidden transition-all duration-300"
            style={{ maxHeight: isListening && state.rogueNotes.length > 0 ? 64 : 0, opacity: isListening && state.rogueNotes.length > 0 ? 1 : 0 }}>
            <div className="rounded-2xl border px-4 py-3" style={{ background: 'rgba(239,68,68,0.07)', borderColor: '#7f1d1d' }}>
              <div className="flex items-center gap-3">
                <span className="text-red-500 flex-shrink-0" style={{ fontSize: 15 }}>⚠</span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-bold text-red-400">Nốt lạ — không thuộc {chord.name}</span>
                  <span className="text-[11px] text-red-700 font-mono tracking-wide">{state.rogueNotes.join(' · ')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chord tones info (desktop) */}
          <div className="hidden lg:block rounded-2xl border px-5 py-4" style={{ background: '#07101d', borderColor: '#0f1e33' }}>
            <p className="text-[11px] text-slate-700 font-semibold uppercase tracking-widest mb-3">Nốt của hợp âm</p>
            <div className="flex gap-2 flex-wrap">
              {chord.type.split('·')[1]?.trim().split('–').map(note => (
                <span key={note} className="px-3 py-1.5 rounded-xl text-sm font-black"
                  style={{ background: tagStyle.bg, border: `1.5px solid ${tagStyle.border}`, color: tagStyle.text }}>
                  {note.trim()}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-700 mt-3">{chord.type.split('·')[0].trim()}</p>
          </div>

          {/* Controls */}
          <div className="flex gap-2.5">
            <button
              onClick={handlePreview}
              disabled={previewing || isListening}
              className="flex items-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-sm border transition-all duration-150 active:scale-[0.96] flex-shrink-0 disabled:opacity-40"
              style={{
                background: previewing ? 'rgba(34,197,94,0.10)' : 'rgba(245,158,11,0.07)',
                borderColor: previewing ? '#14532d' : '#92400e',
                color: previewing ? '#4ade80' : '#f59e0b',
              }}
            >
              {previewing ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
              <span>{previewing ? 'Đang phát' : 'Nghe mẫu'}</span>
            </button>

            <button
              onClick={handleBtn}
              className="flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-black text-base tracking-wide transition-all duration-150 active:scale-[0.97]"
              style={{
                background: isListening ? 'linear-gradient(135deg,#991b1b,#7f1d1d)'
                  : isCorrect ? 'linear-gradient(135deg,#065f46,#047857)'
                  : isIncorrect ? 'linear-gradient(135deg,#991b1b,#7f1d1d)'
                  : 'linear-gradient(135deg,#15803d,#166534)',
                color: '#fff',
                boxShadow: isListening ? '0 4px 20px #ef444430'
                  : isCorrect ? '0 4px 20px #22c55e30'
                  : '0 4px 20px #22c55e28',
              }}
            >
              {isListening  && <><MicOff    size={18} /><span>Dừng nghe</span></>}
              {isIdle       && <><Mic       size={18} /><span>Bắt đầu quạt</span></>}
              {isCorrect    && <><RotateCcw size={17} /><span>Thử hợp âm khác</span></>}
              {isIncorrect  && <><RotateCcw size={17} /><span>Thử lại</span></>}
            </button>
          </div>

        </div>
      </div>

      {/* ── Mobile controls ── */}
      <div className="lg:hidden flex gap-2.5 mb-safe">
        <button
          onClick={handlePreview}
          disabled={previewing || isListening}
          className="flex items-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-sm border transition-all duration-150 active:scale-[0.96] flex-shrink-0 disabled:opacity-40"
          style={{
            background: previewing ? 'rgba(34,197,94,0.10)' : 'rgba(245,158,11,0.07)',
            borderColor: previewing ? '#14532d' : '#92400e',
            color: previewing ? '#4ade80' : '#f59e0b',
          }}
        >
          {previewing ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
          <span>{previewing ? 'Đang phát' : 'Nghe mẫu'}</span>
        </button>

        <button
          onClick={handleBtn}
          className="flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-black text-base tracking-wide transition-all duration-150 active:scale-[0.97]"
          style={{
            background: isListening ? 'linear-gradient(135deg,#991b1b,#7f1d1d)'
              : isCorrect ? 'linear-gradient(135deg,#065f46,#047857)'
              : isIncorrect ? 'linear-gradient(135deg,#991b1b,#7f1d1d)'
              : 'linear-gradient(135deg,#15803d,#166534)',
            color: '#fff',
            boxShadow: isListening ? '0 4px 20px #ef444430'
              : isCorrect ? '0 4px 20px #22c55e30'
              : '0 4px 20px #22c55e28',
          }}
        >
          {isListening  && <><MicOff    size={18} /><span>Dừng nghe</span></>}
          {isIdle       && <><Mic       size={18} /><span>Bắt đầu quạt</span></>}
          {isCorrect    && <><RotateCcw size={17} /><span>Thử hợp âm khác</span></>}
          {isIncorrect  && <><RotateCcw size={17} /><span>Thử lại</span></>}
        </button>
      </div>
    </div>
  );
}

// ── ChordPractice ──────────────────────────────────────────────────────────
function ChordPractice({ chord }: { chord: ChordConfig }) {
  const { state, start, stop, reset, resetAndStart } = useStringDetector(chord.sequence);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const timersRef    = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [refLitIdx, setRefLitIdx]       = useState(-1);
  const [refFadingIdx, setRefFadingIdx] = useState(-1);
  const [refPlaying, setRefPlaying]     = useState(false);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed')
      audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const stopRef = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRefPlaying(false);
    setRefLitIdx(-1);
    setRefFadingIdx(-1);
  }, []);

  const handleRefButton = useCallback(() => {
    if (refPlaying) { stopRef(); reset(); return; }
    setRefPlaying(true);
    const ctx = getCtx();
    const now = ctx.currentTime;
    const seq = chord.sequence;
    const NOTE_DUR  = 1.6;
    const NOTE_GAP  = 0.45;
    const FADE_LEAD = 280;
    const FADE_DUR  = 380;
    seq.forEach((s, i) => {
      const onsetMs   = i * NOTE_GAP * 1000;
      const nextOnMs  = (i + 1) * NOTE_GAP * 1000;
      synthNote(ctx, s.freq, now + i * NOTE_GAP, NOTE_DUR);
      const tOn = setTimeout(() => { setRefLitIdx(i); setRefFadingIdx(-1); }, onsetMs);
      const fadeStartMs = i < seq.length - 1
        ? Math.max(onsetMs + 200, nextOnMs - FADE_LEAD)
        : onsetMs + NOTE_DUR * 0.75 * 1000;
      const tFade  = setTimeout(() => { setRefLitIdx(-1); setRefFadingIdx(i); }, fadeStartMs);
      const tClear = setTimeout(() => { setRefFadingIdx(p => p === i ? -1 : p); }, fadeStartMs + FADE_DUR);
      timersRef.current.push(tOn, tFade, tClear);
    });
    const totalMs = (seq.length - 1) * NOTE_GAP * 1000 + NOTE_DUR * 1000 + 400;
    const tEnd = setTimeout(() => { setRefPlaying(false); setRefLitIdx(-1); setRefFadingIdx(-1); }, totalMs);
    timersRef.current.push(tEnd);
  }, [refPlaying, chord.sequence, getCtx, stopRef, reset]);

  const seq = chord.sequence;
  const targetFreq = state.currentStep < seq.length ? seq[state.currentStep].freq : 0;
  const curSeqItem = state.currentStep < seq.length ? seq[state.currentStep] : null;
  const showSignal = state.listening && !state.done;
  const tagStyle = TAG_COLOR[chord.tag] ?? TAG_COLOR.major;

  const cardBorder = state.done ? '#059669' : refPlaying ? '#b45309' : state.listening ? '#92400e' : '#0f1e33';
  const cardShadow = state.done ? '0 0 40px #05966918' : (refPlaying || state.listening) ? '0 0 28px #f59e0b0c' : 'none';

  return (
    <div className="flex flex-col gap-4">

      {/* ── Chord name header ── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-baseline gap-3">
          <span className="text-4xl lg:text-5xl font-black text-white tracking-tight">{chord.name}</span>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: tagStyle.bg, border: `1px solid ${tagStyle.border}`, color: tagStyle.text }}
          >
            {chord.viName}
          </span>
          <span className="hidden lg:block text-sm text-slate-600 font-medium">{chord.type}</span>
        </div>
        <div className="flex gap-1.5 items-center">
          {seq.map((_, i) => {
            const done_ = state.status[i] === 'correct';
            const cur_ = i === state.currentStep && !state.done && state.listening;
            return (
              <div key={i} className="rounded-full transition-all duration-300"
                style={{
                  width: cur_ ? 10 : done_ ? 9 : 7,
                  height: cur_ ? 10 : done_ ? 9 : 7,
                  background: done_ ? '#22c55e' : cur_ ? '#f59e0b' : '#1e2d45',
                  boxShadow: cur_ ? '0 0 8px #f59e0b99' : done_ ? '0 0 6px #22c55e66' : 'none',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* ── Desktop: 2-column | Mobile: original single-column ── */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-5">

        {/* ── LEFT: chord diagram ── */}
        <div
          className={`rounded-2xl border transition-all duration-500 overflow-hidden flex-shrink-0 ${state.listening && !state.done ? 'string-pulse' : ''}`}
          style={{
            background: '#07101d',
            borderColor: cardBorder,
            boxShadow: cardShadow,
          }}
        >
          {/* Desktop: bigger diagram */}
          <div className="hidden lg:flex justify-center px-6 pt-6 pb-4">
            <div style={{ transform: 'scale(1.25)', transformOrigin: 'top center', width: 234, height: 228 * 1.25, overflow: 'visible' }}>
              <ChordDiagram
                chord={chord}
                statuses={state.status}
                currentStep={state.currentStep}
                listening={state.listening}
                done={state.done}
                refLitIdx={refLitIdx}
                refFadingIdx={refFadingIdx}
              />
            </div>
          </div>

          {/* Mobile: original full card with diagram + hint + progress + etc */}
          <div className="lg:hidden">
            {/* Diagram */}
            <div className="flex justify-center pt-4 pb-1">
              <ChordDiagram
                chord={chord}
                statuses={state.status}
                currentStep={state.currentStep}
                listening={state.listening}
                done={state.done}
                refLitIdx={refLitIdx}
                refFadingIdx={refFadingIdx}
              />
            </div>

            {/* Divider */}
            <div className="mx-4 h-px bg-[#0f1e33]" />

            {/* Hint */}
            <div className="px-4 py-2.5 flex items-center justify-center" style={{ minHeight: 38 }}>
              <HintText state={state} chord={chord} />
            </div>

            {/* Progress bar */}
            <div className="px-4 pb-3">
              <div className="h-[3px] rounded-full bg-[#0a1525] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${(state.currentStep / seq.length) * 100}%`,
                    background: state.done ? '#22c55e' : 'linear-gradient(90deg,#f59e0b,#22c55e)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-700">{state.currentStep}/{seq.length} dây</span>
                {curSeqItem && !state.done && (
                  <span className="text-[10px] text-slate-600">Dây {curSeqItem.stringNum} · {curSeqItem.note}</span>
                )}
              </div>
            </div>

            {/* Accuracy */}
            <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: state.lastRating !== null ? 60 : 0 }}>
              <div className="px-4 pb-3">
                <AccuracyBadge
                  rating={state.lastRating}
                  cents={state.lastCents}
                  detectedFreq={state.detectedFreq}
                  targetFreq={state.currentStep > 0 ? seq[state.currentStep - 1].freq : targetFreq}
                />
              </div>
            </div>

            {/* Signal bar */}
            <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: showSignal ? 52 : 0 }}>
              <div className="px-3 pb-3">
                <SignalBar rmsDb={state.rmsDb} detectedFreq={state.detectedFreq} visible={showSignal} />
              </div>
            </div>

            {/* Done celebration */}
            {state.done && (
              <div className="flex justify-center gap-2.5 pb-4">
                {seq.map((s, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <CheckCircle size={15} className="text-emerald-500" />
                    <span className="text-[9px] text-emerald-600 font-bold">{s.note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop done celebration */}
          {state.done && (
            <div className="hidden lg:flex justify-center gap-3 pb-4 pt-1">
              {seq.map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <CheckCircle size={15} className="text-emerald-500" />
                  <span className="text-[9px] text-emerald-600 font-bold">{s.note}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: desktop controls panel ── */}
        <div className="hidden lg:flex flex-col gap-3 flex-1 min-w-0">

          {/* Hint */}
          <div
            className="rounded-2xl border px-5 py-4 flex items-center justify-center"
            style={{
              background: '#07101d',
              borderColor: state.done ? '#059669' : state.listening ? '#92400e44' : '#0f1e33',
              minHeight: 56,
            }}
          >
            <HintText state={state} chord={chord} />
          </div>

          {/* Progress bar */}
          <div className="rounded-2xl border px-5 py-4" style={{ background: '#07101d', borderColor: '#0f1e33' }}>
            <div className="flex justify-between mb-2">
              <span className="text-xs text-slate-600 font-semibold">Tiến độ rải</span>
              {curSeqItem && !state.done && (
                <span className="text-xs text-slate-500">Dây {curSeqItem.stringNum} · <span className="text-slate-400 font-bold">{curSeqItem.note}</span></span>
              )}
            </div>
            <div className="h-[5px] rounded-full bg-[#0a1525] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${(state.currentStep / seq.length) * 100}%`,
                  background: state.done ? '#22c55e' : 'linear-gradient(90deg,#f59e0b,#22c55e)',
                }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[11px] text-slate-700">{state.currentStep}/{seq.length} dây</span>
              <span className="text-[11px] text-slate-700">{Math.round((state.currentStep / seq.length) * 100)}%</span>
            </div>
          </div>

          {/* Accuracy */}
          <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: state.lastRating !== null ? 80 : 0 }}>
            <div className="rounded-2xl border px-5 py-3" style={{ background: '#07101d', borderColor: '#0f1e33' }}>
              <AccuracyBadge
                rating={state.lastRating}
                cents={state.lastCents}
                detectedFreq={state.detectedFreq}
                targetFreq={state.currentStep > 0 ? seq[state.currentStep - 1].freq : targetFreq}
              />
            </div>
          </div>

          {/* Signal bar */}
          <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: showSignal ? 60 : 0 }}>
            <div className="rounded-2xl border px-4 py-3" style={{ background: '#07101d', borderColor: '#0f1e33' }}>
              <SignalBar rmsDb={state.rmsDb} detectedFreq={state.detectedFreq} visible={showSignal} />
            </div>
          </div>

          {/* String list */}
          <div className="rounded-2xl border px-5 py-4" style={{ background: '#07101d', borderColor: '#0f1e33' }}>
            <p className="text-[11px] text-slate-700 font-semibold uppercase tracking-widest mb-3">Thứ tự rải</p>
            <div className="flex flex-col gap-2">
              {seq.map((s, i) => {
                const done_ = state.status[i] === 'correct';
                const cur_ = i === state.currentStep && !state.done && state.listening;
                return (
                  <div key={i} className="flex items-center gap-3 transition-all duration-200"
                    style={{ opacity: done_ ? 0.5 : 1 }}
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black"
                      style={{
                        background: done_ ? 'rgba(34,197,94,0.15)' : cur_ ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${done_ ? '#059669' : cur_ ? '#b45309' : '#0f1e33'}`,
                        color: done_ ? '#4ade80' : cur_ ? '#f59e0b' : '#3d5068',
                      }}
                    >
                      {done_ ? '✓' : i + 1}
                    </div>
                    <span className="text-xs font-bold" style={{ color: cur_ ? '#f59e0b' : done_ ? '#4ade80' : '#374151' }}>
                      Dây {s.stringNum}
                    </span>
                    <span className="text-xs font-mono" style={{ color: cur_ ? '#fbbf24' : '#1e3a5f' }}>{s.note}</span>
                    <span className="ml-auto text-[11px] text-slate-700">{s.fretLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop controls */}
          <div className="flex gap-2.5">
            <button
              onClick={handleRefButton}
              className="flex items-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-sm border transition-all duration-150 active:scale-[0.96] flex-shrink-0"
              style={{
                background: refPlaying ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.07)',
                borderColor: refPlaying ? '#7f1d1d' : '#92400e',
                color: refPlaying ? '#fca5a5' : '#f59e0b',
              }}
            >
              {refPlaying
                ? <><Square size={13} fill="currentColor" /><span>Dừng</span></>
                : <><Play size={13} fill="currentColor" /><span>Nghe mẫu</span></>}
            </button>

            {state.done ? (
              <button
                onClick={resetAndStart}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all duration-150 active:scale-[0.96]"
                style={{ background: 'linear-gradient(135deg,#065f46,#047857)', color: '#fff', boxShadow: '0 2px 20px #05966928' }}
              >
                <RotateCcw size={14} /><span>Làm lại từ đầu</span>
              </button>
            ) : (
              <button
                onClick={() => state.listening ? stop() : start()}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all duration-150 active:scale-[0.96]"
                style={{
                  background: state.listening ? 'linear-gradient(135deg,#991b1b,#7f1d1d)' : 'linear-gradient(135deg,#15803d,#166534)',
                  color: '#fff',
                  boxShadow: state.listening ? '0 2px 16px #ef444428' : '0 2px 20px #22c55e28',
                }}
              >
                {state.listening
                  ? <><MicOff size={15} /><span>Dừng nghe</span></>
                  : <><Mic size={15} /><span>Bắt đầu rải dây</span></>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile controls (outside card, below diagram) ── */}
      <div className="lg:hidden flex gap-2.5">
        <button
          onClick={handleRefButton}
          className="flex items-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-sm border transition-all duration-150 active:scale-[0.96] flex-shrink-0"
          style={{
            background: refPlaying ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.07)',
            borderColor: refPlaying ? '#7f1d1d' : '#92400e',
            color: refPlaying ? '#fca5a5' : '#f59e0b',
          }}
        >
          {refPlaying
            ? <><Square size={13} fill="currentColor" /><span>Dừng</span></>
            : <><Play size={13} fill="currentColor" /><span>Nghe mẫu</span></>}
        </button>

        {state.done ? (
          <button
            onClick={resetAndStart}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all duration-150 active:scale-[0.96]"
            style={{ background: 'linear-gradient(135deg,#065f46,#047857)', color: '#fff', boxShadow: '0 2px 20px #05966928' }}
          >
            <RotateCcw size={14} /><span>Làm lại từ đầu</span>
          </button>
        ) : (
          <button
            onClick={() => state.listening ? stop() : start()}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all duration-150 active:scale-[0.96]"
            style={{
              background: state.listening ? 'linear-gradient(135deg,#991b1b,#7f1d1d)' : 'linear-gradient(135deg,#15803d,#166534)',
              color: '#fff',
              boxShadow: state.listening ? '0 2px 16px #ef444428' : '0 2px 20px #22c55e28',
            }}
          >
            {state.listening
              ? <><MicOff size={15} /><span>Dừng nghe</span></>
              : <><Mic size={15} /><span>Bắt đầu rải dây</span></>}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Chord selector ─────────────────────────────────────────────────────────
const FILTER_TAGS = ['all', 'major', 'minor', 'dom7', 'barre'] as const;
type FilterTag = typeof FILTER_TAGS[number];
const FILTER_LABEL: Record<FilterTag, string> = {
  all: 'Tất cả', major: 'Trưởng', minor: 'Thứ', dom7: 'Bảy', barre: 'Barre',
};

type PracticeMode = 'strum' | 'pluck';

// ── App ────────────────────────────────────────────────────────────────────
export default function ChordsPage() {
  const [activeIdx, setActiveIdx]   = useState(0);
  const [filter, setFilter]         = useState<FilterTag>('all');
  const [mode, setMode]             = useState<PracticeMode>('pluck');

  const filtered = filter === 'all' ? ALL_CHORDS : ALL_CHORDS.filter(c => c.tag === filter);
  // Keep active index valid when filter changes
  const safeIdx = Math.min(activeIdx, filtered.length - 1);
  const activeChord = filtered[safeIdx] ?? ALL_CHORDS[0];

  const handleFilter = (f: FilterTag) => {
    setFilter(f);
    setActiveIdx(0);
  };

  const handleSelect = (idx: number) => {
    setActiveIdx(idx);
  };

  return (
    <div
      className="min-h-screen bg-[#040c16] text-white flex flex-col"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style dangerouslySetInnerHTML={{ __html: PULSE_CSS }} />

      {/* ════════════════ DESKTOP LAYOUT (lg+) ════════════════ */}
      <div className="hidden lg:flex h-screen overflow-hidden">

        {/* ── Left sidebar ── */}
        <aside
          className="flex flex-col flex-shrink-0 h-full border-r"
          style={{ width: 260, background: '#050d18', borderColor: '#0a1828' }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: '#0a1828' }}>
            <img
              src="/logo.png"
              alt="Logo"
              style={{
                width: 38, height: 38, flexShrink: 0, objectFit: 'contain',
                filter: 'brightness(0) saturate(100%) invert(28%) sepia(60%) saturate(500%) hue-rotate(100deg) brightness(0.85)',
              }}
            />
            <div>
              <h1 className="text-[14px] font-extrabold text-white tracking-tight leading-none">Guitar Thầy Văn Anh</h1>
              <p className="text-[10px] text-slate-600 mt-0.5 font-medium">Luyện hợp âm cơ bản</p>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setMode('pluck')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200"
                style={{
                  background: mode === 'pluck' ? 'rgba(34,197,94,0.12)' : 'transparent',
                  color: mode === 'pluck' ? '#4ade80' : '#374151',
                  border: `1.5px solid ${mode === 'pluck' ? '#14532d' : 'transparent'}`,
                }}
              >
                <Music2 size={16} />
                <span>Rải dây</span>
              </button>
              <button
                onClick={() => setMode('strum')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200"
                style={{
                  background: mode === 'strum' ? 'rgba(245,158,11,0.12)' : 'transparent',
                  color: mode === 'strum' ? '#f59e0b' : '#374151',
                  border: `1.5px solid ${mode === 'strum' ? '#92400e' : 'transparent'}`,
                }}
              >
                <Waves size={16} />
                <span>Quạt hợp âm</span>
              </button>
            </div>
          </div>

          <div className="mx-4 h-px bg-[#0a1828]" />

          {/* Filter pills */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-widest mb-2">Lọc theo loại</p>
            <div className="flex flex-wrap gap-1.5">
              {FILTER_TAGS.map(f => {
                const active = f === filter;
                const tc = f !== 'all' ? TAG_COLOR[f] : null;
                return (
                  <button
                    key={f}
                    onClick={() => handleFilter(f)}
                    className="px-3 py-1 rounded-full font-semibold text-[11px] transition-all duration-200 whitespace-nowrap"
                    style={{
                      background: active ? (tc ? tc.bg : '#0d2040') : 'rgba(255,255,255,0.04)',
                      color: active ? (tc ? tc.text : '#93c5fd') : '#3d5068',
                      border: `1px solid ${active ? (tc ? tc.border : '#1e4080') : '#0f1e33'}`,
                    }}
                  >
                    {FILTER_LABEL[f]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chord list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
            <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-widest mb-2">Hợp âm</p>
            <div className="flex flex-col gap-1">
              {filtered.map((c, i) => {
                const selected = i === safeIdx;
                const tc = TAG_COLOR[c.tag];
                return (
                  <button
                    key={c.name}
                    onClick={() => handleSelect(i)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 text-left"
                    style={{
                      background: selected ? tc.bg : 'transparent',
                      border: `1.5px solid ${selected ? tc.border : 'transparent'}`,
                      color: selected ? tc.text : '#3d5068',
                      boxShadow: selected ? `0 0 10px ${tc.border}44` : 'none',
                    }}
                  >
                    <span className="text-base font-black w-8">{c.name}</span>
                    <span className="text-[11px] font-medium opacity-70">{c.viName}</span>
                    <span className="ml-auto text-[9px] font-semibold opacity-50 uppercase">{TAG_LABEL[c.tag]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto p-8" style={{ scrollbarWidth: 'thin', scrollbarColor: '#0f1e33 transparent' } as React.CSSProperties}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            {mode === 'pluck'
              ? <ChordPractice key={activeChord.name + '-pluck'} chord={activeChord} />
              : <StrumPractice key={activeChord.name + '-strum'} chord={activeChord} />
            }
          </div>
        </main>
      </div>

      {/* ════════════════ MOBILE LAYOUT (<lg) ════════════════ */}
      <div className="flex flex-col lg:hidden min-h-screen">

        {/* ── Header ── */}
        <div className="flex-shrink-0 px-4 pt-safe-5 pb-3 flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo"
            style={{
              width: 44, height: 44, flexShrink: 0, objectFit: 'contain',
              filter: 'brightness(0) saturate(100%) invert(28%) sepia(60%) saturate(500%) hue-rotate(100deg) brightness(0.85)',
            }}
          />
          <div className="flex-1">
            <h1 className="text-[17px] font-extrabold text-white tracking-tight leading-none">Guitar Thầy Văn Anh</h1>
            <p className="text-[11px] text-slate-600 mt-0.5 font-medium">Luyện hợp âm cơ bản</p>
          </div>
        </div>

        {/* ── Mode tab bar ── */}
        <div className="flex-shrink-0 px-4 pb-2">
          <div className="flex gap-1.5 p-1.5 rounded-2xl w-full" style={{ background: '#07101d', border: '1px solid #0f1e33' }}>
            <button
              onClick={() => setMode('pluck')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.97]"
              style={{
                background: mode === 'pluck' ? 'rgba(34,197,94,0.14)' : 'transparent',
                color: mode === 'pluck' ? '#4ade80' : '#374151',
                border: `1.5px solid ${mode === 'pluck' ? '#14532d' : 'transparent'}`,
              }}
            >
              <Music2 size={15} /><span>Rải dây</span>
            </button>
            <button
              onClick={() => setMode('strum')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.97]"
              style={{
                background: mode === 'strum' ? 'rgba(245,158,11,0.14)' : 'transparent',
                color: mode === 'strum' ? '#f59e0b' : '#374151',
                border: `1.5px solid ${mode === 'strum' ? '#92400e' : 'transparent'}`,
              }}
            >
              <Waves size={15} /><span>Quạt hợp âm</span>
            </button>
          </div>
        </div>

        {/* ── Selector area ── */}
        <div className="flex-shrink-0 flex flex-col gap-2 pb-3">
          <div className="flex gap-1.5 px-4 overflow-x-auto" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
            {FILTER_TAGS.map(f => {
              const active = f === filter;
              const tc = f !== 'all' ? TAG_COLOR[f] : null;
              return (
                <button
                  key={f}
                  onClick={() => handleFilter(f)}
                  className="flex-shrink-0 px-3 py-1 rounded-full font-semibold text-[11px] transition-all duration-200 whitespace-nowrap"
                  style={{
                    background: active ? (tc ? tc.bg : '#0d2040') : 'rgba(255,255,255,0.04)',
                    color: active ? (tc ? tc.text : '#93c5fd') : '#3d5068',
                    border: `1px solid ${active ? (tc ? tc.border : '#1e4080') : '#0f1e33'}`,
                  }}
                >
                  {FILTER_LABEL[f]}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 px-4 overflow-x-auto" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
            {filtered.map((c, i) => {
              const selected = i === safeIdx;
              const tc = TAG_COLOR[c.tag];
              return (
                <button
                  key={c.name}
                  onClick={() => handleSelect(i)}
                  className="flex-shrink-0 font-bold text-[15px] transition-all duration-150 active:scale-95"
                  style={{
                    minWidth: 52, height: 44, borderRadius: 14,
                    background: selected ? tc.bg : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${selected ? tc.border : '#0f1e33'}`,
                    color: selected ? tc.text : '#3d5068',
                    boxShadow: selected ? `0 0 12px ${tc.border}66` : 'none',
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-4 h-px bg-[#0a1525] mb-3 flex-shrink-0" />

        <div className="flex-1 overflow-y-auto px-4 pb-safe-6">
          {mode === 'pluck'
            ? <ChordPractice key={activeChord.name + '-pluck'} chord={activeChord} />
            : <StrumPractice key={activeChord.name + '-strum'} chord={activeChord} />
          }
        </div>
      </div>
    </div>
  );
}
