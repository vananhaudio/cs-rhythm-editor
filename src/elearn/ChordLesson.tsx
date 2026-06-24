// ── BÀI HỌC HỢP ÂM (chung, config-driven) ─────────────────────────────────────
// Cấu trúc: Lý thuyết → Làm quen (mic) → các bài tập đổi nhịp (ChordSeqTrainer) → Quiz.
// Mỗi bài mới chỉ cần khai 1 object cfg (xem chordLessons.ts) — không code lại.
import { useState } from 'react'
import { ChordPractice } from './ChordPractice'
import { MiniDiagram } from './ChordChangeTrainer'
import ChordSeqTrainer, { type Exercise } from './ChordSeqTrainer'

const INDIGO = '#4338CA'
const ORANGE = '#EA580C'

export interface QA { q: string; opts: string[]; correct: number; explain: string }
export interface ChordLessonCfg {
  crumb: string
  title: string
  introTitle: string
  intro: string
  learn: string[]
  learnTips: string[]
  exercises: (Exercise & { short?: string; hint?: string })[]
  quiz: QA[]
  practice?: boolean   // true (mặc định) = có bước "Làm quen" mic; false = bỏ (hợp âm đã học)
}

function Btn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return <button onClick={onClick} style={{ width: '100%', padding: 14, borderRadius: 14, border: primary ? 'none' : `1.5px solid ${INDIGO}`, background: primary ? INDIGO : '#fff', color: primary ? '#fff' : INDIGO, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{children}</button>
}

export default function ChordLesson({ cfg, onClose, onComplete }: { cfg: ChordLessonCfg; onClose?: () => void; onComplete?: () => void }) {
  const practice = cfg.practice !== false
  const EX_START = practice ? 2 : 1
  const QUIZ = EX_START + cfg.exercises.length
  const DONE = QUIZ + 1
  const steps = ['Lý thuyết', ...(practice ? ['Làm quen'] : []), ...cfg.exercises.map((e, i) => e.short || `BT${i + 1}`), 'Quiz']

  const [step, setStep] = useState(0)
  const [qIdx, setQIdx] = useState(0)
  const [qSel, setQSel] = useState<number | null>(null)
  const [qScore, setQScore] = useState(0)
  const next = () => setStep(s => Math.min(s + 1, DONE))

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F0F2F5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 8px', background: '#fff', borderBottom: '1px solid #E8EAF0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: INDIGO, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: ORANGE, letterSpacing: '.06em', fontWeight: 700 }}>{cfg.crumb}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1F2430' }}>{cfg.title}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 2, background: i <= step ? INDIGO : '#D8DCE6' }} />
              <div style={{ fontSize: 8.5, marginTop: 3, color: i === step ? INDIGO : '#9AA0B0', fontWeight: i === step ? 700 : 500 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: 360, margin: '0 auto' }}>

          {step === 0 && (
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#1F2430', marginBottom: 4 }}>{cfg.introTitle}</div>
              <div style={{ fontSize: 14, color: '#5A6072', lineHeight: 1.6, marginBottom: 14 }}>{cfg.intro}</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {cfg.learn.map(c => (
                  <div key={c} style={{ flex: 1, background: '#fff', border: '1px solid #E1E4EA', borderRadius: 16, padding: '10px 8px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INDIGO }}>{c}</div>
                    <MiniDiagram name={c} />
                  </div>
                ))}
              </div>
              <ul style={{ fontSize: 13.5, color: '#5A6072', lineHeight: 1.7, paddingLeft: 18, margin: '0 0 16px' }}>
                {cfg.learnTips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
              <Btn primary onClick={next}>{practice ? 'Bắt đầu làm quen →' : 'Bắt đầu tập →'}</Btn>
            </div>
          )}

          {step === 1 && practice && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1F2430', marginBottom: 4 }}>Gảy thử — app nghe & chấm</div>
              <div style={{ fontSize: 13.5, color: '#5A6072', lineHeight: 1.6, marginBottom: 12 }}>Bấm hợp âm, gảy cho vang rồi để app xác nhận. Lần lượt {cfg.learn.join(' rồi ')}.</div>
              <ChordPractice cfg={{ chords: cfg.learn, mode: 'strum' }} onPass={next} />
              <div style={{ marginTop: 14 }}><Btn onClick={next}>Bỏ qua bước này →</Btn></div>
            </div>
          )}

          {step >= EX_START && step < QUIZ && (() => {
            const ex = cfg.exercises[step - EX_START]
            return (
              <div key={step}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1F2430', marginBottom: 4 }}>{ex.name}</div>
                {ex.hint && <div style={{ fontSize: 13.5, color: '#5A6072', lineHeight: 1.6, marginBottom: 12 }}>{ex.hint}</div>}
                <ChordSeqTrainer exercise={ex} bpm={ex.strumPerBeat ? 65 : 55} loops={2} onPass={next} />
                <div style={{ marginTop: 14 }}><Btn onClick={next}>{step === QUIZ - 1 ? 'Sang Quiz →' : 'Bài tập tiếp →'}</Btn></div>
              </div>
            )
          })()}

          {step === QUIZ && cfg.quiz.length > 0 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1F2430', marginBottom: 12 }}>Quiz · câu {qIdx + 1}/{cfg.quiz.length}</div>
              <div style={{ background: '#fff', border: '1px solid #E1E4EA', borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: '#1F2430', marginBottom: 12 }}>{cfg.quiz[qIdx].q}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cfg.quiz[qIdx].opts.map((o, i) => {
                    const chosen = qSel === i, reveal = qSel !== null, correct = i === cfg.quiz[qIdx].correct
                    const bg = reveal && correct ? '#DCFCE7' : reveal && chosen ? '#FEE2E2' : '#F7F8FA'
                    const bd = reveal && correct ? '#16A34A' : reveal && chosen ? '#DC2626' : '#E1E4EA'
                    return (
                      <button key={i} disabled={reveal} onClick={() => { setQSel(i); if (i === cfg.quiz[qIdx].correct) setQScore(s => s + 1) }}
                        style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${bd}`, background: bg, fontSize: 14.5, color: '#1F2430', fontFamily: 'inherit', cursor: reveal ? 'default' : 'pointer' }}>
                        {o}{reveal && correct ? '  ✓' : reveal && chosen ? '  ✕' : ''}
                      </button>
                    )
                  })}
                </div>
                {qSel !== null && <div style={{ marginTop: 12, fontSize: 13, color: '#5A6072', lineHeight: 1.6, background: '#F4F5F8', borderRadius: 10, padding: 10 }}>{cfg.quiz[qIdx].explain}</div>}
              </div>
              {qSel !== null && (
                <div style={{ marginTop: 14 }}>
                  <Btn primary onClick={() => { if (qIdx < cfg.quiz.length - 1) { setQIdx(qIdx + 1); setQSel(null) } else next() }}>
                    {qIdx < cfg.quiz.length - 1 ? 'Câu tiếp →' : 'Xem kết quả →'}
                  </Btn>
                </div>
              )}
            </div>
          )}

          {step === DONE && (
            <div style={{ textAlign: 'center', paddingTop: 24 }}>
              <div style={{ fontSize: 48 }}>🎉</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1F2430', marginTop: 8 }}>Hoàn thành bài!</div>
              <div style={{ fontSize: 14, color: '#5A6072', marginTop: 6, lineHeight: 1.6 }}>
                Bạn đã làm quen {cfg.learn.join(', ')} và tập {cfg.exercises.length} bài tập đổi hợp âm.
                {cfg.quiz.length > 0 && <><br />Quiz đúng <b style={{ color: '#16A34A' }}>{qScore}/{cfg.quiz.length}</b> câu.</>}
              </div>
              <div style={{ display: 'inline-block', marginTop: 14, background: '#FFF3EC', color: '#9A4316', fontWeight: 800, borderRadius: 20, padding: '6px 16px', fontSize: 14 }}>+15 XP</div>
              <div style={{ marginTop: 20 }}><Btn primary onClick={() => { onComplete?.(); onClose?.() }}>Về danh sách bài →</Btn></div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
