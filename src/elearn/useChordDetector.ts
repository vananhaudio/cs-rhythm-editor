import { useRef, useState, useCallback } from 'react';

// ── DSP constants ──────────────────────────────────────────────────────────
// Large FFT for better frequency resolution (10.7Hz/bin at 44100Hz)
const FFT_SIZE     = 4096;
const SAMPLE_RATE  = 44100;
// Smoothing: moderate — let frames accumulate naturally
const SMOOTHING    = 0.5;
// Median filter window (frames) for chord stability
const MEDIAN_WIN   = 9;
// Frames of consistent chord before confirming
const CONFIRM_FRAMES = 6;
// Minimum signal to even run detection
const MIN_RMS_LINEAR = 0.008;
// Chroma bins below this fraction of max are zeroed (relative threshold)
const CHROMA_REL_THRESH = 0.12;
// Rogue note: chroma bin > this fraction of max AND not in chord
const ROGUE_REL_THRESH = 0.25;

// ── Chord note sets (pitch classes) ───────────────────────────────────────
// [C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11]
export const CHORD_NOTES: Record<string, number[]> = {
  'E':  [4, 8, 11],
  'Em': [4, 7, 11],
  'A':  [9, 1, 4],
  'Am': [9, 0, 4],
  'D':  [2, 6, 9],
  'Dm': [2, 5, 9],
  'G':  [7, 11, 2],
  'C':  [0, 4, 7],
  'F':  [5, 9, 0],
  'B7': [11, 3, 6, 9],
  'E7': [4, 8, 11, 2],
  'A7': [9, 1, 4, 7],
  'D7': [2, 6, 9, 0],
  'G7': [7, 11, 2, 5],
};

const CHROMA_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// ── Chord templates (normalised PCP, built from CHORD_NOTES) ──────────────
// Weight fundamentals higher; include lighter harmonic presence
function buildTemplate(notes: number[]): number[] {
  const t = new Array(12).fill(0);
  for (const n of notes) t[n] = 1.0;
  // Add slight weight for common overtones (octave, fifth)
  for (const n of notes) {
    t[(n + 7) % 12] = Math.max(t[(n + 7) % 12], 0.3);  // perfect fifth
    t[(n + 4) % 12] = Math.max(t[(n + 4) % 12], 0.2);  // major third
  }
  // Normalise
  const mag = Math.sqrt(t.reduce((s, v) => s + v * v, 0));
  return t.map(v => v / mag);
}

export const CHORD_TEMPLATES: Record<string, number[]> = Object.fromEntries(
  Object.entries(CHORD_NOTES).map(([k, v]) => [k, buildTemplate(v)])
);

// ── Helpers ────────────────────────────────────────────────────────────────
function getRmsLinear(buf: Float32Array): number {
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.sqrt(sum / buf.length);
}

function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69;
}

// ── Enhanced chroma extraction (PCP with spectral whitening) ──────────────
// Uses HPS-weighted magnitude: emphasises fundamentals over harmonics.
// Covers guitar range: E2 (82Hz) → E6 (1318Hz)
function buildPCP(
  freqData: Float32Array,   // linearised magnitude (not dB)
  sampleRate: number,
  fftSize: number,
): Float32Array {
  const chroma = new Float32Array(12);
  const N = freqData.length;
  const binHz = sampleRate / fftSize;

  // Frequency range for guitar fundamentals + 2 octave harmonics
  const fMin = 75;
  const fMax = 1400;

  for (let i = 1; i < N; i++) {
    const freq = i * binHz;
    if (freq < fMin || freq > fMax) continue;

    const mag = freqData[i];
    if (mag <= 0) continue;

    // Spectral whitening: divide by local spectral peak in ±4 bins window
    // This suppresses strong harmonics relative to quieter fundamentals
    let localPeak = mag;
    for (let d = -4; d <= 4; d++) {
      const j = i + d;
      if (j > 0 && j < N && freqData[j] > localPeak) localPeak = freqData[j];
    }
    const whitened = localPeak > 0 ? mag / localPeak : 0;

    // Map to pitch class
    const midi = freqToMidi(freq);
    const pitchClass = ((Math.round(midi) % 12) + 12) % 12;

    // Weight by proximity to exact semitone (reduce aliasing)
    const deviation = Math.abs(midi - Math.round(midi));
    const tuningWeight = Math.max(0, 1 - deviation * 2);

    chroma[pitchClass] += whitened * tuningWeight;
  }

  // Normalise to unit vector
  let mag2 = 0;
  for (const v of chroma) mag2 += v * v;
  mag2 = Math.sqrt(mag2);
  if (mag2 < 1e-6) return chroma;
  for (let i = 0; i < 12; i++) chroma[i] /= mag2;

  return chroma;
}

// Linear magnitude from dBFS analyser data
function dbToLinear(freqDataDb: Float32Array): Float32Array {
  const out = new Float32Array(freqDataDb.length);
  for (let i = 0; i < freqDataDb.length; i++) {
    const db = freqDataDb[i];
    out[i] = db <= -100 ? 0 : Math.pow(10, db / 20);
  }
  return out;
}

// Cosine similarity (templates already normalised; chroma is unit vector)
function cosineSim(chroma: Float32Array, template: number[]): number {
  let dot = 0;
  for (let i = 0; i < 12; i++) dot += chroma[i] * template[i];
  return Math.max(0, dot);
}

// Score all chords, return sorted list
export function scoreAllChords(chroma: Float32Array): Array<{ name: string; score: number }> {
  return Object.entries(CHORD_TEMPLATES)
    .map(([name, tpl]) => ({ name, score: cosineSim(chroma, tpl) }))
    .sort((a, b) => b.score - a.score);
}

