import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuizMeta {
  quiz_title: string
  description?: string
  level?: string
  mode?: 'practice' | 'exam'
  estimated_time?: number
  passing_score?: number
  questions: Question[]
}

interface Question {
  id: string
  type: string
  skill: string
  difficulty: number
  points: number
  question: string
  data: Record<string, unknown>
  answer: Record<string, unknown>
  explanation?: string
}

interface QuizViewerProps {
  lessonId: string
  studentId: string
  quizData: QuizMeta
  onComplete?: (result: QuizResult) => void
}

interface QuizResult {
  lessonId: string
  studentId: string
  score: number
  totalPoints: number
  scorePercent: number
  passed: boolean
  answers: Record<string, unknown>
  skillStats: Record<string, { total: number; correct: number }>
  completedAt: string
}

// ─── Grading ─────────────────────────────────────────────────────────────────

function gradeQuestion(q: Question, ans: unknown): boolean {
  if (ans === null || ans === undefined) return false
  const a = q.answer
  switch (q.type) {
    case 'multiple_choice':
      return ans === a.correct
    case 'true_false':
      return ans === a.correct
    case 'fill_blank': {
      const accepted = ((a.accepted_answers as string[]) ?? [a.correct as string]).map(
        (x: string) => x.toLowerCase().trim()
      )
      return accepted.includes(String(ans).toLowerCase().trim())
    }
    case 'multi_select': {
      const correct = [...(a.correct as string[])].sort()
      const given = [...(ans as string[])].sort()
      return JSON.stringify(correct) === JSON.stringify(given)
    }
    case 'matching':
      return (a.pairs as [string, string][]).every(
        ([l, r]) => (ans as Record<string, string>)?.[l] === r
      )
    case 'ordering':
      return (
        JSON.stringify(ans) === JSON.stringify(a.correct_order)
      )
    case 'guitar_string_select':
      return ans === a.string_number
    case 'guitar_fret_select': {
      const correct = a.positions as { string_number: number; fret: number }[]
      const given = ans as { string_number: number; fret: number }[]
      if (!given || given.length !== correct.length) return false
      return correct.every((p) =>
        given.some((g) => g.string_number === p.string_number && g.fret === p.fret)
      )
    }
    default:
      return false
  }
}

// ─── Question Components ──────────────────────────────────────────────────────

