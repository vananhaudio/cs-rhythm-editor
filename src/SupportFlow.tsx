// ── Gỡ rối & Đào sâu — flow hỗ trợ sau bài học (GĐ1: tầng 1·2·4) ──────────────
// Thang hỗ trợ tăng dần: tự nhận nhu cầu → coaching tự gỡ → ghi câu hỏi có ngữ cảnh cho thầy.
// Tầng 3 (Kho Tri Thức: tìm video thầy giảng) hiện để "sắp có".
import { useState } from 'react'
import { supabase } from './supabase'
import { STUCK_TYPES, DEEPEN_PROMPTS, DEEPEN_INTRO, stuckById, deepenById } from './elearn/supportContent'

const P = {
  bg: '#F6F2EA', card: '#FFFFFF', line: '#EAE4D8',
  ink: '#1C1A17', sub: '#6B655A', faint: '#8A8478',
  accent: '#3F6B4E', accentSoft: '#E3EDE6', accentDeep: '#2E5239',
  warn: '#C2622E',
}

interface Props {
  lessonId: string
  lessonTitle: string
  studentId?: string
  teacherUrl?: string        // link Nhắn thầy (Zalo cá nhân / Messenger)
  oaUrl?: string             // link Trợ lý thầy (Zalo OA — hỏi nhanh, có thể tự động trả lời)
  onClose: () => void
}

type Step = 'need' | 'pick' | 'coach' | 'form' | 'sent' | 'resolved'

