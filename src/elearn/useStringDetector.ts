import { useRef, useState, useCallback } from 'react';

// ── Chord sequence type ────────────────────────────────────────────────────
export interface ChordStep {
  id: number;
  stringNum: number;
  note: string;
  freq: number;
  fretLabel: string;
  finger: string | null;
}

// ── Standard note frequencies (equal temperament) ─────────────────────────
// E2=82.41 A2=110 D3=146.83 G3=196 B3=246.94 E4=329.63
// F2=87.31 C3=130.81 F3=174.61 A3=220 C4=261.63 D4=293.66
// F#2=92.50 B2=123.47 E3=164.81 G#3=207.65 D#4=311.13 F4=349.23
// G2=98 C#3=138.59 G#2=103.83 B3=246.94 Bb3=233.08 A#3=233.08

// ── E major: 022100 ────────────────────────────────────────────────────────
export const E_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 6, note: 'E2',  freq: 82.41,   fretLabel: 'Buông (open)',    finger: null },
  { id: 1, stringNum: 5, note: 'B2',  freq: 123.47,  fretLabel: 'Phím 2 · ngón 3', finger: '3'  },
  { id: 2, stringNum: 4, note: 'E3',  freq: 164.81,  fretLabel: 'Phím 2 · ngón 2', finger: '2'  },
  { id: 3, stringNum: 3, note: 'G#3', freq: 207.65,  fretLabel: 'Phím 1 · ngón 1', finger: '1'  },
  { id: 4, stringNum: 2, note: 'B3',  freq: 246.94,  fretLabel: 'Buông (open)',    finger: null },
  { id: 5, stringNum: 1, note: 'E4',  freq: 329.63,  fretLabel: 'Buông (open)',    finger: null },
];

// ── Em: 022000 ────────────────────────────────────────────────────────────
export const EM_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 6, note: 'E2',  freq: 82.41,   fretLabel: 'Buông (open)',    finger: null },
  { id: 1, stringNum: 5, note: 'B2',  freq: 123.47,  fretLabel: 'Phím 2 · ngón 2', finger: '2'  },
  { id: 2, stringNum: 4, note: 'E3',  freq: 164.81,  fretLabel: 'Phím 2 · ngón 3', finger: '3'  },
  { id: 3, stringNum: 3, note: 'G3',  freq: 196.0,   fretLabel: 'Buông (open)',    finger: null },
  { id: 4, stringNum: 2, note: 'B3',  freq: 246.94,  fretLabel: 'Buông (open)',    finger: null },
  { id: 5, stringNum: 1, note: 'E4',  freq: 329.63,  fretLabel: 'Buông (open)',    finger: null },
];

// ── A major: x02220 ───────────────────────────────────────────────────────
export const A_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 5, note: 'A2',  freq: 110.0,   fretLabel: 'Buông (open)',    finger: null },
  { id: 1, stringNum: 4, note: 'E3',  freq: 164.81,  fretLabel: 'Phím 2 · ngón 1', finger: '1'  },
  { id: 2, stringNum: 3, note: 'A3',  freq: 220.0,   fretLabel: 'Phím 2 · ngón 2', finger: '2'  },
  { id: 3, stringNum: 2, note: 'C#4', freq: 277.18,  fretLabel: 'Phím 2 · ngón 3', finger: '3'  },
  { id: 4, stringNum: 1, note: 'E4',  freq: 329.63,  fretLabel: 'Buông (open)',    finger: null },
];

// ── Am: x02210 ────────────────────────────────────────────────────────────
export const AM_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 5, note: 'A2',  freq: 110.0,   fretLabel: 'Buông (open)',    finger: null },
  { id: 1, stringNum: 4, note: 'E3',  freq: 164.81,  fretLabel: 'Phím 2 · ngón 2', finger: '2'  },
  { id: 2, stringNum: 3, note: 'A3',  freq: 220.0,   fretLabel: 'Phím 2 · ngón 3', finger: '3'  },
  { id: 3, stringNum: 2, note: 'C4',  freq: 261.63,  fretLabel: 'Phím 1 · ngón 1', finger: '1'  },
  { id: 4, stringNum: 1, note: 'E4',  freq: 329.63,  fretLabel: 'Buông (open)',    finger: null },
];

