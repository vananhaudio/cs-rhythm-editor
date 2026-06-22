// QuizBuilder — trình soạn quiz cho bài học loại "quiz".
// Sinh JSON đúng định dạng QuizViewer (QuizMeta) lưu vào cột content.
// Hỗ trợ form cho 4 dạng phổ biến + chế độ JSON nâng cao cho các dạng còn lại.
import { useMemo, useState } from 'react'

const C = {
  surface: '#FFFFFF', border: '#E4E4E7', bg: '#F7F7F8',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  accent: '#4F46E5', accentLight: '#EEF2FF', danger: '#DC2626',
}

// ─── Types khớp QuizViewer ──────────────────────────────────────────────────
type QType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'multi_select'
interface Question {
  id: string; type: string; skill: string; difficulty: number; points: number
  question: string; data: Record<string, unknown>; answer: Record<string, unknown>
  explanation?: string
}
interface QuizMeta {
  quiz_title: string; description?: string; mode?: 'practice' | 'exam'
  passing_score?: number; questions: Question[]
}

const TYPE_LABEL: Record<QType, string> = {
  multiple_choice: 'Trắc nghiệm (1 đáp án)',
  true_false: 'Đúng / Sai',
  fill_blank: 'Điền khuyết',
  multi_select: 'Chọn nhiều đáp án',
}
const FORM_TYPES: QType[] = ['multiple_choice', 'true_false', 'fill_blank', 'multi_select']

function emptyQuiz(): QuizMeta {
  return { quiz_title: '', description: '', mode: 'practice', passing_score: 70, questions: [] }
}

function newQuestion(type: QType, idx: number): Question {
  const base = { id: `q${idx + 1}`, skill: 'general', difficulty: 1, points: 1, question: '', explanation: '' }
  switch (type) {
    case 'multiple_choice': return { ...base, type, data: { options: ['', ''] }, answer: { correct: '' } }
    case 'true_false':      return { ...base, type, data: {}, answer: { correct: true } }
    case 'fill_blank':      return { ...base, type, data: { placeholder: '' }, answer: { correct: '', accepted_answers: [] } }
    case 'multi_select':    return { ...base, type, data: { options: ['', ''] }, answer: { correct: [] } }
  }
}

// ─── UI nhỏ ─────────────────────────────────────────────────────────────────
const Label = ({ children }: { children: React.ReactNode }) =>
  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text2, marginBottom: 5 }}>{children}</div>
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '7px 9px', border: `1px solid ${C.border}`,
  borderRadius: 7, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: C.text1, background: C.surface,
}

