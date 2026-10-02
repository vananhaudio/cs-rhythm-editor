// Form ứng tuyển DÙNG CHUNG cho mọi Band. Vị trí, câu hỏi, nhãn lý do, Rule đều lấy từ props (config của
// đợt tuyển trên server) — component KHÔNG biết Band nào. Band mới = dữ liệu mới, không sửa file này.
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  REASON_MAX, buildApplyPayload, emptyBandForm, firstErrorKey, newClientKey, validateBandForm,
  type BandFormErrors, type BandFormValues, type BandOption, type BandRecruitment, type BandRules,
} from './bandModel'
import type { ApplyOutcome, Result } from './bandApi'

export type SubmitFn = (recruitmentId: string, payload: Record<string, unknown>) => Promise<Result<ApplyOutcome>>

function Field({ id, label, error, hint, children }: { id: string; label: ReactNode; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="cs-band-field" id={`band-f-${id}`}>
      <div className="cs-band-label" id={`band-l-${id}`}>{label}</div>
      {children}
      {hint && !error && <div className="cs-band-hint">{hint}</div>}
      {error && <div className="cs-band-err" role="alert">{error}</div>}
    </div>
  )
}

/** Nhóm lựa chọn một đáp án — nút lớn dễ chạm trên điện thoại (radio thật bên trong để dùng bàn phím/đọc màn hình). */
function Choices({ name, labelledBy, options, value, onChange, invalid }: {
  name: string; labelledBy: string; options: BandOption[]; value: string; onChange: (v: string) => void; invalid: boolean
}) {
  return (
    <div className="cs-band-choices" role="radiogroup" aria-labelledby={labelledBy} aria-invalid={invalid || undefined}>
      {options.map(o => (
        <label key={o.value} className={'cs-band-choice' + (value === o.value ? ' is-on' : '')}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  )
}

export default function BandApplicationForm({ recruitment, rules, submit, onSubmitted, onRulesChanged, initialName = '' }: {
  recruitment: BandRecruitment
  rules: BandRules
  submit: SubmitFn
  onSubmitted: (o: ApplyOutcome) => void
  /** Rule trên server vừa đổi → trang tải lại dữ liệu (form giữ nội dung đã nhập) */
  onRulesChanged?: () => void
  initialName?: string
}) {
  const [v, setV] = useState<BandFormValues>(() => ({ ...emptyBandForm(), fullName: initialName }))
  const [errors, setErrors] = useState<BandFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Một khoá cho MỘT lần gửi (bấm đúp/mạng chập chờn không tạo 2 đơn); đổi nội dung → khoá mới
  const key = useRef<string>(newClientKey())
  const set = <K extends keyof BandFormValues>(k: K, val: BandFormValues[K]) => {
    setV(x => ({ ...x, [k]: val }))
    key.current = newClientKey()
    setErrors(e => {
      const errKey = k === 'rulesAccepted' ? 'rules' : k
      if (!e[errKey]) return e
      const { [errKey]: _drop, ...rest } = e
      void _drop
      return rest
    })
  }
  const setAnswer = (q: string, val: string) => {
    setV(x => ({ ...x, answers: { ...x.answers, [q]: val } }))
    key.current = newClientKey()
    setErrors(e => { if (!e[q]) return e; const { [q]: _d, ...rest } = e; void _d; return rest })
  }
  // Rule trên server đổi (tải lại sau rule_changed) → GIỮ nội dung đã nhập nhưng bắt đọc + tick lại Rule mới
  const [rulesId, setRulesId] = useState(rules.id)
  if (rulesId !== rules.id) {
    setRulesId(rules.id)
    setV(x => ({ ...x, rulesAccepted: false }))
    setErrors(x => ({ ...x, rules: 'Rule vừa được cập nhật — vui lòng đọc lại và xác nhận.' }))
  }
  const pos = recruitment.positions.find(p => p.key === v.positionKey)

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (busy) return
    setServerError(null)
    const e = validateBandForm(recruitment, v)
    setErrors(e)
    const first = firstErrorKey(recruitment, e)
    if (first) {
      document.getElementById(`band-f-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setBusy(true)
    const r = await submit(recruitment.id, buildApplyPayload(recruitment, rules, v, key.current))
    setBusy(false)
    if (r.ok) { onSubmitted(r.value); return }
    if (r.code === 'rule_changed') onRulesChanged?.()
    const fieldKey = r.code === 'full_name' ? 'fullName' : r.code === 'position_key' ? 'positionKey' : r.code === 'rules' || r.code === 'rule_changed' ? 'rules' : r.code
    if (fieldKey && (fieldKey === 'fullName' || fieldKey === 'phone' || fieldKey === 'positionKey' || fieldKey === 'reason' || fieldKey === 'rules'
      || recruitment.questions.some(q => q.key === fieldKey))) {
      setErrors(x => ({ ...x, [fieldKey]: r.message }))
      document.getElementById(`band-f-${fieldKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else setServerError(r.message)
  }

  return (
    <form className="cs-band-form" onSubmit={ev => void onSubmit(ev)} noValidate aria-label="Đơn ứng tuyển">
      <Field id="fullName" label={<label htmlFor="band-name">Họ và tên</label>} error={errors.fullName}>
        <input id="band-name" className="cs-input cs-band-input" autoComplete="name" value={v.fullName} maxLength={80}
          aria-invalid={!!errors.fullName || undefined} onChange={e => set('fullName', e.target.value)} />
      </Field>
      <Field id="phone" label={<label htmlFor="band-phone">Số điện thoại / Zalo</label>} error={errors.phone}
        hint="Thầy liên hệ bạn qua số này. Chỉ Thầy xem được.">
        <input id="band-phone" className="cs-input cs-band-input" type="tel" inputMode="tel" autoComplete="tel" value={v.phone} maxLength={20}
          placeholder="09xx xxx xxx" aria-invalid={!!errors.phone || undefined} onChange={e => set('phone', e.target.value)} />
      </Field>
      <Field id="positionKey" label="Vị trí muốn tham gia" error={errors.positionKey}>
        <Choices name="band-position" labelledBy="band-l-positionKey" invalid={!!errors.positionKey}
          options={recruitment.positions.map(p => ({ value: p.key, label: p.label }))} value={v.positionKey} onChange={k => set('positionKey', k)} />
        {pos?.other && (
          <input className="cs-input cs-band-input cs-band-other" aria-label="Vị trí khác (mô tả)" placeholder="Bạn chơi nhạc cụ gì?"
            value={v.positionOther} maxLength={80} onChange={e => set('positionOther', e.target.value)} />
        )}
      </Field>
      {recruitment.questions.map(q => (
        <Field key={q.key} id={q.key} label={q.label} error={errors[q.key]}>
          <Choices name={`band-q-${q.key}`} labelledBy={`band-l-${q.key}`} invalid={!!errors[q.key]}
            options={q.options} value={v.answers[q.key] ?? ''} onChange={val => setAnswer(q.key, val)} />
        </Field>
      ))}
      <div className="cs-band-field cs-band-rules" id="band-f-rules">
        <div className="cs-band-label">{rules.title}</div>
        <ol className="cs-band-rule-list">
          {rules.items.map((it, i) => <li key={i}>{it}</li>)}
        </ol>
        <label className={'cs-band-agree' + (v.rulesAccepted ? ' is-on' : '') + (errors.rules ? ' is-invalid' : '')}>
          <input type="checkbox" checked={v.rulesAccepted} onChange={e => set('rulesAccepted', e.target.checked)} />
          <span>{rules.agreeLabel}</span>
        </label>
        {errors.rules && <div className="cs-band-err" role="alert">{errors.rules}</div>}
      </div>
      <Field id="reason" label={<label htmlFor="band-reason">{recruitment.reasonLabel}</label>} error={errors.reason}
        hint={`${v.reason.trim().length}/${REASON_MAX}`}>
        <textarea id="band-reason" className="cs-input cs-band-input cs-band-textarea" rows={4} value={v.reason} maxLength={REASON_MAX}
          aria-invalid={!!errors.reason || undefined} onChange={e => set('reason', e.target.value)} />
      </Field>
      {/* bẫy bot: người thật không thấy, không tab tới */}
      <input className="cs-band-hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={v.website} onChange={e => set('website', e.target.value)} />
      {serverError && <p className="cs-form-error" role="alert">{serverError}</p>}
      <button type="submit" className="cs-btn cs-btn-primary cs-band-submit" disabled={busy || !v.rulesAccepted}
        title={!v.rulesAccepted ? 'Tick đồng ý Rule để gửi đơn' : undefined}>
        {busy ? 'Đang gửi…' : 'Gửi đơn ứng tuyển'}
      </button>
      {!v.rulesAccepted && <p className="cs-band-submit-note">Tick “{rules.agreeLabel}” để gửi đơn.</p>}
    </form>
  )
}
