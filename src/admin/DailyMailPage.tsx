// DailyMailPage — Quản lý TVA Daily Mail (admin)
// Tạo, sửa, xem trước, theo dõi trạng thái gửi

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
  bg: '#F4F4F5',
  surface: '#FFFFFF',
  accent: '#4F46E5',
  accentLight: '#EEF2FF',
  border: '#E4E4E7',
  text1: '#18181B',
  text2: '#52525B',
  text3: '#A1A1AA',
  red: '#EF4444',
  green: '#22C55E',
  amber: '#F59E0B',
  sidebar: '#18181B',
}

const statusLabel: Record<string, string> = {
  draft: 'Nháp',
  scheduled: 'Đã lên lịch',
  processing: 'Đang gửi...',
  sent: 'Đã gửi xong',
  failed: 'Thất bại',
}

const statusColor: Record<string, string> = {
  draft: S.text3,
  scheduled: S.amber,
  processing: S.accent,
  sent: S.green,
  failed: S.red,
}

export default function DailyMailPage() {
  const [mails, setMails] = useState<DailyMailWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'edit' | 'preview'>('list')

  // Form state
  const [form, setForm] = useState({
    subject: '',
    content: '',
    cta_text: '',
    cta_url: '',
    scheduled_date: '',
    scheduled_time: '08:00',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Load danh sách ──
  const loadMails = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('daily_mail')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(50)

      if (err) throw err

      // Lấy stats cho từng mail
      const mailsWithStats: DailyMailWithStats[] = await Promise.all(
        (data || []).map(async (mail: DailyMail) => {
          const { count: total } = await supabase
            .from('daily_mail_recipient')
            .select('*', { count: 'exact', head: true })
            .eq('daily_mail_id', mail.id)

          const { count: sent } = await supabase
            .from('daily_mail_recipient')
            .select('*', { count: 'exact', head: true })
            .eq('daily_mail_id', mail.id)
            .eq('status', 'sent')

          const { count: failed } = await supabase
            .from('daily_mail_recipient')
            .select('*', { count: 'exact', head: true })
            .eq('daily_mail_id', mail.id)
            .eq('status', 'failed')

          return { ...mail, total_recipients: total || 0, sent_count: sent || 0, failed_count: failed || 0 }
        })
      )

      setMails(mailsWithStats)
    } catch (e: any) {
      console.error('Lỗi load mails:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMails()
    const interval = setInterval(loadMails, 15000) // auto-refresh mỗi 15s
    return () => clearInterval(interval)
  }, [loadMails])

  // ── Reset form ──
  const resetForm = () => {
    // Mặc định: 6h sáng mai
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 10)
    setForm({ subject: '', content: '', cta_text: '', cta_url: '', scheduled_date: dateStr, scheduled_time: '06:00' })
    setError('')
  }

  // ── Chọn mail để sửa ──
  const editMail = (mail: DailyMailWithStats) => {
    const d = new Date(mail.scheduled_at)
    const dateStr = d.toISOString().slice(0, 10)
    const timeStr = d.toTimeString().slice(0, 5)
    setForm({
      subject: mail.subject,
      content: mail.content,
      cta_text: mail.cta_text || '',
      cta_url: mail.cta_url || '',
      scheduled_date: dateStr,
      scheduled_time: timeStr,
    })
    setSelectedId(mail.id)
    setView('edit')
    setError('')
  }

  // ── Create new ──
  const newMail = () => {
    resetForm()
    setSelectedId(null)
    setView('edit')
  }

  // ── Lưu ──
  const saveMail = async (status: 'draft' | 'scheduled') => {
    if (!form.subject.trim()) { setError('Vui lòng nhập tiêu đề'); return }
    if (!form.scheduled_date) { setError('Vui lòng chọn ngày gửi'); return }

    setSaving(true)
    setError('')

    const scheduledAt = new Date(`${form.scheduled_date}T${form.scheduled_time}:00+07:00`).toISOString()

    try {
      const payload = {
        subject: form.subject.trim(),
        content: form.content.trim(),
        cta_text: form.cta_text.trim() || null,
        cta_url: form.cta_url.trim() || null,
        scheduled_at: scheduledAt,
        status,
      }

      if (selectedId) {
        const { error: err } = await supabase.from('daily_mail').update(payload).eq('id', selectedId)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('daily_mail').insert(payload)
        if (err) throw err
      }

      await loadMails()
      setView('list')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Xoá mail ──
  const deleteMail = async (id: string) => {
    if (!confirm('Xoá Daily Mail này? Hành động không thể hoàn tác.')) return
    const { error: err } = await supabase.from('daily_mail').delete().eq('id', id)
    if (err) { setError(err.message); return }
    await loadMails()
  }

  // ── Preview email HTML ──
  const buildPreviewHtml = () => {
    const BASE_URL = window.location.origin
    const ctaBlock = form.cta_text && form.cta_url
      ? `<div style="text-align:center;margin:24px 0">
           <a href="${form.cta_url}" target="_blank" style="display:inline-block;background:#4F46E5;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600">${form.cta_text}</a>
         </div>`
      : ''

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#4F46E5;padding:24px 32px;text-align:center">
  <h1 style="color:#fff;margin:0;font-size:20px">🎸 TVA Guitar</h1>
</td></tr>
<tr><td style="padding:32px">${form.content || '<em style="color:#999">Nội dung email...</em>'}${ctaBlock}</td></tr>
<tr><td style="background:#FAFAFA;padding:16px 32px;border-top:1px solid #E4E4E7">
  <p style="font-size:12px;color:#71717A;margin:0;text-align:center">© TVA Guitar — Học · Tập · Sống cùng Âm nhạc</p>
  <p style="font-size:12px;color:#999;margin-top:16px;text-align:center">
    Bạn nhận email này vì là học viên của TVA Guitar.<br>
    <a href="${BASE_URL}/unsubscribe?token=TOKEN" style="color:#999;text-decoration:underline">Huỷ nhận Daily Mail</a>
  </p>
</td></tr>
</table>
</td></tr>
</table></body></html>`
  }

  // ── Format datetime ──
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // ── Render ──
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: S.bg, fontFamily: '"Inter", system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 28px', background: S.surface, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: S.text1 }}>📧 Daily Mail</div>
          <div style={{ fontSize: 13, color: S.text3, marginTop: 2 }}>Gửi email hàng ngày cho học viên</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {view !== 'list' && (
            <button onClick={() => { setView('list'); resetForm() }}
              style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, color: S.text2, cursor: 'pointer', fontSize: 14 }}>
              ← Danh sách
            </button>
          )}
          {view === 'list' && (
            <button onClick={newMail}
              style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: S.accent, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              + Tạo Daily Mail
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ margin: '12px 28px 0', padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: S.red, fontSize: 13, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          {loading && mails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: S.text3 }}>Đang tải...</div>
          ) : mails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: S.text3 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div>Chưa có Daily Mail nào. Hãy tạo chiến dịch đầu tiên!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mails.map(mail => (
                <div key={mail.id}
                  onClick={() => editMail(mail)}
                  style={{
                    background: S.surface, borderRadius: 12, padding: '16px 20px',
                    border: `1px solid ${S.border}`, cursor: 'pointer',
                    transition: 'box-shadow .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, color: S.text1, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {mail.subject}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: S.text3, flexWrap: 'wrap' }}>
                        <span>🕐 {fmtDate(mail.scheduled_at)}</span>
                        {mail.status === 'sent' && (
                          <span>👥 {mail.total_recipients} người nhận · {mail.sent_count} đã gửi{mail.failed_count ? ` · ${mail.failed_count} lỗi` : ''}</span>
                        )}
                        {mail.status === 'processing' && (
                          <span>⏳ {mail.sent_count || 0}/{mail.total_recipients || '?'} đã gửi</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                        background: `${statusColor[mail.status]}15`,
                        color: statusColor[mail.status],
                        fontSize: 12, fontWeight: 600,
                      }}>
                        {statusLabel[mail.status]}
                      </span>
                      {mail.status === 'draft' && (
                        <button onClick={e => { e.stopPropagation(); deleteMail(mail.id) }}
                          style={{ background: 'none', border: 'none', color: S.red, cursor: 'pointer', fontSize: 13, padding: '4px 8px' }}>
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EDIT VIEW ── */}
      {view === 'edit' && (() => {
        // Payload immutability: khóa chỉnh sửa khi daily_mail không còn là draft
        const editingMail = selectedId ? mails.find(m => m.id === selectedId) : null
        const isLocked = editingMail !== undefined && editingMail !== null && editingMail.status !== 'draft'

        return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          <div style={{ background: S.surface, borderRadius: 12, padding: 24, border: `1px solid ${S.border}`, maxWidth: 700 }}>

            {/* Immutability warning khi đã scheduled/processing/sent */}
            {isLocked && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, fontSize: 13, color: '#C2410C' }}>
                ⚠️ Daily Mail này đang ở trạng thái <strong>{statusLabel[editingMail!.status]}</strong>.
                Nội dung email (subject, content, CTA, from) <strong>không thể thay đổi</strong> sau khi đã lên lịch
                để đảm bảo idempotency khi retry. Tạo bản mới nếu cần chỉnh sửa.
              </div>
            )}

            {/* Tiêu đề */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Tiêu đề email *</label>
              <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                placeholder="Ví dụ: Bài tập hôm nay — Thứ 2, 02/08"
                disabled={isLocked}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }}
                onFocus={e => { if (!isLocked) e.currentTarget.style.borderColor = S.accent }}
                onBlur={e => { e.currentTarget.style.borderColor = S.border }} />
            </div>

            {/* Nội dung */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Nội dung email (HTML)</label>
              <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder="<p>Chào các bạn,</p><p>Hôm nay chúng ta sẽ...</p>"
                disabled={isLocked}
                rows={8}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }}
                onFocus={e => { if (!isLocked) e.currentTarget.style.borderColor = S.accent }}
                onBlur={e => { e.currentTarget.style.borderColor = S.border }} />
            </div>

            {/* CTA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Nút CTA (tuỳ chọn)</label>
                <input value={form.cta_text} onChange={e => setForm({ ...form, cta_text: e.target.value })}
                  placeholder="Bắt đầu tập hôm nay"
                  disabled={isLocked}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }}
                  onFocus={e => { if (!isLocked) e.currentTarget.style.borderColor = S.accent }}
                  onBlur={e => { e.currentTarget.style.borderColor = S.border }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Link CTA</label>
                <input value={form.cta_url} onChange={e => setForm({ ...form, cta_url: e.target.value })}
                  placeholder="https://class.vananhaudio.com/..."
                  disabled={isLocked}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }}
                  onFocus={e => { if (!isLocked) e.currentTarget.style.borderColor = S.accent }}
                  onBlur={e => { e.currentTarget.style.borderColor = S.border }} />
              </div>
            </div>

            {/* Ngày + giờ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Ngày gửi *</label>
                <input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                  disabled={isLocked}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }}
                  onFocus={e => { if (!isLocked) e.currentTarget.style.borderColor = S.accent }}
                  onBlur={e => { e.currentTarget.style.borderColor = S.border }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: 6 }}>Giờ gửi *</label>
                <input type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })}
                  disabled={isLocked}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: isLocked ? 0.6 : 1, background: isLocked ? '#FAFAFA' : '#fff' }}
                  onFocus={e => { if (!isLocked) e.currentTarget.style.borderColor = S.accent }}
                  onBlur={e => { e.currentTarget.style.borderColor = S.border }} />
              </div>
            </div>

            {/* Actions — ẩn nút lưu khi locked */}
            <div style={{ display: 'flex', gap: 8 }}>
              {!isLocked && (
                <>
                  <button onClick={() => saveMail('scheduled')} disabled={saving}
                    style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: S.accent, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Đang lưu...' : selectedId ? '💾 Cập nhật & Lên lịch' : '📅 Lên lịch gửi'}
                  </button>
                  <button onClick={() => saveMail('draft')} disabled={saving}
                    style={{ padding: '10px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, color: S.text2, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14 }}>
                    Lưu nháp
                  </button>
                </>
              )}
              <button onClick={() => setView('preview')}
                style={{ padding: '10px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, color: S.text2, cursor: 'pointer', fontSize: 14, marginLeft: isLocked ? 0 : 'auto' }}>
                👁 Xem trước
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* ── PREVIEW VIEW ── */}
      {view === 'preview' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          <div style={{ marginBottom: 12, fontSize: 14, color: S.text3 }}>
            Xem trước email — <strong>{form.subject || '(chưa có tiêu đề)'}</strong>
          </div>
          <div style={{ background: S.surface, borderRadius: 12, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
            <iframe srcDoc={buildPreviewHtml()}
              style={{ width: '100%', height: 500, border: 'none' }}
              title="Email Preview" />
          </div>
          <button onClick={() => setView('edit')}
            style={{ marginTop: 12, padding: '10px 16px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, color: S.text2, cursor: 'pointer', fontSize: 14 }}>
            ← Quay lại chỉnh sửa
          </button>
        </div>
      )}

    </div>
  )
}
