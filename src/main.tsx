import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './AppRouter.tsx'
import { migrateLegacySession } from './migrateLegacySession'

// Chuyển session localStorage cũ sang cookie SSO TRƯỚC khi mount, để app đọc
// getSession() một lần là ra đúng trạng thái (không nháy "chưa đăng nhập").
void migrateLegacySession().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppRouter />
    </StrictMode>,
  )
})
