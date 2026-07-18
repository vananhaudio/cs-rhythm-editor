import { useState, useEffect, useRef, useMemo } from 'react'
import { playGuitarNote } from './audioEngine'
import { STRING_COLORS, stringLabels, fretMarkers } from './guitarNotes'

// ── CHẠY HỢP ÂM RẢI (Arpeggio) — chỉ các NỐT HỢP ÂM (1·3·5·7) trên cần đàn ──
//    Giáo trình 4 nhóm: Thế mở (dây buông) → Thế di động (bấm chặn)
//      → Rải 2 quãng tám (cửa sổ rộng) → Hợp âm 7 (thêm bậc 7).

// ── Hằng số ─────────────────────────────────────────────────────────────────
const OPEN_FREQ = [82.41, 110, 146.83, 196, 246.94, 329.63]   // dây 6→1 (index 0 = dây 6)
const OPEN_MIDI = [40, 45, 50, 55, 59, 64]                    // cao độ (MIDI) dây buông — để phát hiện nốt đồng âm
const NM = ['Đô', 'Đô#', 'Rê', 'Rê#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si']
const OPC = [4, 9, 2, 7, 11, 4]   // pitch class dây buông, index 0 = dây 6 (Mi trầm)
const DEFAULT_FRETS = 5           // số phím hiển thị mặc định (2 quãng tám dùng nhiều hơn)

type Quality = 'major' | 'minor' | 'dom7' | 'maj7' | 'min7'

// Bậc trong hợp âm → nhãn (theo khoảng cách nửa cung tới chủ âm)
function degreeLabel(semi: number): string | null {
  switch (semi) {
    case 0:  return '1'    // chủ âm
    case 3:  return '3'    // bậc 3 thứ
    case 4:  return '3'    // bậc 3 trưởng
    case 7:  return '5'    // quãng 5
    case 10: return '7'    // bậc 7 thứ (♭7 — dom7/min7)
    case 11: return '7'    // bậc 7 trưởng (maj7)
    default: return null
  }
}
function chordSemis(q: Quality): number[] {
  switch (q) {
    case 'minor': return [0, 3, 7]
    case 'dom7':  return [0, 4, 7, 10]
    case 'maj7':  return [0, 4, 7, 11]
    case 'min7':  return [0, 3, 7, 10]
    default:      return [0, 4, 7]   // major
  }
}
const has7th = (q: Quality) => q === 'dom7' || q === 'maj7' || q === 'min7'

// ── Tính THẾ arpeggio trong cửa sổ [winStart .. winStart+fretCount-1] ─────────
interface ArpPos {
  winStart: number
  fretCount: number
  frets: number[][]                 // phím hợp âm trên từng dây (index 0 = dây 6)
  roots: { s: number; f: number }[] // vị trí chủ âm (cam)
}
function buildArpPos(rootPc: number, q: Quality, winStart: number, fretCount = DEFAULT_FRETS): ArpPos {
  const semis = new Set(chordSemis(q))
  const frets: number[][] = []
  const roots: { s: number; f: number }[] = []
  for (let s = 0; s < 6; s++) {
    const onStr: number[] = []
    for (let f = winStart; f < winStart + fretCount; f++) {
      const semi = (((OPC[s] + f) - rootPc) % 12 + 12) % 12
      if (semis.has(semi)) {
        onStr.push(f)
        if (semi === 0) roots.push({ s, f })
      }
    }
    frets.push(onStr)
  }
  return { winStart, fretCount, frets, roots }
}

