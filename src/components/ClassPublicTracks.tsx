/**
 * ClassPublicTracks — "Các lớp đang tuyển sinh" trên class.vananhaudio.com (09/2026).
 *
 * - Chỉ hiện lớp THẬT đang tuyển: cohort class_schedule.public_enroll=true do trang cha truyền vào
 *   (gom theo public_product). Không hard-code lịch; không nói số buổi/thời hạn/lộ trình.
 * - Card: tên lớp · dành cho ai · lịch (Thứ · giờ) · ngày khai giảng · "Đăng ký lớp →".
 * - Bấm → khung đăng ký của chính lớp đó mở ngay dưới card: chọn cách đồng hành (2 card gói,
 *   giá + quyền lợi từ DB) → họ tên + email → trang cha ghi lead + mở bước chuyển khoản.
 */
import { useState } from 'react'
import { PRODUCTS, PUBLIC_ORDER, type PublicProductKey } from '../class-content'

// dateLabel: nhãn có đếm ngược (thẻ tuyển sinh) · when: 'Thứ 3 · 19:00–20:30' · startLabel: 'Khai giảng 06/10/2026' (checkout)
export type PublicCohort = { code: string; name: string; schedule: string; dateLabel: string; when: string; startLabel: string }
export type PlanKey = 'monthly' | 'six_month'
export type PublicPlan = { key: PlanKey; label: string; priceVnd: number; totalVnd: number | null; benefits: { key: string; label: string }[] }

// Card chỉ hiện phần KHÁC NHAU giữa 2 gói (chỉ là trình bày — dữ liệu quyền lợi/entitlement giữ nguyên):
// "lớp hàng tuần" chung cho cả hai → đưa lên dòng dùng chung; vài nhãn rút gọn / gộp cho gọn trên mobile.
const CARD_SKIP = new Set(['lop_hang_tuan', 'khoa_cua_lop'])
const CARD_LABEL: Record<string, string> = { pdf_thang: 'PDF theo tháng', hoi_thay: 'Hỏi Thầy', thuc_hanh: 'Thực hành & cộng đồng', cong_dong: 'Thực hành & cộng đồng' }
const cardBenefits = (bs: PublicPlan['benefits']) =>
  [...new Set(bs.filter(b => !CARD_SKIP.has(b.key)).map(b => CARD_LABEL[b.key] ?? b.label))]

type Props = {
  cohorts: Partial<Record<PublicProductKey, PublicCohort>> | null   // null = đang tải
  selected: PublicProductKey | null
  onSelect: (k: PublicProductKey) => void
  onMira: () => void
  zaloUrl: string
  plans: PublicPlan[] | null     // null = đang tải; [] = chưa tải được
  onSubmit: (p: { product: PublicProductKey; plan: PlanKey; name: string; email: string }) => Promise<void>
}

const vnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

