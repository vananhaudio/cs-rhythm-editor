/**
 * ClassPublicTracks — "Hai tuyến học" + đăng ký trên class.vananhaudio.com (Phase 1, 09/2026).
 *
 * Thay cho ClassLearningWays (2 tab Thực hành / Học theo lớp) + ClassOfferCompare (bảng 3 cột).
 * - Luôn hiện đủ 4 sản phẩm public (PRODUCTS) trên 2 tuyến.
 * - Lịch mỗi sản phẩm = cohort ĐANG TUYỂN (class_schedule.public_enroll=true) do trang cha truyền vào;
 *   không có cohort → "Lịch khai giảng đang cập nhật" + Hỏi Mira / Nhắn Thầy. KHÔNG bịa lịch.
 * - Đăng ký: chọn sản phẩm → họ tên + email → trang cha ghi leads + mở khối thanh toán cũ.
 *   Chọn "Theo tháng / Đồng hành 6 tháng" để sang Phase 2.
 */
import { useState } from 'react'
import { PRODUCTS, TRACKS, type PublicProductKey } from '../class-content'

export type PublicCohort = { code: string; name: string; schedule: string; dateLabel: string }

type Props = {
  cohorts: Partial<Record<PublicProductKey, PublicCohort>> | null   // null = đang tải
  selected: PublicProductKey | null
  onSelect: (k: PublicProductKey) => void
  onMira: () => void
  zaloUrl: string
  onSubmit: (p: { product: PublicProductKey; name: string; email: string }) => Promise<void>
}

export default function ClassPublicTracks({ cohorts, selected, onSelect, onMira, zaloUrl, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!selected) return
    const n = name.trim(), e = email.trim()
    if (!n) { setErr('Nhập họ tên của bạn.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setErr('Email chưa đúng.'); return }
    setBusy(true)
    try { await onSubmit({ product: selected, name: n, email: e }) } finally { setBusy(false) }
  }

  const sel = selected ? PRODUCTS[selected] : null
  const selCohort = selected ? cohorts?.[selected] : undefined

  return (
    <section id="tuyen-hoc" className="band cpt">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="eyebrow">Lộ trình</div>
        <h2>Hai tuyến học</h2>
        <p className="lead">Người mới bắt đầu bằng một lớp căn bản 4 buổi — mở vòng liên tục quanh năm. Học xong, đi tiếp 6 tháng cùng Thầy.</p>

        <div className="cpt-tracks">
          {TRACKS.map(t => (
            <div className="cpt-track" key={t.name}>
              <div className="cpt-tname">{t.name}</div>
              {t.steps.map((k, i) => {
                const p = PRODUCTS[k]
                const c = cohorts?.[k]
                return (
                  <div key={k}>
                    {i > 0 && <div className="cpt-arrow" aria-hidden>↓</div>}
                    <div className={'cpt-step' + (selected === k ? ' on' : '')} id={'sp-' + k}>
                      <div className="cpt-title">{p.title} <span>· {p.length}</span></div>
                      <p>{p.desc}</p>
                      <div className="cpt-sched">
                        {cohorts === null ? 'Đang tải lịch…'
                          : c ? <><b>{c.dateLabel}</b>{c.schedule && <> · {c.schedule}</>}</>
                          : 'Lịch khai giảng đang cập nhật'}
                      </div>
                      <div className="cpt-acts">
                        {c
                          ? <button className="btn btn-primary" onClick={() => onSelect(k)}>{p.kind === 'funnel' ? p.cta : 'Đăng ký'} →</button>
                          : <>
                              <button className="btn btn-primary" onClick={onMira}>Hỏi Mira →</button>
                              <a className="btn btn-ghost" href={zaloUrl} target="_blank" rel="noreferrer">Nhắn Thầy</a>
                            </>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {sel && selCohort && (
          <div className="cpt-form" id="dangky">
            <div className="cpt-form-k">Đăng ký</div>
            <div className="cpt-form-t">{sel.title} · {sel.length}</div>
            <div className="cpt-form-s">{selCohort.dateLabel}{selCohort.schedule && ` · ${selCohort.schedule}`}</div>
            <label>Họ tên<input value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" /></label>
            <label>Email<input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" type="email" autoComplete="email"
              onKeyDown={e => { if (e.key === 'Enter') void submit() }} /></label>
            {err && <div className="cpt-err">{err}</div>}
            <button className="btn btn-primary cpt-submit" disabled={busy} onClick={() => void submit()}>{busy ? 'Đang gửi…' : 'Tiếp tục thanh toán →'}</button>
            <div className="cpt-note">Thông tin học tập sẽ được hỏi sau khi thanh toán.</div>
          </div>
        )}
      </div>
    </section>
  )
}

const CSS = `
.cpt-tracks{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}
.cpt-track{background:#fff;border:1px solid #E7E2D8;border-radius:18px;padding:18px}
.cpt-tname{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#4338CA;margin-bottom:12px}
.cpt-arrow{text-align:center;color:#9CA3AF;font-size:18px;line-height:1;margin:8px 0}
.cpt-step{border:1.5px solid #EEE9DF;border-radius:14px;padding:14px;transition:border-color .15s}
.cpt-step.on{border-color:#4338CA;box-shadow:0 0 0 3px rgba(67,56,202,.12)}
.cpt-title{font-size:18px;font-weight:800;color:#111827}
.cpt-title span{font-weight:600;color:#6B7280;font-size:15px}
.cpt-step p{margin:6px 0 10px;color:#4B5563;font-size:14.5px;line-height:1.55}
.cpt-sched{font-size:13.5px;color:#6B7280;background:#F7F5F0;border-radius:9px;padding:8px 10px;margin-bottom:12px}
.cpt-sched b{color:#111827}
.cpt-acts{display:flex;gap:8px;flex-wrap:wrap}
.cpt-acts .btn{text-decoration:none}
.cpt-form{margin:22px auto 0;max-width:460px;background:#fff;border:1.5px solid #4338CA;border-radius:18px;padding:20px}
.cpt-form-k{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#4338CA}
.cpt-form-t{font-size:19px;font-weight:800;color:#111827;margin-top:4px}
.cpt-form-s{font-size:13.5px;color:#6B7280;margin:2px 0 14px}
.cpt-form label{display:block;font-size:13px;color:#6B7280;font-weight:600;margin-bottom:12px}
.cpt-form input{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:11px 13px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:16px;background:#F9FAFB;font-family:inherit;color:#111827}
.cpt-err{background:#FEE2E2;color:#B91C1C;border-radius:9px;padding:8px 12px;font-size:13.5px;margin-bottom:12px}
.cpt-submit{width:100%}
.cpt-note{font-size:12.5px;color:#9CA3AF;text-align:center;margin-top:10px}
@media (max-width:760px){.cpt-tracks{grid-template-columns:1fr}.cpt-track{padding:14px}}
`
