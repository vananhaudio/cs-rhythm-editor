// ── Luyện ĐỔI HỢP ÂM theo CHUỖI (tổng quát) ───────────────────────────────────
// Chạy y theo bản nhạc: mỗi ô = { hợp âm, số phách }. strumPerBeat: true = quạt mỗi phách
// (4 gảy/ô), false = nốt tròn (1 gảy/ô, giữ). Mic nhận hợp âm liên tục; đi hết chuỗi = 1 vòng.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveChord, MiniDiagram } from './ChordChangeTrainer'

const INDIGO = '#4338CA'
const ORANGE = '#EA580C'

export interface Cell { chord: string; beats: number }
export interface Exercise { name: string; cells: Cell[]; strumPerBeat: boolean }

let clickCtx: AudioContext | null = null
function click(kind: 'accent' | 'play') {
  try {
    if (!clickCtx) clickCtx = new AudioContext()
    if (clickCtx.state === 'suspended') clickCtx.resume()
    const t = clickCtx.currentTime, o = clickCtx.createOscillator(), g = clickCtx.createGain()
    o.type = 'square'; o.frequency.value = kind === 'accent' ? 3200 : 2500
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(kind === 'accent' ? 0.18 : 0.1, t + 0.001)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    o.connect(g); g.connect(clickCtx.destination); o.start(t); o.stop(t + 0.06)
  } catch { /* bỏ qua */ }
}