// ── Bài luyện ─────────────────────────────────────────────────────────────────
type Group = 'open' | 'movable' | 'twooct' | 'seventh'
interface Lesson {
  id: string
  group: Group
  name: string
  subtitle: string
  rootPc: number
  quality: Quality
  winStart: number
  frets?: number       // cửa sổ phím (mặc định 5; 2 quãng tám = 7)
  unlockMin: number
}
const GROUP_LABEL: Record<Group, string> = {
  open: 'Thế mở · dây buông',
  movable: 'Thế di động · bấm chặn',
  twooct: 'Rải 2 quãng tám',
  seventh: 'Hợp âm 7 · nâng cao',
}
const LESSONS: Lesson[] = [
  // ── Nhóm 1 · Thế mở (dây buông) — NỀN TẢNG, ai mới học cũng chơi được ──
  { id: 'Em-open', group: 'open', name: 'Mi thứ (mở)',     subtitle: 'Em · dây buông · dễ nhất', rootPc: 4, quality: 'minor', winStart: 0, unlockMin: 0 },
  { id: 'Am-open', group: 'open', name: 'La thứ (mở)',     subtitle: 'Am · dây buông',           rootPc: 9, quality: 'minor', winStart: 0, unlockMin: 0 },
  { id: 'C-open',  group: 'open', name: 'Đô trưởng (mở)',  subtitle: 'C · dây buông',            rootPc: 0, quality: 'major', winStart: 0, unlockMin: 0 },
  { id: 'G-open',  group: 'open', name: 'Sol trưởng (mở)', subtitle: 'G · dây buông',            rootPc: 7, quality: 'major', winStart: 0, unlockMin: 0 },
  { id: 'D-open',  group: 'open', name: 'Rê trưởng (mở)',  subtitle: 'D · dây buông',            rootPc: 2, quality: 'major', winStart: 0, unlockMin: 0 },
  { id: 'E-open',  group: 'open', name: 'Mi trưởng (mở)',  subtitle: 'E · dây buông',            rootPc: 4, quality: 'major', winStart: 0, unlockMin: 20 },
  { id: 'A-open',  group: 'open', name: 'La trưởng (mở)',  subtitle: 'A · dây buông',            rootPc: 9, quality: 'major', winStart: 0, unlockMin: 20 },
  // ── Nhóm 2 · Thế di động (bấm chặn) ──
  { id: 'F-mov',   group: 'movable', name: 'Fa trưởng',   subtitle: 'F · dạng Mi · phím 1',  rootPc: 5,  quality: 'major', winStart: 1, unlockMin: 45 },
  { id: 'C-mov',   group: 'movable', name: 'Đô trưởng',   subtitle: 'C · thế I · phím 3',    rootPc: 0,  quality: 'major', winStart: 3, unlockMin: 45 },
  { id: 'Am-mov',  group: 'movable', name: 'La thứ',      subtitle: 'Am · thế I · phím 3',   rootPc: 9,  quality: 'minor', winStart: 3, unlockMin: 60 },
  { id: 'G-mov',   group: 'movable', name: 'Sol trưởng',  subtitle: 'G · thế II · phím 5',   rootPc: 7,  quality: 'major', winStart: 5, unlockMin: 90 },
  { id: 'Em-mov',  group: 'movable', name: 'Mi thứ',      subtitle: 'Em · thế II · phím 5',  rootPc: 4,  quality: 'minor', winStart: 5, unlockMin: 90 },
  { id: 'A-mov',   group: 'movable', name: 'La trưởng',   subtitle: 'A · dạng Sol · phím 5', rootPc: 9,  quality: 'major', winStart: 5, unlockMin: 120 },
  { id: 'Dm-mov',  group: 'movable', name: 'Rê thứ',      subtitle: 'Dm · phím 5',           rootPc: 2,  quality: 'minor', winStart: 5, unlockMin: 120 },
  { id: 'Bm-mov',  group: 'movable', name: 'Si thứ',      subtitle: 'Bm · dạng La · phím 2', rootPc: 11, quality: 'minor', winStart: 2, unlockMin: 150 },
  // ── Nhóm 3 · Rải 2 quãng tám (cửa sổ 7 phím) ──
  { id: 'C-2oct',  group: 'twooct', name: 'Đô trưởng · 2 quãng tám',  subtitle: 'C · phím 3–9',  rootPc: 0, quality: 'major', winStart: 3, frets: 7, unlockMin: 180 },
  { id: 'G-2oct',  group: 'twooct', name: 'Sol trưởng · 2 quãng tám', subtitle: 'G · phím 3–9',  rootPc: 7, quality: 'major', winStart: 3, frets: 7, unlockMin: 180 },
  { id: 'Am-2oct', group: 'twooct', name: 'La thứ · 2 quãng tám',     subtitle: 'Am · phím 5–11', rootPc: 9, quality: 'minor', winStart: 5, frets: 7, unlockMin: 210 },
  { id: 'Em-2oct', group: 'twooct', name: 'Mi thứ · 2 quãng tám',     subtitle: 'Em · phím 5–11', rootPc: 4, quality: 'minor', winStart: 5, frets: 7, unlockMin: 210 },
  // ── Nhóm 4 · Hợp âm 7 (nâng cao) ──
  { id: 'C7',    group: 'seventh', name: 'Đô 7 (C7)',      subtitle: 'C7 · thêm bậc ♭7',   rootPc: 0, quality: 'dom7', winStart: 3, unlockMin: 260 },
  { id: 'Cmaj7', group: 'seventh', name: 'Đô maj7',        subtitle: 'Cmaj7 · thêm bậc 7', rootPc: 0, quality: 'maj7', winStart: 3, unlockMin: 260 },
  { id: 'Am7',   group: 'seventh', name: 'La thứ 7 (Am7)', subtitle: 'Am7 · phím 5',       rootPc: 9, quality: 'min7', winStart: 5, unlockMin: 320 },
  { id: 'G7',    group: 'seventh', name: 'Sol 7 (G7)',     subtitle: 'G7 · phím 3',        rootPc: 7, quality: 'dom7', winStart: 3, unlockMin: 320 },
]

