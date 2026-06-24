// ── Luyện QUẠT + NHỊP + ĐỔI HỢP ÂM theo khuông (giống tài liệu giấy) ──────────
// Sơ đồ hợp âm nhỏ, CỐ ĐỊNH ở trên (tham khảo). Phần chính = khuông nhịp: tên hợp âm
// + gạch chéo / (quạt) hoặc ◇ (nốt tròn) theo từng ô, có vạch nhịp + con trỏ chạy.
// Mic nhận hợp âm liên tục; đi hết chuỗi = 1 vòng.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveChord, MiniDiagram } from './ChordChangeTrainer'

const INDIGO = '#4338CA'
const ORANGE = '#EA580C'

export interface Cell { chord: string; beats: number; hold?: boolean } // hold = nốt tròn (1 gảy, giữ)
export interface Exercise { name: string; cells: Cell[]; strumPerBeat: boolean }

let clickCtx: AudioContext | null = null
function click(accent: boolean) {
  try {
    if (!clickCtx) clickCtx = new AudioContext()
    if (clickCtx.state === 'suspended') clickCtx.resume()
    const t = clickCtx.currentTime, o = clickCtx.createOscillator(), g = clickCtx.createGain()
    o.type = 'square'; o.frequency.value = accent ? 3200 : 2500
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(accent ? 0.18 : 0.1, t + 0.001)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    o.connect(g); g.connect(clickCtx.destination); o.start(t); o.stop(t + 0.06)
  } catch { /* bỏ qua */ }
}

interface Slot { cellIdx: number; beatInCell: number; chord: string; mark: 'down' | 'whole' | 'hold'; segStart: boolean; global: number }

