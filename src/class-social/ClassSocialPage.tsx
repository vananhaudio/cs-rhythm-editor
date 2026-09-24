// ─────────────────────────────────────────────────────────────────────────────
// Class Social — cửa chính của học sinh tại class.vananhaudio.com/me.
// Module ĐỘC LẬP: không import gì từ MobileStudentPortal/StudentOnboarding.
// App học hiện tại là một destination (/learn), mở bằng link thường.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import './classSocial.css'
import ClassSocialLayout from './ClassSocialLayout'
import { LEARN_PATH, SECTION_PATHS, sectionFromPath, type SocialSection } from './resolveMeRoute'
import { useClassSession, type ClassIdentity } from './useClassSession'
import { useProfileMediaEditor, type IdentityPatch } from './profile/useProfileMediaEditor'
import { signOut } from './profile/profileApi'
import MeHome from './sections/MeHome'
import Friends from './sections/Friends'
import Chat from './sections/Chat'
import ToolsPage from './sections/ToolsPage'

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
  const [section, setSection] = useState<SocialSection>(initialSection)

  // Chưa đăng nhập / không phải học sinh: P0 giữ hành vi cũ — về App học (có chế độ khách + đăng nhập)
  const leave = session.status === 'signed-out' || session.status === 'no-profile'
  useEffect(() => {
    if (leave) window.location.replace(LEARN_PATH)
  }, [leave])

  // Back/Forward của trình duyệt giữa các mục
  useEffect(() => {
    const onPop = () => setSection(sectionFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Chuẩn hoá /me/<lạ> → /me (không thêm mục lịch sử)
  useEffect(() => {
    const canonical = SECTION_PATHS[initialSection]
    if (window.location.pathname !== canonical) window.history.replaceState(null, '', canonical)
  }, [initialSection])

  useEffect(() => {
    document.title = TITLES[section]
  }, [section])

  const go = (next: SocialSection) => {
    if (next !== section) {
      window.history.pushState(null, '', SECTION_PATHS[next])
      setSection(next)
    }
    window.scrollTo({ top: 0 })
  }

  if (session.status !== 'ready') return <Splash text={leave ? 'Đang mở App học…' : 'Đang mở Class…'} />

  return <SignedInShell base={session.me} section={section} onSection={go} />
}

// Danh tính giữ ở MỘT chỗ: đổi ảnh xong → header, top bar, ô Trả bài, bình luận cập nhật ngay.
function SignedInShell({ base, section, onSection }: {
  base: ClassIdentity
  section: SocialSection
  onSection: (s: SocialSection) => void
}) {
  const [patch, setPatch] = useState<IdentityPatch>({})
  const [identityRev, setIdentityRev] = useState(0)   // tăng khi đổi ảnh đại diện → feed tải lại avatar mới
  const me = useMemo(() => ({ ...base, ...patch }), [base, patch])
  const onChanged = useCallback((p: IdentityPatch) => {
    setPatch(x => ({ ...x, ...p }))
    if (p.avatarUrl) setIdentityRev(r => r + 1)
  }, [])
  const editor = useProfileMediaEditor(me, onChanged)
  const onSignOut = useCallback(async () => {
    await signOut()
    window.location.replace(LEARN_PATH)
  }, [])

  return (
    <ClassSocialLayout me={me} section={section} onSection={onSection}
      canEditAvatar={editor.canEditAvatar} onEditMedia={editor.pick} onSignOut={() => void onSignOut()}>
      {section === 'home' && <MeHome me={me} identityRev={identityRev} canEditAvatar={editor.canEditAvatar} onEditMedia={editor.pick} />}
      {section === 'friends' && <Friends />}
      {section === 'chat' && <Chat />}
      {section === 'tools' && <ToolsPage />}
      {editor.element}
    </ClassSocialLayout>
  )
}