// ── D major: xx0232 ───────────────────────────────────────────────────────
export const D_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 4, note: 'D3',  freq: 146.83,  fretLabel: 'Buông (open)',    finger: null },
  { id: 1, stringNum: 3, note: 'A3',  freq: 220.0,   fretLabel: 'Phím 2 · ngón 1', finger: '1'  },
  { id: 2, stringNum: 2, note: 'D4',  freq: 293.66,  fretLabel: 'Phím 3 · ngón 3', finger: '3'  },
  { id: 3, stringNum: 1, note: 'F#4', freq: 369.99,  fretLabel: 'Phím 2 · ngón 2', finger: '2'  },
];

// ── Dm: xx0231 ────────────────────────────────────────────────────────────
export const DM_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 4, note: 'D3',  freq: 146.83,  fretLabel: 'Buông (open)',    finger: null },
  { id: 1, stringNum: 3, note: 'A3',  freq: 220.0,   fretLabel: 'Phím 2 · ngón 2', finger: '2'  },
  { id: 2, stringNum: 2, note: 'D4',  freq: 293.66,  fretLabel: 'Phím 3 · ngón 3', finger: '3'  },
  { id: 3, stringNum: 1, note: 'F4',  freq: 349.23,  fretLabel: 'Phím 1 · ngón 1', finger: '1'  },
];

// ── G major: 320003 ───────────────────────────────────────────────────────
export const G_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 6, note: 'G2',  freq: 98.0,    fretLabel: 'Phím 3 · ngón 2', finger: '2'  },
  { id: 1, stringNum: 5, note: 'B2',  freq: 123.47,  fretLabel: 'Phím 2 · ngón 1', finger: '1'  },
  { id: 2, stringNum: 4, note: 'D3',  freq: 146.83,  fretLabel: 'Buông (open)',    finger: null },
  { id: 3, stringNum: 3, note: 'G3',  freq: 196.0,   fretLabel: 'Buông (open)',    finger: null },
  { id: 4, stringNum: 2, note: 'B3',  freq: 246.94,  fretLabel: 'Buông (open)',    finger: null },
  { id: 5, stringNum: 1, note: 'G4',  freq: 392.0,   fretLabel: 'Phím 3 · ngón 4', finger: '4'  },
];

// ── C major: x32010 ───────────────────────────────────────────────────────
export const C_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 5, note: 'C3',  freq: 130.81,  fretLabel: 'Phím 3 · ngón 3', finger: '3'  },
  { id: 1, stringNum: 4, note: 'E3',  freq: 164.81,  fretLabel: 'Phím 2 · ngón 2', finger: '2'  },
  { id: 2, stringNum: 3, note: 'G3',  freq: 196.0,   fretLabel: 'Buông (open)',    finger: null },
  { id: 3, stringNum: 2, note: 'C4',  freq: 261.63,  fretLabel: 'Phím 1 · ngón 1', finger: '1'  },
  { id: 4, stringNum: 1, note: 'E4',  freq: 329.63,  fretLabel: 'Buông (open)',    finger: null },
];

// ── F major: 133211 (barre) ───────────────────────────────────────────────
export const F_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 6, note: 'F2',  freq: 87.31,   fretLabel: 'Phím 1 · ngón 1', finger: '1'  },
  { id: 1, stringNum: 5, note: 'C3',  freq: 130.81,  fretLabel: 'Phím 3 · ngón 3', finger: '3'  },
  { id: 2, stringNum: 4, note: 'F3',  freq: 174.61,  fretLabel: 'Phím 3 · ngón 4', finger: '4'  },
  { id: 3, stringNum: 3, note: 'A3',  freq: 220.0,   fretLabel: 'Phím 2 · ngón 2', finger: '2'  },
  { id: 4, stringNum: 2, note: 'C4',  freq: 261.63,  fretLabel: 'Phím 1 · ngón 1', finger: '1'  },
  { id: 5, stringNum: 1, note: 'F4',  freq: 349.23,  fretLabel: 'Phím 1 · ngón 1', finger: '1'  },
];

