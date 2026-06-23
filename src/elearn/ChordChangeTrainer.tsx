// ── Luyện ĐỔI HỢP ÂM theo nhịp "chơi 1 ô – nghỉ 1 ô" ──────────────────────────
// Bản tương tác thay cho PDF tĩnh: metronome đếm nhịp 4/4, ô nhịp lẻ GẢY hợp âm,
// ô nhịp chẵn NGHỈ để kịp chuyển ngón sang hợp âm sau. Mic nghe liên tục (buildChroma
// + scoreAllChords) → mỗi ô "chơi" nếu app nhận đúng hợp âm thì tính 1 lần "đổi sạch".
// Tái dùng đồ nghề elearn: chordShape (sơ đồ), playTone (tiếng metronome), detector.
import { useEffect, useRef, useState, useCallback } from 'react'
import { buildChroma, scoreAllChords } from './useChordDetector'
import { chordShape } from '../logic/chordLibrary'
import { playTone } from './audio'

const FFT_SIZE = 4096
const SAMPLE_RATE = 44100
const MIN_RMS = 0.008
const INDIGO = '#4338CA'
const ORANGE = '#EA580C'

// ── Mic nghe liên tục: trả về tên hợp âm đang nghe (ref, không re-render mỗi frame) ──
function useLiveChord() {
  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const currentRef = useRef<string>('')   // hợp âm đang nghe (đã lọc)
  const histRef = useRef<string[]>([])
  const [active, setActive] = useState(false)

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    currentRef.current = ''
    histRef.current = []
    setActive(false)
  }, [])

  const start = useCallback(async () => {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      })
    } catch {
      alert('Không truy cập được microphone. Vui lòng cấp quyền để app nghe và chấm.')
      return
    }
    streamRef.current = stream
    if (!ctxRef.current || ctxRef.current.state === 'closed') ctxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE })
    if (ctxRef.current.state === 'suspended') await ctxRef.current.resume()
    const ctx = ctxRef.current
    const analyser = ctx.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyser.smoothingTimeConstant = 0.5
    analyser.minDecibels = -100
    analyser.maxDecibels = -10
    ctx.createMediaStreamSource(stream).connect(analyser)
    const freqDb = new Float32Array(analyser.frequencyBinCount)
    const time = new Float32Array(FFT_SIZE)
    setActive(true)

    const tick = () => {
      analyser.getFloatFrequencyData(freqDb)
      analyser.getFloatTimeDomainData(time)
      let sum = 0; for (let i = 0; i < time.length; i++) sum += time[i] * time[i]
      const rms = Math.sqrt(sum / time.length)
      if (rms < MIN_RMS) {
        histRef.current.push(''); if (histRef.current.length > 7) histRef.current.shift()
      } else {
        const chroma = buildChroma(freqDb, ctx.sampleRate, FFT_SIZE)
        const top = scoreAllChords(chroma)[0]
        histRef.current.push(top && top.score > 0.82 ? top.name : '')
        if (histRef.current.length > 7) histRef.current.shift()
      }
      // lọc trung vị đơn giản: tên xuất hiện nhiều nhất trong cửa sổ
      const counts: Record<string, number> = {}
      histRef.current.forEach(n => { if (n) counts[n] = (counts[n] || 0) + 1 })
      let best = '', bc = 0
      Object.entries(counts).forEach(([n, c]) => { if (c > bc) { bc = c; best = n } })
      currentRef.current = bc >= 3 ? best : ''
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => () => stop(), [stop])
  return { start, stop, active, currentRef }
}

