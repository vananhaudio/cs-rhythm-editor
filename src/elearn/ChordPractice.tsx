// ChordPractice — hiển thị sơ đồ hợp âm + nghe mic 3 giây → chấm đúng/sai
// Dùng ACF pitch detection (tái dùng từ GuitarTuner) thu thập nhiều nốt trong cửa sổ 3s
// rồi kiểm tra xem có đủ nốt của hợp âm không.

import { useRef, useState, useCallback, useEffect } from 'react'

// ── Chord data ────────────────────────────────────────────────────────────────
export interface ChordPracticeCfg {
  chord: string     // 'Am' | 'C' | 'Dm' | 'Em' | 'E' | 'G'
  chords?: string[] // nếu muốn luyện nhiều hợp âm tuần tự
}

const CHORD_DATA: Record<string, {
  frets: number[]   // 6 dây (dây 6 → dây 1): -1=câm, 0=buông, n=phím
  notes: string[]   // tên nốt cần phát hiện
  label: string
  color: string
}> = {
  Am: { frets: [-1, 0, 2, 2, 1, 0], notes: ['A', 'C', 'E'], label: 'La thứ',     color: '#C0392B' },
  C:  { frets: [-1, 3, 2, 0, 1, 0], notes: ['C', 'E', 'G'], label: 'Đô trưởng',  color: '#2980B9' },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], notes: ['D', 'F', 'A'], label: 'Rê thứ',    color: '#8E44AD' },
  Em: { frets: [0, 2, 2, 0, 0, 0], notes: ['E', 'G', 'B'], label: 'Mi thứ',      color: '#27AE60' },
  E:  { frets: [0, 2, 2, 1, 0, 0], notes: ['E', 'G#', 'B'], label: 'Mi trưởng',  color: '#16A085' },
  G:  { frets: [3, 2, 0, 0, 0, 3], notes: ['G', 'B', 'D'], label: 'Sol trưởng',  color: '#D35400' },
}

