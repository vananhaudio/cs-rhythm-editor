// Port từ Groove Lab components/RhythmStaff.tsx sang web (SVG thuần + requestAnimationFrame).
// Vẽ khuông nốt + beam + ↓↑; nốt/nhãn SÁNG dần theo phách đang chơi; con trượt bám tâm nốt.
// rAF chạy NỘI BỘ component (đọc getProgress mỗi frame) -> không re-render cả màn bài học.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Cell, LessonMode } from './lessons'
import { MODE_COLORS } from './lessons'

interface Props {
  cells: Cell[]
  mode: LessonMode
  showAccentMarks: boolean
  accentPattern: number[]
  getProgress: () => number   // 0..1 trong ô nhịp (đọc từ đồng hồ audio)
  playing: boolean
  scene?: string
}

const DOT = 11
const NOTE_DARK = '#2A2A2A'
const REST_DIM = '#C7C1B6'
const LABEL_DIM = '#9A958C'
const STRUM_DIM = '#B9B3A8'
const H = 64, Y_BASE = 50, Y_BEAM = 20

function buildGroups(cells: Cell[]): Cell[][] {
  const groups: Cell[][] = []
  let cur: Cell[] = []
  for (const c of cells) {
    if (c.downbeatNumber != null && cur.length) { groups.push(cur); cur = [] }
    cur.push(c)
  }
  if (cur.length) groups.push(cur)
  return groups
}

// blend 2 màu hex theo t (0..1)
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
function lerpColor(a: string, b: string, t: number): string {
  const ca = hex(a), cb = hex(b)
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t)
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t)
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t)
  return `rgb(${r},${g},${bl})`
}

