import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Route /join-group/<token> — học viên bấm link (gửi trong nhóm Zalo) để tự gán nhóm.
// Đã đăng nhập → gọi claim_group ngay. Chưa → lưu token, đưa sang đăng nhập (sẽ tự gán sau).
export default function JoinGroupPage() {
  const token = decodeURIComponent(
    window.location.pathname.replace(/^\/join-group\//, '').replace(/\/+$/, '').trim()
  )
  const [state, setState] = useState<'loading' | 'ok' | 'need-login' | 'error'>('loading')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    (async () => {
      if (!token) { setState('error'); setMsg('Thiếu mã nhóm trong link.'); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        try { localStorage.setItem('pendingClaimToken', token) } catch { /* bỏ qua */ }
        setState('need-login')
        return
      }
      const { data, error } = await supabase.rpc('claim_group', { p_token: token })
      if (error) { setState('error'); setMsg(error.message); return }
      try { localStorage.removeItem('pendingClaimToken') } catch { /* bỏ qua */ }
      const name = Array.isArray(data) && data[0]?.group_name ? data[0].group_name : 'nhóm'
      setState('ok'); setMsg(name)
    })()
  }, [])

  const T = { bg: '#F0F2F5', header: '#1B6B3A', text: '#1F2A1F', muted: '#5A6B5A' }
  const wrap: React.CSSProperties = {
    minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center',
    fontFamily: '"Segoe UI", Inter, system-ui, sans-serif', color: T.text, gap: 14,
  }
  const primaryBtn: React.CSSProperties = {
    background: T.header, color: '#fff', border: 'none', borderRadius: 12,
    padding: '14px 32px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  }

  if (state === 'loading') return <div style={wrap}><div style={{ fontSize: 40 }}>⏳</div><div style={{ color: T.muted }}>Đang xác nhận nhóm...</div></div>

  if (state === 'need-login') return (
    <div style={wrap}>
      <div style={{ fontSize: 48 }}>🔐</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>Đăng nhập để xác nhận nhóm</div>
      <div style={{ fontSize: 15, color: T.muted, maxWidth: 360, lineHeight: 1.6 }}>
        Bạn cần đăng nhập app TVA Guitar. Sau khi đăng nhập, app sẽ tự ghi nhớ nhóm của bạn.
      </div>
      <button style={primaryBtn} onClick={() => { window.location.href = '/' }}>Đăng nhập →</button>
    </div>
  )

  if (state === 'error') return (
    <div style={wrap}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>Không xác nhận được</div>
      <div style={{ fontSize: 15, color: '#B23A1E', maxWidth: 360, lineHeight: 1.6 }}>{msg}</div>
      <button style={primaryBtn} onClick={() => { window.location.href = '/' }}>Về trang chủ</button>
    </div>
  )

  return (
    <div style={wrap}>
      <div style={{ fontSize: 56 }}>🎉</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>Đã vào nhóm!</div>
      <div style={{ fontSize: 16, color: T.muted }}>Bạn đã được thêm vào <b style={{ color: T.header }}>{msg}</b>.</div>
      <div style={{ fontSize: 14, color: T.muted, maxWidth: 360, lineHeight: 1.6 }}>
        Mở app, vào tab <b>Sống</b> → mục <b>Cộng đồng của bạn</b> để bấm vào nhóm bất cứ lúc nào.
      </div>
      <button style={primaryBtn} onClick={() => { window.location.href = '/' }}>Vào học →</button>
    </div>
  )
}