function noteName(stringIdx: number, fret: number): string {
  return NM[(OPC[stringIdx] + fret) % 12]
}

// ── Chuỗi bước: chạy LÊN rồi XUỐNG qua các nốt hợp âm ─────────────────────────
interface Step { s: number; f: number }
const pitchOf = (st: Step) => OPEN_MIDI[st.s] + st.f
function buildSteps(pos: ArpPos): Step[] {
  const up: Step[] = []
  for (let s = 0; s < 6; s++) {
    const fs = [...pos.frets[s]].sort((a, b) => a - b)
    for (const f of fs) up.push({ s, f })
  }
  if (!up.length) return []
  const down = [...up].reverse()
  const seq = [...up, ...down]
  // Bỏ nốt TRÙNG CAO ĐỘ liền kề (nốt đồng âm ở chỗ đổi dây → tránh kêu 2 lần) — kể cả mối nối vòng lặp
  const out: Step[] = []
  for (const st of seq) {
    if (out.length && pitchOf(out[out.length - 1]) === pitchOf(st)) continue
    out.push(st)
  }
  while (out.length > 1 && pitchOf(out[out.length - 1]) === pitchOf(out[0])) out.pop()
  return out
}

// ── Metronome click ──────────────────────────────────────────────────────────
let _clkCtx: AudioContext | null = null
function playClick(accent: boolean) {
  try {
    if (!_clkCtx) _clkCtx = new AudioContext()
    if (_clkCtx.state === 'suspended') _clkCtx.resume()
    const osc = _clkCtx.createOscillator()
    const g = _clkCtx.createGain()
    osc.connect(g); g.connect(_clkCtx.destination)
    osc.frequency.value = accent ? 1200 : 900
    const t = _clkCtx.currentTime
    g.gain.setValueAtTime(accent ? 0.28 : 0.12, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    osc.start(t); osc.stop(t + 0.05)
  } catch { /* ignore */ }
}

// ═══ Cần đàn ═══════════════════════════════════════════════════════════════════
//  · Thế di động: 5 ngăn (winStart..+4), không nut.
//  · Thế mở (winStart=0): dải NUT bên trái (dây buông đặt trên nut) + 4 ngăn 1·2·3·4.
//    → KHÔNG có "ngăn 0" giả để tránh hiểu nhầm là ngăn 1.
function ArpFretboard({ pos, rootPc, quality, activeStep }: {
  pos: ArpPos; rootPc: number; quality: Quality; activeStep: Step | null
}) {
  const BOARD_H = 180
  const STRING_CNT = 6
  const open = pos.winStart === 0
  const cells = open ? pos.fretCount - 1 : pos.fretCount   // số ngăn phím hiển thị
  const firstFret = open ? 1 : pos.winStart                // phím của ngăn đầu
  const NUT = open ? 13 : 0                   // % bề ngang dành cho dải nut (dây buông)
  const fretW = 100 - NUT
  const cellFrets = Array.from({ length: cells }, (_, i) => firstFret + i)

  const rowY = (row: number) => ((row + 0.5) / STRING_CNT) * 100
  const cellCenter = (idx: number) => NUT + ((idx + 0.5) / cells) * fretW
  const noteX = (fret: number) => (open && fret === 0) ? (NUT / 2) : cellCenter(fret - firstFret)
  const strW = (si: number) => 3.4 - si * (2.4 / 5)
  const rootSet = new Set(pos.roots.map(r => `${r.s}-${r.f}`))

  return (
    <div>
      <div style={{ display: 'flex', height: BOARD_H }}>
        {/* Nhãn dây trái */}
        <div style={{ width: 28, flexShrink: 0, position: 'relative' }}>
          {[0, 1, 2, 3, 4, 5].map(row => {
            const si = 5 - row
            return (
              <div key={row} style={{ position: 'absolute', right: 4, top: `${rowY(row)}%`, transform: 'translateY(-50%)', fontSize: 9, fontWeight: 700, color: STRING_COLORS[si], letterSpacing: '-.02em', userSelect: 'none' }}>
                {stringLabels[si]}
              </div>
            )
          })}
        </div>
        {/* Thân cần đàn */}
        <div style={{ flex: 1, position: 'relative', background: 'linear-gradient(180deg,#1e1008 0%,#20140F 55%,#1a0d06 100%)', border: '1.5px solid #3a2a1f', borderRadius: '0 8px 8px 0', overflow: 'hidden' }}>
          {/* Dải NUT (xương đàn) — chỉ ở thế mở; dây buông đặt trên đây */}
          {open && (
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${NUT}%`, background: 'linear-gradient(90deg,#f3e9cf,#e6d3ab 55%,#c9b183)', zIndex: 2, boxShadow: 'inset -3px 0 5px rgba(0,0,0,0.4)' }} />
          )}
          {/* Fret wires (ngăn cách các ngăn phím) */}
          {Array.from({ length: cells - 1 }, (_, k) => k + 1).map(i => (
            <div key={i} style={{ position: 'absolute', left: `${NUT + (i / cells) * fretW}%`, top: 0, bottom: 0, width: 2, background: 'linear-gradient(90deg,#777,#bbb,#777)', zIndex: 3, boxShadow: '0 0 3px rgba(0,0,0,0.5)' }} />
          ))}
          {/* Inlay dots */}
          {cellFrets.map((fret, idx) => {
            if (!fretMarkers.includes(fret)) return null
            return (
              <div key={fret} style={{ position: 'absolute', left: `${cellCenter(idx)}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.06)', zIndex: 1 }} />
            )
          })}
          {/* Dây đàn */}
          {[0, 1, 2, 3, 4, 5].map(row => {
            const si = 5 - row
            const thick = strW(si)
            return (
              <div key={row} style={{ position: 'absolute', left: 0, right: 0, top: `${rowY(row)}%`, height: thick, marginTop: -(thick / 2), background: `linear-gradient(90deg,${STRING_COLORS[si]}99,${STRING_COLORS[si]})`, zIndex: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.7)' }} />
            )
          })}
          {/* Nốt hợp âm */}
          {pos.frets.flatMap((fretsOnStr, si) =>
            fretsOnStr.map(fret => {
              const row = 5 - si
              const key = `${si}-${fret}`
              const isRoot = rootSet.has(key)
              const isActive = activeStep?.s === si && activeStep?.f === fret
              const isOpen = fret === 0
              const bg = isActive ? '#4338CA' : isRoot ? '#EA580C' : 'rgba(255,255,255,0.22)'
              const border = isActive ? '2px solid rgba(255,255,255,0.85)' : isOpen ? '2.5px solid #16A34A' : isRoot ? '2px solid rgba(255,255,255,0.55)' : '1.5px solid rgba(255,255,255,0.15)'
              const size = isActive ? 28 : isRoot ? 26 : 22
              const semi = (((OPC[si] + fret) - rootPc) % 12 + 12) % 12
              return (
                <div key={key} style={{ position: 'absolute', left: `${noteX(fret)}%`, top: `${rowY(row)}%`, width: size, height: size, marginLeft: -(size / 2), marginTop: -(size / 2), borderRadius: '50%', background: bg, border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', zIndex: isActive ? 12 : isRoot ? 8 : isOpen ? 7 : 5, boxShadow: isActive ? '0 0 14px rgba(67,56,202,0.9)' : isRoot ? '0 0 8px rgba(234,88,12,0.6)' : 'none', transition: 'background .07s', overflow: 'hidden' }}>
                  <span style={{ fontSize: isActive ? 8 : 9, lineHeight: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {isActive ? noteName(si, fret) : degreeLabel(semi)}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
      {/* Số phím dưới */}
      <div style={{ display: 'flex', marginLeft: 28, marginTop: 5 }}>
        {open && (
          <div style={{ flex: `0 0 ${NUT}%`, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#16A34A' }}>mở</div>
        )}
        {cellFrets.map((fret, i) => {
          const marked = fretMarkers.includes(fret)
          return (
            <div key={i} style={{ flex: `0 0 ${fretW / cells}%`, textAlign: 'center', fontSize: 11, fontWeight: marked ? 700 : 400, color: marked ? '#C99700' : '#9CA3AF' }}>{fret}</div>
          )
        })}
      </div>
    </div>
  )
}

// ═══ Main ════════════════════════════════════════════════════════════════════
interface Props { totalMinutes: number; onClose: () => void }

export default function ArpeggioExercise({ totalMinutes, onClose }: Props) {
  const P1 = '#4338CA', A1 = '#EA580C', BG = '#F0F2F5'

  const unlockedLessons = useMemo(() => LESSONS.filter(l => totalMinutes >= l.unlockMin), [totalMinutes])
  const availableLessons = unlockedLessons.length > 0 ? unlockedLessons : [LESSONS[0]]

  const [lessonIdx, setLessonIdx] = useState(0)
  const [bpm, setBpm] = useState(60)
  const [playing, setPlaying] = useState(false)
  const [activeStep, setActiveStep] = useState<Step | null>(null)
  const [beatDot, setBeatDot] = useState(0)
  const [stepCount, setStepCount] = useState(0)
  const [guitarOn, setGuitarOn] = useState(true)
  const [muted, setMuted] = useState(false)

  const curLesson = availableLessons[lessonIdx % availableLessons.length]
  const pos = useMemo(() => buildArpPos(curLesson.rootPc, curLesson.quality, curLesson.winStart, curLesson.frets), [curLesson])
  const steps = useMemo(() => buildSteps(pos), [pos])

  const playingRef = useRef(false)
  const stepIdxRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stepsRef = useRef(steps)
  const bpmRef = useRef(bpm)
  const guitarOnRef = useRef(true)
  const mutedRef = useRef(false)
  stepsRef.current = steps
  bpmRef.current = bpm
  guitarOnRef.current = guitarOn
  mutedRef.current = muted

  const playStep = () => {
    if (!stepsRef.current.length) return
    const si = stepIdxRef.current % stepsRef.current.length
    const step = stepsRef.current[si]
    if (!mutedRef.current) {
      if (guitarOnRef.current) {
        const freq = OPEN_FREQ[step.s] * Math.pow(2, step.f / 12)
        try { playGuitarNote(freq, step.s) } catch { /* ignore */ }
      }
      playClick(stepIdxRef.current % 4 === 0)
    }
    setActiveStep(step)
    setBeatDot(stepIdxRef.current % 4)
    setStepCount(c => c + 1)
    stepIdxRef.current++
  }

  const startScheduler = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    stepIdxRef.current = 0
    const ms = Math.round(60000 / bpmRef.current)
    playStep()
    intervalRef.current = setInterval(playStep, ms)
  }
  const stopScheduler = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setActiveStep(null); setBeatDot(0)
  }
  const togglePlay = () => {
    if (playing) { playingRef.current = false; stopScheduler(); setPlaying(false) }
    else { playingRef.current = true; startScheduler(); setPlaying(true) }
  }

  useEffect(() => {
    if (playingRef.current) { stopScheduler(); startScheduler() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonIdx, bpm])
  useEffect(() => () => { playingRef.current = false; stopScheduler() }, [])

  const activeNoteName = activeStep ? noteName(activeStep.s, activeStep.f) : null
  const nextLocked = LESSONS.find(l => totalMinutes < l.unlockMin)
  const progressPct = nextLocked ? Math.min(100, (totalMinutes / nextLocked.unlockMin) * 100) : 100

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#0A0A0F', display: 'flex', justifyContent: 'center', fontFamily: '"SF Pro Display","DM Sans",system-ui,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 480, height: '100%', background: BG, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.45)' }}>
      {/* Header */}
      <div style={{ background: P1, paddingTop: 'env(safe-area-inset-top,44px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={() => { playingRef.current = false; stopScheduler(); onClose() }}
            style={{ background: 'rgba(255,255,255,.18)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Đóng</button>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>🎸 Chạy hợp âm rải</span>
          <div style={{ width: 64 }} />
        </div>
        <div style={{ background: 'rgba(255,255,255,.14)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{curLesson.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>{curLesson.subtitle}</div>
          {nextLocked ? (
            <>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 6 }}>Còn {nextLocked.unlockMin - totalMinutes}′ để mở "{nextLocked.subtitle}"</div>
              <div style={{ marginTop: 6, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.2)' }}>
                <div style={{ height: '100%', borderRadius: 99, background: '#fff', width: `${progressPct}%`, transition: 'width .4s' }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 4 }}>✓ Đã mở tất cả bài</div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.09)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Nốt hiện tại</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: P1, minHeight: 32 }}>{activeNoteName ?? '—'}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: playing && beatDot === i ? A1 : '#E5E7EB', boxShadow: playing && beatDot === i ? `0 0 8px ${A1}88` : 'none', transition: 'background .07s' }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{playing && steps.length ? `Nốt ${(stepCount % steps.length) + 1}/${steps.length}` : '—'}</div>
            </div>
          </div>

          <ArpFretboard pos={pos} rootPc={curLesson.rootPc} quality={curLesson.quality} activeStep={activeStep} />

          <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            {[
              { color: A1, label: 'Chủ âm (1)' },
              { color: 'rgba(255,255,255,0.5)', bg: '#555', label: has7th(curLesson.quality) ? 'Nốt hợp âm (3·5·7)' : 'Nốt hợp âm (3·5)' },
              ...(curLesson.winStart === 0 ? [{ color: '#22C55E', label: 'Dây buông (○)' }] : []),
              { color: P1, label: 'Đang chơi' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color, border: `2px solid ${item.color}55`, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#6B7280' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chọn bài */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Chọn bài · {LESSONS.length} bài</div>
          {(['open', 'movable', 'twooct', 'seventh'] as Group[]).map(g => {
            const groupLessons = LESSONS.filter(l => l.group === g)
            if (!groupLessons.length) return null
            const groupOpen = groupLessons.some(l => totalMinutes >= l.unlockMin)
            return (
              <div key={g} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 2px 8px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: groupOpen ? P1 : '#9CA3AF' }}>{!groupOpen && '🔒 '}{GROUP_LABEL[g]}</div>
                  <div style={{ flex: 1, height: 1, background: '#EEF0F4' }} />
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{groupLessons.length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groupLessons.map((l) => {
                    const locked = totalMinutes < l.unlockMin
                    const isActive = !locked && availableLessons[lessonIdx % availableLessons.length]?.id === l.id
                    return (
                      <button key={l.id} disabled={locked}
                        onClick={() => {
                          if (!locked) { const idx = availableLessons.findIndex(al => al.id === l.id); if (idx >= 0) setLessonIdx(idx) }
                          else alert(`Cần luyện thêm ${l.unlockMin - totalMinutes} phút để mở bài này.`)
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isActive ? `${P1}14` : locked ? '#F9FAFB' : '#F3F4F6', border: `1.5px solid ${isActive ? P1 : 'transparent'}`, borderRadius: 12, padding: '10px 14px', cursor: locked ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: locked ? 0.55 : 1 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: isActive ? P1 : '#374151' }}>{locked ? '🔒 ' : ''}{l.name}</div>
                          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{l.subtitle}</div>
                        </div>
                        {locked ? <div style={{ fontSize: 12, color: '#9CA3AF', flexShrink: 0 }}>{l.unlockMin}′</div>
                          : isActive ? <div style={{ fontSize: 12, fontWeight: 700, color: P1, flexShrink: 0 }}>● Đang dùng</div> : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Controls */}
      <div style={{ background: '#fff', borderTop: '1px solid #E8EAF0', padding: '12px 16px', paddingBottom: 'max(20px, env(safe-area-inset-bottom,20px))', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <button onClick={togglePlay} style={{ width: '100%', border: 'none', borderRadius: 16, padding: '15px', fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', background: playing ? 'linear-gradient(135deg,#EF4444,#DC2626)' : `linear-gradient(135deg,${P1},#6366F1)`, color: '#fff', boxShadow: playing ? '0 4px 16px rgba(239,68,68,.35)' : `0 4px 16px ${P1}44` }}>
          {playing ? '⏸ Tạm dừng' : '▶ Bắt đầu'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#F3F4F6', borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
            <button onClick={() => setBpm(v => Math.max(40, v - 5))} style={{ padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 17, fontWeight: 700, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}>−</button>
            <div style={{ minWidth: 52, textAlign: 'center', fontSize: 14, fontWeight: 800, color: P1 }}>{bpm} BPM</div>
            <button onClick={() => setBpm(v => Math.min(160, v + 5))} style={{ padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 17, fontWeight: 700, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
          </div>
          <button onClick={() => setLessonIdx(i => (i + 1) % availableLessons.length)} style={{ flex: 1, background: '#EEF2FF', color: P1, border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Bài kế →</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setGuitarOn(v => !v)} style={{ flex: 1, border: 'none', borderRadius: 12, padding: '11px 6px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: guitarOn && !muted ? '#EEF2FF' : '#F3F4F6', color: guitarOn && !muted ? P1 : '#9CA3AF', opacity: muted ? 0.45 : 1, transition: 'background .15s, color .15s' }}>
            {guitarOn ? '🎸 Đàn' : '🔕 Đàn'}
          </button>
          <button onClick={() => setMuted(v => !v)} style={{ flex: 1, border: 'none', borderRadius: 12, padding: '11px 6px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: muted ? '#FEE2E2' : '#F3F4F6', color: muted ? '#DC2626' : '#9CA3AF', transition: 'background .15s, color .15s' }}>
            {muted ? '🔇 Đang tắt' : '🔊 Âm thanh'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