export default function ChordSeqTrainer({ exercise, bpm: bpm0 = 60, loops = 2, onPass }: { exercise: Exercise; bpm?: number; loops?: number; onPass?: () => void }) {
  const { start, stop, active, currentRef } = useLiveChord()
  const [bpm, setBpm] = useState(bpm0)
  const [running, setRunning] = useState(false)
  const [pos, setPos] = useState(0)
  const [loopOk, setLoopOk] = useState(0)
  const [heard, setHeard] = useState('')
  const [hits, setHits] = useState<boolean[]>([])  // hợp âm nào đã gảy đúng trong vòng này (để hiện ✓)
  const posRef = useRef(0)
  const hitsRef = useRef<boolean[]>([])
  const loopRef = useRef(0)

  // Dòng thời gian theo phách
  const timeline = useMemo<Slot[]>(() => {
    const tl: Slot[] = []
    let g = 0
    exercise.cells.forEach((c, ci) => {
      const whole = c.hold || !exercise.strumPerBeat
      for (let b = 0; b < c.beats; b++) {
        tl.push({ cellIdx: ci, beatInCell: b, chord: c.chord, segStart: b === 0, global: g++,
          mark: whole ? (b === 0 ? 'whole' : 'hold') : 'down' })
      }
    })
    return tl
  }, [exercise])

  // Gom phách thành các ô nhịp (4 phách / ô), rồi 2 ô / hàng cho thẳng lưới
  const bars = useMemo<Slot[][]>(() => {
    const out: Slot[][] = []
    for (let i = 0; i < timeline.length; i += 4) out.push(timeline.slice(i, i + 4))
    return out
  }, [timeline])
  const rows = useMemo<Slot[][][]>(() => {
    const out: Slot[][][] = []
    for (let i = 0; i < bars.length; i += 2) out.push(bars.slice(i, i + 2))
    return out
  }, [bars])

  const distinct = useMemo(() => [...new Set(exercise.cells.map(c => c.chord))], [exercise])

  const cur = timeline[pos] ?? timeline[0]
  const curCell = exercise.cells[cur?.cellIdx ?? 0]
  const lastBeatOfCell = cur && cur.beatInCell === (curCell?.beats ?? 1) - 1
  const nextChord = timeline[(pos + 1) % timeline.length]?.chord
  const prepping = running && lastBeatOfCell && nextChord !== cur?.chord

  useEffect(() => {
    if (!running) return
    const beatMs = (60 / bpm) * 1000
    const id = setInterval(() => {
      let p = posRef.current + 1
      if (p >= timeline.length) {
        if (loopRef.current < loops) { loopRef.current += 1; setLoopOk(loopRef.current) }  // đếm MỌI vòng đã tập (không gate mic)
        hitsRef.current = exercise.cells.map(() => false)
        setHits([])
        p = 0
      }
      const s = timeline[p]
      click(p % 4 === 0)
      if (currentRef.current === s.chord) hitsRef.current[s.cellIdx] = true
      posRef.current = p; setPos(p); setHeard(currentRef.current); setHits([...hitsRef.current])
      if (loopRef.current >= loops) onPass?.()
    }, beatMs)
    return () => clearInterval(id)
  }, [running, bpm, timeline, exercise, loops, onPass, currentRef])

  const toggle = async () => {
    if (running) { setRunning(false); stop(); return }
    await start()
    posRef.current = timeline.length - 1; loopRef.current = 0; setLoopOk(0)
    hitsRef.current = exercise.cells.map(() => false); setHits([])
    setRunning(true)
  }

  const done = loopOk >= loops
  const markGlyph = (m: Slot['mark']) => m === 'down' ? '╱' : m === 'whole' ? '◇' : ''

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 360, margin: '0 auto' }}>
      <style>{`@keyframes csPrep{0%,100%{opacity:1}50%{opacity:.4}}.cs-prep{animation:csPrep .5s ease-in-out infinite}@keyframes csHit{0%{transform:scale(1)}35%{transform:scale(1.45)}100%{transform:scale(1.25)}}.cs-hit{animation:csHit .18s ease-out}`}</style>

      {/* Sơ đồ hợp âm — NHỎ, CỐ ĐỊNH (tham khảo) */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {distinct.map(c => (
          <div key={c} style={{ width: 44, textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#3A4050' }}>{c}</div>
            <MiniDiagram name={c} size={50} />
          </div>
        ))}
      </div>

      {/* Khuông nhịp — vạch nhịp là cột riêng (canh thẳng tuyệt đối); ╱ sáng+nảy mỗi phách, ◇ sáng cả ô */}
      <div style={{ background: '#fff', border: '1px solid #E8EAF0', borderRadius: 14, padding: '14px 8px' }}>
        {rows.map((row, ri) => {
          const isLastRow = ri === rows.length - 1
          const bar = (b: Slot[], bj: number) => (
            <div key={'b' + bj} style={{ flex: 1, padding: '0 6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', height: 16 }}>
                {b.map(s => {
                  const isNextSeg = prepping && s.global === (pos + 1) % timeline.length && s.segStart
                  const onSeg = running && cur?.cellIdx === s.cellIdx && s.segStart
                  const okCell = running && hits[s.cellIdx]
                  return <div key={s.global} className={isNextSeg ? 'cs-prep' : ''} style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', color: isNextSeg ? INDIGO : okCell ? '#16A34A' : onSeg ? ORANGE : s.segStart ? '#1F2430' : 'transparent' }}>{s.segStart ? <>{s.chord}{okCell ? '✓' : ''}</> : ''}</div>
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', marginTop: 6, height: 30, alignItems: 'center' }}>
                {b.map(s => {
                  const on = running && (s.mark === 'whole' ? cur?.cellIdx === s.cellIdx : s.global === pos)
                  return <div key={s.global} className={on && s.mark === 'down' ? 'cs-hit' : ''} style={{ textAlign: 'center', fontSize: s.mark === 'whole' ? 18 : 20, fontWeight: 700, color: on ? INDIGO : s.mark === 'hold' ? '#EAECF0' : '#B6BCC8', transform: on ? 'scale(1.25)' : 'none', transition: 'color .07s' }}>{markGlyph(s.mark)}</div>
                })}
              </div>
            </div>
          )
          const vline = (key: string, thick?: boolean) => <div key={key} style={{ width: thick ? 3 : 2, alignSelf: 'stretch', background: '#1F2430', borderRadius: 1 }} />
          const kids: ReactNode[] = [vline('l0')]
          row.forEach((b, bj) => { kids.push(bar(b, bj)); kids.push(vline('l' + bj, isLastRow && bj === row.length - 1)) })
          if (row.length === 1) kids.push(<div key="sp" style={{ flex: 1 }} />)
          return <div key={ri} style={{ display: 'flex', alignItems: 'stretch', marginBottom: isLastRow ? 0 : 12 }}>{kids}</div>
        })}
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#9AA0B0', marginTop: 6 }}>╱ = quạt xuống (1 phách) · ◇ = gảy 1 lần giữ cả ô</div>

      {/* BPM */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
        {([['Chậm', 50], ['Vừa', 65], ['Nhanh', 80]] as [string, number][]).map(([lbl, v]) => {
          const on = bpm === v
          return <button key={v} onClick={() => setBpm(v)} style={{ flex: 1, maxWidth: 110, padding: '8px 4px', borderRadius: 10, border: `1.5px solid ${on ? INDIGO : '#D8DCE6'}`, background: on ? '#EEF2FF' : '#fff', color: on ? INDIGO : '#6B7280', fontWeight: on ? 800 : 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>{lbl}<div style={{ fontSize: 10, opacity: .75 }}>{v}</div></button>
        })}
      </div>

      {/* Bảng phản hồi mic — hướng dẫn rõ + báo đúng/sai realtime */}
      {(() => {
        let bg = '#F1F2F6', bd = '#E5E7EB', col = '#374151', icon = '🎤'
        let msg: React.ReactNode = <>Bấm <b>Bắt đầu</b> → cho phép mic → <b>gảy theo khuông</b>. App nghe và báo đúng/sai ngay.</>
        if (running) {
          if (heard && heard === cur?.chord) { bg = '#DCFCE7'; bd = '#86EFAC'; col = '#15803D'; icon = '✓'; msg = <>Đúng rồi! App đang nghe <b>{heard}</b></> }
          else if (heard) { bg = '#FEF3C7'; bd = '#FCD34D'; col = '#92400E'; icon = '✗'; msg = <>Đang nghe <b>{heard}</b> — bạn cần gảy hợp âm <b>{cur?.chord}</b></> }
          else { bg = '#EEF2FF'; bd = '#C7CBF0'; col = '#4338CA'; icon = '🎤'; msg = <>Gảy hợp âm <b>{cur?.chord}</b> đi — app đang lắng nghe…</> }
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: bg, border: `1.5px solid ${bd}`, borderRadius: 12, padding: '9px 12px', marginTop: 10 }}>
            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: 13, color: col, fontWeight: 600, lineHeight: 1.4 }}>{msg}</span>
          </div>
        )
      })()}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#374151', marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>Số vòng đã tập</span><span style={{ color: '#16A34A', fontWeight: 700 }}>{loopOk} / {loops} vòng</span>
        </div>
        <div style={{ height: 8, background: '#E1E4EA', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (loopOk / loops) * 100)}%`, height: '100%', background: '#16A34A', borderRadius: 4, transition: 'width .3s' }} />
        </div>
        <div style={{ fontSize: 11, color: '#9AA0B0', marginTop: 4 }}>Cứ tập theo khuông; mỗi lần đi hết bài = 1 vòng. Đủ {loops} vòng là xong bài tập này.</div>
      </div>

      {done ? (
        <button onClick={() => onPass?.()} style={{ width: '100%', marginTop: 12, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>✓ Xong bài tập này — tiếp tục →</button>
      ) : (
        <button onClick={toggle} style={{ width: '100%', marginTop: 12, background: running ? '#fff' : INDIGO, color: running ? INDIGO : '#fff', border: running ? `1.5px solid ${INDIGO}` : 'none', borderRadius: 14, padding: 13, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
          {running ? '⏸ Tạm dừng' : '▶ Bắt đầu — cho phép micro để app chấm'}
        </button>
      )}
    </div>
  )
}
