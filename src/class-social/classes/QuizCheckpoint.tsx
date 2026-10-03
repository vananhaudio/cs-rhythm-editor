// BÀI TRẢ TRẮC NGHIỆM (Quiz Checkpoint V1) — phần TƯƠNG TÁC cắm qua CheckpointSlot trong Trang Buổi (/me).
// Câu hỏi do LessonDocument in sẵn; ở đây chỉ lựa chọn + Kiểm tra. SERVER chấm (lt_answer_checkpoint) theo đáp án riêng —
// client không biết đáp án, chỉ nhận ĐÚNG/SAI. Sai → "Chưa đúng — thử lại" + gợi ý, làm lại không giới hạn.
// Đúng → ✓ Đạt ngay (tải lại vẫn giữ: quiz_passed_at từ class_learning_state). Không Learning Thread / Feed / Hàng đợi Thầy.
import { useState } from 'react'
import { CircleCheck } from 'lucide-react'
import type { CheckpointQuiz } from '../../lesson/lessonTypes'

type Answer = (choices: string[]) => Promise<{ ok: true; value: { correct: boolean; passedAt: string | null } } | { ok: false; message: string }>

export default function QuizCheckpoint({ cpId, quiz, passedAt, onAnswer, onPassed }: {
  cpId: string
  quiz: CheckpointQuiz
  passedAt: string | null
  onAnswer: Answer
  /** đã ĐẠT → nạp lại trạng thái học (tiến độ buổi / mở buổi kế do server quyết) */
  onPassed: () => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<null | 'wrong' | 'right'>(null)
  const [error, setError] = useState<string | null>(null)
  const passed = !!passedAt || result === 'right'
  const name = `quiz-${cpId}`

  if (passed) {
    return (
      <div className="cs-quiz is-passed" role="status">
        <span className="lt-chip is-ok"><CircleCheck size={15} aria-hidden="true" /> Đạt</span>
        <span className="cs-quiz-note">Bạn đã trả lời đúng.</span>
      </div>
    )
  }

  const toggle = (id: string) => {
    setResult(null); setError(null)
    setPicked(cur => quiz.mode === 'single' ? [id] : cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])
  }
  const check = async () => {
    if (!picked.length || busy) return
    setBusy(true); setError(null)
    const r = await onAnswer(picked)
    setBusy(false)
    if (!r.ok) { setError(r.message); return }
    if (r.value.correct) { setResult('right'); onPassed() } else setResult('wrong')
  }
  const retry = () => { setPicked([]); setResult(null); setError(null) }

  return (
    <div className="cs-quiz">
      <fieldset className="cs-quiz-set" disabled={busy}>
        <legend className="cs-sr-only">{quiz.question}</legend>
        {quiz.mode === 'multiple' && <p className="cs-quiz-help">Chọn tất cả đáp án đúng.</p>}
        {quiz.options.map(o => (
          <label key={o.id} className={'cs-quiz-opt' + (picked.includes(o.id) ? ' is-picked' : '')}>
            <input type={quiz.mode === 'single' ? 'radio' : 'checkbox'} name={name} value={o.id}
              checked={picked.includes(o.id)} onChange={() => toggle(o.id)} />
            <span>{o.text}</span>
          </label>
        ))}
      </fieldset>
      {result === 'wrong' && (
        <div className="cs-quiz-wrong" role="alert">
          <p className="cs-quiz-wrong-h">Chưa đúng — thử lại.</p>
          {quiz.hint && <p className="cs-quiz-hint">{quiz.hint}</p>}
        </div>
      )}
      {error && <p className="cs-form-error" role="alert">{error}</p>}
      <div className="lt-actions">
        {result === 'wrong'
          ? <button type="button" className="lt-btn is-primary" onClick={retry}>Thử lại</button>
          : <button type="button" className="lt-btn is-primary" onClick={() => void check()} disabled={!picked.length || busy}>
              {busy ? 'Đang kiểm tra…' : 'Kiểm tra'}</button>}
      </div>
    </div>
  )
}
