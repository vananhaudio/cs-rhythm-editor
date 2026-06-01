import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PitchResult = { frequency: number | null; clarity: number };
type TuneStatus = 'waiting' | 'wrongString' | 'tooLow' | 'tooHigh' | 'inTune';

// ─── Guitar strings ───────────────────────────────────────────────────────────

const STRINGS = [
  { number: 6, name: 'E', octave: 2, freq: 82.41,  note: 'E2', color: '#ef4444', label: 'Dây 6 — Mi trầm' },
  { number: 5, name: 'A', octave: 2, freq: 110.0,  note: 'A2', color: '#f97316', label: 'Dây 5 — La'       },
  { number: 4, name: 'D', octave: 3, freq: 146.83, note: 'D3', color: '#eab308', label: 'Dây 4 — Rê'       },
  { number: 3, name: 'G', octave: 3, freq: 196.0,  note: 'G3', color: '#22c55e', label: 'Dây 3 — Sol'      },
  { number: 2, name: 'B', octave: 3, freq: 246.94, note: 'B3', color: '#3b82f6', label: 'Dây 2 — Si'       },
  { number: 1, name: 'E', octave: 4, freq: 329.63, note: 'E4', color: '#a855f7', label: 'Dây 1 — Mi cao'   },
];

// ─── Pitch detection (ACF2+) ──────────────────────────────────────────────────

function detectPitch(buf: Float32Array, sampleRate: number): { freq: number; clarity: number } {
  const SIZE = buf.length;
  let sum = 0;
  for (let i = 0; i < SIZE; i++) sum += buf[i] * buf[i];
  if (Math.sqrt(sum / SIZE) < 0.01) return { freq: -1, clarity: 0 };

  const HALF = Math.floor(SIZE / 2);
  const r = new Float32Array(HALF);
  for (let lag = 0; lag < HALF; lag++) {
    let s = 0;
    for (let i = 0; i < HALF; i++) s += buf[i] * buf[i + lag];
    r[lag] = s;
  }

  let firstMin = 1;
  for (let i = 1; i < HALF - 1; i++) {
    if (r[i] <= r[i - 1] && r[i] <= r[i + 1]) { firstMin = i; break; }
  }

  const minLag = Math.floor(sampleRate / 380);
  const maxLag = Math.floor(sampleRate / 60);
  const searchFrom = Math.max(firstMin, minLag);

  let bestLag = -1, bestVal = -Infinity;
  for (let i = searchFrom; i < Math.min(HALF - 1, maxLag); i++) {
    if (r[i] > bestVal) { bestVal = r[i]; bestLag = i; }
  }

  if (bestLag < 2) return { freq: -1, clarity: 0 };
  const clarity = r[0] > 0 ? bestVal / r[0] : 0;
  if (clarity < 0.55) return { freq: -1, clarity: 0 };

  const y0 = r[bestLag - 1], y1 = r[bestLag], y2 = r[bestLag + 1] ?? y1;
  const denom = 2 * (2 * y1 - y0 - y2);
  const refined = denom !== 0 ? bestLag - (y0 - y2) / denom : bestLag;

  return { freq: sampleRate / refined, clarity };
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function identifyString(freq: number) {
  let closest = null, minDist = Infinity;
  for (const s of STRINGS) {
    const dist = Math.abs(Math.log2(freq / s.freq));
    if (dist < minDist) { minDist = dist; closest = s; }
  }
  return minDist < 0.25 ? closest : null;
}

function getCents(detected: number, target: number): number {
  return 1200 * Math.log2(detected / target);
}

function playReferenceTone(frequency: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.4, ctx.currentTime + 1.5);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 2.2);
  } catch (_) {}
}

// ─── usePitchDetection hook ───────────────────────────────────────────────────

