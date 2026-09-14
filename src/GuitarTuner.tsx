import { useEffect, useRef, useState, useCallback } from 'react';
import { useAudioContextResume } from './useAudioContextResume';
import { playGuitarNote } from './audioEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

type PitchResult = { frequency: number | null; clarity: number };
type TuneStatus = 'waiting' | 'wrongString' | 'tooLow' | 'tooHigh' | 'inTune';

// ─── Guitar strings ───────────────────────────────────────────────────────────

const STRINGS = [
  { number: 6, name: 'E', octave: 2, freq: 82.41,  note: 'E2', color: '#E11D48', label: 'Dây 6 — Mi trầm', vn: 'Mi trầm', size: 'dây to nhất' },
  { number: 5, name: 'A', octave: 2, freq: 110.0,  note: 'A2', color: '#EA580C', label: 'Dây 5 — La',       vn: 'La',      size: 'dây to thứ nhì' },
  { number: 4, name: 'D', octave: 3, freq: 146.83, note: 'D3', color: '#D97706', label: 'Dây 4 — Rê',       vn: 'Rê',      size: 'dây to thứ ba' },
  { number: 3, name: 'G', octave: 3, freq: 196.0,  note: 'G3', color: '#16A34A', label: 'Dây 3 — Sol',      vn: 'Sol',     size: 'dây nhỏ thứ ba' },
  { number: 2, name: 'B', octave: 3, freq: 246.94, note: 'B3', color: '#2563EB', label: 'Dây 2 — Si',       vn: 'Si',      size: 'dây nhỏ thứ nhì' },
  { number: 1, name: 'E', octave: 4, freq: 329.63, note: 'E4', color: '#7C3AED', label: 'Dây 1 — Mi cao',   vn: 'Mi cao',  size: 'dây nhỏ nhất' },
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
  useAudioContextResume(audioCtxRef);

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

// ─── Line icons (thay emoji) ────────────────────────────────────────────────────

type IconProps = { size?: number; color?: string; sw?: number };
const svgBase = (size: number, color: string, sw: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});
const IconArrowRight = ({ size = 18, color = 'currentColor', sw = 2 }: IconProps) => (
  <svg {...svgBase(size, color, sw)}><line x1="4" y1="12" x2="19" y2="12" /><path d="m13 6 6 6-6 6" /></svg>
);
const IconCheck = ({ size = 18, color = 'currentColor', sw = 2.4 }: IconProps) => (
  <svg {...svgBase(size, color, sw)}><path d="m5 12 5 5L20 6" /></svg>
);
// Vặn khoá CHẶT lại (dây căng hơn → âm cao lên)
const IconTighten = ({ size = 22, color = 'currentColor', sw = 2.2 }: IconProps) => (
  <svg {...svgBase(size, color, sw)}>
    <path d="M20 12a8 8 0 1 0-2.6 5.9" /><path d="M20 6.5V12h-5.5" />
  </svg>
);
// Nới khoá cho CHÙNG (dây chùng hơn → âm thấp xuống)
const IconLoosen = ({ size = 22, color = 'currentColor', sw = 2.2 }: IconProps) => (
  <svg {...svgBase(size, color, sw)}>
    <path d="M4 12a8 8 0 1 1 2.6 5.9" /><path d="M4 6.5V12h5.5" />
  </svg>
);
const IconSpeaker = ({ size = 18, color = 'currentColor', sw = 2 }: IconProps) => (
  <svg {...svgBase(size, color, sw)}>
    <path d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4z" /><path d="M16 9.2a4 4 0 0 1 0 5.6" /><path d="M18.6 6.6a7.5 7.5 0 0 1 0 10.8" />
  </svg>
);
const IconRefresh = ({ size = 18, color = 'currentColor', sw = 2 }: IconProps) => (
  <svg {...svgBase(size, color, sw)}>
    <path d="M20 11.5a8 8 0 1 1-2.4-5.6" /><path d="M20 4v5.5h-5.5" />
  </svg>
);
const IconMic = ({ size = 18, color = 'currentColor', sw = 2 }: IconProps) => (
  <svg {...svgBase(size, color, sw)}>
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><line x1="12" y1="18" x2="12" y2="21" />
  </svg>
);