function MultipleChoice({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Question
  value: unknown
  onChange: (v: string) => void
  disabled: boolean
}) {
  const opts = q.data.options as string[]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {opts.map((opt) => {
        const selected = value === opt
        const isCorrect = disabled && opt === q.answer.correct
        const isWrong = disabled && selected && opt !== q.answer.correct
        return (
          <button
            key={opt}
            disabled={disabled}
            onClick={() => onChange(opt)}
            style={{
              textAlign: 'left',
              padding: '10px 14px',
              border: `1px solid ${isCorrect ? '#27500A' : isWrong ? '#791F1F' : selected ? '#4338CA' : '#e5e7eb'}`,
              borderRadius: 8,
              background: isCorrect ? '#EAF3DE' : isWrong ? '#FCEBEB' : selected ? '#EEEDFE' : '#fff',
              color: isCorrect ? '#27500A' : isWrong ? '#791F1F' : selected ? '#3730a3' : '#111',
              cursor: disabled ? 'default' : 'pointer',
              fontSize: 14,
              fontWeight: selected ? 500 : 400,
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function TrueFalse({
  value,
  onChange,
  disabled,
  correctAnswer,
}: {
  value: unknown
  onChange: (v: boolean) => void
  disabled: boolean
  correctAnswer: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {[true, false].map((v) => {
        const label = v ? 'Đúng' : 'Sai'
        const selected = value === v
        const isCorrect = disabled && v === correctAnswer
        const isWrong = disabled && selected && v !== correctAnswer
        return (
          <button
            key={String(v)}
            disabled={disabled}
            onClick={() => onChange(v)}
            style={{
              padding: '10px 28px',
              border: `1px solid ${isCorrect ? '#27500A' : isWrong ? '#791F1F' : selected ? '#4338CA' : '#e5e7eb'}`,
              borderRadius: 8,
              background: isCorrect ? '#EAF3DE' : isWrong ? '#FCEBEB' : selected ? '#EEEDFE' : '#fff',
              color: isCorrect ? '#27500A' : isWrong ? '#791F1F' : selected ? '#3730a3' : '#111',
              cursor: disabled ? 'default' : 'pointer',
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function FillBlank({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Question
  value: unknown
  onChange: (v: string) => void
  disabled: boolean
}) {
  return (
    <input
      type="text"
      disabled={disabled}
      value={(value as string) ?? ''}
      placeholder={(q.data.placeholder as string) ?? 'Nhập đáp án'}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        fontSize: 14,
        width: '100%',
        maxWidth: 320,
        color: '#111',
        background: '#fff',
      }}
    />
  )
}

function MultiSelect({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Question
  value: unknown
  onChange: (v: string[]) => void
  disabled: boolean
}) {
  const opts = q.data.options as string[]
  const sel = (value as string[]) ?? []
  const correct = q.answer.correct as string[]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {opts.map((opt) => {
        const selected = sel.includes(opt)
        const isCorrect = disabled && correct.includes(opt)
        const isWrong = disabled && selected && !correct.includes(opt)
        return (
          <button
            key={opt}
            disabled={disabled}
            onClick={() => {
              onChange(selected ? sel.filter((x) => x !== opt) : [...sel, opt])
            }}
            style={{
              textAlign: 'left',
              padding: '10px 14px',
              border: `1px solid ${isCorrect ? '#27500A' : isWrong ? '#791F1F' : selected ? '#4338CA' : '#e5e7eb'}`,
              borderRadius: 8,
              background: isCorrect ? '#EAF3DE' : isWrong ? '#FCEBEB' : selected ? '#EEEDFE' : '#fff',
              color: isCorrect ? '#27500A' : isWrong ? '#791F1F' : selected ? '#3730a3' : '#111',
              cursor: disabled ? 'default' : 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>{selected ? '☑' : '☐'}</span>
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function Matching({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Question
  value: unknown
  onChange: (v: Record<string, string>) => void
  disabled: boolean
}) {
  const left = q.data.left_items as string[]
  const right = q.data.right_items as string[]
  const state = (value as Record<string, string>) ?? {}
  const pairs = q.answer.pairs as [string, string][]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {left.map((l) => {
        const correct = pairs.find(([pl]) => pl === l)?.[1]
        const chosen = state[l]
        const isWrong = disabled && chosen && chosen !== correct
        const isCorrect = disabled && chosen === correct
        return (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ minWidth: 64, fontSize: 13, color: '#374151' }}>{l}</span>
            <select
              disabled={disabled}
              value={chosen ?? ''}
              onChange={(e) => onChange({ ...state, [l]: e.target.value })}
              style={{
                flex: 1,
                padding: '6px 8px',
                border: `1px solid ${isCorrect ? '#27500A' : isWrong ? '#791F1F' : '#d1d5db'}`,
                borderRadius: 6,
                fontSize: 13,
                background: isCorrect ? '#EAF3DE' : isWrong ? '#FCEBEB' : '#fff',
                color: '#111',
              }}
            >
              <option value="">-- Chọn --</option>
              {right.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}

function Ordering({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Question
  value: unknown
  onChange: (v: string[]) => void
  disabled: boolean
}) {
  const items = (value as string[]) ?? [...(q.data.items as string[])]
  const correct = q.answer.correct_order as string[]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => {
        const isCorrect = disabled && correct[i] === item
        const isWrong = disabled && correct[i] !== item
        return (
          <div
            key={item}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              border: `1px solid ${isCorrect ? '#27500A' : isWrong ? '#791F1F' : '#e5e7eb'}`,
              borderRadius: 8,
              background: isCorrect ? '#EAF3DE' : isWrong ? '#FCEBEB' : '#fff',
              fontSize: 13,
            }}
          >
            <span style={{ color: '#9ca3af', minWidth: 20 }}>{i + 1}.</span>
            <span style={{ flex: 1, color: '#111' }}>{item}</span>
            {!disabled && (
              <>
                <button
                  onClick={() => {
                    if (i === 0) return
                    const next = [...items]
                    ;[next[i], next[i - 1]] = [next[i - 1], next[i]]
                    onChange(next)
                  }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', padding: '0 4px' }}
                >▲</button>
                <button
                  onClick={() => {
                    if (i === items.length - 1) return
                    const next = [...items]
                    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
                    onChange(next)
                  }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', padding: '0 4px' }}
                >▼</button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function GuitarStringSelect({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Question
  value: unknown
  onChange: (v: number) => void
  disabled: boolean
}) {
  const count = (q.data.string_count as number) ?? 6
  const labels = ['E cao', 'B', 'G', 'D', 'A', 'E trầm']
  const correctStr = q.answer.string_number as number
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', maxWidth: 300 }}>
      {Array.from({ length: count }, (_, i) => i + 1).map((s) => {
        const thick = s === 6 ? 3 : s === 5 ? 2.5 : s === 4 ? 2 : s === 3 ? 1.5 : s === 2 ? 1 : 0.5
        const selected = value === s
        const isCorrect = disabled && s === correctStr
        const isWrong = disabled && selected && s !== correctStr
        return (
          <div
            key={s}
            onClick={() => !disabled && onChange(s)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 8px',
              borderRadius: 8,
              cursor: disabled ? 'default' : 'pointer',
              border: `1px solid ${isCorrect ? '#27500A' : isWrong ? '#791F1F' : selected ? '#4338CA' : 'transparent'}`,
              background: isCorrect ? '#EAF3DE' : isWrong ? '#FCEBEB' : selected ? '#EEEDFE' : 'transparent',
              marginBottom: 4,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 44 }}>Dây {s}</span>
            <div style={{ flex: 1, height: thick, background: selected ? '#4338CA' : '#9ca3af', borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 40, textAlign: 'right' }}>{labels[s - 1]}</span>
          </div>
        )
      })}
    </div>
  )
}

function GuitarFretSelect({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Question
  value: unknown
  onChange: (v: { string_number: number; fret: number; note: string }[]) => void
  disabled: boolean
}) {
  const sc = (q.data.string_count as number) ?? 6
  const [fMin, fMax] = (q.data.fret_range as [number, number]) ?? [0, 12]
  const multi = (q.data.allow_multiple as boolean) ?? false
  const current = (value as { string_number: number; fret: number; note: string }[]) ?? []
  const correctPos = q.answer.positions as { string_number: number; fret: number }[]

  const NOTES = [
    ['E','F','F#','G','G#','A','A#','B','C','C#','D','D#'],
    ['B','C','C#','D','D#','E','F','F#','G','G#','A','A#'],
    ['G','G#','A','A#','B','C','C#','D','D#','E','F','F#'],
    ['D','D#','E','F','F#','G','G#','A','A#','B','C','C#'],
    ['A','A#','B','C','C#','D','D#','E','F','F#','G','G#'],
    ['E','F','F#','G','G#','A','A#','B','C','C#','D','D#'],
  ]

  const numFrets = fMax - fMin + 1

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `44px repeat(${numFrets}, 1fr)`, gap: 2, minWidth: numFrets * 36 + 50 }}>
        <div />
        {Array.from({ length: numFrets }, (_, i) => fMin + i).map((f) => (
          <div key={f} style={{ fontSize: 10, textAlign: 'center', color: '#9ca3af', paddingBottom: 2 }}>
            {f === 0 ? '○' : f}
          </div>
        ))}
        {Array.from({ length: sc }, (_, si) => si + 1).map((s) => (
          <>
            <div key={`l${s}`} style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>
              Dây {s}
            </div>
            {Array.from({ length: numFrets }, (_, i) => fMin + i).map((f) => {
              const note = NOTES[s - 1][f % 12]
              const sel = current.some((p) => p.string_number === s && p.fret === f)
              const isCorrect = disabled && correctPos.some((p) => p.string_number === s && p.fret === f)
              const isWrong = disabled && sel && !correctPos.some((p) => p.string_number === s && p.fret === f)
              return (
                <div
                  key={`${s}-${f}`}
                  onClick={() => {
                    if (disabled) return
                    const idx = current.findIndex((p) => p.string_number === s && p.fret === f)
                    if (idx >= 0) {
                      onChange(current.filter((_, i) => i !== idx))
                    } else {
                      onChange(multi ? [...current, { string_number: s, fret: f, note }] : [{ string_number: s, fret: f, note }])
                    }
                  }}
                  style={{
                    aspectRatio: '1.5',
                    border: `1px solid ${isCorrect ? '#27500A' : isWrong ? '#791F1F' : sel ? '#4338CA' : '#e5e7eb'}`,
                    borderRadius: 4,
                    background: isCorrect ? '#EAF3DE' : isWrong ? '#FCEBEB' : sel ? '#EEEDFE' : '#fff',
                    cursor: disabled ? 'default' : 'pointer',
                    fontSize: 10,
                    color: isCorrect ? '#27500A' : isWrong ? '#791F1F' : sel ? '#3730a3' : '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: sel ? 500 : 400,
                  }}
                >
                  {note}
                </div>
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QuizViewer({ lessonId, studentId, quizData, onComplete }: QuizViewerProps) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, unknown>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [prevResult, setPrevResult] = useState<QuizResult | null>(null)

  if (!quizData || !quizData.questions) return <div style={{padding:24,color:"#dc2626"}}>JSON quiz không hợp lệ hoặc chưa có dữ liệu.</div>
  const qs = quizData.questions
  const q = qs[current]
  const passingScore = quizData.passing_score ?? 70
  const isPractice = quizData.mode !== 'exam'

  // Check if student already completed this quiz
  useEffect(() => {
    async function checkPrev() {
      const { data } = await supabase
        .from('edu_quiz_results')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('student_id', studentId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()
      if (data) {
        setPrevResult(data as unknown as QuizResult)
        setAlreadyDone(true)
      }
    }
    checkPrev()
  }, [lessonId, studentId])

  function setAnswer(val: unknown) {
    setAnswers((prev) => ({ ...prev, [current]: val }))
  }

  function calculateResult(): QuizResult {
    let earned = 0
    let total = 0
    const skillStats: Record<string, { total: number; correct: number }> = {}
    const answersMap: Record<string, unknown> = {}

    qs.forEach((question, i) => {
      const ok = gradeQuestion(question, answers[i])
      if (ok) earned += question.points
      total += question.points
      answersMap[question.id] = answers[i]
      if (!skillStats[question.skill]) skillStats[question.skill] = { total: 0, correct: 0 }
      skillStats[question.skill].total++
      if (ok) skillStats[question.skill].correct++
    })

    const scorePercent = Math.round((earned / total) * 100)
    return {
      lessonId,
      studentId,
      score: earned,
      totalPoints: total,
      scorePercent,
      passed: scorePercent >= passingScore,
      answers: answersMap,
      skillStats,
      completedAt: new Date().toISOString(),
    }
  }

  async function handleSubmit() {
    setSaving(true)
    const result = calculateResult()

    await supabase.from('edu_quiz_results').insert({
      lesson_id: lessonId,
      student_id: studentId,
      score: result.score,
      total_points: result.totalPoints,
      score_percent: result.scorePercent,
      passed: result.passed,
      answers: result.answers,
      skill_stats: result.skillStats,
      completed_at: result.completedAt,
    })

    setSaving(false)
    setSubmitted(true)
    onComplete?.(result)
  }

  // ── Result screen ──
  if (submitted || alreadyDone) {
    const result = alreadyDone && prevResult ? prevResult : calculateResult()
    const skillLabels: Record<string, string> = {
      string_names: 'Tên dây', note_symbols: 'Ký hiệu nốt', fretboard: 'Cần đàn',
      chord_shapes: 'Hợp âm', rhythm: 'Nhịp', scale: 'Âm giai', ear_training: 'Luyện tai',
    }

    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 0' }}>
        {alreadyDone && !submitted && (
          <div style={{ background: '#EEEDFE', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#3730a3', marginBottom: 16 }}>
            Bạn đã làm bài này rồi. Đây là kết quả lần gần nhất.
          </div>
        )}

        {/* Score summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Điểm', value: `${result.score}/${result.totalPoints}` },
            { label: 'Tỉ lệ', value: `${result.scorePercent}%` },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 24, fontWeight: 500 }}>{value}</p>
            </div>
          ))}
        </div>

        <div style={{
          background: result.passed ? '#EAF3DE' : '#FCEBEB',
          borderRadius: 8, padding: '10px 16px', textAlign: 'center',
          color: result.passed ? '#27500A' : '#791F1F',
          fontWeight: 500, fontSize: 18, marginBottom: 20,
        }}>
          {result.passed ? '✓ Đạt' : '✗ Chưa đạt'} — cần {passingScore}%
        </div>

        {/* Skill stats */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Kỹ năng</p>
          {Object.entries(result.skillStats).map(([sk, { total, correct }]) => (
            <div key={sk} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
              <span>{skillLabels[sk] ?? sk}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 72, height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((correct / total) * 100)}%`, background: correct === total ? '#639922' : '#4338CA', borderRadius: 3 }} />
                </div>
                <span style={{ color: '#6b7280' }}>{correct}/{total}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Retry for practice mode */}
        {!alreadyDone && (
          <button
            onClick={() => { setSubmitted(false); setAnswers({}); setCurrent(0) }}
            style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 }}
          >
            Làm lại
          </button>
        )}
      </div>
    )
  }

  // ── Quiz screen ──
  const showExplanation = isPractice && answers[current] !== undefined

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
          <span>Câu {current + 1} / {qs.length}</span>
          <span>{q.points} điểm</span>
        </div>
        <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((current + 1) / qs.length) * 100}%`, background: '#4338CA', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Skill badge */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ background: '#EEEDFE', color: '#3C3489', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
          {q.skill}
        </span>
        <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 6, padding: '2px 8px', fontSize: 12, marginLeft: 6 }}>
          Độ khó {q.difficulty}
        </span>
      </div>

      {/* Question */}
      <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, lineHeight: 1.6 }}>{q.question}</p>

      {/* Question body */}
      {q.type === 'multiple_choice' && (
        <MultipleChoice q={q} value={answers[current]} onChange={setAnswer} disabled={isPractice && answers[current] !== undefined} />
      )}
      {q.type === 'true_false' && (
        <TrueFalse value={answers[current]} onChange={setAnswer} disabled={isPractice && answers[current] !== undefined} correctAnswer={q.answer.correct as boolean} />
      )}
      {q.type === 'fill_blank' && (
        <FillBlank q={q} value={answers[current]} onChange={setAnswer} disabled={false} />
      )}
      {q.type === 'multi_select' && (
        <MultiSelect q={q} value={answers[current]} onChange={setAnswer} disabled={false} />
      )}
      {q.type === 'matching' && (
        <Matching q={q} value={answers[current]} onChange={setAnswer} disabled={false} />
      )}
      {q.type === 'ordering' && (
        <Ordering
          q={q}
          value={answers[current] ?? [...(q.data.items as string[])]}
          onChange={setAnswer}
          disabled={false}
        />
      )}
      {q.type === 'guitar_string_select' && (
        <GuitarStringSelect q={q} value={answers[current]} onChange={setAnswer} disabled={false} />
      )}
      {q.type === 'guitar_fret_select' && (
        <GuitarFretSelect q={q} value={answers[current]} onChange={setAnswer} disabled={false} />
      )}

      {/* Explanation (practice mode) */}
      {showExplanation && q.explanation && (
        <div style={{ background: '#f8f9fa', borderLeft: '3px solid #4338CA', borderRadius: '0 8px 8px 0', padding: '10px 14px', fontSize: 13, color: '#374151', marginTop: 14 }}>
          {q.explanation}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, flexWrap: 'wrap', gap: 8 }}>
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: current === 0 ? 'not-allowed' : 'pointer', opacity: current === 0 ? 0.4 : 1, fontSize: 14 }}
        >
          ← Trước
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          {current < qs.length - 1 ? (
            <button
              onClick={() => setCurrent((c) => c + 1)}
              style={{ padding: '7px 16px', border: '1px solid #4338CA', borderRadius: 8, background: '#4338CA', color: '#fff', cursor: 'pointer', fontSize: 14 }}
            >
              Tiếp →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{ padding: '7px 16px', border: '1px solid #EA580C', borderRadius: 8, background: '#EA580C', color: '#fff', cursor: 'pointer', fontSize: 14 }}
            >
              {saving ? 'Đang lưu...' : 'Nộp bài'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