function usePitchDetection() {
  const [pitch, setPitch] = useState<PitchResult>({ frequency: null, clarity: 0 });
  const [isActive, setIsActive] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number | null>(null);
  const freqBufRef  = useRef<number[]>([]);
  const silenceRef  = useRef(0);
  const frameRef    = useRef(0);

  const stopListening = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    freqBufRef.current = [];
    silenceRef.current = 0;
    frameRef.current = 0;
    setPitch({ frequency: null, clarity: 0 });
    setIsActive(false);
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      setHasPermission(true);
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 44100 });
      if (ctx.state === 'suspended') await ctx.resume();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0;
      analyserRef.current = analyser;

      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const tick = () => {
        if (!analyserRef.current) return;
        frameRef.current++;
        analyserRef.current.getFloatTimeDomainData(buf);
        const result = detectPitch(buf, ctx.sampleRate);

        if (result.freq > 0) {
          silenceRef.current = 0;
          freqBufRef.current.push(result.freq);
          if (freqBufRef.current.length > 7) freqBufRef.current.shift();
          if (frameRef.current % 4 === 0 && freqBufRef.current.length >= 3) {
            setPitch({ frequency: median(freqBufRef.current), clarity: result.clarity });
          }
        } else {
          silenceRef.current++;
          if (silenceRef.current > 20) {
            freqBufRef.current = [];
            setPitch({ frequency: null, clarity: 0 });
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
      setIsActive(true);
      setError(null);
    } catch {
      setHasPermission(false);
      setError('Không thể truy cập microphone. Vui lòng cho phép quyền mic trong trình duyệt.');
    }
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  return { pitch, isActive, hasPermission, error, startListening, stopListening };
}

// ─── SVG Needle ───────────────────────────────────────────────────────────────

const W = 300, H = 170, CX = W / 2, CY = H - 12, R = 135, MAX_DEG = 65;
const TICKS = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];

function degToRad(d: number) { return (d * Math.PI) / 180; }

function tickCoords(cent: number, inner: number, outer: number) {
  const a = degToRad((cent / 50) * MAX_DEG);
  return {
    x1: CX + inner * Math.sin(a), y1: CY - inner * Math.cos(a),
    x2: CX + outer * Math.sin(a), y2: CY - outer * Math.cos(a),
  };
}

const arcPath = (() => {
  const a0 = degToRad(-MAX_DEG), a1 = degToRad(MAX_DEG);
  return `M ${CX + R * Math.sin(a0)} ${CY - R * Math.cos(a0)} A ${R} ${R} 0 0 1 ${CX + R * Math.sin(a1)} ${CY - R * Math.cos(a1)}`;
})();