// ── Pitch detection (ACF — tái dùng từ GuitarTuner) ─────────────────────────
function detectPitch(buf: Float32Array, sampleRate: number): { freq: number; clarity: number } {
  const SIZE = buf.length
  let sum = 0
  for (let i = 0; i < SIZE; i++) sum += buf[i] * buf[i]
  if (Math.sqrt(sum / SIZE) < 0.01) return { freq: -1, clarity: 0 }

  const HALF = Math.floor(SIZE / 2)
  const r = new Float32Array(HALF)
  for (let lag = 0; lag < HALF; lag++) {
    let s = 0
    for (let i = 0; i < HALF; i++) s += buf[i] * buf[i + lag]
    r[lag] = s
  }

  let firstMin = 1
  for (let i = 1; i < HALF - 1; i++) {
    if (r[i] <= r[i - 1] && r[i] <= r[i + 1]) { firstMin = i; break }
  }

  const minLag = Math.floor(sampleRate / 1200)
  const maxLag = Math.floor(sampleRate / 60)
  const searchFrom = Math.max(firstMin, minLag)

  let bestLag = -1, bestVal = -Infinity
  for (let i = searchFrom; i < Math.min(HALF - 1, maxLag); i++) {
    if (r[i] > bestVal) { bestVal = r[i]; bestLag = i }
  }

  if (bestLag < 2) return { freq: -1, clarity: 0 }
  const clarity = r[0] > 0 ? bestVal / r[0] : 0
  if (clarity < 0.55) return { freq: -1, clarity: 0 }

  const y0 = r[bestLag - 1], y1 = r[bestLag], y2 = r[bestLag + 1] ?? y1
  const denom = 2 * (2 * y1 - y0 - y2)
  const refined = denom !== 0 ? bestLag - (y0 - y2) / denom : bestLag
  return { freq: sampleRate / refined, clarity }
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
function freqToNote(freq: number): string {
  const midi = Math.round(12 * Math.log2(freq / 440) + 69)
  return NOTE_NAMES[((midi % 12) + 12) % 12]
}

// ── Chord diagram SVG ────────────────────────────────────────────────────────
function ChordDiagramSVG({ name, frets, color }: { name: string; frets: number[]; color: string }) {
  const xs = [16, 36, 56, 76, 96, 116]
  const minFret = Math.min(...frets.filter(f => f > 0))
  const offset = minFret > 3 ? minFret - 1 : 0

  return (
    <svg viewBox="0 0 132 165" width="160" style={{ display: 'block' }}>
      {/* Tên hợp âm */}
      <text x={66} y={14} textAnchor="middle" fontSize={18} fontWeight="800" fill={color}>{name}</text>

      {/* Nut (phím 0) */}
      <rect x={14} y={28} width={104} height={5} rx={2} fill="#2A2622" />

      {/* Phím đàn */}
      {[0, 1, 2, 3].map(row => (
        <line key={row} x1={16} x2={116} y1={33 + row * 28} y2={33 + row * 28} stroke="#C9BBA4" strokeWidth={1.4} />
      ))}

      {/* Dây */}
      {xs.map((x, i) => (
        <line key={i} x1={x} x2={x} y1={28} y2={145} stroke="#B8AD9C" strokeWidth={i === 0 ? 2.6 : 1.6} />
      ))}

      {/* Ký hiệu buông / câm */}
      {frets.map((f, i) => f === 0
        ? <circle key={'o'+i} cx={xs[i]} cy={20} r={5} fill="none" stroke="#9A8F7E" strokeWidth={1.5} />
        : f < 0 ? <text key={'x'+i} x={xs[i]} y={24} textAnchor="middle" fontSize={11} fill="#9A8F7E">✕</text>
        : null
      )}

      {/* Chấm bấm */}
      {frets.map((f, i) => f > 0 ? (
        <circle key={'d'+i} cx={xs[i]} cy={33 + (f - offset - 0.5) * 28} r={8} fill={color} />
      ) : null)}

      {/* Số phím nếu capo */}
      {offset > 0 && (
        <text x={10} y={47} textAnchor="end" fontSize={10} fill="#9A8F7E">{offset + 1}fr</text>
      )}
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
type PracticeState = 'idle' | 'listening' | 'pass' | 'fail'

export function ChordPractice({ cfg, onPass }: { cfg: ChordPracticeCfg; onPass?: () => void }) {
  const chordList = cfg.chords ?? [cfg.chord ?? 'Am']
  const [chordIdx, setChordIdx] = useState(0)
  const chordName = chordList[chordIdx]
  const data = CHORD_DATA[chordName] ?? CHORD_DATA.Am

  const [state, setState] = useState<PracticeState>('idle')
  const [countdown, setCountdown] = useState(3)
  const [detectedSet, setDetectedSet] = useState<Set<string>>(new Set())

  const rafRef = useRef<number | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopMic = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (ctxRef.current?.state !== 'closed') ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
  }, [])

  useEffect(() => () => stopMic(), [stopMic])

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      })
      streamRef.current = stream
      const ac = new AudioContext({ sampleRate: 44100 })
      if (ac.state === 'suspended') await ac.resume()
      ctxRef.current = ac

      const analyser = ac.createAnalyser()
      analyser.fftSize = 8192
      analyser.smoothingTimeConstant = 0
      ac.createMediaStreamSource(stream).connect(analyser)

      const buf = new Float32Array(analyser.fftSize)
      const notes = new Set<string>()
      const startMs = Date.now()
      let lastCountdown = 3

      setState('listening')
      setCountdown(3)
      setDetectedSet(new Set())

      const tick = () => {
        const elapsed = (Date.now() - startMs) / 1000
        const remaining = Math.max(0, Math.ceil(3 - elapsed))
        if (remaining !== lastCountdown) { lastCountdown = remaining; setCountdown(remaining) }

        if (elapsed >= 3) {
          stopMic()
          const required = data.notes
          const matched = required.filter(n => notes.has(n))
          setDetectedSet(new Set(notes))
          if (matched.length >= Math.ceil(required.length * 0.6)) {
            setState('pass')
            onPass?.()
          } else {
            setState('fail')
          }
          return
        }

        analyser.getFloatTimeDomainData(buf)
        const { freq, clarity } = detectPitch(buf, ac.sampleRate)
        if (clarity > 0.65 && freq > 60 && freq < 1400) {
          notes.add(freqToNote(freq))
          setDetectedSet(new Set(notes))
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setState('fail')
      stopMic()
    }
  }, [data.notes, onPass, stopMic])

  const retry = () => { setState('idle'); setDetectedSet(new Set()) }
  const nextChord = () => {
    const next = chordIdx + 1
    if (next < chordList.length) {
      setChordIdx(next)
      setState('idle')
      setDetectedSet(new Set())
    }
  }
  const isMulti = chordList.length > 1
  const isLastChord = chordIdx === chordList.length - 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '8px 0' }}>

      {/* Tiến trình nếu nhiều hợp âm */}
      {isMulti && (
        <div style={{ display: 'flex', gap: 6 }}>
          {chordList.map((c, i) => (
            <div key={c} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700,
              background: i < chordIdx ? '#D1FAE5' : i === chordIdx ? data.color : '#E5E7EB',
              color: i < chordIdx ? '#065F46' : i === chordIdx ? '#fff' : '#6B7280'
            }}>{c}</div>
          ))}
        </div>
      )}

      {/* Sơ đồ hợp âm */}
      <div style={{
        background: '#F8F4EE', borderRadius: 16, padding: '20px 32px',
        boxShadow: state === 'pass' ? `0 0 0 3px ${data.color}40` : 'none',
        transition: 'box-shadow 0.3s'
      }}>
        <ChordDiagramSVG name={chordName} frets={data.frets} color={data.color} />
        <div style={{ textAlign: 'center', fontSize: 13, color: '#9A8F7E', marginTop: 8 }}>
          {data.label} · Nốt: {data.notes.join(' – ')}
        </div>
      </div>

      {/* Nốt đã phát hiện */}
      {state !== 'idle' && detectedSet.size > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {data.notes.map(n => {
            const hit = detectedSet.has(n)
            return (
              <div key={n} style={{
                padding: '4px 14px', borderRadius: 20, fontSize: 14, fontWeight: 700,
                background: hit ? '#D1FAE5' : '#FEF3C7',
                color: hit ? '#065F46' : '#92400E',
                border: `1.5px solid ${hit ? '#6EE7B7' : '#FCD34D'}`
              }}>{n} {hit ? '✓' : '?'}</div>
            )
          })}
        </div>
      )}

      {/* Trạng thái + nút */}
      {state === 'idle' && (
        <button onClick={startListening} style={{
          width: '100%', padding: '16px', borderRadius: 14, border: 'none',
          background: data.color, color: '#fff', fontSize: 16, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit'
        }}>
          🎤 Gảy hợp âm {chordName} rồi bấm đây
        </button>
      )}

      {state === 'listening' && (
        <div style={{
          width: '100%', padding: '16px', borderRadius: 14,
          background: '#1C1B19', color: '#F4ECDF', fontSize: 16, fontWeight: 700,
          textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
        }}>
          <span style={{ fontSize: 22, animation: 'pulse 0.8s infinite' }}>🎤</span>
          Đang nghe... {countdown}s
        </div>
      )}

      {state === 'pass' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            padding: '16px', borderRadius: 14, background: '#D1FAE5',
            color: '#065F46', fontSize: 17, fontWeight: 800, textAlign: 'center'
          }}>
            ✓ Đúng rồi! Hợp âm {chordName} chuẩn!
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={retry} style={{
              flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid #E4E4E7',
              background: '#fff', color: '#52525B', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit'
            }}>↺ Gảy lại</button>
            {isMulti && !isLastChord ? (
              <button onClick={nextChord} style={{
                flex: 2, padding: '13px', borderRadius: 12, border: 'none',
                background: '#4338CA', color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit'
              }}>Hợp âm tiếp theo →</button>
            ) : null}
          </div>
        </div>
      )}

      {state === 'fail' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            padding: '14px 16px', borderRadius: 14, background: '#FEF3C7',
            color: '#92400E', fontSize: 15, fontWeight: 700, textAlign: 'center'
          }}>
            Chưa đúng — thử lại nhé!
            {detectedSet.size > 0 && (
              <div style={{ fontSize: 13, fontWeight: 400, marginTop: 4, opacity: 0.8 }}>
                Nghe được: {[...detectedSet].join(', ')} · Cần: {data.notes.join(', ')}
              </div>
            )}
          </div>
          <button onClick={retry} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: data.color, color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit'
          }}>🎤 Thử lại</button>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  )
}
