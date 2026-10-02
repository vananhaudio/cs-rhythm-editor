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
import { SECTION_PATHS, keepsPathForGuest, sameView, viewFromPath, viewPath, type MeView, type SocialSection } from './resolveMeRoute'
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
import { useSocialClasses } from './classes/useSocialClasses'
import ClassNav from './classes/ClassNav'
import ClassesPage from './classes/ClassesPage'
import ClassPage from './classes/ClassPage'
import ClassSessionPage from './classes/ClassSessionPage'
import ProfileEditDialog from './profile/ProfileEditDialog'

const TITLES: Record<SocialSection, string> = {
  home: 'Trang chủ · Thầy Văn Anh Guitar',
  friends: 'Bạn bè · Thầy Văn Anh Guitar',
  chat: 'Trò chuyện · Thầy Văn Anh Guitar',
  tools: 'Công cụ âm nhạc · Thầy Văn Anh Guitar',
}

const IN_APP_STATE = { cs: 1 }
const HOME: MeView = { kind: 'section', section: 'home' }

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
  // Mỗi lần điều hướng (kể cả Back/Forward) = một lượt vào màn mới → Home mount lại, đọc ?feed= từ URL hiện tại
  const [visit, setVisit] = useState(0)

  // Back/Forward của trình duyệt giữa các mục / trang cá nhân
  useEffect(() => {
    const onPop = () => { setView(viewFromPath(window.location.pathname)); setVisit(v => v + 1) }
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
    if (!signedIn) document.title = 'Đăng nhập · Thầy Văn Anh Guitar'
    else if (view.kind === 'section') document.title = TITLES[view.section]
    else if (view.kind === 'classes') document.title = 'Lớp học · Thầy Văn Anh Guitar'
    // trang cá nhân tự đặt tiêu đề theo tên người
  }, [view, signedIn])

  // Khách / vừa đăng xuất: chỉ còn trang chủ /me (mục con + trang cá nhân cần đăng nhập) — không thêm mục lịch sử
  const guest = session.status === 'signed-out' || session.status === 'no-profile'
  // Ngoại lệ: link một learning thread (/me/t/<id>) GIỮ nguyên → đăng nhập xong xem đúng thread (quyền do server quyết).
  const [wasGuest, setWasGuest] = useState(guest)
  if (guest !== wasGuest) {
    setWasGuest(guest)
    if (guest && !keepsPathForGuest(view)) setView({ kind: 'section', section: 'home' })
  }
  const keepThread = keepsPathForGuest(view)
  useEffect(() => {
    if (guest && !keepThread && window.location.pathname !== SECTION_PATHS.home) window.history.replaceState(null, '', SECTION_PATHS.home)
  }, [guest, keepThread])

  const navigate = (next: MeView, opts?: { replace?: boolean; search?: string }) => {
    // Trang chủ / logo khi đang ở /me?feed=… : CÙNG màn nhưng khác URL → vẫn về /me mặc định (Dành cho bạn)
    const url = viewPath(next) + (opts?.search ?? '')
    if (!sameView(view, next) || window.location.pathname + window.location.search !== url) {
      // đánh dấu: mục lịch sử do /me tạo → "Quay lại" an toàn. replace: đổi màn ngang hàng (Buổi trước/sau) không chồng lịch sử
      if (opts?.replace) window.history.replaceState(window.history.state, '', url)   // GIỮ dấu cũ (mở thẳng bằng link → không có dấu → "Về lớp" mở Trang Lớp, không rời trang)
      else window.history.pushState(IN_APP_STATE, '', url)
      setView(next)
    }
    setVisit(v => v + 1)
    window.scrollTo({ top: 0 })
  }
  // "Quay lại" như mạng xã hội: về đúng màn trước trong /me; mở thẳng bằng link → về màn cha hợp lý (fallback)
  const back = (fallback: MeView) => {
    if ((window.history.state as { cs?: number } | null)?.cs === IN_APP_STATE.cs) window.history.back()
    else navigate(fallback)
  }
  const go = (section: SocialSection) => navigate({ kind: 'section', section })
  const openProfile = (userId: string) => navigate({ kind: 'profile', userId })
  const openThread = (threadId: string) => navigate({ kind: 'thread', threadId })
  const openQueue = () => navigate({ kind: 'queue' })
  const openClass = (classId: string) => navigate({ kind: 'class', classId })
  // Trang Buổi luôn sâu MỘT cấp dưới Trang Lớp: chuyển Buổi trước/sau THAY mục lịch sử → "← Về lớp" luôn về lớp
  const openSession = (classId: string, sessionNo: number, opts?: { replace?: boolean }) =>
    navigate({ kind: 'session', classId, sessionNo }, opts)
  // LỚP CỦA TÔI = /me?feed=classes (bảng các lớp đang tham gia) · /me/classes = KHÁM PHÁ các lớp khác
  const openMyClasses = () => navigate(HOME, { search: '?feed=classes' })
  const openClasses = () => navigate({ kind: 'classes' })

  if (session.status === 'signed-out') return <MeGuestGate signIn={signInWithPassword} />
  if (session.status === 'no-profile') return <MeNoProfile email={session.email} onSignOut={() => void signOut()} />
  if (session.status !== 'ready') return <Splash text="Đang mở Class…" />

  return <SignedInShell base={session.me} view={view} onSection={go} onOpenProfile={openProfile} onOpenThread={openThread} onOpenQueue={openQueue} onOpenClass={openClass} onOpenSession={openSession} onOpenClasses={openClasses} onOpenMyClasses={openMyClasses} onBack={back} visit={visit} />
}