export default function ChordSeqTrainer({ exercise, bpm: bpm0 = 60, loops = 2, onPass }: { exercise: Exercise; bpm?: number; loops?: number; onPass?: () => void }) {
  const { start, stop, active, currentRef } = useLiveChord()
  const [bpm, setBpm] = useState(bpm0)
  const [running, setRunning] = useState(false)
  const [pos, setPos] = useState(0)          // beat index trong timeline
  const [loopOk, setLoopOk] = useState(0)    // số vòng sạch
  const [heard, setHeard] = useState('')
  const posRef = useRef(0)
  const hitsRef = useRef<boolean[]>([])
  const loopRef = useRef(0)

  // Dòng thời gian: mỗi phách biết đang ở ô nào + có gảy không
  const timeline = useMemo(() => {
    const tl: { cellIdx: number; beatInCell: number; strum: boolean }[] = []
    exercise.cells.forEach((c, ci) => {
      for (let b = 0; b < c.beats; b++) tl.push({ cellIdx: ci, beatInCell: b, strum: exercise.strumPerBeat || b === 0 })
    })
    return tl
  }, [exercise])

  const cur = timeline[pos] ?? { cellIdx: 0, beatInCell: 0, strum: true }
  const curCell = exercise.cells[cur.cellIdx]
  const nextChord = exercise.cells[(cur.cellIdx + 1) % exercise.cells.length]?.chord

  useEffect(() => {
    if (!running) return
    const beatMs = (60 / bpm) * 1000
    const id = setInterval(() => {
      let p = posRef.current + 1
      if (p >= timeline.length) {
        // hết 1 vòng → chấm
        if (hitsRef.current.every(Boolean) && loopRef.current < loops) { loopRef.current += 1; setLoopOk(loopRef.current) }
        hitsRef.current = exercise.cells.map(() => false)
        p = 0
      }
      const slot = timeline[p]
      click(slot.beatInCell === 0 ? 'accent' : 'play')
      if (currentRef.current === exercise.cells[slot.cellIdx].chord) hitsRef.current[slot.cellIdx] = true
      posRef.current = p; setPos(p); setHeard(currentRef.current)
      if (loopRef.current >= loops) onPass?.()
    }, beatMs)
    return () => clearInterval(id)
  }, [running, bpm, timeline, exercise, loops, onPass, currentRef])

  const toggle = async () => {
    if (running) { setRunning(false); stop(); return }
    await start()
    posRef.current = timeline.length - 1; loopRef.current = 0; setLoopOk(0)
    hitsRef.current = exercise.cells.map(() => false)
    setRunning(true)
  }

  const done = loopOk >= loops

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 360, margin: '0 auto' }}>
      {/* Dải chuỗi hợp âm — ô đang chơi sáng lên */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 12 }}>
        {exercise.cells.map((c, i) => {
          const on = running && i === cur.cellIdx
          return (
            <div key={i} style={{ padding: '5px 10px', borderRadius: 9, fontSize: 13, fontWeight: on ? 800 : 600, background: on ? INDIGO : '#fff', color: on ? '#fff' : '#6B7280', border: `1.5px solid ${on ? INDIGO : '#E5E7EB'}`, transition: 'all .12s' }}>
              {c.chord}{c.beats !== 4 ? <span style={{ fontSize: 10, opacity: .7 }}> ·{c.beats}</span> : ''}
            </div>
          )
        })}
      </div>

      {/* Hợp âm đang chơi + kế tiếp */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, background: '#fff', border: `2px solid ${INDIGO}`, borderRadius: 16, padding: '10px 8px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INDIGO }}>{curCell?.chord}</div>
          <MiniDiagram name={curCell?.chord ?? 'C'} />
          <div style={{ fontSize: 13, fontWeight: 800, height: 18, color: ORANGE }}>{running ? 'GẢY!' : ''}</div>
        </div>
        <div style={{ flex: 1, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: '10px 8px 8px', textAlign: 'center', opacity: .7 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#3A4050' }}>{nextChord}</div>
          <MiniDiagram name={nextChord ?? 'C'} dim />
          <div style={{ fontSize: 12, fontWeight: 700, height: 18, color: '#9CA3AF' }}>kế tiếp</div>
        </div>
      </div>

      {/* Phách của ô hiện tại */}
      <div style={{ background: '#fff', border: '1px solid #E8EAF0', borderRadius: 16, padding: 12, marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10 }}>
          {Array.from({ length: curCell?.beats ?? 4 }).map((_, i) => {
            const on = running && i === cur.beatInCell
            const strum = exercise.strumPerBeat || i === 0
            return (
              <div key={i} style={{ width: 40, height: 40, borderRadius: 11, border: `1.5px solid ${on ? INDIGO : '#D8DCE6'}`, background: on ? INDIGO : '#fff', color: on ? '#fff' : '#9AA0B0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
                {strum ? '↓' : '·'}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {([['Chậm', 50], ['Vừa', 65], ['Nhanh', 80]] as [string, number][]).map(([lbl, v]) => {
            const on = bpm === v
            return <button key={v} onClick={() => setBpm(v)} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `1.5px solid ${on ? INDIGO : '#D8DCE6'}`, background: on ? '#EEF2FF' : '#fff', color: on ? INDIGO : '#6B7280', fontWeight: on ? 800 : 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>{lbl}<div style={{ fontSize: 10, opacity: .75 }}>{v}</div></button>
          })}
        </div>
      </div>

      {/* Mic + tiến độ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF3EC', border: '1px solid #FBD9C5', borderRadius: 14, padding: '9px 12px', marginTop: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: active ? ORANGE : '#C3C8D2', display: 'inline-block' }} />
        <span style={{ fontSize: 12, color: '#9A4316', fontWeight: 600 }}>
          {active ? <>App đang nghe: <b style={{ color: heard === curCell?.chord ? '#16A34A' : '#9A4316' }}>{heard || '—'}</b></> : 'Mic tắt — bấm bắt đầu để app nghe & chấm'}
        </span>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#7A8194', marginBottom: 4 }}>
          <span>Vòng đổi sạch</span><span style={{ color: '#16A34A', fontWeight: 700 }}>{loopOk} / {loops}</span>
        </div>
        <div style={{ height: 8, background: '#E1E4EA', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (loopOk / loops) * 100)}%`, height: '100%', background: '#16A34A', borderRadius: 4, transition: 'width .3s' }} />
        </div>
      </div>

      {done ? (
        <button onClick={() => onPass?.()} style={{ width: '100%', marginTop: 12, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>✓ Xong bài tập này — tiếp tục →</button>
      ) : (
        <button onClick={toggle} style={{ width: '100%', marginTop: 12, background: running ? '#fff' : INDIGO, color: running ? INDIGO : '#fff', border: running ? `1.5px solid ${INDIGO}` : 'none', borderRadius: 14, padding: 13, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
          {running ? '⏸ Tạm dừng' : '▶ Bắt đầu (xin quyền mic)'}
        </button>
      )}
    </div>
  )
}