export default function ClassPublicTracks({ cohorts, selected, onSelect, onMira, zaloUrl, plans, onSubmit }: Props) {
  const [plan, setPlan] = useState<PlanKey | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!selected) return
    if (!plan) { setErr('Chọn một cách đồng hành phía trên.'); return }
    const n = name.trim(), e = email.trim()
    if (!n) { setErr('Nhập họ tên của bạn.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setErr('Email chưa đúng.'); return }
    setBusy(true)
    try { await onSubmit({ product: selected, plan, name: n, email: e }) }
    catch (x) { setErr(x instanceof Error ? x.message : 'Chưa gửi được đăng ký — vui lòng thử lại.') }
    finally { setBusy(false) }
  }

  const sel = selected ? PRODUCTS[selected] : null
  const selCohort = selected ? cohorts?.[selected] : undefined
  // Khung đăng ký hiện NGAY dưới lớp vừa chọn (không phải cuối cả hai tuyến)
  const form = sel && selCohort && (
          <div className="cpt-form" id="dangky">
            <div className="cpt-form-k">Đăng ký</div>
            <div className="cpt-form-t">{sel.title}</div>
            {selCohort.when && <div className="cpt-form-s">{selCohort.when}</div>}
            <div className="cpt-form-s cpt-form-s2">{selCohort.startLabel}</div>
            <div className="cpt-plan-lead">Cùng một lớp học. Bạn chỉ chọn cách đồng hành.</div>
            <div className="cpt-plan-shared">✓ Cả hai lựa chọn đều học cùng Thầy hàng tuần.</div>
            {plans === null && <div className="cpt-note">Đang tải học phí…</div>}
            {plans !== null && plans.length === 0 && (
              <div className="cpt-err">Chưa tải được học phí. <a href={zaloUrl} target="_blank" rel="noreferrer">Nhắn Thầy qua Zalo</a> để đăng ký nhé.</div>
            )}
            <div className="cpt-plans" role="radiogroup" aria-label="Cách đồng hành">
              {(plans ?? []).map(pl => (
                <button type="button" key={pl.key} role="radio" aria-checked={plan === pl.key} aria-label={`${pl.label}, ${vnd(pl.priceVnd)} mỗi tháng`}
                  className={'cpt-plan' + (plan === pl.key ? ' on' : '')} onClick={() => { setPlan(pl.key); setErr('') }}>
                  <div className="cpt-plan-name">{pl.label}</div>
                  <div className="cpt-plan-price">{vnd(pl.priceVnd)}<span>/tháng</span></div>
                  {pl.totalVnd && <div className="cpt-plan-total">{vnd(pl.totalVnd)} / 6 tháng</div>}
                  <ul>{cardBenefits(pl.benefits).map(b => <li key={b}>{b}</li>)}</ul>
                  <span className="cpt-plan-cta" aria-hidden>{plan === pl.key ? '✓ Đã chọn' : 'Chọn gói này'}</span>
                </button>
              ))}
            </div>
            <label>Họ tên<input value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" /></label>
            <label>Email<input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" type="email" autoComplete="email"
              onKeyDown={e => { if (e.key === 'Enter') void submit() }} /></label>
            {err && <div className="cpt-err">{err}</div>}
            <button className="btn btn-primary cpt-submit" disabled={busy} onClick={() => void submit()}>{busy ? 'Đang gửi…' : 'Tiếp tục thanh toán →'}</button>
          </div>
  )

  const open = cohorts ? PUBLIC_ORDER.filter(k => cohorts[k]) : []

  return (
    <section id="lop-tuyen-sinh" className="band cpt">
      <style>{CSS}</style>
      <div className="wrap">
        <h2>Các lớp đang tuyển sinh</h2>
        <p className="lead">Chọn lớp phù hợp với điều bạn muốn chơi Guitar.</p>

        {cohorts === null && <div className="cpt-empty">Đang tải lịch khai giảng…</div>}
        {cohorts !== null && open.length === 0 && (
          <div className="cpt-empty">
            Lịch khai giảng đang được cập nhật.
            <div className="cpt-acts">
              <button className="btn btn-primary" onClick={onMira}>Hỏi Mira →</button>
              <a className="btn btn-ghost" href={zaloUrl} target="_blank" rel="noreferrer">Nhắn Thầy</a>
            </div>
          </div>
        )}

        <div className="cpt-grid">
          {open.map(k => {
            const p = PRODUCTS[k]
            const c = cohorts![k]!
            return [
              <div className={'cpt-step' + (selected === k ? ' on' : '')} id={'sp-' + k} key={k}>
                <div className="cpt-title">{p.title}</div>
                <p>{p.desc}</p>
                <div className="cpt-sched">
                  {c.when && <b>{c.when}</b>}
                  <span>{c.startLabel}</span>
                </div>
                <div className="cpt-acts">
                  <button className="btn btn-primary" onClick={() => onSelect(k)}>Đăng ký lớp →</button>
                </div>
              </div>,
              selected === k ? <div className="cpt-form-row" key={k + '-form'}>{form}</div> : null,
            ]
          })}
        </div>
      </div>
    </section>
  )
}

