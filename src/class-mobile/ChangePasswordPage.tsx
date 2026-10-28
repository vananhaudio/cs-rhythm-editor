// Đổi mật khẩu (Tôi → Tài khoản & cài đặt) — ngay trong khung Class Mobile, không mở App học cũ.
// Cùng nghiệp vụ như ô "Đổi mật khẩu" của App học (MobileStudentPortal): supabase.auth.updateUser, tối thiểu 6 ký tự, không cần email.
import { useState } from 'react'
import { supabase } from '../supabase'

export const MIN_PASSWORD = 6

export default function ChangePasswordPage() {
  const [draft, setDraft] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const ok = msg.startsWith('✓')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = draft.trim()
    if (v.length < MIN_PASSWORD) { setMsg(`Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự`); return }
    setSaving(true); setMsg('')
    const { error } = await supabase.auth.updateUser({ password: v })
    setSaving(false)
    if (error) { setMsg('Lỗi: ' + error.message); return }
    setDraft(''); setMsg('✓ Đã đổi mật khẩu thành công')
  }
  return (
    <div className="cm-page">
      <h1 className="cm-title">Đổi mật khẩu</h1>
      <p className="cm-note" style={{ marginTop: 0 }}>Nhập mật khẩu mới. Không cần email xác nhận.</p>
      <form onSubmit={e => void submit(e)} style={{ display: 'grid', gap: 12 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} type="password" autoComplete="new-password"
          aria-label="Mật khẩu mới" placeholder={`Mật khẩu mới (ít nhất ${MIN_PASSWORD} ký tự)`}
          style={{ minHeight: 48, padding: '0 14px', borderRadius: 12, border: '1px solid var(--cs-border, #e5e7eb)', fontSize: 16, fontFamily: 'inherit', background: 'var(--cs-surface, #fff)' }} />
        <button type="submit" className="cm-btn is-block" disabled={saving || draft.trim().length < MIN_PASSWORD} style={{ opacity: saving || draft.trim().length < MIN_PASSWORD ? 0.5 : 1 }}>
          {saving ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </button>
        {msg && <div role={ok ? 'status' : 'alert'} style={{ fontSize: 14, color: ok ? '#16A34A' : '#E53E3E' }}>{msg}</div>}
      </form>
    </div>
  )
}
