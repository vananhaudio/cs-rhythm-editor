/**
 * Email 1 cho lead mô hình lớp mới (note có [plan:monthly|six_month]).
 * Module THUẦN (không gọi DB) để test được: mail-worker nạp dữ liệu rồi truyền vào.
 *
 * Nguồn dữ liệu = đúng nguồn checkout (ClassLandingPage):
 *  - giá/tên gói/quyền lợi: packages CLASS_MONTHLY/CLASS_SIXMONTH (config) + membership_benefits
 *  - lịch: class_schedule (weekday/start_time/duration_minutes), tên chặng: class_stages
 *  - ngân hàng/QR/Zalo: app_config (bank_account_number, bank_account_name, payment_qr…)
 * KHÔNG có bảng giá riêng cho email.
 */

/** Lớp cửa vào (chạy vòng) — khớp PRODUCTS kind 'entry' không legacy trong src/class-content.ts (test chống drift). */
export const ENTRY_PRODUCTS = ['guitar_can_ban_1', 'guitar_can_ban_2']

export type PlanKey = 'monthly' | 'six_month'

export interface PlanPackage {
  name: string
  config: { plan?: string; plan_label?: string; price_vnd?: number; total_vnd?: number; benefits?: string[] }
}
export interface ClassRow {
  code: string | null
  name: string | null
  schedule: string | null
  start_date: string | null
  weekday: number | null
  start_time: string | null
  duration_minutes: number | null
}
export interface StageRow { stage_no: number; public_title: string; starts_on: string | null; ends_on: string | null }

export interface ClassPlanMailInput {
  leadName: string
  className: string | null      // "Tên public · CODE" do checkout ghi
  note: string | null
  plans: PlanPackage[]
  benefitLabels: Record<string, string>
  cls: ClassRow | null
  stages: StageRow[]
  entryClass: boolean           // lớp cửa vào (chạy vòng) — báo ngày vòng kế tiếp
  cfg: Record<string, string>
  todayIso: string
}

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const dmy = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }

export function leadPlan(note: string | null): PlanKey | null {
  const m = (note ?? '').match(/\[plan:(monthly|six_month)\]/)
  return m ? (m[1] as PlanKey) : null
}

/** Số tiền cần chuyển của gói (six_month = trọn 6 tháng). */
export function planAmount(p: PlanPackage): number {
  const price = Number(p.config.price_vnd) || 0
  return p.config.total_vnd ? Number(p.config.total_vnd) : price
}

/** Giống landing: 'Thứ 3 · 19:00–20:30' */
export function classWhen(r: ClassRow | null): string {
  if (!r) return ''
  if (r.weekday === null || r.weekday === undefined || !r.start_time) return r.schedule ?? ''
  const [hh, mm] = r.start_time.split(':').map(Number)
  const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const end = hh * 60 + mm + (r.duration_minutes || 90)
  return `${r.weekday === 0 ? 'Chủ nhật' : `Thứ ${r.weekday + 1}`} · ${hm(hh * 60 + mm)}–${hm(end)}`
}

export function classStart(r: ClassRow | null, stages: StageRow[], entry: boolean, todayIso: string): string {
  if (!r) return ''
  if (entry) {
    const next = stages.find(x => x.starts_on && x.starts_on >= todayIso)?.starts_on
      ?? (r.start_date && r.start_date >= todayIso ? r.start_date : null)
    return next ? `Khai giảng ${dmy(next)}` : ''
  }
  return r.start_date && r.start_date > todayIso ? `Khai giảng ${dmy(r.start_date)}` : ''
}

export function classTitle(className: string | null, cls: ClassRow | null, stages: StageRow[], entry: boolean, todayIso: string): string {
  if (!entry) {
    const cur = stages.find(x => !x.ends_on || x.ends_on >= todayIso) ?? stages[stages.length - 1]
    if (cur?.public_title) return cur.public_title
  }
  const fromLead = (className ?? '').split('·')[0].trim()
  return fromLead || cls?.name || 'Lớp đã đăng ký'
}

