// ─────────────────────────────────────────────────────────────────────────────
// Class Social — cửa chính của học sinh tại class.vananhaudio.com/me.
// Module ĐỘC LẬP: không import gì từ MobileStudentPortal/StudentOnboarding.
// App học hiện tại là một destination (/learn), mở bằng link thường.
// /me là cổng độc lập: chưa đăng nhập → đăng nhập ngay tại /me; đăng xuất → vẫn ở /me.
// KHÔNG tự chuyển sang /start hay /learn. Phiên Supabase dùng chung với trang Class (/).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import './classSocial.css'
import ClassSocialLayout from './ClassSocialLayout'
import { SECTION_PATHS, sameView, viewFromPath, viewPath, type MeView, type SocialSection } from './resolveMeRoute'
import { useClassSession, type ClassIdentity } from './useClassSession'
import { useProfileMediaEditor, type IdentityPatch } from './profile/useProfileMediaEditor'
import { signInWithPassword, signOut } from './profile/profileApi'
import { MeGuestGate, MeNoProfile } from './MeGuest'
import MeHome from './sections/MeHome'
import Friends from './sections/Friends'
import Chat from './sections/Chat'
import ToolsPage from './sections/ToolsPage'
import ProfilePage from './sections/ProfilePage'
import { useFriendRequests } from './friends/useFriendRequests'
import ThreadPage from '../learning-thread/ThreadPage'
import TeacherQueue from '../learning-thread/TeacherQueue'

const TITLES: Record<SocialSection, string> = {
  home: 'Thầy Văn Anh Guitar',
  friends: 'Bạn bè · Thầy Văn Anh Guitar',
  chat: 'Trò chuyện · Thầy Văn Anh Guitar',
  tools: 'Công cụ âm nhạc · Thầy Văn Anh Guitar',
}

function Splash({ text }: { text: string }) {
  return (
    <div className="cs-root">
      <div className="cs-splash" role="status">
        <div><div className="cs-spinner" />{text}</div>
      </div>
    </div>
  )
}

