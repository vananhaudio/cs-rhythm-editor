/**
 * mail-worker — xử lý hàng đợi email onboarding (Email 1: registration_received,
 * Email 2: learning_access_ready, Email 3: first_session_reminder — template sẵn,
 * CHƯA trigger vì chưa resolve chắc buổi đầu tiên).
 *
 * Reuse hạ tầng mail hiện có: gọi edge function `send-mail` (Resend) nội bộ với
 * service role — KHÔNG tạo mail system song song.
 *
 * Bảo mật: chỉ nhận khi header `x-internal-secret` khớp env MAIL_WORKER_SECRET
 * (pattern daily-mail-scheduler). Không nhận lead/email từ client.
 *
 * Idempotency: chỉ xử lý mail_log.status='queued' qua RPC claim_mail_jobs (atomic);
 * mail_log unique (mail_type, lead_id, attempt) chặn gửi trùng; provider fail →
 * status='failed' + error, business state giữ nguyên, retry/resend được.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WORKER_SECRET = Deno.env.get('MAIL_WORKER_SECRET') ?? ''
const MAIL_SEND_SECRET = Deno.env.get('MAIL_INTERNAL_SECRET') ?? ''   // secret dùng chung để gọi send-mail (đã khóa)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── Helpers ────────────────────────────────────────────────────────────
const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

const PRACTICE_SUM: Record<string, { label: string; line: string; vnd: number }> = {
  '1_month': { label: '1 tháng', line: '499.000đ', vnd: 499000 },
  '6_month': { label: '6 tháng', line: '2.376.000đ (tương đương 396.000đ/tháng)', vnd: 2376000 },
}

const PATH_LABEL: Record<string, string> = {
  dem_hat: 'Đệm hát',
  tia_not: 'Tỉa nốt',
  solo: 'Solo',
}

/** Parse note dạng [reg-mode:practice][practice-duration:6_month][practice-path:dem_hat] */
function parseNote(note: string | null): Record<string, string> {
  const m: Record<string, string> = {}
  for (const mm of (note ?? '').matchAll(/\[([a-z-]+):([^\]]+)\]/g)) m[mm[1]] = mm[2]
  return m
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function getConfig(): Promise<Record<string, string>> {
  const { data } = await supabase.from('app_config').select('key,value')
  const m: Record<string, string> = {}
  for (const r of data ?? []) m[r.key] = r.value ?? ''
  return m
}

/** Lớp thật từ class_name "Tên · CODE" → class_schedule (lịch/giá) */
async function classInfo(className: string | null) {
  if (!className) return null
  const code = (className.match(/·\s*([A-Z0-9.]+)\s*$/) ?? [])[1]
  if (!code) return null
  const { data } = await supabase.from('class_schedule')
    .select('name,code,schedule,start_date,price,status')
    .eq('code', code).maybeSingle()
  return data ?? null
}

const classPriceLabel = (price?: string | null) => {
  if (!price || price === '990k') return '990.000đ'
  if (price === 'Combo') return 'Combo trọn gói'
  if (/miễn phí|free/i.test(price)) return 'Miễn phí'
  return price
}

interface LeadInfo {
  id: number
  name: string
  email: string | null
  class_name: string | null
  note: string | null
  status: string | null
}

interface BuiltMail { subject: string; content: string }

