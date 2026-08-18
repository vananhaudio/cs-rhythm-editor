// DailyMailPage — Quản lý TVA Daily Mail (admin)
// Tạo, sửa, xem trước, theo dõi trạng thái gửi
// V5: TEST AUDIENCE SAFETY — backend-enforced, fail closed

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

// ── Types ──
interface DailyMail {
  id: string
  subject: string
  content: string
  cta_text: string | null
  cta_url: string | null
  scheduled_at: string
  status: 'draft' | 'scheduled' | 'processing' | 'sent' | 'failed'
  audience_type: 'test' | 'all_active'
  test_emails: string[]
  created_at: string
  updated_at: string
}

interface DailyMailWithStats extends DailyMail {
  total_recipients?: number
  sent_count?: number
  failed_count?: number
}

// ── Styles ──
const S = {
  bg: '#F4F4F5', surface: '#FFFFFF', accent: '#2D6A4F', accentLight: '#E9F3EC',
  border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  red: '#EF4444', green: '#22C55E', amber: '#F59E0B',
}

const statusLabel: Record<string, string> = {
  draft: 'Nháp', scheduled: 'Đã lên lịch', processing: 'Đang gửi...', sent: 'Đã gửi xong', failed: 'Thất bại',
}
const statusColor: Record<string, string> = {
  draft: S.text3, scheduled: S.amber, processing: S.accent, sent: S.green, failed: S.red,
}