// ─── Gauge (nốt to giữa + vành cung) ────────────────────────────────────────────

const GA_W = 280, GA_H = 172, GA_CX = 140, GA_CY = 150, GA_R = 118;
const TICKS = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];
const THRESHOLD = 8;
const HOLD_MS = 900;      // giữ chuẩn bao lâu thì tính là "xong dây"
const ADVANCE_MS = 950;   // xong rồi thì bao lâu tự sang dây kế
const SAMPLE_MS = 2200;   // thời gian tạm ngưng nghe khi phát nốt mẫu

const clampC = (c: number) => Math.max(-50, Math.min(50, c));
function centXY(c: number, r: number) {
  const th = ((90 - (clampC(c) / 50) * 90) * Math.PI) / 180;
  return { x: GA_CX + r * Math.cos(th), y: GA_CY - r * Math.sin(th) };
}
function arc(cFrom: number, cTo: number, r: number) {
  const a = centXY(cFrom, r), b = centXY(cTo, r);
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${r} ${r} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

// Tông màu khớp mặt học viên mobile TVA (thẻ sáng + điểm nhấn indigo/cam + đồng hồ nền tối)
const T = {
  bg: '#F0F2F5', card: '#FFFFFF', panel: '#F7F8FA', border: '#E8EAF0',
  ink: '#111827', sub: '#6B7280', faint: '#9CA3AF',
  primary: '#4338CA', primarySoft: '#EEF2FF', primaryBd: '#C7D2FE',
  green: '#16A34A', greenBg: '#F0FDF4', greenBd: '#BBF7D0',
  amber: '#EA580C', amberBg: '#FFF7ED', amberBd: '#FED7AA',
  headerBg: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)',
  gaugeBg: 'linear-gradient(160deg, #312E81 0%, #1E1B4B 100%)',
};
// Palette cho ĐỒNG HỒ nền tối (nốt trắng nổi bật)
const COL = {
  dim: '#4B5563', track: '#3B3A5E', text: '#FFFFFF', mute: '#A5B4FC',
  green: '#22C55E', greenSoft: '#4ADE80', amber: '#FB923C', zoneOff: '#2A4C39',
};