// ─── EMAIL 1 — registration_received ────────────────────────────────────
async function buildEmail1(lead: LeadInfo, cfg: Record<string, string>): Promise<BuiltMail> {
  const note = parseNote(lead.note)
  const mode = note['reg-mode'] ?? 'class'
  const cls = await classInfo(lead.class_name)
  const dur = note['practice-duration'] ?? '1_month'
  const psum = PRACTICE_SUM[dur] ?? PRACTICE_SUM['1_month']
  const pathLabel = note['practice-path'] ? PATH_LABEL[note['practice-path']] ?? note['practice-path'] : null

  const lines: string[] = []
  if (mode === 'class' || mode === 'both') {
    lines.push(`<b>Gói Học theo lớp</b><br>${escapeHtml(lead.class_name ?? '—')}` +
      (cls?.schedule ? `<br>Lịch: ${escapeHtml(cls.schedule)}` : '') +
      `<br>Học phí: ${classPriceLabel(cls?.price)}`)
  }
  if (mode === 'practice' || mode === 'both') {
    lines.push(`<b>Gói Thực hành</b> · ${psum.label}<br>${psum.line}${pathLabel ? `<br>Hướng quan tâm: ${escapeHtml(pathLabel)}` : ''}`)
  }
  let amount = ''
  if (mode === 'class') amount = classPriceLabel(cls?.price)
  if (mode === 'practice') amount = psum.line.split(' ')[0]
  if (mode === 'both') {
    const clsVnd = cls?.price && cls.price !== 'Combo' ? 990000 : null
    amount = clsVnd !== null ? fmtVnd(clsVnd + psum.vnd) : 'theo thông tin Thầy gửi'
  }

  const qrUrl = (cfg['site_url'] ?? '') + (cfg['bank_qr'] ?? '/qr-thanhtoan.png')
  const content = `
<p>Chào anh/chị <b>${escapeHtml(lead.name)}</b>,</p>
<p>Thầy đã nhận được đăng ký của anh/chị. Dưới đây là thông tin đăng ký:</p>
<p style="background:#F7F5F0;border:1px solid #E4DED4;border-radius:10px;padding:14px 16px;">
${lines.join('<br><br>')}
</p>
<p><b>Bước tiếp theo: Hoàn tất học phí</b></p>
<p>Anh/chị chuyển khoản theo thông tin bên dưới (${amount !== '' ? `số tiền <b>${amount}</b>` : 'số tiền theo thông tin Thầy gửi'}):</p>
<table style="border-collapse:collapse;font-size:14px">
<tr><td style="padding:4px 12px 4px 0;color:#5A5470">Ngân hàng</td><td style="padding:4px 0;font-weight:700">${escapeHtml(cfg['bank_name'] ?? '')}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#5A5470">Số tài khoản</td><td style="padding:4px 0;font-weight:700">${escapeHtml(cfg['bank_account'] ?? '')}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#5A5470">Chủ tài khoản</td><td style="padding:4px 0;font-weight:700">${escapeHtml(cfg['bank_owner'] ?? '')}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#5A5470">Nội dung CK</td><td style="padding:4px 0;font-weight:700">${escapeHtml(lead.name)}</td></tr>
</table>
<p>Hoặc quét mã QR: <a href="${qrUrl}">xem mã QR thanh toán</a></p>
<p>Chuyển khoản xong, anh/chị gửi bill cho Thầy qua Zalo để được xác nhận và kích hoạt tài khoản nhanh nhất:</p>
<p><a href="${escapeHtml(cfg['zalo_url'] ?? '')}" style="display:inline-block;background:#0068FF;color:#fff;text-decoration:none;border-radius:8px;padding:10px 18px;font-weight:700">Gửi bill cho Thầy qua Zalo</a></p>
<p style="color:#5A5470;font-size:13px">Từ bây giờ, các hướng dẫn học tập và thông tin quan trọng sẽ được gửi qua email. Anh/chị nhớ kiểm tra email thường xuyên nhé.</p>`
  return { subject: 'Thầy đã nhận được đăng ký của anh/chị', content }
}

// ─── EMAIL 2 — learning_access_ready (START-HERE: "Hôm nay tôi nên làm gì?") ───
interface StartAction { kind: string; title: string; url: string; source: string }