// ── Sơ đồ hợp âm nhỏ ──────────────────────────────────────────────────────────
function MiniDiagram({ name, dim }: { name: string; dim?: boolean }) {
  const shape = chordShape(name)
  if (!shape) return null
  const frets = shape.frets // dây 6 → dây 1
  const W = 84, padX = 11, fw = (W - 2 * padX) / 5, padTop = 20, rh = 15, rows = 4
  const fretted = frets.filter(f => f > 0)
  const baseFret = fretted.length ? Math.min(...fretted) : 1
  const offset = baseFret > rows ? baseFret - 1 : 0
  const fingerOf = (i: number, f: number) => {
    // gợi ý số ngón đơn giản theo thư viện phổ biến
    const map: Record<string, string[]> = {
      C: ['', '3', '2', '', '1', ''], G7: ['3', '2', '', '', '', '1'],
    }
    return (map[name]?.[i]) || String(f - offset)
  }
  return (
    <svg viewBox="0 0 84 96" style={{ width: '100%', height: 86, opacity: dim ? 0.75 : 1 }}>
      {[0, 1, 2, 3, 4, 5].map(s => <line key={'s' + s} x1={padX + s * fw} y1={padTop} x2={padX + s * fw} y2={padTop + rows * rh} stroke="#C9CEDA" strokeWidth={1} />)}
      {[0, 1, 2, 3, 4].map(r => <line key={'r' + r} x1={padX} y1={padTop + r * rh} x2={W - padX} y2={padTop + r * rh} stroke="#C9CEDA" strokeWidth={r === 0 && !offset ? 2.5 : 1} />)}
      {frets.map((f, i) => {
        const x = padX + i * fw
        if (f === -1) return <text key={i} x={x} y={13} textAnchor="middle" fontSize={11} fill="#9AA0B0">×</text>
        if (f === 0) return <circle key={i} cx={x} cy={9} r={4} fill="none" stroke="#9AA0B0" />
        const cy = padTop + (f - offset - 0.5) * rh
        return (
          <g key={i}>
            <circle cx={x} cy={cy} r={6} fill={dim ? '#9AA0B0' : INDIGO} />
            <text x={x} y={cy + 3.5} textAnchor="middle" fontSize={9} fill="#fff">{fingerOf(i, f)}</text>
          </g>
        )
      })}
    </svg>
  )
}

const SEQ = ['C', 'G7'] // luân phiên 2 hợp âm

