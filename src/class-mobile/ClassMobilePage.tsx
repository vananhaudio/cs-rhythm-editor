// Class Mobile V1 — cổng vào khung ứng dụng 5 tab (Trang chủ · Lớp Học · Ban Nhạc · Trò chuyện · Tôi).
// Phiên đăng nhập + danh tính: dùng CHUNG useClassSession / Supabase Auth hiện có (không đổi kiến trúc đăng nhập).
// Chưa đăng nhập → màn đăng nhập hiện có của Class (MeGuestGate). Không tạo tài khoản, không ghi dữ liệu ở bước khởi tạo.
import '../class-social/classSocial.css'
import '../thuvien/RhythmScroll.css'
import '../band/band.css'
import './classMobile.css'
import './classMobileLight.css'
import { useEffect } from 'react'
import { useClassSession } from '../class-social/useClassSession'
import { signInWithPassword, signOut } from '../class-social/profile/profileApi'
import { MeGuestGate, MeNoProfile } from '../class-social/MeGuest'
import MobileShell from './MobileShell'
import CommunityRulesGate from '../class-safety/CommunityRulesGate'

export default function ClassMobilePage() {
  const session = useClassSession()
  useEffect(() => { document.title = 'Class' }, [])

  if (session.status === 'signed-out') return <MeGuestGate signIn={signInWithPassword} />
  if (session.status === 'no-profile') return <MeNoProfile email={session.email} onSignOut={() => void signOut()} />
  if (session.status !== 'ready') {
    return <div className="cs-root"><div className="cm-splash" role="status"><div><div className="cs-spinner" />Đang mở Class…</div></div></div>
  }
  return <CommunityRulesGate onSignOut={() => void signOut()}><MobileShell base={session.me} /></CommunityRulesGate>
}