// Median of sorted array
function median(arr: string[]): string {
  if (arr.length === 0) return '';
  const sorted = [...arr].sort();
  return sorted[Math.floor(sorted.length / 2)];
}

// Detect pitch classes present but NOT in the target chord
export function detectRogueNotes(chroma: Float32Array, chordName: string): string[] {
  const allowed = new Set(CHORD_NOTES[chordName] ?? []);
  const maxVal = Math.max(...Array.from(chroma));
  if (maxVal < 1e-6) return [];
  const rogues: string[] = [];
  for (let i = 0; i < 12; i++) {
    if (!allowed.has(i) && chroma[i] / maxVal >= ROGUE_REL_THRESH) {
      rogues.push(CHROMA_NAMES[i]);
    }
  }
  return rogues;
}

export function buildChroma(freqData: Float32Array, sampleRate: number, fftSize: number): Float32Array {
  return buildPCP(dbToLinear(freqData), sampleRate, fftSize);
}

// ── Types ──────────────────────────────────────────────────────────────────
export type StrumPhase = 'idle' | 'listening' | 'correct' | 'incorrect';

export interface StrumState {
  phase: StrumPhase;
  score: number;
  rmsDb: number;
  chroma: Float32Array;
  confirmedFrames: number;
  topGuess: string;
  allScores: Array<{ name: string; score: number }>;
  rogueNotes: string[];
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useChordDetector(targetChord: string) {
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const rafRef       = useRef<number>(0);
  const confirmedRef = useRef(0);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Median filter: keep last N top-guess names
  const guessHistRef = useRef<string[]>([]);

  const blank = (): StrumState => ({
    phase: 'idle', score: 0, rmsDb: -100,
    chroma: new Float32Array(12),
    confirmedFrames: 0, topGuess: '', allScores: [], rogueNotes: [],
  });

  const [state, setState] = useState<StrumState>(blank);

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    confirmedRef.current = 0;
    guessHistRef.current = [];
  }, []);

  const stop = useCallback(() => {
    stopStream();
    setState(blank);
  }, [stopStream]);

  const reset = useCallback(() => {
    stopStream();
    setState(blank);
  }, [stopStream]);

  const start = useCallback(async () => {
    if (state.phase === 'listening') return;
    stopStream();

    setState(s => ({ ...s, phase: 'listening', score: 0, rmsDb: -100, confirmedFrames: 0, topGuess: '', allScores: [], rogueNotes: [] }));

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
      setState(s => ({ ...s, phase: 'idle' }));
      return;
    }

    streamRef.current = stream;

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();

    const ctx = audioCtxRef.current;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    analyser.minDecibels = -100;
    analyser.maxDecibels = -10;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyserRef.current = analyser;

    const freqDataDb  = new Float32Array(analyser.frequencyBinCount);
    const timeData    = new Float32Array(FFT_SIZE);
    const template    = CHORD_TEMPLATES[targetChord] ?? CHORD_TEMPLATES['Am'];

    const finish = (result: 'correct' | 'incorrect') => {
      cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      confirmedRef.current = 0;
      guessHistRef.current = [];
      setState(s => ({ ...s, phase: result }));
    };

    // 8 second timeout
    timerRef.current = setTimeout(() => finish('incorrect'), 8000);

    const tick = () => {
      if (!analyserRef.current) return;

      analyser.getFloatFrequencyData(freqDataDb);
      analyser.getFloatTimeDomainData(timeData);

      // RMS gate
      const rms = getRmsLinear(timeData);
      const rmsDb = rms < 1e-8 ? -100 : 20 * Math.log10(rms);
      const isSilent = rms < MIN_RMS_LINEAR;

      if (isSilent) {
        confirmedRef.current = Math.max(0, confirmedRef.current - 1);
        setState(s => ({ ...s, rmsDb, score: 0, rogueNotes: [] }));
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Build PCP chroma
      const linMag = dbToLinear(freqDataDb);
      const chroma = buildPCP(linMag, ctx.sampleRate, FFT_SIZE);

      // Apply relative threshold: zero out weak chroma bins
      const maxChroma = Math.max(...Array.from(chroma));
      const thresholded = new Float32Array(12);
      for (let i = 0; i < 12; i++) {
        thresholded[i] = chroma[i] / maxChroma >= CHROMA_REL_THRESH ? chroma[i] : 0;
      }
      // Re-normalise after threshold
      let mag2 = 0;
      for (const v of thresholded) mag2 += v * v;
      mag2 = Math.sqrt(mag2);
      if (mag2 > 1e-6) for (let i = 0; i < 12; i++) thresholded[i] /= mag2;

      const score  = cosineSim(thresholded, template);
      const ranked = scoreAllChords(thresholded);

      // Median filter: use majority vote over last N frames
      guessHistRef.current.push(ranked[0]?.name ?? '');
      if (guessHistRef.current.length > MEDIAN_WIN) guessHistRef.current.shift();
      const stableGuess = median(guessHistRef.current);

      // Confirm only when median guess matches target
      const isMatch = stableGuess === targetChord && score >= 0.55;
      if (isMatch) {
        confirmedRef.current = Math.min(confirmedRef.current + 1, CONFIRM_FRAMES + 5);
      } else {
        confirmedRef.current = Math.max(0, confirmedRef.current - 1);
      }

      if (confirmedRef.current >= CONFIRM_FRAMES) {
        finish('correct');
        return;
      }

      const rogueNotes = detectRogueNotes(thresholded, targetChord);

      setState(s => ({
        ...s,
        phase: 'listening',
        score,
        rmsDb,
        chroma: thresholded,
        confirmedFrames: confirmedRef.current,
        topGuess: stableGuess,
        allScores: ranked.slice(0, 5),
        rogueNotes,
      }));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [state.phase, targetChord, stopStream]);

  return { state, start, stop, reset };
}