// Danh tính giữ ở MỘT chỗ: đổi ảnh xong → header, top bar, ô Trả bài, bình luận cập nhật ngay.
function SignedInShell({ base, view, onSection, onOpenProfile, onOpenThread, onOpenQueue, onOpenClass, onOpenSession, onOpenClasses, onOpenMyClasses, onBack, visit }: {
  base: ClassIdentity
  view: MeView
  onSection: (s: SocialSection) => void
  onOpenProfile: (userId: string) => void
  onOpenThread: (threadId: string) => void
  onOpenQueue: () => void
  onOpenClass: (classId: string) => void
  /** Trang Buổi (phòng học) của một lớp; replace = chuyển buổi ngang hàng */
  onOpenSession: (classId: string, sessionNo: number, opts?: { replace?: boolean }) => void
  /** /me/classes — Khám phá các lớp khác */
  onOpenClasses: () => void
  /** /me?feed=classes — Lớp của tôi (bảng các lớp đang tham gia) */
  onOpenMyClasses: () => void
  /** Quay lại màn trước trong /me (fallback khi mở thẳng bằng link) */
  onBack: (fallback: MeView) => void
  /** Lượt điều hướng — key của Home: bấm Trang chủ = Home mặc định mới (Dành cho bạn, đầu trang) */
  visit: number
}) {
  const [patch, setPatch] = useState<IdentityPatch>({})
  const [identityRev, setIdentityRev] = useState(0)   // tăng khi đổi ảnh đại diện / tên → feed tải lại danh tính mới
  const [editingProfile, setEditingProfile] = useState(false)
  const me = useMemo(() => ({ ...base, ...patch }), [base, patch])
  const onChanged = useCallback((p: IdentityPatch) => {
    setPatch(x => ({ ...x, ...p }))
    if (p.avatarUrl || p.name) setIdentityRev(r => r + 1)
  }, [])
  const editor = useProfileMediaEditor(me, onChanged)
  // Đăng xuất → useClassSession nhận SIGNED_OUT → /me về trạng thái khách (không chuyển trang)
  const onSignOut = useCallback(() => { void signOut() }, [])
  const section = view.kind === 'section' ? view.section : null
  // Lời mời kết bạn đến mình: MỘT nguồn cho badge menu + khối Home + trang Bạn bè
  const requests = useFriendRequests()
  // Lớp của tôi + Khám phá: MỘT nguồn cho sidebar, bảng Lớp của tôi (/me?feed=classes) và Khám phá (/me/classes)
  const classes = useSocialClasses()
  const activeClassId = view.kind === 'class' || view.kind === 'session' ? view.classId : null

  return (
    <ClassSocialLayout me={me} section={section} onSection={onSection} onOpenMyProfile={() => onOpenProfile(me.userId)}
      badges={{ friends: requests.count }}
      classNav={({ collapsed, onNavigate }) => (
        <ClassNav mine={classes.mine} loaded={classes.loaded} activeClassId={activeClassId}
          classesActive={view.kind === 'classes'} collapsed={collapsed}
          onOpenClass={id => { onOpenClass(id); onNavigate() }} onOpenClasses={() => { onOpenClasses(); onNavigate() }}
          onOpenMyClasses={() => { onOpenMyClasses(); onNavigate() }} />
      )}
      canEditAvatar={editor.canEditAvatar} onEditMedia={editor.pick} onSignOut={onSignOut}>
      {view.kind === 'profile' && (
        <ProfilePage key={view.userId} me={me} userId={view.userId} identityRev={identityRev} canEditAvatar={editor.canEditAvatar}
          onEditMedia={editor.pick} onBack={() => onBack(HOME)} onOpenProfile={onOpenProfile} onOpenThread={onOpenThread}
          onEditProfile={me.studentId ? () => setEditingProfile(true) : undefined} />
      )}
      {view.kind === 'thread' && (
        <ThreadPage key={view.threadId} threadId={view.threadId} isTeacher={me.isTeacher} onBack={() => onBack(HOME)}
          onOpenQueue={onOpenQueue} onOpenProfile={onOpenProfile} onOpenClass={onOpenClass} onOpenSession={onOpenSession} />
      )}
      {view.kind === 'queue' && (me.isTeacher
        ? <TeacherQueue onOpenThread={onOpenThread} onBack={() => onBack(HOME)} />
        : <div className="cs-col cs-home"><div className="cs-card lt-empty">Mục này dành cho giáo viên.</div></div>)}
      {view.kind === 'classes' && <ClassesPage classes={classes} onOpenClass={onOpenClass} onOpenMyClasses={onOpenMyClasses} />}
      {view.kind === 'class' && (
        <ClassPage key={view.classId} classId={view.classId} isTeacher={me.isTeacher} onOpenThread={onOpenThread} onOpenProfile={onOpenProfile}
          onOpenClasses={onOpenMyClasses} onOpenSession={no => onOpenSession(view.classId, no)} />
      )}
      {view.kind === 'session' && (
        <ClassSessionPage key={view.classId + ':' + view.sessionNo} classId={view.classId} sessionNo={view.sessionNo} isTeacher={me.isTeacher}
          onBackToClass={() => onBack({ kind: 'class', classId: view.classId })} onOpenSession={no => onOpenSession(view.classId, no, { replace: true })}
          onOpenThread={onOpenThread} />
      )}
      {section === 'home' && <MeHome key={visit} me={me} identityRev={identityRev} canEditAvatar={editor.canEditAvatar} onEditMedia={editor.pick}
        onOpenProfile={onOpenProfile} requests={requests} onSeeAllRequests={() => onSection('friends')}
        onOpenThread={onOpenThread} onOpenQueue={onOpenQueue} classes={classes} onOpenClass={onOpenClass}
        onOpenSession={(id, no) => onOpenSession(id, no)} onOpenDiscover={onOpenClasses} />}
      {section === 'friends' && <Friends requests={requests} onOpenProfile={onOpenProfile} />}
      {section === 'chat' && <Chat />}
      {section === 'tools' && <ToolsPage />}
      {editor.element}
      {editingProfile && <ProfileEditDialog me={me} onClose={() => setEditingProfile(false)} onSaved={onChanged} />}
    </ClassSocialLayout>
  )
}
