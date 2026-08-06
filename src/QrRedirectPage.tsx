// ── /qr/<slug> — cầu nối SÁCH GIẤY → APP ─────────────────────────────────────
// Sách "Tỉa Nốt 1" in mã QR trỏ về timming.vananhaudio.com/qr/<slug>.
// Trang này tra bảng `qr_links` (slug → target) rồi chuyển hướng.
// Nhờ vậy SÁCH ĐÃ IN không bao giờ chết link: thầy đổi đích trong DB là xong
// (vd sau này quay video tư thế → UPDATE qr_links SET target='<link video>' WHERE slug='tuthe').
// Bảng qr_links: anon được SELECT (nội dung không PII) — xem db/qr_links_setup.sql.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function QrRedirectPage() {
  const [err, setErr] = useState(false)
  useEffect(() => {
    const slug = window.location.pathname.replace(/^\/qr\/?/, '').replace(/\/$/, '')
    if (!slug) { window.location.replace('/start'); return }
    supabase.from('qr_links').select('target').eq('slug', slug).maybeSingle()
      .then(({ data }) => {
        const target = data?.target
        if (!target) { setErr(true); setTimeout(() => window.location.replace('/start'), 1500); return }
        if (/^https?:\/\//.test(target)) window.location.replace(target)
        else window.location.replace(target.startsWith('/') ? target : '/' + target)
      })
  }, [])
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F0F2F5', fontFamily: 'system-ui, sans-serif', color: '#4338CA', fontSize: 16, fontWeight: 600 }}>
      {err ? 'Không tìm thấy liên kết — đang về trang chủ…' : 'Đang mở nội dung từ sách…'}
    </div>
  )
}