function Gauge({ cents, note, octave, active, isInTune, stale }: {
  cents: number | null; note: string; octave: string | null; active: boolean; isInTune: boolean; stale?: boolean;
}) {
  const hasCents = cents !== null;
  const stateColor = !active ? COL.dim : isInTune ? COL.green : hasCents ? COL.amber : COL.mute;
  const noteColor  = !active ? COL.mute : isInTune ? COL.greenSoft : COL.text;
  const ind = hasCents ? centXY(cents!, GA_R) : null;
  const zone = arc(-THRESHOLD, THRESHOLD, GA_R);

  return (
    <svg width="100%" viewBox={`0 0 ${GA_W} ${GA_H}`} style={{ display: 'block', maxWidth: GA_W, margin: '0 auto' }}>
      {/* vành nền */}
      <path d={arc(-50, 50, GA_R)} stroke={COL.track} strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* vùng "chuẩn" ở giữa */}
      <path d={zone} stroke={isInTune ? COL.green : COL.zoneOff} strokeWidth={isInTune ? 5 : 3.5} fill="none" strokeLinecap="round"
        style={{ transition: 'stroke 0.25s' }} />
      {/* vạch chia */}
      {TICKS.map(c => {
        const major = c % 50 === 0 || c === 0;
        const p1 = centXY(c, GA_R - (major ? 13 : 7));
        const p2 = centXY(c, GA_R);
        return <line key={c} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
          stroke={c === 0 ? COL.green : COL.dim} strokeWidth={c === 0 ? 2.4 : 1.3} strokeLinecap="round" />;
      })}
      {/* con trỏ trên vành — tiếng tắt thì mờ đi nhưng KHÔNG nhúc nhích khỏi chỗ cũ */}
      {ind && (
        <g opacity={stale ? 0.55 : 1} style={{ transition: 'opacity .25s' }}>
          <line x1={centXY(cents!, GA_R - 20).x} y1={centXY(cents!, GA_R - 20).y} x2={ind.x} y2={ind.y}
            stroke={stateColor} strokeWidth={3} strokeLinecap="round" style={{ transition: 'all 0.32s cubic-bezier(0.22,1,0.36,1)' }} />
          <circle cx={ind.x} cy={ind.y} r={6.5} fill={stateColor} style={{ transition: 'all 0.32s cubic-bezier(0.22,1,0.36,1), fill 0.25s' }} />
        </g>
      )}
      {/* nốt to ở giữa */}
      <text x={GA_CX} y={112} textAnchor="middle" opacity={stale ? 0.7 : 1} style={{ transition: 'fill 0.25s, opacity .25s' }}
        fontSize={58} fontWeight={800} fill={noteColor} fontFamily="'Inter', system-ui, sans-serif">
        {active ? note : '–'}
        {active && octave && <tspan fontSize={22} dy={-24} fill={COL.mute}>{octave}</tspan>}
      </text>
      {/* nhãn tiếng Việt hai đầu — người mới không cần hiểu ♭ ♯ */}
      <text x={GA_CX - GA_R + 22} y={GA_CY + 16} textAnchor="start" fontSize={11.5} fill="#8B8BC0" fontWeight={700}>thấp</text>
      <text x={GA_CX + GA_R - 22} y={GA_CY + 16} textAnchor="end" fontSize={11.5} fill="#8B8BC0" fontWeight={700}>cao</text>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GuitarTuner({ embedded = false, onMeaningfulUse }: { embedded?: boolean; onMeaningfulUse?: () => void }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autoMode, setAutoMode]           = useState(true);   // người mới chỉ cần gảy, máy tự biết dây
  const [tuneStatus, setTuneStatus]       = useState<TuneStatus>('waiting');
  const [detectedString, setDetectedString] = useState<typeof STRINGS[number] | null>(null);
  const [cents, setCents]                 = useState<number | null>(null);
  const [displayFreq, setDisplayFreq]     = useState<number | null>(null);
  const [done, setDone]                   = useState<Record<number, boolean>>({});
  const [justDone, setJustDone]           = useState<{ num: number; at: number } | null>(null);
  const [sampling, setSampling]           = useState(false);  // đang phát nốt mẫu qua loa
  const [live, setLive]                   = useState(false);  // false = tiếng đã tắt, kim đang GIỮ kết quả lần gảy trước

  const { pitch, isActive, error, startListening } = usePitchDetection();
  const selectedString = STRINGS[selectedIndex];
  const meaningfulUseRef = useRef(false);
  const doneRef  = useRef<Record<number, boolean>>({});
  const muteUntil = useRef(0);
  useEffect(() => { doneRef.current = done; }, [done]);

  const doneCount = STRINGS.filter(s => done[s.number]).length;
  const allDone = doneCount === STRINGS.length;

  const reset = () => { setTuneStatus('waiting'); setCents(null); setDetectedString(null); setDisplayFreq(null); setLive(false); };

  useEffect(() => { reset(); }, [selectedIndex, autoMode]);
  useEffect(() => { if (!isActive) reset(); }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    if (Date.now() < muteUntil.current) return;   // đang phát nốt mẫu → đừng nghe chính loa của mình
    // Tiếng tắt → KHÔNG xoá kết quả: giữ nguyên kim ở cao độ hợp lệ cuối cùng,
    // chỉ đánh dấu là không còn nghe thấy gì (kim mờ đi + nhắc gảy lại).
    if (pitch.frequency === null) { setLive(false); return; }
    setLive(true);
    if (!meaningfulUseRef.current) {
      meaningfulUseRef.current = true;
      onMeaningfulUse?.();
    }
    const freq = pitch.frequency;
    setDisplayFreq(freq);
    const matched = identifyString(freq);
    setDetectedString(matched);

    const target = autoMode ? matched : selectedString;
    if (!target) { setLive(false); return; }   // âm lạ (không phải dây guitar) → giữ kết quả cũ
    if (!autoMode && matched && matched.number !== selectedString.number) { setTuneStatus('wrongString'); setLive(false); return; }

    const c = getCents(freq, target.freq);
    setCents(c);
    setTuneStatus(Math.abs(c) <= THRESHOLD ? 'inTune' : c < 0 ? 'tooLow' : 'tooHigh');
  }, [pitch, isActive, selectedString, autoMode, onMeaningfulUse]);

  // rung nhẹ khi vừa đạt chuẩn
  const prevStatus = useRef<TuneStatus>('waiting');
  useEffect(() => {
    if (tuneStatus === 'inTune' && prevStatus.current !== 'inTune') {
      try { navigator.vibrate?.(30); } catch (_) {}
    }
    prevStatus.current = tuneStatus;
  }, [tuneStatus]);

  // Giữ chuẩn đủ lâu → đánh dấu dây đó XONG
  const targetString = autoMode ? detectedString : selectedString;
  const targetNumber = targetString?.number ?? null;
  useEffect(() => {
    if (tuneStatus !== 'inTune' || targetNumber === null) return;
    const id = setTimeout(() => {
      setDone(d => (d[targetNumber] ? d : { ...d, [targetNumber]: true }));
      setJustDone({ num: targetNumber, at: Date.now() });
      try { navigator.vibrate?.([20, 60, 20]); } catch (_) {}
    }, HOLD_MS);
    return () => clearTimeout(id);
  }, [tuneStatus, targetNumber]);

  // Xong một dây → ở chế độ "Chọn dây" thì tự nhảy sang dây kế CHƯA xong
  useEffect(() => {
    if (justDone === null) return;
    const id = setTimeout(() => {
      setJustDone(null);
      if (autoMode) return;
      setSelectedIndex(i => {
        for (let k = 1; k <= STRINGS.length; k++) {
          const j = (i + k) % STRINGS.length;
          if (!doneRef.current[STRINGS[j].number]) return j;
        }
        return i;
      });
    }, ADVANCE_MS);
    return () => clearTimeout(id);
  }, [justDone, autoMode]);

  // Tự bật mic khi mở màn (không còn nút bật/tắt). Hook tự stop khi unmount.
  useEffect(() => { startListening(); }, [startListening]);
  const isInTune = tuneStatus === 'inTune';
  // Tiếng đã tắt (hoặc đang phát nốt mẫu) nhưng vẫn còn kết quả đo của lần gảy trước
  const holding = isActive && !live && cents !== null;

  // dây đang hiển thị: auto → dây nhận được; tay → dây đã chọn
  const shownString = isActive && autoMode ? detectedString : selectedString;
  const noteName = shownString?.name ?? '–';
  const noteOct  = shownString ? String(shownString.octave) : null;

  // dây dùng cho nút "Nghe mẫu": auto → dây đang nghe, nếu chưa có thì dây chưa xong đầu tiên
  const sampleString = autoMode
    ? (detectedString ?? STRINGS.find(s => !done[s.number]) ?? STRINGS[0])
    : selectedString;

  const playSample = () => {
    const idx = STRINGS.findIndex(s => s.number === sampleString.number);
    muteUntil.current = Date.now() + SAMPLE_MS;
    setSampling(true);
    setLive(false);
    try { playGuitarNote(sampleString.freq, idx); } catch (_) {}
    setTimeout(() => setSampling(false), SAMPLE_MS);
  };

  const goNextString = () => {
    setAutoMode(false);
    setSelectedIndex(i => {
      for (let k = 1; k <= STRINGS.length; k++) {
        const j = (i + k) % STRINGS.length;
        if (!doneRef.current[STRINGS[j].number]) return j;
      }
      return (i + 1) % STRINGS.length;
    });
  };

  const restart = () => { setDone({}); setJustDone(null); setSelectedIndex(0); reset(); };

  // mức độ gần — nói bằng lời, không bắt học viên đọc "cents"
  const near = (() => {
    if (cents === null) return null;
    const a = Math.abs(cents);
    if (a > 30) return 'Còn xa — vặn đều tay';
    if (a > 15) return 'Gần rồi — vặn chậm lại';
    return 'Sát rồi — vặn thật nhẹ';
  })();

  // dòng trạng thái (không emoji)
  const fb: { icon: React.ReactNode; text: string; sub?: string; fg: string } = (() => {
    if (sampling) return { icon: <IconSpeaker size={20} color={T.primary} />, text: `Đang phát mẫu dây ${sampleString.vn}`, sub: 'Nghe xong hãy gảy dây đó trên đàn', fg: T.primary };
    if (!isActive) return { icon: null, text: error ? 'Không nghe được mic' : 'Đang bật micro…', fg: T.faint };
    switch (tuneStatus) {
      case 'waiting':    return autoMode
        ? { icon: null, text: 'Đang nghe — gảy một dây bất kỳ', sub: 'Gảy nhẹ rồi để yên tay, máy tự biết đó là dây nào', fg: T.sub }
        : { icon: null, text: `Hãy gảy dây ${selectedString.vn} (${selectedString.size})`, sub: `Dây số ${selectedString.number} — gảy nhẹ rồi để yên tay`, fg: T.sub };
      case 'wrongString': return { icon: null, text: 'Chưa đúng dây', sub: detectedString ? `Đang là dây ${detectedString.number} (${detectedString.vn}) — cần gảy dây ${selectedString.number} (${selectedString.vn})` : undefined, fg: T.amber };
      case 'tooLow':  return { icon: <IconTighten size={24} color={T.amber} />,  text: 'Vặn khoá cho CĂNG thêm', sub: `Dây ${shownString?.vn ?? ''} đang chùng (âm thấp). ${near ?? ''}`, fg: T.amber };
      case 'tooHigh': return { icon: <IconLoosen size={24} color={T.amber} />, text: 'Nới khoá cho CHÙNG bớt',  sub: `Dây ${shownString?.vn ?? ''} đang căng quá (âm cao). ${near ?? ''}`, fg: T.amber };
      case 'inTune':  return { icon: <IconCheck size={22} color={T.green} />, text: holding ? 'Dây này đã chuẩn' : 'Chuẩn rồi — giữ yên', sub: shownString ? `${shownString.label} đã đúng` : undefined, fg: T.green };
    }
  })();

  // Tiếng đã tắt → nói rõ đây là kết quả lần gảy vừa rồi, không phải app đang nghe
  const fbView = holding
    ? { ...fb, sub: fb.sub ? `${fb.sub} · Gảy lại dây để kiểm tra` : 'Gảy lại dây để kiểm tra' }
    : fb;

  const btn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '13px 8px', borderRadius: 12, cursor: 'pointer', width: '100%',
    fontFamily: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 46,
    border: `1px solid ${T.primaryBd}`, background: T.primarySoft, color: T.primary, ...extra,
  });

  return (
    <div
      onClick={() => { if (!isActive) startListening(); }}
      style={{
      width: '100%', maxWidth: 420, margin: '0 auto',
      backgroundColor: T.card, color: T.ink,
      fontFamily: "'Inter', system-ui, sans-serif",
      borderRadius: 22, overflow: 'hidden',
      border: `1px solid ${T.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.05)',
    }}>
      {/* Header — thương hiệu Tune Lab */}
      {!embedded ? (
        <div style={{ padding: '20px 20px 18px', textAlign: 'center', background: T.headerBg }}>
          <img src="/tune-lab.png" alt="Tune Lab" style={{ width: 46, height: 46, borderRadius: 12, marginBottom: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.22)' }} />
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.4 }}>Lên dây đàn</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>Tune Lab · Chuẩn EADGBE tiêu chuẩn</div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0 0' }}>
          <img src="/tune-lab.png" alt="Tune Lab" style={{ width: 26, height: 26, borderRadius: 7 }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: T.primary, letterSpacing: 0.2 }}>Tune Lab</span>
        </div>
      )}

      <div style={{ padding: embedded ? '12px 18px 22px' : '16px 18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Auto / Manual toggle */}
        <div style={{ display: 'flex', background: T.bg, borderRadius: 12, padding: 4, gap: 4 }}>
          {([[true, 'Tự động (dễ nhất)'], [false, 'Chọn từng dây']] as const).map(([v, lbl]) => {
            const on = autoMode === v;
            return (
              <button key={String(v)} onClick={() => setAutoMode(v)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13.5, fontWeight: 700, transition: 'all .18s',
                  background: on ? T.card : 'transparent', color: on ? T.primary : T.sub,
                  boxShadow: on ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
                {lbl}
              </button>
            );
          })}
        </div>

        {/* Tiến trình 6 dây */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: allDone ? T.green : T.sub }}>
              {allDone ? 'Cả 6 dây đã chuẩn' : `Đã chuẩn ${doneCount}/6 dây`}
            </span>
            {doneCount > 0 && (
              <button onClick={restart}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: T.faint, padding: '2px 4px' }}>
                <IconRefresh size={14} /> Lên lại từ đầu
              </button>
            )}
          </div>
          <div style={{ height: 5, borderRadius: 4, background: T.bg, overflow: 'hidden' }}>
            <div style={{ width: `${(doneCount / STRINGS.length) * 100}%`, height: '100%', background: allDone ? T.green : T.primary, transition: 'width .3s' }} />
          </div>
        </div>

        {/* String selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
          {STRINGS.map((s, i) => {
            const isSel = !autoMode && i === selectedIndex;
            const isDet = isActive && detectedString?.number === s.number;
            const hl = isSel || isDet;
            const ok = !!done[s.number];
            return (
              <button key={s.number}
                onClick={() => { setAutoMode(false); setSelectedIndex(i); }}
                style={{ position: 'relative', padding: '9px 2px', borderRadius: 11, cursor: 'pointer',
                  border: `1.5px solid ${hl ? s.color : ok ? T.greenBd : T.border}`,
                  background: hl ? s.color + '1e' : ok ? T.greenBg : T.panel,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transition: 'all .15s' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: hl ? s.color : ok ? T.green : T.sub }}>{s.number}</span>
                <span style={{ fontSize: 8.5, fontWeight: 700, color: hl ? s.color : ok ? T.green : T.faint, whiteSpace: 'nowrap' }}>{s.vn}</span>
                {ok && (
                  <span style={{ position: 'absolute', top: -6, right: -4, width: 16, height: 16, borderRadius: 8,
                    background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.18)' }}>
                    <IconCheck size={11} color="#fff" sw={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Gauge — mặt đồng hồ nền tối (nốt trắng nổi bật) */}
        <div style={{ background: T.gaugeBg, borderRadius: 18, padding: '16px 10px 12px', border: `1px solid ${isInTune ? '#22C55E' : 'transparent'}`, boxShadow: '0 6px 18px rgba(49,46,129,0.28)', transition: 'border-color .25s' }}>
          <Gauge cents={isActive ? cents : null} note={noteName} octave={noteOct} active={isActive} isInTune={isInTune} stale={holding} />
          <div style={{ textAlign: 'center', fontSize: 11.5, color: holding ? '#C7D2FE' : '#8B8BC0', marginTop: 2, transition: 'color .25s' }}>
            {holding ? 'Kết quả lần gảy vừa rồi — gảy lại dây để kiểm tra' : 'Kim lệch trái = dây chùng · lệch phải = dây căng'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, padding: '0 12px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, opacity: holding ? 0.65 : 1, color: displayFreq && isActive ? '#C7D2FE' : '#6B6BA0', fontVariantNumeric: 'tabular-nums' }}>
              {displayFreq && isActive ? `${displayFreq.toFixed(1)} Hz` : '— Hz'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', opacity: holding ? 0.65 : 1,
              color: isInTune ? '#4ADE80' : cents !== null && isActive ? '#FB923C' : '#6B6BA0' }}>
              {cents !== null && isActive ? `${Math.round(cents) > 0 ? '+' : ''}${Math.round(cents) === 0 ? 0 : Math.round(cents)} ¢` : '— ¢'}
            </span>
          </div>
        </div>

        {/* Feedback — nền đổi theo trạng thái (xong cả 6 dây thì nhường chỗ cho lời chúc) */}
        {!(allDone && tuneStatus === 'waiting' && !sampling) && (() => {
          const off = isActive && !sampling && (tuneStatus === 'tooLow' || tuneStatus === 'tooHigh' || tuneStatus === 'wrongString');
          const bg = isInTune ? T.greenBg : off ? T.amberBg : sampling ? T.primarySoft : T.panel;
          const bd = isInTune ? T.greenBd : off ? T.amberBd : sampling ? T.primaryBd : T.border;
          return (
            <div style={{ borderRadius: 14, padding: '13px 16px', backgroundColor: bg, border: `1px solid ${bd}`, minHeight: 62, display: 'flex', alignItems: 'center', gap: 11, transition: 'all .25s' }}>
              {fbView.icon && <span style={{ display: 'flex', flexShrink: 0 }}>{fbView.icon}</span>}
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: fbView.fg, letterSpacing: 0.2 }}>{fbView.text}</div>
                {fbView.sub && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3, lineHeight: 1.45 }}>{fbView.sub}</div>}
              </div>
            </div>
          );
        })()}

        {/* Xong cả 6 dây */}
        {allDone && (
          <div style={{ borderRadius: 14, padding: '14px 16px', background: T.greenBg, border: `1px solid ${T.greenBd}`, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.green }}>Xong! Đàn đã lên dây chuẩn</div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>Gảy thử một hợp âm xem đã êm tai chưa nhé.</div>
          </div>
        )}

        {/* Hàng nút: nghe mẫu + dây tiếp theo */}
        <div style={{ display: 'grid', gridTemplateColumns: autoMode || allDone ? '1fr' : '1fr 1fr', gap: 8 }}>
          <button onClick={playSample} disabled={sampling}
            style={btn({ opacity: sampling ? 0.6 : 1, cursor: sampling ? 'default' : 'pointer' })}>
            <IconSpeaker size={17} /> {autoMode || allDone ? `Nghe mẫu dây ${sampleString.vn}` : 'Nghe mẫu'}
          </button>
          {!autoMode && !allDone && (
            <button onClick={goNextString} style={btn()}>
              Dây tiếp theo <IconArrowRight size={17} />
            </button>
          )}
        </div>

        {/* Error + bật lại mic */}
        {error && (
          <div style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: '13px 16px', border: '1px solid #FECACA' }}>
            <div style={{ fontSize: 13.5, color: '#B91C1C', lineHeight: 1.5, marginBottom: 10 }}>{error}</div>
            <button onClick={(e) => { e.stopPropagation(); startListening(); }}
              style={btn({ background: '#fff', border: '1px solid #FECACA', color: '#B91C1C' })}>
              <IconMic size={16} /> Cho phép &amp; nghe lại
            </button>
          </div>
        )}

        {!error && (
          <div style={{ fontSize: 11.5, color: T.faint, textAlign: 'center', lineHeight: 1.5 }}>
            Mẹo: để đàn gần điện thoại, gảy nhẹ MỘT dây rồi vặn khoá thật chậm.
          </div>
        )}
      </div>

    </div>
  );
}