export default function ChordChangeTrainer({ bpm: bpm0 = 60, target = 8, onPass }: { bpm?: number; target?: number; onPass?: () => void }) {
  const { start, stop, active, currentRef } = useLiveChord()
  const [bpm, setBpm] = useState(bpm0)
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(0)       // 0..7 trong 1 chu kỳ (ô chơi 0-3, ô nghỉ 4-7)
  const [reqIdx, setReqIdx] = useState(0)    // hợp âm cần chơi = SEQ[reqIdx]
  const [clean, setClean] = useState(0)      // số lần đổi sạch
  const [heard, setHeard] = useState('')     // hợp âm app đang nghe (hiển thị)
  const beatRef = useRef(0)
  const reqRef = useRef(0)
  const gotRef = useRef(false)
  const cleanRef = useRef(0)

  const required = SEQ[reqIdx]
  const next = SEQ[(reqIdx + 1) % SEQ.length]
  const phase: 'play' | 'rest' = beat < 4 ? 'play' : 'rest'

  // vòng lặp nhịp
  useEffect(() => {
    if (!running) return
    const beatMs = (60 / bpm) * 1000
    const id = setInterval(() => {
      const b = (beatRef.current + 1) % 8
      // sang ô NGHỈ (beat 4): chốt kết quả ô chơi vừa rồi
      if (b === 4) {
        if (gotRef.current && cleanRef.current < target) { cleanRef.current += 1; setClean(cleanRef.current) }
        gotRef.current = false
      }
      // hết chu kỳ → đổi hợp âm cần chơi
      if (b === 0) { reqRef.current = (reqRef.current + 1) % SEQ.length; setReqIdx(reqRef.current); gotRef.current = false }
      // tiếng metronome: ô chơi rõ, ô nghỉ nhẹ
      playTone(b % 4 === 0 ? 880 : 660)
      // trong ô chơi: nghe mic, đúng hợp âm thì đánh dấu
      if (b < 4 && currentRef.current === SEQ[reqRef.current]) gotRef.current = true
      beatRef.current = b
      setBeat(b)
      setHeard(currentRef.current)
      if (cleanRef.current >= target) { onPass?.() }
    }, beatMs)
    return () => clearInterval(id)
  }, [running, bpm, target, onPass, currentRef])

  // đọc hợp âm đang nghe để hiển thị mượt
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setHeard(currentRef.current), 150)
    return () => clearInterval(id)
  }, [running, currentRef])

  const toggle = async () => {
    if (running) { setRunning(false); stop(); return }
    await start()
    beatRef.current = 7; reqRef.current = SEQ.length - 1; gotRef.current = false
    cleanRef.current = 0; setClean(0)
    setRunning(true)
  }

  const done = clean >= target
  const card = (name: string, isReq: boolean) => (
    <div style={{ flex: 1, background: '#fff', border: `${isReq ? 2 : 1}px solid ${isReq ? INDIGO : '#E1E4EA'}`, borderRadius: 16, padding: '10px 8px 8px', textAlign: 'center', opacity: isReq ? 1 : 0.78 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: isReq ? INDIGO : '#3A4050' }}>{name}</div>
      <MiniDiagram name={name} dim={!isReq} />
      <div style={{ fontSize: 10, fontWeight: 700, color: isReq ? ORANGE : '#9AA0B0' }}>{isReq ? (phase === 'play' ? 'gảy đi!' : 'chuyển ngón…') : 'kế tiếp'}</div>
    </div>
  )

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 360, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {card(required, true)}
        {card(next, false)}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E8EAF0', borderRadius: 16, padding: 12, marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: phase === 'play' ? INDIGO : '#7A8194', fontWeight: 600 }}>
            {running ? (phase === 'play' ? `Gảy xuống hợp âm ${required}` : `Nghỉ — chuyển sang ${next}`) : 'Nhịp 4/4 · chơi 1 ô, nghỉ 1 ô'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: INDIGO }}>{bpm} BPM</div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          {[0, 1, 2, 3].map(i => {
            const on = running && (phase === 'play' ? beat === i : beat - 4 === i)
            const isPlay = phase === 'play'
            return (
              <div key={i} style={{ width: 38, height: 38, borderRadius: 11, border: `1.5px solid ${on ? INDIGO : '#D8DCE6'}`, background: on ? INDIGO : '#fff', color: on ? '#fff' : '#9AA0B0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                {isPlay ? '↓' : '·'}
              </div>
            )
          })}
        </div>
        <input type="range" min={40} max={100} step={5} value={bpm} disabled={running} onChange={e => setBpm(+e.target.value)} style={{ width: '100%' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF3EC', border: '1px solid #FBD9C5', borderRadius: 14, padding: '9px 12px', marginTop: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: active ? ORANGE : '#C3C8D2', display: 'inline-block' }} />
        <span style={{ fontSize: 12, color: '#9A4316', fontWeight: 600 }}>
          {active ? <>App đang nghe: <b style={{ color: heard === required ? '#16A34A' : '#9A4316' }}>{heard || '—'}</b></> : 'Mic tắt — bấm bắt đầu để app nghe & chấm'}
        </span>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#7A8194', marginBottom: 4 }}>
          <span>Đổi sạch (không khựng)</span><span style={{ color: '#16A34A', fontWeight: 700 }}>{clean} / {target} lần</span>
        </div>
        <div style={{ height: 8, background: '#E1E4EA', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (clean / target) * 100)}%`, height: '100%', background: '#16A34A', borderRadius: 4, transition: 'width .3s' }} />
        </div>
      </div>

      {done ? (
        <button onClick={() => onPass?.()} style={{ width: '100%', marginTop: 12, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>✓ Đổi mượt rồi — tiếp tục →</button>
      ) : (
        <button onClick={toggle} style={{ width: '100%', marginTop: 12, background: running ? '#fff' : INDIGO, color: running ? INDIGO : '#fff', border: running ? `1.5px solid ${INDIGO}` : 'none', borderRadius: 14, padding: 13, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
          {running ? '⏸ Tạm dừng' : '▶ Bắt đầu (app sẽ xin quyền mic)'}
        </button>
      )}
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#9AA0B0' }}>Đạt {target}/{target} lần đổi sạch để qua bài · +15 XP</div>
    </div>
  )
}