export default function SupportFlow({ lessonId, lessonTitle, studentId, teacherUrl, oaUrl, onClose }: Props) {
  const [step, setStep] = useState<Step>('need')
  const [need, setNeed] = useState<'stuck' | 'deepen'>('stuck')
  const [choiceId, setChoiceId] = useState<string>('')
  const [tried, setTried] = useState('')
  const [question, setQuestion] = useState('')
  const [saving, setSaving] = useState(false)

  const stuck = stuckById(choiceId)
  const deepen = deepenById(choiceId)

  // Ghi log hỗ trợ (bỏ qua nếu preview / chưa đăng nhập)
  const logSupport = async (extra: Record<string, unknown>) => {
    if (!studentId) return
    try {
      await supabase.from('learning_support_log').insert({
        student_id: studentId, lesson_id: lessonId,
        need_type: need, stuck_type: need === 'stuck' ? choiceId : null,
        ...extra,
      })
    } catch { /* không chặn UX nếu log lỗi */ }
  }

  const goCoach = (id: string) => {
    setChoiceId(id)
    if (need === 'deepen') {
      setQuestion(deepenById(id)?.label ?? '')
    }
    setStep('coach')
  }

  const markResolved = async () => {
    await logSupport({ coaching_shown: stuck?.id ?? null, resolved: true })
    setStep('resolved')
  }

  const submitQuestion = async () => {
    setSaving(true)
    await logSupport({ resolved: false, question_for_teacher: question.trim(), tried: tried.trim() || null })
    setSaving(false)
    setStep('sent')
  }

  // ── Khung overlay ──────────────────────────────────────────────────────────
  const wrap = (children: React.ReactNode, sub?: string) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: P.bg, display: 'flex', flexDirection: 'column', fontFamily: '"DM Sans", system-ui, sans-serif', color: P.ink }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top,0px) + 12px) 16px 12px', borderBottom: `1px solid ${P.line}` }}>
        <button onClick={step === 'need' ? onClose : () => setStep('need')}
          style={{ width: 38, height: 38, flexShrink: 0, border: `1px solid ${P.line}`, background: '#fff', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: P.sub }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: P.accent, letterSpacing: '.04em' }}>GỠ RỐI & ĐÀO SÂU</div>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub ?? lessonTitle}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: P.faint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Đóng</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px calc(env(safe-area-inset-bottom,0px) + 24px)' }}>{children}</div>
    </div>
  )

  const bigBtn = (label: string, onClick: () => void, opts: { dark?: boolean; soft?: boolean; disabled?: boolean; sub?: string; keyId?: string } = {}) => (
    <button key={opts.keyId} onClick={opts.disabled ? undefined : onClick} disabled={opts.disabled}
      style={{ width: '100%', textAlign: 'left', padding: '15px 16px', borderRadius: 14, marginBottom: 10, cursor: opts.disabled ? 'default' : 'pointer', fontFamily: 'inherit',
        border: opts.dark ? 'none' : `1.5px solid ${opts.soft ? P.accent : P.line}`,
        background: opts.disabled ? '#F1ECE2' : opts.dark ? P.accent : opts.soft ? P.accentSoft : '#fff',
        color: opts.disabled ? '#A8A294' : opts.dark ? '#fff' : P.ink, opacity: opts.disabled ? 0.8 : 1 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{label}</div>
      {opts.sub && <div style={{ fontSize: 12, marginTop: 3, color: opts.dark ? 'rgba(255,255,255,.8)' : P.faint, fontWeight: 500 }}>{opts.sub}</div>}
    </button>
  )

  // ── B1: chọn nhu cầu ─────────────────────────────────────────────────────
  if (step === 'need') return wrap(
    <>
      <p style={{ fontSize: 14.5, color: P.sub, lineHeight: 1.6, margin: '0 0 18px' }}>
        Vấp là chuyện bình thường. Nếu bạn chưa hiểu, làm chưa được, hoặc muốn hiểu sâu hơn — mình cùng gỡ nhé.
      </p>
      {bigBtn('😣  Tôi đang gặp khó', () => { setNeed('stuck'); setStep('pick') }, { soft: true, sub: 'Chưa hiểu / tay chưa làm được / vào nhịp bị rối…' })}
      {bigBtn('🔍  Tôi muốn đào sâu', () => { setNeed('deepen'); setStep('pick') }, { sub: 'Hiểu vì sao học, liên hệ bài hát thật…' })}
    </>
  )

  // ── B2: chọn trạng thái cụ thể ───────────────────────────────────────────
  if (step === 'pick') return wrap(
    <>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{need === 'stuck' ? 'Bạn đang kẹt ở đâu?' : 'Bạn muốn hiểu thêm điều gì?'}</div>
      {(need === 'stuck' ? STUCK_TYPES : DEEPEN_PROMPTS).map(o => bigBtn(o.label, () => goCoach(o.id), { keyId: o.id }))}
    </>,
    need === 'stuck' ? 'Tôi đang gặp khó' : 'Tôi muốn đào sâu'
  )

  // ── B3: coaching ─────────────────────────────────────────────────────────
  if (step === 'coach') return wrap(
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '15px 16px', background: '#F1ECE2', borderRadius: 14, marginBottom: 18 }}>
        <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 99, background: 'linear-gradient(135deg,#2C2823,#5A5043)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F4E9D8', fontWeight: 700, fontSize: 12 }}>VA</div>
        <div style={{ fontSize: 14.5, color: '#3A352C', lineHeight: 1.6 }}>{need === 'stuck' ? (stuck?.coach ?? '') : DEEPEN_INTRO}</div>
      </div>
      {need === 'stuck' && bigBtn('✅  Tôi đã gỡ được rồi', markResolved, { soft: true, sub: 'Quay lại học tiếp' })}
      {bigBtn('🔎  Tìm bài thầy đã giảng về điều này', () => {}, { disabled: true, sub: 'Kho Tri Thức — sắp có' })}
      {oaUrl && bigBtn('🤖  Hỏi nhanh Trợ lý thầy', () => { logSupport({ coaching_shown: stuck?.id ?? null, resolved: false, question_for_teacher: '[mở Trợ lý OA]' }); window.open(oaUrl, '_blank') }, { sub: 'Trả lời ngay — Zalo OA' })}
      {bigBtn('✍️  Ghi câu hỏi để hỏi thầy', () => setStep('form'), { dark: true, sub: 'Lưu lại cho buổi Zoom hoặc nhắn riêng' })}
    </>,
    need === 'stuck' ? (stuck?.label ?? '') : (deepen?.label ?? '')
  )

  // ── B4: form ghi câu hỏi ─────────────────────────────────────────────────
  if (step === 'form') return wrap(
    <>
      <div style={{ fontSize: 13, color: P.faint, marginBottom: 4 }}>Bài đang học</div>
      <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 16 }}>{lessonTitle}</div>

      <Field label="Bạn đã thử cách nào? (tuỳ chọn)">
        <textarea value={tried} onChange={e => setTried(e.target.value)} rows={2}
          placeholder="VD: mình tập chậm lại, tách từng tay…"
          style={areaStyle} />
      </Field>
      <Field label="Câu hỏi gửi thầy Văn Anh">
        <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={4}
          placeholder="VD: Em hiểu cách làm nhưng tay phải cứ dừng khi đổi, em phải tập sao ạ?"
          style={areaStyle} />
      </Field>

      <button onClick={submitQuestion} disabled={saving || !question.trim()}
        style={{ width: '100%', padding: 15, border: 'none', borderRadius: 14, background: question.trim() ? P.accent : '#D8CFBE', color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: question.trim() ? 'pointer' : 'default', marginTop: 4 }}>
        {saving ? 'Đang lưu...' : 'Lưu câu hỏi & gửi thầy'}
      </button>
      <div style={{ fontSize: 12, color: P.faint, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
        Câu hỏi được lưu kèm tên bài để thầy trả lời đúng ngữ cảnh trong buổi Zoom tới.
      </div>
    </>,
    'Ghi câu hỏi cho thầy'
  )

  // ── B5: đã gửi ───────────────────────────────────────────────────────────
  if (step === 'sent') return wrap(
    <div style={{ textAlign: 'center', padding: '24px 8px' }}>
      <div style={{ fontSize: 46 }}>✍️</div>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 6 }}>Đã ghi câu hỏi!</div>
      <div style={{ fontSize: 14.5, color: P.sub, lineHeight: 1.6, margin: '8px 0 22px' }}>
        Thầy sẽ xem và trả lời trong buổi Zoom tới. Bạn cũng có thể nhắn thẳng cho thầy nếu cần gấp.
      </div>
      {oaUrl && (
        <a href={oaUrl} target="_blank" rel="noreferrer"
          style={{ display: 'block', textDecoration: 'none', width: '100%', boxSizing: 'border-box', padding: 15, borderRadius: 14, background: P.accent, color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
          🤖 Hỏi nhanh Trợ lý thầy (trả lời ngay)
        </a>
      )}
      {teacherUrl && (
        <a href={teacherUrl} target="_blank" rel="noreferrer"
          style={{ display: 'block', textDecoration: 'none', width: '100%', boxSizing: 'border-box', padding: 15, borderRadius: 14, background: oaUrl ? '#fff' : P.accent, color: oaUrl ? P.accentDeep : '#fff', border: oaUrl ? `1.5px solid ${P.accent}` : 'none', fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
          💬 Nhắn thầy Văn Anh
        </a>
      )}
      <button onClick={onClose} style={{ width: '100%', padding: 14, border: `1px solid ${P.line}`, borderRadius: 14, background: '#fff', color: P.sub, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Quay lại bài học</button>
    </div>
  )

  // ── B5': đã tự gỡ ────────────────────────────────────────────────────────
  return wrap(
    <div style={{ textAlign: 'center', padding: '24px 8px' }}>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 6 }}>Giỏi lắm!</div>
      <div style={{ fontSize: 14.5, color: P.sub, lineHeight: 1.6, margin: '8px 0 22px' }}>
        Tự gỡ được là bước tiến lớn — bạn đang học cách TỰ HỌC, không chỉ học đàn. Cứ thế nhé!
      </div>
      <button onClick={onClose} style={{ width: '100%', padding: 15, border: 'none', borderRadius: 14, background: P.accent, color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Quay lại học tiếp</button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.sub, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}
const areaStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: `1px solid ${P.line}`, borderRadius: 11, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.6, color: P.ink, background: '#fff' }
