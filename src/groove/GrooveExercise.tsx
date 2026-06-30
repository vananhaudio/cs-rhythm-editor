// GrooveExercise — overlay fullscreen đưa Groove Lab vào LMS: 2 tab HỌC | TẬP.
//  HỌC: 30 bài tiết tấu (3 tầng Nhịp Điệu/Sắc Thái/Câu Chuyện + metronome + khuông nốt).
//  TẬP: "Nền tập quạt" (trống+bass + vòng hợp âm, quạt theo ô sáng).
import { useState } from 'react'
import { analyzeBar, getLevelGroups, APP_SLOGAN } from './lessons'
import type { Lesson } from './lessons'
import GrooveLesson from './GrooveLesson'
import GrooveBackingPad from './GrooveBackingPad'

const ACCENT = '#2E7D52'
const LEVEL_ACCENT = ['#2E7D52', '#E8760A', '#7B4FA6', '#2563EB', '#9A9A9A']

function LessonRow({ lesson, accent, onPress }: { lesson: Lesson; accent: string; onPress: () => void }) {
  const noteCount = analyzeBar(lesson).cells.filter((c) => !c.isRest).length
  const locked = lesson.isLocked
  return (
    <button onClick={locked ? undefined : onPress} disabled={locked}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 13px', width: '100%', textAlign: 'left',
        background: 'transparent', border: 'none', borderBottom: '1px solid #F4F0E8', cursor: locked ? 'default' : 'pointer',
        opacity: locked ? 0.55 : 1, fontFamily: 'inherit' }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: accent + '18', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{lesson.order}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: '#222' }}>{lesson.shortTitle}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: '#9A958C', marginTop: 1 }}>{lesson.title.replace(/^Bài \d+ - /, '')} · {noteCount} nốt</span>
      </span>
      <span style={{ color: '#C4BEB3', fontSize: 16, flexShrink: 0 }}>{locked ? '🔒' : '›'}</span>
    </button>
  )
}

export default function GrooveExercise({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'hoc' | 'tap'>('hoc')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const groups = getLevelGroups()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#F5F0E8', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ flexShrink: 0, padding: '12px 14px 8px', maxWidth: 520, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#1A1A1A' }}>Tiết tấu</div>
            <div style={{ fontSize: 11, color: '#8A8175', fontWeight: 600, letterSpacing: 0.3 }}>{APP_SLOGAN}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#EDE7DA', borderRadius: 18, width: 36, height: 36, fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        {/* tab Học | Tập */}
        <div style={{ display: 'flex', background: '#EAE3D6', borderRadius: 12, padding: 4, gap: 4, marginTop: 10 }}>
          {([['hoc', 'Học'], ['tap', 'Tập']] as const).map(([k, lbl]) => {
            const on = tab === k
            return (
              <button key={k} onClick={() => setTab(k)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                  background: on ? '#FFF' : 'transparent', color: on ? ACCENT : '#8A8175', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                {lbl}
              </button>
            )
          })}
        </div>
      </div>

      {/* content (scroll được — đây là công cụ) */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: 520, width: '100%', margin: '0 auto', padding: '8px 14px 28px' }}>
          {tab === 'hoc' ? (
            lesson ? (
              <GrooveLesson lesson={lesson} onBack={() => setLesson(null)} />
            ) : (
              groups.map((g) => {
                const accent = LEVEL_ACCENT[(g.level - 1) % LEVEL_ACCENT.length]
                return (
                  <div key={g.level} style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, paddingLeft: 2 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: accent }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#4A453D' }}>{g.levelName}</span>
                    </div>
                    <div style={{ background: '#FFF', borderRadius: 14, overflow: 'hidden' }}>
                      {g.lessons.map((l) => (
                        <LessonRow key={l.id} lesson={l} accent={accent} onPress={() => setLesson(l)} />
                      ))}
                    </div>
                  </div>
                )
              })
            )
          ) : (
            <GrooveBackingPad />
          )}
        </div>
      </div>
    </div>
  )
}