/** Link tuyệt đối (email client không hiểu đường dẫn tương đối '/qr…'). */
export function absUrl(u: string | undefined, base: string | undefined): string {
  const v = (u ?? '').trim()
  if (/^https?:\/\//i.test(v)) return v
  const b = (base ?? '').replace(/\/+$/, '')
  return b ? b + '/' + v.replace(/^\/+/, '') : ''
}

export function buildClassPlanEmail(i: ClassPlanMailInput): { subject: string; content: string } {
  const key = leadPlan(i.note)
  const pkg = i.plans.find(p => p.config.plan === key && Number(p.config.price_vnd) > 0)
  if (!key || !pkg) throw new Error(`Không tìm thấy gói ${key ?? '(không có plan)'} trong packages CLASS_*`)
  const price = Number(pkg.config.price_vnd)
  const amount = planAmount(pkg)
  const label = pkg.config.plan_label ?? pkg.name
  const benefits = (pkg.config.benefits ?? []).map(k => i.benefitLabels[k]).filter(Boolean) as string[]

  const title = classTitle(i.className, i.cls, i.stages, i.entryClass, i.todayIso)
  const when = classWhen(i.cls)
  const start = classStart(i.cls, i.stages, i.entryClass, i.todayIso)
  const qrUrl = absUrl(i.cfg['payment_qr'] || '/qr-thanhtoan.png', i.cfg['class_site_url'])
  const zalo = i.cfg['zalo_url'] ?? ''
  const row = (k: string, v: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#5A5470">${k}</td><td style="padding:4px 0;font-weight:700">${esc(v)}</td></tr>`

  const content = `
<p>Chào bạn <b>${esc(i.leadName)}</b>,</p>
<p>Thầy đã nhận được đăng ký của bạn. Thông tin đăng ký:</p>
<div style="background:#F7F5F0;border:1px solid #E4DED4;border-radius:10px;padding:14px 16px;font-size:14.5px;line-height:1.6">
<b style="font-size:16px">${esc(title)}</b><br>
${when ? esc(when) + '<br>' : ''}${start ? esc(start) + '<br>' : ''}
<span style="color:#5A5470">Hình thức học: Online trực tiếp cùng Thầy qua Zoom, mỗi tuần 1 buổi, 90 phút/buổi.</span>
<br><br>
<b>${esc(label)}</b><br>
${fmtVnd(price)}/tháng${pkg.config.total_vnd ? `<br>${fmtVnd(Number(pkg.config.total_vnd))} / 6 tháng` : ''}
${benefits.length ? `<ul style="margin:8px 0 0;padding-left:18px">${benefits.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
</div>
<p style="margin-top:18px"><b>Số tiền cần chuyển: ${fmtVnd(amount)}</b></p>
<table style="border-collapse:collapse;font-size:14px">
${row('Ngân hàng', i.cfg['bank_name'] ?? '')}
${row('Số tài khoản', i.cfg['bank_account_number'] ?? '')}
${row('Chủ tài khoản', i.cfg['bank_account_name'] ?? '')}
${row('Nội dung CK', i.leadName)}
</table>
${qrUrl ? `<p>Hoặc quét mã QR: <a href="${esc(qrUrl)}">xem mã QR thanh toán</a></p>` : ''}
<p>Chuyển khoản xong, gửi bill cho Thầy qua Zalo. Sau khi xác nhận, Thầy sẽ kích hoạt tài khoản và gửi thông tin nhóm/lớp học.</p>
${zalo ? `<p><a href="${esc(zalo)}" style="display:inline-block;background:#0068FF;color:#fff;text-decoration:none;border-radius:8px;padding:10px 18px;font-weight:700">Gửi bill cho Thầy qua Zalo</a></p>` : ''}`
  return { subject: 'Thầy đã nhận được đăng ký của bạn', content }
}