export default function QuizBuilder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Parse value → meta. Nếu không phải JSON quiz hợp lệ → quiz rỗng.
  const parsed = useMemo<{ meta: QuizMeta; bad: boolean }>(() => {
    const v = (value ?? '').trim()
    if (!v) return { meta: emptyQuiz(), bad: false }
    try {
      const o = JSON.parse(v)
      if (o && typeof o === 'object' && Array.isArray(o.questions)) return { meta: o as QuizMeta, bad: false }
      return { meta: emptyQuiz(), bad: true }
    } catch { return { meta: emptyQuiz(), bad: true } }
  }, [value])

  const meta = parsed.meta
  const [advanced, setAdvanced] = useState(false)

  const commit = (next: QuizMeta) => onChange(JSON.stringify(next, null, 2))
  const patchMeta = (p: Partial<QuizMeta>) => commit({ ...meta, ...p })
  const patchQ = (i: number, p: Partial<Question>) => {
    const qs = meta.questions.slice(); qs[i] = { ...qs[i], ...p }; commit({ ...meta, questions: qs })
  }
  const patchData = (i: number, p: Record<string, unknown>) =>
    patchQ(i, { data: { ...meta.questions[i].data, ...p } })
  const patchAns = (i: number, p: Record<string, unknown>) =>
    patchQ(i, { answer: { ...meta.questions[i].answer, ...p } })

  const addQ = (type: QType) =>
    commit({ ...meta, questions: [...meta.questions, newQuestion(type, meta.questions.length)] })
  const delQ = (i: number) =>
    commit({ ...meta, questions: meta.questions.filter((_, j) => j !== i) })
  const moveQ = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= meta.questions.length) return
    const qs = meta.questions.slice();[qs[i], qs[j]] = [qs[j], qs[i]]; commit({ ...meta, questions: qs })
  }

  // ─── Chế độ JSON nâng cao ───────────────────────────────────────────────
  if (advanced) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>⚙️ JSON nâng cao (mọi dạng câu)</div>
          <button onClick={() => setAdvanced(false)} style={{ ...inp, width: 'auto', cursor: 'pointer', fontWeight: 600 }}>← Về form</button>
        </div>
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={20} spellCheck={false}
          style={{ ...inp, fontFamily: 'ui-monospace, monospace', fontSize: 13, lineHeight: 1.5, resize: 'vertical' }} />
        {parsed.bad && <div style={{ fontSize: 12, color: C.danger }}>⚠ JSON chưa hợp lệ — kiểm tra lại dấu phẩy / ngoặc.</div>}
      </div>
    )
  }

  // ─── Form ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {parsed.bad && (
        <div style={{ fontSize: 12.5, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px' }}>
          ⚠ Nội dung cũ không phải quiz hợp lệ — bắt đầu soạn mới bên dưới (nội dung cũ sẽ bị thay khi thêm câu hỏi).
        </div>
      )}

      {/* Thông tin chung */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px', gap: 10 }}>
        <div>
          <Label>Tên bài kiểm tra</Label>
          <input style={inp} value={meta.quiz_title ?? ''} onChange={e => patchMeta({ quiz_title: e.target.value })} placeholder="VD: Kiểm tra Nhập môn" />
        </div>
        <div>
          <Label>Điểm đạt (%)</Label>
          <input style={inp} type="number" value={meta.passing_score ?? 70} onChange={e => patchMeta({ passing_score: Number(e.target.value) || 0 })} />
        </div>
        <div>
          <Label>Chế độ</Label>
          <select style={{ ...inp, cursor: 'pointer' }} value={meta.mode ?? 'practice'} onChange={e => patchMeta({ mode: e.target.value as 'practice' | 'exam' })}>
            <option value="practice">Luyện tập</option>
            <option value="exam">Thi (chấm điểm)</option>
          </select>
        </div>
      </div>

      {/* Danh sách câu hỏi */}
      {meta.questions.map((q, i) => {
        const isForm = FORM_TYPES.includes(q.type as QType)
        return (
          <div key={q.id ?? i} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, background: C.surface, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.accent, background: C.accentLight, borderRadius: 6, padding: '3px 9px' }}>Câu {i + 1}</span>
              <select style={{ ...inp, width: 'auto', cursor: 'pointer' }} value={q.type}
                onChange={e => {
                  const t = e.target.value as QType
                  const fresh = newQuestion(t, i)
                  patchQ(i, { type: t, data: fresh.data, answer: fresh.answer })
                }}>
                {FORM_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                {!isForm && <option value={q.type}>{q.type} (nâng cao)</option>}
              </select>
              <div style={{ flex: 1 }} />
              <button onClick={() => moveQ(i, -1)} disabled={i === 0} title="Lên" style={{ ...inp, width: 'auto', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.4 : 1, padding: '5px 9px' }}>↑</button>
              <button onClick={() => moveQ(i, 1)} disabled={i === meta.questions.length - 1} title="Xuống" style={{ ...inp, width: 'auto', cursor: 'pointer', opacity: i === meta.questions.length - 1 ? 0.4 : 1, padding: '5px 9px' }}>↓</button>
              <button onClick={() => delQ(i)} title="Xoá" style={{ ...inp, width: 'auto', cursor: 'pointer', color: C.danger, padding: '5px 9px' }}>🗑</button>
            </div>

            {!isForm ? (
              <div style={{ fontSize: 12.5, color: C.text3 }}>Dạng "{q.type}" — chỉnh ở chế độ JSON nâng cao.</div>
            ) : (
              <>
                <div>
                  <Label>Câu hỏi</Label>
                  <textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={q.question ?? ''} onChange={e => patchQ(i, { question: e.target.value })} placeholder="Nhập câu hỏi..." />
                </div>

                {/* Trắc nghiệm / Chọn nhiều */}
                {(q.type === 'multiple_choice' || q.type === 'multi_select') && (
                  <div>
                    <Label>{q.type === 'multi_select' ? 'Đáp án (tích các đáp án ĐÚNG)' : 'Đáp án (chọn 1 đáp án đúng)'}</Label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {((q.data.options as string[]) ?? []).map((opt, oi) => {
                        const correctArr = (q.answer.correct as string[]) ?? []
                        const isChecked = q.type === 'multi_select' ? correctArr.includes(opt) : q.answer.correct === opt
                        return (
                          <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type={q.type === 'multi_select' ? 'checkbox' : 'radio'} checked={isChecked}
                              onChange={() => {
                                if (q.type === 'multi_select') {
                                  const next = isChecked ? correctArr.filter(x => x !== opt) : [...correctArr, opt]
                                  patchAns(i, { correct: next })
                                } else {
                                  patchAns(i, { correct: opt })
                                }
                              }}
                              style={{ accentColor: C.accent, cursor: 'pointer', flexShrink: 0 }} />
                            <input style={inp} value={opt} placeholder={`Đáp án ${oi + 1}`}
                              onChange={e => {
                                const opts = ((q.data.options as string[]) ?? []).slice()
                                const old = opts[oi]; opts[oi] = e.target.value
                                // giữ trạng thái đúng khi đổi tên đáp án
                                const ans: Record<string, unknown> = {}
                                if (q.type === 'multi_select') ans.correct = correctArr.map(x => x === old ? e.target.value : x)
                                else if (q.answer.correct === old) ans.correct = e.target.value
                                patchQ(i, { data: { ...q.data, options: opts }, answer: { ...q.answer, ...ans } })
                              }} />
                            <button onClick={() => {
                                const opts = ((q.data.options as string[]) ?? []).filter((_, j) => j !== oi)
                                patchData(i, { options: opts })
                              }} style={{ ...inp, width: 'auto', cursor: 'pointer', color: C.danger, padding: '5px 9px' }}>✕</button>
                          </div>
                        )
                      })}
                      <button onClick={() => patchData(i, { options: [...((q.data.options as string[]) ?? []), ''] })}
                        style={{ ...inp, cursor: 'pointer', color: C.accent, fontWeight: 600, width: 'auto', alignSelf: 'flex-start' }}>+ Thêm đáp án</button>
                    </div>
                  </div>
                )}

                {/* Đúng / Sai */}
                {q.type === 'true_false' && (
                  <div>
                    <Label>Đáp án đúng</Label>
                    <select style={{ ...inp, cursor: 'pointer', maxWidth: 160 }} value={String(q.answer.correct)}
                      onChange={e => patchAns(i, { correct: e.target.value === 'true' })}>
                      <option value="true">✓ Đúng</option>
                      <option value="false">✗ Sai</option>
                    </select>
                  </div>
                )}

                {/* Điền khuyết */}
                {q.type === 'fill_blank' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <Label>Đáp án đúng</Label>
                      <input style={inp} value={(q.answer.correct as string) ?? ''} onChange={e => patchAns(i, { correct: e.target.value })} placeholder="VD: Mi" />
                    </div>
                    <div>
                      <Label>Đáp án chấp nhận thêm (mỗi dòng 1, tuỳ chọn)</Label>
                      <textarea style={{ ...inp, resize: 'vertical' }} rows={2}
                        value={((q.answer.accepted_answers as string[]) ?? []).join('\n')}
                        onChange={e => patchAns(i, { accepted_answers: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                        placeholder={'E\nmi\nE (Mi)'} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
                  <div>
                    <Label>Giải thích (tuỳ chọn)</Label>
                    <input style={inp} value={q.explanation ?? ''} onChange={e => patchQ(i, { explanation: e.target.value })} placeholder="Hiện sau khi trả lời" />
                  </div>
                  <div>
                    <Label>Điểm</Label>
                    <input style={inp} type="number" value={q.points ?? 1} onChange={e => patchQ(i, { points: Number(e.target.value) || 1 })} />
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })}

      {meta.questions.length === 0 && (
        <div style={{ fontSize: 13, color: C.text3, textAlign: 'center', padding: '12px 0' }}>Chưa có câu hỏi nào. Thêm câu hỏi bên dưới.</div>
      )}

      {/* Thêm câu hỏi + JSON nâng cao */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>+ Thêm câu:</span>
        {FORM_TYPES.map(t => (
          <button key={t} onClick={() => addQ(t)} style={{ ...inp, width: 'auto', cursor: 'pointer', fontWeight: 600, color: C.accent, borderColor: C.accent, background: C.accentLight }}>
            {TYPE_LABEL[t]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setAdvanced(true)} style={{ ...inp, width: 'auto', cursor: 'pointer', color: C.text2 }}>⚙️ JSON nâng cao</button>
      </div>
    </div>
  )
}