// ── B7: x-2-1-2-0-2 (B D# A B F#) ───────────────────────────────────────
export const B7_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 5, note: 'B2',  freq: 123.47,  fretLabel: 'Phím 2 · ngón 1', finger: '1'  },
  { id: 1, stringNum: 4, note: 'D#3', freq: 155.56,  fretLabel: 'Phím 1 · ngón 2', finger: '2'  },
  { id: 2, stringNum: 3, note: 'A3',  freq: 220.0,   fretLabel: 'Phím 2 · ngón 3', finger: '3'  },
  { id: 3, stringNum: 2, note: 'B3',  freq: 246.94,  fretLabel: 'Buông (open)',    finger: null },
  { id: 4, stringNum: 1, note: 'F#4', freq: 369.99,  fretLabel: 'Phím 2 · ngón 4', finger: '4'  },
];

// ── E7: 020100 ────────────────────────────────────────────────────────────
export const E7_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 6, note: 'E2',  freq: 82.41,   fretLabel: 'Buông (open)',    finger: null },
  { id: 1, stringNum: 5, note: 'B2',  freq: 123.47,  fretLabel: 'Phím 2 · ngón 2', finger: '2'  },
  { id: 2, stringNum: 4, note: 'D3',  freq: 146.83,  fretLabel: 'Buông (open)',    finger: null },
  { id: 3, stringNum: 3, note: 'G#3', freq: 207.65,  fretLabel: 'Phím 1 · ngón 1', finger: '1'  },
  { id: 4, stringNum: 2, note: 'B3',  freq: 246.94,  fretLabel: 'Buông (open)',    finger: null },
  { id: 5, stringNum: 1, note: 'E4',  freq: 329.63,  fretLabel: 'Buông (open)',    finger: null },
];

// ── A7: x02020 ────────────────────────────────────────────────────────────
export const A7_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 5, note: 'A2',  freq: 110.0,   fretLabel: 'Buông (open)',    finger: null },
  { id: 1, stringNum: 4, note: 'E3',  freq: 164.81,  fretLabel: 'Phím 2 · ngón 2', finger: '2'  },
  { id: 2, stringNum: 3, note: 'G3',  freq: 196.0,   fretLabel: 'Buông (open)',    finger: null },
  { id: 3, stringNum: 2, note: 'C#4', freq: 277.18,  fretLabel: 'Phím 2 · ngón 3', finger: '3'  },
  { id: 4, stringNum: 1, note: 'E4',  freq: 329.63,  fretLabel: 'Buông (open)',    finger: null },
];

// ── D7: xx0212 ────────────────────────────────────────────────────────────
export const D7_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 4, note: 'D3',  freq: 146.83,  fretLabel: 'Buông (open)',    finger: null },
  { id: 1, stringNum: 3, note: 'A3',  freq: 220.0,   fretLabel: 'Phím 2 · ngón 1', finger: '1'  },
  { id: 2, stringNum: 2, note: 'C4',  freq: 261.63,  fretLabel: 'Phím 1 · ngón 2', finger: '2'  },
  { id: 3, stringNum: 1, note: 'F#4', freq: 369.99,  fretLabel: 'Phím 2 · ngón 3', finger: '3'  },
];

// ── G7: 320001 ────────────────────────────────────────────────────────────
export const G7_SEQUENCE: ChordStep[] = [
  { id: 0, stringNum: 6, note: 'G2',  freq: 98.0,    fretLabel: 'Phím 3 · ngón 3', finger: '3'  },
  { id: 1, stringNum: 5, note: 'B2',  freq: 123.47,  fretLabel: 'Phím 2 · ngón 2', finger: '2'  },
  { id: 2, stringNum: 4, note: 'D3',  freq: 146.83,  fretLabel: 'Buông (open)',    finger: null },
  { id: 3, stringNum: 3, note: 'G3',  freq: 196.0,   fretLabel: 'Buông (open)',    finger: null },
  { id: 4, stringNum: 2, note: 'B3',  freq: 246.94,  fretLabel: 'Buông (open)',    finger: null },
  { id: 5, stringNum: 1, note: 'F4',  freq: 349.23,  fretLabel: 'Phím 1 · ngón 1', finger: '1'  },
];

