/**
 * ClassOfferCompare — FLOW ĐĂNG KÝ MỚI /class (preview vòng 2/9/2026).
 *
 * THAY CHO form dài cũ. Nguyên tắc:
 *   TRƯỚC THANH TOÁN: chỉ hỏi thứ cần cho giao dịch (tên + email).
 *   SAU THANH TOÁN: mới hỏi thông tin học tập (vòng sau).
 *
 * Step 1 "choose" — MỘT BẢNG DUY NHẤT so sánh 3 hình thức:
 *   Quyền lợi | Gói Thực hành | Học theo lớp | Học cả hai
 *   - Hàng quyền lợi: nguồn duy nhất src/classOffer.ts (buildCompareRows) — KHÔNG
 *     viết array chữ thứ hai trong component.
 *   - Cột Practice: chọn thời hạn 1/6 tháng ngay trong cột (giá từ app_config).
 *   - Cột Class: chọn lớp THẬT (class_schedule qua props classOptions) — chưa chọn
 *     thì hiện nút "Chọn lớp" + link xem lịch đầy đủ.
 *   - Cột Both: tổng hợp class + practice + TỔNG THANH TOÁN (không paragraph dài).
 *   - Mỗi cột có radio chọn hình thức; cột selected nổi màu CAM/TÍM/gradient.
 *   - Thanh xác nhận: "Bạn đang chọn: … · Tổng: …" + [Xác nhận lựa chọn].
 *
 * Step 2 "profile" — sau xác nhận: cực ngắn, chỉ Họ và tên + Email + tổng tiền +
 *   "← Thay đổi lựa chọn" (giữ nguyên lựa chọn). Không hỏi lại gói/lớp/thời hạn/
 *   hướng học/trình độ (các capability đó thu sau thanh toán — KHÔNG xoá khỏi hệ thống).
 *
 * Responsive: >=720px bảng thật 4 cột; <720px tab 3 hình thức + panel xếp dọc
 * (cùng dữ liệu so sánh, chỉ khác presentation). Mobile 390 đọc được hết.
 *
 * Preview: onSubmit KHÔNG ghi lead production khi chạy dev (mock mapping + log),
 * chỉ chuyển bước thanh toán để xem UI. Bản production build sẽ insert thật.
 */
import { useMemo, useRef, useState } from 'react'
import {
  buildCompareRows,
  OFFER_META,
  type OfferMode,
  type OfferQty,
  type PracticeDuration,
} from '../classOffer'
import { checkEmail } from '../logic/emailCheck'

export interface ClassOption {
  key: string            // regName: "Tên lớp · MÃ" — khớp giá trị leads.class_name
  title: string          // tên khoá chính (courseTitle)
  tag?: string
  schedule?: string      // lịch thật
  date?: string          // ngày khai giảng / trạng thái
  priceLabel: string | null
  feeKind: 'free' | 'combo' | 'standard'
  active?: boolean       // lớp đang học (không phải sắp khai giảng)
}

export interface PracticePlans {
  '1_month': { vnd: number | null; line: string | null }
  '6_month': { vnd: number | null; line: string | null }
}

export interface RegistrationPayload {
  mode: OfferMode
  duration: PracticeDuration
  className: string       // '' nếu mode practice
  classTitle: string | null
  name: string
  email: string
}

interface Props {
  qty: OfferQty
  classFeeVnd: number | null
  classFeeLabel: string | null
  plans: PracticePlans
  sixMonthlyLine: string | null   // "tương đương 396.000đ/tháng"
  classOptions: ClassOption[]
  preselect: { mode: OfferMode | null; className: string; at: number }
  me: boolean                      // đã đăng nhập (chỉ để hiện link "Đã là học viên? Đăng nhập")
  onLogin?: () => void
  onBrowseClasses: () => void      // "Xem lịch lớp đầy đủ" → tab lớp (LearningWays)
  onSubmit: (p: RegistrationPayload) => void
}

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

const DUR_LABEL: Record<PracticeDuration, string> = { '1_month': '1 tháng', '6_month': '6 tháng' }
// key cột của CompareRow (practice/cls/both) theo OfferMode (practice/class/both)
const ROW_KEY: Record<OfferMode, 'practice' | 'cls' | 'both'> = { practice: 'practice', class: 'cls', both: 'both' }

