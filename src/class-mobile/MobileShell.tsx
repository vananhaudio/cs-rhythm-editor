// Class Mobile V1 — khung ứng dụng sau đăng nhập: thanh trên + 5 tab + ngăn xếp màn hình theo tab.
// KHÔNG viết lại chức năng: mọi màn con là trang Class Social hiện có (Trang chủ/feed, Lớp, Buổi, Bài trả, Trò chuyện, Hồ sơ, Bạn bè…)
// gắn vào cùng dữ liệu/API (RPC, RLS) — chỉ đổi khung điều hướng sang kiểu ứng dụng điện thoại. Không đụng backend/phân quyền.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useKeyboardOpen } from './useKeyboardOpen'
import type { ClassIdentity } from '../class-social/useClassSession'
import { useProfileMediaEditor, type IdentityPatch } from '../class-social/profile/useProfileMediaEditor'
import { signOut } from '../class-social/profile/profileApi'
import ProfileEditDialog from '../class-social/profile/ProfileEditDialog'
import MeHome from '../class-social/sections/MeHome'
import Friends from '../class-social/sections/Friends'
import Chat from '../class-social/sections/Chat'
import ToolsPage from '../class-social/sections/ToolsPage'
import ProfilePage from '../class-social/sections/ProfilePage'
import ClassPage from '../class-social/classes/ClassPage'
import ClassSessionPage from '../class-social/classes/ClassSessionPage'
import ClassSpacePage from '../class-social/classes/ClassSpacePage'
import ThreadPage from '../learning-thread/ThreadPage'
import TeacherQueue from '../learning-thread/TeacherQueue'
import { BandsAdminPage } from '../band/BandAdmin'
import BandManagePage from '../band/BandManage'
import { useFriendRequests } from '../class-social/friends/useFriendRequests'
import { useChatUnread } from '../class-social/chat/useChat'
import type { ChatSelection } from '../class-social/chat/chatModel'
import { useSocialClasses } from '../class-social/classes/useSocialClasses'
import { refreshLearningIdentity } from '../class-social/identity/identityStore'
import type { SocialSection } from '../class-social/resolveMeRoute'
import {
  backOr, canPop, currentView, initialNav, LAST_TAB_KEY, pop, push, readLastTab, replace, selectTab,
  type MobileTab, type MobileView, type NavState,
} from './mobileNav'
import { BackBar, TabBar, TopBar } from './chrome'
import MoreSheet from './MoreSheet'
import BandTab from './BandTab'
import AccountPage from './AccountPage'
import { LearnTab, MeTab } from './LearnMeTabs'
import BlockedUsersPage from '../class-safety/BlockedUsersPage'
import ChangePasswordPage from './ChangePasswordPage'
import NoticesPage from './NoticesPage'

const HOME_VIEW: MobileView = { kind: 'tabRoot' }
const IN_APP_STATE = { cm: 1 }

const safeStorage = (): Storage | null => { try { return window.localStorage } catch { return null } }
const navKey = (s: NavState) => `${s.tab}:${s.stacks[s.tab].length}`

/** Khung sở hữu MỘT nút Quay lại cho mọi màn đã đi sâu vào tab; nút tự vẽ của từng màn con bị ẩn bằng CSS (.cm-root). Hội thoại và màn Lớp có header riêng nên giữ nguyên. */
const BACKBAR_KINDS: ReadonlySet<MobileView['kind']> = new Set(['account', 'notices', 'blocked', 'password', 'bands', 'bandAdmin', 'profile', 'thread', 'queue', 'session'])
function needsBackBar(v: MobileView): boolean {
  return (v.kind === 'section' && (v.section === 'friends' || v.section === 'tools')) || BACKBAR_KINDS.has(v.kind)
}