/** Buổi học tiếp theo của lớp (thật từ class_sessions) — null nếu chưa resolve chắc */
async function nextClassSession(className: string | null) {
  if (!className) return null
  const code = (className.match(/·\s*([A-Z0-9.]+)\s*$/) ?? [])[1]
  if (!code) return null
  const { data: cls } = await supabase.from('class_schedule')
    .select('id,name,timezone').eq('code', code).maybeSingle()
  if (!cls) return null
  const { data: sess } = await supabase.from('class_sessions')
    .select('start_at,status,event_type')
    .eq('class_id', cls.id)
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(3)
  const next = (sess ?? []).find(x => x.event_type !== 'break' && x.status !== 'cancelled' && x.status !== 'holiday')
  if (!next) return null
  const d = new Date(next.start_at)
  const fmt = new Intl.DateTimeFormat('vi-VN', { timeZone: cls.timezone || 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', weekday: 'long' })
  const fmtT = new Intl.DateTimeFormat('vi-VN', { timeZone: cls.timezone || 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
  return { name: cls.name, label: `${fmt.format(d)} · ${fmtT.format(d)}` }
}

/** "Hôm nay bắt đầu từ đây" — block action theo mode (resolver deterministic, không AI) */
async function buildStartHere(lead: LeadInfo, cfg: Record<string, string>) {
  const note = parseNote(lead.note)
  const mode = note['reg-mode'] ?? 'class'
  const path = note['practice-path'] ?? ''
  const { data: actions } = await supabase.rpc('resolve_student_start_action', { p_lead: lead.id })
  const acts = (actions ?? []) as StartAction[]
  const homeUrl = cfg['class_site_url'] + '/me'
  const practiceLink = (cfg['class_site_url'] ?? '') + '/class?xem=thuchanh'

  let html = ''
  const block = (title: string, steps: string[], cta: { label: string; url: string }[], extra = '') => `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF0E7;border:1px solid #F5CFB6;border-radius:12px;margin:18px 0"><tr><td style="padding:16px 18px">
<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;color:#EA580C;text-transform:uppercase;margin-bottom:8px">Hôm nay, hãy bắt đầu từ đây</div>
<div style="font-size:16px;font-weight:800;color:#211C32;margin-bottom:8px">${title}</div>
<ol style="margin:0 0 10px;padding-left:18px;color:#5A5470;font-size:14px;line-height:1.7">${steps.map(x => `<li>${x}</li>`).join('')}</ol>
${cta.map(c => `<a href="${c.url}" style="display:inline-block;background:#EA580C;color:#fff;text-decoration:none;border-radius:8px;padding:10px 18px;font-weight:700;margin:2px 6px 2px 0">${c.label}</a>`).join('')}
${extra}
</td></tr></table>`

  if (mode === 'practice') {
    const main = acts.find(a => a.kind === 'practice_path') ?? acts.find(a => a.kind === 'learning_home')
    if (path === 'dem_hat' || path === 'tia_not' || path === 'solo') {
      const pathLabel = PATH_LABEL[path] ?? path
      html += block(`Bắt đầu học ${pathLabel} ngay hôm nay`, [
        'Mở App Thầy Văn Anh Guitar.',
        `Chọn hướng ${pathLabel}.`,
        'Bắt đầu nội dung được hệ thống mở cho bạn.',
        'Học và luyện ít nhất một nội dung đầu tiên.',
        'Sau đó xem Lịch Thực hành và chọn buổi phù hợp.',
      ], main ? [{ label: main.title, url: main.url }] : [])
    } else {
      // unsure — không ép tự chọn hướng
      html += block('Anh/chị chưa cần tự quyết định hướng học ngay', [
        'Hãy đăng nhập hệ thống trước.',
        'Thầy sẽ giúp xác định điểm bắt đầu phù hợp.',
      ], [{ label: 'Mở hệ thống học tập →', url: homeUrl }])
    }
    html += `<p style="color:#5A5470;font-size:14px;line-height:1.7">Anh/chị không cần đợi đến buổi thực hành đầu tiên mới bắt đầu học. Ngay từ hôm nay, anh/chị đã có thể học và luyện tập trên hệ thống. Buổi thực hành là lúc hỏi đáp, sửa bài và luyện sâu hơn những điều đang học.</p>`
    html += `<p><a href="${practiceLink}" style="display:inline-block;background:#211C32;color:#fff;text-decoration:none;border-radius:8px;padding:10px 18px;font-weight:700">Xem lịch thực hành →</a></p>`
    html += `<p style="color:#5A5470;font-size:13.5px">Thầy sẽ giúp anh/chị xác định nhóm Cơ bản / Trung cấp / Nâng cao phù hợp.</p>`
  }

  if (mode === 'class') {
    const main = acts.find(a => a.kind === 'class_prep') ?? acts.find(a => a.kind === 'learning_home')
    const clsName = lead.class_name ?? 'lớp của anh/chị'
    const sess = await nextClassSession(lead.class_name)
    html += block(`Hôm nay, hãy làm 2 việc`, [
      `Đăng nhập hệ thống và làm quen với nội dung của <b>${escapeHtml(clsName)}</b>.`,
      'Xem lịch lớp và chuẩn bị trước cho buổi đầu tiên.',
    ], main ? [{ label: main.title, url: main.url }] : [])
    if (sess) {
      html += `<p style="color:#211C32;font-size:14.5px;font-weight:700">Buổi học tiếp theo:<br><span style="color:#5A5470;font-weight:400">${escapeHtml(sess.name)}</span><br>${escapeHtml(sess.label)}</p>`
    } else {
      html += `<p style="color:#5A5470;font-size:14px">Lịch lớp của anh/chị đã được xác nhận trong hệ thống/nhóm học.</p>`
    }
    html += `<p style="color:#5A5470;font-size:14px;line-height:1.7">Trước buổi đầu tiên, anh/chị hãy làm quen với nội dung đã được mở và ghi lại những chỗ chưa hiểu.</p>`
  }

  if (mode === 'both') {
    const clsAct = acts.find(a => a.kind === 'class_prep')
    const pracAct = acts.find(a => a.kind === 'practice_path' || a.kind === 'learning_home')
    html += block(`Hôm nay, anh/chị có 2 việc`, [
      `<b>Gói Học theo lớp:</b> xem trước nội dung của <b>${escapeHtml(lead.class_name ?? 'lớp')}</b>.`,
      `<b>Gói Thực hành:</b> chọn hướng học trên App và bắt đầu luyện.`,
    ], [
      ...(clsAct ? [{ label: 'Chuẩn bị cho lớp →', url: clsAct.url }] : []),
      ...(pracAct ? [{ label: 'Bắt đầu thực hành →', url: pracAct.url }] : []),
    ])
    html += `<p style="color:#211C32;font-size:14.5px;font-weight:700;line-height:1.7">Học theo lớp để đi lên.<br>Thực hành để đi sâu.</p>`
  }
  return html
}

async function buildEmail2(lead: LeadInfo, cfg: Record<string, string>): Promise<BuiltMail> {
  const note = parseNote(lead.note)
  const mode = note['reg-mode'] ?? 'class'

  const content = `
<p>Chào anh/chị <b>${escapeHtml(lead.name)}</b>,</p>
<p>Đăng ký của anh/chị đã được xác nhận và quyền học đã được kích hoạt.</p>
${await buildStartHere(lead, cfg)}
<p style="background:#F7F5F0;border:1px solid #E4DED4;border-radius:10px;padding:14px 16px;">
<b>Thông tin đăng nhập</b><br>
Tài khoản: <b>${escapeHtml(lead.email ?? 'email đã đăng ký')}</b><br>
Hệ thống: <a href="${escapeHtml(cfg['class_site_url'] ?? '')}">${escapeHtml(cfg['class_site_url'] ?? '')}</a><br>
App: <a href="${escapeHtml(cfg['app_ios_url'] ?? '')}">App Store</a> · <a href="${escapeHtml(cfg['app_android_url'] ?? '')}">Google Play</a><br>
<span style="color:#5A5470;font-size:13px">Mật khẩu đăng nhập được Thầy gửi riêng qua Zalo. Sau khi đăng nhập, anh/chị nên đổi mật khẩu riêng để bảo mật.</span>
</p>
<p style="background:#FDF0E7;border:1px solid #F5CFB6;border-radius:10px;padding:14px 16px;">
<b>Đừng đợi đến buổi đầu tiên mới bắt đầu học.</b><br>
Ngay khi tài khoản được kích hoạt, anh/chị đã có thể vào hệ thống xem bài và luyện tập trước.<br>
Những chỗ chưa hiểu hãy ghi lại để khi gặp Thầy có thể hỏi và sửa trực tiếp.
</p>
<p>Cần hỗ trợ? <a href="${escapeHtml(cfg['zalo_url'] ?? '')}">Nhắn Thầy qua Zalo</a></p>
<p style="color:#5A5470;font-size:13px">Từ bây giờ, các hướng dẫn học tập và thông tin quan trọng sẽ được gửi qua email. Anh/chị nhớ kiểm tra email thường xuyên nhé.</p>`
  return { subject: 'Anh/chị đã có thể bắt đầu học', content }
}

// ─── EMAIL 3 — first_session_reminder (template sẵn — CHƯA trigger: GAP) ─
async function buildEmail3(lead: LeadInfo, cfg: Record<string, string>, sessionInfo: { date: string; time: string; label: string } | null): Promise<BuiltMail> {
  const when = sessionInfo
    ? `${sessionInfo.date} · ${sessionInfo.time}`
    : 'theo lịch đã thông báo'
  const content = `
<p>Chào anh/chị <b>${escapeHtml(lead.name)}</b>,</p>
<p>Buổi học đầu tiên của anh/chị: <b>${escapeHtml(when)}</b></p>
<p>Chuẩn bị trước: vào hệ thống xem nội dung được hướng dẫn, cài App và Zoom sẵn sàng, ghi lại câu hỏi muốn hỏi Thầy.</p>
<p>Cần hỗ trợ? <a href="${escapeHtml(cfg['zalo_url'] ?? '')}">Nhắn Thầy qua Zalo</a></p>`
  return { subject: 'Buổi học đầu tiên của anh/chị sắp diễn ra', content }
}

// ─── Send ───────────────────────────────────────────────────────────────
async function sendViaMailSystem(subject: string, content: string, toEmail: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-mail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}`, 'x-internal-secret': MAIL_SEND_SECRET },
      body: JSON.stringify({ subject, content, recipients: [toEmail] }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: `send-mail ${res.status}: ${j?.error ?? ''}` }
    // send-mail trả HTTP 200 kèm results[] — phải đọc ok từng recipient (Resend reject vẫn 200)
    const results = (j as { results?: { email: string; ok: boolean; error?: string }[] })?.results
    if (!results || results.length === 0) return { ok: false, error: 'send-mail: empty results' }
    const bad = results.find(r => !r.ok)
    if (bad) return { ok: false, error: bad.error ?? 'send-mail: recipient rejected' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.headers.get('x-internal-secret') !== WORKER_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  try {
    const body = await req.json().catch(() => ({})) as { action?: string; leadId?: number; type?: string }
    const cfg = await getConfig()

    // PREVIEW — kiểm tra nội dung template mà KHÔNG gửi (chỉ internal)
    if (body.action === 'preview' && body.leadId && body.type) {
      const { data: lead } = await supabase.from('leads').select('id,name,email,class_name,note,status').eq('id', body.leadId).maybeSingle()
      if (!lead) return new Response(JSON.stringify({ error: 'lead not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
      const mail = body.type === 'learning_access_ready'
        ? await buildEmail2(lead as LeadInfo, cfg)
        : body.type === 'first_session_reminder'
        ? await buildEmail3(lead as LeadInfo, cfg, null)
        : await buildEmail1(lead as LeadInfo, cfg)
      return new Response(JSON.stringify({ subject: mail.subject, content: mail.content }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Xử lý hàng đợi
    const { data: jobs } = await supabase.rpc('claim_mail_jobs', { p_limit: 20 })
    let sent = 0, failed = 0
    for (const job of jobs ?? []) {
      const { data: lead } = await supabase.from('leads').select('id,name,email,class_name,note,status').eq('id', job.lead_id).maybeSingle()
      if (!lead) {
        await supabase.from('mail_log').update({ status: 'failed', error: 'lead missing' }).eq('id', job.id)
        failed++; continue
      }
      if (!lead.email) {
        await supabase.from('mail_log').update({ status: 'failed', error: 'no email on lead' }).eq('id', job.id)
        failed++; continue
      }
      // HARDEN v9: Email 2 chỉ gửi khi entitlement thật đã active (DB guard là chính; đây là lớp 2)
      if (job.mail_type === 'learning_access_ready') {
        const { data: ent } = await supabase.rpc('lead_entitlement_ok', { p_lead: job.lead_id })
        if (ent !== true) {
          await supabase.from('mail_log').update({ status: 'failed', error: 'entitlement not verified (status-only?)' }).eq('id', job.id)
          failed++; continue
        }
      }
      let mail: BuiltMail
      try {
        mail = job.mail_type === 'learning_access_ready'
          ? await buildEmail2(lead as LeadInfo, cfg)
          : job.mail_type === 'first_session_reminder'
          ? await buildEmail3(lead as LeadInfo, cfg, null)
          : await buildEmail1(lead as LeadInfo, cfg)
      } catch (e) {
        await supabase.from('mail_log').update({ status: 'failed', error: 'template: ' + String((e as Error)?.message ?? e) }).eq('id', job.id)
        failed++; continue
      }
      // Audit start-here: lưu resolved action (mail_log metadata — không log token)
      let resolved: Record<string, string> = {}
      if (job.mail_type === 'learning_access_ready') {
        const { data: acts } = await supabase.rpc('resolve_student_start_action', { p_lead: job.lead_id })
        const a = (acts ?? [])[0]
        if (a) resolved = { resolved_start_kind: a.kind, resolved_start_title: a.title, resolved_start_url: a.url }
      }
      const r = await sendViaMailSystem(mail.subject, mail.content, lead.email)
      if (r.ok) {
        await supabase.from('mail_log').update({ status: 'sent', subject: mail.subject, to_email: lead.email, sent_at: new Date().toISOString(), error: null, ...resolved }).eq('id', job.id)
        sent++
      } else {
        await supabase.from('mail_log').update({ status: 'failed', error: r.error, to_email: lead.email }).eq('id', job.id)
        failed++
      }
    }
    return new Response(JSON.stringify({ processed: jobs?.length ?? 0, sent, failed }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
