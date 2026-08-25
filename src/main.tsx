import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './AppRouter.tsx'
import { migrateLegacySession } from './migrateLegacySession'

// ── Fail-safe: KHÔNG BAO GIỜ màn trắng ──────────────────────────────────────
// Crash render (React) hoặc lỗi JS chưa bắt → hiện màn hình lỗi có nút thử lại
// + nội dung lỗi để chẩn đoán từ xa. Auth OK nhưng data lỗi vẫn KHÔNG cấp
// quyền gì thêm (fail closed) — chỉ thay màn trắng bằng UI khôi phục được.
class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    const message = `${this.state.error.name}: ${this.state.error.message}`
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, background: '#F0F2F5', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🎸</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#211C32' }}>Có lỗi khi hiển thị màn hình này</div>
        <div style={{ fontSize: 14, color: '#464160', lineHeight: 1.6, maxWidth: 420 }}>
          Dữ liệu tài khoản của bạn vẫn an toàn. Bấm thử lại — nếu vẫn lỗi, chụp màn hình này gửi thầy.
        </div>
        <button onClick={() => { window.location.href = '/' }}
          style={{ background: '#4338CA', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 26px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          Thử lại
        </button>
        <div style={{ fontSize: 11, color: '#8B87A0', maxWidth: 420, overflowWrap: 'anywhere' }}>{message}</div>
      </div>
    )
  }
}

// Chuyển session localStorage cũ sang cookie SSO TRƯỚC khi mount, để app đọc
// getSession() một lần là ra đúng trạng thái (không nháy "chưa đăng nhập").
void migrateLegacySession().catch(() => { /* không chặn mount vì di trú lỗi */ }).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RootErrorBoundary>
        <AppRouter />
      </RootErrorBoundary>
    </StrictMode>,
  )
})
