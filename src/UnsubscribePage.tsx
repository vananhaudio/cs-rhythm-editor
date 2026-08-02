// UnsubscribePage — Trang huỷ nhận Daily Mail
// V2: Dùng token khó đoán (SHA-256) thay vì student_id trực tiếp
// Được gọi từ link trong email: /unsubscribe?token=<token>

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function UnsubscribePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (!token) {
      setStatus('error')
      setMessage('Thiếu mã xác thực. Vui lòng kiểm tra lại link trong email.')
      return
    }

    // Token hợp lệ: 64 ký tự hex (SHA-256)
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setStatus('error')
      setMessage('Mã xác thực không hợp lệ.')
      return
    }

    const doUnsubscribe = async () => {
      try {
        // Gọi RPC SECURITY DEFINER — anon được phép gọi, server verify token
        // RPC tự đọc daily_mail_recipient (qua SECURITY DEFINER, bỏ qua RLS)
        // và cập nhật email_preference
        const { data, error } = await supabase.rpc('unsubscribe_by_token', { p_token: token })

        if (error) {
          setStatus('error')
          setMessage('Không thể huỷ đăng ký. Vui lòng liên hệ Thầy Văn Anh để được hỗ trợ.')
          return
        }

        // data = { success: boolean, error?: string, message?: string }
        const result = data as any
        if (result?.success) {
          setStatus('success')
          setMessage(result.message || 'Bạn đã huỷ nhận Daily Mail thành công.')
        } else {
          setStatus('error')
          setMessage(result?.error || 'Token không hợp lệ hoặc đã hết hạn.')
        }
      } catch {
        setStatus('error')
        setMessage('Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ Thầy Văn Anh.')
      }
    }
    doUnsubscribe()
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F4F4F5',
      fontFamily: '"Inter", system-ui, sans-serif',
      padding: 24,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '40px 32px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        {status === 'loading' && (
          <div style={{ fontSize: 16, color: '#52525B' }}>Đang xử lý...</div>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#18181B', margin: '0 0 8px' }}>Đã huỷ đăng ký</h1>
            <p style={{ fontSize: 15, color: '#52525B', lineHeight: 1.6, margin: 0 }}>{message}</p>
            <p style={{ fontSize: 13, color: '#A1A1AA', marginTop: 12 }}>
              Bạn sẽ không nhận email hàng ngày từ TVA Guitar nữa.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#18181B', margin: '0 0 8px' }}>Có lỗi</h1>
            <p style={{ fontSize: 15, color: '#52525B', lineHeight: 1.6, margin: 0 }}>{message}</p>
          </>
        )}

        <a href="/start"
          style={{
            display: 'inline-block', marginTop: 24,
            padding: '10px 24px', borderRadius: 8,
            background: '#4F46E5', color: '#fff',
            textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>
          🎸 Về trang TVA Guitar
        </a>
      </div>
    </div>
  )
}