export default function ClassSocialPage({ initialSection }: { initialSection: SocialSection }) {
  const session = useClassSession()
  // /me/u/<id> không phải một "mục" của router → đọc thẳng từ URL lúc mở trang
  const [initialView] = useState<MeView>(() => {
    const v = viewFromPath(window.location.pathname)
    return v.kind === 'section' ? { kind: 'section', section: initialSection } : v
  })
  const [view, setView] = useState<MeView>(initialView)

  // Back/Forward của trình duyệt giữa các mục / trang cá nhân
  useEffect(() => {
    const onPop = () => setView(viewFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Chuẩn hoá /me/<lạ> → /me (không thêm mục lịch sử); /me/u/<id> giữ nguyên
  useEffect(() => {
    const canonical = viewPath(initialView)
    if (window.location.pathname !== canonical) window.history.replaceState(null, '', canonical)
  }, [initialView])

  const signedIn = session.status === 'ready'
  useEffect(() => {
    if (!signedIn) document.title = 'Đăng nhập · ' + TITLES.home
    else if (view.kind === 'section') document.title = TITLES[view.section]
    // trang cá nhân tự đặt tiêu đề theo tên người
  }, [view, signedIn])

  // Khách / vừa đăng xuất: chỉ còn trang chủ /me (mục con + trang cá nhân cần đăng nhập) — không thêm mục lịch sử
  const guest = session.status === 'signed-out' || session.status === 'no-profile'
  // Ngoại lệ: link một learning thread (/me/t/<id>) GIỮ nguyên → đăng nhập xong xem đúng thread (quyền do server quyết).
  const [wasGuest, setWasGuest] = useState(guest)
  if (guest !== wasGuest) {
    setWasGuest(guest)
    if (guest && view.kind !== 'thread') setView({ kind: 'section', section: 'home' })
  }
  const keepThread = view.kind === 'thread'
  useEffect(() => {
    if (guest && !keepThread && window.location.pathname !== SECTION_PATHS.home) window.history.replaceState(null, '', SECTION_PATHS.home)
  }, [guest, keepThread])

  const navigate = (next: MeView) => {
    if (!sameView(view, next)) {
      window.history.pushState(null, '', viewPath(next))
      setView(next)
    }
    window.scrollTo({ top: 0 })
  }
  const go = (section: SocialSection) => navigate({ kind: 'section', section })
  const openProfile = (userId: string) => navigate({ kind: 'profile', userId })
  const openThread = (threadId: string) => navigate({ kind: 'thread', threadId })
  const openQueue = () => navigate({ kind: 'queue' })

  if (session.status === 'signed-out') return <MeGuestGate signIn={signInWithPassword} />
  if (session.status === 'no-profile') return <MeNoProfile email={session.email} onSignOut={() => void signOut()} />
  if (session.status !== 'ready') return <Splash text="Đang mở Class…" />

  return <SignedInShell base={session.me} view={view} onSection={go} onOpenProfile={openProfile} onOpenThread={openThread} onOpenQueue={openQueue} />
}

// Danh tính giữ ở MỘT chỗ: đổi ảnh xong → header, top bar, ô Trả bài, bình luận cập nhật ngay.
function SignedInShell({ base, view, onSection, onOpenProfile, onOpenThread, onOpenQueue }: {
  base: ClassIdentity
  view: MeView
  onSection: (s: SocialSection) => void
  onOpenProfile: (userId: string) => void
  onOpenThread: (threadId: string) => void
  onOpenQueue: () => void
}) {
  const [patch, setPatch] = useState<IdentityPatch>({})
  const [identityRev, setIdentityRev] = useState(0)   // tăng khi đổi ảnh đại diện → feed tải lại avatar mới
  const me = useMemo(() => ({ ...base, ...patch }), [base, patch])
  const onChanged = useCallback((p: IdentityPatch) => {
    setPatch(x => ({ ...x, ...p }))
    if (p.avatarUrl) setIdentityRev(r => r + 1)
  }, [])
  const editor = useProfileMediaEditor(me, onChanged)
  // Đăng xuất → useClassSession nhận SIGNED_OUT → /me về trạng thái khách (không chuyển trang)
  const onSignOut = useCallback(() => { void signOut() }, [])
  const section = view.kind === 'section' ? view.section : null
  // Lời mời kết bạn đến mình: MỘT nguồn cho badge menu + khối Home + trang Bạn bè
  const requests = useFriendRequests()

  return (
    <ClassSocialLayout me={me} section={section} onSection={onSection} onOpenMyProfile={() => onOpenProfile(me.userId)}
      badges={{ friends: requests.count }}
      canEditAvatar={editor.canEditAvatar} onEditMedia={editor.pick} onSignOut={onSignOut}>
      {view.kind === 'profile' && (
        <ProfilePage key={view.userId} me={me} userId={view.userId} identityRev={identityRev} canEditAvatar={editor.canEditAvatar}
          onEditMedia={editor.pick} onSection={onSection} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread} />
      )}
      {view.kind === 'thread' && (
        <ThreadPage key={view.threadId} threadId={view.threadId} isTeacher={me.isTeacher} onBack={() => onSection('home')}
          onOpenQueue={onOpenQueue} onOpenProfile={onOpenProfile} />
      )}
      {view.kind === 'queue' && (me.isTeacher
        ? <TeacherQueue onOpenThread={onOpenThread} onBack={() => onSection('home')} />
        : <div className="cs-col cs-home"><div className="cs-card lt-empty">Mục này dành cho giáo viên.</div></div>)}
      {section === 'home' && <MeHome me={me} identityRev={identityRev} canEditAvatar={editor.canEditAvatar} onEditMedia={editor.pick}
        onOpenProfile={onOpenProfile} requests={requests} onSeeAllRequests={() => onSection('friends')}
        onOpenThread={onOpenThread} onOpenQueue={onOpenQueue} />}
      {section === 'friends' && <Friends requests={requests} onOpenProfile={onOpenProfile} />}
      {section === 'chat' && <Chat />}
      {section === 'tools' && <ToolsPage />}
      {editor.element}
    </ClassSocialLayout>
  )
}