// ── Audio constants ────────────────────────────────────────────────────────
const FFT_SIZE    = 4096;   // smaller = lower latency (~93ms at 44100Hz)
const SAMPLE_RATE = 44100;
// No smoothing — we want raw signal for onset detection
const SMOOTHING   = 0.0;

// Pitch tolerance: 65 cents (~3.8% ratio) — generous for beginners
const CENTS_ACCEPT   = 65;
const FREQ_RATIO_TOL = Math.pow(2, CENTS_ACCEPT / 1200);

// Onset: RMS must rise by this factor within one frame to count as a new pluck
const ONSET_RISE_FACTOR = 1.6;

// Minimum RMS (linear) to register any signal at all
const MIN_RMS_LINEAR = 0.006;

// After a hit, ignore re-triggers for this many ms (prevents same pluck firing twice)
const RETRIGGER_MS = 280;

// How many consecutive matching pitch frames needed to confirm (at ~60fps ≈ 2 frames = ~33ms)
const CONFIRM_FRAMES = 2;

// If no new onset but pitch keeps matching for this many extra frames, accept anyway
// (handles slow attack / fingerpicking style)
const SUSTAIN_CONFIRM_FRAMES = 5;

export type StringStatus = 'pending' | 'current' | 'correct';
export type AccuracyRating = 'perfect' | 'great' | 'good' | 'slight' | 'retune' | null;

export function getCentsRating(cents: number): AccuracyRating {
  const abs = Math.abs(cents);
  if (abs <= 10) return 'perfect';
  if (abs <= 20) return 'great';
  if (abs <= 35) return 'good';
  if (abs <= 50) return 'slight';
  return 'retune';
}

export const RATING_LABELS: Record<NonNullable<AccuracyRating>, string> = {
  perfect: 'Hoàn hảo ✓',
  great:   'Rất chuẩn ✓',
  good:    'Ổn rồi ✓',
  slight:  'Hơi lệch nhẹ',
  retune:  'Cần chỉnh lại dây đàn',
};

export const RATING_COLORS: Record<NonNullable<AccuracyRating>, string> = {
  perfect: '#4ade80',
  great:   '#4ade80',
  good:    '#86efac',
  slight:  '#fbbf24',
  retune:  '#f87171',
};

export function calcCents(detected: number, target: number): number {
  return Math.round(1200 * Math.log2(detected / target));
}

export interface StringState {
  status: StringStatus[];
  currentStep: number;
  listening: boolean;
  detectedFreq: number;
  rmsDb: number;
  wrongHint: boolean;
  done: boolean;
  lastCents: number | null;
  lastRating: AccuracyRating;
}

// ── RMS (linear) ──────────────────────────────────────────────────────────
function getRms(buf: Float32Array): number {
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.sqrt(sum / buf.length);
}

function rmsToDb(rms: number): number {
  return rms < 1e-8 ? -100 : 20 * Math.log10(rms);
}

// ── YIN pitch detection (optimised for small buffer) ──────────────────────
function detectPitchYIN(buf: Float32Array, sampleRate: number): number {
  const N = buf.length >> 1;
  if (N < 256) return 0;

  const diff = new Float32Array(N);
  let runningSum = 0;

  for (let tau = 1; tau < N; tau++) {
    let d = 0;
    for (let j = 0; j < N; j++) {
      const delta = buf[j] - buf[j + tau];
      d += delta * delta;
    }
    diff[tau] = d;
    runningSum += diff[tau];
    diff[tau] = runningSum === 0 ? 1 : (diff[tau] * tau) / runningSum;
  }

  const threshold = 0.18; // slightly looser threshold for faster detection
  let tauMin = -1;
  for (let tau = 2; tau < N; tau++) {
    if (diff[tau] < threshold) {
      while (tau + 1 < N && diff[tau + 1] < diff[tau]) tau++;
      tauMin = tau;
      break;
    }
  }

  if (tauMin < 2) return 0;

  // Parabolic interpolation for sub-sample accuracy
  const better =
    tauMin > 0 && tauMin < N - 1
      ? tauMin +
        (diff[tauMin + 1] - diff[tauMin - 1]) /
          (2 * (2 * diff[tauMin] - diff[tauMin - 1] - diff[tauMin + 1]))
      : tauMin;

  const freq = sampleRate / better;
  if (freq < 80 || freq > 520) return 0;
  return freq;
}

