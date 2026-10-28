// Tab Lớp Học và tab Tôi — gom các chức năng Class hiện có, không viết lại nghiệp vụ.
//  • Lớp Học: "Lớp của tôi" = ClassesPage (Class Social, quy trình lớp/giáo trình/bài trả giữ nguyên);
//             "Khoá tự học" và "Luyện tập" = hai tab Học/Tập của App học cũ, nhúng nguyên (my_learning_state quyết quyền).
//  • Tôi: hồ sơ cộng đồng (ProfilePage: Tường · Hành trình) tách khỏi quản lý tài khoản (AccountPage).
import { lazy, Suspense, useEffect, useState } from 'react'
import { ChevronRight, CreditCard, Inbox, Settings, UserRound, Users } from 'lucide-react'
import type { ClassIdentity } from '../class-social/useClassSession'
import type { SocialClasses } from '../class-social/classes/useSocialClasses'
import type { FriendRequests } from '../class-social/friends/useFriendRequests'
import ClassesPage from '../class-social/classes/ClassesPage'
import IdentityHeader from '../class-social/sections/IdentityHeader'
import type { ImageKind } from '../class-social/profile/imageFile'

const StudentOnboarding = lazy(() => import('../StudentOnboarding'))

export type LearnSeg = 'mine' | 'courses' | 'practice'
const SEG_KEY = 'cm.learnSeg'
const SEGS: { id: LearnSeg; label: string }[] = [
  { id: 'mine', label: 'Lớp của tôi' },
  { id: 'courses', label: 'Khoá tự học' },
  { id: 'practice', label: 'Luyện tập' },
]
const readSeg = (): LearnSeg => {
  try { const v = sessionStorage.getItem(SEG_KEY); return SEGS.some(s => s.id === v) ? (v as LearnSeg) : 'mine' } catch { return 'mine' }
}

export function LearnTab({ classes, onOpenClass, onJoined }: {
  classes: SocialClasses
  onOpenClass: (id: string) => void
  onJoined: (id: string) => void
}) {
  const [seg, setSeg] = useState<LearnSeg>(readSeg)
  const [deep, setDeep] = useState(false)   // "Khoá tự học" đang ở màn con (hành trình/bài): màn con tự có tiêu đề + nút quay lại → khung nhường chỗ
  const embedDeep = deep && seg === 'courses'
  useEffect(() => { try { sessionStorage.setItem(SEG_KEY, seg) } catch { /* bỏ qua */ } }, [seg])
  return (
    <div className="cm-page">
      {!embedDeep && <h1 className="cm-title">Lớp Học</h1>}
      {!embedDeep && <div className="cm-seg" role="group" aria-label="Học tập">
        {SEGS.map(s => <button key={s.id} type="button" aria-pressed={seg === s.id} onClick={() => setSeg(s.id)}>{s.label}</button>)}
      </div>}
      {seg === 'mine' && <ClassesPage classes={classes} onOpenClass={onOpenClass} onJoined={onJoined} hideTitle />}
      {seg !== 'mine' && (
        <div className={'cm-embed' + (embedDeep ? ' is-deep' : '')}>
          <Suspense fallback={<div className="cm-skeleton" role="status" aria-label="Đang tải" />}>
            <StudentOnboarding key={seg} embed={seg === 'courses' ? 'hoc' : 'tap'} onDeepChange={setDeep} />
          </Suspense>
        </div>
      )}
    </div>
  )
}

function Row({ icon, title, hint, onClick, href, count }: {
  icon: React.ReactNode; title: string; hint?: string; onClick?: () => void; href?: string; count?: number
}) {
  const body = (
    <>
      <span className="cm-row-ic" aria-hidden="true">{icon}</span>
      <span className="cm-row-body"><div className="cm-row-t">{title}</div>{hint && <div className="cm-row-s">{hint}</div>}</span>
      {!!count && count > 0 && <span className="cm-count" aria-label={`${count} mới`}>{count}</span>}
      <ChevronRight className="cm-row-chev" aria-hidden="true" />
    </>
  )
  return <li>{href ? <a className="cm-row" href={href}>{body}</a> : <button type="button" className="cm-row" onClick={onClick}>{body}</button>}</li>
}

export function MeTab({ me, canEditAvatar, onEditMedia, requests, onOpenMyProfile, onEditProfile, onOpenFriends, onOpenAccount, onOpenQueue }: {
  me: ClassIdentity
  canEditAvatar: boolean
  onEditMedia: (kind: ImageKind) => void
  requests: FriendRequests
  onOpenMyProfile: () => void
  onEditProfile?: () => void
  onOpenFriends: () => void
  onOpenAccount: () => void
  onOpenQueue: () => void
}) {
  return (
    <div className="cm-page" style={{ paddingTop: 0 }}>
      <div className="cs-col" style={{ padding: 0 }}>
        <IdentityHeader me={me} canEditAvatar={canEditAvatar} onEdit={onEditMedia} onEditProfile={onEditProfile} />
      </div>

      <h2 className="cm-h2">Hoạt động</h2>
      <ul className="cm-list">
        <Row icon={<UserRound />} title="Trang cá nhân" hint="Tường, Hành trình, bài trả, bài Thầy sửa" onClick={onOpenMyProfile} />
        <Row icon={<Users />} title="Bạn bè" hint={requests.count > 0 ? `${requests.count} lời mời kết bạn` : 'Bạn bè và lời mời'} count={requests.count} onClick={onOpenFriends} />
      </ul>

      {me.isTeacher && (
        <>
          <h2 className="cm-h2">Dành cho Thầy</h2>
          <ul className="cm-list"><Row icon={<Inbox />} title="Hàng đợi Trả bài / Hỏi bài" onClick={onOpenQueue} /></ul>
        </>
      )}

      <h2 className="cm-h2">Tài khoản</h2>
      <ul className="cm-list">
        <Row icon={<CreditCard />} title="Gói của tôi" hint="Gói học đang dùng" href="/subscribe" />
        <Row icon={<Settings />} title="Tài khoản & cài đặt" hint="Hồ sơ, ảnh, mật khẩu, đăng xuất" onClick={onOpenAccount} />
      </ul>
    </div>
  )
}