export default function MobileShell({ base }: { base: ClassIdentity }) {
  const [nav, setNav] = useState<NavState>(() => initialNav(readLastTab(safeStorage())))
  const navRef = useRef(nav)
  useEffect(() => { navRef.current = nav })   // chỉ đọc trong callback (không đọc khi render)
  const scrollMem = useRef<Record<string, number>>({})
  const keyboardOpen = useKeyboardOpen()
  const [more, setMore] = useState(false)
  const [homeVisit, setHomeVisit] = useState(0)

  // Danh tính giữ ở MỘT chỗ (như Class Social): đổi ảnh/tên xong feed + header cập nhật ngay
  const [patch, setPatch] = useState<IdentityPatch>({})
  const [identityRev, setIdentityRev] = useState(0)
  const [editingProfile, setEditingProfile] = useState(false)
  const me = useMemo(() => ({ ...base, ...patch }), [base, patch])
  const onChanged = useCallback((p: IdentityPatch) => {
    setPatch(x => ({ ...x, ...p }))
    if (p.avatarUrl || p.name) setIdentityRev(r => r + 1)
  }, [])
  const editor = useProfileMediaEditor(me, onChanged)

  const chatUnread = useChatUnread()
  const requests = useFriendRequests()
  const classes = useSocialClasses(me.isTeacher)

  // ── điều hướng ──
  const mutate = useCallback((fn: (s: NavState) => NavState) => {
    setNav(s => { scrollMem.current[navKey(s)] = window.scrollY; return fn(s) })
  }, [])
  const go = useCallback((view: MobileView, tab?: MobileTab) => {
    try { window.history.pushState(IN_APP_STATE, '') } catch { /* bỏ qua */ }
    mutate(s => push(s, view, tab))
  }, [mutate])
  const back = useCallback(() => {
    if ((window.history.state as { cm?: number } | null)?.cm === IN_APP_STATE.cm) window.history.back()
    else mutate(pop)
  }, [mutate])
  const backToOr = useCallback((fallback: MobileView) => {
    if (canPop(navRef.current)) back()
    else mutate(s => backOr(s, fallback))
  }, [back, mutate])
  // Phím Back (Android) / cử chỉ quay lại: đồng bộ với ngăn xếp của tab đang mở
  useEffect(() => {
    const onPop = () => mutate(s => (canPop(s) ? pop(s) : s))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [mutate])

  const selectTabAndScroll = useCallback((t: MobileTab) => {
    const same = navRef.current.tab === t
    mutate(s => selectTab(s, t))
    if (same) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      if (t === 'home' && !canPop(navRef.current)) setHomeVisit(v => v + 1)   // bấm lại Trang chủ = nạp feed mới, về đầu trang
    }
    try { safeStorage()?.setItem(LAST_TAB_KEY, t) } catch { /* bỏ qua */ }
  }, [mutate])

  // Khôi phục vị trí cuộn theo (tab, độ sâu) — đổi tab không bắt người dùng cuộn lại từ đầu
  const key = navKey(nav)
  useLayoutEffect(() => { window.scrollTo({ top: scrollMem.current[key] ?? 0 }) }, [key])

  const openProfile = (userId: string) => go({ kind: 'profile', userId })
  const openThread = (threadId: string) => go({ kind: 'thread', threadId })
  const openQueue = () => go({ kind: 'queue' })
  const openClass = (classId: string) => go({ kind: 'class', classId })
  const openBands = () => go({ kind: 'bands' })
  const openChatWith = (userId: string) => go({ kind: 'chatWith', userId })
  const openClassNode = (view: MobileView, replaceTop?: boolean) => (replaceTop ? mutate(s => replace(s, view)) : go(view))
  const openConversation = (conversationId: string, opts?: { replace?: boolean }) => {
    const top = currentView(navRef.current)
    const view: MobileView = { kind: 'chatConversation', conversationId }
    if (opts?.replace && (top.kind === 'chatWith' || top.kind === 'chatConversation')) mutate(s => replace(s, view))
    else go(view)
  }
  const joinedClass = () => { classes.reload(); refreshLearningIdentity(me.userId) }
  const onSignOut = () => { void signOut() }

  const view = currentView(nav)
  const tab = nav.tab
  const dmUnread = Math.max(0, chatUnread.count - (chatUnread.system?.unread ?? 0))
  const noticeCount = chatUnread.system?.unread ?? 0

  const chatPage = (selection: ChatSelection, system: typeof chatUnread.system) => (
    <Chat key="chat" systemTitle="Thông báo" meId={me.userId} selection={selection} onOpenConversation={openConversation}
      system={system} onOpenSystem={() => go({ kind: 'notices' })} onOpenThread={openThread}
      onBackToList={back} onOpenProfile={openProfile} onOpenFriends={() => go({ kind: 'section', section: 'friends' })}
      onUnreadChanged={() => void chatUnread.refresh()} />
  )

  function body(): React.ReactNode {
    switch (view.kind) {
      case 'tabRoot':
        switch (tab) {
          case 'home':
            return <MeHome key={homeVisit} me={me} identityRev={identityRev} canEditAvatar={editor.canEditAvatar} onEditMedia={editor.pick}
              onOpenProfile={openProfile} requests={requests} onSeeAllRequests={() => go({ kind: 'section', section: 'friends' })}
              onOpenThread={openThread} onOpenQueue={openQueue} classes={classes} onOpenClass={openClass}
              onJoinedClass={joinedClass} onOpenBands={openBands} />
          case 'class':
            return <LearnTab classes={classes} onOpenClass={openClass} onJoined={id => { joinedClass(); openClass(id) }} />
          case 'band':
            return <BandTab userId={me.userId} isTeacher={me.isTeacher} onOpenChat={() => selectTabAndScroll('chat')} onOpenBands={openBands} />
          case 'chat':
            return chatPage({ kind: 'none' }, null)   // thông báo hệ thống đã chuyển lên chuông (không lặp trong danh sách chat)
          case 'me':
            return <MeTab me={me} canEditAvatar={editor.canEditAvatar} onEditMedia={editor.pick} requests={requests}
              onOpenMyProfile={() => openProfile(me.userId)} onEditProfile={me.studentId ? () => setEditingProfile(true) : undefined}
              onOpenFriends={() => go({ kind: 'section', section: 'friends' })} onOpenAccount={() => go({ kind: 'account' })} onOpenQueue={openQueue} />
        }
        return null
      case 'section': {
        const s: SocialSection = view.section
        if (s === 'friends') return <Friends requests={requests} onOpenProfile={openProfile} onMessage={openChatWith} />
        if (s === 'tools') return <ToolsPage />
        if (s === 'chat') return chatPage({ kind: 'none' }, null)
        return null
      }
      case 'profile':
        return <ProfilePage key={view.userId} me={me} userId={view.userId} identityRev={identityRev} canEditAvatar={editor.canEditAvatar}
          onEditMedia={editor.pick} onBack={() => backToOr(HOME_VIEW)} onOpenProfile={openProfile} onOpenThread={openThread}
          onEditProfile={me.studentId ? () => setEditingProfile(true) : undefined} onFriendsChanged={() => void requests.refresh()}
          onMessage={openChatWith} />
      case 'thread':
        return <ThreadPage key={view.threadId} threadId={view.threadId} isTeacher={me.isTeacher} onBack={() => backToOr(HOME_VIEW)}
          onOpenQueue={openQueue} onOpenProfile={openProfile} onOpenClass={openClass}
          onOpenSession={(classId, no) => go({ kind: 'session', classId, sessionNo: no })} />
      case 'queue':
        return me.isTeacher
          ? <TeacherQueue onOpenThread={openThread} onBack={() => backToOr(HOME_VIEW)} />
          : <div className="cm-page"><div className="cm-note">Mục này dành cho giáo viên.</div></div>
      case 'classes':
        return <LearnTab classes={classes} onOpenClass={openClass} onJoined={id => { joinedClass(); openClass(id) }} />
      case 'class':
        return <ClassPage key={view.classId} classId={view.classId} isTeacher={me.isTeacher} onOpenThread={openThread}
          onOpenSpace={() => openClassNode({ kind: 'classSpace', classId: view.classId })}
          onOpenMembers={() => openClassNode({ kind: 'classMembers', classId: view.classId })}
          onOpenClasses={() => backToOr({ kind: 'classes' })}
          onOpenSession={no => go({ kind: 'session', classId: view.classId, sessionNo: no })} />
      case 'classSpace': case 'classMembers':
        return <ClassSpacePage key={'space:' + view.classId} classId={view.classId} tab={view.kind === 'classMembers' ? 'members' : 'space'}
          onOpenSpace={() => openClassNode({ kind: 'classSpace', classId: view.classId }, true)}
          onOpenMembers={() => openClassNode({ kind: 'classMembers', classId: view.classId }, true)}
          isTeacher={me.isTeacher} onOpenClasses={() => backToOr({ kind: 'classes' })} onOpenThread={openThread} onOpenProfile={openProfile}
          onBackToClass={() => backToOr({ kind: 'class', classId: view.classId })} />
      case 'session':
        return <ClassSessionPage key={view.classId + ':' + view.sessionNo} classId={view.classId} sessionNo={view.sessionNo} isTeacher={me.isTeacher}
          onBackToClass={() => backToOr({ kind: 'class', classId: view.classId })}
          onOpenSession={no => openClassNode({ kind: 'session', classId: view.classId, sessionNo: no }, true)} onOpenThread={openThread} />
      case 'bands':
        return <BandsAdminPage onOpenBand={slug => go({ kind: 'bandAdmin', slug })} />
      case 'bandAdmin':
        return <BandManagePage key={view.slug} slug={view.slug} onBack={() => backToOr({ kind: 'bands' })} />
      case 'chatConversation':
        return chatPage({ kind: 'conversation', id: view.conversationId }, null)
      case 'chatWith':
        return chatPage({ kind: 'with', userId: view.userId }, null)
      case 'chatSystem':
        return chatPage({ kind: 'system' }, chatUnread.system)
      case 'notices':
        return <NoticesPage onActivity={() => void chatUnread.refresh()} onOpenThread={id => openThread(id)} />
      case 'account':
        return <AccountPage me={me} canEditAvatar={editor.canEditAvatar} onEditMedia={editor.pick}
          onEditProfile={me.studentId ? () => setEditingProfile(true) : undefined} onSignOut={onSignOut}
          onOpenBlocked={() => go({ kind: 'blocked' })} onOpenPassword={() => go({ kind: 'password' })} />
      case 'blocked':
        return <BlockedUsersPage />
      case 'password':
        return <ChangePasswordPage />
    }
  }

  return (
    <div className={'cs-root cm-root' + (keyboardOpen ? ' is-keyboard' : '')}>
      <TopBar noticeCount={noticeCount} onHome={() => selectTabAndScroll('home')}
        onNotices={() => go({ kind: 'notices' })} onMore={() => setMore(true)} />
      <main className="cm-content cs-main">
        {needsBackBar(view) && canPop(nav) && <BackBar onBack={back} />}
        {body()}
      </main>
      <TabBar tab={tab} badges={{ chat: dmUnread, me: requests.count }} onSelect={selectTabAndScroll} />
      {more && <MoreSheet userId={me.userId} isTeacher={me.isTeacher} onClose={() => setMore(false)}
        onOpenQueue={openQueue} onOpenBands={openBands} />}
      {editor.element}
      {editingProfile && <ProfileEditDialog me={me} onClose={() => setEditingProfile(false)} onSaved={onChanged} />}
    </div>
  )
}