const CSS = `
.cpt-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px}
.cpt-form-row{grid-column:1/-1}
.cpt-empty{margin-top:18px;background:#fff;border:1px solid #E7E2D8;border-radius:14px;padding:16px;color:#4B5563;font-size:14.5px}
.cpt-empty .cpt-acts{margin-top:10px}
.cpt-step{scroll-margin-top:76px;background:#fff;border:1.5px solid #EEE9DF;border-radius:16px;padding:16px;transition:border-color .15s;display:flex;flex-direction:column}
.cpt-step .cpt-acts{margin-top:auto}
.cpt-step.on{border-color:#4338CA;box-shadow:0 0 0 3px rgba(67,56,202,.12)}
.cpt-title{font-size:18px;font-weight:800;color:#111827}
.cpt-title span{font-weight:600;color:#6B7280;font-size:15px}
.cpt-step p{margin:6px 0 10px;color:#4B5563;font-size:14.5px;line-height:1.55}
.cpt-sched{font-size:13.5px;color:#6B7280;background:#F7F5F0;border-radius:9px;padding:8px 10px;margin-bottom:12px}
.cpt-sched b{color:#111827;display:block}
.cpt-sched span{display:block;margin-top:2px}
.cpt-acts{display:flex;gap:8px;flex-wrap:wrap}
.cpt-acts .btn{text-decoration:none}
.cpt-form{margin:0 auto;max-width:520px;background:#fff;border:1.5px solid #4338CA;border-radius:18px;padding:20px}
.cpt-form-k{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#4338CA}
.cpt-form-t{font-size:19px;font-weight:800;color:#111827;margin-top:4px}
.cpt-form-s{font-size:14.5px;font-weight:600;color:#374151;margin:4px 0 0}
.cpt-form-s2{font-weight:500;color:#6B7280;margin-bottom:14px}
.cpt-form label{display:block;font-size:13px;color:#6B7280;font-weight:600;margin-bottom:12px}
.cpt-form input{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:11px 13px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:16px;background:#F9FAFB;font-family:inherit;color:#111827}
.cpt-err{background:#FEE2E2;color:#B91C1C;border-radius:9px;padding:8px 12px;font-size:13.5px;margin-bottom:12px}
.cpt-submit{width:100%}
.cpt-plan-lead{font-size:14.5px;font-weight:700;color:#111827;margin:0 0 10px}
.cpt-plans{display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:16px}
.cpt-plan{display:block;width:100%;text-align:left;background:#fff;border:1.5px solid #E5E7EB;border-radius:14px;padding:14px;cursor:pointer;font-family:inherit;color:#111827}
.cpt-plan.on{border-color:#4338CA;box-shadow:0 0 0 3px rgba(67,56,202,.12);background:#FAFAFF}
.cpt-plan-name{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#4338CA}
.cpt-plan-price{font-size:22px;font-weight:800;margin-top:4px}
.cpt-plan-price span{font-size:14px;font-weight:600;color:#6B7280;margin-left:2px}
.cpt-plan-total{font-size:13px;color:#6B7280;margin-top:2px}
.cpt-plan ul{margin:10px 0 0;padding:0;list-style:none}
.cpt-plan li{font-size:13.5px;line-height:1.5;padding-left:20px;position:relative;margin-top:3px;color:#374151}
.cpt-plan li::before{content:'✓';position:absolute;left:0;color:#059669;font-weight:800}
.cpt-plan-cta{display:inline-block;margin-top:12px;font-size:13.5px;font-weight:700;color:#4338CA;border:1.5px solid #C7D2FE;border-radius:999px;padding:6px 14px;background:#fff}
.cpt-plan.on .cpt-plan-cta{background:#4338CA;border-color:#4338CA;color:#fff}
.cpt-plan:focus-visible{outline:3px solid #A5B4FC;outline-offset:2px}
.cpt-plan-shared{font-size:13.5px;color:#065F46;background:#ECFDF5;border-radius:9px;padding:8px 10px;margin:0 0 12px}
.cpt-form{scroll-margin-top:76px}
.cpt-err a{color:#B91C1C;font-weight:700}
.cpt-note{font-size:12.5px;color:#9CA3AF;text-align:center;margin-top:10px}
@media (max-width:760px){.cpt-grid{grid-template-columns:1fr}}
`
