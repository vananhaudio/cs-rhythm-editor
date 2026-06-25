// ── Luyện QUẠT + NHỊP + ĐỔI HỢP ÂM theo khuông (giống tài liệu giấy) ──────────
// Sơ đồ hợp âm nhỏ, CỐ ĐỊNH ở trên (tham khảo). Phần chính = khuông nhịp: tên hợp âm
// + gạch chéo / (quạt) hoặc ◇ (nốt tròn) theo từng ô, có vạch nhịp + con trỏ chạy.
// Mic nhận hợp âm liên tục; đi hết chuỗi = 1 vòng.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveChord, MiniDiagram } from './ChordChangeTrainer'

const INDIGO = '#4338CA'
const ORANGE = '#EA580C'

// hold = nốt tròn (1 gảy, giữ); oneHit = gảy phách 1 rồi nghỉ; rest = ô nghỉ (không gảy)
// eighths = quạt CHÙM 2 mỗi phách (xuống–lên ╱╲) + gõ thêm tiếng "và" giữa phách
export interface Cell { chord?: string; beats: number; hold?: boolean; oneHit?: boolean; rest?: boolean; eighths?: boolean }
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

interface Slot { cellIdx: number; beatInCell: number; chord: string; mark: 'down' | 'whole' | 'hold' | 'rest' | 'restWhole'; segStart: boolean; global: number; eighths?: boolean }

