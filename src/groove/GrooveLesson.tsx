// Port từ Groove Lab LessonScreen + LessonContext → 1 component web tự quản (inline styles).
// 3 tầng Nhịp Điệu → Sắc Thái → Câu Chuyện trên cùng tiết tấu; metronome + khuông nốt + lời thầy.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyzeBar, MODE_ORDER, MODE_COLORS, MODE_LABELS } from './lessons'
import type { Lesson, LessonMode } from './lessons'
import { MetronomeClock, type ClockCell } from './metronomeClock'
import RhythmStaff from './RhythmStaff'

const MIN_TEMPO = 40, MAX_TEMPO = 200

const MODE_MARK: Record<LessonMode, string> = { rhythm: '▮', expression: '〰', soul: '♥' }
const MODE_DESC: Record<LessonMode, string> = {
  rhythm: 'Nền tảng của mọi nhịp điệu',
  expression: 'Tạo sức sống cho tiết tấu',
  soul: 'Thổi hồn vào âm nhạc',
}
const HINT_PALETTE: Record<LessonMode, { bg: string; border: string; text: string }> = {
  rhythm:     { bg: '#F0FAF4', border: '#C3E8D0', text: '#2E7D52' },
  expression: { bg: '#FFF7F0', border: '#FFD9B5', text: '#E8760A' },
  soul:       { bg: '#F8F3FF', border: '#DDD0F5', text: '#7B4FA6' },
}

export default function GrooveLesson({ lesson, onBack }: { lesson: Lesson; onBack: () => void }) {
  const [mode, setMode] = useState<LessonMode>('rhythm')
  const [tempo, setTempoState] = useState(lesson.defaultTempo)
  const [isPlaying, setIsPlaying] = useState(false)

  const { cells } = useMemo(() => analyzeBar(lesson), [lesson])
  const accentPattern = lesson.tabs.expression.accentPattern ?? []
  const showAccentMarks = mode === 'expression'
  const color = MODE_COLORS[mode]
  const tab = lesson.tabs[mode]

  const clockCells: ClockCell[] = useMemo(
    () => cells.map((c) => ({ startBeat: c.startBeat, durationBeats: c.durationBeats, isRest: c.isRest, downbeatNumber: c.downbeatNumber })),
    [cells]
  )

  // live refs cho scheduler
  const cellsRef = useRef(clockCells); cellsRef.current = clockCells
  const tempoRef = useRef(tempo); tempoRef.current = tempo
  const accentsOnRef = useRef(mode !== 'rhythm'); accentsOnRef.current = mode !== 'rhythm'
  const accentPatternRef = useRef(accentPattern); accentPatternRef.current = accentPattern

  const clockRef = useRef<MetronomeClock | null>(null)
  if (!clockRef.current) {
    clockRef.current = new MetronomeClock({
      getTempo: () => tempoRef.current,
      getCells: () => cellsRef.current,
      getAccentsOn: () => accentsOnRef.current,
      getAccentPattern: () => accentPatternRef.current,
      onDownbeat: () => { try { navigator.vibrate?.(8) } catch { /* ignore */ } },
    })
  }

  const getProgress = useCallback(() => clockRef.current?.getProgress() ?? 0, [])

  const stop = useCallback(() => { clockRef.current?.stop(); setIsPlaying(false) }, [])
  const start = useCallback(() => {
    if (!cellsRef.current.length) return
    setIsPlaying(true); clockRef.current?.start()
  }, [])
  const togglePlay = () => (isPlaying ? stop() : start())

  const setTempo = (t: number) => setTempoState(Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, t)))

  // đổi tempo khi đang chạy -> restart clock
  const playingRef = useRef(isPlaying); playingRef.current = isPlaying
  useEffect(() => {
    if (playingRef.current) { clockRef.current?.stop(); clockRef.current?.start() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempo])

  // đổi tầng -> dừng
  useEffect(() => { stop() }, [mode, stop])
  // đổi bài -> reset tempo
  useEffect(() => { setTempoState(lesson.defaultTempo); setMode('rhythm'); stop() }, [lesson.id, lesson.defaultTempo, stop])
  // unmount -> dispose
  useEffect(() => () => { clockRef.current?.dispose() }, [])

  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={onBack} style={{ border: 'none', background: '#EDE7DA', borderRadius: 10, width: 34, height: 34, fontSize: 17, cursor: 'pointer', flexShrink: 0 }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A' }}>{lesson.shortTitle}</div>
      </div>

      {/* tier bar */}
      <div style={{ display: 'flex', background: '#FFF', borderRadius: 14, padding: 4, gap: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {MODE_ORDER.map((m) => {
          const active = m === mode
          const c = MODE_COLORS[m]
          return (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: active ? c + '15' : 'transparent', color: active ? c : '#A8A29A', fontWeight: 800, fontSize: 11, letterSpacing: 0.3 }}>
              <span style={{ fontSize: 12 }}>{MODE_MARK[m]}</span> {MODE_LABELS[m]}
            </button>
          )
        })}
      </div>

      {/* card */}
      <div style={{ background: '#FFF', borderRadius: 18, padding: 16, marginTop: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 19, fontWeight: 800, textAlign: 'center', letterSpacing: 1, color }}>{MODE_LABELS[mode]}</div>
        <div style={{ fontSize: 12, color: '#888', textAlign: 'center', marginTop: 2 }}>{MODE_DESC[mode]}</div>
        <div style={{ height: 1, background: '#F0EBE0', margin: '10px 0' }} />

        <RhythmStaff
          cells={cells}
          mode={mode}
          showAccentMarks={showAccentMarks}
          accentPattern={accentPattern}
          getProgress={getProgress}
          playing={isPlaying}
          scene={mode === 'soul' ? lesson.tabs.soul.theme : undefined}
        />

        <div style={{ height: 1, background: '#F0EBE0', margin: '10px 0' }} />

        {/* tempo + play */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <button onClick={() => setTempo(tempo - 5)} style={tempoBtn}>−</button>
          <div style={{ textAlign: 'center', minWidth: 70 }}>
            <div style={{ fontSize: 11, color: '#888' }}>Tempo</div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: '34px', color }}>{tempo}</div>
          </div>
          <button onClick={() => setTempo(tempo + 5)} style={tempoBtn}>+</button>
        </div>
        <button onClick={togglePlay}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', borderRadius: 12, padding: '13px 0', marginTop: 12, border: 'none', color: '#FFF', fontSize: 15, fontWeight: 800, letterSpacing: 1.2, cursor: 'pointer', fontFamily: 'inherit', background: color }}>
          {isPlaying ? '■ DỪNG' : '▶ BẮT ĐẦU'}
        </button>
      </div>

      {/* teacher hint */}
      <div style={{ borderRadius: 14, border: `1.5px solid ${HINT_PALETTE[mode].border}`, background: HINT_PALETTE[mode].bg, padding: 13, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <span style={{ fontSize: 14 }}>🎓</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: HINT_PALETTE[mode].text }}>Gợi ý của thầy</span>
        </div>
        <div style={{ fontSize: 13.5, color: '#444', lineHeight: 1.55 }}>{tab.teacherTip}</div>
      </div>
    </div>
  )
}

const tempoBtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 19, border: '1.5px solid #D0C9BE', background: '#FFF',
  fontSize: 20, fontWeight: 700, color: '#555', cursor: 'pointer', lineHeight: 1, fontFamily: 'inherit',
}
