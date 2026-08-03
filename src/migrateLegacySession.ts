import { supabase, SUPABASE_URL } from './supabase'

// DI TRÚ MỘT LẦN: session cũ nằm trong localStorage (client createClient cũ).
// Khi chuyển sang cookie domain cha, nếu không di trú thì CẢ CỘNG ĐỒNG bị đăng
// xuất một lần. Hàm này đọc session cũ → setSession() (client mới ghi vào
// cookie) → xoá key localStorage cũ. Chạy trước khi mount app.
//
// Sau vài tuần, khi mọi người đã mở lại app ít nhất một lần, có thể gỡ bỏ file
// này và lời gọi trong main.tsx.
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
const LEGACY_KEY = `sb-${PROJECT_REF}-auth-token`

export async function migrateLegacySession(): Promise<void> {
  if (typeof window === 'undefined') return

  // Đã có phiên (từ cookie, kể cả cookie do shop ghi) → không cần di trú.
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    try { window.localStorage.removeItem(LEGACY_KEY) } catch { /* bỏ qua */ }
    return
  }

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(LEGACY_KEY)
  } catch {
    return // trình duyệt chặn localStorage → bỏ qua
  }
  if (!raw) return

  try {
    // Đỡ cả 2 định dạng Supabase từng dùng: { currentSession: {...} } và phẳng.
    const parsed = JSON.parse(raw)
    const session = parsed?.currentSession ?? parsed
    const access_token = session?.access_token
    const refresh_token = session?.refresh_token
    if (!access_token || !refresh_token) return

    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (!error) window.localStorage.removeItem(LEGACY_KEY)
  } catch {
    // token cũ hỏng/hết hạn → kệ, người dùng đăng nhập lại bình thường.
  }
}