export default function ClassOfferCompare({
  qty, classFeeVnd, classFeeLabel, plans, sixMonthlyLine, classOptions,
  preselect, me, onLogin, onBrowseClasses, onSubmit,
}: Props) {
  // Step 1 'choose' | Step 2 'profile'. Parent render <ClassOfferCompare key={preselect.at}>
  // → mỗi lần CTA ngoài mở flow, component REMOUNT với preselect mới (không cần effect sync).
  const [step, setStep] = useState<'choose' | 'profile'>('choose')
  const [mode, setMode] = useState<OfferMode | null>(preselect.mode)
  const [duration, setDuration] = useState<PracticeDuration>('1_month')
  const [classKey, setClassKey] = useState(preselect.className || '')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => buildCompareRows(qty), [qty])

  const chosen = classOptions.find(c => c.key === classKey) ?? null

  const classVnd = (opt: ClassOption | null): number | null => {
    if (!opt) return null
    if (opt.feeKind === 'free') return 0
    if (opt.feeKind === 'combo') return null
    return classFeeVnd
  }
  const practiceVnd = plans[duration].vnd
  const totalVnd = (() => {
    if (!mode) return null
    if (mode === 'practice') return practiceVnd
    const cv = classVnd(chosen)
    if (mode === 'class') return cv
    if (cv === null || practiceVnd === null) return null
    return cv + practiceVnd
  })()
  const totalLabel = totalVnd !== null ? fmtVnd(totalVnd)
    : mode === 'both' ? 'Theo thông tin Thầy gửi'
    : null

  const modeReady = mode !== null && (mode === 'practice' ? true : !!chosen)

  const pickMode = (m: OfferMode) => { setMode(m); setErr('') }

  const confirm = () => {
    if (!modeReady) { setErr(mode === 'class' || mode === 'both' ? 'Vui lòng chọn lớp ở cột tương ứng.' : ''); return }
    setErr('')
    setStep('profile')
    boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const submitProfile = () => {
    if (!name.trim()) { setErr('Vui lòng nhập Họ và tên.'); return }
    const ec = checkEmail(email)
    if (!ec.ok) { setErr(ec.error || 'Email chưa đúng.'); return }
    if (!modeReady || !mode) return
    setErr('')
    onSubmit({
      mode, duration, className: mode === 'practice' ? '' : (chosen?.key ?? ''),
      classTitle: mode === 'practice' ? null : (chosen?.title ?? null),
      name: name.trim(), email: email.trim(),
    })
  }

  const changeBack = () => { setStep('choose'); setErr(''); boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  const selTitle = mode === 'practice' ? null : chosen?.title ?? null
  const summaryLine = mode
    ? `${OFFER_META[mode].title}${selTitle ? ` · ${selTitle}` : ''}${mode !== 'class' ? ` · ${DUR_LABEL[duration]}` : ''}`
    : ''

  return (
    <div className="crf" ref={boxRef}>
      {step === 'choose' ? (
        <>
          {/* ── DESKTOP / TABLET: BẢNG SO SÁNH THẬT ── */}
          <div className="crf-table" role="table" aria-label="So sánh các hình thức học">
            {/* Header 3 cột offer */}
            <div className="crf-row crf-head" role="row">
              <div className="crf-label" role="columnheader">Quyền lợi</div>
              {(['practice', 'class', 'both'] as OfferMode[]).map(m => {
                const meta = OFFER_META[m]
                const on = mode === m
                const price = m === 'practice'
                  ? (plans[duration].line ? `${plans[duration].line}${duration === '1_month' ? '/tháng' : ''}` : null)
                  : m === 'class'
                  ? (chosen ? chosen.priceLabel : classFeeLabel ? `${classFeeLabel}/khoá` : null)
                  : mode === 'both' ? totalLabel : null
                return (
                  <div key={m} role="columnheader"
                    className={`crf-cell crf-head-cell crf-${meta.color}${on ? ' on' : ''}`}>
                    <button type="button" className={`crf-select crf-select-${meta.color}${on ? ' on' : ''}`}
                      role="radio" aria-checked={on} onClick={() => pickMode(m)}>
                      <span className="crf-radio">{on ? '✓' : ''}</span>
                      <span className="crf-select-txt">
                        <b>{meta.title}</b>
                        <span className="crf-select-sub">{meta.sub}</span>
                      </span>
                    </button>
                    {price && <div className="crf-price">{price}</div>}
                    {m === 'practice' && duration === '6_month' && sixMonthlyLine && <div className="crf-price-sub">{sixMonthlyLine}</div>}
                  </div>
                )
              })}
            </div>

            {/* Hàng quyền lợi */}
            {rows.map((r, i) => (
              <div className={`crf-row${i === 0 ? ' crf-first' : ''}`} role="row" key={r.label}>
                <div className="crf-label" role="rowheader">{r.label}</div>
                {(['practice', 'class', 'both'] as OfferMode[]).map(m => {
                  const cell = r[ROW_KEY[m]]
                  return (
                    <div className={`crf-cell crf-body-cell crf-${OFFER_META[m].color}${mode === m ? ' col-on' : ''}`} role="cell" key={m}>
                      {cell.check
                        ? <span className="crf-check">✓</span>
                        : cell.dash
                        ? <span className="crf-dash">—</span>
                        : cell.lines.map((l, li) => <span className="crf-cell-line" key={li}>{l}</span>)}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Hàng chọn (duration / lớp / tổng) — dưới cùng, trước confirm */}
            <div className="crf-row crf-controls" role="row">
              <div className="crf-label">Lựa chọn của bạn</div>
              <div className={`crf-cell crf-ctl crf-mem${mode === 'practice' ? ' col-on' : ''}`}>
                <span className="crf-ctl-title">Thời hạn gói</span>
                <div className="crf-pills">
                  {(['1_month', '6_month'] as PracticeDuration[]).map(d => (
                    <button key={d} type="button" role="radio" aria-checked={duration === d}
                      className={'crf-pill' + (duration === d ? ' on' : '')} onClick={() => setDuration(d)}>
                      <b>{DUR_LABEL[d]}</b>
                      {plans[d].line && <span>{plans[d].line}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`crf-cell crf-ctl crf-cls${mode === 'class' || mode === 'both' ? ' col-on' : ''}`}>
                {chosen ? (
                  <div className="crf-chosen">
                    <div className="crf-chosen-tag">{chosen.tag ?? (chosen.active ? 'Đang học' : 'Sắp khai giảng')}</div>
                    <b>{chosen.title}</b>
                    {chosen.schedule && <span>🗓 {chosen.schedule}</span>}
                    {chosen.date && <span>{chosen.date}</span>}
                    <div className="crf-chosen-foot">
                      <span className="crf-chosen-price">{chosen.priceLabel ?? ''}</span>
                      <button type="button" className="crf-mini" onClick={() => setClassKey('')}>Đổi lớp</button>
                    </div>
                  </div>
                ) : (
                  <div className="crf-choose-cls">
                    <span className="crf-ctl-title">Chọn lớp muốn học</span>
                    <div className="crf-cls-list">
                      {classOptions.map(opt => (
                        <button key={opt.key} type="button" role="radio" aria-checked={classKey === opt.key}
                          className="crf-cls-opt" onClick={() => setClassKey(opt.key)}>
                          <span className="crf-cls-opt-radio">{classKey === opt.key ? '✓' : ''}</span>
                          <span className="crf-cls-opt-body">
                            <b>{opt.title}</b>
                            <span className="crf-cls-opt-meta">
                              {opt.active ? 'Đang học · ' : ''}{opt.schedule || ''}{opt.date ? ` · ${opt.date}` : ''}
                            </span>
                          </span>
                          <span className="crf-cls-opt-price">{opt.priceLabel ?? ''}</span>
                        </button>
                      ))}
                    </div>
                    <button type="button" className="crf-mini" onClick={onBrowseClasses}>Xem lịch lớp đầy đủ →</button>
                  </div>
                )}
              </div>
              <div className={`crf-cell crf-ctl crf-both${mode === 'both' ? ' col-on' : ''}`}>
                {!chosen
                  ? <span className="crf-hint">Chọn lớp ở cột bên →</span>
                  : <>
                      <div className="crf-both-line">{chosen.title}</div>
                      <div className="crf-both-line">{OFFER_META.practice.title} · {DUR_LABEL[duration]}</div>
                      {plans[duration].line && <div className="crf-both-sub">{plans[duration].line}</div>}
                      <div className="crf-both-total">
                        <span>Tổng thanh toán</span>
                        <b>{totalLabel ?? '—'}</b>
                      </div>
                    </>}
              </div>
            </div>
          </div>

          {/* ── MOBILE: tab 3 hình thức + panel (cùng dữ liệu) ── */}
          <div className="crf-mobile">
            <div className="crf-m-tabs" role="tablist" aria-label="Hình thức học">
              {(['practice', 'class', 'both'] as OfferMode[]).map(m => (
                <button key={m} type="button" role="tab" aria-selected={mode === m}
                  className={`crf-m-tab crf-${OFFER_META[m].color}${mode === m ? ' on' : ''}`}
                  onClick={() => pickMode(m)}>
                  <b>{OFFER_META[m].title}</b>
                  <span>{OFFER_META[m].sub}</span>
                </button>
              ))}
            </div>

            {mode && (
              <div className={`crf-m-panel crf-panel-${OFFER_META[mode].color}`}>
                <div className="crf-m-head">
                  <div>
                    <b>{OFFER_META[mode].title}</b>
                    <span>{OFFER_META[mode].sub}</span>
                  </div>
                  <div className="crf-m-price">
                    {mode === 'practice' && plans[duration].line && <b>{plans[duration].line}{duration === '1_month' ? '/tháng' : ''}</b>}
                    {mode === 'class' && (chosen?.priceLabel ?? (classFeeLabel ? `${classFeeLabel}/khoá` : null))}
                    {mode === 'both' && totalLabel}
                    {mode === 'practice' && duration === '6_month' && sixMonthlyLine && <span>{sixMonthlyLine}</span>}
                  </div>
                </div>

                {mode === 'practice' && (
                  <div className="crf-pills">
                    {(['1_month', '6_month'] as PracticeDuration[]).map(d => (
                      <button key={d} type="button" role="radio" aria-checked={duration === d}
                        className={'crf-pill' + (duration === d ? ' on' : '')} onClick={() => setDuration(d)}>
                        <b>{DUR_LABEL[d]}</b>
                        {plans[d].line && <span>{plans[d].line}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {mode === 'class' && !chosen && (
                  <div className="crf-choose-cls crf-choose-cls-m">
                    <span className="crf-ctl-title">Chọn lớp muốn học</span>
                    {classOptions.map(opt => (
                      <button key={opt.key} type="button" role="radio" aria-checked={classKey === opt.key}
                        className="crf-cls-opt" onClick={() => setClassKey(opt.key)}>
                        <span className="crf-cls-opt-radio">{classKey === opt.key ? '✓' : ''}</span>
                        <span className="crf-cls-opt-body">
                          <b>{opt.title}</b>
                          <span className="crf-cls-opt-meta">{opt.active ? 'Đang học · ' : ''}{opt.schedule || ''}{opt.date ? ` · ${opt.date}` : ''}</span>
                        </span>
                        <span className="crf-cls-opt-price">{opt.priceLabel ?? ''}</span>
                      </button>
                    ))}
                    <button type="button" className="crf-mini" onClick={onBrowseClasses}>Xem lịch lớp đầy đủ →</button>
                  </div>
                )}

                {mode === 'both' && !chosen && (
                  <div className="crf-choose-cls crf-choose-cls-m">
                    <span className="crf-ctl-title">Bước 1 — Chọn lớp muốn học</span>
                    {classOptions.map(opt => (
                      <button key={opt.key} type="button" role="radio" aria-checked={classKey === opt.key}
                        className="crf-cls-opt" onClick={() => setClassKey(opt.key)}>
                        <span className="crf-cls-opt-radio">{classKey === opt.key ? '✓' : ''}</span>
                        <span className="crf-cls-opt-body"><b>{opt.title}</b></span>
                        <span className="crf-cls-opt-price">{opt.priceLabel ?? ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                {mode === 'both' && chosen && (
                  <>
                    <div className="crf-both-line"><b>{chosen.title}</b></div>
                    <div className="crf-both-line">Gói Thực hành · {DUR_LABEL[duration]}</div>
                    <div className="crf-pills">
                      {(['1_month', '6_month'] as PracticeDuration[]).map(d => (
                        <button key={d} type="button" role="radio" aria-checked={duration === d}
                          className={'crf-pill' + (duration === d ? ' on' : '')} onClick={() => setDuration(d)}>
                          <b>{DUR_LABEL[d]}</b>
                          {plans[d].line && <span>{plans[d].line}</span>}
                        </button>
                      ))}
                    </div>
                    <div className="crf-both-total"><span>Tổng thanh toán</span><b>{totalLabel ?? '—'}</b></div>
                  </>
                )}

                <div className="crf-m-rows">
                  {rows.map(r => {
                    const cell = r[ROW_KEY[mode]]
                    return (
                      <div className="crf-m-row" key={r.label}>
                        <div className="crf-m-row-label">{r.label}</div>
                        {cell.check ? <span className="crf-check">✓</span>
                          : cell.dash ? <span className="crf-dash">—</span>
                          : <div className="crf-m-row-val">{cell.lines.map((l, li) => <span key={li}>{l}</span>)}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Thanh xác nhận lựa chọn */}
          <div className="crf-confirm">
            <div className="crf-confirm-info">
              {mode
                ? <>
                    <span className="crf-confirm-kicker">Bạn đang chọn</span>
                    <b>{summaryLine}</b>
                    <span className="crf-confirm-total">Tổng thanh toán: <b>{totalLabel ?? '—'}</b></span>
                  </>
                : <span className="crf-confirm-empty">Chọn một hình thức học bên trên để xem tóm tắt.</span>}
            </div>
            <button type="button" className="btn crf-confirm-btn" disabled={!modeReady} onClick={confirm}>
              Xác nhận lựa chọn →
            </button>
          </div>
          {err && <div className="crf-err">{err}</div>}
        </>
      ) : (
        /* ── STEP 2: Họ tên + Email (chỉ vậy) ── */
        <div className="crf-profile">
          <div className="crf-profile-chosen">
            <span className="crf-confirm-kicker">Bạn đã chọn</span>
            <b>{summaryLine}</b>
            <span className="crf-profile-total">Tổng thanh toán: <b>{totalLabel ?? '—'}</b></span>
            {mode === 'both' && chosen && (
              <div className="crf-profile-both">
                <div>{chosen.title}{chosen.priceLabel ? ` · ${chosen.priceLabel}` : ''}</div>
                <div>Gói Thực hành · {DUR_LABEL[duration]}{plans[duration].line ? ` · ${plans[duration].line}` : ''}</div>
              </div>
            )}
            {mode === 'class' && chosen && chosen.priceLabel && (
              <div className="crf-profile-both"><div>{chosen.title} · {chosen.priceLabel}{chosen.schedule ? ` · ${chosen.schedule}` : ''}</div></div>
            )}
          </div>

          <div className="crf-fields">
            <div className="crf-field">
              <label>Họ và tên</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" />
            </div>
            <div className="crf-field">
              <label>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@example.com" autoComplete="email" />
              <span className="crf-field-note">Email dùng để nhận hướng dẫn thanh toán và kích hoạt tài khoản học tập.</span>
            </div>
          </div>

          {!me && onLogin && (
            <p className="crf-login-hint">Đã là học viên? <button type="button" onClick={onLogin}>Đăng nhập để hệ thống nhận quyền hiện có →</button></p>
          )}

          {err && <div className="crf-err">{err}</div>}
          <div className="crf-profile-acts">
            <button type="button" className="btn btn-primary" onClick={submitProfile}>
              Tiếp tục thanh toán →
            </button>
            <button type="button" className="crf-change" onClick={changeBack}>← Thay đổi lựa chọn</button>
          </div>
        </div>
      )}
      <style>{CSS}</style>
    </div>
  )
}

/* ─── Style scoped — design token .tva-class ─── */
const CSS = `
.tva-class{--mem:#EA580C;--mem-soft:#FDF0E7;--mem-line:#F5CFB6;}
.tva-class .crf{padding:6px 0 2px;}
/* ── BẢNG DESKTOP ── */
.tva-class .crf-table{display:none;margin-top:14px;}
@media(min-width:720px){.tva-class .crf-table{display:grid;grid-template-columns:170px repeat(3,1fr);gap:8px;align-items:stretch;}}
.tva-class .crf-label{font-size:13px;font-weight:700;color:var(--ink-soft);display:flex;align-items:center;padding:10px 6px 10px 2px;line-height:1.45;}
.tva-class .crf-head .crf-label{color:var(--ink-faint);font-size:11.5px;text-transform:uppercase;letter-spacing:1.2px;font-weight:800;}
.tva-class .crf-cell{background:var(--surface);border:1.5px solid var(--line);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:5px;transition:border-color .15s,box-shadow .15s;}
.tva-class .crf-cell.col-on{box-shadow:0 0 0 1.5px currentColor inset;}
.tva-class .crf-mem.col-on{border-color:var(--mem);box-shadow:0 0 0 1.5px var(--mem) inset;}
.tva-class .crf-cls.col-on{border-color:var(--indigo);box-shadow:0 0 0 1.5px var(--indigo) inset;}
.tva-class .crf-both.col-on{border-color:var(--mem);box-shadow:0 0 0 1.5px var(--mem) inset,0 0 0 4px var(--indigo) inset;}
.tva-class .crf-head-cell{background:var(--bg);border-style:dashed;justify-content:flex-start;}
.tva-class .crf-head-cell.on{border-style:solid;}
.tva-class .crf-select{display:flex;align-items:center;gap:9px;background:none;border:none;padding:0;cursor:pointer;font-family:inherit;text-align:left;width:100%;}
.tva-class .crf-radio{width:22px;height:22px;border-radius:50%;border:2px solid var(--line);background:#fff;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;transition:all .15s;}
.tva-class .crf-select.on .crf-radio{background:var(--indigo);border-color:var(--indigo);}
.tva-class .crf-select-mem.on .crf-radio{background:var(--mem);border-color:var(--mem);}
.tva-class .crf-select-both.on .crf-radio{background:linear-gradient(120deg,var(--mem),var(--indigo));border-color:transparent;}
.tva-class .crf-select-txt{display:flex;flex-direction:column;gap:1px;}
.tva-class .crf-select-txt b{font-size:14.5px;font-weight:800;color:var(--ink);line-height:1.25;}
.tva-class .crf-select-sub{font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--ink-faint);}
.tva-class .crf-select-mem .crf-select-sub{color:var(--mem);}
.tva-class .crf-select-cls .crf-select-sub{color:var(--indigo);}
.tva-class .crf-select-both .crf-select-sub{color:var(--mem);}
.tva-class .crf-price{margin-top:4px;font-size:16px;font-weight:800;color:var(--ink);}
.tva-class .crf-price-sub{font-size:11.5px;font-weight:600;color:var(--ink-soft);}
.tva-class .crf-check{color:var(--online);font-weight:900;font-size:17px;line-height:1;}
.tva-class .crf-cell-line{font-size:12.5px;line-height:1.5;color:var(--ink-soft);}
.tva-class .crf-first{ } 
/* Hàng controls */
.tva-class .crf-controls{align-items:stretch;}
.tva-class .crf-ctl-title{font-size:11px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:var(--ink-faint);margin-bottom:2px;}
.tva-class .crf-pills{display:flex;flex-direction:column;gap:7px;margin-top:4px;}
.tva-class .crf-pill{display:flex;flex-direction:column;align-items:flex-start;gap:1px;text-align:left;border:1.5px solid var(--line);background:var(--surface);border-radius:11px;padding:9px 12px;cursor:pointer;font-family:inherit;transition:all .15s;}
.tva-class .crf-pill b{font-size:13px;color:var(--ink);}
.tva-class .crf-pill span{font-size:11.5px;color:var(--ink-soft);}
.tva-class .crf-pill:hover{border-color:#CFC9DA;}
.tva-class .crf-pill.on{border-color:var(--mem);background:var(--mem-soft);}
.tva-class .crf-pill.on b{color:var(--mem);}
/* chọn lớp */
.tva-class .crf-choose-cls{display:flex;flex-direction:column;gap:7px;}
.tva-class .crf-cls-list{max-height:250px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-right:2px;}
.tva-class .crf-cls-opt{display:flex;align-items:center;gap:8px;border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:8px 10px;cursor:pointer;font-family:inherit;text-align:left;transition:all .15s;}
.tva-class .crf-cls-opt:hover{border-color:#CFC9DA;}
.tva-class .crf-cls-opt[aria-checked="true"]{border-color:var(--indigo);background:var(--indigo-tint);}
.tva-class .crf-cls-opt-radio{width:17px;height:17px;border-radius:50%;border:2px solid var(--line);background:#fff;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0;}
.tva-class .crf-cls-opt[aria-checked="true"] .crf-cls-opt-radio{background:var(--indigo);border-color:var(--indigo);}
.tva-class .crf-cls-opt-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
.tva-class .crf-cls-opt-body b{font-size:12.5px;font-weight:700;color:var(--ink);line-height:1.3;}
.tva-class .crf-cls-opt-meta{font-size:10.5px;color:var(--ink-soft);line-height:1.35;}
.tva-class .crf-cls-opt-price{font-size:11.5px;font-weight:800;color:var(--honey);flex-shrink:0;}
.tva-class .crf-chosen{display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:var(--ink-soft);line-height:1.45;}
.tva-class .crf-chosen b{color:var(--indigo);font-size:13.5px;}
.tva-class .crf-chosen-tag{align-self:flex-start;font-size:10.5px;font-weight:800;color:var(--indigo);background:var(--indigo-tint);border-radius:999px;padding:2px 9px;text-transform:uppercase;letter-spacing:.6px;}
.tva-class .crf-chosen-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;}
.tva-class .crf-chosen-price{font-weight:800;color:var(--honey);font-size:13px;}
.tva-class .crf-mini{background:none;border:none;padding:0;color:var(--indigo);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;text-decoration:underline;text-underline-offset:3px;align-self:flex-start;}
/* Both tổng hợp */
.tva-class .crf-hint{font-size:12px;color:var(--ink-soft);}
.tva-class .crf-both-line{font-size:12.5px;color:var(--ink);font-weight:600;line-height:1.4;}
.tva-class .crf-both-sub{font-size:11.5px;color:var(--ink-soft);}
.tva-class .crf-both-total{margin-top:auto;border-top:1.5px solid var(--line);padding-top:8px;display:flex;flex-direction:column;gap:2px;}
.tva-class .crf-both-total span{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--ink-faint);}
.tva-class .crf-both-total b{font-size:17px;font-weight:800;color:var(--mem);}
/* Confirm bar */
.tva-class .crf-confirm{margin-top:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:var(--surface);border:1.5px solid var(--line);border-radius:16px;padding:14px 18px;}
.tva-class .crf-confirm-info{display:flex;flex-direction:column;gap:2px;min-width:220px;}
.tva-class .crf-confirm-kicker{font-size:10.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-faint);}
.tva-class .crf-confirm-info b{font-size:15px;color:var(--ink);}
.tva-class .crf-confirm-total{font-size:13px;color:var(--ink-soft);}
.tva-class .crf-confirm-total b{color:var(--honey);font-size:14.5px;}
.tva-class .crf-confirm-empty{font-size:13px;color:var(--ink-faint);}
.tva-class .crf-confirm-btn{background:var(--indigo);color:#fff;border:none;border-radius:12px;padding:13px 24px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:all .15s;}
.tva-class .crf-confirm-btn:disabled{background:#D8D2E6;color:#8B87A0;cursor:not-allowed;}
.tva-class .crf-confirm-btn:not(:disabled):hover{background:var(--indigo-dark);}
.tva-class .crf-err{margin-top:10px;background:#FEE2E2;border:1px solid #FECACA;color:#B91C1C;border-radius:10px;padding:9px 13px;font-size:13px;font-weight:600;}
/* ── MOBILE ── */
.tva-class .crf-mobile{display:block;margin-top:14px;}
@media(min-width:720px){.tva-class .crf-mobile{display:none;}}
.tva-class .crf-m-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.tva-class .crf-m-tab{display:flex;flex-direction:column;align-items:flex-start;gap:1px;text-align:left;border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:9px 12px;cursor:pointer;font-family:inherit;}
.tva-class .crf-m-tab b{font-size:13px;color:var(--ink);}
.tva-class .crf-m-tab span{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-faint);}
.tva-class .crf-m-tab.on{border-width:2px;}
.tva-class .crf-m-tab.crf-mem.on{border-color:var(--mem);background:var(--mem-soft);}
.tva-class .crf-m-tab.crf-cls.on{border-color:var(--indigo);background:var(--indigo-tint);}
.tva-class .crf-m-tab.crf-both.on{border-color:var(--mem);background:linear-gradient(90deg,var(--mem-soft),var(--indigo-tint));}
.tva-class .crf-m-tab.crf-mem.on b{color:var(--mem);}
.tva-class .crf-m-tab.crf-cls.on b{color:var(--indigo);}
.tva-class .crf-m-panel{margin-top:12px;border:2px solid var(--line);border-top-width:4px;border-radius:16px;background:var(--surface);padding:16px;}
.tva-class .crf-m-panel.crf-panel-mem{border-color:var(--mem-line);}
.tva-class .crf-m-panel.crf-panel-cls{border-color:#D3CEE8;}
.tva-class .crf-m-panel.crf-panel-both{border-color:var(--mem-line);}
.tva-class .crf-m-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}
.tva-class .crf-m-head > div:first-child{display:flex;flex-direction:column;}
.tva-class .crf-m-head b{font-size:16.5px;color:var(--ink);}
.tva-class .crf-m-head > div:first-child span{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--ink-faint);}
.tva-class .crf-m-head .crf-m-price{text-align:right;display:flex;flex-direction:column;gap:1px;}
.tva-class .crf-m-price b{font-size:15.5px;}
.tva-class .crf-m-price span{font-size:10.5px;color:var(--ink-soft);}
.tva-class .crf-choose-cls-m{margin-top:12px;}
.tva-class .crf-m-rows{margin-top:14px;border-top:1.5px solid var(--line);padding-top:6px;display:flex;flex-direction:column;}
.tva-class .crf-m-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);}
.tva-class .crf-m-row:last-child{border-bottom:none;}
.tva-class .crf-m-row-label{font-size:13px;font-weight:700;color:var(--ink);flex:1;}
.tva-class .crf-m-row-val{display:flex;flex-direction:column;gap:2px;max-width:55%;}
.tva-class .crf-m-row-val span{font-size:12.5px;line-height:1.45;color:var(--ink-soft);text-align:right;}
/* ── STEP 2 profile ── */
.tva-class .crf-profile{max-width:640px;margin:14px 0 0;}
.tva-class .crf-profile-chosen{background:var(--surface);border:1.5px solid var(--line);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:3px;}
.tva-class .crf-profile-chosen b{font-size:17px;color:var(--ink);}
.tva-class .crf-profile-total{font-size:14px;color:var(--ink-soft);}
.tva-class .crf-profile-total b{color:var(--honey);font-size:18px;}
.tva-class .crf-profile-both{margin-top:6px;border-top:1px dashed var(--line);padding-top:8px;display:flex;flex-direction:column;gap:3px;font-size:13px;color:var(--ink-soft);line-height:1.45;}
.tva-class .crf-fields{display:grid;gap:14px;grid-template-columns:1fr;margin-top:18px;}
@media(min-width:640px){.tva-class .crf-fields{grid-template-columns:1fr 1fr;}}
.tva-class .crf-field label{font-size:12.5px;font-weight:600;color:var(--ink-soft);display:block;margin-bottom:5px;}
.tva-class .crf-field input{width:100%;font-family:inherit;font-size:15px;color:var(--ink);background:#F7F5F1;border:1.5px solid var(--line);border-radius:11px;padding:12px 14px;}
.tva-class .crf-field input:focus{outline:none;border-color:var(--indigo);background:#fff;}
.tva-class .crf-field-note{display:block;margin-top:5px;font-size:11.5px;color:var(--ink-faint);line-height:1.4;}
.tva-class .crf-dash{color:var(--line);font-weight:800;font-size:15px;}
.tva-class .crf-login-hint{margin-top:14px;font-size:12.5px;color:var(--ink-soft);}
.tva-class .crf-login-hint button{background:none;border:none;padding:0;color:var(--indigo);font-weight:700;cursor:pointer;font-family:inherit;font-size:12.5px;text-decoration:underline;text-underline-offset:3px;}
.tva-class .crf-profile-acts{display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin-top:18px;}
.tva-class .crf-profile-acts .btn{padding:14px 26px;font-size:15.5px;}
.tva-class .crf-change{background:none;border:none;padding:0;color:var(--indigo);font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;text-decoration:underline;text-underline-offset:3px;}
`