// Cặp nốt móc đơn NỐI CHÙM (rhythm slash beamed) — thân dài như nốt thật, kèm mũi tên ↓/↑.
// on = phách đang chơi → mũi tên sáng & đậm theo.
function EighthPair({ color, on }: { color: string; on?: boolean }) {
  const aOp = on ? 1 : 0.55
  return (
    <svg viewBox="0 0 44 58" style={{ height: 48, width: 'auto', overflow: 'visible', display: 'inline-block' }}>
      <rect x={13} y={4} width={20} height={4} rx={1} fill={color} />
      <line x1={14.5} y1={6} x2={14.5} y2={31} stroke={color} strokeWidth={3} />
      <line x1={5} y1={40} x2={15.5} y2={29} stroke={color} strokeWidth={4.6} strokeLinecap="round" />
      <line x1={32.5} y1={6} x2={32.5} y2={31} stroke={color} strokeWidth={3} />
      <line x1={23} y1={40} x2={33.5} y2={29} stroke={color} strokeWidth={4.6} strokeLinecap="round" />
      <text x={9.5} y={56} fontSize={on ? 14 : 11} textAnchor="middle" fill={on ? color : '#9AA0B0'} fontFamily="system-ui" opacity={aOp} fontWeight={on ? 800 : 500}>↓</text>
      <text x={28} y={56} fontSize={on ? 14 : 11} textAnchor="middle" fill={on ? color : '#9AA0B0'} fontFamily="system-ui" opacity={aOp} fontWeight={on ? 800 : 500}>↑</text>
    </svg>
  )
}

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
  const [count, setCount] = useState(0)   // đếm vào: 4→1 rồi mới chạy
  const primeRef = useRef(false)          // gảy phách 1 NGAY khi hết đếm (không trễ 1 nhịp)

  // Dòng thời gian theo phách
  const timeline = useMemo<Slot[]>(() => {
    const tl: Slot[] = []
    let g = 0
    exercise.cells.forEach((c, ci) => {
      const whole = c.hold || (!exercise.strumPerBeat && !c.oneHit)
      for (let b = 0; b < c.beats; b++) {
        let mark: Slot['mark']
        if (c.rest) mark = b === 0 ? 'restWhole' : 'hold'          // ô nghỉ cả ô
        else if (c.oneHit) mark = b === 0 ? 'down' : 'rest'        // gảy phách 1 rồi nghỉ
        else if (whole) mark = b === 0 ? 'whole' : 'hold'          // nốt tròn
        else mark = 'down'                                          // quạt mỗi phách
        tl.push({ cellIdx: ci, beatInCell: b, chord: c.rest ? '' : (c.chord ?? ''), segStart: b === 0 && !c.rest && !!c.chord, global: g++, mark, eighths: !!c.eighths && mark === 'down' })
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

  const distinct = useMemo(() => [...new Set(exercise.cells.filter(c => c.chord && !c.rest).map(c => c.chord as string))], [exercise])

  const cur = timeline[pos] ?? timeline[0]
  const curCell = exercise.cells[cur?.cellIdx ?? 0]
  const lastBeatOfCell = cur && cur.beatInCell === (curCell?.beats ?? 1) - 1
  // hợp âm KẾ (bỏ qua ô nghỉ)
  let nextChord = ''
  for (let i = 1; i <= timeline.length; i++) { const s = timeline[(pos + i) % timeline.length]; if (s?.chord) { nextChord = s.chord; break } }
  const isRest = !!curCell?.rest
  const prepping = running && (isRest || (lastBeatOfCell && nextChord !== cur?.chord)) && !!nextChord

  // ── ĐẾM VÀO (count-in) — 1 ô 4 phách: gõ tiếng + số 4→1, rồi mới vào phách 1 ──
  useEffect(() => {
    if (count <= 0) return
    const beatMs = (60 / bpm) * 1000
    click(true)
    const id = setTimeout(() => {
      if (count <= 1) { setCount(0); primeRef.current = true; setRunning(true) }
      else setCount(count - 1)
    }, beatMs)
    return () => clearTimeout(id)
  }, [count, bpm])

  useEffect(() => {
    if (!running) return
    const beatMs = (60 / bpm) * 1000
    const step = () => {
      let p = posRef.current + 1
      if (p >= timeline.length) {
        if (loopRef.current < loops) { loopRef.current += 1; setLoopOk(loopRef.current) }  // đếm MỌI vòng đã tập (không gate mic)
        hitsRef.current = exercise.cells.map(() => false)
        setHits([])
        p = 0
      }
      const s = timeline[p]
      click(p % 4 === 0)
      if (s.eighths) setTimeout(() => { if (posRef.current === p) click(false) }, beatMs / 2)  // tiếng "và" giữa phách cho chùm 2
      if (s.chord && currentRef.current === s.chord) hitsRef.current[s.cellIdx] = true
      posRef.current = p; setPos(p); setHeard(currentRef.current); setHits([...hitsRef.current])
      if (loopRef.current >= loops) onPass?.()
    }
    if (primeRef.current) { primeRef.current = false; step() }  // vào phách 1 ngay khi hết đếm
    const id = setInterval(step, beatMs)
    return () => clearInterval(id)
  }, [running, bpm, timeline, exercise, loops, onPass, currentRef])

  const toggle = async () => {
    if (running || count > 0) { setRunning(false); setCount(0); primeRef.current = false; stop(); return }
    await start()
    posRef.current = timeline.length - 1; loopRef.current = 0; setLoopOk(0)
    hitsRef.current = exercise.cells.map(() => false); setHits([])
    setCount(4)  // đếm vào 1 ô rồi mới chạy
  }

  const done = loopOk >= loops
  // Dấu lặng dùng font nhạc chuẩn Bravura (SMuFL): lặng đen U+E4E5, lặng tròn U+E4E3
  const markGlyph = (m: Slot['mark']) => m === 'down' ? '╱' : m === 'whole' ? '◇' : m === 'rest' ? '' : m === 'restWhole' ? '' : ''

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 360, margin: '0 auto' }}>
      <style>{`@keyframes csPrep{0%,100%{opacity:1}50%{opacity:.4}}.cs-prep{animation:csPrep .5s ease-in-out infinite}@keyframes csHit{0%{transform:scale(1)}35%{transform:scale(1.45)}100%{transform:scale(1.25)}}.cs-hit{animation:csHit .18s ease-out}`}</style>

      {/* Sơ đồ hợp âm — NHỎ, CỐ ĐỊNH (tham khảo) */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap', opacity: .85 }}>
        {distinct.map(c => (
          <div key={c} style={{ width: 34, textAlign: 'center' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#6B7280' }}>{c}</div>
            <MiniDiagram name={c} size={36} />
          </div>
        ))}
      </div>

      {/* Khuông nhịp — vạch nhịp là cột riêng (canh thẳng tuyệt đối); ╱ sáng+nảy mỗi phách, ◇ sáng cả ô */}
      <div style={{ position: 'relative', background: '#fff', border: '1.5px solid #E1E4EA', borderRadius: 16, padding: '16px 10px', boxShadow: '0 2px 10px rgba(17,24,39,.04)' }}>
        {count > 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.86)', borderRadius: 16, zIndex: 3 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', color: '#6B7280' }}>ĐẾM VÀO</div>
            <div style={{ fontSize: 68, fontWeight: 800, color: INDIGO, lineHeight: 1.05 }}>{count}</div>
            <div style={{ fontSize: 12.5, color: '#6B7280' }}>chuẩn bị… vào ở “1”</div>
          </div>
        )}
        {rows.map((row, ri) => {
          const isLastRow = ri === rows.length - 1
          const bar = (b: Slot[], bj: number) => (
            <div key={'b' + bj} style={{ flex: 1, padding: '0 6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', height: 24 }}>
                {b.map(s => {
                  const isNextSeg = prepping && s.global === (pos + 1) % timeline.length && s.segStart
                  const onSeg = running && cur?.cellIdx === s.cellIdx && s.segStart
                  const okCell = running && (hits[s.cellIdx] || (onSeg && heard === s.chord))
                  return <div key={s.global} className={isNextSeg ? 'cs-prep' : ''} style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap', color: isNextSeg ? INDIGO : okCell ? '#16A34A' : onSeg ? ORANGE : s.segStart ? '#1F2430' : 'transparent' }}>{s.segStart ? <>{s.chord}{okCell ? '✓' : ''}</> : ''}</div>
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', marginTop: 8, height: 54, alignItems: 'center' }}>
                {b.map(s => {
                  const restMark = s.mark === 'rest' || s.mark === 'restWhole'
                  const on = running && (s.mark === 'whole' || s.mark === 'restWhole' ? cur?.cellIdx === s.cellIdx : s.global === pos)
                  const color = restMark ? (on ? '#6B7280' : '#9AA0B0') : on ? INDIGO : s.mark === 'hold' ? '#EAECF0' : '#C0C6D2'
                  const glyph = s.mark === 'rest' ? '' : s.mark === 'restWhole' ? '' : markGlyph(s.mark)
                  const tf = s.mark === 'restWhole' ? 'translateY(11px)' : s.mark === 'rest' ? 'translateY(4px)' : on && s.mark === 'down' ? 'scale(1.3)' : 'none'
                  const pair = s.mark === 'down' && s.eighths
                  const tf2 = pair ? 'none' : tf
                  const content = pair
                    ? <EighthPair color={on ? INDIGO : '#C0C6D2'} on={on} />
                    : glyph
                  return <div key={s.global} className={on && s.mark === 'down' && !pair ? 'cs-hit' : ''} style={{ textAlign: 'center', fontFamily: restMark ? 'Bravura' : 'inherit', fontSize: restMark ? 30 : s.mark === 'down' ? 30 : 26, lineHeight: 1, fontWeight: 700, color, transform: tf2, transition: 'color .07s' }}>{content}</div>
                })}
              </div>
            </div>
          )
          const vline = (key: string, thick?: boolean) => <div key={key} style={{ width: thick ? 3 : 2, alignSelf: 'stretch', background: '#1F2430', borderRadius: 1 }} />
          const kids: ReactNode[] = [vline('lstart')]
          row.forEach((b, bj) => { kids.push(bar(b, bj)); kids.push(vline('l' + bj, isLastRow && bj === row.length - 1)) })
          if (row.length === 1) kids.push(<div key="sp" style={{ flex: 1 }} />)
          return <div key={ri} style={{ display: 'flex', alignItems: 'stretch', marginBottom: isLastRow ? 0 : 16 }}>{kids}</div>
        })}
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#9AA0B0', marginTop: 4 }}>╱ = quạt xuống · cặp nốt nối chùm = chùm 2 (↓ xuống · ↑ lên) · ◇ = giữ cả ô · <span style={{ fontFamily: 'Bravura', fontSize: 15, verticalAlign: '-2px' }}>{String.fromCodePoint(0xE4E5)}</span> = lặng</div>

      {/* BPM */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
        {([['Chậm', 50], ['Vừa', 65], ['Nhanh', 80]] as [string, number][]).map(([lbl, v]) => {
          const on = bpm === v
          return <button key={v} onClick={() => setBpm(v)} style={{ flex: 1, maxWidth: 110, padding: '6px 4px', borderRadius: 10, border: `1.5px solid ${on ? INDIGO : '#D8DCE6'}`, background: on ? '#EEF2FF' : '#fff', color: on ? INDIGO : '#6B7280', fontWeight: on ? 800 : 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>{lbl}<div style={{ fontSize: 10, opacity: .75 }}>{v}</div></button>
        })}
      </div>

      {/* Dòng mic TĨNH — không nhảy cửa sổ. Phản hồi đúng/sai nằm ngay trong khuông (tên hợp âm xanh ✓). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, color: '#6B7280', fontSize: 12.5, fontWeight: 500, lineHeight: 1.4, textAlign: 'center' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#16A34A' : '#C3C8D2', flexShrink: 0 }} />
        {running ? 'Đang nghe — gảy theo ô đang sáng; đúng thì tên hợp âm chuyển xanh ✓' : 'Bấm Bắt đầu rồi gảy theo ô sáng — app tự chấm (gảy đúng → tên hợp âm xanh ✓)'}
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#374151', marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>Số vòng đã tập (đủ {loops} là xong)</span><span style={{ color: '#16A34A', fontWeight: 700 }}>{loopOk} / {loops}</span>
        </div>
        <div style={{ height: 8, background: '#E1E4EA', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (loopOk / loops) * 100)}%`, height: '100%', background: '#16A34A', borderRadius: 4, transition: 'width .3s' }} />
        </div>
      </div>

      {done ? (
        <button onClick={() => onPass?.()} style={{ width: '100%', marginTop: 12, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>✓ Xong bài tập này — tiếp tục →</button>
      ) : (
        <button onClick={toggle} style={{ width: '100%', marginTop: 12, background: (running || count > 0) ? '#fff' : INDIGO, color: (running || count > 0) ? INDIGO : '#fff', border: (running || count > 0) ? `1.5px solid ${INDIGO}` : 'none', borderRadius: 14, padding: 13, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
          {count > 0 ? `⏸ Đếm vào… ${count}` : running ? '⏸ Tạm dừng' : '▶ Bắt đầu — cho phép micro để app chấm'}
        </button>
      )}
    </div>
  )
}