export default function RhythmStaff({ cells, mode, showAccentMarks, accentPattern, getProgress, playing, scene }: Props) {
  const color = MODE_COLORS[mode]
  const n = cells.length
  const wrapRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(0)
  const [progress, setProgress] = useState(0)
  const groups = useMemo(() => buildGroups(cells), [cells])

  // đo bề rộng
  useEffect(() => {
    const measure = () => { if (wrapRef.current) setW(wrapRef.current.clientWidth) }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // rAF cập nhật progress khi đang chơi
  useEffect(() => {
    if (!playing) { setProgress(0); return }
    let raf = 0
    const tick = () => { setProgress(getProgress()); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, getProgress])

  const headRx = n > 12 ? 3.7 : 4.7
  const headRy = headRx * 0.8
  const colW = W > 0 ? W / n : 0
  const xc = (i: number) => (i + 0.5) * colW
  const stemX = (i: number) => xc(i) + headRx - 0.6

  const labelSz = n <= 4 ? 16 : n <= 8 ? 13 : n <= 12 ? 12 : 10
  const strumSz = n <= 8 ? 15 : n <= 12 ? 13 : 11

  const tb = groups.length || 1

  // glow 0..1 cho từng ô — nội suy từ progress theo cửa sổ thời gian của ô.
  const glowOf = (i: number): number => {
    const c = cells[i]
    const a = c.startBeat / tb
    const nextStart = i < cells.length - 1 ? cells[i + 1].startBeat : tb
    const b = nextStart / tb
    const p = progress
    if (p <= a || p >= b) return 0
    const eps = Math.min(0.06, Math.max(0.01, (b - a) / 4))
    if (p < a + eps) return (p - a) / eps
    if (p > b - eps) return (b - p) / eps
    return 1
  }
  const tint = (i: number, dim: string) => lerpColor(dim, color, glowOf(i))

  // con trượt: ánh xạ progress -> tâm nốt xc(i) (piecewise, bám đúng từng nốt)
  const dotX = useMemo(() => {
    const maxX = Math.max(1, W - DOT)
    if (W <= 0 || n === 0) return progress * maxX
    const pts: [number, number][] = []  // [timeFrac, x]
    cells.forEach((c, i) => {
      const t = c.startBeat / tb
      const prev = pts.length ? pts[pts.length - 1][0] : -1
      const ti = t <= prev ? prev + 1e-6 : t
      pts.push([ti, Math.min(maxX, Math.max(0, xc(i) - DOT / 2))])
    })
    pts.push([1, maxX])
    // tìm đoạn chứa progress
    let p = progress
    if (p <= pts[0][0]) return pts[0][1]
    for (let i = 0; i < pts.length - 1; i++) {
      const [t0, x0] = pts[i], [t1, x1] = pts[i + 1]
      if (p >= t0 && p <= t1) {
        const f = t1 === t0 ? 0 : (p - t0) / (t1 - t0)
        return x0 + (x1 - x0) * f
      }
    }
    return pts[pts.length - 1][1]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, groups, progress, W, n])

  return (
    <div ref={wrapRef} style={{ width: '100%', textAlign: 'center', padding: '2px 0' }}>
      {scene ? (
        <div style={{ display: 'inline-block', border: `1px solid ${color}35`, background: color + '18', borderRadius: 16, padding: '4px 12px', marginBottom: 10, fontSize: 13, fontWeight: 600, color }}>
          ♪  {scene}
        </div>
      ) : null}

      {/* beat labels */}
      <div style={{ display: 'flex', width: '100%' }}>
        {cells.map((c, i) => (
          <div key={c.index} style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: labelSz, color: tint(i, LABEL_DIM) }}>
            {c.beatLabel}
          </div>
        ))}
      </div>

      {/* notation */}
      {W > 0 ? (
        <svg width={W} height={H} style={{ display: 'block' }}>
          {groups.map((g, gi) => {
            const size = g.length
            const beamed = size >= 2
            const isSixteenth = size === 4
            const isTriplet = size === 3
            const realNotes = g.filter((c) => !c.isRest)
            const beamFrom = realNotes.length ? realNotes[0].index : g[0].index
            const beamTo = realNotes.length ? realNotes[realNotes.length - 1].index : g[g.length - 1].index
            return (
              <g key={gi}>
                {/* stems */}
                {g.map((c) => c.isRest ? null : (
                  <line key={'s' + c.index} x1={stemX(c.index)} y1={Y_BASE} x2={stemX(c.index)} y2={Y_BEAM}
                    stroke={tint(c.index, NOTE_DARK)} strokeWidth={1.7} />
                ))}
                {/* beams */}
                {beamed && realNotes.length >= 2 ? (
                  <line x1={stemX(beamFrom)} y1={Y_BEAM} x2={stemX(beamTo)} y2={Y_BEAM} stroke={NOTE_DARK} strokeWidth={3.6} strokeLinecap="butt" />
                ) : null}
                {isSixteenth && realNotes.length >= 2 ? (
                  <line x1={stemX(beamFrom)} y1={Y_BEAM + 5.5} x2={stemX(beamTo)} y2={Y_BEAM + 5.5} stroke={NOTE_DARK} strokeWidth={3.6} strokeLinecap="butt" />
                ) : null}
                {/* triplet number */}
                {isTriplet ? (
                  <text x={(stemX(beamFrom) + stemX(beamTo)) / 2} y={Y_BEAM - 6} fontSize={11} fontWeight="bold" fill={NOTE_DARK} textAnchor="middle">3</text>
                ) : null}
                {/* noteheads + rests */}
                {g.map((c) => {
                  if (c.isRest) {
                    return <text key={'r' + c.index} x={xc(c.index)} y={Y_BASE + 4} fontSize={15} fill={REST_DIM} textAnchor="middle">{'𝄽'}</text>
                  }
                  const gl = glowOf(c.index)
                  return (
                    <ellipse key={'h' + c.index} cx={xc(c.index)} cy={Y_BASE}
                      rx={headRx + gl * 0.8} ry={headRy + gl * 0.8} fill={tint(c.index, NOTE_DARK)} />
                  )
                })}
                {/* accent marks */}
                {showAccentMarks ? g.map((c) => {
                  const acc = c.downbeatNumber != null && accentPattern.includes(c.downbeatNumber)
                  if (!acc) return null
                  return <text key={'a' + c.index} x={xc(c.index)} y={9} fontSize={12} fontWeight="bold" fill={color} textAnchor="middle">{'>'}</text>
                }) : null}
              </g>
            )
          })}
        </svg>
      ) : <div style={{ height: H }} />}

      {/* strum arrows */}
      <div style={{ display: 'flex', width: '100%' }}>
        {cells.map((c, i) => (
          <div key={c.index} style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: strumSz, color: tint(i, STRUM_DIM) }}>
            {c.strumSymbol}
          </div>
        ))}
      </div>

      {/* playhead dot */}
      <div style={{ width: '100%', height: 14, marginTop: 8, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 6, height: 2, background: '#E0D9CE', borderRadius: 1 }} />
        <div style={{ position: 'absolute', left: 0, top: 1, width: DOT, height: DOT, borderRadius: 6, background: color, transform: `translateX(${dotX}px)`, opacity: playing ? 1 : 0 }} />
      </div>
    </div>
  )
}
