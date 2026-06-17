import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

export default function DeleteAccountPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  const handleDeleteAccount = async () => {
    if (!confirm('Bạn chắc chắn muốn xóa tài khoản? Hành động này không thể hoàn tác.')) {
      return
    }

    setDeleting(true)
    setError('')

    try {
      const { error: rpcError } = await supabase.rpc('delete_my_account')
      if (rpcError) {
        setError(rpcError.message || 'Lỗi khi xóa tài khoản')
        return
      }

      setSuccess(true)
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } catch (err: any) {
      setError(err?.message || 'Lỗi không xác định')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F4F4F5',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div>Đang tải...</div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F4F4F5',
      padding: 24,
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        padding: 32,
        maxWidth: 500,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1F2937', margin: '0 0 16px 0' }}>
          Xóa tài khoản
        </h1>

        {user ? (
          <>
            <p style={{ color: '#6B7280', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
              Bạn sắp xóa tài khoản: <strong>{user.email}</strong>
            </p>

            <div style={{
              background: '#FEF3C7',
              border: '1px solid #FCD34D',
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
              textAlign: 'left',
              fontSize: 14,
              color: '#92400E',
            }}>
              <strong>⚠️ Cảnh báo:</strong> Hành động này sẽ:
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 24 }}>
                <li>Xóa tài khoản đăng nhập</li>
                <li>Xóa tất cả dữ liệu học tập</li>
                <li>Không thể hoàn tác</li>
              </ul>
            </div>

            {error && (
              <div style={{
                background: '#FEE2E2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: 12,
                color: '#DC2626',
                fontSize: 14,
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            {success ? (
              <div style={{
                background: '#D1FAE5',
                border: '1px solid #86EFAC',
                borderRadius: 8,
                padding: 12,
                color: '#047857',
                fontSize: 14,
                marginBottom: 16,
              }}>
                ✓ Tài khoản đã xóa thành công. Đang chuyển hướng...
              </div>
            ) : (
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  background: '#DC2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                  width: '100%',
                }}
              >
                {deleting ? 'Đang xóa...' : 'Xóa tài khoản vĩnh viễn'}
              </button>
            )}

            <button
              onClick={() => window.history.back()}
              disabled={deleting}
              style={{
                background: 'none',
                border: '1px solid #D1D5DB',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 15,
                cursor: 'pointer',
                marginTop: 12,
                width: '100%',
                color: '#6B7280',
              }}
            >
              Quay lại
            </button>
          </>
        ) : (
          <>
            <p style={{ color: '#6B7280', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
              Bạn chưa đăng nhập. Để xóa tài khoản, vui lòng gửi email tới:
            </p>

            <div style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
              textAlign: 'center',
            }}>
              <strong style={{ color: '#1E40AF' }}>vananhaudio@gmail.com</strong>
              <p style={{ fontSize: 13, color: '#3730A3', margin: '8px 0 0 0' }}>
                Tiêu đề: "Delete my account"<br />
                Kèm email tài khoản của bạn
              </p>
            </div>

            <button
              onClick={() => window.location.href = '/'}
              style={{
                background: '#4F46E5',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Quay về trang chủ
            </button>
          </>
        )}
      </div>
    </div>
  )
}