export default function DailyMailPage() {
  const [mails, setMails] = useState<DailyMailWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'edit' | 'preview'>('list')

  const [form, setForm] = useState({
    subject: '', content: '', cta_text: '', cta_url: '',
    scheduled_date: '', scheduled_time: '06:00',
    audience_type: 'test' as 'test' | 'all_active',
    test_emails: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null)

  // ── Đếm số người nhận dự kiến ──
  const estimateRecipients = useCallback(async () => {
    if (form.audience_type === 'test') {
      const count = form.test_emails.split(/[\n,]+/).map(e => e.trim()).filter(e => e && e.includes('@')).length
      setEstimatedCount(count)
    } else {
      // all_active: query đếm học sinh active
      try {
        const { count } = await supabase
          .from('edu_students')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .not('email', 'is', null)
          .neq('email', '')
        setEstimatedCount(count || 0)
      } catch { setEstimatedCount(null) }
    }
  }, [form.audience_type, form.test_emails])

  useEffect(() => {
    const t = setTimeout(estimateRecipients, 300)
    return () => clearTimeout(t)
  }, [estimateRecipients])

  // ── Load danh sách ──
  const loadMails = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase.from('daily_mail').select('*').order('scheduled_at', { ascending: false }).limit(50)
      if (err) throw err
      const mailsWithStats: DailyMailWithStats[] = await Promise.all((data || []).map(async (mail: DailyMail) => {
        const { count: total } = await supabase.from('daily_mail_recipient').select('*', { count: 'exact', head: true }).eq('daily_mail_id', mail.id)
        const { count: sent } = await supabase.from('daily_mail_recipient').select('*', { count: 'exact', head: true }).eq('daily_mail_id', mail.id).eq('status', 'sent')
        const { count: failed } = await supabase.from('daily_mail_recipient').select('*', { count: 'exact', head: true }).eq('daily_mail_id', mail.id).eq('status', 'failed')
        return { ...mail, total_recipients: total || 0, sent_count: sent || 0, failed_count: failed || 0 }
      }))
      setMails(mailsWithStats)
    } catch (e: any) { console.error('Lỗi load mails:', e); setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadMails(); const interval = setInterval(loadMails, 15000); return () => clearInterval(interval) }, [loadMails])

  const resetForm = () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 10)
    setForm({ subject: '', content: '', cta_text: '', cta_url: '', scheduled_date: dateStr, scheduled_time: '06:00', audience_type: 'test', test_emails: '' })
    setError(''); setEstimatedCount(0)
  }

  const editMail = (mail: DailyMailWithStats) => {
    const d = new Date(mail.scheduled_at)
    setForm({
      subject: mail.subject, content: mail.content, cta_text: mail.cta_text || '', cta_url: mail.cta_url || '',
      scheduled_date: d.toISOString().slice(0, 10), scheduled_time: d.toTimeString().slice(0, 5),
      audience_type: mail.audience_type || 'test', test_emails: (mail.test_emails || []).join('\n'),
    })
    setSelectedId(mail.id); setView('edit'); setError('')
  }

  const newMail = () => { resetForm(); setSelectedId(null); setView('edit') }

  const saveMail = async (status: 'draft' | 'scheduled') => {
    if (!form.subject.trim()) { setError('Vui lòng nhập tiêu đề'); return }
    if (!form.scheduled_date) { setError('Vui lòng chọn ngày gửi'); return }

    const testEmails = form.test_emails.split(/[\n,]+/).map(e => e.trim()).filter(e => e && e.includes('@'))

    if (form.audience_type === 'test') {
      if (testEmails.length === 0) { setError('🧪 TEST mode: nhập ít nhất 1 email'); return }
      if (testEmails.length > 10) { setError('🧪 TEST mode: tối đa 10 email'); return }
      const invalid = testEmails.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      if (invalid.length > 0) { setError(`Email không hợp lệ: ${invalid.join(', ')}`); return }
    }

    if (form.audience_type === 'all_active' && status === 'scheduled') {
      if (!confirm(`⚠️  Gửi tới TOÀN BỘ học sinh đang active (~${estimatedCount ?? '?'} người).\n\nXác nhận?`)) return
    }

    setSaving(true); setError('')
    const scheduledAt = new Date(`${form.scheduled_date}T${form.scheduled_time}:00+07:00`).toISOString()
    try {
      const payload: any = {
        subject: form.subject.trim(), content: form.content.trim(),
        cta_text: form.cta_text.trim() || null, cta_url: form.cta_url.trim() || null,
        scheduled_at: scheduledAt, status,
        audience_type: form.audience_type,
        test_emails: form.audience_type === 'test' ? testEmails : [],
      }
      if (selectedId) {
        const { error: err } = await supabase.from('daily_mail').update(payload).eq('id', selectedId)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('daily_mail').insert(payload)
        if (err) throw err
      }
      await loadMails(); setView('list')
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const deleteMail = async (id: string) => {
    if (!confirm('Xoá Daily Mail này?')) return
    const { error: err } = await supabase.from('daily_mail').delete().eq('id', id)
    if (err) { setError(err.message); return }
    await loadMails()
  }

  const buildPreviewHtml = () => {
    const BASE_URL = window.location.origin
    const ctaBlock = form.cta_text && form.cta_url
      ? `<div style="text-align:center;margin:24px 0"><a href="${form.cta_url}" target="_blank" style="display:inline-block;background:#2D6A4F;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600">${form.cta_text}</a></div>` : ''
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:24px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:#2D6A4F;padding:24px 32px;text-align:center"><h1 style="color:#fff;margin:0;font-size:20px">🎸 TVA Guitar</h1></td></tr><tr><td style="padding:32px">${form.content || '<em style="color:#999">Nội dung email...</em>'}${ctaBlock}</td></tr><tr><td style="background:#FAFAFA;padding:16px 32px;border-top:1px solid #E4E4E7"><p style="font-size:12px;color:#71717A;margin:0;text-align:center">© TVA Guitar — Học · Tập · Sống cùng Âm nhạc</p><p style="font-size:12px;color:#999;margin-top:16px;text-align:center">Bạn nhận email này vì là học viên của TVA Guitar.<br><a href="${BASE_URL}/unsubscribe?token=***" style="color:#999;text-decoration:underline">Huỷ nhận Daily Mail</a></p></td></tr></table></td></tr></table></body></html>`
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (<div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: S.bg, fontFamily: '"Inter", system-ui, sans-serif' }}>

    {/* ── Header ── */}
    <div style={{ padding: '20px 28px', background: S.surface, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      <div><div style={{ fontSize: 20, fontWeight: 700, color: S.text1 }}>📧 Daily Mail</div><div style={{ fontSize: 13, color: S.text3, marginTop: 2 }}>Gửi email hàng ngày cho học viên</div></div>
      <div style={{ display: 'flex', gap: 8 }}>
        {view !== 'list' && <button onClick={() => { setView('list'); resetForm() }} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, color: S.text2, cursor: 'pointer', fontSize: 14 }}>← Danh sách</button>}
        {view === 'list' && <button onClick={newMail} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: S.accent, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>+ Tạo Daily Mail</button>}
      </div>
    </div>

    {error && <div style={{ margin: '12px 28px 0', padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: S.red, fontSize: 13, flexShrink: 0 }}>{error}</div>}

    {/* ── LIST ── */}
    {view === 'list' && (<div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
      {loading && mails.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: S.text3 }}>Đang tải...</div>
        : mails.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: S.text3 }}><div style={{ fontSize: 40, marginBottom: 12 }}>📭</div><div>Chưa có Daily Mail nào.</div></div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mails.map(mail => (<div key={mail.id} onClick={() => editMail(mail)}
              style={{ background: S.surface, borderRadius: 12, padding: '16px 20px', border: `1px solid ${S.border}`, cursor: 'pointer', transition: 'box-shadow .15s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }} onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: S.text1, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mail.subject}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: S.text3, flexWrap: 'wrap' }}>
                    <span>🕐 {fmtDate(mail.scheduled_at)}</span>
                    <span style={{ color: mail.audience_type === 'test' ? S.accent : S.green, fontWeight: 600 }}>
                      {mail.audience_type === 'test' ? '🧪 TEST' : '📢 ALL'}
                    </span>
                    {mail.status === 'sent' && <span>👥 {mail.total_recipients} người nhận · {mail.sent_count} đã gửi{mail.failed_count ? ` · ${mail.failed_count} lỗi` : ''}</span>}
                    {mail.status === 'processing' && <span>⏳ {mail.sent_count || 0}/{mail.total_recipients || '?'} đã gửi</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: `${statusColor[mail.status]}15`, color: statusColor[mail.status], fontSize: 12, fontWeight: 600 }}>{statusLabel[mail.status]}</span>
                  {mail.status === 'draft' && <button onClick={e => { e.stopPropagation(); deleteMail(mail.id) }} style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 13, padding: '4px 8px' }}>🗑</button>}
                </div>
              </div>
            </div>))}
          </div>}
    </div>)}

    {/* ── EDIT ── */}
    {view === 'edit' && (() => {
      const editingMail = selectedId ? mails.find(m => m.id === selectedId) : null
      const isLocked = editingMail !== undefined && editingMail !== null && editingMail.status !== 'draft'
      return (<div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        <div style={{ background: S.surface, borderRadius: 12, padding: 24, border: `1px solid ${S.border}`, maxWidth: 700 }}>

          {isLocked && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, fontSize: 13, color: '#C2410C' }}>
            ⚠️ Trạng thái <strong>{statusLabel[editingMail!.status]}</strong> — nội dung không thể thay đổi để đảm bảo idempotency.
          </div>}

          {/* ── AUDIENCE SELECTOR ── */}
          <div style={{ marginBottom: 20, padding: 16, background: '#FAFAFA', borderRadius: 8, border: `1px solid ${S.border}` }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 10 }}>👥 Đối tượng nhận</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => { if (!isLocked) setForm({ ...form, audience_type: 'test' }) }}
                disabled={isLocked}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: form.audience_type === 'test' ? `2px solid ${S.accent}` : `1px solid ${S.border}`, background: form.audience_type === 'test' ? S.accentLight : S.surface, color: form.audience_type === 'test' ? S.accent : S.text2, cursor: isLocked ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: form.audience_type === 'test' ? 600 : 400, opacity: isLocked ? 0.6 : 1 }}>
                🧪 TEST<br/><span style={{ fontSize: 11, fontWeight: 400 }}>Email whitelist (max 10)</span>
              </button>
              <button onClick={() => { if (!isLocked) { if (confirm('⚠️  Chuyển sang ALL ACTIVE — sẽ gửi tới toàn bộ học sinh đang active.\n\nXác nhận?')) setForm({ ...form, audience_type: 'all_active' }) } }}
                disabled={isLocked}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: form.audience_type === 'all_active' ? `2px solid ${S.green}` : `1px solid ${S.border}`, background: form.audience_type === 'all_active' ? '#F0FDF4' : S.surface, color: form.audience_type === 'all_active' ? '#166534' : S.text2, cursor: isLocked ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: form.audience_type === 'all_active' ? 600 : 400, opacity: isLocked ? 0.6 : 1 }}>
                📢 ALL ACTIVE<br/><span style={{ fontSize: 11, fontWeight: 400 }}>Toàn bộ học sinh active</span>
              </button>
            </div>

            {/* Test emails input */}
            {form.audience_type === 'test' && <div style={{ marginBottom: 8 }}>
              <textarea value={form.test_emails} onChange={e => setForm({ ...form, test_emails: e.target.value })}
                disabled={isLocked}
                placeholder="Nhập email test, mỗi dòng 1 email&#10;VD:&#10;thay@vananhaudio.com&#10;test@gmail.com"
                rows={4}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }} />
            </div>}

            {/* Recipient count preview */}
            <div style={{ fontSize: 13, color: estimatedCount !== null ? S.text2 : S.text3 }}>
              📊 Số người sẽ nhận: <strong style={{ color: form.audience_type === 'test' ? S.accent : S.green }}>
                {estimatedCount !== null ? estimatedCount : '...'}
              </strong>
              {form.audience_type === 'test' && estimatedCount !== null && estimatedCount > 10 && <span style={{ color: S.red }}> ⚠️ Vượt quá giới hạn 10!</span>}
              {form.audience_type === 'test' && estimatedCount === 0 && <span style={{ color: S.text3 }}> (chưa nhập email)</span>}
            </div>
          </div>

          {/* Tiêu đề */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Tiêu đề email *</label>
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} disabled={isLocked}
              placeholder="Ví dụ: Bài tập hôm nay — Thứ 2, 02/08"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }} />
          </div>

          {/* Nội dung */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Nội dung email (HTML)</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} disabled={isLocked}
              placeholder="<p>Chào các bạn,</p><p>Hôm nay chúng ta sẽ...</p>" rows={8}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }} />
          </div>

          {/* CTA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Nút CTA (tuỳ chọn)</label>
              <input value={form.cta_text} onChange={e => setForm({ ...form, cta_text: e.target.value })} disabled={isLocked}
                placeholder="Bắt đầu tập hôm nay"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }} /></div>
            <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Link CTA</label>
              <input value={form.cta_url} onChange={e => setForm({ ...form, cta_url: e.target.value })} disabled={isLocked}
                placeholder="https://class.vananhaudio.com/..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }} /></div>
          </div>

          {/* Ngày + giờ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Ngày gửi *</label>
              <input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} disabled={isLocked}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }} /></div>
            <div><label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Giờ gửi *</label>
              <input type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })} disabled={isLocked}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }} /></div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            {!isLocked && (<>
              <button onClick={() => saveMail('scheduled')} disabled={saving}
                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: S.accent, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Đang lưu...' : selectedId ? '💾 Cập nhật & Lên lịch' : '📅 Lên lịch gửi'}
              </button>
              <button onClick={() => saveMail('draft')} disabled={saving}
                style={{ padding: '10px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, color: S.text2, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14 }}>Lưu nháp</button>
            </>)}
            <button onClick={() => setView('preview')}
              style={{ padding: '10px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, color: S.text2, cursor: 'pointer', fontSize: 14, marginLeft: isLocked ? 0 : 'auto' }}>👁 Xem trước</button>
          </div>
        </div>
      </div>)
    })()}

    {/* ── PREVIEW ── */}
    {view === 'preview' && (<div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
      <div style={{ marginBottom: 12, fontSize: 14, color: S.text3 }}>Xem trước — <strong>{form.subject || '(chưa có tiêu đề)'}</strong></div>
      <div style={{ background: S.surface, borderRadius: 12, border: `1px solid ${S.border}`, overflow: 'hidden' }}><iframe srcDoc={buildPreviewHtml()} style={{ width: '100%', height: 500, border: 'none' }} title="Email Preview" /></div>
      <button onClick={() => setView('edit')} style={{ marginTop: 12, padding: '10px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, color: S.text2, cursor: 'pointer', fontSize: 14 }}>← Quay lại chỉnh sửa</button>
    </div>)}
  </div>)
}