function makeInitialStatus(len: number): StringStatus[] {
  return Array.from({ length: len }, (_, i) => (i === 0 ? 'current' : 'pending')) as StringStatus[];
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useStringDetector(sequence: ChordStep[]) {
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const rafRef       = useRef<number>(0);

  // Onset detection state
  const prevRmsRef        = useRef(0);
  // Timestamp of last accepted hit (for retrigger guard)
  const lastHitTimeRef    = useRef(0);
  // Consecutive frames where pitch matches target (confirm counter)
  const matchFramesRef    = useRef(0);
  // Whether we are inside an onset window (expecting pitch confirmation)
  const inOnsetRef        = useRef(false);

  const currentStepRef  = useRef(0);
  const sequenceRef     = useRef(sequence);
  sequenceRef.current   = sequence;

  const [s, setS] = useState<StringState>(() => ({
    status: makeInitialStatus(sequence.length),
    currentStep: 0,
    listening: false,
    detectedFreq: 0,
    rmsDb: -100,
    wrongHint: false,
    done: false,
    lastCents: null,
    lastRating: null,
  }));

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const resetRefs = useCallback(() => {
    stopStream();
    prevRmsRef.current     = 0;
    lastHitTimeRef.current = 0;
    matchFramesRef.current = 0;
    inOnsetRef.current     = false;
    currentStepRef.current = 0;
  }, [stopStream]);

  const reset = useCallback(() => {
    resetRefs();
    setS({
      status: makeInitialStatus(sequenceRef.current.length),
      currentStep: 0,
      listening: false,
      detectedFreq: 0,
      rmsDb: -100,
      wrongHint: false,
      done: false,
      lastCents: null,
      lastRating: null,
    });
  }, [resetRefs]);

  const stop = useCallback(() => {
    stopStream();
    setS(prev => ({ ...prev, listening: false }));
  }, [stopStream]);

  // Core audio startup — does NOT check listening/done state
  const startAudio = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch {
      alert('Không thể truy cập microphone. Vui lòng cấp quyền.');
      return;
    }

    streamRef.current = stream;

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }

    const ctx = audioCtxRef.current;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    const src = ctx.createMediaStreamSource(stream);
    src.connect(analyser);
    analyserRef.current = analyser;

    setS(prev => ({ ...prev, listening: true, wrongHint: false, lastCents: null, lastRating: null }));

    const timeDomain = new Float32Array(FFT_SIZE);

    const tick = () => {
      if (!analyserRef.current) return;

      analyser.getFloatTimeDomainData(timeDomain);
      const rms   = getRms(timeDomain);
      const rmsDb = rmsToDb(rms);

      // ── Silence: reset onset state ──
      if (rms < MIN_RMS_LINEAR) {
        prevRmsRef.current     = 0;
        matchFramesRef.current = 0;
        inOnsetRef.current     = false;
        setS(prev => ({ ...prev, rmsDb, detectedFreq: 0 }));
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const freq = detectPitchYIN(timeDomain, ctx.sampleRate);
      setS(prev => ({ ...prev, rmsDb, detectedFreq: freq > 0 ? Math.round(freq * 10) / 10 : prev.detectedFreq }));

      // ── Onset detection: RMS rose sharply → new pluck ──
      const prevRms = prevRmsRef.current;
      const isOnset = prevRms > 0 && rms / prevRms >= ONSET_RISE_FACTOR && rms >= MIN_RMS_LINEAR * 2;
      if (isOnset) {
        inOnsetRef.current     = true;
        matchFramesRef.current = 0;
      }
      prevRmsRef.current = rms;

      // ── Pitch matching ──
      if (freq > 0) {
        const seq    = sequenceRef.current;
        const step   = currentStepRef.current;
        if (step >= seq.length) { rafRef.current = requestAnimationFrame(tick); return; }

        const target = seq[step];
        const lo     = target.freq / FREQ_RATIO_TOL;
        const hi     = target.freq * FREQ_RATIO_TOL;
        const match  = freq >= lo && freq <= hi;

        if (match) {
          matchFramesRef.current += 1;
        } else {
          // Pitch drifted away — if we had started matching, reset
          if (matchFramesRef.current > 0 && !inOnsetRef.current) {
            matchFramesRef.current = 0;
          }
        }

        // Decide required confirmation frames:
        // – After a clear onset: CONFIRM_FRAMES (fast)
        // – During sustained note (fingerpick / soft attack): SUSTAIN_CONFIRM_FRAMES
        const required = inOnsetRef.current ? CONFIRM_FRAMES : SUSTAIN_CONFIRM_FRAMES;
        const now = performance.now();
        const sinceLastHit = now - lastHitTimeRef.current;

        if (matchFramesRef.current >= required && sinceLastHit >= RETRIGGER_MS) {
          // ── HIT ──
          lastHitTimeRef.current = now;
          matchFramesRef.current = 0;
          inOnsetRef.current     = false;

          const cents  = calcCents(freq, target.freq);
          const rating = getCentsRating(cents);
          const nextStep = step + 1;
          currentStepRef.current = nextStep;
          const isDone = nextStep >= seq.length;

          setS(prev => {
            const newStatus = [...prev.status] as StringStatus[];
            newStatus[step] = 'correct';
            if (!isDone) newStatus[nextStep] = 'current';
            return {
              ...prev,
              status: newStatus,
              currentStep: nextStep,
              wrongHint: false,
              done: isDone,
              lastCents: cents,
              lastRating: rating,
            };
          });

          playTing(ctx, rating);

          if (isDone) {
            setTimeout(() => stopStream(), 600);
            return;
          }

          // Clear accuracy badge after a beat
          setTimeout(() => {
            setS(prev => ({ ...prev, lastCents: null, lastRating: null }));
          }, 1400);

        } else if (!match && inOnsetRef.current) {
          // Wrong note on a fresh pluck
          const ratio = freq > target.freq ? freq / target.freq : target.freq / freq;
          if (ratio > 1.12 && sinceLastHit >= RETRIGGER_MS) {
            setS(prev => ({ ...prev, wrongHint: true }));
            setTimeout(() => setS(prev => ({ ...prev, wrongHint: false })), 1200);
            inOnsetRef.current = false; // reset so next pluck gets a fresh chance
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopStream]);

  const start = useCallback(async () => {
    if (s.listening || s.done) return;
    prevRmsRef.current     = 0;
    lastHitTimeRef.current = 0;
    matchFramesRef.current = 0;
    inOnsetRef.current     = false;
    await startAudio();
  }, [s.listening, s.done, startAudio]);

  const resetAndStart = useCallback(async () => {
    resetRefs();
    setS({
      status: makeInitialStatus(sequenceRef.current.length),
      currentStep: 0,
      listening: false,
      detectedFreq: 0,
      rmsDb: -100,
      wrongHint: false,
      done: false,
      lastCents: null,
      lastRating: null,
    });
    await startAudio();
  }, [resetRefs, startAudio]);

  return { state: s, start, stop, reset, resetAndStart };
}

// ── Ting sound ─────────────────────────────────────────────────────────────
function playTing(ctx: AudioContext, rating: AccuracyRating) {
  const freq = rating === 'perfect' ? 1318.5
    : rating === 'great'   ? 1174.7
    : rating === 'good'    ? 1046.5
    : 880.0;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.22, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.35);
}