function TunerNeedle({ cents, isInTune }: { cents: number | null; isInTune: boolean }) {
  const deg = cents !== null ? (Math.max(-50, Math.min(50, cents)) / 50) * MAX_DEG : 0;
  const rad = degToRad(deg);
  const nx = CX + R * Math.sin(rad);
  const ny = CY - R * Math.cos(rad);
  const active = cents !== null;
  const needleColor = !active ? '#444' : isInTune ? '#22c55e' : '#f97316';
  const pivotColor  = !active ? '#444' : isInTune ? '#22c55e' : '#ef4444';

  return (
    <svg
      width={W} height={H}
      style={{ transition: 'none', display: 'block', margin: '0 auto' }}
    >
      {/* Arc */}
      <path d={arcPath} stroke="#2a2a2a" strokeWidth={2.5} fill="none" />

      {/* Ticks */}
      {TICKS.map(c => {
        const major = c % 20 === 0;
        const t = tickCoords(c, R - (major ? 20 : 10), R + 1);
        return (
          <line key={c} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={c === 0 ? '#22c55e' : '#2e2e2e'}
            strokeWidth={major ? 2 : 1.2}
          />
        );
      })}

      {/* In-tune glow */}
      {isInTune && <circle cx={CX} cy={CY} r={28} fill="#22c55e" opacity={0.1} />}

      {/* Needle — CSS transition for smooth animation */}
      <line
        x1={CX} y1={CY} x2={nx} y2={ny}
        stroke={needleColor} strokeWidth={2.5} strokeLinecap="round"
        style={{ transition: 'x2 0.12s ease-out, y2 0.12s ease-out, stroke 0.2s' }}
      />

      {/* Pivot */}
      <circle cx={CX} cy={CY} r={8} fill={pivotColor} style={{ transition: 'fill 0.2s' }} />
      <circle cx={CX} cy={CY} r={3.5} fill="#0d0d0d" />

      {/* Labels */}
      <text x={14} y={CY + 18} fill="#3a3a3a" fontSize={9} fontWeight={700} textAnchor="middle">THẤP</text>
      <text x={W - 14} y={CY + 18} fill="#3a3a3a" fontSize={9} fontWeight={700} textAnchor="middle">CAO</text>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GuitarTuner() {
  const [selectedIndex, setSelectedIndex] = useState(1);
  const [tuneStatus, setTuneStatus]       = useState<TuneStatus>('waiting');
  const [detectedString, setDetectedString] = useState<typeof STRINGS[number] | null>(null);
  const [cents, setCents]                 = useState<number | null>(null);
  const [displayFreq, setDisplayFreq]     = useState<number | null>(null);

  const { pitch, isActive, error, startListening, stopListening } = usePitchDetection();
  const selectedString = STRINGS[selectedIndex];
  const TUNE_THRESHOLD = 12;

  useEffect(() => {
    setTuneStatus('waiting'); setCents(null); setDetectedString(null); setDisplayFreq(null);
  }, [selectedIndex]);

  useEffect(() => {
    if (!isActive) { setTuneStatus('waiting'); setCents(null); setDisplayFreq(null); setDetectedString(null); }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    if (pitch.frequency === null) {
      setTuneStatus('waiting'); setCents(null); setDisplayFreq(null); setDetectedString(null);
      return;
    }
    const freq = pitch.frequency;
    setDisplayFreq(freq);
    const matched = identifyString(freq);
    setDetectedString(matched);

    if (!matched) { setTuneStatus('waiting'); setCents(null); return; }
    if (matched.number !== selectedString.number) { setTuneStatus('wrongString'); setCents(null); return; }

    const c = getCents(freq, selectedString.freq);
    setCents(c);
    setTuneStatus(Math.abs(c) <= TUNE_THRESHOLD ? 'inTune' : c < 0 ? 'tooLow' : 'tooHigh');
  }, [pitch, isActive, selectedString]);

  const handleToggle = () => {
    if (isActive) { stopListening(); setTuneStatus('waiting'); setCents(null); }
    else startListening();
  };

  const isInTune = tuneStatus === 'inTune';

  // Feedback config
  const feedback: { icon: string; text: string; sub?: string; bg: string; fg: string; border: string } = (() => {
    if (!isActive) return { icon: '🎸', text: 'Nhấn mic để bắt đầu', bg: '#161616', fg: '#666', border: '#2a2a2a' };
    switch (tuneStatus) {
      case 'waiting':    return { icon: '👂', text: `Gảy dây ${selectedString.number}`, bg: '#161616', fg: '#999', border: '#2a2a2a' };
      case 'wrongString': return {
        icon: '⚠️', text: 'Sai dây!',
        sub: detectedString ? `Đang gảy dây ${detectedString.number} (${detectedString.note}) — cần dây ${selectedString.number}` : `Hãy gảy dây ${selectedString.number}`,
        bg: '#1f0f0f', fg: '#f87171', border: '#7f1d1d',
      };
      case 'tooLow':  return { icon: '⬆️', text: 'Âm đang THẤP', sub: 'Vặn khóa theo chiều kim đồng hồ để căng dây', bg: '#0c1929', fg: '#60a5fa', border: '#1e3a5f' };
      case 'tooHigh': return { icon: '⬇️', text: 'Âm đang CAO',  sub: 'Xoay khóa ngược chiều kim đồng hồ để nới dây', bg: '#1a0f05', fg: '#fb923c', border: '#7c2d12' };
      case 'inTune':  return { icon: '✅', text: 'Đúng rồi!', sub: `Dây ${selectedString.number} (${selectedString.note}) đã chuẩn!`, bg: '#061812', fg: '#4ade80', border: '#14532d' };
    }
  })();

  return (
    <div style={{
      width: '100%', maxWidth: 420, margin: '0 auto',
      backgroundColor: '#0d0d0d', color: '#f5f5f5',
      fontFamily: "'Inter', system-ui, sans-serif",
      borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', textAlign: 'center', borderBottom: '1px solid #1a1a1a', paddingBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#555', marginBottom: 6, textTransform: 'uppercase' }}>
          Guitar Tuner
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', letterSpacing: -0.5 }}>
          Chỉnh dây đàn
        </div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Chuẩn dây EADGBE tiêu chuẩn</div>
      </div>

      <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* String selector */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#444', marginBottom: 10, textTransform: 'uppercase' }}>
            Chọn dây
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
            {STRINGS.map((s, i) => {
              const sel = i === selectedIndex;
              return (
                <button
                  key={s.number}
                  onClick={() => { stopListening(); setSelectedIndex(i); }}
                  style={{
                    padding: '10px 4px',
                    borderRadius: 10,
                    border: `2px solid ${sel ? s.color : '#222'}`,
                    backgroundColor: sel ? s.color + '22' : '#161616',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 800, color: sel ? s.color : '#666' }}>{s.number}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: sel ? s.color : '#444', letterSpacing: 0.5 }}>{s.note}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active string badge */}
        <div style={{
          borderRadius: 14, border: `1.5px solid ${selectedString.color}22`,
          backgroundColor: '#111', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: selectedString.color, textTransform: 'uppercase', marginBottom: 4 }}>
              Đang chỉnh
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f0f0f0' }}>{selectedString.label}</div>
          </div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#555',
            backgroundColor: '#1a1a1a', borderRadius: 8, padding: '4px 10px',
          }}>
            {selectedString.freq} Hz
          </div>
        </div>

        {/* Needle */}
        <div style={{
          backgroundColor: '#111', borderRadius: 16,
          padding: '16px 8px 8px', position: 'relative',
        }}>
          <TunerNeedle cents={isActive ? cents : null} isInTune={isInTune} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '0 8px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: displayFreq && isActive ? '#ccc' : '#333' }}>
              {displayFreq && isActive ? `${displayFreq.toFixed(1)} Hz` : '— Hz'}
            </span>
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: isInTune ? '#4ade80' : cents !== null && isActive ? '#f97316' : '#333',
            }}>
              {cents !== null && isActive
                ? `${cents > 0 ? '+' : ''}${cents.toFixed(0)} ¢`
                : '0 ¢'}
            </span>
          </div>
        </div>

        {/* Feedback */}
        <div style={{
          borderRadius: 14, padding: '14px 18px',
          backgroundColor: feedback.bg, border: `1px solid ${feedback.border}`,
          transition: 'background-color 0.3s, border-color 0.3s',
          minHeight: 64,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{feedback.icon}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: feedback.fg, letterSpacing: 0.2 }}>
                {feedback.text}
              </div>
              {feedback.sub && (
                <div style={{ fontSize: 12, color: feedback.fg, opacity: 0.8, marginTop: 3, lineHeight: 1.5 }}>
                  {feedback.sub}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mic button */}
        <button
          onClick={handleToggle}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '16px 0', borderRadius: 50,
            border: `2px solid ${isActive ? '#22c55e' : '#2a2a2a'}`,
            backgroundColor: isActive ? '#061812' : '#161616',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 22 }}>{isActive ? '⏹' : '🎙'}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: isActive ? '#4ade80' : '#f0f0f0' }}>
            {isActive ? 'Dừng nghe' : 'Bắt đầu nghe'}
          </span>
          {isActive && (
            <span style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: '#22c55e',
              animation: 'pulse 1.4s infinite',
            }} />
          )}
        </button>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={() => playReferenceTone(selectedString.freq)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 0', borderRadius: 12,
              border: '1px solid #222', backgroundColor: '#161616',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16 }}>🔊</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>Nghe âm mẫu</span>
          </button>
          <button
            onClick={() => { stopListening(); setSelectedIndex(i => (i + 1) % STRINGS.length); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 0', borderRadius: 12,
              border: '1px solid #1e3a5f', backgroundColor: '#0a1624',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16 }}>➡</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#93c5fd' }}>Dây tiếp theo</span>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ backgroundColor: '#1f0505', borderRadius: 10, padding: '12px 16px', border: '1px solid #7f1d1d' }}>
            <span style={{ fontSize: 13, color: '#f87171', lineHeight: 1.5 }}>{error}</span>
          </div>
        )}

        {/* Reference table */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#444', marginBottom: 10, textTransform: 'uppercase' }}>
            Tần số chuẩn
          </div>
          <div style={{ backgroundColor: '#111', borderRadius: 12, overflow: 'hidden' }}>
            {STRINGS.map((s, i) => (
              <div
                key={s.number}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px',
                  borderBottom: i < STRINGS.length - 1 ? '1px solid #1a1a1a' : 'none',
                  backgroundColor: i === selectedIndex ? '#161616' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
                onClick={() => { stopListening(); setSelectedIndex(i); }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#888', flex: 1 }}>
                  {s.label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#555' }}>{s.freq} Hz</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
